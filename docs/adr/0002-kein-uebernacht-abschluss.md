# Kein Übernacht-Abschluss: Calamari beendet offene Schichten um 23:59

Calamari beendet jede um 23:59 noch offene Schicht selbst. Das ist eine Regel der Firma, keine Einstellung des Plugins. Damit überlebt keine Schicht Mitternacht, und das Plugin stempelt morgens nichts mehr aus.

Läuft im gespeicherten Zustand noch eine Schicht von einem früheren Tag, fragt das Plugin nur noch `day-end --date <Tag>`: ein einzelner, lesender Overlap-Aufruf auf das Fenster 23:58–23:59. Reichte die Schicht bis dorthin, hat Calamari sie beendet und die Endzeit des Eintrags ist falsch — der Benutzer bekommt einen Korrektur-Hinweis mit seiner letzten Aktivität. Endete sie früher, hat er selbst ausgestempelt und es passiert nichts.

Vorher nahm das Plugin an, eine Schicht könne morgens noch laufen, und wollte sie mit `clock-out --overnight` beenden. Das war falsch und schädlich: Der Vortags-Check auf 23:57–23:59 hätte den von Calamari um 23:59 beendeten Eintrag für eine laufende Schicht gehalten und `clockOut` ins Leere gesendet. Ein `clockOut` ohne laufende Schicht hinterlässt in Calamari einen Eintrag von Sekunden (beobachtet 2026-09-22, siehe ADR 0001).

## Prüfung

Ob `checkTimesheetOverlap` eine über Mitternacht laufende Schicht für „heute“ zählt, bleibt ungeprüft und ist mit dieser Regel auch nicht prüfbar: Es kann keine solche Schicht geben. Eine Suche über die letzten 120 Tage (2026-05-27 bis 2026-09-23, 8 Aufrufe) fand keinen einzigen Eintrag, der 23:55–23:59 oder 00:00–00:05 berührt. Eine Kontrollmessung auf Mittagsfenster derselben Tage traf, eine auf 03:00 nicht — die Suche funktioniert, das Ergebnis ist echt.

Nebenbefund: `checkTimesheetOverlap` nimmt viele Einträge in einem Aufruf (31 Tage pro Aufruf getestet). Für die Gesamtzeit eines Tages hilft das nicht, weil die Antwort nur eine Liste von Daten ist: Mehrere Fenster desselben Tages lassen sich nicht auseinanderhalten.

## Consequences

- `status` und `clock-out` haben kein `--overnight` mehr. Neu ist `day-end --date YYYY-MM-DD` → `{"ranToMidnight": bool}`, nur lesend, ein Aufruf.
- Der lokale Zustand kennt `unclosed` (Datum eines Tages, den das Plugin mit laufender Schicht verlassen hat) statt `overnight`.
- Am Morgen gibt es höchstens eine Benachrichtigung, nie eine Stempelung. Die Stempel-Aktion `overnight-close` ist weg.
- Ein Tageswechsel im Zustand setzt den Status auf „unbekannt“ zurück, statt die laufende Schicht von gestern zu übernehmen. Die Erinnerungslogik schweigt, bis die erste Abfrage des neuen Tages geantwortet hat.
- Für eine Firma ohne diese Regel: Läuft eine Schicht wirklich über Mitternacht und zählt Calamari sie für „heute“, behandelt das Plugin sie als Schicht von heute; die Startzeit-Suche findet 00:00. Zählt Calamari sie nicht für heute, sieht das Plugin sie gar nicht. Beides ist ungeprüft, siehe oben.
