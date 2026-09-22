# 03: Schichtstatus und Dauer in der Bar

**What to build:** Die Bar zeigt, ob gerade eine laufende Schicht existiert, und wenn ja, deren Dauer (z.B. `3:42`), auch wenn per Web oder Handy eingestempelt wurde. Der Helfer ermittelt den Status über `checkTimesheetOverlap` für heute im Fenster „jetzt − 2 Min … jetzt“ (siehe ADR 0001) und die Startzeit per Intervallhalbierung auf die Minute genau. Der Service fragt alle 3 Minuten ab, außerdem sofort beim Öffnen des Panels. Die Dauer tickt lokal weiter, die Startzeit wird im lokalen Zustand gecacht. Bei Fehlern zeigt die Bar einen Fehlerzustand statt eines veralteten Status.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] `status` liefert `{"ok": true, "running": bool}`
- [ ] `start-time` liefert die Startzeit der laufenden Schicht auf die Minute genau, `--after HH:MM` sucht erst ab dieser Zeit
- [ ] Die Bar ist grau ohne Schicht und grün mit tickender Dauer bei laufender Schicht
- [ ] Eine im Web begonnene Schicht erscheint spätestens nach einem Abfrage-Intervall
- [ ] Beim Öffnen des Panels wird sofort abgefragt
- [ ] Netz- oder Anmeldefehler zeigen einen Fehlerzustand in der Bar
- [ ] Tests gegen den Fake: Status ja/nein und Intervallhalbierung findet die im Fake hinterlegte Startzeit
