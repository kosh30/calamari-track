"""Seam B: the command-line interface of bin/calamari against a fake gateway."""

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from tests.fake_calamari import FakeCalamari

ROOT = Path(__file__).resolve().parent.parent
HELPER = ROOT / "bin" / "calamari"
FAKE_BROWSER = Path(__file__).resolve().parent / "fake_browser.py"
MANIFEST_VERSION = json.loads((ROOT / "manifest.json").read_text())["version"]


class CalamariCliTest(unittest.TestCase):
    def setUp(self):
        self.fake = FakeCalamari().__enter__()
        self.addCleanup(self.fake.__exit__)
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.keyring = Path(tmp.name) / "keyring.json"
        self.log = Path(tmp.name) / "journal.log"

    def start_helper(self, *args, base_url=None, api_url=None, helper=HELPER):
        env = dict(
            os.environ,
            CALAMARI_BASE_URL=base_url or self.fake.base_url,
            CALAMARI_API_URL=self.fake.api_url if api_url is None else api_url,
            CALAMARI_KEYRING_FILE=str(self.keyring),
            CALAMARI_LOG_FILE=str(self.log),
            CALAMARI_NOW=self.fake.now,
            BROWSER="%s %s %%s" % (sys.executable, FAKE_BROWSER),
        )
        return subprocess.Popen(
            [sys.executable, str(helper), *args],
            env=env,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )

    def finish_helper(self, proc, input=None):
        stdout, stderr = proc.communicate(input, timeout=30)
        try:
            out = json.loads(stdout)
        except json.JSONDecodeError:
            self.fail("stdout is not one JSON object: %r (stderr: %s)" % (stdout, stderr))
        return proc.returncode, out

    def run_helper(self, *args, base_url=None, api_url=None, input=None, helper=HELPER):
        return self.finish_helper(self.start_helper(*args, base_url=base_url, api_url=api_url, helper=helper), input)

    def log_text(self):
        return self.log.read_text() if self.log.exists() else ""

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
        self.assertEqual(out["personUuid"], "00000000-0000-4000-8000-000000000001")
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

    # Schichtstatus

    def test_status_sees_a_running_shift(self):
        self.login()
        self.store_api_key()
        self.fake.shifts = [("2026-09-22", "09:40:30", None)]

        code, out = self.run_helper("status")

        self.assertEqual((code, out), (0, {"ok": True, "shift": "running", "startedAt": "09:40", "breakSince": None}))
        self.assertIn(("/clockin/shift/status/v1/get-current", {"person": "erika@example.com"}), self.fake.rest_calls)

    def test_status_without_shift_is_stopped(self):
        self.login()
        self.store_api_key()
        self.fake.shifts = [("2026-09-22", "08:00:00", "12:00:00")]

        code, out = self.run_helper("status")

        self.assertEqual((code, out), (0, {"ok": True, "shift": "stopped", "startedAt": None, "breakSince": None}))
        # Nothing runs, so there is no entry to read.
        self.assertNotIn("/clockin/timesheetentries/v1/find", [p for p, _ in self.fake.rest_calls])

    def test_status_sees_a_break(self):
        self.login()
        self.store_api_key()
        self.fake.shifts = [("2026-09-22", "08:00:00", "09:30:00"), ("2026-09-22", "09:40:30", None)]
        self.fake.breaks = [("2026-09-22", "11:00:00", "11:10:00"), ("2026-09-22", "12:05:40", None)]

        code, out = self.run_helper("status")

        # The start of the running shift and of its open break, local time.
        self.assertEqual((code, out), (0, {"ok": True, "shift": "break", "startedAt": "09:40", "breakSince": "12:05"}))
        (req,) = [r for p, r in self.fake.rest_calls if p == "/clockin/timesheetentries/v1/find"]
        self.assertEqual(req["employees"], ["erika@example.com"])
        self.assertEqual((req["from"], req["to"]), ("2026-09-22", "2026-09-22"))

    def test_status_without_the_times_still_tells_the_status(self):
        self.login()
        self.store_api_key()
        self.fake.shifts = [("2026-09-22", "09:40:30", None)]
        self.fake.breaks = [("2026-09-22", "12:05:40", None)]
        self.fake.find_failure = (403, None)

        code, out = self.run_helper("status")

        self.assertEqual((code, out), (0, {"ok": True, "shift": "break", "startedAt": None, "breakSince": None}))
        self.assertIn("API_SCOPE_MISSING", self.log_text())

    def test_status_no_longer_sees_a_shift_ended_a_minute_ago(self):
        # REST knows the status; the lag of the overlap trick is gone.
        self.login()
        self.store_api_key()
        self.fake.shifts = [("2026-09-22", "08:00:00", "13:59:00")]

        code, out = self.run_helper("status")

        self.assertEqual((code, out), (0, {"ok": True, "shift": "stopped", "startedAt": None, "breakSince": None}))
        self.assertEqual(self.fake.overlap_calls, 0)

    def test_status_with_an_unexpected_answer_is_an_api_error(self):
        self.login()
        self.store_api_key()
        self.fake.shift_status = "PAUSED"

        self.assert_error(self.run_helper("status"), "API_ERROR")

    def test_status_without_api_key_asks_for_one(self):
        self.login()

        self.assert_error(self.run_helper("status"), "API_KEY_REQUIRED")

    def test_day_end_sees_a_shift_that_was_still_open_at_the_end_of_the_day(self):
        # Calamari ends an open shift at 23:59 (company policy), so the entry
        # of such a day has a wrong end time and the user has to correct it.
        self.login()
        self.fake.now = "2026-09-23T07:30:00"
        self.fake.shifts = [("2026-09-22", "09:40:30", "23:59:00")]

        code, out = self.run_helper("day-end", "--date", "2026-09-22")

        self.assertEqual((code, out), (0, {"ok": True, "ranToMidnight": True}))

    def test_day_end_with_a_shift_the_user_ended_earlier(self):
        self.login()
        self.fake.now = "2026-09-23T07:30:00"
        self.fake.shifts = [("2026-09-22", "09:40:30", "18:00:00")]

        code, out = self.run_helper("day-end", "--date", "2026-09-22")

        self.assertEqual((code, out), (0, {"ok": True, "ranToMidnight": False}))

    def test_day_end_takes_one_call_and_never_stamps(self):
        self.login()
        self.fake.now = "2026-09-23T07:30:00"
        self.fake.shifts = [("2026-09-22", "09:40:30", "23:59:00")]

        self.run_helper("day-end", "--date", "2026-09-22")

        self.assertEqual(self.fake.overlap_calls, 1)
        self.assertEqual([n for n, _ in self.fake.tool_calls], ["checkTimesheetOverlap"])

    def test_day_end_needs_a_date(self):
        self.login()

        code, out = self.run_helper("day-end")

        self.assertEqual((code, out["error"]["code"]), (1, "USAGE"))

    def test_day_end_rejects_a_bad_date(self):
        self.login()

        code, out = self.run_helper("day-end", "--date", "22.09.2026")

        self.assertEqual((code, out["error"]["code"]), (1, "USAGE"))

    def test_start_time_finds_the_start_minute_of_the_running_shift(self):
        self.login()
        self.fake.shifts = [("2026-09-22", "09:40:30", None)]

        code, out = self.run_helper("start-time")

        self.assertEqual((code, out), (0, {"ok": True, "startedAt": "09:40"}))
        self.assertLessEqual(self.fake.overlap_calls, 12)
        self.assertEqual(len(self.fake.sessions), 1)

    def test_start_time_after_a_break_finds_the_later_shift(self):
        self.login()
        self.fake.shifts = [("2026-09-22", "08:00:10", "12:00:00"), ("2026-09-22", "12:45:20", None)]

        code, out = self.run_helper("start-time", "--after", "12:30")

        self.assertEqual((code, out), (0, {"ok": True, "startedAt": "12:45"}))

    def test_start_time_without_running_shift_is_null(self):
        self.login()
        self.fake.shifts = [("2026-09-22", "08:00:00", "12:00:00")]

        code, out = self.run_helper("start-time", "--after", "12:30")

        self.assertEqual((code, out), (0, {"ok": True, "startedAt": None}))

    def test_end_time_finds_the_end_minute_of_the_last_shift_since_after(self):
        self.login()
        self.fake.shifts = [("2026-09-22", "08:00:10", "10:15:20"), ("2026-09-22", "10:30:40", "12:00:30")]

        code, out = self.run_helper("end-time", "--after", "10:30")

        self.assertEqual((code, out), (0, {"ok": True, "endedAt": "12:00"}))
        self.assertLessEqual(self.fake.overlap_calls, 12)

    def test_end_time_without_a_shift_since_after_is_null(self):
        self.login()
        self.fake.shifts = [("2026-09-22", "08:00:10", "10:15:20")]

        code, out = self.run_helper("end-time", "--after", "11:00")

        self.assertEqual((code, out), (0, {"ok": True, "endedAt": None}))

    def test_end_time_needs_after(self):
        self.assert_error(self.run_helper("end-time"), "USAGE")

    def test_start_time_rejects_a_malformed_after(self):
        self.assert_error(self.run_helper("start-time", "--after", "7 Uhr"), "USAGE")

    # Stempeln

    def clock_ins(self):
        return [req for path, req in self.fake.rest_calls if path == "/clockin/terminal/v1/clock-in"]

    def test_clock_in_stamps_over_rest_with_the_default_project(self):
        self.login()
        self.store_api_key()
        self.fake.now = "2026-09-22T14:00:30"
        self.fake.shifts = [("2026-09-22", "08:00:00", "12:00:00")]

        code, out = self.run_helper("clock-in")

        self.assertEqual((code, out), (0, {"ok": True, "running": True}))
        self.assertIn(("2026-09-22", "14:00:30", None), self.fake.shifts)
        (req,) = self.clock_ins()
        self.assertEqual((req["person"], req["projectId"]), ("erika@example.com", 7))
        # Now, as local time without zone.
        self.assertEqual(req["time"], "2026-09-22T14:00:30")
        # Neither MCP clockIn nor a check afterwards: shiftStatus is the answer.
        self.assertEqual([n for n, _ in self.fake.tool_calls if n != "getMyProfile"], [])

    def test_clock_in_resolves_the_named_project(self):
        self.login()
        self.store_api_key()

        code, out = self.run_helper("clock-in", "--project", "Kunde A")

        self.assertEqual((code, out["running"]), (0, True), out)
        self.assertEqual([req["projectId"] for req in self.clock_ins()], [9])

    def test_clock_in_with_an_unknown_project_stamps_nothing(self):
        self.login()
        self.store_api_key()

        code, out = self.run_helper("clock-in", "--project", "Kunde B")

        self.assert_error((code, out), "PROJECT_UNKNOWN")
        self.assertIn("Kunde B", out["error"]["message"])
        self.assertEqual(out["error"]["project"], "Kunde B")
        self.assertEqual((self.clock_ins(), self.fake.shifts), ([], []))
        self.assertNotIn("clockIn", [n for n, _ in self.fake.tool_calls])

    def test_clock_in_reports_the_shift_status_calamari_answers(self):
        # Calamari ignores a clock-in during a running shift and says STARTED.
        self.login()
        self.store_api_key()
        self.fake.shifts = [("2026-09-22", "09:40:30", None)]

        code, out = self.run_helper("clock-in")

        self.assertEqual((code, out), (0, {"ok": True, "running": True}))
        self.assertEqual(len(self.fake.shifts), 1)

        self.fake.clock_in_status = "FINISHED"
        self.assertEqual(self.run_helper("clock-in"), (0, {"ok": True, "running": False}))

    def test_clock_in_without_api_key_does_not_fall_back_to_mcp(self):
        self.login()

        self.assert_error(self.run_helper("clock-in"), "API_KEY_REQUIRED")
        self.assertNotIn("clockIn", [n for n, _ in self.fake.tool_calls])
        self.assertEqual(self.fake.shifts, [])

    def test_failed_rest_clock_in_does_not_fall_back_to_mcp(self):
        self.login()
        self.store_api_key()
        for status, error, expected in (
            (400, "API_TERMINAL_NOT_AVAILABLE", "API_TERMINAL_MISSING"),
            (403, None, "API_SCOPE_MISSING"),
            (429, "QUOTA_EXCEEDED", "RATE_LIMITED"),
        ):
            with self.subTest(expected):
                self.fake.rest_failure = (status, error)
                self.assert_error(self.run_helper("clock-in"), expected)
        self.assertNotIn("clockIn", [n for n, _ in self.fake.tool_calls])
        self.assertEqual(self.fake.shifts, [])

    # Pause (docs/adr/0003)

    def break_calls(self, which):
        return [req for path, req in self.fake.rest_calls if path == "/clockin/terminal/v1/break-" + which]

    def test_break_start_begins_a_break_of_the_default_type_inside_the_shift(self):
        self.login()
        self.store_api_key()
        self.fake.now = "2026-09-22T12:00:30"
        self.fake.shifts = [("2026-09-22", "09:40:30", None)]

        code, out = self.run_helper("break-start")

        self.assertEqual((code, out), (0, {"ok": True, "onBreak": True}))
        (req,) = self.break_calls("start")
        self.assertEqual(req, {"person": "erika@example.com", "time": "2026-09-22T12:00:30", "breakType": 3})
        # The shift goes on; no clock-out.
        self.assertEqual(self.fake.shifts, [("2026-09-22", "09:40:30", None)])
        self.assertEqual(self.fake.breaks, [("2026-09-22", "12:00:30", None)])
        self.assertNotIn("clockOut", [n for n, _ in self.fake.tool_calls])

    def test_break_stop_ends_the_break_and_the_shift_goes_on(self):
        self.login()
        self.store_api_key()
        self.fake.now = "2026-09-22T12:30:10"
        self.fake.shifts = [("2026-09-22", "09:40:30", None)]
        self.fake.breaks = [("2026-09-22", "12:00:30", None)]

        code, out = self.run_helper("break-stop")

        self.assertEqual((code, out), (0, {"ok": True, "onBreak": False}))
        self.assertEqual(self.break_calls("stop")[0]["breakType"], 3)
        self.assertEqual(self.fake.breaks, [("2026-09-22", "12:00:30", "12:30:10")])
        self.assertEqual(self.fake.shifts, [("2026-09-22", "09:40:30", None)])

    def test_break_resolves_the_named_break_type(self):
        self.login()
        self.store_api_key()
        self.fake.shifts = [("2026-09-22", "09:40:30", None)]

        code, out = self.run_helper("break-start", "--break-type", "Mittagspause")

        self.assertEqual(code, 0, out)
        self.assertEqual(self.break_calls("start")[0]["breakType"], 1)

    def test_break_with_an_unknown_type_stamps_nothing(self):
        self.login()
        self.store_api_key()
        self.fake.shifts = [("2026-09-22", "09:40:30", None)]

        code, out = self.run_helper("break-start", "--break-type", "Siesta")

        self.assert_error((code, out), "BREAK_TYPE_UNKNOWN")
        self.assertIn("Siesta", out["error"]["message"])
        self.assertEqual(out["error"]["breakType"], "Siesta")
        self.assertEqual((self.break_calls("start"), self.fake.breaks), ([], []))

    def test_a_failed_break_is_not_retried_another_way(self):
        self.login()
        self.store_api_key()
        self.fake.shifts = [("2026-09-22", "09:40:30", None)]
        self.fake.rest_failure = (400, "API_TERMINAL_NOT_AVAILABLE")

        for command in ("break-start", "break-stop"):
            with self.subTest(command):
                self.assert_error(self.run_helper(command), "API_TERMINAL_MISSING")
        self.assertEqual(self.fake.breaks, [])
        self.assertEqual([n for n, _ in self.fake.tool_calls if n != "getMyProfile"], [])

    def test_a_break_without_running_shift_is_calamaris_error(self):
        self.login()
        self.store_api_key()

        code, out = self.run_helper("break-start")

        self.assert_error((code, out), "API_ERROR")
        self.assertIn("NO_STARTED_SHIFT", out["error"]["message"])

    # Feierabend aus der Pause (ticket 05)

    def clock_outs(self):
        return [req for path, req in self.fake.rest_calls if path == "/clockin/terminal/v1/clock-out"]

    def test_clock_out_break_ends_the_shift_at_the_exact_start_of_its_break(self):
        self.login()
        self.store_api_key()
        self.fake.now = "2026-09-22T17:35:35"
        self.fake.shifts = [("2026-09-22", "09:40:30", None)]
        self.fake.breaks = [("2026-09-22", "12:00:00", "12:30:00"), ("2026-09-22", "17:32:17", None)]

        code, out = self.run_helper("clock-out-break")

        self.assertEqual(
            (code, out), (0, {"ok": True, "running": False, "stamped": True, "endedAt": "17:32", "atBreakStart": True})
        )
        (req,) = self.clock_outs()
        self.assertEqual(req, {"person": "erika@example.com", "time": "2026-09-22T17:32:17"})
        self.assertEqual(self.fake.shifts, [("2026-09-22", "09:40:30", "17:32:17")])
        self.assertNotIn("clockOut", [n for n, _ in self.fake.tool_calls])

    def test_clock_out_break_without_a_known_break_start_ends_now(self):
        self.login()
        self.store_api_key()
        self.fake.now = "2026-09-22T17:35:35"
        self.fake.shifts = [("2026-09-22", "09:40:30", None)]
        self.fake.breaks = [("2026-09-22", "17:32:17", None)]
        self.fake.find_failure = (403, None)

        code, out = self.run_helper("clock-out-break")

        self.assertEqual(
            (code, out), (0, {"ok": True, "running": False, "stamped": True, "endedAt": "17:35", "atBreakStart": False})
        )
        self.assertEqual(self.clock_outs()[0]["time"], "2026-09-22T17:35:35")
        self.assertIn("API_SCOPE_MISSING", self.log_text())

    def test_clock_out_break_without_running_shift_stamps_nothing(self):
        self.login()
        self.store_api_key()
        self.fake.shifts = [("2026-09-22", "08:00:00", "12:00:00")]

        code, out = self.run_helper("clock-out-break")

        self.assertEqual(
            (code, out), (0, {"ok": True, "running": False, "stamped": False, "endedAt": None, "atBreakStart": False})
        )
        self.assertEqual(self.clock_outs(), [])

    def test_failed_clock_out_break_is_not_retried_another_way(self):
        self.login()
        self.store_api_key()
        self.fake.shifts = [("2026-09-22", "09:40:30", None)]
        self.fake.breaks = [("2026-09-22", "17:32:17", None)]
        self.fake.rest_failure = (400, "API_TERMINAL_NOT_AVAILABLE")

        self.assert_error(self.run_helper("clock-out-break"), "API_TERMINAL_MISSING")
        self.assertEqual(self.fake.shifts, [("2026-09-22", "09:40:30", None)])
        self.assertNotIn("clockOut", [n for n, _ in self.fake.tool_calls])

    def test_clock_out_ends_the_running_shift(self):
        self.login()
        self.fake.now = "2026-09-22T17:30:30"
        self.fake.shifts = [("2026-09-22", "09:40:30", None)]

        code, out = self.run_helper("clock-out")

        self.assertEqual((code, out), (0, {"ok": True, "running": False, "stamped": True}))
        self.assertEqual(self.fake.shifts, [("2026-09-22", "09:40:30", "17:30:30")])

    def test_clock_out_without_running_shift_does_not_stamp(self):
        # A clockOut without a running shift still leaves a seconds-long
        # entry in the real Calamari (seen 2026-09-22), so it is not sent.
        self.login()
        self.fake.shifts = [("2026-09-22", "08:00:00", "12:00:00")]

        code, out = self.run_helper("clock-out")

        self.assertEqual((code, out), (0, {"ok": True, "running": False, "stamped": False}))
        self.assertNotIn("clockOut", [n for n, _ in self.fake.tool_calls])

    def test_clock_out_does_not_stamp_a_shift_that_ended_a_minute_ago(self):
        # The status window still sees it; the current minute does not.
        self.login()
        self.fake.now = "2026-09-22T14:00:30"
        self.fake.shifts = [("2026-09-22", "08:00:00", "13:59:10")]

        code, out = self.run_helper("clock-out")

        self.assertEqual((code, out["stamped"]), (0, False))
        self.assertNotIn("clockOut", [n for n, _ in self.fake.tool_calls])

    # Prüfbefehl für das Overlap-Verhalten

    def test_check_overlap_confirms_that_a_running_shift_reaches_now(self):
        self.login()
        self.store_api_key()
        self.fake.now = "2026-09-22T14:00:30"
        self.fake.shifts = [("2026-09-22", "09:40:30", None)]

        code, out = self.run_helper("check-overlap")

        self.assertEqual((code, out), (0, {"ok": True, "shift": "running", "overlapsNow": True, "unchanged": True}))

    def test_check_overlap_notices_when_calamari_changed_the_behaviour(self):
        self.login()
        self.store_api_key()
        self.fake.shifts = [("2026-09-22", "09:40:30", None)]
        self.fake.running_reaches_now = False

        self.assert_error(self.run_helper("check-overlap"), "OVERLAP_CHANGED")
        self.assertIn("check-overlap failed: OVERLAP_CHANGED", self.log_text())

    def test_check_overlap_without_running_shift_cannot_tell(self):
        self.login()
        self.store_api_key()
        self.fake.shifts = [("2026-09-22", "08:00:00", "12:00:00")]

        code, out = self.run_helper("check-overlap")

        self.assertEqual((code, out), (0, {"ok": True, "shift": "stopped", "overlapsNow": False, "unchanged": None}))

    def test_check_overlap_only_reads(self):
        self.login()
        self.store_api_key()
        self.fake.shifts = [("2026-09-22", "09:40:30", None)]

        self.run_helper("check-overlap")

        # getMyProfile names the own person for REST.
        self.assertEqual([n for n, _ in self.fake.tool_calls if n != "getMyProfile"], ["checkTimesheetOverlap"])
        self.assertEqual([p for p, _ in self.fake.rest_calls], ["/clockin/shift/status/v1/get-current"])
        self.assertEqual(self.fake.shifts, [("2026-09-22", "09:40:30", None)])

    def test_stamping_when_rate_limited_is_reported_and_nothing_is_stamped(self):
        self.login()
        self.fake.mcp_status = 429

        # REST clock-in: test_failed_rest_clock_in_does_not_fall_back_to_mcp.
        self.assert_error(self.run_helper("clock-out"), "RATE_LIMITED")
        self.assertEqual(self.fake.shifts, [])

    def test_stamping_without_network_is_a_network_error(self):
        self.login()
        self.store_api_key()
        self.assert_error(self.run_helper("clock-out", base_url="http://127.0.0.1:9"), "NETWORK")
        self.assert_error(self.run_helper("clock-in", api_url="http://127.0.0.1:9/api"), "NETWORK")

    def test_stamping_without_login_needs_auth(self):
        self.store_api_key()
        for command in ("clock-in", "clock-out"):
            with self.subTest(command):
                self.assert_error(self.run_helper(command), "AUTH_REQUIRED")

    # Tagesinformation

    def test_day_info_takes_working_day_and_core_time_from_the_work_plan(self):
        self.login()

        code, out = self.run_helper("day-info", "--date", "2026-09-25")  # a Friday

        self.assertEqual(
            (code, out),
            (
                0,
                {
                    "ok": True,
                    "date": "2026-09-25",
                    "workingDay": True,
                    "coreStart": "09:00",
                    "coreEnd": "16:30",
                    "holiday": None,
                    "absence": None,
                },
            ),
        )

    def test_day_info_knows_the_weekend_is_no_working_day(self):
        self.login()

        code, out = self.run_helper("day-info", "--date", "2026-09-26")  # a Saturday

        self.assertEqual(
            (code, out),
            (
                0,
                {
                    "ok": True,
                    "date": "2026-09-26",
                    "workingDay": False,
                    "coreStart": None,
                    "coreEnd": None,
                    "holiday": None,
                    "absence": None,
                },
            ),
        )

    def test_day_info_names_a_public_holiday(self):
        self.login()

        code, out = self.run_helper("day-info", "--date", "2026-10-03")

        self.assertEqual(
            (code, out["holiday"]), (0, {"name": "Tag der Deutschen Einheit", "halfDay": False, "halfdayPeriod": None})
        )

    def test_day_info_names_a_half_holiday_with_its_period(self):
        self.login()

        code, out = self.run_helper("day-info", "--date", "2026-12-24")

        self.assertEqual(
            (code, out["holiday"]), (0, {"name": "Heiligabend (PM)", "halfDay": True, "halfdayPeriod": "PM"})
        )
        self.assertEqual(out["coreEnd"], "16:45")  # shortening the core time is decide's job

    def test_day_info_names_the_own_absence_on_its_last_day(self):
        self.login()

        code, out = self.run_helper("day-info", "--date", "2026-10-16")

        self.assertEqual((code, out["absence"]), (0, {"category": "TIMEOFF", "fullDay": True}))

    def test_day_info_ignores_absences_of_colleagues(self):
        self.login()

        code, out = self.run_helper("day-info", "--date", "2026-10-19")

        self.assertEqual((code, out["absence"]), (0, None))

    def test_day_info_prefers_time_off_over_a_working_absence(self):
        self.login()
        self.fake.absences.append(
            (
                self.fake.profile["personUuid"],
                {
                    "userId": 1,
                    "name": "Erika Mustermann",
                    "category": "TIMEOFF",
                    "fullDayRequest": True,
                    "start": "2026-11-02T00:00",
                    "end": "2026-11-02T00:00",
                },
            )
        )

        code, out = self.run_helper("day-info", "--date", "2026-11-02")

        self.assertEqual((code, out["absence"]), (0, {"category": "TIMEOFF", "fullDay": True}))

    def test_day_info_prefers_time_off_for_the_whole_day_over_hourly_time_off(self):
        self.login()
        me = self.fake.profile["personUuid"]
        self.fake.absences[:0] = [
            (
                me,
                {
                    "userId": 1,
                    "name": "Erika Mustermann",
                    "category": "TIMEOFF",
                    "fullDayRequest": False,
                    "start": "2026-11-02T08:00",
                    "end": "2026-11-02T10:00",
                },
            )
        ]
        self.fake.absences.append(
            (
                me,
                {
                    "userId": 1,
                    "name": "Erika Mustermann",
                    "category": "TIMEOFF",
                    "fullDayRequest": True,
                    "start": "2026-11-02T00:00",
                    "end": "2026-11-02T00:00",
                },
            )
        )

        code, out = self.run_helper("day-info", "--date", "2026-11-02")

        self.assertEqual((code, out["absence"]), (0, {"category": "TIMEOFF", "fullDay": True}))

    def test_day_info_prefers_a_whole_holiday_over_a_half_one(self):
        self.login()
        self.fake.holidays.insert(
            0,
            {"name": "Halber Tag", "start": "2026-10-03", "end": "2026-10-03", "halfDay": True, "halfdayPeriod": "PM"},
        )

        code, out = self.run_helper("day-info", "--date", "2026-10-03")

        self.assertEqual(
            (code, out["holiday"]["name"], out["holiday"]["halfDay"]), (0, "Tag der Deutschen Einheit", False)
        )

    def test_day_info_defaults_to_today(self):
        self.login()

        code, out = self.run_helper("day-info")

        self.assertEqual((code, out["date"], out["coreEnd"]), (0, "2026-09-22", "16:45"))

    def test_day_info_rejects_a_malformed_date(self):
        self.assert_error(self.run_helper("day-info", "--date", "22.09.2026"), "USAGE")

    # Tool-Liste

    def test_tools_lists_the_mcp_tools_sorted_by_name(self):
        self.login()

        code, out = self.run_helper("tools")

        self.assertEqual(code, 0)
        self.assertEqual(
            [t["name"] for t in out["tools"]], ["checkTimesheetOverlap", "clockIn", "clockOut", "getMyProfile"]
        )
        self.assertEqual(out["tools"][1]["description"], "fake clockIn")

    # REST API (docs/adr/0003)

    def store_api_key(self):
        code, out = self.run_helper("api-key", input=self.fake.api_key + "\n")
        self.assertEqual((code, out["ok"]), (0, True), out)

    def test_api_key_is_read_from_stdin_and_kept_in_the_keyring(self):
        self.store_api_key()

        self.assertIn(self.fake.api_key, self.keyring_text())

    def test_api_key_must_not_be_empty(self):
        self.assert_error(self.run_helper("api-key", input="\n"), "USAGE")

    def test_rest_without_api_url_asks_for_one(self):
        # The REST API lives under the company's own address; there is no default.
        self.login()
        self.store_api_key()

        for command in ("status", "clock-in", "lookup"):
            with self.subTest(command):
                self.assert_error(self.run_helper(command, api_url=""), "API_URL_REQUIRED")
        self.assertEqual(self.fake.rest_calls, [])

    def test_lookup_without_api_key_asks_for_one(self):
        self.login()

        self.assert_error(self.run_helper("lookup"), "API_KEY_REQUIRED")

    def test_lookup_lists_projects_and_break_types_of_the_own_person(self):
        self.login()
        self.store_api_key()

        code, out = self.run_helper("lookup")

        self.assertEqual(code, 0, out)
        self.assertEqual(out["person"], "erika@example.com")
        self.assertEqual(out["projects"], [{"id": 7, "name": "Check-in"}, {"id": 9, "name": "Kunde A"}])
        self.assertEqual(out["breakTypes"], [{"id": 1, "name": "Mittagspause"}, {"id": 3, "name": "Break"}])
        self.assertEqual(
            self.fake.rest_calls,
            [
                ("/clockin/projects/v1/get-projects-for-person", {"person": "erika@example.com"}),
                ("/clockin/terminal/v1/get-break-types-for-person", {"person": "erika@example.com"}),
            ],
        )

    def test_the_own_person_is_asked_from_the_profile_only_once(self):
        self.login()
        self.store_api_key()
        self.run_helper("lookup")
        self.fake.tool_calls.clear()

        code, out = self.run_helper("lookup")

        self.assertEqual((code, out["person"]), (0, "erika@example.com"), out)
        self.assertEqual(self.fake.tool_calls, [])

    def test_a_new_login_asks_for_the_own_person_again(self):
        self.login()
        self.store_api_key()
        self.run_helper("lookup")
        self.fake.profile = dict(self.fake.profile, email="max@example.com")
        self.login()

        code, out = self.run_helper("lookup")

        self.assertEqual((code, out["person"]), (0, "max@example.com"), out)

    def test_a_rejected_api_key_is_no_login_problem(self):
        self.login()
        self.run_helper("api-key", input="revoked-key\n")

        self.assert_error(self.run_helper("lookup"), "API_KEY_REJECTED")

    def test_a_key_without_the_scope_says_so(self):
        self.login()
        self.store_api_key()
        self.fake.rest_failure = (403, None)

        self.assert_error(self.run_helper("lookup"), "API_SCOPE_MISSING")

    def test_a_missing_api_terminal_says_so(self):
        self.login()
        self.store_api_key()
        self.fake.rest_failure = (400, "API_TERMINAL_NOT_AVAILABLE")

        self.assert_error(self.run_helper("lookup"), "API_TERMINAL_MISSING")

    def test_rest_rate_limit_is_reported(self):
        self.login()
        self.store_api_key()
        self.fake.rest_failure = (429, "QUOTA_EXCEEDED")

        self.assert_error(self.run_helper("lookup"), "RATE_LIMITED")

    def test_other_rest_errors_carry_calamaris_message(self):
        self.login()
        self.store_api_key()
        self.fake.rest_failure = (400, "INVALID_EMPLOYEE")

        code, out = self.run_helper("lookup")

        self.assert_error((code, out), "API_ERROR")
        self.assertIn("INVALID_EMPLOYEE", out["error"]["message"])

    def test_unreachable_rest_api_is_a_network_error(self):
        self.login()
        self.store_api_key()

        self.assert_error(self.run_helper("lookup", api_url="http://127.0.0.1:9/api"), "NETWORK")

    # Journal

    def test_every_failure_is_logged_with_command_and_code(self):
        code, out = self.run_helper("whoami")

        self.assertIn(
            "err [%s] whoami failed: AUTH_REQUIRED %s" % (MANIFEST_VERSION, out["error"]["message"]), self.log_text()
        )

    def test_every_journal_line_starts_with_the_version_from_the_manifest(self):
        self.login()
        self.store_api_key()
        self.fake.rest_failure = (400, "INVALID_TIME")

        self.run_helper("clock-in")

        lines = self.log_text().splitlines()
        self.assertTrue(lines)
        for line in lines:
            self.assertRegex(line, r"^(err|info) \[%s\] " % re.escape(MANIFEST_VERSION))

    def test_the_mcp_client_reports_the_version_from_the_manifest(self):
        self.login()

        self.run_helper("whoami")

        self.assertEqual(self.fake.client_infos[-1], {"name": "calamari-tracker", "version": MANIFEST_VERSION})

    def test_without_a_readable_manifest_the_version_is_unknown_and_that_is_logged(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        helper = Path(tmp.name) / "bin" / "calamari"
        helper.parent.mkdir()
        shutil.copy(HELPER, helper)
        (Path(tmp.name) / "manifest.json").write_text("{not json")

        self.assert_error(self.run_helper("whoami", helper=helper), "AUTH_REQUIRED")

        log = self.log_text()
        self.assertIn("err [unknown] cannot read the version from", log)
        self.assertIn("err [unknown] whoami failed: AUTH_REQUIRED", log)

    def test_a_rest_failure_logs_what_was_sent_but_never_the_key(self):
        self.login()
        self.store_api_key()
        self.fake.rest_failure = (400, "INVALID_TIME")

        self.run_helper("clock-in")

        log = self.log_text()
        self.assertIn("/clockin/projects/v1/get-projects-for-person", log)
        self.assertIn('"person": "erika@example.com"', log)
        self.assertIn("INVALID_TIME", log)
        self.assertNotIn(self.fake.api_key, log)

    def test_a_stamp_is_logged(self):
        self.login()
        self.store_api_key()

        self.run_helper("clock-in")

        self.assertRegex(self.log_text(), r'info \[[^]]+\] clock-in: .*"projectId": 7.*STARTED')

    def test_success_without_stamp_is_not_logged(self):
        self.login()

        self.run_helper("whoami")

        self.assertEqual(self.log_text(), "")

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
