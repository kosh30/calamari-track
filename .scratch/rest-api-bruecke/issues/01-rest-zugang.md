# 01: REST-Zugang und Nachschlagen

**What to build:** Der Helper kann neben dem MCP-Server auch die Calamari-REST-API ansprechen (ADR 0003). Der Benutzer speichert den API-Key einmalig per `calamari api-key` von stdin im Keyring; er landet nie in der Shell-History, in `shell.json` oder den Einstellungen. Die Basis-URL ist eine Widget-Einstellung (`https://<firma>.calamari.io/api`; seit Ticket 11 ohne Vorgabe). Ein lesender Befehl zeigt die Projekte und die Pausentypen, die für die eigene E-Mail gelten. REST-Fehler kommen in derselben JSON-Form wie alle Helper-Fehler heraus, mit eigenen Codes für fehlenden Key, fehlende Berechtigung (403 „scope“), fehlendes API Terminal und Rate-Limit.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] `calamari api-key` liest den Key von stdin und legt ihn im Keyring ab; ohne Key antworten REST-Befehle mit einem eigenen Fehlercode
- [x] Die Basis-URL ist eine Einstellung (`https://<firma>.calamari.io/api`) und erreicht den Helper
- [x] Die eigene Person ist die E-Mail aus `whoami`; REST-Aufrufe gehen nur für sie
- [x] Der lesende Befehl liefert Projekte (`get-projects-for-person`) und Pausentypen (`get-break-types-for-person`) als JSON
- [x] Fehler von REST (401, 403, 429, `API_TERMINAL_NOT_AVAILABLE`, Netzwerk) haben stabile Codes
- [x] Tests gegen einen Fake-REST-Server, wie der bestehende Fake für den MCP-Server
- [x] Mit dem Benutzer abgenommen: Key eingegeben, der Befehl zeigt die Id von „Check-in“ und die Pausentypen. Beides unter `## Comments` festhalten, samt dem Pausentyp, den Web und Handy standardmäßig setzen

## Comments

**2026-09-24 (Agent):** Umgesetzt, die Abnahme mit dem echten Key steht noch aus.
- `calamari api-key` liest den Key von stdin (im Terminal verdeckt per `getpass`) und legt ihn im Keyring unter `apiKey` ab.
- `calamari lookup` → `{"person", "projects": [{id, name}], "breakTypes": [{id, name}]}`.
- Die eigene E-Mail kommt aus `getMyProfile` und wird im Keyring gemerkt; ein neues `login` verwirft sie.
- Fehlercodes: `API_KEY_REQUIRED`, `API_KEY_REJECTED` (401), `API_SCOPE_MISSING` (403), `API_TERMINAL_MISSING`, `RATE_LIMITED` (429, wie beim MCP), `NETWORK`, sonst `API_ERROR` mit Calamaris Code im Text. Keiner davon ist `AUTH_REQUIRED`, ein Problem mit dem Key schickt also nicht zum OAuth-Login.
- Einstellung `apiUrl` (`https://<firma>.calamari.io/api`); der Service gibt sie jedem Helper-Aufruf als `CALAMARI_API_URL` mit. Seit Ticket 11 gibt es keine Vorgabe mehr, leer heißt `API_URL_REQUIRED`. Braucht `omarchy-restart-shell`.
- Abnahme: `bin/calamari api-key` (Key einfügen, Enter), dann `bin/calamari lookup | python3 -m json.tool`.

**2026-09-24 (Agent):** Mit dem Benutzer gegen das echte Calamari abgenommen. Key per `bin/calamari api-key` gespeichert, `bin/calamari lookup` antwortete für die eigene E-Mail:
- Projekte: „Check-in“ und einige firmenspezifische. Vorgabe für das Standard-Projekt bleibt „Check-in“.
- Pausentypen: nur „Break“. Das ist damit auch die Vorgabe für die Einstellung „Pausentyp“ in Ticket 04.
- Der Key hat die Gruppen für Projekte und Pausentypen. Ob er auch Stempeln (Terminal) und Schichtstatus darf und ob das API Terminal eingerichtet ist, zeigt sich erst in Ticket 02 und 03.
