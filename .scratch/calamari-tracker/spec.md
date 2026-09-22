# Spec: Calamari Tracker (Omarchy-Shell-Plugin)

Status: ready-for-agent

Siehe auch: `CONTEXT.md` (Glossar), `docs/adr/0001-calamari-mcp-statt-rest-api.md`, `docs/PLAN.md` (Reihenfolge der Scheiben).

## Problem Statement

Ich erfasse meine Arbeitszeit in Calamari (Modul Clockin), vergesse aber regelmäßig das Einstempeln am Morgen oder das Ausstempeln am Abend. Dann muss ich Einträge im Web nachtragen oder korrigieren, und bis dahin stimmen meine Zeiten nicht. Um zu stempeln, muss ich jedes Mal die Web-App oder das Handy öffnen, und nichts erinnert mich, wenn während der Kernzeit keine Schicht läuft oder abends noch eine. Einen Admin-API-Key habe ich nicht, und die Anmeldung läuft über Microsoft-SSO.

## Solution

Ein Omarchy-Shell-Plugin mit einem Bar-Widget, das jederzeit zeigt, ob eine Schicht läuft und wie lange schon. Ein Klick öffnet ein Panel, in dem ich einstempeln, ausstempeln oder eine Pause beginnen kann. Das Plugin kennt meinen Arbeitsplan, meine Feiertage und Abwesenheiten aus Calamari:
- Es erinnert mich an Arbeitstagen während der Kernzeit ans Einstempeln.
- Es erinnert mich an zu lange Pausen.
- Es weist mich nach der Kernzeit auf eine noch laufende Schicht hin.
- Zur konfigurierbaren Uhrzeit der letzten Warnung (Standard 19:00) warnt es ein letztes Mal. Reagiere ich nicht, führt es den Auto-Abschluss durch und fordert mich auf, die Endzeit in Calamari auf meine letzte Aktivität zu korrigieren.

Mit Calamari spricht das Plugin ausschließlich über den offiziellen MCP-Server und meinen eigenen OAuth-Login.

## User Stories

### Anmeldung und Verbindung

1. Als Benutzer möchte ich mich einmalig per Microsoft-SSO im Browser bei Calamari anmelden, damit das Plugin in meinem Namen stempeln kann, ohne dass ich einen Admin-API-Key brauche.
2. Als Benutzer möchte ich, dass meine Zugangsdaten im System-Keyring gespeichert werden, damit keine Tokens im Klartext auf der Platte oder im Repo liegen.
3. Als Benutzer möchte ich, dass abgelaufene Tokens automatisch erneuert werden, damit ich mich nicht täglich neu anmelden muss.
4. Als Benutzer möchte ich einen klaren Hinweis in Bar und Panel, wenn eine neue Anmeldung nötig ist, damit ich nicht glaube, dass das Tracking läuft, obwohl es nicht läuft.
5. Als Benutzer möchte ich im Panel einen Button „Neu anmelden“, damit ich die Verbindung ohne Terminal wiederherstellen kann.
6. Als Benutzer möchte ich, dass das Plugin nur mit meinen eigenen Rechten arbeitet, damit es keine Zeiten anderer Mitarbeiter ändern kann.

### Status

7. Als Benutzer möchte ich in der Bar auf einen Blick sehen, ob gerade eine Schicht läuft, damit ich nicht Calamari öffnen muss.
8. Als Benutzer möchte ich in der Bar die Dauer der laufenden Schicht sehen (z.B. `3:42`), damit ich meine Arbeitszeit im Blick habe.
9. Als Benutzer möchte ich, dass die Bar auch eine per Web oder Handy begonnene Schicht erkennt, damit Calamari die einzige Quelle der Wahrheit bleibt.
10. Als Benutzer möchte ich, dass die Bar den Status farblich unterscheidet (keine Schicht, Schicht läuft, Pause, Stempel-Erinnerung aktiv, Fehler), damit ich den Zustand ohne Lesen erkenne.
11. Als Benutzer möchte ich, dass die Dauer in der Bar zwischen zwei Abfragen lokal weitertickt, damit sie aktuell wirkt, ohne Calamari ständig abzufragen.
12. Als Benutzer möchte ich, dass der Status beim Öffnen des Panels sofort aktualisiert wird, damit ich beim Handeln den echten Stand sehe.
13. Als Benutzer möchte ich im Panel die Gesamtzeit von heute sehen, damit ich weiß, wie viel ich heute schon gearbeitet habe (soweit das mit vertretbar vielen Abfragen ermittelbar ist).

### Stempeln

14. Als Benutzer möchte ich per Klick im Panel einstempeln, damit ich morgens keine Web-App öffnen muss.
15. Als Benutzer möchte ich per Klick im Panel ausstempeln, damit ich meinen Feierabend in einer Sekunde erfasse.
16. Als Benutzer möchte ich, dass Ausstempeln den Feierabend bedeutet und danach an diesem Tag keine Stempel-Erinnerungen mehr kommen, damit ich nach einem frühen Feierabend nicht genervt werde.
17. Als Benutzer möchte ich nach dem Feierabend trotzdem wieder einstempeln können, damit ich spontanes Weiterarbeiten erfassen kann. Danach gelten wieder alle Regeln.
18. Als Benutzer möchte ich nach jeder Stempel-Aktion sofort den neuen Status sehen, damit ich weiß, dass sie in Calamari angekommen ist.
19. Als Benutzer möchte ich eine deutliche Fehlermeldung, wenn eine Stempel-Aktion fehlschlägt (kein Netz, Anmeldung nötig, Rate-Limit), damit ich es erneut versuchen oder im Web stempeln kann.

### Pause

20. Als Benutzer möchte ich einen Pause-Button, der nur bei laufender Schicht erscheint, damit ich Pausen erfassen kann, ohne dass sie als Feierabend gelten.
21. Als Benutzer möchte ich die Pause per Klick beenden, damit die Schicht weiterläuft (in Calamari beginnt eine neue Schicht).
22. Als Benutzer möchte ich nach 30 Minuten Pause eine Pausen-Erinnerung und danach alle 5 Minuten eine weitere, damit ich nicht vergesse, nach der Pause wieder einzustempeln.
23. Als Benutzer möchte ich, dass die Pause einen Neustart der Shell oder des Rechners übersteht, damit eine Pause nach einem Neustart nicht plötzlich als Feierabend gilt.
24. Als Benutzer möchte ich in Bar und Panel sehen, dass ich in Pause bin und seit wann, damit ich die Pausendauer im Blick habe.

### Arbeitstag, Kernzeit, freier Tag

25. Als Benutzer möchte ich, dass Arbeitstage und Kernzeit aus meinem Arbeitsplan in Calamari kommen, damit ich nichts doppelt pflegen muss.
26. Als Benutzer möchte ich Arbeitsplan und Kernzeit lokal überschreiben können, damit ich Abweichungen abbilden kann, die Calamari nicht kennt.
27. Als Benutzer möchte ich an Feiertagen aus meinem Calamari-Feiertagskalender keine Stempel-Erinnerungen, damit ich an freien Tagen Ruhe habe.
28. Als Benutzer möchte ich, dass ein halber Feiertag (z.B. 24.12. nachmittags) die Kernzeit verkürzt, damit ich nicht am Nachmittag erinnert werde.
29. Als Benutzer möchte ich, dass Abwesenheiten aus Calamari (Urlaub, Krankheit) einen freien Tag ergeben, damit ich im Urlaub keine Erinnerungen bekomme.
30. Als Benutzer möchte ich im Panel einen Schalter „Heute frei“, damit ich Erinnerungen auch an Tagen abschalten kann, die Calamari nicht als frei kennt.
31. Als Benutzer möchte ich, dass „Heute frei“ am nächsten Tag automatisch zurückgesetzt wird, damit ich das Wiedereinschalten nicht vergesse.

### Erinnerungen

32. Als Benutzer möchte ich an einem Arbeitstag, sobald die Kernzeit begonnen hat und ich noch nicht eingestempelt habe, sofort eine Stempel-Erinnerung, damit ich das Einstempeln nicht vergesse.
33. Als Benutzer möchte ich, dass sich die Stempel-Erinnerung alle 5 Minuten wiederholt, bis ich einstempele oder die Kernzeit endet, damit ich sie nicht übersehe.
34. Als Benutzer möchte ich, dass wiederholte Erinnerungen die vorige Benachrichtigung ersetzen statt sich zu stapeln, damit mein Benachrichtigungscenter nicht vollläuft.
35. Als Benutzer möchte ich, dass das Bar-Icon rot ist, solange eine Stempel-Erinnerung fällig ist, damit ich den Zustand auch ohne Benachrichtigung sehe.
36. Als Benutzer möchte ich einen einmaligen sanften Hinweis 30 Minuten nach Ende der Kernzeit, wenn noch eine Schicht läuft, damit ich an den Feierabend denke.
37. Als Benutzer möchte ich, dass ein Klick auf eine Erinnerung das Panel öffnet, damit ich sofort handeln kann.
38. Als Benutzer möchte ich, dass beim Hochfahren oder Aufwachen mitten in der Kernzeit sofort eine Stempel-Erinnerung kommt, wenn ich noch nicht eingestempelt habe, damit späte Starts nicht durchrutschen.
39. Als Benutzer möchte ich am Wochenende oder an freien Tagen keine Stempel-Erinnerungen, aber trotzdem letzte Warnung und Auto-Abschluss, falls dort eine Schicht läuft, damit auch Wochenendarbeit nicht offen bleibt.

### Letzte Warnung und Auto-Abschluss

40. Als Benutzer möchte ich zur konfigurierbaren Uhrzeit der letzten Warnung (Standard 19:00) eine Benachrichtigung, wenn noch eine Schicht läuft, damit eine vergessene Schicht nicht bis in die Nacht läuft.
41. Als Benutzer möchte ich nach einem Klick auf die letzte Warnung im Panel einen Countdown bis zum Auto-Abschluss sehen, damit ich weiß, wie viel Zeit mir bleibt.
42. Als Benutzer möchte ich im Panel „+1 h weiterarbeiten“ wählen können, damit ich an langen Tagen nicht ausgestempelt werde. Danach kommt eine neue letzte Warnung.
43. Als Benutzer möchte ich im Panel „Jetzt ausstempeln“ wählen können, damit ich die Warnung direkt erledigen kann.
44. Als Benutzer möchte ich, dass das Plugin ohne Reaktion 15 Minuten nach der letzten Warnung den Auto-Abschluss durchführt, damit keine Schicht offen bleibt, wenn ich nicht mehr am Rechner bin.
45. Als Benutzer möchte ich eine harte Obergrenze (Standard 23:00), zu der der Auto-Abschluss trotz „+1 h“ erfolgt, damit keine Schicht über Mitternacht läuft.
46. Als Benutzer möchte ich nach einem Auto-Abschluss eine Benachrichtigung mit der Uhrzeit des Abschlusses und meiner letzten Aktivität, damit ich die Endzeit in Calamari korrigieren kann.
47. Als Benutzer möchte ich, dass ein Klick auf diese Benachrichtigung Calamari im Browser öffnet, damit die Korrektur schnell geht.

### Letzte Aktivität und Übernacht-Fall

48. Als Benutzer möchte ich, dass das Plugin sich meine letzte Aktivität merkt (Beginn des Leerlaufs mit dem gleichen Timeout wie die Bildschirmsperre, oder der letzte Heartbeat vor einem Suspend), damit der Korrektur-Hinweis eine realistische Endzeit nennt.
49. Als Benutzer möchte ich, dass beim Aufwachen oder Start des Rechners eine noch laufende Schicht vom Vortag erkannt und sofort per Auto-Abschluss beendet wird, damit ich nicht mit einer 14-Stunden-Schicht in den Tag starte.
50. Als Benutzer möchte ich nach einem solchen Übernacht-Abschluss den Hinweis „bitte Endzeit auf HH:MM korrigieren“ mit meiner letzten Aktivität vom Vortag, damit ich den Eintrag schnell richtigstelle.
51. Als Benutzer möchte ich, dass nach einem Übernacht-Abschluss der neue Tag normal beginnt und die Stempel-Erinnerungen ab Beginn der Kernzeit kommen, damit der alte Tag den neuen nicht blockiert.

### Konfiguration und Robustheit

52. Als Benutzer möchte ich alle Zeiten und Intervalle konfigurieren können (Abfrage-Intervall, Intervall der Stempel-Erinnerung, Pausen-Grenze, Versatz des sanften Hinweises, Uhrzeit der letzten Warnung, Wartezeit bis zum Auto-Abschluss, Dauer von „+1 h“, Obergrenze), damit ich das Plugin an meinen Alltag anpassen kann.
53. Als Benutzer möchte ich die Einstellungen über die normalen Bar-Widget-Einstellungen von omarchy-shell ändern, damit ich keine eigene Config-Datei suchen muss.
54. Als Benutzer möchte ich, dass das Plugin bei Netzproblemen oder Rate-Limits seltener abfragt, damit es Calamari nicht überlastet und keine Sperre auslöst.
55. Als Benutzer möchte ich, dass ein Fehler bei Calamari den Status in der Bar sichtbar als „unbekannt/Fehler“ markiert, statt einen veralteten Status anzuzeigen, damit ich mich nicht auf falsche Daten verlasse.
56. Als Benutzer möchte ich, dass keine Aktion heimlich in einer Warteschlange landet und später nachgereicht wird, damit in Calamari keine überraschenden Zeiten entstehen.

### Installation und Weitergabe

57. Als Benutzer möchte ich das Plugin aus meinem Repo per Symlink installieren und beim Speichern hot-reloaden, damit ich schnell daran entwickeln kann.
58. Als Benutzer möchte ich, dass das Repo keine Secrets und keine firmenspezifischen Daten enthält, damit ich es später veröffentlichen kann.
59. Als anderer Omarchy-Benutzer möchte ich eine README mit Installation, Login und den bekannten Grenzen des MCP-Servers, damit ich das Plugin für meine Firma einrichten kann.

## Implementation Decisions

- **Zugriff:** Das Plugin nutzt ausschließlich den Calamari-MCP-Server (Streamable HTTP, JSON-RPC) und den OAuth-Login des Benutzers (siehe ADR 0001). REST-API mit Admin-Key und interne Web-Endpoints sind verworfen.
- **OAuth:** Discovery über die Protected-Resource-Metadaten des MCP-Servers, dann Dynamic Client Registration mit einer Loopback-Redirect-URI auf `127.0.0.1` mit freiem Port, Authorization Code + PKCE S256, `resource`-Parameter = MCP-URL, Scope `mcp`. Refresh Token für die automatische Erneuerung. Client-Daten und Tokens liegen im System-Keyring (Secret-Service über `secret-tool`).
- **Module:**
  - **Calamari-Helfer** (Python, nur Standardbibliothek, Kommandozeile): die einzige Komponente mit Netzwerkzugriff. Kapselt OAuth, MCP-Session (`initialize` → Session-ID → `notifications/initialized` → `tools/call`), Token-Refresh und die Übersetzung der MCP-Tools in fachliche Befehle.
  - **Erinnerungslogik** (reines JavaScript ohne Qt): entscheidet aus Zeitpunkt, Tagesinformation, lokalem Zustand und Config, was zu tun ist. Enthält auch die Kalenderregeln (Arbeitstag, Kernzeit, halber Feiertag, freier Tag, lokale Überschreibungen).
  - **Service** (QML, dünn): Timer, Heartbeat, Leerlauf-Erkennung, lokaler Zustand, Aufrufe des Helfers, Versand der Benachrichtigungen, IPC-Ziel zum Öffnen des Panels. Trifft keine fachlichen Entscheidungen.
  - **Bar-Widget + Panel** (QML): Darstellung und Buttons, nach dem Muster bestehender omarchy-shell-Plugins (Panel mit anhängendem Popup).
- **Vertrag des Helfers:** Unterbefehle `login`, `whoami`, `status`, `start-time [--after HH:MM]`, `worked-today` (optional, abhängig vom Aufwand), `clock-in`, `clock-out`, `day-info --date YYYY-MM-DD`. Die Ausgabe ist immer genau ein JSON-Objekt auf stdout. Bei Erfolg `{"ok": true, ...}`, bei Fehlern `{"ok": false, "error": {"code": ..., "message": ...}}` mit den Codes u.a. `AUTH_REQUIRED`, `NETWORK`, `RATE_LIMITED`, `MCP_ERROR`. Der Exit-Code ist ungleich 0 bei Fehlern.
- **Status über den Overlap-Check:** `status` fragt `checkTimesheetOverlap` für heute mit dem Fenster „jetzt − 2 Min … jetzt“ und `skipNotEligibleDays=false`. Eine Überschneidung bedeutet eine laufende Schicht. Das ist empirisch verifiziert (eine laufende Schicht zählt bis „jetzt“, nicht in die Zukunft), aber undokumentiert. Eine kurz zuvor beendete Schicht kann bis zu 2 Min als laufend erscheinen. Nach eigenen Aktionen kennt das Plugin den Status sofort.
- **Startzeit:** `start-time` ermittelt den Beginn der laufenden Schicht per Intervallhalbierung auf die Minute genau über denselben Overlap-Check. Gesucht wird die erste Minute x, ab der `[after, x]` überlappt. Die Schicht begann in Minute x − 1 (gegen eine echte Schicht verifiziert). Folgeschichten findet die Suche nur mit `--after`, also wenn das Plugin die Lücke davor beobachtet hat oder selbst die Pause markiert. Eine unbeobachtete Pause (Shell aus, Suspend) lässt sich mit Overlap-Abfragen nicht effizient finden, und die Dauer zählt dann ab der früheren Schicht. Das Ergebnis wird im lokalen Zustand gecacht und nur bei Statuswechsel neu ermittelt.
- **Letzte Warnung und Auto-Abschluss:**
  - Der Auto-Abschluss folgt die Wartezeit nach der tatsächlich verschickten letzten Warnung, spätestens zur Obergrenze. Wer den Rechner erst nach der Uhrzeit der letzten Warnung aufklappt, wird deshalb erst gewarnt und nicht sofort ausgestempelt.
  - „+1 h“ legt die nächste letzte Warnung eine Stunde nach dem Klick fest (`postponedTo`), der Auto-Abschluss folgt wieder die Wartezeit danach. Die letzte Warnung kommt spätestens eine Wartezeit vor der Obergrenze. Der Button erscheint nur, solange er den Auto-Abschluss noch verschiebt.
  - Eine Schicht, die erst nach der Uhrzeit der letzten Warnung beginnt, bekommt ihre Warnung erst vor der Obergrenze. Das Einstempeln zeigt, dass der Benutzer da ist, und das gilt auch für das Ende einer Pause. Eine Schicht, die erst nach der Obergrenze beginnt, wird bei ihrem Beginn gewarnt und nach der Wartezeit beendet.
  - Beginnt eine Schicht erst nach dem Zeitpunkt des sanften Hinweises, entfällt er.
  - Schlägt das Ausstempeln fehl, wird es alle 5 Min wiederholt. Das ist keine Warteschlange, sondern die fällige Aktion, solange die Schicht läuft.
  - Den sanften Hinweis gibt es nur an Tagen mit Kernzeit, letzte Warnung und Auto-Abschluss an jedem Tag.
  - Die Adresse von Calamari im Browser ist firmenspezifisch und steht deshalb nicht im Repo, sondern in der Einstellung `webUrl`. Ist sie leer, hat der Korrektur-Hinweis keine Klick-Aktion.
- **Pause:**
  - Eine Pause beginnt nur über den Pause-Button im Plugin (`breakSince` im Zustand). Ein Ausstempeln im Web bleibt eine Lücke ohne Pausen-Erinnerung.
  - Einstempeln, auch im Web oder per Handy, beendet die Pause.
  - Die Pausen-Erinnerung gilt an jedem Tag, auch an freien Tagen.
  - Wer aus der Pause direkt in den Feierabend geht, wählt im Panel „Feierabend“. Das stempelt nichts, weil die Schicht schon mit dem Beginn der Pause endete, und der Feierabend gilt ab dem Beginn der Pause.
  - Scheitert „Pause beginnen“ mit einem Fehler, obwohl Calamari ausgestempelt hat (z.B. Timeout), bleibt nur die Lücke. Es gibt dann keine Pausenmarkierung und keine Pausen-Erinnerung.
  - Eine Pause über Mitternacht geht mit dem Tageswechsel des Zustands verloren (siehe Übernacht-Fall, Ticket 09).
- **Freier Tag:**
  - Frei machen einen Tag ein ganzer Feiertag, eine ganztägige Abwesenheit der Kategorie `TIMEOFF` (Urlaub, Krankheit) und der Schalter „Heute frei“.
  - Eine Abwesenheit der Kategorie `WORK` (z.B. Dienstreise) und eine stundenweise Abwesenheit lassen den Tag bestehen.
  - Ein halber Feiertag teilt den Tag um 12:00: `PM` beendet die Kernzeit spätestens dann, `AM` lässt sie frühestens dann beginnen.
  - `day-info` wird einmal pro Datum abgefragt. Eine Abwesenheit, die erst im Laufe des Tages eingetragen wird, zählt deshalb erst ab dem nächsten Tag. Für heute hilft der Schalter.
- **Lokale Überschreibung:** Die Einstellungen `coreMonday` … `coreSunday` nehmen `HH:MM-HH:MM` (Kernzeit, auch an sonst arbeitsfreien Tagen), `frei` (arbeitsfrei) oder bleiben leer (Arbeitsplan aus Calamari). Unlesbare Werte werden ignoriert. Feiertage und Abwesenheiten gelten auch an überschriebenen Tagen.
- **„Noch gar nicht eingestempelt“:** Das Plugin merkt sich im lokalen Zustand (`stampedToday`), ob es heute eine laufende Schicht gesehen oder selbst eingestempelt hat. Eine Schicht, die ganz ohne laufendes Plugin begann und endete (z.B. 08:00–08:30 im Web, Shell erst ab 09:00), sieht es nicht und erinnert dann trotzdem. Eine Abfrage `[00:00, jetzt]` könnte das klären, wird aber erst bei Bedarf nachgerüstet.
- **Tagesinformation:** `day-info` kombiniert `getWorkPlan`, `getPublicHolidays` und `search` (Abwesenheiten, gefiltert auf die eigene `personUuid` aus `getMyProfile`) zu `{workingDay, coreStart, coreEnd, holiday: {name, halfDay, halfdayPeriod}|null, absence: {...}|null}`. Der Arbeitsplan wird einmal täglich abgefragt.
- **Stempeln:** `clockIn`/`clockOut` nehmen keine Uhrzeit an, es wird also immer „jetzt“ gestempelt. `clock-in` und `clock-out` liefern `{"running": bool}`:
  - `clock-in` fragt danach die laufende Minute ab (`[jetzt, jetzt+1]`). Das Status-Fenster endet an der vollen Minute und sieht die eben begonnene Schicht noch nicht. Scheitert nur diese Abfrage, gilt das angenommene `clockIn` trotzdem. Aus demselben Grund ignoriert der Service in der Minute des eigenen Einstempelns eine Abfrage, die „läuft nicht“ meldet.
  - `clock-out` fragt danach nicht ab, denn die eben beendete Schicht überlappt jedes Fenster bis „jetzt“. Maßgeblich ist, dass `clockOut` nicht abgelehnt wurde. Bis 2 Min nach dem eigenen Ausstempeln ignoriert der Service eine laufend gemeldete Schicht, und eine Folgeschicht sucht er erst ab der Minute nach dem Ausstempeln.
  - Der Feierabend entsteht nur durch Ausstempeln im Plugin. Ein Ausstempeln im Web ist von einer Pause nicht zu unterscheiden. Eine danach laufend gemeldete Schicht (Plugin, Web, Handy) hebt den Feierabend auf. Eine Pause ist Ausstempeln plus Markierung im lokalen Zustand. Das Ende der Pause ist Einstempeln. Einen Pausentyp gibt es nicht.
- **Auto-Abschluss:** stempelt zum Zeitpunkt des Abschlusses aus und schickt anschließend eine Benachrichtigung mit der letzten Aktivität zur manuellen Korrektur im Web. Zurückdatieren über `createTimesheetEntries` ist bewusst nicht vorgesehen.
- **Schnittstelle der Erinnerungslogik:** Eingabe ist Zeitpunkt, Tagesinformation (wie vom Helfer geliefert, plus lokale Überschreibungen), lokaler Zustand und Config. Ausgabe ist der Bar-Zustand (`idle` | `running` | `break` | `reminder` | `error`, dazu `auth` bei nötiger Anmeldung und `unknown` vor der ersten Abfrage), eine Liste fälliger Aktionen (`stamp-reminder`, `break-reminder`, `soft-hint`, `final-warning`, `auto-close`, `overnight-close`) und der Zeitpunkt der nächsten nötigen Prüfung. Die Logik ist idempotent: Bereits verschickte Erinnerungen stehen im Zustand und werden nicht doppelt ausgelöst.
- **Lokaler Zustand** (JSON-Datei unter XDG-State, atomar geschrieben):
  - Pausenmarkierung mit Beginn
  - Feierabend-Datum
  - „Heute frei“-Datum
  - verschickte Erinnerungen pro Tag
  - Verschiebung durch „+1 h“
  - letzte Aktivität
  - letzter Heartbeat
  - bekannte Startzeit und Datum der laufenden Schicht
- **Standardwerte der Config:**

  | Wert | Standard |
  |---|---|
  | Abfrage-Intervall | 3 Min |
  | Intervall der Stempel-Erinnerung | 5 Min |
  | Pausen-Grenze | 30 Min |
  | Wiederholung der Pausen-Erinnerung | 5 Min |
  | Versatz des sanften Hinweises | 30 Min nach Ende der Kernzeit |
  | Uhrzeit der letzten Warnung | 19:00 |
  | Wartezeit bis zum Auto-Abschluss | 15 Min |
  | Verschiebung durch „+1 h“ | 60 Min |
  | Obergrenze | 23:00 |
  | Überschreibungen für Arbeitsplan/Kernzeit | leer |

  Gepflegt werden die Werte über das Einstellungsschema des Bar-Widgets im Plugin-Manifest. Die installierte omarchy-shell zeigt dieses Schema noch nicht grafisch an. Bis dahin werden die Werte mit `omarchy bar set kosh.calamari-tracker <key> <wert> --json` gesetzt.
- **Benachrichtigungen:** Versand über den Sender von omarchy-shell mit ausgegebener ID. Eine Erinnerung ersetzt die vorige desselben Typs. Die Notifications haben keine Buttons, nur eine Klick-Aktion: Sie öffnet das Panel über IPC, beim Korrektur-Hinweis stattdessen Calamari im Browser.
- **Letzte Aktivität:** Leerlauf-Erkennung über den Idle-Monitor von Quickshell mit dem Lock-Timeout aus der omarchy-shell-Idle-Config, dazu ein minütlicher Heartbeat. Eine Heartbeat-Lücke über 5 Min gilt als Suspend, die letzte Aktivität ist dann der letzte Heartbeat davor.
- **Plugin-Identität:** ID `kosh.calamari-tracker`, Kinds `service` + `bar-widget`, bleibt dauerhaft geladen. Installation per Symlink aus dem Repo in das Plugin-Verzeichnis von omarchy-shell.

## Testing Decisions

- **Gute Tests** prüfen nur beobachtbares Verhalten an einer öffentlichen Schnittstelle: Eingabe → Ausgabe bzw. Aktionen. Sie kennen keine internen Hilfsfunktionen, Zwischenzustände oder Aufrufreihenfolgen und überleben ein Refactoring der Interna. Testnamen verwenden das Vokabular aus `CONTEXT.md`.
- **Seam A: Erinnerungslogik**, getestet mit dem eingebauten Test-Runner von Node. Die Szenarien sind Tabellen aus (Zeitpunkt, Tagesinformation, Zustand, Config) → (Bar-Zustand, Aktionen, nächste Prüfung). Die Kalenderregeln werden nur über diese Schnittstelle getestet. Mindestens diese Szenarien:
  - Kernzeit ohne Schicht (sofort, dann alle 5 Min, Ende mit der Kernzeit)
  - Feierabend vor Ende der Kernzeit
  - Wiedereinstempeln nach dem Feierabend
  - Pause mit Pausen-Erinnerung nach 30 Min und Wiederholung
  - Feiertag, Abwesenheit, „Heute frei“
  - halber Feiertag
  - Arbeitsplan-Überschreibung
  - sanfter Hinweis genau einmal
  - letzte Warnung → Auto-Abschluss nach Wartezeit
  - „+1 h“ verschiebt, Obergrenze gewinnt
  - Wochenende mit laufender Schicht
  - Übernacht-Fall
  - Start mitten in der Kernzeit
  - Idempotenz (zweimal derselbe Zeitpunkt löst nichts doppelt aus)
- **Seam B: Kommandozeilen-Interface des Calamari-Helfers**, getestet mit `unittest` aus der Python-Standardbibliothek gegen einen lokalen Fake-HTTP-Server. Der bildet Protected-Resource- und Authorization-Server-Metadaten, Registrierung, Token-Endpoint und MCP-Endpoint nach (JSON- und SSE-Antworten). Der Keyring wird per Umgebungsvariable durch einen Datei-Speicher ersetzt, und die Basis-URL ist per Umgebungsvariable überschreibbar. Dazu kommen die aktuelle Uhrzeit (`CALAMARI_NOW`), damit Fake und Helfer dasselbe „jetzt“ sehen, und der Browser (`$BROWSER`, übliche Konvention), damit der Login-Test dem Redirect folgen kann. Das sind die einzigen zusätzlichen Nähte. Geprüft werden:
  - Login-Ablauf inkl. PKCE-Verifikation durch den Fake
  - Refresh bei 401 und `AUTH_REQUIRED`, wenn der Refresh scheitert
  - `status` (Überschneidung ja/nein)
  - `start-time` (Intervallhalbierung liefert die im Fake hinterlegte Startzeit)
  - `clock-in`/`clock-out`
  - Zusammenfassung von `day-info` (Feiertag, halber Feiertag, Abwesenheit, arbeitsfreier Tag)
  - Fehlercodes für Netzwerkfehler, 429 und MCP-Fehler
- **Ohne automatisierte Tests:** Service, Bar-Widget und Panel (QML-Glue). Sie bleiben bewusst dünn und werden pro Scheibe manuell in der laufenden Shell abgenommen, mit verkürzten Zeiten aus der Config. Echte Stempelungen gegen Calamari erfolgen nur manuell und in Absprache mit dem Benutzer.
- **Prior Art:** Im Repo gibt es noch keine Tests. Als Vorbilder dienen die JS-Logikmodule und die qmllint-Stubs des Screen-Time-Plugins (ax1g/quickshell-screentime-plugin) sowie die Aufteilung in eine reine Logikdatei und einen Service im Idle-Service von omarchy-shell.

## Out of Scope

- Wochenübersicht, Überstunden- bzw. Arbeitszeitsaldo (der MCP hat noch keine Timesheet-Tools)
- Echte Calamari-Pausen mit Pausentyp
- Zurückdatiertes Ausstempeln und automatische Korrektur von Endzeiten (auch nicht über `createTimesheetEntries`)
- Projekte und Beschreibungen beim Einstempeln
- Nachreichen fehlgeschlagener Aktionen per Offline-Warteschlange
- Die REST-API mit Admin-Key und interne Web-Endpoints
- Urlaubsanträge oder andere Calamari-Funktionen jenseits der Zeiterfassung
- Mehrere Calamari-Accounts oder mehrere Benutzer

## Further Notes

- Der Status-Trick über `checkTimesheetOverlap` ist die fragilste Stelle. Ändert Calamari das Verhalten, muss der Status neu gelöst werden. Ein manueller Prüfbefehl soll das schnell erkennbar machen. Bietet der MCP-Server später Status-, Pausen- oder Zeitparameter an, werden die Umwege ersetzt und ADR 0001 wird überarbeitet.
- Noch nicht verifiziert:
  - ob eine über Mitternacht laufende Schicht im Overlap-Check für „heute“ erscheint (Scheibe 8)
  - wie teuer `worked-today` ist (Scheibe 2)
  - die Rate-Limits des MCP-Servers (sie sind nicht dokumentiert, deshalb wird konservativ abgefragt, mit Backoff bei 429)
- Die Dynamic Client Registration ist in den Metadaten angekündigt, mit einem eigenen Client aber noch nicht erprobt. Das ist das erste Risiko, das abgebaut wird (Scheibe 1).
- Bei Auto-Abschluss oder Korrektur-Hinweis ist die Endzeit in Calamari bewusst zunächst zu spät. Das ist ein akzeptierter Kompromiss aus ADR 0001.
