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
- Installiert per Symlink `~/.config/omarchy/plugins/kosh.calamari-tracker`.
- Eine Änderung wirksam machen: `omarchy-restart-shell` (beim Speichern lädt nichts neu, siehe „Neu laden“)

## Neu laden

**Keine Datei des Plugins lädt beim Speichern neu.** Die Shell überwacht kein QML des Plugins — weder `~/.config/omarchy/plugins` selbst noch irgendetwas darin, und auch nicht das Repo, in das der Symlink zeigt. Sie setzt kein `Quickshell.watchFiles`, und Quickshell hat dafür keinen Schalter auf der Kommandozeile. Ein echtes Verzeichnis statt des Symlinks ändert daran nichts.

Jede Änderung — `Widget.qml`, `Panel.qml`, `SettingsForm.qml`, `ActionButton.qml`, `Service.qml` — wird also erst nach `omarchy-restart-shell` wirksam. `Service.qml` ist zusätzlich `keepLoaded` und wäre auch auf keinem anderen Weg neu zu laden.

Darum vor jeder Messung neu starten: eine Änderung, die nicht neu geladen wurde, sieht genauso aus wie eine, die nicht wirkt — und dann wird im Code gesucht, der längst stimmt.

## Manuelle Tests

Zum Testen der Oberfläche sind Eingabe-Automatisierung und Bildschirmaufnahmen ausdrücklich erlaubt:

- `ydotool` (Tasten, Klicks, Maus) — braucht laufenden `ydotoold`
- `grim` für Screenshots, `slurp` für den Ausschnitt
- `wf-recorder -g "$(slurp)" -f <datei>.mp4` für Bildschirmaufnahmen (Stop per SIGINT)
- Screenshots und Aufnahmen dürfen zur Analyse gelesen werden
- Artefakte gehören ins Scratchpad, nicht ins Repo
- Vor jeder Messung `omarchy-restart-shell`, siehe „Neu laden“

## Agent skills

### Issue tracker

Issues und Specs sind GitHub Issues in `kosh30/calamari-track` (`gh`). Erledigte Tickets von früher liegen als Archiv unter `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Standard-Vokabular (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` im Root. See `docs/agents/domain.md`.
