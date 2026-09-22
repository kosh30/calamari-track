# 08: Sanfter Hinweis, letzte Warnung und Auto-Abschluss

**What to build:** Läuft 30 Minuten nach Ende der Kernzeit noch eine Schicht, kommt einmalig der sanfte Hinweis. Läuft zur Uhrzeit der letzten Warnung (Standard 19:00) noch eine Schicht, kommt die letzte Warnung. Ein Klick darauf öffnet das Panel mit einem Countdown bis zum Auto-Abschluss und den Buttons „+1 h weiterarbeiten“ (verschiebt letzte Warnung und Auto-Abschluss) und „Jetzt ausstempeln“. Ohne Reaktion folgt nach 15 Minuten der Auto-Abschluss, spätestens aber zur Obergrenze (Standard 23:00), auch bei Verschiebungen. Der Auto-Abschluss stempelt „jetzt“ aus und schickt einen Korrektur-Hinweis („Schicht um HH:MM automatisch beendet, bitte Endzeit in Calamari korrigieren“). Ein Klick darauf öffnet Calamari im Browser. Die letzte Warnung und der Auto-Abschluss gelten auch am Wochenende und an freien Tagen. Die letzte Aktivität wird hier nur angezeigt, falls sie schon bekannt ist (siehe 09).

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] Tests für `decide`: sanfter Hinweis genau einmal, letzte Warnung zur konfigurierten Uhrzeit, Auto-Abschluss nach der Wartezeit, „+1 h“ verschiebt beides, Obergrenze gewinnt, Wochenende mit laufender Schicht, kein Hinweis nach dem Feierabend
- [ ] Das Panel zeigt nach der letzten Warnung einen Countdown und beide Buttons
- [ ] „+1 h“ wird im lokalen Zustand gespeichert und übersteht einen Neustart
- [ ] Der Auto-Abschluss stempelt aus und verschickt den Korrektur-Hinweis, ein Klick öffnet Calamari
- [ ] Uhrzeit der letzten Warnung, Versatz des sanften Hinweises, Wartezeit, Dauer von „+1 h“ und Obergrenze sind konfigurierbar
- [ ] Der ganze Ablauf ist mit verkürzten Zeiten einmal manuell mit dem Benutzer gegen echtes Calamari abgenommen
