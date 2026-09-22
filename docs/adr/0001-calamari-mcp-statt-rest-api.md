# Calamari über den MCP-Server mit Benutzer-OAuth statt über die REST-API

Das Plugin spricht ausschließlich mit dem offiziellen Calamari-MCP-Server (`https://gateway.eu-west-1.calamari.io/mcp-server/mcp`). Die Anmeldung läuft per OAuth (Dynamic Client Registration, Authorization Code + PKCE, Refresh Token) mit dem eigenen Microsoft-SSO-Login. Die dokumentierte REST-API scheidet aus: Sie braucht einen firmenweiten Admin-API-Key, der Zeiten aller Mitarbeiter ändern kann, und den haben wir nicht. Inoffizielle Web-Endpoints kommen nicht in Frage, weil sie unsupported sind und mit SSO schwer zu automatisieren.

## Consequences

Der MCP-Server bietet (Stand 2026-09-22) weniger als die REST-API. Daraus folgen bewusste Abweichungen, die man im Code nicht „reparieren“ sollte:

- **Der Status wird über `checkTimesheetOverlap` ermittelt.** Ein Tool „läuft eine Schicht?“ gibt es nicht. Eine laufende Schicht zählt dort aber bis „jetzt“, deshalb bedeutet „Überschneidung mit den letzten ~2 Minuten“ eine laufende Schicht. Das ist undokumentiertes Verhalten und kann ohne Ankündigung brechen.
- **Pausen sind Aus- und Wiedereinstempeln.** Tools für Pausen gibt es nicht. Dass es eine Pause und kein Feierabend ist, weiß nur das Plugin selbst.
- **Der Auto-Abschluss stempelt zum Abschlusszeitpunkt aus.** `clockOut` nimmt keine Uhrzeit an. Der Benutzer bekommt die letzte Aktivität genannt und korrigiert die Endzeit selbst im Web.
- `createTimesheetEntries` (nachträgliches Eintragen) wurde als Hauptweg verworfen. Tagsüber sähe man in Calamari keinen Live-Status, beim Stempeln per Handy oder Web entstünden Duplikate, und Einträge könnten eine Manager-Genehmigung brauchen.

Sobald der MCP-Server Status-, Pausen- oder Zeitparameter nachliefert, sollten diese Umwege ersetzt werden.

Der Stand der Tools vom 2026-09-22 liegt in `docs/mcp-tools.json`: 17 Tools, keins davon kennt Pausen, `clockIn` und `clockOut` nehmen keine Argumente, und kein Tool liest Timesheet-Einträge. Ob Calamari etwas geändert hat, zeigt:

```
diff <(bin/calamari tools | python3 -m json.tool --sort-keys --no-ensure-ascii) docs/mcp-tools.json
```
