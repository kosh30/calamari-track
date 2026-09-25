# Third-party licences

This repository contains copies of other people's work. Those copies stay under
their own copyright and licence; our own [LICENSE](LICENSE) does not cover them.
Both are MIT, so the only obligation is the one met here: reproduce the
copyright notice and the licence text. Neither is copyleft, so nothing about
our own code follows from carrying them.

Everything listed below lives under `lint/` and exists only so that
`qmllint -I lint *.qml` can resolve the imports. None of it is loaded at
runtime — on a machine with omarchy installed, the real modules shadow these
copies.

---

## ax1g/quickshell-screentime-plugin

- **Covers:** most of `lint/Quickshell/`, plus `lint/qs/Ui/KeyboardPanel.qml`,
  `lint/qs/Ui/qmldir` and `.qmllint.ini` — file by file below
- **Source:** <https://github.com/ax1g/quickshell-screentime-plugin>
- **Commit:** `2c7b75abde55b23ee6d6e1356797c8f50f60b8a1` (2026-09-17)
- **Licence:** MIT

Our whole lint scaffold started from this project's, so the debt is wider than
the Quickshell stubs alone.

Byte-identical copies, all under `lint/Quickshell/`: `Quickshell.qml`, `qmldir`,
`Io/qmldir`, `Io/Process.qml`, `Io/IpcHandler.qml`, `Io/JsonAdapter.qml`,
`Io/FileViewAdapter.qml`, `Io/FileViewError.qml`, `Io/SplitParser.qml`.

Derived — their file with our edits on top. Each carries an origin line in its
own header:

- `lint/Quickshell/Io/FileView.qml`, `lint/Quickshell/Io/StdioCollector.qml` —
  extended with the members our code uses.
- `lint/qs/Ui/KeyboardPanel.qml` — their stub of the shell's panel frame, with
  one comment clause reworded and `fittedContentHeight` reduced to one argument.
  It is not an omarchy file: the real frame is far richer, and this stand-in is
  their work.
- `.qmllint.ini` — their policy file, shortened. The `[General]` keys, the
  "Zero tolerance" comment and `MissingProperty=disable` are theirs; the
  Qt-version notes and the wider disable list are not carried over.

Same format, our content: `lint/qs/Ui/qmldir` and `lint/Quickshell/Wayland/qmldir`.
A `qmldir` is a mechanical list — `module <name>` plus one `Type 1.0 Type.qml`
line per stub — and ours list the types we stub, which are not theirs (their
`Ui/qmldir` declares `PanelSeparator` and `ToggleSwitch`, their `Wayland/qmldir`
a `ToplevelManager`; none of the three exists here). Named anyway, because the
files began as theirs and a notice is cheaper than the argument.

Ours, written in the same style but not from this project:
`lint/Quickshell/Wayland/IdleMonitor.qml`. Our `lint/README.md` was written with
theirs open — the title, the opening sentence and "verbatim snapshots" echo it —
but the text is ours and the structure is not.

```
MIT License

Copyright (c) 2026 agx

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## basecamp/omarchy

- **Covers:** all of `lint/qs/Commons/` and `lint/qs/Ui/`, except
  `Ui/KeyboardPanel.qml` and `Ui/qmldir`, which belong to the section above,
  plus `ActionButton.qml` at the root, which is not a snapshot but a
  derivative
- **Source:** <https://github.com/basecamp/omarchy>
- **Version:** snapshot of the installed omarchy-shell, `/usr/share/omarchy/version`
  reporting `4.0.0.alpha` (package `omarchy` 4.0.4-1)
- **Licence:** MIT

Verbatim snapshots of the shell this plugin runs inside, taken by
`lint/refresh.sh` from the locally installed omarchy — all seventeen files are
byte-identical to it, `Commons/qmldir` included.

`ActionButton.qml` is the exception: it is our own button, not a snapshot. It
had to leave `Ui/Button.qml` behind because that one has no `letterSpacing` to
set, but it keeps that file's state cascade and its trick of reserving the
widest border any state can paint, so it carries the notice in its own header
rather than being filed as ours.

The installed package ships no licence file, so the text below was taken from
the project's repository.

```
Copyright (c) David Heinemeier Hansson

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

---

## Audit

Checked 2026-09-25 for further copies of other people's work in the repository.
The result below is what makes the two sections above complete. It holds for the
repository as it stood on that date, which is why `tests/test_licenses.py` fails
as soon as a tracked top-level entry appears that is not classified here.

| Path | Origin |
| --- | --- |
| `bin/` | Ours. `bin/calamari` is written for this project; standard library only, nothing vendored. |
| `docs/` | Ours. The prose about other projects (`docs/research/`) quotes and describes, it does not copy code. |
| `js/` | Ours. No imports beyond Node's own modules, nothing vendored. |
| `lint/` | Mixed — the two sections above. `lint/refresh.sh` is ours; `lint/README.md` is our text, written with theirs open. |
| `tests/` | Ours. Fakes and test cases written for this project. |
| `.scratch/` | Ours. Tickets and specs for this project. |
| `.qmllint.ini` | Derived from ax1g — see the first section. |
| `.gitignore` | Ours. Six lines of build and cache patterns, nothing shared with either upstream. |
| `tools/`, `.github/` | Ours. The release and format scripts, the CI workflow and the rulesets, written for this project. |
| `.git-blame-ignore-revs`, `.prettierignore`, `.prettierrc.json`, `ruff.toml` | Ours. Formatter settings and the list of formatting commits. |
| `renovate.json` | Written by the Renovate bot as its onboarding config. It names Renovate's `config:recommended` preset and its schema by URL instead of copying either, so it carries no third-party code. |
| `Panel.qml`, `Service.qml`, `SettingsForm.qml`, `Widget.qml`, `manifest.json` | Ours. They call the shell's API, which is not the same as copying it. |
| `ActionButton.qml` | Ours, but modelled on omarchy's `Ui/Button.qml` — see the second section. |
| `README.md`, `CLAUDE.md`, `CONTEXT.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`, `LICENSE`, `THIRD-PARTY-LICENSES.md` | Ours, except that `LICENSE` is the MIT text itself. |

How it was checked: every file under `lint/`, and every dotfile at the root, was
compared byte for byte (`cmp`) against **both** upstreams — the installed
omarchy-shell and the ax1g checkout — because they overlap: ax1g vendors the same
omarchy files we do, so a file identical to both is omarchy's, and a file that
differs from omarchy may still be ax1g's. Checking against one upstream alone is
what originally left `Ui/KeyboardPanel.qml`, `Ui/qmldir` and `.qmllint.ini`
misfiled as ours.

Grep is not enough on its own and was not relied on: an unattributed derivative
has no copyright header and no "adapted from" phrase by definition — that is what
makes it unattributed. It was run over the rest of the tree ("adapted from",
"derived from", "taken from", "SPDX") and found nothing, but the classification
above rests on the comparisons and on where each file came from in our own
history: the whole lint scaffold and `.qmllint.ini` arrived in one commit
(`ac10438`, 2026-09-22), twelve days after the ax1g files they follow.

Two things are worth keeping in mind:

- Reproducing a **design** is not copying code. "A bar in a row with a label on
  the left and a number on the right" is a concept nobody holds rights to, and
  implementing it in our own code triggers no obligation. The line is crossed
  when a foreign file is opened and its structure taken over line by line — then
  it is a derivative and belongs in a section above, plus a line in the file's
  own header naming where it came from.
- `lint/refresh.sh` overwrites the omarchy snapshots from whatever is installed.
  After an omarchy update, check whether the version recorded above still matches
  and whether upstream changed its licence.
