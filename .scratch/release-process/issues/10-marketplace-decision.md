# 10: Do we list the plugin in the Omarchy marketplace?

Type: grilling
Status: open
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
