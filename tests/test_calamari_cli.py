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
                   CALAMARI_NOW=self.fake.now,
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
        self.fake.shifts = [("2026-09-22", "09:40:30", None)]

        code, out = self.run_helper("status")

        self.assertEqual((code, out), (0, {"ok": True, "running": True}))

    def test_status_without_shift_is_not_running(self):
        self.login()
        self.fake.shifts = [("2026-09-22", "08:00:00", "12:00:00")]

        code, out = self.run_helper("status")

        self.assertEqual((code, out), (0, {"ok": True, "running": False}))

    def test_status_still_sees_a_shift_ended_a_minute_ago(self):
        # Accepted lag of the overlap trick (docs/adr/0001): the window looks
        # back two minutes.
        self.login()
        self.fake.shifts = [("2026-09-22", "08:00:00", "13:59:00")]

        code, out = self.run_helper("status")

        self.assertEqual((code, out), (0, {"ok": True, "running": True}))

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
        self.fake.shifts = [("2026-09-22", "08:00:10", "12:00:00"),
                            ("2026-09-22", "12:45:20", None)]

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

    def test_clock_in_starts_a_shift_and_reports_it_running(self):
        self.login()
        # Stamped mid-minute: the new shift lies after the last full minute.
        self.fake.now = "2026-09-22T14:00:30"
        self.fake.shifts = [("2026-09-22", "08:00:00", "12:00:00")]

        code, out = self.run_helper("clock-in")

        self.assertEqual((code, out), (0, {"ok": True, "running": True}))
        self.assertIn(("2026-09-22", "14:00:30", None), self.fake.shifts)
        # The status came from Calamari, not from the helper's hope.
        self.assertIn("checkTimesheetOverlap", [n for n, _ in self.fake.tool_calls])

    def test_clock_in_that_calamari_accepted_counts_even_if_the_check_fails(self):
        self.login()
        self.fake.now = "2026-09-22T14:00:30"
        self.fake.overlap_error = True

        code, out = self.run_helper("clock-in")

        self.assertEqual((code, out), (0, {"ok": True, "running": True}))
        self.assertEqual(self.fake.shifts, [("2026-09-22", "14:00:30", None)])

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

    def test_clock_in_while_a_shift_runs_is_an_mcp_error(self):
        self.login()
        self.fake.shifts = [("2026-09-22", "09:40:30", None)]

        self.assert_error(self.run_helper("clock-in"), "MCP_ERROR")
        self.assertEqual(len(self.fake.shifts), 1)

    def test_stamping_when_rate_limited_is_reported_and_nothing_is_stamped(self):
        self.login()
        self.fake.mcp_status = 429

        for command in ("clock-in", "clock-out"):
            with self.subTest(command):
                self.assert_error(self.run_helper(command), "RATE_LIMITED")
        self.assertEqual(self.fake.shifts, [])

    def test_stamping_without_network_is_a_network_error(self):
        self.login()

        for command in ("clock-in", "clock-out"):
            with self.subTest(command):
                self.assert_error(self.run_helper(command, base_url="http://127.0.0.1:9"), "NETWORK")

    def test_stamping_without_login_needs_auth(self):
        for command in ("clock-in", "clock-out"):
            with self.subTest(command):
                self.assert_error(self.run_helper(command), "AUTH_REQUIRED")

    # Tagesinformation

    def test_day_info_takes_working_day_and_core_time_from_the_work_plan(self):
        self.login()

        code, out = self.run_helper("day-info", "--date", "2026-09-25")  # a Friday

        self.assertEqual((code, out), (0, {"ok": True, "date": "2026-09-25", "workingDay": True,
                                           "coreStart": "09:00", "coreEnd": "16:30",
                                           "holiday": None, "absence": None}))

    def test_day_info_knows_the_weekend_is_no_working_day(self):
        self.login()

        code, out = self.run_helper("day-info", "--date", "2026-09-26")  # a Saturday

        self.assertEqual((code, out), (0, {"ok": True, "date": "2026-09-26", "workingDay": False,
                                           "coreStart": None, "coreEnd": None,
                                           "holiday": None, "absence": None}))

    def test_day_info_names_a_public_holiday(self):
        self.login()

        code, out = self.run_helper("day-info", "--date", "2026-10-03")

        self.assertEqual((code, out["holiday"]), (0, {"name": "Tag der Deutschen Einheit",
                                                      "halfDay": False, "halfdayPeriod": None}))

    def test_day_info_names_a_half_holiday_with_its_period(self):
        self.login()

        code, out = self.run_helper("day-info", "--date", "2026-12-24")

        self.assertEqual((code, out["holiday"]), (0, {"name": "Heiligabend (PM)",
                                                      "halfDay": True, "halfdayPeriod": "PM"}))
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
        self.fake.absences.append((self.fake.profile["personUuid"], {
            "userId": 1, "name": "Erika Mustermann", "category": "TIMEOFF", "fullDayRequest": True,
            "start": "2026-11-02T00:00", "end": "2026-11-02T00:00"}))

        code, out = self.run_helper("day-info", "--date", "2026-11-02")

        self.assertEqual((code, out["absence"]), (0, {"category": "TIMEOFF", "fullDay": True}))

    def test_day_info_prefers_time_off_for_the_whole_day_over_hourly_time_off(self):
        self.login()
        me = self.fake.profile["personUuid"]
        self.fake.absences[:0] = [(me, {"userId": 1, "name": "Erika Mustermann", "category": "TIMEOFF",
                                        "fullDayRequest": False, "start": "2026-11-02T08:00", "end": "2026-11-02T10:00"})]
        self.fake.absences.append((me, {"userId": 1, "name": "Erika Mustermann", "category": "TIMEOFF",
                                        "fullDayRequest": True, "start": "2026-11-02T00:00", "end": "2026-11-02T00:00"}))

        code, out = self.run_helper("day-info", "--date", "2026-11-02")

        self.assertEqual((code, out["absence"]), (0, {"category": "TIMEOFF", "fullDay": True}))

    def test_day_info_prefers_a_whole_holiday_over_a_half_one(self):
        self.login()
        self.fake.holidays.insert(0, {"name": "Halber Tag", "start": "2026-10-03", "end": "2026-10-03",
                                      "halfDay": True, "halfdayPeriod": "PM"})

        code, out = self.run_helper("day-info", "--date", "2026-10-03")

        self.assertEqual((code, out["holiday"]["name"], out["holiday"]["halfDay"]), (0, "Tag der Deutschen Einheit", False))

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
        self.assertEqual([t["name"] for t in out["tools"]],
                         ["checkTimesheetOverlap", "clockIn", "clockOut", "getMyProfile"])
        self.assertEqual(out["tools"][1]["description"], "fake clockIn")

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
