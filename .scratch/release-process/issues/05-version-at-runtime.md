# 05: Does the plugin show its version, and where does it come from?

Type: grilling
Status: resolved
Blocked by: none

## Question

The model bumps the version in `manifest.json` and in `Panel.qml` (an About section). Should our panel or settings show the version? If yes: read from `manifest.json` at runtime, or a second copy kept in sync by the release step (and guarded by a test such as `tests/test_manifest.py`)? The answer fixes which files a release touches.

## Answer

Decided with the user (grilling, 2026-09-25): **`manifest.json` is the only source of the version**, and a release touches only `manifest.json` and `CHANGELOG.md`.

**Facts.**

- The Omarchy shell hands each plugin its `manifest`, including `version`, at runtime (`/usr/share/omarchy/shell/shell.qml:222`, `publicPluginManifest`). `Service.qml` already has the property `manifest`, and `SettingsForm.qml` already reads the schema from it.
- `bin/calamari:56` holds a second copy, `VERSION = "0.1.0"`, which it sends as MCP `clientInfo`. Nothing keeps it in sync today.
- The helper is not long-running. `Service.qml` starts `bin/calamari` once per call, including every poll.

**Decisions.**

- **UI:** the version shows small at the foot of the "Einstellungen" page, as "Calamari Tracker X.Y.Z", read from `root.service.manifest.version`. It does not appear in the panel header.
- **Helper:** `VERSION` is no longer hard-coded. The helper reads it at runtime from `manifest.json` next to `bin/`; the whole repo is always cloned, so both files ship together. If the file is missing or broken, the helper uses `"unknown"` and logs that, without crashing. `clientInfo` keeps using this value.
- **Journal:** every line the helper logs through `log()` (`bin/calamari:167`) starts with the version, e.g. `[0.1.0] …`. There is no start-up line, because the helper starts on every poll, and there is no state file. The tag `calamari-tracker` for `journalctl -t` stays unchanged.
- There is no `bin/calamari version` command.
- There is no second copy to bump, so no equality test is needed.

**Rejected.**

- Keeping the copy in `bin/calamari`, bumped by `tools/release` and guarded by `tests/test_manifest.py`: that is two sources for no gain.
- Showing the version in the panel header: it would take space in daily use.
