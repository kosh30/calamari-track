# 03: Status über REST, mit Pause

**What to build:** Der Schichtstatus kommt über REST `shift/status/get-current` und kennt drei Werte: läuft, gestoppt, Pause (ADR 0003). Eine Pause, die im Web oder auf dem Handy begonnen wurde, zeigt die Bar als Pause und das Panel mit „Pause beenden“. Wann eine fremde Pause begann, weiß das Plugin nicht; die Pausen-Erinnerung zählt bis Phase 2 ab dem ersten Mal, dass das Plugin die Pause gesehen hat. Eine Pause ist eine Unterbrechung innerhalb einer laufenden Schicht (CONTEXT.md): Die Startzeit der Schicht bleibt erhalten, und es entsteht kein Feierabend. Startzeit- und Endzeit-Suche sowie der Tagesende-Check bleiben beim MCP.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] `status` liefert einen von drei Werten statt `running: bool`
- [ ] Der lokale Zustand unterscheidet „Schicht läuft“ und „Schicht läuft, Pause“; eine Pause beendet die Schicht nicht
- [ ] Eine fremde Pause erscheint in Bar und Panel; die Pausen-Erinnerung zählt ab dem ersten Sehen
- [ ] Die Korrekturen für das Overlap-Fenster (Nachlauf nach dem eigenen Ausstempeln, Minute des Einstempelns) gelten nur noch, wo der Status noch vom Overlap kommt, oder fallen weg
- [ ] Stempel-Erinnerung, sanfter Hinweis und Gesamtzeit heute verhalten sich in einer Pause wie bisher
- [ ] Tests für die Zustandsübergänge mit Pause, auch nach Tageswechsel und Neustart
- [ ] Mit dem Benutzer abgenommen: Pause im Web begonnen, die Bar zeigt sie; im Web beendet, die Bar zeigt wieder die laufende Schicht
