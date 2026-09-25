# 05: Does the plugin show its version, and where does it come from?

Type: grilling
Status: open
Blocked by: none

## Question

The model bumps the version in `manifest.json` and in `Panel.qml` (an About section). Should our panel or settings show the version? If yes: read from `manifest.json` at runtime, or a second copy kept in sync by the release step (and guarded by a test such as `tests/test_manifest.py`)? The answer fixes which files a release touches.
