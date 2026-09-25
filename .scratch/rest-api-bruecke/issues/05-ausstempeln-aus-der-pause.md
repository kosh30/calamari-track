# 05: Ausstempeln aus der Pause

**What to build:** Wer aus einer Pause nach Hause geht, beendet die Schicht beim Pausenbeginn. „Feierabend statt Pause“ im Panel stempelt über REST `clock-out` mit der Uhrzeit des Pausenbeginns aus. Letzte Warnung und Auto-Abschluss gelten jetzt auch während einer Pause: Eine Pause, die bis zum Abend offen ist, ist ein vergessener Feierabend. Der Auto-Abschluss stempelt dann ebenfalls auf den Pausenbeginn aus, und der Korrektur-Hinweis entfällt, weil die Endzeit schon stimmt. Das normale Ausstempeln aus einer laufenden Schicht bleibt beim MCP (Phase 2).

**Blocked by:** 04

**Status:** umgezogen nach [#6](https://github.com/kosh30/calamari-track/issues/6) (2026-09-25); der aktuelle Stand steht dort, diese Datei ist Archiv.

- [x] Vor der Umsetzung, mit ausdrücklichem Okay des Benutzers: einmal an einem echten Eintrag prüfen, wie Calamari ein `clock-out` mit offener Pause und einer Uhrzeit in der Vergangenheit behandelt (bleibt die Pause, braucht es vorher `break-stop`, wie weit zurück darf die Uhrzeit liegen). Ergebnis unter `## Comments` festhalten
- [x] „Feierabend statt Pause“ stempelt auf den Pausenbeginn aus; danach ist Feierabend
- [x] Letzte Warnung, „+1 h weiterarbeiten“ und Auto-Abschluss gelten auch in einer Pause
- [x] Der Auto-Abschluss aus einer Pause stempelt auf den Pausenbeginn aus und schickt keinen Korrektur-Hinweis
- [x] Bei einer fremden Pause ohne bekannten Beginn (Ticket 03) stempelt das Plugin „jetzt“ aus und schickt den Korrektur-Hinweis wie bisher
- [x] Tests für `decide` in der Pause am Abend und für die Uhrzeit des Ausstempelns
- [ ] Mit dem Benutzer abgenommen, mit verkürzten Zeiten für Warnung und Auto-Abschluss

## Comments

**2026-09-24 (Agent):** Test mit ausdrücklichem Okay des Benutzers an seiner laufenden Schicht (seit 11:24, Projekt „Check-in“):
- 17:32:17 REST `break-start` → `STARTED`. 17:35:35 REST `clock-out` mit `time` = `2026-09-24T17:32:17` (3 Min zurück) → `shiftStatus: FINISHED`.
- `timesheetentries/find` danach: `finished` = 17:32:17. Die offene Pause wurde mit dem Ausstempeln geschlossen, aber als Pause von 0 Sekunden (`from` = `to` = 17:32:17) im Eintrag gelassen. Die früheren Pausen blieben unverändert. `get-current` meldet `STOPPED`.
- Also: kein `break-stop` vorher nötig, eine Uhrzeit in der Vergangenheit geht (mindestens 3 Min; wie weit zurück, zeigt ein Versuch nicht). Die Null-Pause ist nur ein Schönheitsfehler.
- Danach per REST `clock-in` wieder eingestempelt (17:35, „Check-in“). Im Web stehen jetzt zwei Schichten, die der Benutzer bei Bedarf zusammenführt.

**2026-09-24 (Agent):** Umgesetzt, die Abnahme mit dem Benutzer steht noch aus.
- Neuer Helper-Befehl `clock-out-break`: fragt `get-current` (gestoppt: nichts senden, `stamped: false`), liest den sekundengenauen Beginn der offenen Pause aus `timesheetentries/find` und stempelt per REST `clock-out` genau dort aus. Ohne bekannten Beginn (Eintrag nicht lesbar, keine offene Pause) stempelt er „jetzt“ aus. Antwort `{running, stamped, endedAt, atBreakStart}`; ein `shiftStatus` außer `FINISHED` ist ein Fehler.
- Panel: in einer Pause der Button „Feierabend“. Danach ist Feierabend seit dem Pausenbeginn; die Pause zählt nicht zur Gesamtzeit.
- In einer Pause gelten letzte Warnung, „+1 h“ und Auto-Abschluss wie in der Schicht, dazu weiter die Pausen-Erinnerung; kein sanfter Hinweis. Die letzte Warnung sagt dort „oder Feierabend“.
- Der Auto-Abschluss aus einer Pause nutzt `clock-out-break`. Mit bekanntem Pausenbeginn geht kein Korrektur-Hinweis raus (auch sonst keine Benachrichtigung; bei der Abnahme klären, ob eine Info gewünscht ist). Ohne bekannten Beginn: jetzt ausstempeln, Korrektur-Hinweis wie bisher.
- Das normale Ausstempeln aus einer laufenden Schicht bleibt beim MCP.
- Abnahme mit verkürzten Zeiten: in den Einstellungen „Uhrzeit der letzten Warnung“ auf ein paar Minuten nach jetzt und „Auto-Abschluss nach der letzten Warnung“ auf 2 Minuten, `omarchy-restart-shell`, im Panel „Pause beginnen“, abwarten. Erwartet: letzte Warnung, dann Auto-Abschluss; in Calamari endet die Schicht beim Pausenbeginn; kein Korrektur-Hinweis. Danach die Einstellungen zurücksetzen.
