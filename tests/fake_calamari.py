"""Local stand-in for the Calamari gateway: OAuth metadata, Dynamic Client
Registration, authorize/token endpoints and the MCP endpoint.

It enforces what the real server enforces (registered redirect URI, PKCE S256,
resource parameter, client authentication, bearer token) so a successful run
of the helper against it means the helper spoke the protocol correctly.
"""

import base64
import hashlib
import json
import secrets
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlencode, urlsplit

MCP_PATH = "/mcp-server/mcp"
AS_PATH = "/auth-server"


class FakeCalamari:
    def __init__(self):
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), _Handler)
        self.server.fake = self
        self.base_url = "http://127.0.0.1:%d" % self.server.server_port
        self.mcp_url = self.base_url + MCP_PATH

        # Knobs for the tests.
        self.response_mode = "json"  # or "sse"
        self.access_token_ttl = 3600
        self.refresh_fails = False
        self.token_status = None  # force an HTTP status on the token endpoint, e.g. 503
        self.protocol_version = None  # answer initialize with this version instead of echoing
        self.tool_error = False
        self.overlap_error = False  # only checkTimesheetOverlap fails
        self.mcp_status = None  # force an HTTP status on MCP calls, e.g. 429
        # Timesheet entries as (date, "HH:MM:SS" start, "HH:MM:SS" end or None
        # while running). A running entry lasts until `now`, which the tests
        # also hand to the helper (CALAMARI_NOW).
        self.now = "2026-09-22T14:00:00"
        self.shifts = []
        # Shape of the real getWorkPlan answer.
        week = [(d, "09:00", "16:45") for d in ("MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY")]
        week += [("FRIDAY", "09:00", "16:30"), ("SATURDAY", None, None), ("SUNDAY", None, None)]
        self.work_plan = {"id": 3, "name": "Vollzeit", "days": [
            {"dayOfWeek": d, "workingDay": start is not None, "startTime": start, "finishTime": end,
             "durationSeconds": None if start is None else 27900} for d, start, end in week]}
        # Shapes of the real getPublicHolidays / search answers.
        self.holidays = [
            {"name": "Tag der Deutschen Einheit", "start": "2026-10-03", "end": "2026-10-03", "halfDay": False, "halfdayPeriod": None},
            {"name": "Heiligabend (PM)", "start": "2026-12-24", "end": "2026-12-24", "halfDay": True, "halfdayPeriod": "PM"},
        ]
        me, other = "00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000003"
        self.absences = [
            (me, {"userId": 1, "name": "Erika Mustermann", "category": "TIMEOFF", "fullDayRequest": True,
                  "start": "2026-10-12T00:00", "end": "2026-10-16T00:00"}),
            (me, {"userId": 1, "name": "Erika Mustermann", "category": "WORK", "fullDayRequest": True,
                  "start": "2026-11-02T00:00", "end": "2026-11-02T00:00"}),
            (other, {"userId": 3, "name": "Max Mustermann", "category": "TIMEOFF", "fullDayRequest": True,
                     "start": "2026-10-19T00:00", "end": "2026-10-19T00:00"}),
        ]
        # Shape of the real getMyProfile answer (trimmed).
        self.profile = {"personUuid": "00000000-0000-4000-8000-000000000001", "legacyId": 1,
                        "name": "Erika Mustermann", "email": "erika@example.com",
                        "directManager": {"personUuid": "00000000-0000-4000-8000-000000000002",
                                          "name": "Max Mustermann", "email": "max@example.com"},
                        "teams": [{"id": 1, "name": "IT-Team"}], "roles": []}

        # Observable state.
        self.clients = {}
        self.codes = {}
        self.access_tokens = set()
        self.refresh_tokens = set()
        self.sessions = set()
        self.initialized_sessions = set()
        self.session_versions = {}
        self.token_requests = []
        self.tool_calls = []
        self.overlap_calls = 0

    def __enter__(self):
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        return self

    def __exit__(self, *exc):
        self.server.shutdown()
        self.server.server_close()

    def revoke_access_tokens(self):
        self.access_tokens.clear()

    def issue_tokens(self):
        access, refresh = secrets.token_hex(8), secrets.token_hex(8)
        self.access_tokens.add(access)
        self.refresh_tokens.add(refresh)
        return {"access_token": access, "refresh_token": refresh,
                "token_type": "Bearer", "expires_in": self.access_token_ttl,
                "scope": "mcp"}


class _Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    @property
    def fake(self):
        return self.server.fake

    def _send(self, status, body=None, headers=None, content_type="application/json"):
        data = b"" if body is None else (body if isinstance(body, bytes) else json.dumps(body).encode())
        self.send_response(status)
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        if body is not None:
            self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _body(self):
        return self.rfile.read(int(self.headers.get("Content-Length") or 0))

    def do_GET(self):
        url = urlsplit(self.path)
        base = self.fake.base_url
        if url.path == "/.well-known/oauth-protected-resource" + MCP_PATH:
            return self._send(200, {"resource": self.fake.mcp_url,
                                    "authorization_servers": [base + AS_PATH],
                                    "scopes_supported": ["mcp"]})
        if url.path == "/.well-known/oauth-authorization-server" + AS_PATH:
            return self._send(200, {
                "issuer": base + AS_PATH,
                "authorization_endpoint": base + AS_PATH + "/oauth2/authorize",
                "token_endpoint": base + AS_PATH + "/oauth2/token",
                "registration_endpoint": base + AS_PATH + "/oauth2/register",
                "token_endpoint_auth_methods_supported": ["client_secret_basic", "client_secret_post"],
                "code_challenge_methods_supported": ["S256"],
                "scopes_supported": ["mcp"],
            })
        if url.path == AS_PATH + "/oauth2/authorize":
            return self._authorize(parse_qs(url.query))
        self._send(404, {"error": "not_found"})

    def do_POST(self):
        path = urlsplit(self.path).path
        if path == AS_PATH + "/oauth2/register":
            return self._register(json.loads(self._body()))
        if path == AS_PATH + "/oauth2/token":
            return self._token({k: v[0] for k, v in parse_qs(self._body().decode()).items()})
        if path == MCP_PATH:
            return self._mcp(json.loads(self._body()))
        self._send(404, {"error": "not_found"})

    def _register(self, req):
        if not req.get("redirect_uris"):
            return self._send(400, {"error": "invalid_request"})
        client_id, secret = secrets.token_hex(6), secrets.token_hex(12)
        self.fake.clients[client_id] = {"secret": secret, **req}
        self._send(201, {"client_id": client_id, "client_secret": secret,
                         "redirect_uris": req["redirect_uris"],
                         "token_endpoint_auth_method": "client_secret_basic"})

    def _authorize(self, q):
        q = {k: v[0] for k, v in q.items()}
        client = self.fake.clients.get(q.get("client_id"))
        if (not client or q.get("redirect_uri") not in client["redirect_uris"]
                or q.get("response_type") != "code"
                or q.get("code_challenge_method") != "S256" or not q.get("code_challenge")
                or q.get("resource") != self.fake.mcp_url or q.get("scope") != "mcp"):
            return self._send(400, {"error": "invalid_request", "query": q})
        code = secrets.token_hex(8)
        self.fake.codes[code] = q
        location = q["redirect_uri"] + "?" + urlencode({"code": code, "state": q.get("state", "")})
        self._send(302, headers={"Location": location})

    def _client_ok(self, form):
        auth = self.headers.get("Authorization", "")
        if auth.startswith("Basic "):
            cid, _, secret = base64.b64decode(auth[6:]).decode().partition(":")
        else:
            cid, secret = form.get("client_id"), form.get("client_secret")
        client = self.fake.clients.get(cid)
        return client is not None and client["secret"] == secret

    def _token(self, form):
        self.fake.token_requests.append(form)
        if self.fake.token_status:
            return self._send(self.fake.token_status, b"upstream down", content_type="text/plain")
        if not self._client_ok(form):
            return self._send(401, {"error": "invalid_client"})
        if form.get("grant_type") == "authorization_code":
            req = self.fake.codes.pop(form.get("code"), None)
            verifier = form.get("code_verifier", "")
            challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
            if (not req or challenge != req["code_challenge"]
                    or form.get("redirect_uri") != req["redirect_uri"]):
                return self._send(400, {"error": "invalid_grant"})
            return self._send(200, self.fake.issue_tokens())
        if form.get("grant_type") == "refresh_token":
            token = form.get("refresh_token")
            if self.fake.refresh_fails or token not in self.fake.refresh_tokens:
                return self._send(400, {"error": "invalid_grant"})
            self.fake.refresh_tokens.discard(token)  # rotation
            return self._send(200, self.fake.issue_tokens())
        self._send(400, {"error": "unsupported_grant_type"})

    def _mcp(self, msg):
        if self.fake.mcp_status:
            return self._send(self.fake.mcp_status, {"error": "forced"})
        auth = self.headers.get("Authorization", "")
        if not auth.startswith("Bearer ") or auth[7:] not in self.fake.access_tokens:
            return self._send(401, headers={"WWW-Authenticate": 'Bearer scope="mcp"'})
        method = msg.get("method")
        session = self.headers.get("Mcp-Session-Id")
        if method == "initialize":
            session = secrets.token_hex(8)
            self.fake.sessions.add(session)
            version = self.fake.protocol_version or msg["params"]["protocolVersion"]
            self.fake.session_versions[session] = version
            return self._reply(msg["id"], {"protocolVersion": version,
                                           "capabilities": {"tools": {}},
                                           "serverInfo": {"name": "fake-calamari", "version": "0"}},
                               {"Mcp-Session-Id": session})
        if session not in self.fake.sessions:
            return self._send(404, {"error": "unknown session"})
        if self.headers.get("MCP-Protocol-Version") != self.fake.session_versions[session]:
            return self._send(400, {"error": "unsupported protocol version"})
        if method == "notifications/initialized":
            self.fake.initialized_sessions.add(session)
            return self._send(202)
        if session not in self.fake.initialized_sessions:
            return self._send(400, {"error": "not initialized"})
        if method == "tools/list":
            tools = [{"name": n, "description": "fake " + n, "inputSchema": {"type": "object", "properties": {}}}
                     for n in ("getMyProfile", "clockIn", "clockOut", "checkTimesheetOverlap")]
            return self._reply(msg["id"], {"tools": tools})
        if method == "tools/call":
            name = msg["params"]["name"]
            self.fake.tool_calls.append((name, msg["params"].get("arguments")))
            if self.fake.tool_error:
                return self._reply(msg["id"], {"isError": True, "content": [{"type": "text", "text": "boom"}]})
            if name == "checkTimesheetOverlap":
                if self.fake.overlap_error:
                    return self._reply(msg["id"], {"isError": True, "content": [{"type": "text", "text": "boom"}]})
                return self._overlap(msg["id"], msg["params"]["arguments"])
            if name in ("clockIn", "clockOut"):
                return self._clock(msg["id"], name)
            if name == "getPublicHolidays":
                args = msg["params"]["arguments"]
                found = [h for h in self.fake.holidays if h["start"] <= args["to"] and h["end"] >= args["from"]]
                return self._reply(msg["id"], {"content": [{"type": "text", "text": json.dumps(
                    {"from": args["from"], "to": args["to"], "holidays": found})}]})
            if name == "search":
                # Without peopleUuids the real tool returns the whole company.
                args = msg["params"]["arguments"]
                people = args.get("peopleUuids")
                found = [a for uuid, a in self.fake.absences
                         if (people is None or uuid in people)
                         and a["start"][:10] <= args["to"] and a["end"][:10] >= args["from"]]
                return self._reply(msg["id"], {"content": [{"type": "text", "text": json.dumps(
                    {"returned": len(found), "nextCursor": None, "absences": found})}]})
            if name == "getWorkPlan":
                return self._reply(msg["id"], {"content": [{"type": "text", "text": json.dumps(self.fake.work_plan)}]})
            if name == "getMyProfile":
                return self._reply(msg["id"], {"content": [{"type": "text", "text": json.dumps(self.fake.profile)}]})
            return self._reply(msg["id"], error={"code": -32602, "message": "Unknown tool " + name})
        self._reply(msg.get("id"), error={"code": -32601, "message": "Method not found"})

    def _overlap(self, msg_id, args):
        """Mimics Calamari: an entry overlaps a window if they share any instant
        (touching ends do not count), a running entry reaches up to now."""
        def secs(hms):
            h, m, *s = (int(p) for p in hms.split(":"))
            return h * 3600 + m * 60 + (s[0] if s else 0)
        today, now = self.fake.now.split("T")
        dates = []
        for e in args["entries"]:
            a, b = secs(e["fromTime"]), secs(e["toTime"])
            if len(e["fromTime"]) != 5 or len(e["toTime"]) != 5 or a >= b:
                return self._reply(msg_id, {"isError": True, "content": [{"type": "text", "text": "bad entry %r" % e}]})
            for date, start, end in self.fake.shifts:
                end_s = secs(end) if end else (secs(now) if date == today else 86400)
                if date == e["date"] and a < end_s and secs(start) < b and date not in dates:
                    dates.append(date)
        self.fake.overlap_calls += 1
        return self._reply(msg_id, {"content": [{"type": "text", "text": json.dumps(dates)}], "isError": False})

    def _clock(self, msg_id, name):
        """clockIn opens an entry at now, clockOut ends the running one. Both
        refuse when there is nothing to do, as a stamp clock would."""
        today, now = self.fake.now.split("T")
        # A shift begun yesterday may still run (overnight case).
        running = [i for i, (_, _, end) in enumerate(self.fake.shifts) if end is None]
        if (name == "clockIn") == bool(running):
            text = "shift already started" if running else "no started shift"
            return self._reply(msg_id, {"isError": True, "content": [{"type": "text", "text": text}]})
        if name == "clockIn":
            self.fake.shifts.append((today, now, None))
        else:
            date, start, _ = self.fake.shifts[running[0]]
            self.fake.shifts[running[0]] = (date, start, now)
        # The real answer's shape is unknown yet; the helper must not rely on it.
        return self._reply(msg_id, {"content": [{"type": "text", "text": "OK"}], "isError": False})

    def _reply(self, msg_id, result=None, headers=None, error=None):
        payload = {"jsonrpc": "2.0", "id": msg_id}
        payload.update({"error": error} if error else {"result": result})
        if self.fake.response_mode == "sse":
            # A server notification first, as real streams may interleave.
            notice = {"jsonrpc": "2.0", "method": "notifications/message", "params": {"level": "info"}}
            body = ("event: message\ndata: %s\n\nevent: message\ndata: %s\n\n"
                    % (json.dumps(notice), json.dumps(payload))).encode()
            return self._send(200, body, headers, "text/event-stream")
        self._send(200, payload, headers)
