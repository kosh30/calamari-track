# Delivery over a branch `stable` of its own instead of over `main`

`omarchy plugin add` clones the default branch, and `omarchy plugin update` fast-forwards its `HEAD` into place (`/usr/share/omarchy/bin/omarchy-plugin-update`). Tags play no part in that. Every push to the default branch would therefore be delivered at once. That is why the default branch on GitHub is `stable`. It only moves at a release, by fast-forward to the tagged commit. Development goes on directly on `main`, intermediate states included.

## Considered Options

- **`main` as the channel, a release as no more than a label**: then every commit on `main` would have to be deliverable, and unfinished work would belong on feature branches.
- **Feature branches merged only at a release**: that is more branch management than a one-person project needs.

## Consequences

- PRs go to `main`, not to the default branch. That has to be said in the README.
- `stable` only moves by fast-forward. There is no hotfix route around `main`: a fix goes on `main`, unfinished work is finished or reverted, then a normal release follows.
