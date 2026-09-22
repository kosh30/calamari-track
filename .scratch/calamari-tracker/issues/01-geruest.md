# 01: Gerüst: Plugin erscheint in der Bar

**What to build:** Das Plugin `kosh.calamari-tracker` ist aus dem Repo per Symlink in omarchy-shell installiert und aktiviert. In der Bar erscheint ein statisches Icon, ein Klick öffnet ein leeres Panel. Änderungen an den Plugin-Dateien werden beim Speichern neu geladen. Beide Test-Runner (Node für die Erinnerungslogik, Python-`unittest` für den Calamari-Helfer) laufen mit je einem Platzhaltertest. Das Projekt ist ein git-Repo mit sinnvollem `.gitignore` (u.a. keine Secrets, kein State).

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] git-Repo initialisiert, `.gitignore` vorhanden
- [x] Manifest mit ID `kosh.calamari-tracker`, Kinds `service` + `bar-widget`, dauerhaft geladen
- [x] Symlink ins Plugin-Verzeichnis von omarchy-shell, Plugin per `omarchy plugin enable` aktivierbar
- [x] Icon in der Bar sichtbar, Klick öffnet und schließt ein leeres Panel
- [x] Hot-Reload beim Speichern funktioniert (Widget/Panel; `Service.qml` ist keepLoaded und braucht `omarchy-restart-shell`)
- [x] `node --test` und `python3 -m unittest` laufen grün mit je einem Platzhaltertest
- [x] qmllint-Stubs (nach Vorbild des Screen-Time-Plugins) vorhanden, qmllint läuft ohne Fehler
