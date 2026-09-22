# 04: Ein- und Ausstempeln im Panel

**What to build:** Im Panel kann der Benutzer per Klick einstempeln und ausstempeln (`clockIn`/`clockOut`, immer „jetzt“). Nach jeder Aktion zeigt das Panel sofort den neuen Status. Ausstempeln bedeutet Feierabend und wird im lokalen Zustand (JSON unter XDG-State, atomar geschrieben) für den heutigen Tag gespeichert. Das übersteht einen Neustart der Shell. Erneutes Einstempeln nach dem Feierabend ist möglich und hebt ihn auf. Fehler (kein Netz, Anmeldung nötig, Rate-Limit) erscheinen deutlich im Panel, nichts wird heimlich nachgereicht.

**Blocked by:** 03

**Status:** ready-for-agent

- [x] `clock-in` / `clock-out` im Helfer, danach Status-Abfrage, JSON-Ausgabe
- [x] Der Button im Panel wechselt passend zwischen „Einstempeln“ und „Ausstempeln“
- [x] Der Feierabend wird im lokalen Zustand gespeichert und übersteht einen Shell-Neustart
- [x] Einstempeln nach dem Feierabend hebt den Feierabend auf
- [x] Fehler werden im Panel angezeigt, keine Offline-Warteschlange
- [x] Tests gegen den Fake für `clock-in`/`clock-out` und die Fehlercodes `NETWORK`, `RATE_LIMITED`, `MCP_ERROR`
- [ ] Einmal manuell mit dem Benutzer gegen echtes Calamari abgenommen (erzeugt echte Stempelungen)

## Comments

**2026-09-22 (Agent):** Umgesetzt. Die Logik liegt in `js/shiftclock.mjs` (`applyStamp`, `stampAction`), die Verdrahtung in Service und Panel. Die manuelle Abnahme gegen echtes Calamari steht noch aus. Erkenntnisse (auch in spec.md, Abschnitt „Stempeln“):
- `clockIn`/`clockOut` nehmen keine Argumente. Die Form der Antwort ist unbekannt, der Helfer wertet nur `isError` aus. Die Abnahme soll zeigen, ob eine Ablehnung (z.B. Ausstempeln ohne laufende Schicht) wirklich als `isError` kommt.
- Die Abfrage nach `clock-in` prüft die laufende Minute. Das Status-Fenster `[jetzt−2, jetzt]` sieht eine Schicht, die in dieser Minute begann, noch nicht.
- Nach `clock-out` gibt es keine Abfrage, sie könnte wegen des Nachlaufs von 2 Min nichts entscheiden. Der Service ignoriert in dieser Zeit „läuft“ und sucht eine Folgeschicht erst ab der Minute nach dem Ausstempeln. Das Feld `noShiftSince` im Zustand heißt dafür jetzt `searchAfter`.
- Nach einem Fehlschlag bleiben Status und Button stehen, damit man es erneut versuchen kann. Danach wird sofort der echte Status abgefragt, außer bei `RATE_LIMITED`.
- Eine laufend gemeldete Schicht hebt den Feierabend auf, auch wenn sie im Web gestempelt wurde.

**2026-09-22 (Agent):** Mit dem Benutzer gegen echtes Calamari abgenommen, Teil 1:
- Ausstempeln um 11:17: Das Panel zeigt „Feierabend seit 11:17“, die Bar bleibt auch nach Ablauf der 2 Min Nachlauf grau.
- Wieder eingestempelt um 11:21: Die Bar ist grün und zeigt `0:00`, der Feierabend ist aufgehoben.
- `clockOut` ohne laufende Schicht wird mit `isError: true` abgelehnt. Der Text ist nur allgemein („Error has occurred. We are working to solve it.“, doppelt) und lässt sich nicht von einer Serverstörung unterscheiden. Der Helfer meldet `MCP_ERROR`.
- Gefunden und behoben: `status` meldete um 11:21:45 „läuft nicht“, erst ab 11:22:00 „läuft“. Eine Abfrage in der Minute des Einstempelns (z.B. beim Öffnen des Panels) hätte die Bar bis zur nächsten Abfrage grau gemacht. Der Service ignoriert das jetzt in dieser Minute.
