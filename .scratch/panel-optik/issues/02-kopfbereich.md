# 02: Kopfbereich im Hauptpanel

**What to build:** Das Hauptpanel bekommt eine Hierarchie. Oben steht die laufende Schichtdauer als größte Zahl der Seite, darunter klein und gedunkelt ihre Einordnung („Schicht läuft seit 08:14", „Feierabend seit 17:30"), darunter ein dünner Fortschrittsbalken durch die Kernzeit mit einer Restzeit-Zeile („noch 2:15 bis Ende der Kernzeit"). Heute stehen alle Angaben als gleichrangige Zeilen untereinander, sodass die Schichtdauer aussieht wie eine Fehlermeldung und das Auge keinen Halt findet. Die Restzeit-Zeile ersetzt eine der heutigen Zeilen, statt eine weitere hinzuzufügen.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Vorab geprüft, welche Teile dieser Gestaltung der Baukasten `qs.Ui` bereits mitbringt; nur der Rest wird selbst gezeichnet, das Ergebnis der Durchsicht ist notiert
- [ ] Schichtdauer als größte Zahl, Einordnung darunter kleiner und gedunkelt
- [ ] Fortschrittsbalken bezieht sich auf die Kernzeit des Tages; ohne Kernzeit und an freien Tagen entfällt er ersatzlos
- [ ] Ohne laufende Schicht, in der Pause und im Fehlerfall bleibt die Seite lesbar — kein leerer Balken, keine sinnlose Zahl
- [ ] Farben und Abstände kommen aus den Rollen und Token des Themes, keine festen Hexwerte
- [ ] Mit dem Benutzer angesehen: laufende Schicht, Pause, keine Schicht, Fehlerfall

*Hintergrund: `docs/research/quickshell-screentime-plugin.md`, Vorschlag 1.*
