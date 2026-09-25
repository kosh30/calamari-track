# 06: What does CI check?

Type: grilling
Status: resolved
Blocked by: 02

## Question

Given what ticket 02 found runnable on GitHub Actions: which jobs does `.github/workflows/ci.yml` run (tests, `qmllint`, formatters), on which triggers (push to `main`, PRs, tags), and do we adopt formatters now or later?

## Answer

Decided with the user (grilling, 2026-09-25). This builds on the findings in "Can our lint and tests run in GitHub Actions?".

**Workflow** `.github/workflows/ci.yml`, four separate jobs on `ubuntu-latest`:

- `js`: `actions/setup-node` with Node 24, then `node --test js/*.test.mjs`. The command in `CLAUDE.md` changes to this form too, because `node --test js/` fails on Node 22 and 24.
- `python`: `actions/setup-python` with Python 3.14 (Arch's version, which is the helper's runtime for users), then `python3 -m unittest`.
- `qml`: `jurplel/install-qt-action@v4`, `version: '6.11.2'`, `archives: 'qtbase qtdeclarative icu'`, `cache: true`, then `qmllint -I lint *.qml`.
- `format`: `tools/format --check`.

There is one version each and no matrix: Omarchy runs only on Arch, so only its current versions matter.

**Triggers:** push to `main`, pull requests to `main`, and `workflow_dispatch`. CI does not run on `stable` or on tags, because they only ever get commits that were already checked on `main`.

**Formatters, adopted now (before `v0.1.0`):**

- JS: Prettier `--no-semi`. Python: `ruff format`, plus `ruff check` with `select = ["E4", "E7", "E9", "F"]` (the one current finding gets fixed). QML: `qmlformat --semicolon-rule essential`.
- Line width 120 for Prettier and Ruff.
- Config lives in `.prettierrc.json` and `ruff.toml` at the root. `lint/` (Omarchy snapshots), `.scratch/` and `docs/` are excluded.
- Tool versions are pinned in exactly one place, a script `tools/format`. It calls `npx prettier@X`, `uvx ruff@Y` and `qmlformat`. With no argument it formats, and with `--check` it only checks. Start from the model's pins (Prettier 3.9.6, Ruff 0.16.6) and raise them to the then-current versions during implementation.
- Rollout: one commit per formatter that changes nothing else. Their hashes go into `.git-blame-ignore-revs`, which GitHub honours in its blame view; locally, `git config blame.ignoreRevsFile .git-blame-ignore-revs`.

**Additions to `tools/release`** (see "How much of a release is automated?"):

- Its local checks also run `tools/format --check`.
- It compares the local `qmllint --version` with the Qt version pinned in `ci.yml` and warns on a mismatch without aborting, so the pin follows Arch's `qt6-declarative`.
