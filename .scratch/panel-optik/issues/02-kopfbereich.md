# 02: Kopfbereich im Hauptpanel

**What to build:** Das Hauptpanel bekommt eine Hierarchie. Oben steht die laufende Schichtdauer als größte Zahl der Seite, darunter klein und gedunkelt ihre Einordnung („Schicht läuft seit 08:14", „Feierabend seit 17:30"), darunter ein dünner Fortschrittsbalken durch die Kernzeit mit einer Restzeit-Zeile („noch 2:15 bis Ende der Kernzeit"). Heute stehen alle Angaben als gleichrangige Zeilen untereinander, sodass die Schichtdauer aussieht wie eine Fehlermeldung und das Auge keinen Halt findet. Die Restzeit-Zeile ersetzt eine der heutigen Zeilen, statt eine weitere hinzuzufügen.

**Blocked by:** None (can start immediately)

**Status:** umgezogen nach [#2](https://github.com/kosh30/calamari-track/issues/2) (2026-09-25); der aktuelle Stand steht dort, diese Datei ist Archiv.

- [x] Vorab geprüft, welche Teile dieser Gestaltung der Baukasten `qs.Ui` bereits mitbringt; nur der Rest wird selbst gezeichnet, das Ergebnis der Durchsicht ist notiert
- [x] Schichtdauer als größte Zahl, Einordnung darunter kleiner und gedunkelt
- [x] Fortschrittsbalken bezieht sich auf die Kernzeit des Tages; ohne Kernzeit und an freien Tagen entfällt er ersatzlos
- [x] Ohne laufende Schicht, in der Pause und im Fehlerfall bleibt die Seite lesbar — kein leerer Balken, keine sinnlose Zahl
- [x] Farben und Abstände kommen aus den Rollen und Token des Themes, keine festen Hexwerte
- [ ] Mit dem Benutzer angesehen: laufende Schicht, Pause, keine Schicht, Fehlerfall

*Hintergrund: `docs/research/quickshell-screentime-plugin.md`, Vorschlag 1.*

## Comments

**2026-09-25 (Agent):** Umgesetzt bis auf die letzte Zeile: die Abnahme in der laufenden Shell steht noch aus, darum `ready-for-human` und nicht `resolved`.

**Die Durchsicht des Baukastens** (Kriterium 1) — das beantwortet auch die offene Frage aus `docs/research/…` Abschnitt „Offen", ob `qs.Ui` Teile der Gestaltung fertig mitbringt:

- **Einen Fortschrittsbalken gibt es nicht.** Kein `ProgressBar`, `Meter` oder `Gauge` in `Ui/`. `PanelSlider` zeichnet zwar Spur und Füllung, ist aber ein ziehbarer Regler mit Knopf und `MouseArea` und lässt sich nicht stillstellen. Die Shell selbst zeichnet lesende Balken von Hand: `plugins/panels/power/Panel.qml:387–420` (Batterie) ist zwei `Rectangle` — Spur in 12 % Vordergrund, Füllung in Vollfarbe, `radius: height / 2`, Breite über `Behavior on width` animiert. Genau diesem Muster folgt unser Balken, mit 15 % für die Spur.
- **Eine „große Zahl" gibt es auch nicht** als Baustein. Die Schriftmarken enden bei `Style.font.displayLarge`; für 1,5× Grundgröße ist `Style.fontPx(1.5)` der richtige Griff (`Style.font.body` ist `fontPx(1.0)`). `Style.font.iconLarge` ist zwar ebenfalls 1,5×, aber eine Symbolgröße, die Themes getrennt überschreiben — deshalb nicht für Text.
- **Gedunkelte Nebentexte** macht die Shell nirgends über eine Farbrolle, sondern mit `Qt.darker(foreground, 1.4)` an der Stelle: `Ui/PanelHero.qml:22`, `Ui/PanelSectionHeader.qml:18`, `Ui/Toggle.qml:86` (1.5), `Ui/TextField.qml:45` (1.6). `Color.muted` existiert als Rolle, wird aber im ganzen Shell-Baum **nirgends** benutzt (geprüft per `grep`) und fällt je nach Theme auf `color8` oder `foreground` zurück. Wir folgen der Shell-Konvention, damit unsere Nebenzeile aussieht wie die Nebenzeilen daneben auf dem Bildschirm.
- **`PanelHero` kommt inhaltlich nah** (Symbol + Titel + gedunkelte Metazeile), taugt hier aber nicht: sein Titel ist `Style.font.title` (1,167×), also gerade keine größte Zahl der Seite. Übernommen ist nur sein Dunkelungsfaktor.
- **Nebenbefund für die Tickets 03, 06 und 07:** `lint/qs/Ui/` schnappt nur 12 der 31 Bausteine, die `Ui/qmldir` der installierten Shell führt. Nicht dabei und erst über `lint/refresh.sh` nachzuziehen, wer sie braucht: `PanelHero`, `PanelSectionHeader`, `PanelSeparator`, `PanelSlider`, `ToggleSwitch`, `Toggle`, `PopupCard`, `Dropdown`, `NumberField`, `ButtonGroup`, `MultiSelect`, `PanelActionButton`, `BarIndicator`, `ConfirmDialog` u. a. Die Recherche nannte nur `PanelSeparator` und `ToggleSwitch`; die Lücke ist größer.

**Gebaut** als `js/panelheader.mjs` (reine Logik, 23 Tests in `js/panelheader.test.mjs`) plus dünnes QML in `Panel.qml`. Das folgt der Linie des Repos: Texte und Entscheidungen sind testbar, das QML bindet nur.

- Die große Zahl ist dieselbe Größe, die die Bar zeigt (`barView.text`) — Bar und Panel können nicht auseinanderlaufen. Wo `barView` keine Dauer kennt (kein Schichtbeginn bekannt, Fehler, Status offen), bleibt sie leer statt erfunden.
- Die Einordnung ist die alte Statuszeile **ohne** die Dauer in Klammern; die Dauer steht jetzt darüber. Ein Test hält fest, dass sie nicht doppelt erscheint.
- Der Balken hängt am **Tag**, nicht an der Schicht: in der Pause, nach dem Feierabend und bei unbekanntem Status zeigt er dieselbe Antwort, weil die Kernzeit vom Schichtstatus nicht abhängt.
- **Vor** Beginn der Kernzeit entfällt er, statt bei null zu stehen: ein leerer Balken liest sich als „nichts geschafft", nicht als „noch nicht angefangen". Nach ihrem Ende ist er voll und sagt „Kernzeit beendet".
- „Heute frei", Feiertage und ganztägige Abwesenheiten nehmen ihn weg, ohne Zutun: `coreTime()` liefert dort schon `null`.

**Vom Code-Review gefunden und behoben:** `coreTime()` liest `state.dayOff` so, wie es dasteht, und der Kopfbereich gab den Zustand ungefiltert weiter. Ein „Heute frei" von gestern hätte damit den heutigen Balken stillschweigend weggenommen — und zwar genau dann, wenn der Zustand nicht mehr fortgeschrieben wird (Status scheitert im Backoff nach einem Neustart, `day-info` kommt aber durch, weil es ein eigener Prozess ist). Der Knopf „Heute frei" hätte dabei aus gezeigt, weil er `dayOffToday()` fragt, und die Stempel-Erinnerungen wären weiter gekommen. `reminders.decide()` hat das Problem nicht, weil es bei einem Zustand von einem anderen Tag ganz aussteigt (`js/reminders.mjs:62`) und `coreTime` gar nicht erreicht. Der Kopfbereich filtert jetzt über `dayOffToday()`; ein Test hält den Fall fest.

**Offen geblieben (bewusst):** `js/panelheader.mjs` buchstabiert „H:MM" selbst, wie `duration()` und `workedText()` in `js/shiftclock.mjs` — drei Stellen für dieselbe Schreibweise. Gehört nach `js/daytime.mjs`, greift aber in ein Modul, das dieses Ticket nicht anfasst; besser als eigene kleine Aufräumarbeit.

**Entschieden mit dem Benutzer:** Die Restzeit-Zeile soll laut Ticket eine bestehende Zeile ersetzen, ohne zu sagen welche. Gewählt: die Titelzeile „Calamari Tracker" fällt weg. Die große Zahl ist der bessere Anker, ein fetter Titel darüber arbeitet gegen die Hierarchie, und „Heute gearbeitet (beobachtet)" bleibt damit erhalten — die Zeile trägt echte Information, die sonst nirgends steht. Die Zeile „Angemeldet als …" bleibt, wo sie war.
