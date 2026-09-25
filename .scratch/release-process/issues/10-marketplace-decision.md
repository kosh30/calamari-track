# 10: Do we list the plugin in the Omarchy marketplace?

Type: grilling
Status: resolved
Blocked by: 09

## Question

The audience is small: it needs a Calamari account with Clockin, a company API key and an API Terminal. Given the facts from "How does the Omarchy marketplace list, install and update a plugin?", do we list the plugin at `v0.1.0`, later (e.g. at 1.0), or never? If yes, decide:

- what the listing carries (category, tags, preview image);
- how the per-release verification fits into `tools/release` or `CONTRIBUTING.md` ("Releasing");
- which extra repo files it forces (`SECURITY.md`, a preview image for the README).

Context from "How does the Omarchy marketplace list, install and update a plugin?":

- A listing does not pin a commit: installs and updates follow `stable`, and per-release verification only restores the "verified" badge. The median wait for that is about 41 hours.
- A listing needs a root `LICENSE` (already planned) and removal instructions in the README.
- The plugin id becomes permanent once listed.

## Answer

Decided with the user (grilling, 2026-09-25). This builds on "How does the Omarchy marketplace list, install and update a plugin?".

**Listing: not at `v0.1.0`, but at 1.0.** 1.0 is the point already set for "someone besides the author uses it". Until then the audience is the author and colleagues, who install with `omarchy plugin add <git-url> --enable`. A listing would only add upkeep: `[Verify]` issues at every release, a plugin id that can no longer change, and requests from people who lack a Calamari account, an API key or an API Terminal.

The release process for `v0.1.0` is built so that a later listing changes nothing in it: `stable` is the default branch, and there is a root `LICENSE` and a README removal section. At 1.0 the only additions are the submission issue and an optional `[Verify]` step in "Releasing". Everything about the listing itself is out of scope for this map: category, tags, preview image, card summary language, verify step, and freezing the id `kosh.calamari-tracker`.

**Repo files for `v0.1.0`:**

- **README "Removal" section**: `omarchy plugin remove kosh.calamari-tracker`. Then delete the keyring entries, which the helper stores under the attribute `service kosh.calamari-tracker` (e.g. `secret-tool clear service kosh.calamari-tracker`), and mention the settings the shell keeps. The exact commands are verified during implementation.
- **`SECURITY.md`**: short. Report vulnerabilities through GitHub's private vulnerability reporting, not public issues. Only the latest release is supported. No promises on response times. Private vulnerability reporting is switched on during the one-time setup, next to the rulesets, e.g. with `gh api -X PUT repos/kosh30/calamari-track/private-vulnerability-reporting`.
- **Preview image**: none for `v0.1.0`. It comes with the listing, as a root `preview.png` that shows no company data.

**Rejected.**

- Listing at `v0.1.0`: upkeep without an audience.
- Never listing: 1.0 is the natural point to reconsider.
- Postponing the removal section until the listing: users need it anyway, because the plugin leaves credentials in the keyring.
- No `SECURITY.md`: a report about leaked credentials should not land in public issues.
