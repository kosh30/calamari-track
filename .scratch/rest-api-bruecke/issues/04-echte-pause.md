# 04: Echte Pause aus dem Panel

**What to build:** „Pause beginnen“ und „Pause beenden“ im Panel laufen über REST `break-start` und `break-stop` mit der Uhrzeit „jetzt“ und dem Pausentyp aus einer Widget-Einstellung (als Name, der Helper löst ihn auf; Vorgabe ist der Typ, den Ticket 01 als Standard von Web und Handy festgehalten hat). Die Schicht läuft während der Pause weiter; in Calamari steht am Ende eine Schicht mit einer Pause darin statt zwei Schichten mit einer Lücke. Fehler zeigt das Panel wie bei jeder Stempelung, nichts wird nachgereicht.

**Blocked by:** 01, 03

**Status:** ready-for-agent

- [ ] Pause beginnen = `break-start`, Pause beenden = `break-stop`; kein Aus- oder Einstempeln mehr
- [ ] Die Einstellung „Pausentyp“ ist im Einstellungsformular änderbar; ein unbekannter Name ist ein eigener Fehler
- [ ] Die Pause übersteht einen Neustart der Shell (der Status aus Ticket 03 bestätigt sie)
- [ ] Pausen-Grenze und Wiederholung der Pausen-Erinnerung gelten weiter
- [ ] Tests für `applyStamp` mit den neuen Pausenaktionen
- [ ] Mit dem Benutzer abgenommen: In Calamari steht eine Schicht mit Projekt „Check-in“ und einer Pause darin
