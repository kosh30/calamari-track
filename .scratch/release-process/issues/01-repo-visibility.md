# 01: Is the GitHub repo public, and can we use `gh`?

Type: task
Status: open
Blocked by: none

## Question

`gh` is not logged in on this machine, so we cannot tell whether `kosh30/calamari-track` is public, nor create releases from the CLI. HITL checklist:

1. Run `! gh auth login` (GitHub.com, SSH, the account that owns `kosh30/calamari-track`).
2. Run `! gh repo view kosh30/calamari-track --json visibility,defaultBranchRef,hasIssuesEnabled`.
3. If private: decide whether to make it public now or at the first release (the destination assumes public).

Resolved when `gh` works and the visibility (and the plan for it) is recorded under `## Answer`.
