# 05: Stempel-Erinnerung an Arbeitstagen

**What to build:** An einem Arbeitstag erinnert das Plugin während der Kernzeit ans Einstempeln, solange heute noch gar nicht eingestempelt wurde: sofort beim Beginn der Kernzeit (bzw. beim Start oder Aufwachen mitten in der Kernzeit), danach alle 5 Minuten bis zum Ende der Kernzeit. Nach dem Feierabend kommen keine Stempel-Erinnerungen mehr. Arbeitstag und Kernzeit kommen aus dem Arbeitsplan in Calamari (`day-info` über `getWorkPlan`, einmal täglich gecacht). Die Entscheidung trifft die reine Erinnerungslogik `decide(now, day, state, config) → { barState, actions[], nextCheckAt }`. Sie ist idempotent: bereits verschickte Erinnerungen stehen im Zustand. Die Notification ersetzt die vorige desselben Typs, ein Klick öffnet das Panel über IPC. Solange eine Erinnerung fällig ist, ist das Bar-Icon rot. Die zugehörigen Config-Werte (Abfrage-Intervall, Intervall der Stempel-Erinnerung) stehen im Einstellungsschema des Widgets.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] `day-info --date` liefert `workingDay`, `coreStart`, `coreEnd` aus dem Arbeitsplan
- [ ] `decide` ist ein reines JS-Modul ohne Qt-Abhängigkeit
- [ ] Tests für `decide`: Kernzeit ohne Schicht (sofort, dann alle 5 Min, Ende mit der Kernzeit), Feierabend vor Ende der Kernzeit, Wiedereinstempeln nach dem Feierabend, Start mitten in der Kernzeit, Wochenende ohne Erinnerung, Idempotenz
- [ ] Die Notification wird über den omarchy-shell-Sender verschickt, eine Wiederholung ersetzt die vorige
- [ ] Ein Klick auf die Notification öffnet das Panel (IPC-Ziel des Plugins)
- [ ] Das Bar-Icon ist rot, solange eine Stempel-Erinnerung fällig ist
- [ ] Die Config-Werte sind über die Widget-Einstellungen änderbar, mit verkürzten Werten manuell abgenommen
- [ ] Test für `day-info` gegen den Fake
