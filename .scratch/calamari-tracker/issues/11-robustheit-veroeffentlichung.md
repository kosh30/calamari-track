# 11: Robustheit und Veröffentlichung

**What to build:** Das Plugin läuft im Alltag stabil und kann veröffentlicht werden. Bei Netzfehlern und `RATE_LIMITED` fragt der Service seltener ab (Backoff) und zeigt den Fehler in der Bar. Ein manueller Prüfbefehl des Helfers erkennt, ob sich das Verhalten des Overlap-Checks geändert hat (laufende Schicht zählt bis „jetzt“). Eine README beschreibt Installation, Login, Einstellungen und die bekannten Grenzen laut ADR 0001. Im Repo liegen keine Secrets, Tokens oder firmenspezifischen Daten.

**Blocked by:** 06, 07, 09

**Status:** umgezogen nach [#10](https://github.com/kosh30/calamari-track/issues/10) (2026-09-25); der aktuelle Stand steht dort, diese Datei ist Archiv.

- [x] Backoff bei `NETWORK` und `RATE_LIMITED`, nach Erfolg zurück zum normalen Intervall
- [x] Der Prüfbefehl für das Overlap-Verhalten existiert und ist in der README beschrieben
- [x] README mit Installation (Symlink bzw. `omarchy plugin add`), Login, Einstellungen und Grenzen
- [x] Repo auf Secrets und Firmendaten geprüft (u.a. keine echten E-Mails, Namen oder Tenant-Daten in Tests und Fixtures)
- [ ] Eine Arbeitswoche im Alltag ohne manuellen Eingriff gelaufen (vom Benutzer bestätigt)

## Comments

**2026-09-25 (Agent):** Umgesetzt, bis auf die Arbeitswoche im Alltag (Benutzer).
- Backoff in `js/backoff.mjs`: Jeder `NETWORK`- oder `RATE_LIMITED`-Fehler einer Abfrage (status, day-end, start-time, end-time) verdoppelt das Intervall bis höchstens 30 Min, die nächste erfolgreiche Antwort setzt es zurück. Der Tooltip der Bar nennt Ursache und nächsten Versuch.
- `bin/calamari check-overlap`: fragt per REST, ob eine Schicht läuft, und prüft, ob `checkTimesheetOverlap` sie in der aktuellen Minute sieht. Geändertes Verhalten ergibt `OVERLAP_CHANGED`, ohne laufende Schicht oder in der Pause `"unchanged": null`. Live ausgeführt ohne laufende Schicht; die eigentliche Prüfung braucht eine laufende Schicht.
- Firmendaten: `cti.calamari.io` war Vorgabe der Einstellung `apiUrl` und stand in ADR 0003 und REST-Ticket 01. Jetzt gibt es keine Vorgabe, leer ergibt `API_URL_REQUIRED`. Die lokale `shell.json` hat den Wert per `omarchy bar set` bekommen. Projektnamen und Ids aus REST-Ticket 01 entfernt. Tests und Fixtures nutzen nur Mustermann und `example.com`.
- Offen vor der Veröffentlichung: Die git-Historie enthält den Tenant noch (u.a. 51aba41, bd34497), und es fehlt eine LICENSE-Datei (Manifest und README sagen MIT).
