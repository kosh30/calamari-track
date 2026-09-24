# 05: Ausstempeln aus der Pause

**What to build:** Wer aus einer Pause nach Hause geht, beendet die Schicht beim Pausenbeginn. „Feierabend statt Pause“ im Panel stempelt über REST `clock-out` mit der Uhrzeit des Pausenbeginns aus. Letzte Warnung und Auto-Abschluss gelten jetzt auch während einer Pause: Eine Pause, die bis zum Abend offen ist, ist ein vergessener Feierabend. Der Auto-Abschluss stempelt dann ebenfalls auf den Pausenbeginn aus, und der Korrektur-Hinweis entfällt, weil die Endzeit schon stimmt. Das normale Ausstempeln aus einer laufenden Schicht bleibt beim MCP (Phase 2).

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Vor der Umsetzung, mit ausdrücklichem Okay des Benutzers: einmal an einem echten Eintrag prüfen, wie Calamari ein `clock-out` mit offener Pause und einer Uhrzeit in der Vergangenheit behandelt (bleibt die Pause, braucht es vorher `break-stop`, wie weit zurück darf die Uhrzeit liegen). Ergebnis unter `## Comments` festhalten
- [ ] „Feierabend statt Pause“ stempelt auf den Pausenbeginn aus; danach ist Feierabend
- [ ] Letzte Warnung, „+1 h weiterarbeiten“ und Auto-Abschluss gelten auch in einer Pause
- [ ] Der Auto-Abschluss aus einer Pause stempelt auf den Pausenbeginn aus und schickt keinen Korrektur-Hinweis
- [ ] Bei einer fremden Pause ohne bekannten Beginn (Ticket 03) stempelt das Plugin „jetzt“ aus und schickt den Korrektur-Hinweis wie bisher
- [ ] Tests für `decide` in der Pause am Abend und für die Uhrzeit des Ausstempelns
- [ ] Mit dem Benutzer abgenommen, mit verkürzten Zeiten für Warnung und Auto-Abschluss
