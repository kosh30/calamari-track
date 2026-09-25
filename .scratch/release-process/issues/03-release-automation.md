# 03: How much of a release is automated?

Type: grilling
Status: resolved
Blocked by: none

## Question

Which shape does cutting a release take?

- (a) a manual runbook like the model: a hand-written release commit, then `gh release create` with the changelog section as body;
- (b) a local script (e.g. `bin/release X.Y.Z`) that bumps the version, moves `[Unreleased]` to a dated section, commits, tags, pushes and creates the GitHub release;
- (c) a GitHub Action that publishes the release when a `vX.Y.Z` tag is pushed.

Leaning (b): one command, no secrets in CI. Decide also what the release commit touches (see ticket 05).

## Answer

Decided with the user (grilling, 2026-09-25): **(b) a local script**, plus a separate delivery branch, because Omarchy installs and updates follow the default branch, not tags.

**Key fact.** `omarchy plugin add` runs `git clone` on the default branch. `omarchy plugin update` fetches `origin HEAD` and fast-forwards to it (`/usr/share/omarchy/bin/omarchy-plugin-update`). Tags are ignored, so without a separate branch every push to the default branch reaches users.

**Delivery branch.** The GitHub default branch becomes `stable`. It moves only at a release, by fast-forward to the tagged commit. Development stays on `main`, including work-in-progress commits, and PRs target `main`. Recorded in `docs/adr/0004-auslieferungs-branch-stable.md`. The glossary terms **Release** and **Auslieferungs-Branch** are in `CONTEXT.md`.

**Script.**

- `tools/release`, written in Python (not in `bin/`, which holds the runtime helper `bin/calamari`). The changelog transform is unit-tested with `python3 -m unittest`.
- Usage: `tools/release X.Y.Z [--dry-run]`, with an explicit version that must be greater than the one in `manifest.json`. One exception: the same version is allowed if no tag `vX.Y.Z` exists yet. This covers the first release `v0.1.0`, which dates the changelog and tags without bumping.
- Preconditions, each aborting with a message:
  1. on `main`, clean worktree, `main` equal to `origin/main`;
  2. tag `vX.Y.Z` absent locally and on GitHub;
  3. `[Unreleased]` in `CHANGELOG.md` not empty;
  4. `node --test js/*.test.mjs`, `python3 -m unittest` and `qmllint -I lint *.qml` pass;
  5. `gh auth status` succeeds.

  "What does CI check?" adds `tools/format --check` to step 4, plus a non-fatal warning when the local `qmllint --version` differs from the Qt pin in `ci.yml`.

  Whether green GitHub CI is also required is decided in "Does a release wait for green CI, and which branches are protected?".
- Release commit:
  - message `Release vX.Y.Z`;
  - touches `manifest.json` (version) and `CHANGELOG.md` (`[Unreleased]` becomes `[X.Y.Z] - YYYY-MM-DD` and the compare links are updated);
  - nothing else: the ticket "Does the plugin show its version, and where does it come from?" made `manifest.json` the only copy of the version.
- Tag: annotated `vX.Y.Z`, not signed.
- GitHub release: title `vX.Y.Z`, body = that changelog section, marked latest, never a pre-release (also for 0.x).
- Order:
  1. all checks;
  2. local commit and tag (nothing is public before this point);
  3. push `main` and the tag;
  4. fast-forward `stable` to the tag and push it;
  5. `gh release create`.

  If a step after 2 fails, the script prints the remaining commands instead of rolling back.
- `--dry-run` prints the changelog section, the diff and the planned commands, and changes nothing.

**Hotfixes.** There is no hotfix path around `main`. A fix goes on `main`, unfinished work there is finished or reverted, then a normal release follows. `stable` only ever fast-forwards.

**One-time setup** (not in the script): create `stable` and make it the GitHub default branch (`gh repo edit --default-branch stable`) as part of shipping `v0.1.0`. The script aborts with a clear message if `stable` is missing.

**Rejected.**

- (a) A manual runbook: too many steps to forget for rare, solo releases.
- (c) A tag-triggered GitHub Action: version and changelog would still be prepared locally, and it adds CI secrets for no gain.
