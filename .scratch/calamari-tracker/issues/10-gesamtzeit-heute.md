# 10: Gesamtzeit heute im Panel

**What to build:** Das Panel zeigt die Gesamtzeit aller Schichten von heute, also auch der Schichten vor einer Pause. Der Helfer ermittelt sie mit `worked-today` über die Schicht- und Lückensuche per Overlap-Check. Braucht das unverhältnismäßig viele Abfragen (siehe unbekannte Rate-Limits des MCP-Servers), wird die Funktion begründet verworfen, und das Ergebnis wird in der Spec vermerkt. Das Panel zeigt dann nur die Dauer der laufenden Schicht.

**Blocked by:** 04

**Status:** resolved

- [x] Anzahl der nötigen MCP-Aufrufe für einen typischen Tag (1–3 Schichten) gemessen und dokumentiert
- [ ] Entweder: `worked-today` liefert die Summe in Minuten, das Panel zeigt sie, gecacht und nur bei Statuswechsel neu berechnet
- [x] Oder: Entscheidung gegen die Funktion mit Begründung in der Spec
- [x] Test gegen den Fake mit mehreren Schichten und Lücken (falls umgesetzt)

## Comments

**2026-09-22 (Agent):** Mit dem Benutzer entschieden: Eine exakte Summe über `checkTimesheetOverlap` ist nicht effizient möglich. Lücken findet man nur durch Abtasten, das wären ca. 120–600 Aufrufe. `worked-today` ist deshalb verworfen. Stattdessen zeigt das Panel die beobachtete Summe (spec.md, „Gesamtzeit heute (beobachtet)“).
- Neuer Befehl `end-time --after HH:MM`. Gemessen: 5–11 Overlap-Aufrufe je Suche, gegen echtes Calamari fand er das Ende 16:05.
- `shifts` und `pendingEnd` im Zustand. Eigenes Stempeln kostet keinen Aufruf, eine gescheiterte Suche fragt die nächste Abfrage erneut.
- Die Umsetzung weicht vom Wortlaut „worked-today liefert die Summe“ ab: Die Summe liefert das Plugin aus seinen Beobachtungen.
