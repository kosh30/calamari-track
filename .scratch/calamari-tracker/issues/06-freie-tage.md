# 06: Freie Tage

**What to build:** An einem freien Tag kommen keine Stempel-Erinnerungen. Ein freier Tag entsteht durch einen Feiertag aus dem Calamari-Feiertagskalender (`getPublicHolidays`), durch eine Abwesenheit wie Urlaub oder Krankheit (`search`, gefiltert auf die eigene `personUuid`) oder durch den Schalter „Heute frei“ im Panel, der am nächsten Tag automatisch zurückgesetzt wird. Ein halber Feiertag verkürzt die Kernzeit (z.B. 24.12. nachmittags → Kernzeit endet um 12:00). Arbeitsplan und Kernzeit lassen sich über die Widget-Einstellungen lokal überschreiben.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] `day-info` liefert zusätzlich `holiday` (inkl. `halfDay`/`halfdayPeriod`) und `absence`
- [ ] Tests für `decide`: Feiertag, Abwesenheit, „Heute frei“, halber Feiertag (verkürzte Kernzeit), Arbeitsplan-Überschreibung
- [ ] Der Schalter „Heute frei“ im Panel wird im lokalen Zustand gespeichert und am Folgetag ignoriert
- [ ] Die Überschreibungen für Arbeitsplan/Kernzeit sind in den Widget-Einstellungen änderbar
- [ ] Tests für `day-info` gegen den Fake: Feiertag, halber Feiertag, Abwesenheit, arbeitsfreier Tag
