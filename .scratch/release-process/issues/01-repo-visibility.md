# 01: Is the GitHub repo public, and can we use `gh`?

Type: task
Status: resolved
Blocked by: none

## Question

`gh` is not logged in on this machine, so we cannot tell whether `kosh30/calamari-track` is public, nor create releases from the CLI. HITL checklist:

1. Run `! gh auth login` (GitHub.com, SSH, the account that owns `kosh30/calamari-track`).
2. Run `! gh repo view kosh30/calamari-track --json visibility,defaultBranchRef,hasIssuesEnabled`.
3. If private: decide whether to make it public now or at the first release (the destination assumes public).

Resolved when `gh` works and the visibility (and the plan for it) is recorded under `## Answer`.

## Answer

Done: `gh` works and the repo is already public, so there is nothing to plan for visibility.

- `gh auth status`: logged in to github.com as `kosh30` (token in the keyring), scopes `repo`, `workflow`, `read:org`, `gist`. `gh` uses HTTPS for its own git operations; `origin` stays on SSH (`git@github.com:kosh30/calamari-track.git`).
- `gh repo view kosh30/calamari-track`: `visibility: PUBLIC`, default branch `main`, issues enabled, our permission `ADMIN` (enough for releases, branch protection and repo settings).
- No GitHub releases exist yet (`gh release list` is empty).
- GitHub detects no license (`license: null`), because the repo has no `LICENSE` file yet. The map already settles that an MIT `LICENSE` ships.
- The repo has no topics, and its description is "Calamari-io tracker plugin for omarchy".
