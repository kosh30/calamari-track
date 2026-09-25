# Map: Release process

Label: wayfinder:map

## Destination

A finished spec of the release process for this plugin on GitHub: every step, convention and tool decided, so an agent can turn it into implementation tickets and ship the first release (`v0.1.0`) with it.

## Notes

- Model: the release process of [quickshell-screentime-plugin](https://github.com/ax1g/quickshell-screentime-plugin) (CHANGELOG rules and release runbook in its `AGENTS.md`, CI in `.github/workflows/ci.yml`).
- Hosting: this repo lives on **GitHub** (`kosh30/calamari-track`), an explicit exception to the global GitLab rule. Releases, Actions and `gh` apply here.
- Audience: public GitHub repo, installed by `omarchy plugin add <git-url>`. The Omarchy marketplace is an open question (fog), not assumed.
- Settled while charting:
  - SemVer, tags `vX.Y.Z`, `CHANGELOG.md` in Keep a Changelog format.
  - First release is `v0.1.0` (the current manifest version); 1.0 once someone besides the author uses it.
  - Changelog and release notes in English.
  - A `LICENSE` file (MIT) ships, as `manifest.json` already declares.
- Planning only: tickets decide, they do not build. Grilling tickets use the skills "grilling" and "domain-modeling".

## Decisions so far

<!-- one line per closed ticket: [title](issues/NN-slug.md): gist -->

- [Is the GitHub repo public, and can we use `gh`?](issues/01-repo-visibility.md): already public, `gh` logged in as `kosh30` with admin rights; no releases or `LICENSE` yet
- [Can our lint and tests run in GitHub Actions?](issues/02-qmllint-in-actions.md): yes, all of them; pin Qt 6.11.2, use `node --test js/*.test.mjs`; formatters would be sizeable reformats
- [How much of a release is automated?](issues/03-release-automation.md): local script `tools/release X.Y.Z` (Python, `--dry-run`); users follow a `stable` default branch that fast-forwards only at releases, development stays on `main`
- [Do we switch to Conventional Commits?](issues/04-commit-convention.md): no; plain English subject saying what changes (≤72 chars), ticket path in the body instead of "Ticket NN" in the subject, no enforcement
- [Does the plugin show its version, and where does it come from?](issues/05-version-at-runtime.md): yes, at the foot of the settings page; `manifest.json` is the only source (the helper reads it too, and its journal lines start with `[X.Y.Z]`), so a release touches only `manifest.json` and `CHANGELOG.md`
- [What does CI check?](issues/06-ci-scope.md): four jobs (Node tests, Python tests, `qmllint` on pinned Qt 6.11.2, `tools/format --check`) on push/PR to `main`; Prettier, Ruff and qmlformat adopted now at width 120
- [What are the changelog rules, and where do they and the release instructions live?](issues/07-changelog-rules.md): the model's user-facing rules, entry in the same commit; all contribution and release rules in a new English `CONTRIBUTING.md`, `CLAUDE.md` points to it
- [How does the Omarchy marketplace list, install and update a plugin?](issues/09-marketplace-mechanics.md): listing is an issue plus maintainer approval (needs root `LICENSE`, README with install and removal); `listingValidatedCommit` pins nothing, installs follow the default branch, so with `stable` the listing turns "Update unverified" only at releases; each release may get an optional `[Verify]` issue with the tagged SHA (median ~41 h); no rule against API keys, Python helpers, network or German UI
- [Does a release wait for green CI, and which branches are protected?](issues/08-ci-as-gate.md): `tools/release` requires the `ci.yml` run on the commit it releases from to be green (waits if it is running, aborts if it failed or is missing); rulesets with no bypass block force pushes and deletion on `stable`, `main` and `v*` tags; no required checks; kept as JSON in `.github/rulesets/`, applied with `gh api` during the one-time setup

## Not yet specified

- **Extra repo files**: `SECURITY.md`, a preview image for the README. Depends on "Do we list the plugin in the Omarchy marketplace?" (the repo is already public). `CONTRIBUTING.md` is decided (see the changelog rules).

## Out of scope
