# 03: Status über REST, mit Pause

**What to build:** Der Schichtstatus kommt über REST `shift/status/get-current` und kennt drei Werte: läuft, gestoppt, Pause (ADR 0003). Eine Pause, die im Web oder auf dem Handy begonnen wurde, zeigt die Bar als Pause und das Panel mit „Pause beenden“. Wann eine fremde Pause begann, weiß das Plugin nicht; die Pausen-Erinnerung zählt bis Phase 2 ab dem ersten Mal, dass das Plugin die Pause gesehen hat. Eine Pause ist eine Unterbrechung innerhalb einer laufenden Schicht (CONTEXT.md): Die Startzeit der Schicht bleibt erhalten, und es entsteht kein Feierabend. Startzeit- und Endzeit-Suche sowie der Tagesende-Check bleiben beim MCP.

**Blocked by:** 01

**Status:** ready-for-agent

- [x] `status` liefert einen von drei Werten statt `running: bool`
- [x] Der lokale Zustand unterscheidet „Schicht läuft“ und „Schicht läuft, Pause“; eine Pause beendet die Schicht nicht
- [x] Eine fremde Pause erscheint in Bar und Panel; die Pausen-Erinnerung zählt ab dem ersten Sehen
- [x] Die Korrekturen für das Overlap-Fenster (Nachlauf nach dem eigenen Ausstempeln, Minute des Einstempelns) gelten nur noch, wo der Status noch vom Overlap kommt, oder fallen weg
- [x] Stempel-Erinnerung, sanfter Hinweis und Gesamtzeit heute verhalten sich in einer Pause wie bisher
- [x] Tests für die Zustandsübergänge mit Pause, auch nach Tageswechsel und Neustart
- [ ] Mit dem Benutzer abgenommen: Pause im Web begonnen, die Bar zeigt sie; im Web beendet, die Bar zeigt wieder die laufende Schicht

## Comments

**2026-09-24 (Agent):** Umgesetzt, die Abnahme mit dem Benutzer steht noch aus.
- `bin/calamari status` fragt REST `shift/status/v1/get-current` und liefert `{"shift": "running" | "break" | "stopped"}`. Er braucht den API-Key; `AUTH_REQUIRED` (MCP-Login abgelaufen) zeigt sich nicht mehr beim Abfragen, sondern erst bei Startzeit-/Endzeit-Suche, Tagesende-Check oder Ausstempeln.
- Zustand: `running` gilt auch in einer Pause; neu `onBreak` (Calamari meldet BREAK), `breakStartUnknown` (breakSince ist nur das erste Sehen) und `breakMinutes` (beendete Pausen in laufenden Schichten, zählen nicht zur Gesamtzeit). Panel und Pausen-Erinnerung sagen bei einer fremden Pause „seit spätestens HH:MM“.
- Overlap-Korrekturen im Status (Nachlauf nach dem Ausstempeln, Minute des Einstempelns) und `stoppedAt` sind weg. `searchAfter` nach „stopped“ ist die Minute nach der Abfrage.
- In einer fremden Pause gibt es wie in der eigenen nur die Pausen-Erinnerung: keine Stempel-Erinnerung, kein sanfter Hinweis, und bis Ticket 05 auch keine letzte Warnung und keinen Auto-Abschluss. „Feierabend“ ohne Stempeln wird dort nicht angeboten (Ticket 05).
- Offen bis Ticket 04: „Pause beenden“ ist noch ein REST-Einstempeln. Ob Calamari damit eine Pause beendet, ist nicht geprüft. Meldet die nächste Abfrage weiter BREAK, zählt die Pause ab ihrem ersten Sehen weiter.
- Abnahme: `omarchy-restart-shell`, Pause im Web beginnen, Panel öffnen (fragt sofort ab): Bar zeigt Pause; im Web beenden, Panel öffnen: laufende Schicht mit der alten Startzeit.
