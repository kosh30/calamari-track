# Calamari Tracker

An Omarchy shell plugin (Quickshell) that stamps your own working time in
[Calamari](https://calamari.io) (module Clockin) from the bar and reminds you
when you forgot to clock in or out. The bar shows whether a shift runs and for
how long; the panel clocks in and out, starts and ends a break, and marks a
day as off. The user interface is in German.

It talks to Calamari in two ways, both hidden behind the helper `bin/calamari`:

- the official **MCP server** with your own login (OAuth, e.g. Microsoft SSO),
  see [ADR 0001](docs/adr/0001-calamari-mcp-statt-rest-api.md);
- the **REST API** with a company API key, for breaks, the project of a
  clock-in and the shift status, which the MCP server cannot do yet, see
  [ADR 0003](docs/adr/0003-rest-api-fuer-pause-projekt-status.md).

## Requirements

- Omarchy with omarchy-shell
- `python3` (standard library only), `secret-tool` (libsecret) with a running
  Secret Service keyring, `xdg-open`
- A Calamari account with Clockin, and an API key with the endpoint groups
  *Terminal*, *Shift status* and *Projects*, created by a Calamari admin
- An *API Terminal* in Clockin that you have access to; without it clocking in
  and breaks fail with "API Terminal fehlt"

## Installation

From git:

```sh
omarchy plugin add <git-url> --enable
```

Or from a local checkout, by symlink:

```sh
ln -s "$PWD" ~/.config/omarchy/plugins/kosh.calamari-tracker
omarchy plugin enable kosh.calamari-tracker --section right
```

The widget and the panel reload on save. The service (`Service.qml`) stays
loaded and needs `omarchy-restart-shell` after a change.

## Login

1. Log in to the MCP server. This opens the browser for your company's
   Calamari login and keeps the tokens in the keyring:

   ```sh
   bin/calamari login
   ```

   The panel offers the same as "Neu anmelden" whenever the login is gone.
2. Store the API key. It is read from stdin (a hidden prompt in a terminal),
   so it never lands in the shell history, `shell.json` or the settings:

   ```sh
   bin/calamari api-key
   ```
3. Set the address of your company's REST API in the settings (`apiUrl`,
   e.g. `https://<company>.calamari.io/api`). There is no default.
4. Check that everything works:

   ```sh
   bin/calamari whoami   # your name from the MCP login
   bin/calamari lookup   # the projects and break types you can pick
   bin/calamari status   # the shift status over REST
   ```

Every command prints one JSON object. Failures, the REST requests sent and
every stamp go to the journal: `journalctl -t calamari-tracker`.

## Settings

Right-click the bar icon and choose "Einstellungen", or set a value with
`omarchy bar set kosh.calamari-tracker <key> <value>`.

| Key | Default | Meaning |
| --- | --- | --- |
| `pollIntervalMinutes` | 3 | How often the status is asked. Network failures and rate limits in a row double it, up to 30 minutes; the next answer that comes through resets it. |
| `stampReminderMinutes` | 5 | Repeat of the reminder to clock in during core time |
| `breakLimitMinutes` | 30 | A break longer than this is reminded |
| `breakReminderMinutes` | 5 | Repeat of the break reminder |
| `softHintMinutes` | 30 | One hint this long after core time that a shift still runs |
| `finalWarningTime` | 19:00 | The last warning before the auto close |
| `autoCloseMinutes` | 15 | Minutes after the last warning until the plugin clocks out |
| `extendMinutes` | 60 | What "+1 h weiterarbeiten" postpones by |
| `hardLimitTime` | 23:00 | Latest time of the auto close |
| `webUrl` | empty | Your Calamari in the browser; a click on a correction hint opens it |
| `apiUrl` | empty | Your company's REST API, e.g. `https://<company>.calamari.io/api` |
| `defaultProject` | Check-in | Project of your own clock-ins, by name |
| `breakType` | Break | Break type of your own breaks, by name |
| `coreMonday` … `coreSunday` | empty | Core time `HH:MM-HH:MM`, `frei` for a day off, empty for the work plan from Calamari |

## Known limits

The MCP server offers less than the plugin needs (as of 2026-09); the
workarounds are deliberate, see the ADRs:

- **The API key acts for the whole company.** Calamari cannot limit it to one
  person. The helper only ever sends your own e-mail, but whoever holds the key
  can change everyone's times. Once the MCP server offers breaks, projects and
  the shift status, the key can go ([ADR 0003](docs/adr/0003-rest-api-fuer-pause-projekt-status.md)).
- **Start and end times of shifts stamped elsewhere** (web, phone) and the
  question whether yesterday's shift ran to midnight rely on undocumented
  behaviour of the MCP tool `checkTimesheetOverlap`: a running shift counts up
  to "now". It may break without notice ([ADR 0001](docs/adr/0001-calamari-mcp-statt-rest-api.md)).
  Check it by hand, with a shift running (not in a break) and the login,
  API key and `apiUrl` set up, since the REST status tells whether one runs:

  ```sh
  bin/calamari check-overlap
  ```

  `"unchanged": true` means the behaviour still holds; the error
  `OVERLAP_CHANGED` means Calamari changed it and those times are unreliable.
  Without a running shift, or in a break, the check cannot tell
  (`"unchanged": null`).
  Whether the MCP tools themselves changed shows:

  ```sh
  diff <(bin/calamari tools | python3 -m json.tool --sort-keys --no-ensure-ascii) docs/mcp-tools.json
  ```
- **The auto close stamps "now"**, not at your last activity: the MCP
  `clockOut` takes no time. The plugin names your last activity, and you
  correct the end time in the web.
- **No shift survives midnight.** The plugin assumes Calamari ends every open
  shift at 23:59, a rule of the company it was built for. The next morning it
  only reminds you to correct that end time
  ([ADR 0002](docs/adr/0002-kein-uebernacht-abschluss.md)).
- **"Heute gearbeitet" is observed**, not read from Calamari: shifts the plugin
  never saw (shell off) are missing.
- **Rate limit:** the REST API allows 720 requests per hour and 2880 per day
  (as of 2026-09). A failed stamp is shown and never retried or queued.

## Development

- Tests: `node --test js/` and `python3 -m unittest`
- Lint: `/usr/lib/qt6/bin/qmllint -I lint *.qml` (refresh the snapshots with
  `lint/refresh.sh`)
- Terms: [CONTEXT.md](CONTEXT.md), decisions: [docs/adr/](docs/adr/),
  order of the work: [docs/PLAN.md](docs/PLAN.md)

## License

MIT
