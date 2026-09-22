# 02: Anmeldung bei Calamari

**What to build:** Der Benutzer meldet sich einmalig per Microsoft-SSO im Browser bei Calamari an. Der Calamari-Helfer entdeckt den Authorization-Server über die Protected-Resource-Metadaten des MCP-Servers, registriert sich per Dynamic Client Registration (Loopback-Redirect auf 127.0.0.1), führt Authorization Code + PKCE S256 mit `resource` = MCP-URL durch und legt Client-Daten und Tokens im System-Keyring ab. `whoami` ruft über eine MCP-Session `getMyProfile` auf. Abgelaufene Tokens werden automatisch erneuert. Scheitert der Refresh, antwortet der Helfer mit `AUTH_REQUIRED`. Das Panel zeigt „Angemeldet als …“ oder einen Button „Neu anmelden“, der den Login startet. Bei nötiger Anmeldung zeigt die Bar ein Warnsymbol. Siehe ADR 0001.

**Blocked by:** 01

**Status:** ready-for-agent

**Risiko:** Die Registrierung mit einem eigenen Client ist noch nicht erprobt. Scheitert sie, wird das Ticket gestoppt und mit dem Benutzer neu entschieden.

- [ ] `login` führt den kompletten Browser-Login durch (manuell mit dem Benutzer abgenommen)
- [ ] `whoami` liefert den Namen des Benutzers als JSON (`{"ok": true, ...}`)
- [ ] Tokens und Client-Daten liegen im Keyring, nicht auf der Platte
- [x] Automatischer Refresh bei abgelaufenem Token bzw. 401. Scheitert der Refresh, gibt es `{"ok": false, "error": {"code": "AUTH_REQUIRED"}}` mit Exit-Code ≠ 0
- [ ] Das Panel zeigt den Anmeldestatus, „Neu anmelden“ startet den Login
- [ ] Die Bar zeigt ein Warnsymbol, solange eine Anmeldung nötig ist
- [x] Tests gegen einen Fake-OAuth/MCP-Server (JSON- und SSE-Antworten): Login inkl. PKCE-Prüfung, Refresh, `AUTH_REQUIRED`. Keyring und Basis-URL per Umgebungsvariable ersetzbar

## Comments

**2026-09-22 (Agent):** Helfer `bin/calamari` (`login`, `whoami`), Fake-Gateway-Tests (`tests/test_calamari_cli.py`), Anmeldestatus in Service, Panel und Bar sind umgesetzt.
- Gegen den echten Server geprüft: Die Metadaten-Discovery funktioniert. Die Dynamic Client Registration ist offen (kein Initial-Token nötig) und hat eine `client_id` ausgestellt. Der Token-Endpoint kennt keine Auth-Methode `none`, deshalb authentifiziert sich der Client mit `client_secret_basic`.
- `login` registriert bei jedem Aufruf einen neuen Client, weil die Redirect-URI den freien Port des Laufs enthält. Da ein Login selten ist, ist das bewusst so.
- Zusätzlich zu Keyring und Basis-URL gibt es `$BROWSER` als dritte Naht. Das ist die übliche Konvention, und der Test-Browser folgt damit dem Redirect.
- Ein Refresh läuft unter einer Dateisperre, weil Calamari Refresh-Tokens rotiert und parallele Läufe sich sonst gegenseitig abmelden.
- Noch offen ist die manuelle Abnahme. Der erste echte Login lief nach 300 s ohne Browser-Rückmeldung ab. Ungeprüft sind außerdem das Feldformat von `getMyProfile` (`whoami` gibt dafür `profile` roh mit aus) sowie Panel und Bar in der laufenden Shell (`omarchy-restart-shell` für `Service.qml`).
