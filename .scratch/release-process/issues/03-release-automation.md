# 03: How much of a release is automated?

Type: grilling
Status: open
Blocked by: none

## Question

Which shape does cutting a release take?

- (a) a manual runbook like the model: a hand-written release commit, then `gh release create` with the changelog section as body;
- (b) a local script (e.g. `bin/release X.Y.Z`) that bumps the version, moves `[Unreleased]` to a dated section, commits, tags, pushes and creates the GitHub release;
- (c) a GitHub Action that publishes the release when a `vX.Y.Z` tag is pushed.

Leaning (b): one command, no secrets in CI. Decide also what the release commit touches (see ticket 05).
