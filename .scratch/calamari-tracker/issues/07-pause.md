# 07: Pause

**What to build:** Bei laufender Schicht zeigt das Panel einen Pause-Button. Er stempelt aus und markiert das im lokalen Zustand als Pause (kein Feierabend, siehe ADR 0001). „Pause beenden“ stempelt wieder ein. Die Bar zeigt die Pause gelb mit Pausendauer, das Panel zeigt, seit wann die Pause läuft. Die Pause übersteht einen Neustart der Shell und des Rechners. Nach 30 Minuten Pause kommt eine Pausen-Erinnerung, danach alle 5 Minuten eine weitere. Die Pausen-Grenze und das Wiederholungsintervall sind konfigurierbar.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] Der Pause-Button ist nur bei laufender Schicht sichtbar
- [x] Pause beginnen = Ausstempeln + Markierung, Pause beenden = Einstempeln + Markierung entfernen
- [ ] Die Bar ist gelb mit Pausendauer
- [x] Die Pausenmarkierung übersteht einen Shell-Neustart
- [x] Während einer Pause kommen keine Stempel-Erinnerungen (die Pause ist weder „nicht eingestempelt“ noch Feierabend)
- [x] Tests für `decide`: Pausen-Erinnerung nach der Grenze, Wiederholung, keine Stempel-Erinnerung während der Pause, Idempotenz
- [ ] Pausen-Grenze und Intervall sind in den Widget-Einstellungen änderbar, mit verkürzten Werten manuell abgenommen

## Comments

**2026-09-22 (Agent):** Umgesetzt, die Abnahme in der Shell steht noch aus. Die Regeln stehen in spec.md unter „Pause“.
- `breakSince` im Zustand. `break-start`/`break-end` laufen über `clock-out`/`clock-in` des Helfers (`helperCommand`). Der Nachlauf-Schutz von 2 Min gilt auch nach Pausenbeginn.
- Die Bar zeigt die Pause mit 󰅶 und Pausendauer in der Theme-Farbe `yellow`. Im aktuellen Theme ist das ein Grau.
- Die Pausen-Erinnerung kommt nach `breakLimitMinutes` (30), danach alle `breakReminderMinutes` (5), an jedem Tag.
- Zusätzlich zum Ticket: Während der Pause bietet das Panel „Feierabend“ an, ohne zu stempeln. Sonst käme den ganzen Abend alle 5 Min eine Pausen-Erinnerung.
- Meldet Calamari nach dem Einstempeln (oder dem Pausenende) keine Schicht, zeigt das Panel das jetzt an und fragt gleich neu ab.
