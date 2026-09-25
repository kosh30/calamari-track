# 04: Do we switch to Conventional Commits?

Type: grilling
Status: resolved
Blocked by: 03

## Question

Commits today read "Ticket 05 (REST bridge): …" or plain sentences. The model uses Conventional Commits (`feat(panel): …`). Do we switch, and if so, does anything read them (a changelog generator, the release script from ticket 03), or is it style only? If the changelog is hand-written, is a convention worth it at all?

Context from "How much of a release is automated?": `tools/release` does not read commit messages. The changelog is hand-written, and the release commit is `Release vX.Y.Z`. So a convention would be style only, unless the changelog rules decide otherwise.

## Answer

Decided with the user (grilling, 2026-09-25): **no Conventional Commits.** Nothing reads commit messages: `tools/release` ignores them, and the changelog is hand-written. `feat:`/`fix:` prefixes would only repeat what the changelog says better.

- **Subject line:** English, describes what changes, at most about 72 characters, no trailing period. An area prefix is optional. This writes down what recent commits already do (e.g. "Bar names the remedy for failures that wait for the user").
- **Ticket references:** they move out of the subject into the body, as the ticket's path, e.g. `Ticket: .scratch/rest-api-bruecke/issues/05-….md`. A bare "Ticket 05" is ambiguous, because every effort under `.scratch/` numbers from 01, and the tickets are public in the repo. This applies to new commits only, and history is not rewritten.
- **Release commits** stay `Release vX.Y.Z` (see "How much of a release is automated?").
- **Enforcement:** none. There is no hook and no CI check. The rule is written down where agents read it.
- **Where the rule lives:** added to the ticket "What are the changelog rules, and where do they and the release instructions live?", so all contribution rules land in one place.
