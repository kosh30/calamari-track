# 09: Letzte Aktivität und Übernacht-Abschluss

**What to build:** Das Plugin merkt sich die letzte Aktivität des Benutzers. Das ist der Beginn des Leerlaufs (Idle-Monitor von Quickshell mit dem Lock-Timeout aus der omarchy-shell-Idle-Config) oder, bei einem Suspend, der letzte minütliche Heartbeat vor einer Lücke von mehr als 5 Minuten. Der Korrektur-Hinweis nach einem Auto-Abschluss nennt diese letzte Aktivität als empfohlene Endzeit. Läuft beim Aufwachen oder Start des Rechners noch eine Schicht vom Vortag, führt das Plugin sofort einen Übernacht-Abschluss durch: Ausstempeln jetzt und Korrektur-Hinweis mit der letzten Aktivität vom Vortag. Danach beginnt der neue Tag normal. In diesem Ticket wird geprüft, ob eine über Mitternacht laufende Schicht im Overlap-Check für „heute“ erscheint. Falls nicht, wird zusätzlich der Vortag geprüft.

**Blocked by:** 08

**Status:** ready-for-agent

- [ ] Letzte Aktivität und Heartbeat werden im lokalen Zustand gespeichert
- [ ] Eine Heartbeat-Lücke über 5 Min wird als Suspend erkannt, die letzte Aktivität ist der Heartbeat davor
- [ ] Der Korrektur-Hinweis nennt die letzte Aktivität
- [ ] Tests für `decide`: Übernacht-Fall (`overnight-close`), danach normaler neuer Tag mit Stempel-Erinnerung ab Beginn der Kernzeit
- [ ] Das Verhalten des Overlap-Checks über Mitternacht ist geprüft und in der Spec bzw. im ADR dokumentiert
- [ ] Szenario „Deckel zu mit laufender Schicht, am nächsten Morgen auf“ manuell abgenommen
