# 02: Einstempeln mit Standard-Projekt

**What to build:** Eigene Einstempelungen bekommen das Standard-Projekt statt „Ohne Projekt“. „Einstempeln“ im Panel (und bis Ticket 04 auch „Pause beenden“, das heute ein Einstempeln ist) läuft über REST `clock-in` mit der Uhrzeit „jetzt“ und der `projectId` des Standard-Projekts. Das Standard-Projekt ist eine Widget-Einstellung mit Vorgabe „Check-in“, als Name; der Helper löst ihn in die Id auf. Schlägt REST fehl, zeigt das Panel eine verständliche Ursache („API Terminal fehlt“, „keine Berechtigung“, „zu viele Anfragen“) und es wird nichts nachgereicht, auch kein Einstempeln per MCP ohne Projekt. Status und Ausstempeln bleiben in diesem Ticket beim MCP.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Einstempeln geht über REST `clock-in` mit dem aufgelösten Standard-Projekt
- [ ] Die Einstellung „Standard-Projekt“ (Vorgabe „Check-in“) ist im Einstellungsformular änderbar
- [ ] Ein unbekannter Projektname ist ein eigener Fehler mit dem Namen im Text, kein Einstempeln ohne Projekt
- [ ] Kein Rückfall auf MCP `clockIn`
- [ ] Die Antwort `shiftStatus` ersetzt die bisherige Nachprüfung nach dem Einstempeln
- [ ] Tests für die Auflösung des Projekts und die Fehlertexte
- [ ] Mit dem Benutzer abgenommen: Die neue Schicht steht in Calamari mit Projekt „Check-in“
