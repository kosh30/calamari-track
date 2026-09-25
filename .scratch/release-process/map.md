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

- [Can our lint and tests run in GitHub Actions?](issues/02-qmllint-in-actions.md): yes, all of them; pin Qt 6.11.2, use `node --test js/*.test.mjs`; formatters would be sizeable reformats

## Not yet specified

- **Omarchy marketplace**: list the plugin or not? It needs a company Calamari account and API key, so the audience is small. If yes: submission flow, verify-issue per release, and what the listing needs (preview image, category, tags).
- **Extra repo files**: `CONTRIBUTING.md`, `SECURITY.md`, a preview image for the README. Depends on the marketplace decision and on the repo being public.
- **Changelog rules**: what earns an entry (user-visible only? `Fixed` only for shipped bugs?), tone, where the rules live (an `AGENTS.md` like the model, or `CLAUDE.md`).
- **Where the runbook lives** and what a release PR/commit looks like, once the degree of automation is known.
- **CI as a gate**: whether a release requires green CI on `main`, branch protection, required checks.

## Out of scope
