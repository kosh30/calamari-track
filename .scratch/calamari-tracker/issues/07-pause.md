# 07: Pause

**What to build:** Bei laufender Schicht zeigt das Panel einen Pause-Button. Er stempelt aus und markiert das im lokalen Zustand als Pause (kein Feierabend, siehe ADR 0001). „Pause beenden“ stempelt wieder ein. Die Bar zeigt die Pause gelb mit Pausendauer, das Panel zeigt, seit wann die Pause läuft. Die Pause übersteht einen Neustart der Shell und des Rechners. Nach 30 Minuten Pause kommt eine Pausen-Erinnerung, danach alle 5 Minuten eine weitere. Die Pausen-Grenze und das Wiederholungsintervall sind konfigurierbar.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] Der Pause-Button ist nur bei laufender Schicht sichtbar
- [ ] Pause beginnen = Ausstempeln + Markierung, Pause beenden = Einstempeln + Markierung entfernen
- [ ] Die Bar ist gelb mit Pausendauer
- [ ] Die Pausenmarkierung übersteht einen Shell-Neustart
- [ ] Während einer Pause kommen keine Stempel-Erinnerungen (die Pause ist weder „nicht eingestempelt“ noch Feierabend)
- [ ] Tests für `decide`: Pausen-Erinnerung nach der Grenze, Wiederholung, keine Stempel-Erinnerung während der Pause, Idempotenz
- [ ] Pausen-Grenze und Intervall sind in den Widget-Einstellungen änderbar, mit verkürzten Werten manuell abgenommen
