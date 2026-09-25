# 08: Does a release wait for green CI, and which branches are protected?

Type: grilling
Status: resolved
Blocked by: none

## Question

CI runs on push and PRs to `main` (see "What does CI check?"), and `tools/release` already runs the same checks locally (see "How much of a release is automated?"). Decide:

- Does `tools/release` also require the GitHub CI run for the commit it releases to be green (e.g. via `gh run list --commit <sha>`)? If yes: does it wait for a running workflow, or abort?
- Branch protection on `stable`: forbid force pushes and deletion? Should only the fast-forward from `tools/release` move it, and can GitHub express that for a solo admin?
- Branch protection on `main`: allow direct pushes by the owner (today's workflow), and require the four CI checks only for PRs from others?
- Should rulesets be written down (and applied with `gh api`) as part of the one-time `stable` setup, or set by hand in the GitHub UI?

## Answer

Decided with the user (grilling, 2026-09-25). This builds on "What does CI check?" and "How much of a release is automated?".

**Green CI before a release.** `tools/release` adds one precondition after its local checks: the `ci.yml` run for the commit it releases from (the `origin/main` HEAD, which is also the local `main`) must have concluded `success`. It looks the run up with `gh run list --workflow ci.yml --commit <sha>`.

- If the run is still in progress, the script waits with `gh run watch --exit-status`.
- If the run failed, or there is no run for that SHA, the script aborts with a message.
- `--dry-run` only reports the run's status and does not wait.

The release commit touches only `manifest.json` and `CHANGELOG.md`, so the parent's CI run is the one that counts. The CI run that the pushed release commit triggers is not awaited.

**Rulesets.** There are three, all with an empty bypass list, so they bind the admin too:

| Ruleset | Target | Rules |
|---|---|---|
| `stable` | branch `stable` | block force pushes (`non_fast_forward`), restrict deletions |
| `main` | branch `main` | block force pushes, restrict deletions |
| `tags` | tags `v*` | block force pushes, restrict deletions, restrict updates |

- `stable`: GitHub cannot express "only `tools/release` may move it". Only the owner has write access, and the rules make every move a fast-forward, which is as much as can be enforced. Adding *Restrict updates* with an admin bypass was rejected, because a bypass lifts every rule, including the ban on force pushes.
- `main`: there are no required status checks. The owner pushes directly, and a required check would need an admin bypass, which would only add a notice to every push. Contributor PRs run CI through the `pull_request` trigger, and the owner checks that CI passed before merging. The release-time CI check above is the substantive gate.
- Tags: a published `vX.Y.Z` is never moved or deleted. The changelog's compare links depend on the tags.

**Applying them.** Each ruleset is a JSON file in the repo: `.github/rulesets/stable.json`, `main.json` and `tags.json`, in GitHub's ruleset export/import format. The one-time `stable` setup applies each one with `gh api repos/kosh30/calamari-track/rulesets --method POST --input <file>`, and `CONTRIBUTING.md` records the commands. GitHub does not read these files automatically: they are the template and the record. `tools/release` does not create or check rulesets.

**Rejected.**

- Relying on local checks alone.
- Aborting on a CI run that is still in progress.
- Required checks on `main`.
- Setting the rulesets by hand in the GitHub UI.
- A `--setup` mode in `tools/release`.

## Comments

2026-09-25, after `v0.1.0`: the `tags` ruleset also got *Restrict updates*. Blocking force pushes alone would still let a tag move forward to a descendant commit, and "a published `vX.Y.Z` is never moved" means not at all. Creating new tags stays allowed.
