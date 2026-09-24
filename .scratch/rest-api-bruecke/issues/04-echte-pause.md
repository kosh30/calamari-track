# 04: Echte Pause aus dem Panel

**What to build:** „Pause beginnen“ und „Pause beenden“ im Panel laufen über REST `break-start` und `break-stop` mit der Uhrzeit „jetzt“ und dem Pausentyp aus einer Widget-Einstellung (als Name, der Helper löst ihn auf; Vorgabe ist der Typ, den Ticket 01 als Standard von Web und Handy festgehalten hat). Die Schicht läuft während der Pause weiter; in Calamari steht am Ende eine Schicht mit einer Pause darin statt zwei Schichten mit einer Lücke. Fehler zeigt das Panel wie bei jeder Stempelung, nichts wird nachgereicht.

**Blocked by:** 01, 03

**Status:** ready-for-agent

- [x] Pause beginnen = `break-start`, Pause beenden = `break-stop`; kein Aus- oder Einstempeln mehr
- [x] Die Einstellung „Pausentyp“ ist im Einstellungsformular änderbar; ein unbekannter Name ist ein eigener Fehler
- [x] Die Pause übersteht einen Neustart der Shell (der Status aus Ticket 03 bestätigt sie)
- [x] Pausen-Grenze und Wiederholung der Pausen-Erinnerung gelten weiter
- [x] Tests für `applyStamp` mit den neuen Pausenaktionen
- [ ] Mit dem Benutzer abgenommen: In Calamari steht eine Schicht mit Projekt „Check-in“ und einer Pause darin

## Comments

**2026-09-24 (Agent):** Umgesetzt, die Abnahme mit dem Benutzer steht noch aus.
- `bin/calamari break-start` / `break-stop [--break-type NAME]` (Vorgabe „Break“): löst den Namen über `get-break-types-for-person` auf und sendet `{person, time, breakType}` an REST `break-start` / `break-stop`, `time` als lokale Zeit ohne Zone wie beim Einstempeln. Antwort `{"onBreak": bool}` aus Calamaris `breakStatus`. Unbekannter Name: `BREAK_TYPE_UNKNOWN` mit `breakType` im Fehlerobjekt, nichts wird gestempelt. Kein Aus- oder Einstempeln mehr für die Pause.
- Neue Einstellung `breakType` (Vorgabe „Break“), der Service gibt sie als `--break-type` mit.
- Die Pause ist nur noch die echte Pause in der laufenden Schicht (`running` und `onBreak`). Die alte Pause als Lücke und ihr Button „Feierabend“ ohne Stempeln sind weg; „Feierabend statt Pause“ kommt mit Ticket 05 als REST-Ausstempeln zurück.
- Bestätigt Calamari die Pause nicht (`breakStatus` passt nicht), bleibt der Zustand und das Panel sagt „Calamari meldet keine Pause / weiter eine Pause“.
- Bekannte Ungenauigkeit: Endet die Schicht im Web während einer Pause, zählt die Pause bis zur nächsten Abfrage; die Gesamtzeit heute ist dann um bis zu ein Abfrage-Intervall zu niedrig.
- Abnahme: `omarchy-restart-shell`, im Panel „Pause beginnen“, in Calamari prüfen, dass die Schicht weiterläuft und eine Pause hat; „Pause beenden“; in Calamari eine Schicht mit Projekt „Check-in“ und einer Pause darin. Nebenbei zeigt sich, ob `break-stop` wirklich den Pausentyp braucht.
