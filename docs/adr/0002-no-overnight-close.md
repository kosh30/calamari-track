# No overnight close: Calamari ends open shifts at 23:59

Calamari itself ends every shift still open at 23:59. That is a company rule, not a setting of the plugin. No shift therefore survives midnight, and the plugin stamps nothing out in the morning.

If a shift from an earlier day is still running in the stored state, the plugin only asks `day-end --date <day>`: a single read-only overlap call on the window 23:58–23:59. If the shift reached that far, Calamari ended it and the entry's end time is wrong — the user gets a correction hint with their last activity. If it ended earlier, they clocked out themselves and nothing happens.

Before, the plugin assumed a shift could still be running in the morning, and wanted to end it with `clock-out --overnight`. That was wrong and harmful: the previous day's check on 23:57–23:59 would have taken the entry Calamari ended at 23:59 for a running shift and sent `clockOut` into the void. A `clockOut` without a running shift leaves an entry of a few seconds in Calamari (observed 2026-09-22, see ADR 0001).

## Verification

Whether `checkTimesheetOverlap` counts a shift running past midnight for "today" remains unverified, and is not verifiable under this rule either: there can be no such shift. A search over the last 120 days (2026-05-27 to 2026-09-23, 8 calls) found not a single entry touching 23:55–23:59 or 00:00–00:05. A control measurement on midday windows of the same days did hit, one on 03:00 did not — the search works, the result is real.

Incidental finding: `checkTimesheetOverlap` takes many entries in one call (31 days per call tested). That does not help for a day's total time, because the answer is only a list of dates: several windows of the same day cannot be told apart.

## Consequences

- `status` and `clock-out` no longer have `--overnight`. New is `day-end --date YYYY-MM-DD` → `{"ranToMidnight": bool}`, read-only, one call.
- The local state knows `unclosed` (the date of a day the plugin left with a running shift) instead of `overnight`.
- In the morning there is at most a notification, never a stamping. The stamp action `overnight-close` is gone.
- A day change in the state resets the status to "unknown" instead of carrying over yesterday's running shift. The reminder logic stays silent until the first query of the new day has answered.
- For a company without this rule: if a shift really does run past midnight and Calamari counts it for "today", the plugin treats it as a shift of today; the start-time search finds 00:00. If Calamari does not count it for today, the plugin does not see it at all. Both are unverified, see above.
