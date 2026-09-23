# 06: Freie Tage

**What to build:** An einem freien Tag kommen keine Stempel-Erinnerungen. Ein freier Tag entsteht durch einen Feiertag aus dem Calamari-Feiertagskalender (`getPublicHolidays`), durch eine Abwesenheit wie Urlaub oder Krankheit (`search`, gefiltert auf die eigene `personUuid`) oder durch den Schalter „Heute frei“ im Panel, der am nächsten Tag automatisch zurückgesetzt wird. Ein halber Feiertag verkürzt die Kernzeit (z.B. 24.12. nachmittags → Kernzeit endet um 12:00). Arbeitsplan und Kernzeit lassen sich über die Widget-Einstellungen lokal überschreiben.

**Blocked by:** 05

**Status:** resolved

- [x] `day-info` liefert zusätzlich `holiday` (inkl. `halfDay`/`halfdayPeriod`) und `absence`
- [x] Tests für `decide`: Feiertag, Abwesenheit, „Heute frei“, halber Feiertag (verkürzte Kernzeit), Arbeitsplan-Überschreibung
- [x] Der Schalter „Heute frei“ im Panel wird im lokalen Zustand gespeichert und am Folgetag ignoriert
- [x] Die Überschreibungen für Arbeitsplan/Kernzeit sind in den Widget-Einstellungen änderbar
- [x] Tests für `day-info` gegen den Fake: Feiertag, halber Feiertag, Abwesenheit, arbeitsfreier Tag

## Comments

**2026-09-22 (Agent):** Umgesetzt. Die Regeln stehen in spec.md unter „Freier Tag“ und „Lokale Überschreibung“.
- Gegen echtes Calamari geprüft: `getPublicHolidays` und `search` liefern die Formen, die in der Spec beschrieben sind. `search` mit `from = to = Tag` findet überlappende Abwesenheiten, `end` ist der letzte Tag einschließlich. Ohne `peopleUuids` liefert `search` die ganze Firma, deshalb fragt der Helfer die eigene `personUuid` ab. `day-info --date 2026-12-24` ergibt den halben Feiertag „Christmas Eve (PM)“, ein Tag im März-Urlaub ergibt `TIMEOFF` ganztägig.
- Die Kalenderregeln liegen in `js/daycalendar.mjs` und werden nur über `decide` getestet.
- Die Überschreibung läuft über die sieben Einstellungen `coreMonday` … `coreSunday`, z.B. `omarchy bar set kosh.calamari-tracker coreFriday 08:00-13:00`.
- „Heute frei“ ist ein Schalter im Panel, er wird als `dayOff` im Zustand gespeichert und lässt sich zurücknehmen.
- Offen ist noch die kurze Abnahme in der Shell.

**2026-09-22 (Agent):** Mit dem Benutzer in der Shell abgenommen:
- „Heute frei“ im Panel geklickt, im Zustand stand danach `dayOff: true`, und der Button zeigte „Heute frei (zurücknehmen)“.
- Nach einem Neustart der Shell war der Schalter weiter gesetzt. Zurückgenommen stand im Zustand `dayOff: false`.
- Dass der Schalter am Folgetag nicht mehr gilt, ist per Test abgedeckt, in der Shell nicht beobachtet.
- Die Überschreibungen werden wie `stampReminderMinutes` mit `omarchy bar set` gesetzt. Dass die Einstellungen beim Service ankommen, hat Ticket 05 gezeigt. Die Kernzeit-Werte selbst sind per Test abgedeckt.
