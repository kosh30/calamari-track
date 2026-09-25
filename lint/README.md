# Lint imports

`qmllint` cannot see the shell this plugin runs inside, so this directory
provides the import context: `qmllint -I lint *.qml`.

- `qs/Commons/`, `qs/Ui/` (except `KeyboardPanel.qml` and `qmldir`) are
  **verbatim snapshots** of the locally installed omarchy-shell (basecamp/omarchy,
  MIT). Never hand-edit them; run `lint/refresh.sh` after an omarchy update.
- `qs/Ui/KeyboardPanel.qml` is a hand-written minimal stub covering only
  the members `Panel.qml` uses.
- `Quickshell/` holds hand-written minimal stubs for the Quickshell C++ API,
  taken from ax1g/quickshell-screentime-plugin (MIT) at commit `2c7b75a`
  (`2c7b75abde55b23ee6d6e1356797c8f50f60b8a1`); `Quickshell/Wayland/`
  (`IdleMonitor`) is our own in the same style. On a machine with
  omarchy installed the real Quickshell modules shadow them.

The copied files keep their upstream copyright and licence. The notices, the
file-by-file split between verbatim, derived and our own, and the version each
snapshot was taken at are in
[THIRD-PARTY-LICENSES.md](../THIRD-PARTY-LICENSES.md) — update it whenever the
copies here change.

`.qmllint.ini` disables only `MissingProperty` (members of the shell's
`QtObject`-typed objects) and fails on any remaining warning.
