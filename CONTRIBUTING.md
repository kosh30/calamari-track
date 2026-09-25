# Contributing

These rules are for humans and agents alike.

## Branches

- **`main`** is where development happens, work in progress included.
  Pull requests target `main`.
- **`stable`** is the default branch on GitHub, and it is what users get:
  `omarchy plugin add` clones it and `omarchy plugin update` fast-forwards
  to it. It only moves at a release, by fast-forward to the tagged commit
  (see [ADR 0004](docs/adr/0004-auslieferungs-branch-stable.md)).

There is no hotfix path around `main`. A fix goes on `main`, unfinished
work there is finished or reverted, then a normal release follows.

## Checks

Run them before you push; CI runs the same on `main` and on pull requests.

```sh
node --test js/*.test.mjs
python3 -m unittest
qmllint -I lint *.qml        # Arch: /usr/lib/qt6/bin/qmllint
tools/format                 # tools/format --check only checks
```

`tools/format` pins the formatter versions (Prettier, Ruff; qmlformat comes
with Qt). It needs `npx` and `uvx`. To hide the formatting commits from
`git blame`, run once:

```sh
git config blame.ignoreRevsFile .git-blame-ignore-revs
```

## Commit messages

- The subject is English, says what changes, has at most about 72
  characters and no trailing period. An area prefix is optional. No
  Conventional Commits prefixes.
- A commit that works on a ticket names the ticket's path in the body, e.g.
  `Ticket: .scratch/release-process/issues/05-version-at-runtime.md`. A bare
  "Ticket 05" is ambiguous, because every effort under `.scratch/` numbers
  from 01.
- Release commits are `Release vX.Y.Z`, made by `tools/release`.

## Changelog

`CHANGELOG.md` follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
The entry goes into `[Unreleased]` in the same commit as the change.

- The changelog speaks to users of the last release, not to the working
  tree. If no released user saw the old behaviour, there is nothing to
  announce: fold the tweak into the feature's own entry.
- `Fixed` is only for bugs in shipped behaviour. A fix to a feature that is
  still unreleased gets no entry.
- Internal work never appears: refactors, tests, tooling, formatting, file
  moves.
- `Added` leads with the user's gain, not the mechanism: one entry per
  feature, two lines at most.
- No internals: no file names, setting keys or function names. The
  exception is `bin/calamari` commands that users type themselves, e.g.
  `bin/calamari api-key`.
- Entries are English. German UI labels are quoted verbatim as they appear
  on screen, e.g. Mark today as off with “Heute frei” in the panel.
- Entries do not link tickets or commits. `tools/release` maintains the
  compare links at the bottom.

## Releasing

Versions follow [SemVer](https://semver.org/), tags are `vX.Y.Z`, and
`manifest.json` is the only copy of the version. On `main`, with the
`[Unreleased]` section filled in:

```sh
tools/release X.Y.Z --dry-run   # changelog section, diff, planned commands
tools/release X.Y.Z
```

The version must be greater than the one in `manifest.json`; the same
version is allowed while its tag does not exist yet (the first release).
The script aborts unless `main` is clean and equal to `origin/main`, the tag
is new, `[Unreleased]` has entries, the checks above pass, `gh` is logged in
and the CI run of the commit succeeded (it waits while that run is still
going). It warns when the local `qmllint` differs from the Qt version pinned
in `.github/workflows/ci.yml`; bump the pin to Arch's `qt6-declarative`.

Then it commits `Release vX.Y.Z` (`manifest.json` and `CHANGELOG.md` only),
tags it, pushes `main` and the tag, fast-forwards `stable` to the tag and
creates the GitHub release with the changelog section as its notes. If a
step after the local commit and tag fails, it prints the remaining commands
instead of rolling back.

### One-time setup

Done once, before the first release. Rulesets and private vulnerability
reporting are applied from the files in the repo; GitHub does not read
`.github/rulesets/` by itself.

```sh
git push origin main:refs/heads/stable
gh repo edit kosh30/calamari-track --default-branch stable
for f in .github/rulesets/*.json; do
    gh api repos/kosh30/calamari-track/rulesets --method POST --input "$f"
done
gh api --method PUT repos/kosh30/calamari-track/private-vulnerability-reporting
```

The rulesets block force pushes and deletion of `stable`, `main` and `v*`
tags, with no bypass, so they bind the owner too.
