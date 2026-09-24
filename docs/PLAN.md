# Implementierungsplan: Calamari Tracker

Grundlage: [CONTEXT.md](../CONTEXT.md) (Begriffe) und [ADR 0001](adr/0001-calamari-mcp-statt-rest-api.md) (Zugriff über den MCP-Server).
Der Plan besteht aus vertikalen Scheiben. Jede Scheibe endet mit etwas, das man ausprobieren kann. Die Reihenfolge baut die Risiken zuerst ab.

## Architektur

```
┌──────────── omarchy-shell (Quickshell) ─────────────┐
│  Widget.qml + Panel.qml    ◄──►  Service.qml         │
│                                   │  Timer, IdleMonitor, State-Datei
│                                   │  js/reminders.mjs  (reine Logik)
│                                   │  js/daycalendar.mjs (reine Logik)
│                                   ▼  Process (JSON auf stdout)
│                             bin/calamari  (Python, nur stdlib)
└───────────────────────────────────│─────────────────┘
                                    ▼ HTTPS, OAuth Bearer
               gateway.eu-west-1.calamari.io/mcp-server/mcp
```

- **`bin/calamari`** ist die einzige Stelle, die mit Calamari spricht. Sie kümmert sich um OAuth, das MCP-Protokoll (Streamable HTTP, JSON-RPC) und die Übersetzung der Tools in einfache Befehle. Die Ausgabe ist immer JSON, `{"ok":false,"error":{"code":…}}` bei Fehlern.
- **`Service.qml`** hält den Laufzeitzustand, ruft den Helfer auf, misst die Aktivität und verschickt Benachrichtigungen. Er trifft selbst keine Entscheidungen, sondern fragt dafür die JS-Logik.
- **`js/*.mjs`** enthält reine Funktionen ohne Qt, die mit `node --test` getestet werden. Kernstück ist `decide(now, day, state, config) → { barState, actions[] }`.
- **Lokaler Zustand** liegt in `$XDG_STATE_HOME/calamari-tracker/state.json` (atomic write): Pausenmarkierung, Feierabend, „Heute frei“, verschickte Erinnerungen, letzte Aktivität, bekannte Startzeit, Verschiebungen durch „+1 h“.
- **Secrets** liegen im Keyring über `secret-tool` (`service kosh.calamari-tracker`, `key client` / `key tokens`).

## Scheibe 0: Gerüst

- `git init`, `.gitignore`, `manifest.json` (ID `kosh.calamari-tracker`, Kinds `service` + `bar-widget`, `keepLoaded`).
- Symlink `~/.config/omarchy/plugins/kosh.calamari-tracker → ~/Work/calamari_tracker`, dann rescan + enable.
- Leeres `Service.qml` und `Widget.qml` mit einem statischen Icon in der Bar.
- qmllint-Importkontext in `lint/`: wörtliche Snapshots von omarchy-shell (`lint/refresh.sh`) plus Quickshell-Stubs aus dem Screen-Time-Plugin.
- Testbefehle: `node --test js/` und `python3 -m unittest`.

**Fertig, wenn** das Icon in der Bar erscheint und Hot-Reload beim Speichern funktioniert.

## Scheibe 1: OAuth-Login (größtes Risiko)

- `bin/calamari login`:
  - Discovery: `/.well-known/oauth-protected-resource/mcp-server/mcp` → Authorization-Server-Metadaten.
  - Dynamic Client Registration mit Redirect `http://127.0.0.1:<freier Port>/callback`. Die Client-Daten kommen in den Keyring.
  - Authorization Code + PKCE S256, `resource`-Parameter = MCP-URL. Der Browser öffnet sich per `xdg-open`, ein lokaler HTTP-Server empfängt den Code.
  - Token-Tausch, Tokens in den Keyring.
- Automatischer Refresh bei `401` oder abgelaufenem Token. Scheitert er, gibt es den Fehlercode `AUTH_REQUIRED`.
- `bin/calamari whoami` → `getMyProfile` als Rauchtest. Dafür braucht es die MCP-Session: `initialize` → `Mcp-Session-Id` → `notifications/initialized` → `tools/call`.
- Unit-Tests für PKCE, Token-Ablauf und MCP-Antworten (JSON und SSE-Frames), mit einem Fake-HTTP-Server.

**Fertig, wenn** `bin/calamari login` im Browser per Microsoft-SSO durchläuft und `bin/calamari whoami` deinen Namen zeigt, auch nach einem Token-Refresh.
**Fallback, falls DCR für eigene Clients gesperrt ist:** Neu entscheiden. Wir haben keinen Weg, ohne Rückfrage bei dir weiterzumachen.

## Scheibe 2: Status und Stempeln im Helfer

- `status` → `checkTimesheetOverlap(heute, jetzt−2min … jetzt, skipNotEligibleDays=false)` → `{"running": bool}`.
- `start-time` → Intervallhalbierung über den Tag auf die Minute genau (etwa 10 Aufrufe) → `{"startedAt": "HH:MM"}`. Mit `--after HH:MM` lassen sich Folgeschichten nach einer Pause finden.
- `worked-today` → Summe der Schichten von heute. Dazu wird die Lücken- und Schichtsuche wiederverwendet, sonst entfällt das und das Panel zeigt nur die Schichtdauer. *Offen: der Aufwand wird in dieser Scheibe gemessen.*
- `clock-in`, `clock-out` → `clockIn`/`clockOut`, danach sofort erneut `status`.
- `day-info --date YYYY-MM-DD` → `getWorkPlan` + `getPublicHolidays` + `search(peopleUuids=[ich])`, zusammengefasst zu `{workingDay, coreStart, coreEnd, holiday, halfDay, absence}`. Der Arbeitsplan wird einmal täglich gecacht.
- Das Verhalten des Overlap-Checks wird dokumentiert, und ein manueller Prüfbefehl erkennt, wenn Calamari es ändert.

**Fertig, wenn** `status`, `start-time` und `day-info` den echten Zustand liefern und `clock-out` / `clock-in` im Test den Status umschalten. Das ist einmal manuell mit dir zu testen, weil es echte Stempelungen erzeugt.

## Scheibe 3: Status in der Bar

- `Service.qml`: Die Abfrage läuft alle 3 Min (konfigurierbar), sofort beim Öffnen des Panels und nach jeder eigenen Aktion.
- Die Bar zeigt Icon + Schichtdauer (`󰔟 3:42`). Die Dauer tickt lokal ab der bekannten Startzeit weiter.
- Farben: grau (keine Schicht), grün (Schicht läuft), gelb (Pause), rot (Stempel-Erinnerung aktiv), Warnsymbol (Fehler oder Anmeldung nötig).

**Fertig, wenn** ein Einstempeln im Web nach spätestens einer Abfrage in der Bar erscheint.

## Scheibe 4: Panel mit Aktionen

- Das Panel nach dem Muster von notification-center (`Panel` + `KeyboardPanel`).
- Inhalt:
  - Status, Schichtdauer, Gesamtzeit heute (falls in Scheibe 2 machbar)
  - Einstempeln/Ausstempeln (Ausstempeln = Feierabend)
  - Pause beginnen/beenden, nur bei laufender Schicht (= Ausstempeln + Markierung bzw. Einstempeln)
  - „Heute frei“
  - Fehlerzeile mit „Neu anmelden“, die `bin/calamari login` startet
- Die Pausenmarkierung und der Feierabend werden im State gespeichert und überleben einen Neustart der Shell.

**Fertig, wenn** alle Buttons wirken und die Pause einen Shell-Neustart übersteht.

## Scheibe 5: Erinnerungslogik (TDD, reine Funktionen)

- `js/daycalendar.mjs`: Arbeitstag, Kernzeit (inkl. halbem Feiertag), freier Tag, lokale Überschreibungen aus der Config.
- `js/reminders.mjs`: `decide(now, day, state, config)` liefert fällige Aktionen: `stamp-reminder`, `break-reminder`, `soft-hint`, `final-warning`, `auto-close`. Dazu den Bar-Zustand und den Zeitpunkt der nächsten Prüfung.
- Testfälle, mindestens:
  - Kernzeit ohne Schicht: sofort erinnern, dann alle 5 Min, bis zum Ende der Kernzeit.
  - Feierabend um 15:30: keine Erinnerungen mehr, auch nicht bis 16:45.
  - Pause 12:00: um 12:30 Pausen-Erinnerung, danach alle 5 Min.
  - Freier Tag (Feiertag, Urlaub, Schalter): keine Stempel-Erinnerung.
  - 24.12. mit halbem Feiertag: Kernzeit endet um 12:00.
  - Sanfter Hinweis genau einmal, 30 Min nach Ende der Kernzeit.
  - Letzte Warnung um 19:00, Auto-Abschluss 15 Min später, „+1 h“ verschiebt beides, Obergrenze 23:00.
  - Wochenende mit laufender Schicht: kein Stempel-Hinweis, aber letzte Warnung und Auto-Abschluss.
  - Schicht vom Vortag lief bis zum Tagesende: Korrektur-Hinweis, kein Stempeln (ADR 0002).
- Alle Zeiten kommen aus der Config (Werte siehe Zusammenfassung in CONTEXT/Grilling).

**Fertig, wenn** alle Tests grün sind und das Modul keine Qt-Abhängigkeit hat.

## Scheibe 6: Benachrichtigungen verdrahten

- Der Service ruft `decide` beim Timer, beim Statuswechsel und beim Resume auf und führt die Aktionen aus.
- Versand über `omarchy-notification-send … -p` (eigene Glyphe). Mit `-r <id>` wird die vorige Erinnerung desselben Typs ersetzt, statt sie zu stapeln.
- Ein Klick (`--exec omarchy-shell kosh.calamari-tracker openPanel`) öffnet das Panel. Dafür gibt es einen `IpcHandler` im Widget bzw. Service.

**Fertig, wenn** jede Erinnerungsart einmal mit verkürzten Test-Zeiten aus der Config sichtbar ausgelöst wurde.

## Scheibe 7: Letzte Warnung und Auto-Abschluss

- Nach der letzten Warnung zeigt das Panel einen Countdown und die Buttons „+1 h weiterarbeiten“ / „Jetzt ausstempeln“.
- Auto-Abschluss: `clock-out`. Danach die Notification „Schicht um HH:MM automatisch beendet, letzte Aktivität HH:MM, bitte in Calamari korrigieren“. Ein Klick öffnet Calamari im Browser.

**Fertig, wenn** der ganze Ablauf mit verkürzten Zeiten gegen echte Calamari-Stempelungen einmal durchgelaufen ist (mit dir abgestimmt).

## Scheibe 8: Letzte Aktivität und Tagesende-Abschluss

- `IdleMonitor` (Quickshell.Wayland) mit dem Lock-Timeout aus der omarchy-shell-Idle-Config: Beginnt der Leerlauf, wird die Zeit als letzte Aktivität gespeichert.
- Ein Heartbeat schreibt jede Minute `lastSeen` in den State. Liegt beim nächsten Tick eine Lücke von mehr als 5 Min, war das Gerät im Suspend, und die letzte Aktivität ist der letzte Heartbeat vor der Lücke.
- Resume oder Shell-Start: Kennt der State eine laufende Schicht von einem früheren Tag, fragt `day-end`, ob sie bis zum Tagesende lief. Wenn ja, hat Calamari sie um 23:59 beendet und es gibt einen Korrektur-Hinweis, kein Stempeln (ADR 0002).
  - *Zu prüfen in der Scheibe:* Zählt eine über Mitternacht laufende Schicht beim Overlap-Check für „heute“? Falls nicht, wird der Vortag geprüft.

**Fertig, wenn** das Szenario „Deckel zu mit laufender Schicht, später wieder auf“ den richtigen Hinweis mit der richtigen Uhrzeit bringt.

## Scheibe 9: Config und Feinschliff

- `barWidget.schema` im Manifest für alle Werte:
  - Abfrage-Intervall, Intervall der Stempel-Erinnerung, Pausen-Grenze
  - Versatz des sanften Hinweises, Uhrzeit der letzten Warnung, Wartezeit bis zum Auto-Abschluss
  - Dauer von „+1 h“, Obergrenze
  - Überschreibungen für Arbeitsplan und Kernzeit
- Fehlerzustände: kein Netz, `AUTH_REQUIRED`, `429`. Die Abfrage wird dann seltener (Backoff), und die Bar zeigt den Fehler.
- README (Installation, `login`, Grenzen laut ADR), damit das Plugin veröffentlicht werden kann. Keine Secrets oder Firmendaten im Repo.

**Fertig, wenn** das Plugin eine Arbeitswoche im Alltag läuft, ohne dass du eingreifen musst.

## Später (bewusst nicht im Umfang)

- Wochenübersicht und Saldo (warten auf Timesheet-Tools im MCP)
- Echte Pausen mit Typ, zurückdatiertes Ausstempeln und ein Status-Tool, sobald der MCP sie anbietet (ADR 0001 dann überarbeiten)
- Projekte und Beschreibung beim Einstempeln
