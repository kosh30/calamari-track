# 04: Ein- und Ausstempeln im Panel

**What to build:** Im Panel kann der Benutzer per Klick einstempeln und ausstempeln (`clockIn`/`clockOut`, immer „jetzt“). Nach jeder Aktion zeigt das Panel sofort den neuen Status. Ausstempeln bedeutet Feierabend und wird im lokalen Zustand (JSON unter XDG-State, atomar geschrieben) für den heutigen Tag gespeichert. Das übersteht einen Neustart der Shell. Erneutes Einstempeln nach dem Feierabend ist möglich und hebt ihn auf. Fehler (kein Netz, Anmeldung nötig, Rate-Limit) erscheinen deutlich im Panel, nichts wird heimlich nachgereicht.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] `clock-in` / `clock-out` im Helfer, danach Status-Abfrage, JSON-Ausgabe
- [ ] Der Button im Panel wechselt passend zwischen „Einstempeln“ und „Ausstempeln“
- [ ] Der Feierabend wird im lokalen Zustand gespeichert und übersteht einen Shell-Neustart
- [ ] Einstempeln nach dem Feierabend hebt den Feierabend auf
- [ ] Fehler werden im Panel angezeigt, keine Offline-Warteschlange
- [ ] Tests gegen den Fake für `clock-in`/`clock-out` und die Fehlercodes `NETWORK`, `RATE_LIMITED`, `MCP_ERROR`
- [ ] Einmal manuell mit dem Benutzer gegen echtes Calamari abgenommen (erzeugt echte Stempelungen)
