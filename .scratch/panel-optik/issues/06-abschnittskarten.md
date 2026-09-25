# 06: Einstellungen in Abschnittskarten

**What to build:** Die Einstellungsseite gliedert ihre gut zwanzig Felder in getönte Karten mit Überschrift, statt sie flach untereinander zu reihen: Abfrage und Erinnerungen, Pause, Kernzeiten, Verbindung, Projekt und Pausentyp. Besonders die sieben Kernzeit-Felder stehen als eine Gruppe mit einer gemeinsamen Erklärung, statt sieben lange Einzelbeschriftungen zu tragen. Die Gruppenzugehörigkeit liefert das Schema mit, damit ein neu hinzugefügtes Feld nicht heimatlos ist. Das Vorbild liefert nur das Prinzip — die entsprechende Datei des fremden Projekts ist vollständig an dessen eigene Einstellungen geknüpft und taugt nicht zur Übernahme.

**Blocked by:** 03, 04

**Status:** umgezogen nach [#8](https://github.com/kosh30/calamari-track/issues/8) (2026-09-25); der aktuelle Stand steht dort, diese Datei ist Archiv.

- [ ] Das Schema trägt die Gruppe je Feld; ein Feld ohne Gruppe landet sichtbar in einer Sammelgruppe, statt zu verschwinden
- [ ] Die sieben Kernzeiten stehen als eine Karte mit einer gemeinsamen Erklärung
- [ ] Prüfung und Speichern arbeiten unverändert über alle Gruppen hinweg
- [ ] Fehlermeldungen stehen weiterhin an dem Feld, das sie betreffen
- [ ] Scrollen und der Balken aus Ticket 03 funktionieren mit den Karten weiter
- [ ] Werden zusätzliche Shell-Bausteine verwendet, ist die Liste in `lint/refresh.sh` ergänzt und `qmllint` läuft sauber

*Hintergrund: `docs/research/quickshell-screentime-plugin.md`, Vorschlag 5.*
