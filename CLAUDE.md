# Calamari Tracker

Omarchy-Shell-Plugin (Quickshell), das die eigene Arbeitszeit in Calamari über den offiziellen MCP-Server erfasst und an vergessenes Ein-/Ausstempeln erinnert. Begriffe: `CONTEXT.md`. Architekturentscheidung: `docs/adr/`. Reihenfolge der Umsetzung: `docs/PLAN.md`.

## Hosting

Dieses Repo liegt auf **GitHub** (`kosh30/calamari-track`), ausdrücklich abweichend von der globalen GitLab-Regel: Releases, GitHub Actions und `gh` gelten hier.

## Befehle

- Beitrags-, Commit-, Changelog- und Release-Regeln: `CONTRIBUTING.md` (verbindlich, auch für Agenten)
- Tests: `node --test js/*.test.mjs` und `python3 -m unittest`
- Formatieren: `tools/format` (`--check` prüft nur)
- Log des Helpers (Fehler, gesendete REST-Anfragen, Stempelungen): `journalctl -t calamari-tracker`
- Lint: `/usr/lib/qt6/bin/qmllint -I lint *.qml` (Snapshots auffrischen: `lint/refresh.sh`)
- Installiert per Symlink `~/.config/omarchy/plugins/kosh.calamari-tracker`. Widget und Panel laden beim Speichern neu. `Service.qml` ist `keepLoaded` und braucht `omarchy-restart-shell`.

## Agent skills

### Issue tracker

Issues und Specs liegen als lokale Markdown-Dateien unter `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Standard-Vokabular (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` im Root. See `docs/agents/domain.md`.
