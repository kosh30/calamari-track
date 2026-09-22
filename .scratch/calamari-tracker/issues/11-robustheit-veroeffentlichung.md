# 11: Robustheit und Veröffentlichung

**What to build:** Das Plugin läuft im Alltag stabil und kann veröffentlicht werden. Bei Netzfehlern und `RATE_LIMITED` fragt der Service seltener ab (Backoff) und zeigt den Fehler in der Bar. Ein manueller Prüfbefehl des Helfers erkennt, ob sich das Verhalten des Overlap-Checks geändert hat (laufende Schicht zählt bis „jetzt“). Eine README beschreibt Installation, Login, Einstellungen und die bekannten Grenzen laut ADR 0001. Im Repo liegen keine Secrets, Tokens oder firmenspezifischen Daten.

**Blocked by:** 06, 07, 09

**Status:** ready-for-agent

- [ ] Backoff bei `NETWORK` und `RATE_LIMITED`, nach Erfolg zurück zum normalen Intervall
- [ ] Der Prüfbefehl für das Overlap-Verhalten existiert und ist in der README beschrieben
- [ ] README mit Installation (Symlink bzw. `omarchy plugin add`), Login, Einstellungen und Grenzen
- [ ] Repo auf Secrets und Firmendaten geprüft (u.a. keine echten E-Mails, Namen oder Tenant-Daten in Tests und Fixtures)
- [ ] Eine Arbeitswoche im Alltag ohne manuellen Eingriff gelaufen (vom Benutzer bestätigt)
