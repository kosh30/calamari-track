# Lint imports

`qmllint` cannot see the shell this plugin runs inside, so this directory
provides the import context: `qmllint -I lint *.qml`.

- `qs/Commons/`, `qs/Ui/` (except `KeyboardPanel.qml` and `qmldir`) are
  **verbatim snapshots** of the locally installed omarchy-shell. Never
  hand-edit them; run `lint/refresh.sh` after an omarchy update.
- `qs/Ui/KeyboardPanel.qml` is a hand-written minimal stub covering only
  the members `Panel.qml` uses.
- `Quickshell/` holds hand-written minimal stubs for the Quickshell C++ API,
  taken from ax1g/quickshell-screentime-plugin (MIT). On a machine with
  omarchy installed the real Quickshell modules shadow them.

`.qmllint.ini` disables only `MissingProperty` (members of the shell's
`QtObject`-typed objects) and fails on any remaining warning.
