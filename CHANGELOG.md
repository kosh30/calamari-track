# Changelog

All notable changes to this plugin are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- See the shape of the day in the panel: one line over the core time with today's shifts filled in, a mark for now, and the exact times on hover.

### Changed

- The panel's buttons show their rank: what the page is for keeps its frame, everything beside it steps back into small capitals, and a button that cannot be pressed right now looks the part.
- The settings show a thin bar at their right edge while fields stand below the window, so it is no longer a guess whether there is more to scroll to.

### Fixed

- On a light theme the version line under the settings was practically invisible. Everything the panel dims now keeps its contrast, whichever theme you run.

## [0.2.0] - 2026-09-25

### Added

- See how far the day's core time has run, as a thin bar in the panel with the time left (“noch 2:15 bis Ende der Kernzeit”). Days without a core time and days off leave it out.

### Changed

- The panel leads with the running shift's duration as its largest number and places it in a smaller line below, instead of a list of equally loud lines.

## [0.1.0] - 2026-09-25

### Added

- Clock in and out from the bar: the bar shows whether a shift runs and for how long, the panel stamps with one click.
- Reminders when core time runs and you have not clocked in, and a hint when a shift still runs after core time.
- Start and end breaks from the panel, with a reminder when a break runs longer than you set.
- Mark today as off with “Heute frei” in the panel; public holidays and absences from Calamari need no marking.
- A last warning in the evening, then an automatic clock-out; “+1 h weiterarbeiten” postpones both.
- See how long you worked today (“Heute gearbeitet”) in the panel.
- Log in with your company's Calamari login, e.g. Microsoft SSO; login and API key stay in the system keyring.
- Change the settings in the panel under “Einstellungen”, which also shows the plugin's version.

[Unreleased]: https://github.com/kosh30/calamari-track/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/kosh30/calamari-track/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/kosh30/calamari-track/releases/tag/v0.1.0
