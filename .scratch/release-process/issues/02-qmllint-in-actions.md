# 02: Can our lint and tests run in GitHub Actions?

Type: research
Status: resolved
Blocked by: none

## Question

Which of our checks can run on a GitHub-hosted Ubuntu runner, and how?

- `qmllint -I lint *.qml` with our `lint/` snapshots (`lint/refresh.sh`, `.qmllint.ini`, `MaxWarnings=0`): which Qt version do we lint with locally (`/usr/lib/qt6/bin/qmllint --version`), and does `jurplel/install-qt-action` with the same version give identical results? Do the `lint/` snapshots depend on files only present on an Omarchy machine?
- `node --test js/` (`.mjs` tests) and `python3 -m unittest`: which Node and Python versions do they need; do any tests need `secret-tool`, a keyring, `journalctl`/`logger`, or other Omarchy-only tools?
- Formatters the model uses (prettier `--no-semi`, ruff, qmlformat): how far is our code from each, i.e. would adopting them be a large reformat?

Compare with the model's `.github/workflows/ci.yml` (quickshell-screentime-plugin).

## Answer

All checks run on a GitHub-hosted Ubuntu runner. Findings: `.scratch/release-process/research/02-ci-feasibility.md` on branch `research/ci-feasibility` (commit `03183c1`, local, not pushed).

- **qmllint**: identical results with `jurplel/install-qt-action@v4`, `version: '6.11.2'` (local is 6.11.2); `qmllint -I lint *.qml` exits 0. `lint/` snapshots are all tracked, no Omarchy-only files (only the manual `lint/refresh.sh` reads `/usr/share/omarchy`). Ubuntu's apt Qt (6.4.2) is unusable. Risk: the pin must follow Arch's `qt6-declarative`.
- **Node tests**: `node --test js/` fails on Node 22/24 (the runner default is 22) because arguments are globs there; `node --test js/*.test.mjs` passes 176 tests on Node 20–26. The command in `CLAUDE.md` should change.
- **Python tests**: 95 tests pass on 3.9–3.14 with no setup, no keyring, D-Bus, journald or `xdg-open` (fakes via env vars).
- **Formatters** (diff if adopted): prettier `--no-semi` +1475/−372 (+423/−157 at width 120); ruff format +1302/−347 (+497/−193 at 120); qmlformat +222/−214 (+50/−42 with `--semicolon-rule essential`). ruff check: 61 findings under 0.16's default, 1 with the old `E4,E7,E9,F` set.
