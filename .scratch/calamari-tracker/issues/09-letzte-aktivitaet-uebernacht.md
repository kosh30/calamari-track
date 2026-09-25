# 09: Letzte Aktivität und Tagesende-Abschluss

**What to build:** Das Plugin merkt sich die letzte Aktivität des Benutzers. Das ist der Beginn des Leerlaufs (Idle-Monitor von Quickshell mit dem Lock-Timeout aus der omarchy-shell-Idle-Config) oder, bei einem Suspend, der letzte minütliche Heartbeat vor einer Lücke von mehr als 5 Minuten. Der Korrektur-Hinweis nach einem Auto-Abschluss nennt diese letzte Aktivität als empfohlene Endzeit.

Kennt der gespeicherte Zustand beim Aufwachen oder Start des Rechners noch eine laufende Schicht von einem früheren Tag, fragt das Plugin `day-end`, ob sie bis zum Tagesende lief. Wenn ja, hat Calamari sie um 23:59 selbst beendet (Regel der Firma, [ADR 0002](../../../docs/adr/0002-kein-uebernacht-abschluss.md)): Es folgt ein Korrektur-Hinweis mit der letzten Aktivität von jenem Tag, aber keine Stempelung. Danach beginnt der neue Tag normal.

*Ursprünglich stand hier ein Übernacht-Abschluss, der morgens ausstempelt, und die Frage, ob eine über Mitternacht laufende Schicht im Overlap-Check für „heute“ erscheint. Beides ist mit der Regel der Firma hinfällig, siehe Kommentar vom 2026-09-24.*

**Blocked by:** 08

**Status:** umgezogen nach [#5](https://github.com/kosh30/calamari-track/issues/5) (2026-09-25); der aktuelle Stand steht dort, diese Datei ist Archiv.

- [x] Letzte Aktivität und Heartbeat werden im lokalen Zustand gespeichert
- [x] Eine Heartbeat-Lücke über 5 Min wird als Suspend erkannt, die letzte Aktivität ist der Heartbeat davor
- [x] Der Korrektur-Hinweis nennt die letzte Aktivität
- [x] Tests für den Tagesende-Abschluss (`applyDayEnd`, kein Stempeln), danach normaler neuer Tag mit Stempel-Erinnerung ab Beginn der Kernzeit
- [x] Das Verhalten des Overlap-Checks über Mitternacht ist geprüft und in der Spec bzw. im ADR dokumentiert (Ergebnis: gegenstandslos, siehe ADR 0002)
- [ ] Szenario „Deckel zu mit laufender Schicht, am nächsten Morgen auf“ manuell abgenommen

## Comments

**2026-09-22 (Agent):** Umgesetzt. Die Regeln stehen in spec.md unter „Letzte Aktivität und Übernacht-Fall“.
- `js/activity.mjs` enthält `heartbeat`, `setIdle` und `lastActivity`. Der Zustand kennt `lastSeen`, `idle` und `awaySince`, die den Tageswechsel überstehen. Der Service zählt den Heartbeat im 15-s-Takt und nutzt den `IdleMonitor` mit `shell.idleConfig.lock`.
- `status --overnight` prüft zusätzlich 23:57–23:59 des Vortags. Eine heute laufende Schicht gilt nur dann als die vom Vortag, wenn sie schon um 00:00 lief. Der Übernacht-Abschluss (`overnight-close`) stempelt aus, ohne Feierabend, und schickt den Korrektur-Hinweis mit der letzten Aktivität vom Vortag.
- Noch offen: Ob Calamari eine Schicht über Mitternacht für „heute“ zählt, zeigt erst die Abnahme über Nacht. Beide Fälle sind abgedeckt.

**2026-09-24 (Agent):** Der Übernacht-Abschluss ist abgeschafft. Der Benutzer nannte die Regel der Firma: Calamari beendet jede um 23:59 noch offene Schicht selbst. Damit fällt die Grundlage des alten Entwurfs weg, und der alte Vortags-Check war ein Fehler: Das Fenster 23:57–23:59 trifft auch den von Calamari beendeten Eintrag, `clock-out --overnight` hätte also `clockOut` ins Leere gesendet und den Sekunden-Eintrag erzeugt, den `dd7c3fa` abstellen sollte. Entscheidung und Nachweis stehen in [ADR 0002](../../../docs/adr/0002-kein-uebernacht-abschluss.md).
- Geprüft: 120 Tage (2026-05-27 bis 2026-09-23) mit `checkTimesheetOverlap` auf 00:00–00:05 und 23:55–23:59 abgesucht, 8 Aufrufe, kein Treffer. Kontrollmessung auf Mittagsfenster derselben Tage traf, auf 03:00 nicht. Es gab also nie eine Schicht über Mitternacht, und mit der Regel kann es auch keine geben.
- Statt `status --overnight` und `clock-out --overnight` gibt es `day-end --date YYYY-MM-DD` → `{"ranToMidnight": bool}`: ein lesender Aufruf, kein Stempeln. Lief der Tag bis zum Ende, kommt ein Korrektur-Hinweis mit der letzten Aktivität von jenem Tag, sonst nichts.
- Der Zustand kennt `unclosed` statt `overnight`; ein Tageswechsel setzt den Status auf „unbekannt“, statt die laufende Schicht von gestern zu übernehmen. Die Erinnerungslogik schweigt bei unbekanntem Status.
- Abweichung von der Absprache „Ende suchen (~11 Aufrufe)“: Die Frage „endete der Tag um 23:59?“ beantwortet ein einziges Overlap-Fenster (23:58–23:59). Die genaue Endzeit braucht der Hinweis nicht, er nennt die letzte Aktivität. Damit kostet der Fall einen Aufruf statt elf.
- Nachtrag aus dem Code-Review: Der Hinweis hätte eine Uhrzeit nennen können, zu der der Benutzer längst wieder da war (`awaySince` bleibt nach der Rückkehr stehen). Die letzte Abwesenheit ist jetzt ein Intervall (`awayUntil` in `js/activity.mjs`, `awayCovers`); genannt wird die Uhrzeit nur, wenn die Abwesenheit den Abschluss um 23:59 überdeckt. Sonst kommt der Hinweis ohne Uhrzeit.
- Offen bleibt nur die Abnahme: abends eingestempelt lassen, Deckel zu, am nächsten Morgen aufmachen. Erwartet werden genau eine Benachrichtigung („Schicht vom Vortag beendet“) und keine Stempelung.
