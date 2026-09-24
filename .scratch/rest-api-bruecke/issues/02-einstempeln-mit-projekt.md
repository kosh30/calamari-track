# 02: Einstempeln mit Standard-Projekt

**What to build:** Eigene Einstempelungen bekommen das Standard-Projekt statt „Ohne Projekt“. „Einstempeln“ im Panel (und bis Ticket 04 auch „Pause beenden“, das heute ein Einstempeln ist) läuft über REST `clock-in` mit der Uhrzeit „jetzt“ und der `projectId` des Standard-Projekts. Das Standard-Projekt ist eine Widget-Einstellung mit Vorgabe „Check-in“, als Name; der Helper löst ihn in die Id auf. Schlägt REST fehl, zeigt das Panel eine verständliche Ursache („API Terminal fehlt“, „keine Berechtigung“, „zu viele Anfragen“) und es wird nichts nachgereicht, auch kein Einstempeln per MCP ohne Projekt. Status und Ausstempeln bleiben in diesem Ticket beim MCP.

**Blocked by:** 01

**Status:** resolved

- [x] Einstempeln geht über REST `clock-in` mit dem aufgelösten Standard-Projekt
- [x] Die Einstellung „Standard-Projekt“ (Vorgabe „Check-in“) ist im Einstellungsformular änderbar
- [x] Ein unbekannter Projektname ist ein eigener Fehler mit dem Namen im Text, kein Einstempeln ohne Projekt
- [x] Kein Rückfall auf MCP `clockIn`
- [x] Die Antwort `shiftStatus` ersetzt die bisherige Nachprüfung nach dem Einstempeln
- [x] Tests für die Auflösung des Projekts und die Fehlertexte
- [x] Mit dem Benutzer abgenommen: Die neue Schicht steht in Calamari mit Projekt „Check-in“

## Comments

**2026-09-24 (Agent):** Umgesetzt, die Abnahme mit dem Benutzer steht noch aus.
- `bin/calamari clock-in [--project NAME]` (Vorgabe „Check-in“): löst den Namen über `get-projects-for-person` auf (exakt, Groß-/Kleinschreibung zählt) und stempelt per REST `clock-in` mit `time` = jetzt (lokal, mit Offset) und `projectId`. `shiftStatus` `STARTED` → `running: true`, `FINISHED` → `running: false`; keine Nachprüfung per MCP mehr. Läuft schon eine Schicht, ignoriert Calamari das Einstempeln und meldet `STARTED`.
- Unbekannter Name: Fehler `PROJECT_UNKNOWN`, das Fehlerobjekt trägt zusätzlich `project`. Nichts wird gestempelt, kein Rückfall auf MCP `clockIn`, auch nicht bei fehlendem Key oder REST-Fehlern.
- Neue Einstellung `defaultProject` (Vorgabe „Check-in“). Der Service gibt sie als `--project` mit; leer heißt Vorgabe des Helpers. Braucht `omarchy-restart-shell`.
- Panel-Texte: „API Terminal fehlt in Calamari Clockin“, „keine Berechtigung für den API-Key“, „kein API-Key, bitte bin/calamari api-key ausführen“, „Calamari lehnt den API-Key ab“, „Projekt „X“ gibt es in Calamari nicht“, „zu viele Anfragen …“.
- Abnahme: `omarchy-restart-shell`, im Panel einstempeln, in Calamari prüfen, dass die neue Schicht das Projekt „Check-in“ hat. Dabei sieht man auch, ob der Key die Gruppe Terminal hat und ob das API Terminal eingerichtet ist.

**2026-09-24 (Agent):** Mit dem Benutzer gegen das echte Calamari abgenommen. Die Schicht von 11:24 steht in Calamari mit Projekt „Check-in“ und der richtigen Ortszeit.
- Uhrzeit-Format: Der Terminal-Endpunkt nimmt nur lokale Zeit ohne Zeitzone und ohne Millisekunden an (`2026-09-24T11:24:53`). `…Z`, `+02:00`, `+0200` und `.000` beantwortet er mit HTTP 400 „Incorrect value“, `field: time`. Das gilt vermutlich auch für `break-start`/`break-stop` (Ticket 04, 05).
- Der Key hat die Gruppe Terminal, und das API Terminal ist eingerichtet.
- Neu: Der Helper schreibt Fehler, gesendete REST-Anfragen (ohne Key) und Stempelungen ins Journal: `journalctl -t calamari-tracker`.
