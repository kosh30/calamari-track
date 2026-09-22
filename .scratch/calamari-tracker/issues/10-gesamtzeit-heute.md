# 10: Gesamtzeit heute im Panel

**What to build:** Das Panel zeigt die Gesamtzeit aller Schichten von heute, also auch der Schichten vor einer Pause. Der Helfer ermittelt sie mit `worked-today` über die Schicht- und Lückensuche per Overlap-Check. Braucht das unverhältnismäßig viele Abfragen (siehe unbekannte Rate-Limits des MCP-Servers), wird die Funktion begründet verworfen, und das Ergebnis wird in der Spec vermerkt. Das Panel zeigt dann nur die Dauer der laufenden Schicht.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Anzahl der nötigen MCP-Aufrufe für einen typischen Tag (1–3 Schichten) gemessen und dokumentiert
- [ ] Entweder: `worked-today` liefert die Summe in Minuten, das Panel zeigt sie, gecacht und nur bei Statuswechsel neu berechnet
- [ ] Oder: Entscheidung gegen die Funktion mit Begründung in der Spec
- [ ] Test gegen den Fake mit mehreren Schichten und Lücken (falls umgesetzt)
