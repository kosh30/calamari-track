# 01: REST-Zugang und Nachschlagen

**What to build:** Der Helper kann neben dem MCP-Server auch die Calamari-REST-API ansprechen (ADR 0003). Der Benutzer speichert den API-Key einmalig per `calamari api-key` von stdin im Keyring; er landet nie in der Shell-History, in `shell.json` oder den Einstellungen. Die Basis-URL ist eine Widget-Einstellung mit Vorgabe `https://cti.calamari.io/api`. Ein lesender Befehl zeigt die Projekte und die Pausentypen, die für die eigene E-Mail gelten. REST-Fehler kommen in derselben JSON-Form wie alle Helper-Fehler heraus, mit eigenen Codes für fehlenden Key, fehlende Berechtigung (403 „scope“), fehlendes API Terminal und Rate-Limit.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `calamari api-key` liest den Key von stdin und legt ihn im Keyring ab; ohne Key antworten REST-Befehle mit einem eigenen Fehlercode
- [ ] Die Basis-URL ist eine Einstellung mit Vorgabe `https://cti.calamari.io/api` und erreicht den Helper
- [ ] Die eigene Person ist die E-Mail aus `whoami`; REST-Aufrufe gehen nur für sie
- [ ] Der lesende Befehl liefert Projekte (`get-projects-for-person`) und Pausentypen (`get-break-types-for-person`) als JSON
- [ ] Fehler von REST (401, 403, 429, `API_TERMINAL_NOT_AVAILABLE`, Netzwerk) haben stabile Codes
- [ ] Tests gegen einen Fake-REST-Server, wie der bestehende Fake für den MCP-Server
- [ ] Mit dem Benutzer abgenommen: Key eingegeben, der Befehl zeigt die Id von „Check-in“ und die Pausentypen. Beides unter `## Comments` festhalten, samt dem Pausentyp, den Web und Handy standardmäßig setzen
