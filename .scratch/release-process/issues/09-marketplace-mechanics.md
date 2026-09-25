# 09: How does the Omarchy marketplace list, install and update a plugin?

Type: research
Status: resolved
Blocked by: none

## Question

Facts for the decision whether to list the plugin (see "Do we list the plugin in the Omarchy marketplace?"). Sources: `plugins.omarchy.org`, the repo `omacom/omarchy-plugin-marketplace` (its `registry.json`, issue templates, README), the Omarchy code on this machine (`/usr/share/omarchy/bin/omarchy-plugin-*`, `/usr/share/omarchy/shell`), and the model's `AGENTS.md` section "Release and marketplace verification" (`ax1g/quickshell-screentime-plugin`).

- How does a plugin get listed: the submission flow, who reviews it, and what the listing needs (id, category, tags, preview image, README, license)?
- What does "snapshot-verified against one exact commit" (`listingValidatedCommit`) mean for installs and updates? Does a marketplace install pin that commit, or follow the default branch like `omarchy plugin add <git-url>`? How does that interact with our default branch `stable` (see "How much of a release is automated?")?
- What does each release require: the `[Verify]` issue, its template, turnaround, and what users see until it is verified ("Update unverified")?
- Are there rules that affect us: plugins that need an external account or API key, `bin/` helpers that run Python, `secret-tool`, network access, German-only UI?

## Answer

Findings: `.scratch/release-process/research/09-marketplace-mechanics.md` on branch `research/marketplace-mechanics`, commit `8cf27c1`.

- **Listing**: a `[Plugin]:` issue on `omacom/omarchy-plugin-marketplace` (form `submit-plugin.yml` or `gh issue create`). It needs a public GitHub repo with exactly one root `manifest.json` (`schemaVersion` 1, `id`, `name`, `version`, `author`, `description`, a lowercase id outside `omarchy.*`, and the id is permanent), a root README with install *and removal* instructions, a root `LICENSE`, one category (for us: Productivity), 1-3 fixed tags (e.g. `bar`, `quickshell`), and an optional root `preview.png` that the marketplace resizes itself. A bot validates the exact commit and runs a static "Automated Security Baseline". A marketplace maintainer then sets `approved-and-verified`. Median about 3 h.
- **`listingValidatedCommit`** is the exact commit the marketplace validated and scanned. It pins nothing for users. The listing's install command is plain `omarchy plugin add <repo>.git --enable`, so it clones the default branch, and `omarchy plugin update` fetches `origin HEAD`. The marketplace docs say installs are "not verification-bound". The model's `AGENTS.md` claim that installs are bound to the snapshot is wrong. The marketplace refreshes daily from the default-branch HEAD and shows `Update unverified` when that HEAD differs from the verified commit. With `stable` as the default branch, that only happens at a release, and marketplace installs get the latest release. Switch the default branch to `stable` before submitting.
- **Per release**: users need nothing, because they get it via `omarchy plugin update`. To restore `Snapshot verified`, open a `[Verify]:` issue (`verify-plugin.yml`) with the action "Verify and publish a newer upstream commit", the plugin id, the repo URL, the full SHA of the current default-branch HEAD (with `stable`, the tagged commit), and the acknowledgment checkbox. A maintainer approves after a rescan. Until then the old snapshot stays and the listing shows `Update unverified` (the card shows `Unverified`). Turnaround: median about 41 h, 90th percentile about 112 h, 470 open requests. Some have waited over 2 weeks. Optional, so it could be a script step or a manual follow-up.
- **Rules that affect us**:
  - External account or API key: allowed if documented. A maintainer could add `manual-setup`, which hides the install command, so the maintainer notes should say the standard install works.
  - Python `bin/` helper, `secret-tool`, network access: none of these is a finding or review capability. The baseline only reacts to things like `sudo`/`pkexec`, `systemctl`, curl-to-shell, sudoers files, installers and bundled binaries. None of them appear in our code or README, so `passed` is expected. Future README text must avoid them too.
  - German-only UI: no rule. The German manifest `description` becomes the card summary.
  - Gaps to close before submitting: a root `LICENSE` and removal instructions in the README.
