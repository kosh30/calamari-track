# 07: What are the changelog rules, and where do they and the release instructions live?

Type: grilling
Status: resolved
Blocked by: none

## Question

`CHANGELOG.md` is hand-written in Keep a Changelog format, and `tools/release` only dates `[Unreleased]` (see "How much of a release is automated?"). Decide:

- What earns an entry: user-visible changes only? `Fixed` only for bugs that shipped in a release? What about internal refactors, tests and docs?
- Tone and granularity: one line per change, written for someone who installs the plugin. Should entries link tickets or commits?
- Who writes the entry, and when: in the same commit as the change (so agents do it too), or collected at release time?
- Where these rules, the commit message rule from "Do we switch to Conventional Commits?" and the short release instructions (`tools/release X.Y.Z`, the one-time `stable` setup) live: an `AGENTS.md` like the model, `CLAUDE.md`, or a `docs/releasing.md`.
- What the initial `[0.1.0]` section says, given that everything so far is unreleased.

## Answer

Decided with the user (grilling, 2026-09-25).

**What earns an entry.** We adopt the model's rules (the "Changelog" section of its `AGENTS.md`), nearly verbatim:

- The changelog speaks to users of the last release, not to the working tree. If no released user saw the old behaviour, there is nothing to announce: fold the tweak into the feature's own entry.
- `Fixed` is only for bugs in shipped behaviour. A fix to a feature that is still unreleased gets no entry.
- Internal work never appears: refactors, tests, tooling, formatting, file moves.
- `Added` leads with the user's gain, not the mechanism: one entry per feature, two lines at most.
- No internals in entries: no file names, setting keys or function names. The exception is `bin/calamari` commands that users type themselves (e.g. `bin/calamari api-key`).

**Language of UI names.** Entries are English. German UI labels are quoted verbatim as they appear on screen, e.g. "Mark today as off with “Heute frei” in the panel".

**Who writes an entry, and when.** In the same commit as the change, under `[Unreleased]`, agents included. The rule above decides whether an entry is needed at all.

**Links.** Entries do not link tickets or commits. `tools/release` maintains the compare links at the bottom.

**Where the rules live.** A new English `CONTRIBUTING.md`, for humans and agents; GitHub shows it on new issues and PRs. It holds:

- contribution rules: PRs target `main`, not the default branch `stable`; the commit message rule from "Do we switch to Conventional Commits?"; the changelog rules above; the check commands (`node --test js/*.test.mjs`, `python3 -m unittest`, `qmllint -I lint *.qml`, `tools/format`);
- a "Releasing" section: `tools/release X.Y.Z [--dry-run]` and the one-time `stable` setup.

`CLAUDE.md` stays German and short, and gets a one-line pointer to `CONTRIBUTING.md`. There is no `AGENTS.md` and no `docs/releasing.md`.

**Initial `[0.1.0]`.** `Added` only, about 5–7 feature-level entries, for example:

- clocking in and out from the bar;
- reminders for a forgotten clock-in or clock-out;
- breaks;
- days off;
- the final warning with auto close;
- today's total;
- SSO login.

It includes no development history. The exact wording is written during implementation.
