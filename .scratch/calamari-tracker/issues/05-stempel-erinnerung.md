# 05: Stempel-Erinnerung an Arbeitstagen

**What to build:** An einem Arbeitstag erinnert das Plugin während der Kernzeit ans Einstempeln, solange heute noch gar nicht eingestempelt wurde: sofort beim Beginn der Kernzeit (bzw. beim Start oder Aufwachen mitten in der Kernzeit), danach alle 5 Minuten bis zum Ende der Kernzeit. Nach dem Feierabend kommen keine Stempel-Erinnerungen mehr. Arbeitstag und Kernzeit kommen aus dem Arbeitsplan in Calamari (`day-info` über `getWorkPlan`, einmal täglich gecacht). Die Entscheidung trifft die reine Erinnerungslogik `decide(now, day, state, config) → { barState, actions[], nextCheckAt }`. Sie ist idempotent: bereits verschickte Erinnerungen stehen im Zustand. Die Notification ersetzt die vorige desselben Typs, ein Klick öffnet das Panel über IPC. Solange eine Erinnerung fällig ist, ist das Bar-Icon rot. Die zugehörigen Config-Werte (Abfrage-Intervall, Intervall der Stempel-Erinnerung) stehen im Einstellungsschema des Widgets.

**Blocked by:** 04

**Status:** ready-for-agent

- [x] `day-info --date` liefert `workingDay`, `coreStart`, `coreEnd` aus dem Arbeitsplan
- [x] `decide` ist ein reines JS-Modul ohne Qt-Abhängigkeit
- [x] Tests für `decide`: Kernzeit ohne Schicht (sofort, dann alle 5 Min, Ende mit der Kernzeit), Feierabend vor Ende der Kernzeit, Wiedereinstempeln nach dem Feierabend, Start mitten in der Kernzeit, Wochenende ohne Erinnerung, Idempotenz
- [ ] Die Notification wird über den omarchy-shell-Sender verschickt, eine Wiederholung ersetzt die vorige
- [ ] Ein Klick auf die Notification öffnet das Panel (IPC-Ziel des Plugins)
- [ ] Das Bar-Icon ist rot, solange eine Stempel-Erinnerung fällig ist
- [ ] Die Config-Werte sind über die Widget-Einstellungen änderbar, mit verkürzten Werten manuell abgenommen
- [x] Test für `day-info` gegen den Fake

## Comments

**2026-09-22 (Agent):** Umgesetzt, die manuelle Abnahme mit verkürzten Werten steht noch aus.
- `day-info [--date]` liest `getWorkPlan`. Das braucht keine Argumente und liefert pro Wochentag `workingDay`, `startTime` und `finishTime`, gegen echtes Calamari geprüft. Feiertage und Abwesenheiten folgen mit Ticket 06. Der Service holt den Tag einmal pro Datum nach der ersten erfolgreichen Abfrage.
- Die Logik steckt in `js/reminders.mjs`: `decide`, `markSent` und `notification`. Gemeinsame Zeitfunktionen liegen in `js/daytime.mjs`. `decide().barState` ist vorerst nur `"reminder"` oder `null`, den Rest der Bar liefert weiter `barView` aus `shiftclock`.
- „Noch gar nicht eingestempelt“ heißt `stampedToday` im Zustand, die Grenze steht in spec.md.
- Die Notification kommt von `omarchy-notification-send -p`, die ID wird mit `-r` wiederverwendet, der Klick führt `omarchy-shell shell summon kosh.calamari-tracker` aus. Ein eigener `IpcHandler` ist nicht nötig, weil der Bar-Widget-Pfad der Shell `open()` des Widgets aufruft.
- Nach einem Suspend (Lücke im 15-s-Takt) wird sofort abgefragt. Erinnert wird erst mit einem frischen Status.
- Config: `pollIntervalMinutes` und `stampReminderMinutes` in `barWidget.defaults` und `schema`. Das Widget reicht seine `settings` an den Service weiter.
