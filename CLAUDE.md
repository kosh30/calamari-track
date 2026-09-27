# Calamari Tracker

An Omarchy shell plugin (Quickshell) that tracks your own working time in Calamari through the official MCP server and reminds you of a forgotten clock-in or clock-out. Terminology: `CONTEXT.md`. Architecture decisions: `docs/adr/`. Order of work: `docs/PLAN.md`.

## Hosting

This repo lives on **GitHub** (`kosh30/calamari-track`), an explicit departure from the global GitLab rule: releases, GitHub Actions and `gh` apply here.

## Language

Docs, code, comments, commit messages and changelog entries are English. The interface is translated: English by default, plus German, Polish and Russian, all of it through the catalogue in `js/messages/` (ADR 0006). A string a user can see belongs there and nowhere else — a literal in a QML file or a logic module is a string that three languages will never get, and nothing fails when it happens.

Three things stay untranslated on purpose. Calamari's own values — the project name, the break type — are quoted inside a message, never looked up as one. `"frei"` is the stored token for a weekday without a core time: the form shows the locale's word for it and always saves `frei`. And `manifest.description` with `barWidget.displayName` cannot be translated at all, because the shell reads them from the file before any plugin code runs.

Where a doc quotes on-screen text it is quoting one language, usually German, and `CONTEXT.md` says which.

## Commands

- Contribution, commit, changelog and release rules: `CONTRIBUTING.md` (binding, for agents too)
- Tests: `node --test js/*.test.mjs` and `python3 -m unittest`
- Format: `tools/format` (`--check` only checks)
- Log of the helper (errors, REST requests sent, stampings): `journalctl -t calamari-tracker`
- Lint: `/usr/lib/qt6/bin/qmllint -I lint *.qml` (refresh the snapshots: `lint/refresh.sh`)
- Installed by symlink `~/.config/omarchy/plugins/kosh.calamari-tracker`.
- Make a change take effect: `omarchy-restart-shell` (nothing reloads on save, see "Reloading")

## Reloading

**No file of the plugin reloads on save.** The shell watches no QML of the plugin — neither `~/.config/omarchy/plugins` itself nor anything in it, nor the checkout the symlink points at. It sets no `Quickshell.watchFiles`, and Quickshell has no command-line switch for it. Installing as a real directory instead of a symlink changes nothing.

So every change — `Widget.qml`, `Panel.qml`, `SettingsForm.qml`, `ActionButton.qml`, `Service.qml` — only takes effect after `omarchy-restart-shell`. `Service.qml` is `keepLoaded` on top of that and could not be reloaded by any other route either.

That is why every measurement starts with a restart: a change that was not reloaded looks exactly like a change that does not work — and then the hunt goes through code that has been right all along.

## Visual tests

Driving the interface and capturing the screen are explicitly allowed, both by hand and as automated visual tests. An automated test does the same three things in order: restart, act, capture, then read the artefact back and compare.

- `omarchy-restart-shell` first, every time — see "Reloading". Without it a test measures the previous build.
- `ydotool` for input (keys, clicks, mouse) — needs `ydotoold` running
- `grim` for screenshots, `slurp` to pick the region; `grim -g "<geometry>"` for a fixed region, which is what a repeatable test wants instead of an interactive pick
- `wf-recorder -g "$(slurp)" -f <file>.mp4` for screen recordings (stop with SIGINT)
- Screenshots and recordings may be read back for analysis, and compared against each other frame by frame — a pixel difference of zero is how "nothing happened" is proven
- Artefacts belong in the scratchpad, never in the repo

## Agent skills

### Issue tracker

Issues and specs are GitHub issues in `kosh30/calamari-track` (`gh`). Tickets resolved earlier sit as an archive under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Standard vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` in the root. See `docs/agents/domain.md`.
