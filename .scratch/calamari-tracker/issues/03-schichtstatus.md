# 03: Schichtstatus und Dauer in der Bar

**What to build:** Die Bar zeigt, ob gerade eine laufende Schicht existiert, und wenn ja, deren Dauer (z.B. `3:42`), auch wenn per Web oder Handy eingestempelt wurde. Der Helfer ermittelt den Status über `checkTimesheetOverlap` für heute im Fenster „jetzt − 2 Min … jetzt“ (siehe ADR 0001) und die Startzeit per Intervallhalbierung auf die Minute genau. Der Service fragt alle 3 Minuten ab, außerdem sofort beim Öffnen des Panels. Die Dauer tickt lokal weiter, die Startzeit wird im lokalen Zustand gecacht. Bei Fehlern zeigt die Bar einen Fehlerzustand statt eines veralteten Status.

**Blocked by:** 02

**Status:** ready-for-agent

- [x] `status` liefert `{"ok": true, "running": bool}`
- [x] `start-time` liefert die Startzeit der laufenden Schicht auf die Minute genau, `--after HH:MM` sucht erst ab dieser Zeit
- [ ] Die Bar ist grau ohne Schicht und grün mit tickender Dauer bei laufender Schicht
- [ ] Eine im Web begonnene Schicht erscheint spätestens nach einem Abfrage-Intervall
- [ ] Beim Öffnen des Panels wird sofort abgefragt
- [ ] Netz- oder Anmeldefehler zeigen einen Fehlerzustand in der Bar
- [x] Tests gegen den Fake: Status ja/nein und Intervallhalbierung findet die im Fake hinterlegte Startzeit

## Comments

**2026-09-22 (Agent):** Der Helfer bietet jetzt `status` und `start-time [--after HH:MM]`. Die Logik liegt in `js/shiftclock.mjs`, die Verdrahtung in Service, Widget und Panel.
- Gegen den echten Server geprüft: `checkTimesheetOverlap` liefert eine Liste der Tage mit Überschneidung. `status` erkannte die laufende Schicht. `start-time` lieferte nach 10 Aufrufen 09:40, wie im Web.
- Eine Suche nach Folgeschichten braucht `--after`. Der Service setzt dafür die letzte Abfrage ohne laufende Schicht minus 2 Min ein. Eine Pause, die das Plugin nie gesehen hat, findet er nicht (siehe spec.md, Abschnitt „Startzeit“).
- Neue Naht `CALAMARI_NOW` für die Tests, in der Spec nachgetragen.
- Noch offen ist die Abnahme in der laufenden Shell: Farben, tickende Dauer, eine Web-Schicht innerhalb eines Intervalls, die Abfrage beim Öffnen des Panels, der Fehlerzustand.
