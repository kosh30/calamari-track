"""Seam B: the command-line interface of bin/calamari against a fake gateway."""

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from tests.fake_calamari import FakeCalamari

ROOT = Path(__file__).resolve().parent.parent
HELPER = ROOT / "bin" / "calamari"
FAKE_BROWSER = Path(__file__).resolve().parent / "fake_browser.py"


class CalamariCliTest(unittest.TestCase):
    def setUp(self):
        self.fake = FakeCalamari().__enter__()
        self.addCleanup(self.fake.__exit__)
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.keyring = Path(tmp.name) / "keyring.json"

    def start_helper(self, *args, base_url=None):
        env = dict(os.environ,
                   CALAMARI_BASE_URL=base_url or self.fake.base_url,
                   CALAMARI_KEYRING_FILE=str(self.keyring),
                   BROWSER="%s %s %%s" % (sys.executable, FAKE_BROWSER))
        return subprocess.Popen([sys.executable, str(HELPER), *args], env=env,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

    def finish_helper(self, proc):
        stdout, stderr = proc.communicate(timeout=30)
        try:
            out = json.loads(stdout)
        except json.JSONDecodeError:
            self.fail("stdout is not one JSON object: %r (stderr: %s)" % (stdout, stderr))
        return proc.returncode, out

    def run_helper(self, *args, base_url=None):
        return self.finish_helper(self.start_helper(*args, base_url=base_url))

    def keyring_text(self):
        return self.keyring.read_text()

    def login(self):
        code, out = self.run_helper("login")
        self.assertEqual((code, out["ok"]), (0, True), out)

    def assert_error(self, result, error_code):
        code, out = result
        self.assertNotEqual(code, 0)
        self.assertEqual(out["ok"], False)
        self.assertEqual(out["error"]["code"], error_code)
        self.assertIsInstance(out["error"]["message"], str)

    # Login

    def test_login_registers_a_client_and_keeps_client_and_tokens_in_the_keyring(self):
        self.login()

        stored = self.keyring_text()
        (client_id,) = self.fake.clients
        self.assertIn(client_id, stored)
        self.assertIn(self.fake.clients[client_id]["secret"], stored)
        self.assertTrue(all(t in stored for t in self.fake.access_tokens | self.fake.refresh_tokens))

    def test_login_registers_a_loopback_redirect(self):
        self.login()

        (client,) = self.fake.clients.values()
        (redirect,) = client["redirect_uris"]
        self.assertTrue(redirect.startswith("http://127.0.0.1:"), redirect)
        self.assertEqual(client["grant_types"], ["authorization_code", "refresh_token"])

    def test_login_proves_pkce_and_names_the_mcp_resource(self):
        self.login()

        (exchange,) = [r for r in self.fake.token_requests if r["grant_type"] == "authorization_code"]
        # The fake only issues tokens if the verifier hashes to the challenge.
        self.assertGreaterEqual(len(exchange["code_verifier"]), 43)
        self.assertEqual(exchange["resource"], self.fake.mcp_url)

    # whoami

    def test_whoami_returns_the_users_name(self):
        self.login()

        code, out = self.run_helper("whoami")

        self.assertEqual(code, 0)
        self.assertEqual(out["ok"], True)
        self.assertEqual(out["name"], "Erika Mustermann")
        self.assertEqual(out["email"], "erika@example.com")
        self.assertEqual(self.fake.tool_calls, [("getMyProfile", {})])

    def test_whoami_understands_sse_responses(self):
        self.login()
        self.fake.response_mode = "sse"

        code, out = self.run_helper("whoami")

        self.assertEqual((code, out["name"]), (0, "Erika Mustermann"))

    # Refresh

    def refresh_requests(self):
        return [r for r in self.fake.token_requests if r["grant_type"] == "refresh_token"]

    def test_expired_token_is_refreshed_before_the_call(self):
        self.fake.access_token_ttl = 0
        self.login()

        code, out = self.run_helper("whoami")

        self.assertEqual((code, out["ok"]), (0, True), out)
        self.assertEqual(len(self.refresh_requests()), 1)
        self.assertEqual(self.refresh_requests()[0]["resource"], self.fake.mcp_url)
        # The rotated refresh token was kept: the next run refreshes again.
        code, out = self.run_helper("whoami")
        self.assertEqual((code, out["ok"]), (0, True), out)

    def test_concurrent_runs_share_one_rotating_refresh_token(self):
        self.fake.access_token_ttl = 0
        self.login()

        procs = [self.start_helper("whoami") for _ in range(3)]
        results = [self.finish_helper(p) for p in procs]

        self.assertEqual([r[0] for r in results], [0, 0, 0], results)

    def test_rejected_token_is_refreshed_and_the_call_retried(self):
        self.login()
        self.fake.revoke_access_tokens()

        code, out = self.run_helper("whoami")

        self.assertEqual((code, out["name"]), (0, "Erika Mustermann"), out)
        self.assertEqual(self.fake.tool_calls, [("getMyProfile", {})])

    def test_unavailable_token_endpoint_is_not_a_login_problem(self):
        self.fake.access_token_ttl = 0
        self.login()
        self.fake.token_status = 503

        self.assert_error(self.run_helper("whoami"), "MCP_ERROR")

    def test_failed_refresh_means_auth_required(self):
        self.login()
        self.fake.revoke_access_tokens()
        self.fake.refresh_fails = True

        self.assert_error(self.run_helper("whoami"), "AUTH_REQUIRED")

    def test_without_login_auth_is_required(self):
        self.assert_error(self.run_helper("whoami"), "AUTH_REQUIRED")

    # Other failures

    def test_rate_limit_is_reported(self):
        self.login()
        self.fake.mcp_status = 429

        self.assert_error(self.run_helper("whoami"), "RATE_LIMITED")

    def test_whoami_follows_the_negotiated_protocol_version(self):
        self.login()
        self.fake.protocol_version = "2025-03-26"

        code, out = self.run_helper("whoami")

        self.assertEqual((code, out["ok"]), (0, True), out)

    def test_tool_error_is_an_mcp_error(self):
        self.login()
        self.fake.tool_error = True

        self.assert_error(self.run_helper("whoami"), "MCP_ERROR")

    def test_unreachable_gateway_is_a_network_error(self):
        self.login()

        self.assert_error(self.run_helper("whoami", base_url="http://127.0.0.1:9"), "NETWORK")

    def test_unknown_command_is_a_usage_error(self):
        self.assert_error(self.run_helper("frobnicate"), "USAGE")


if __name__ == "__main__":
    unittest.main()
