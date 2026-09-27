# Implementation plan: Calamari Tracker

Basis: [CONTEXT.md](../CONTEXT.md) (terminology) and [ADR 0001](adr/0001-calamari-mcp-instead-of-rest-api.md) (access through the MCP server).
The plan consists of vertical slices. Every slice ends with something you can try out. The order takes the risks down first.

## Architecture

```
┌──────────── omarchy-shell (Quickshell) ─────────────┐
│  Widget.qml + Panel.qml    ◄──►  Service.qml         │
│                                   │  Timer, IdleMonitor, state file
│                                   │  js/reminders.mjs  (pure logic)
│                                   │  js/daycalendar.mjs (pure logic)
│                                   ▼  Process (JSON on stdout)
│                             bin/calamari  (Python, stdlib only)
└───────────────────────────────────│─────────────────┘
                                    ▼ HTTPS, OAuth Bearer
               gateway.eu-west-1.calamari.io/mcp-server/mcp
```

- **`bin/calamari`** is the only place that talks to Calamari. It takes care of OAuth, the MCP protocol (streamable HTTP, JSON-RPC) and the translation of the tools into simple commands. The output is always JSON, `{"ok":false,"error":{"code":…}}` on errors.
- **`Service.qml`** holds the runtime state, calls the helper, measures the activity and sends the notifications. It makes no decisions itself but asks the JS logic for them.
- **`js/*.mjs`** contains pure functions without Qt, tested with `node --test`. The core piece is `decide(now, day, state, config) → { barState, actions[] }`.
- **Local state** lives in `$XDG_STATE_HOME/calamari-tracker/state.json` (atomic write): running break, end of day, „Heute frei“, reminders sent, last activity, known start time, shifts by „+1 h“.
- **Secrets** live in the keyring through `secret-tool` (`service kosh.calamari-tracker`, `key client` / `key tokens`).

## Slice 0: Scaffold

- `git init`, `.gitignore`, `manifest.json` (ID `kosh.calamari-tracker`, kinds `service` + `bar-widget`, `keepLoaded`).
- Symlink `~/.config/omarchy/plugins/kosh.calamari-tracker → ~/Work/calamari_tracker`, then rescan + enable.
- Empty `Service.qml` and `Widget.qml` with a static icon in the bar.
- qmllint import context in `lint/`: literal snapshots of omarchy-shell (`lint/refresh.sh`) plus Quickshell stubs from the screen-time plugin.
- Test commands: `node --test js/` and `python3 -m unittest`.

**Done when** the icon appears in the bar and a change to it is visible after `omarchy-restart-shell` (nothing reloads on save, see `CLAUDE.md`).

## Slice 1: OAuth login (the biggest risk)

- `bin/calamari login`:
  - Discovery: `/.well-known/oauth-protected-resource/mcp-server/mcp` → authorization server metadata.
  - Dynamic client registration with redirect `http://127.0.0.1:<free port>/callback`. The client data goes into the keyring.
  - Authorization code + PKCE S256, `resource` parameter = the MCP URL. The browser opens through `xdg-open`, a local HTTP server receives the code.
  - Token exchange, tokens into the keyring.
- Automatic refresh on `401` or an expired token. If it fails, the error code is `AUTH_REQUIRED`.
- `bin/calamari whoami` → `getMyProfile` as a smoke test. That needs the MCP session: `initialize` → `Mcp-Session-Id` → `notifications/initialized` → `tools/call`.
- Unit tests for PKCE, token expiry and MCP answers (JSON and SSE frames), with a fake HTTP server.

**Done when** `bin/calamari login` runs through in the browser over Microsoft SSO and `bin/calamari whoami` shows your name, after a token refresh too.
**Fallback if DCR is blocked for own clients:** decide anew. We have no way to carry on without asking you.

## Slice 2: Status and stamping in the helper

- `status` → `checkTimesheetOverlap(today, now−2min … now, skipNotEligibleDays=false)` → `{"running": bool}`.
- `start-time` → bisection over the day, accurate to the minute (about 10 calls) → `{"startedAt": "HH:MM"}`. With `--after HH:MM`, shifts following a break can be found.
- `worked-today` → the sum of today's shifts. The gap and shift search is reused for that; otherwise it is dropped and the panel only shows the shift duration. *Open: the effort is measured in this slice.*
- `clock-in`, `clock-out` → `clockIn`/`clockOut`, then `status` again straight away.
- `day-info --date YYYY-MM-DD` → `getWorkPlan` + `getPublicHolidays` + `search(peopleUuids=[me])`, collected into `{workingDay, coreStart, coreEnd, holiday, halfDay, absence}`. The work schedule is cached once a day.
- The behaviour of the overlap check is documented, and a manual check command detects when Calamari changes it.

**Done when** `status`, `start-time` and `day-info` deliver the real state and `clock-out` / `clock-in` flip the status in a test. That is to be tested manually with you once, because it creates real stampings.

## Slice 3: Status in the bar

- `Service.qml`: the query runs every 3 min (configurable), immediately when the panel opens and after every action of our own.
- The bar shows icon + shift duration (`󰔟 3:42`). The duration goes on ticking locally from the known start time.
- Colours: grey (no shift), green (shift running), yellow (break), red (stamp reminder active), warning symbol (error or login needed).

**Done when** a clock-in in the web appears in the bar after one query at the latest.

## Slice 4: Panel with actions

- The panel after the pattern of notification-center (`Panel` + `KeyboardPanel`).
- Contents:
  - status, shift duration, total time today (if feasible in slice 2)
  - clock in / clock out (clocking out = end of day)
  - begin / end break, only during a running shift (originally clocking out + a marker, and clocking in again; since ADR 0003 a real break over REST `break-start`/`break-stop`)
  - „Heute frei“
  - an error line with „Neu anmelden“, which starts `bin/calamari login`
- The running break and the end of day are stored in the state and survive a restart of the shell.

**Done when** all buttons work and the break survives a shell restart.

## Slice 5: Reminder logic (TDD, pure functions)

- `js/daycalendar.mjs`: working day, core time (including a half public holiday), day off, local overrides from the config.
- `js/reminders.mjs`: `decide(now, day, state, config)` delivers the actions due: `stamp-reminder`, `break-reminder`, `soft-hint`, `final-warning`, `auto-close`. Along with the bar state and the moment of the next check.
- Test cases, at least:
  - core time without a shift: remind at once, then every 5 min, until the end of core time.
  - end of day at 15:30: no more reminders, not even up to 16:45.
  - break at 12:00: break reminder at 12:30, then every 5 min.
  - day off (public holiday, holiday, switch): no stamp reminder.
  - 24 December with a half public holiday: core time ends at 12:00.
  - soft hint exactly once, 30 min after the end of core time.
  - final warning at 19:00, auto-close 15 min later, „+1 h“ shifts both, upper limit 23:00.
  - weekend with a running shift: no stamp hint, but a final warning and an auto-close.
  - a shift from the previous day ran to the day's end: a correction hint, no stamping (ADR 0002).
- All times come from the config (for the values see the summary in CONTEXT/grilling).

**Done when** all tests are green and the module has no Qt dependency.

## Slice 6: Wiring up the notifications

- The service calls `decide` on the timer, on a status change and on resume, and carries out the actions.
- Sending through `omarchy-notification-send … -p` (a glyph of our own). With `-r <id>` the previous reminder of the same type is replaced instead of stacked.
- A click (`--exec omarchy-shell kosh.calamari-tracker openPanel`) opens the panel. There is an `IpcHandler` in the widget and the service for that.

**Done when** every kind of reminder has been visibly triggered once with shortened test times from the config.

## Slice 7: Final warning and auto-close

- After the final warning the panel shows a countdown and the buttons „+1 h weiterarbeiten“ / „Jetzt ausstempeln“.
- Auto-close: `clock-out`. Then the notification „Schicht um HH:MM automatisch beendet, letzte Aktivität HH:MM, bitte in Calamari korrigieren“. A click opens Calamari in the browser.

**Done when** the whole sequence has run through once with shortened times against real Calamari stampings (agreed with you).

## Slice 8: Last activity and the day-end close

- `IdleMonitor` (Quickshell.Wayland) with the lock timeout from the omarchy-shell idle config: when the idle starts, the time is stored as the last activity.
- A heartbeat writes `lastSeen` into the state every minute. If there is a gap of more than 5 min at the next tick, the device was suspended, and the last activity is the last heartbeat before the gap.
- Resume or shell start: if the state knows a running shift from an earlier day, `day-end` is asked whether it ran to the day's end. If so, Calamari ended it at 23:59 and there is a correction hint, no stamping (ADR 0002).
  - *To check in this slice:* does a shift running past midnight count for "today" in the overlap check? If not, the previous day is checked.

**Done when** the scenario "lid closed with a running shift, opened again later" brings the right hint with the right time.

## Slice 9: Config and finishing touches

- `barWidget.schema` in the manifest for all values:
  - query interval, interval of the stamp reminder, break limit
  - offset of the soft hint, time of the final warning, wait until the auto-close
  - duration of „+1 h“, upper limit
  - overrides for the work schedule and core time
- Error states: no network, `AUTH_REQUIRED`, `429`. The query then goes to a lower rate (backoff), and the bar shows the error.
- README (installation, `login`, the limits according to the ADRs), so that the plugin can be published. No secrets or company data in the repo.

**Done when** the plugin runs an ordinary working week without you having to step in.

## Later (deliberately out of scope)

- A week overview and a balance (waiting for timesheet tools in MCP)
- Real breaks with a type, backdated clocking out and a status tool, as soon as MCP offers them (ADR 0001 to be revised then)
- Projects and a description when clocking in
