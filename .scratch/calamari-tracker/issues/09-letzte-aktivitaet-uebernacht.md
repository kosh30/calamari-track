# 09: Letzte Aktivität und Übernacht-Abschluss

**What to build:** Das Plugin merkt sich die letzte Aktivität des Benutzers. Das ist der Beginn des Leerlaufs (Idle-Monitor von Quickshell mit dem Lock-Timeout aus der omarchy-shell-Idle-Config) oder, bei einem Suspend, der letzte minütliche Heartbeat vor einer Lücke von mehr als 5 Minuten. Der Korrektur-Hinweis nach einem Auto-Abschluss nennt diese letzte Aktivität als empfohlene Endzeit. Läuft beim Aufwachen oder Start des Rechners noch eine Schicht vom Vortag, führt das Plugin sofort einen Übernacht-Abschluss durch: Ausstempeln jetzt und Korrektur-Hinweis mit der letzten Aktivität vom Vortag. Danach beginnt der neue Tag normal. In diesem Ticket wird geprüft, ob eine über Mitternacht laufende Schicht im Overlap-Check für „heute“ erscheint. Falls nicht, wird zusätzlich der Vortag geprüft.

**Blocked by:** 08

**Status:** ready-for-agent

- [x] Letzte Aktivität und Heartbeat werden im lokalen Zustand gespeichert
- [x] Eine Heartbeat-Lücke über 5 Min wird als Suspend erkannt, die letzte Aktivität ist der Heartbeat davor
- [x] Der Korrektur-Hinweis nennt die letzte Aktivität
- [x] Tests für `decide`: Übernacht-Fall (`overnight-close`), danach normaler neuer Tag mit Stempel-Erinnerung ab Beginn der Kernzeit
- [ ] Das Verhalten des Overlap-Checks über Mitternacht ist geprüft und in der Spec bzw. im ADR dokumentiert
- [ ] Szenario „Deckel zu mit laufender Schicht, am nächsten Morgen auf“ manuell abgenommen

## Comments

**2026-09-22 (Agent):** Umgesetzt. Die Regeln stehen in spec.md unter „Letzte Aktivität und Übernacht-Fall“.
- `js/activity.mjs` enthält `heartbeat`, `setIdle` und `lastActivity`. Der Zustand kennt `lastSeen`, `idle` und `awaySince`, die den Tageswechsel überstehen. Der Service zählt den Heartbeat im 15-s-Takt und nutzt den `IdleMonitor` mit `shell.idleConfig.lock`.
- `status --overnight` prüft zusätzlich 23:57–23:59 des Vortags. Eine heute laufende Schicht gilt nur dann als die vom Vortag, wenn sie schon um 00:00 lief. Der Übernacht-Abschluss (`overnight-close`) stempelt aus, ohne Feierabend, und schickt den Korrektur-Hinweis mit der letzten Aktivität vom Vortag.
- Noch offen: Ob Calamari eine Schicht über Mitternacht für „heute“ zählt, zeigt erst die Abnahme über Nacht. Beide Fälle sind abgedeckt.
