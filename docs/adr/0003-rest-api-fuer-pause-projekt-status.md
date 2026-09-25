# REST-API mit Firmen-Key für Pause, Projekt und Status, als Brücke bis zum MCP-Update

Seit 2026-09-24 haben wir einen API-Key für `https://<firma>.calamari.io/api`. Ab jetzt nutzt der Helper die REST-API für drei Dinge, die der MCP-Server nicht kann: echte Pausen (`break-start` und `break-stop`), das Standard-Projekt beim Einstempeln (`clock-in` mit `projectId`) und den Schichtstatus (`shift/status/get-current`, der auch `BREAK` meldet). Alles andere bleibt beim MCP-Server mit Benutzer-OAuth (ADR 0001). Wir nehmen dafür in Kauf, was ADR 0001 vermeiden wollte: Der Key gilt immer für die ganze Firma und kann Zeiten aller Mitarbeiter ändern. Calamari kann ihn nicht auf eine Person beschränken, nur auf Gruppen von Endpunkten. Die Alternative wäre gewesen, auf das für Oktober 2026 erwartete MCP-Update zu warten und bis dahin weiter mit Pausen als Lücken und Stempelungen „Ohne Projekt“ zu leben.

## Consequences

- REST bleibt hinter den Befehlen von `bin/calamari`. Das Plugin weiß nicht, welcher Weg eine Antwort liefert. Kann der MCP-Server Pausen, Projekt und Status, wechselt nur der Helper zurück, und der Key kann weg.
- Die Adresse der REST-API gehört zur Firma (`https://<firma>.calamari.io/api`) und ist die Einstellung `apiUrl` ohne Vorgabe. Fehlt sie, antworten die REST-Befehle mit `API_URL_REQUIRED`.
- Der Key liegt im Keyring (`bin/calamari api-key` liest ihn von stdin), nie in `shell.json` oder den Einstellungen. Er braucht nur die Gruppen Terminal, Schichtstatus und Projekte. Der Helper stempelt nur für die eigene E-Mail.
- In Clockin muss ein „API Terminal“ eingerichtet sein, auf das der Benutzer Zugriff hat, sonst antworten Stempeln und Pausen mit `API_TERMINAL_NOT_AVAILABLE`.
- Schlägt REST fehl, stempelt das Plugin nicht per MCP ohne Projekt nach. Es zeigt den Fehler wie jede fehlgeschlagene Stempelung.
- Die REST-Stempelungen nehmen eine Uhrzeit. In Phase 1 nutzt das nur das Ausstempeln aus einer Pause (Feierabend statt Pause, Auto-Abschluss während einer Pause): Die Schicht endet beim Pausenbeginn. Die übrigen Umwege aus ADR 0001 (Startzeit- und Endzeit-Suche, `day-end`, Auto-Abschluss nur „jetzt“) ersetzen wir erst in Phase 2.
- Die Terminal-Endpunkte nehmen die Uhrzeit nur als lokale Zeit ohne Zeitzone und ohne Millisekunden (`2026-09-24T11:24:53`); mit `Z` oder Offset antworten sie „Incorrect value“ (ausprobiert 2026-09-24).
- Der Key darf auch `timesheetentries/v1/find` lesen. `status` holt daraus den Beginn der laufenden Schicht und ihrer offenen Pause; mehr nutzt das Plugin davon in Phase 1 nicht.
- Das Rate-Limit liegt bei 720 Anfragen pro Stunde und 2880 pro Tag (Stand 2026-09-24).
