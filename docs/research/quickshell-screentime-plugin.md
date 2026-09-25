# quickshell-screentime-plugin: woraus die Optik besteht und was davon zu uns passt

Recherchenotiz, keine Entscheidung. Sie beschreibt, was das fremde Plugin grafisch tut, wie es
technisch gebaut ist und welche Teile für Calamari Tracker inhaltlich tragen. Entscheidungen, die
daraus folgen, gehören nach `docs/adr/`.

## Stand der Quelle

Gelesen wurde der lokale Checkout `~/.config/omarchy/plugins/agx.screen-time`. Sein `origin` ist
`https://github.com/ax1g/quickshell-screentime-plugin.git`, er steht auf Commit
`2c7b75abde55b23ee6d6e1356797c8f50f60b8a1` vom 2026-09-17 („fix(panel): parent gear tooltip to its
hit area"), Branch `main`, Arbeitsbaum sauber, keine lokalen Änderungen. `manifest.json` nennt
Version 1.6.2. Ob `origin/main` inzwischen weitergelaufen ist, wurde nicht geprüft — es wurde kein
`fetch` ausgeführt; alle Aussagen unten beziehen sich auf genau diesen Commit. Dateipfade des
fremden Projekts sind relativ zu diesem Checkout angegeben, Pfade ohne Präfix gehören zu uns.

## Was das Vorschaubild zeigt

`preview.png` ist ein Werbebild, keine Bildschirmaufnahme, aber es zeigt echte Oberfläche. Drei
Flächen liegen darauf gestapelt.

In der Mitte das Hauptpanel: oben links ein Sanduhr-Glyph, daneben groß „4h" und darunter klein
„Sep 12, 2026"; rechts oben ein Zahnrad und „SHOW LESS" mit Dreieck. Darunter links ein Donut-Ring
aus blauen, violetten und pinken Segmenten mit „Sep 12 / 4h" in der Mitte, rechts daneben eine
Legende aus runden Farbpunkten mit App-Name und Zeit (zen 2h 13m, nvim 1h 26m, vscode 13m, fish 4m,
agent 2m, cliamp 1m). Darunter eine Zeile mit Pfeilen links und rechts um „Sep 7 – 13, 2026 · W37"
und ganz rechts „19%". Darunter ein Balkendiagramm Mon–Sun: helle, oben abgerundete Säulen auf drei
sehr schwachen waagerechten Linien, deren Beschriftung rechts außen „11h", „5h", „0h" lautet; der
Samstagsbalken ist blau abgesetzt (das ist der ausgewählte Tag, nicht eine zweite Farbskala).
Ganz unten drei Zeilen mit Symbol, Beschriftung und Wert: blauer gefüllter Stern „Top app" —
„zen · (55%) 2h 13m", grüner Pfeil nach unten-rechts „vs Yesterday" — „− 6h 46m" in Grün, roter
hohler Stern „Busiest day (7d)" — „Fri · 10h 46m".

Oben rechts die Einstellungen als eigene Fläche: Zahnrad-Glyph, „Settings", darunter klein
„Display, tracking, goals & data", rechts „‹ BACK"; darunter eine hellere Karte „COLORS" mit zwei
Einträgen, jeder mit Titel, erklärender Zeile und einer Reihe runder Farbfelder plus einem
Rücksetz-Pfeil. Davor eine rot umrandete Karte „DANGER ZONE" mit zwei Zeilen und den Knöpfen
„RESET" und „WIPE ALL" in Rot.

Unten rechts die Jahresansicht: Kalender-Glyph, groß „241h", darunter „‹ 2026 ›", rechts „‹ BACK".
Darunter zwölf Zeilen aus Monatskürzel, waagerechtem Balken und Stundenzahl rechts — Aug mit langem
lavendelfarbenem Balken und „159h", Sep mit kürzerem türkisem Balken und „82h", Oct/Nov/Dec mit „8h"
und ohne sichtbaren Balken. Türkis ist hier die Akzentfarbe des Themes, die den laufenden Monat
markiert. Darunter „Insights 2026" und vier Karten in zwei Spalten unterschiedlicher Höhe
(SCREEN SHARE, TOP MONTHS mit Medaillen-Emoji, DAY COUNT, LONGEST STREAK), jede mit farbigem Glyph,
Kleinbuchstaben-Titel, fetter Kennzahl und einer grauen Erklärzeile.

## Wie das gebaut ist

Der auffälligste Befund ist, wie wenig Technik dahintersteckt. Es gibt genau ein `Canvas` im ganzen
Projekt — den Donut. Alles andere ist `Rectangle`, `Text`, `Row`, `Column`, `Repeater` und
`Flickable`. Kein `Shape`, kein `PathLine`, kein `ShaderEffect`, keine Grafikbibliothek, keine
Bilddateien in der Oberfläche.

**Der Donut** liegt in `qml/components/DonutChart.qml`. Die Ringe malt ein `Canvas` in `onPaint`
(Z. 100–127) als Folge von `ctx.arc`-Strichen mit `lineWidth` gleich `Style.space(14)`; ohne Daten
zeichnet es einen einzelnen Ring in 10 % Vordergrundfarbe (Z. 110–117). Die Kommentarzeile 6 nennt
den Grund für `Canvas` statt `Shape`: „Shape won't host a Repeater". Die Winkel kommen nicht aus
QML, sondern aus `js/Model.js:1086` (`arcSegments`): Start bei −90°, Anteil mal 360° minus einer
festen Lücke pro Segment. Die Farben liefert `sliceColors` (`js/Model.js:1050`), das die Akzentfarbe
des Themes in HSL zerlegt und den Farbton pro Segment weiterdreht — bei grauem Akzent stattdessen
eine Helligkeitsrampe. Der Ring ist anfassbar, ohne dass es Elemente pro Segment gäbe: ein einziges
`MouseArea` rechnet in `sliceAt` (Z. 56–77) aus Radius und Winkel zurück, welches Segment unter dem
Zeiger liegt; das getroffene bleibt voll deckend, alle anderen fallen auf Alpha 0.25 (Z. 122), und
die Mitte schaltet von Tagesdatum/Tagessumme auf App-Name/App-Zeit um (Z. 149–175).

**Das Wochendiagramm** ist reine Rechteck-Komposition. Eine Säule ist `qml/components/WeekDayBar.qml`:
ein `Rectangle` halb so breit wie seine Spalte, `radius: Style.space(2)`, Höhe
`Style.space(64) * ms / axisMax` mit 3 px Untergrenze (Z. 33), unten am Wochentagskürzel verankert.
Die Farbe ist eine einzige verschachtelte Bedingung (Z. 38): Zukunft und leere Tage 10 %
Vordergrund, der gewählte Tag Akzentfarbe, unter dem Zeiger aufgehellt, sonst 90 % Vordergrund.
Die Gitterlinien sind `qml/components/WeekTick.qml`: ein 1 px hohes `Rectangle` in 6 %
Vordergrundfarbe (Z. 29), das mit derselben Formel positioniert wird wie die Balkenhöhe (Z. 21),
damit Balkenoberkanten auf Linien landen, und rechts außen die Stundenbeschriftung. Beides hängt in
`qml/WeekTrend.qml:186–238`: erst der Tick-`Repeater`, dann mit `z: 2` darüber die Säulen.
Die Kopfzeile darüber (Z. 38–181) ist Pfeil–Datumsbereich–Pfeil links, Pokal und Wochensumme
rechts, wobei die Summe per Klick zwischen Stunden und Prozent der 168 Wochenstunden umschaltet.

**Die Monatszeilen** der Jahresansicht (`qml/MonthRow.qml`) sind dasselbe Muster liegend: Kürzel
links in fester Breite, ein `Rectangle` mit `width = verfügbar * ms / max`, Stundenzahl rechts
rechtsbündig. Der laufende Monat bekommt Akzentfarbe und Fettschrift, die übrigen 55 % Deckkraft
(Z. 36, 54, 82). Bemerkenswert ist der Kommentar Z. 46–47: es gibt bewusst **keine** Hintergrundspur
hinter dem Balken, weil eine schwach gefüllte volle Zeile wie ein Ladebalken wirkt statt wie ein
Messwert.

**Die Insight-Karten** (`qml/components/InsightCard.qml`) sind ein `Rectangle` mit
`radius: Style.space(6)`, Füllung 6 % und Rand 8 % der Vordergrundfarbe, innen Glyph plus
Kleinbuchstaben-Titel, dann die Kennzahl (als `Text.RichText`, damit Medaillen-Markup geht) und eine
graue Erklärzeile. Die Höhe folgt dem Inhalt. Zweispaltig angeordnet werden sie in
`qml/YearDrawer.qml:325–393` von Hand: `splitCards` schätzt über `estimateLines` die Zeilenzahl jeder
Karte aus Textlänge und Spaltenbreite und verteilt sie auf die kürzere Spalte — ein
Mauerwerk-Layout ohne Layout-Engine, in etwa dreißig Zeilen JavaScript.

**Die einzeiligen Muster-Zeilen** unter dem Wochendiagramm sind `qml/components/InsightList.qml`.
Wichtig daran ist die Trennung: die Datenzeile trägt `kind` und `dir` als Bedeutung, und erst die
Funktionen `insightIcon`/`insightIconColor` (Z. 30–53) übersetzen das in Stern, Pfeil und Farbe. Die
Farben selbst kommen wieder aus dem Theme (`js/Model.js:1069` `insightColors`), nicht aus festen
Hexwerten; nur die Richtung „runter" ist auf Farbton 155 (grün) festgenagelt.

**Der Kopfbereich** `qml/components/HeroHeader.qml:243–305` ist das, was das Panel sofort teuer
aussehen lässt, und er ist trivial: eine `Column` mit der Tagessumme in `Style.fontPx(1.5)` fett,
darunter das Datum in `Style.font.caption` und gedunkelter Farbe, darunter — nur wenn ein Tagesziel
gesetzt ist — ein 3 px hoher Fortschrittsbalken aus zwei `Rectangle` (Spur in 15 %, Füllung in 55 %
bzw. voller Vordergrundfarbe bei erreichtem Ziel) und eine Restzeit-Zeile.

**Die Kleinteile** lohnen einzelne Erwähnung, weil sie die Handschrift ausmachen:

- `qml/components/HintBadge.qml` — das Tastenkürzel-Kästchen für den Tastaturmodus. Solide
  Akzentfarbe, und die Schriftfarbe wird aus `accent.hslLightness` gewählt (Z. 32), damit der
  Buchstabe auf hellen wie dunklen Akzentfarben lesbar bleibt. Unsichtbar hat es Breite und Höhe 0
  (Z. 21–22), verschiebt also nie das Layout, und es hat kein eigenes `MouseArea`, Klicks gehen
  hindurch.
- `qml/components/AppLegend.qml:72–82` — ein 2 px breiter, abgerundeter Scrollbalken, der nur
  erscheint, wenn der Inhalt überläuft, und dessen Position aus `contentY` gerechnet wird. Dasselbe
  Muster steht wortgleich noch zweimal im Projekt (`qml/Panel.qml:732–742`, `qml/YearDrawer.qml:400–410`).
- `qml/components/PagerArrow.qml` und `qml/components/BackButton.qml` — Glyph-Knöpfe, die unter dem
  Zeiger von `Qt.darker(foreground, 1.4)` auf volle Vordergrundfarbe wechseln und deaktiviert auf
  Deckkraft 0.25 fallen, mit weicher Überblendung. „BACK" steht in Großbuchstaben mit
  `font.letterSpacing: 1.2` — dasselbe gilt für „SHOW MORE" (`HeroHeader.qml:213`). Diese gesperrten
  Versalien sind der typografische Kniff des ganzen Plugins.
- `qml/components/ScreenTip.qml` — ein `ToolTip` aus `QtQuick.Controls` mit 300 ms Verzögerung,
  damit das Überstreichen mehrerer Balken nicht flackert.
- `qml/components/Sparkle.qml` und `HeroHeader.qml:39–74, 111–143, 158–166` — die Spielereien: die
  Sanduhr dreht sich zur vollen Stunde und beim Zurückkehren ins Hauptpanel, sechs goldene Funken
  steigen beim Überfahren auf, das Zahnrad macht beim Öffnen der Einstellungen eine Umdrehung, das
  Kalendersymbol schwingt beim Einfahren wie ein Pendel (`qml/YearDrawer.qml:101–119`). Alles hängt
  an einem Schalter „Playful extras", der es komplett stilllegt.

**Der Seitenwechsel** schließlich: Jahresansicht und Einstellungen sind keine ausgetauschten
Inhalte, sondern Schubladen, die über das Hauptpanel fahren (`qml/Panel.qml:450–524`). Ein `Item` in
voller Panelgröße sitzt bei `x = ±Breite` und fährt per `Behavior on x` in 200 ms mit `OutCubic` auf
0. Der Trick daran ist das Flag `sliding`: es schaltet die Animation nur beim bewussten Umschalten
ein und wird bei Erreichen der Ruhelage wieder ausgeschaltet (Z. 471–474), damit eine
Größenänderung des Panels die Schublade nicht quer über den Bildschirm fliegen lässt.

## Wovon das Gezeigte abhängt

Erfreulich wenig. Die entscheidende Prüfung: die Shell-Schnappschüsse unter `lint/qs/` beider
Projekte sind byteweise identisch — `Commons/Style.qml`, `Commons/Color.qml`, `Ui/BarWidget.qml`,
`Ui/Panel.qml` und `Ui/WidgetButton.qml` stimmen exakt überein. Beide Plugins sprechen also dieselbe
Shell-API derselben Version (hier Omarchy 4.0.0.alpha) und benutzen dieselben Bausteine: `Style.space()`,
`Style.fontPx()`, die Schriftgrößen-Marken `Style.font.caption/bodySmall/body/title/icon` und die
Farbrollen aus `Color`. Eigene Style-Token bringt das fremde Plugin nicht mit; seine Farbverläufe
rechnet es zur Laufzeit aus `Color.accent`, `Color.foreground`, `Color.muted` und `Color.urgent`
(`js/Model.js:1013–1078`). Das heißt: übernommene Bausteine sind ohne Anpassung themefähig.

An Qt-Modulen kommt außer `QtQuick` nur `QtQuick.Controls` hinzu, und das genau einmal, für den
Tooltip (`qml/components/ScreenTip.qml:2`). Dieses eine Stück brauchen wir nicht: die Shell liefert
`Ui/PanelToolTip.qml`, und unser `qs.Ui.Button` rendert schon von sich aus einen Tooltip, sobald
`tooltipText` gesetzt ist (`lint/qs/Ui/Button.qml:25, 131`).

Zwei Shell-Bausteine benutzt das fremde Plugin, die wir noch nicht kennen: `PanelSeparator`
(`qml/Panel.qml:877`, `qml/YearDrawer.qml:305`) und `ToggleSwitch` (`qml/components/ConfigMenu.qml:332`).
Beide liegen in `/usr/share/omarchy/shell/Ui/`, fehlen aber in unserer Liste in `lint/refresh.sh:12`
— wer sie verwendet, muss die Zeile ergänzen, sonst schlägt `qmllint` fehl.

Das Python-Verzeichnis des fremden Plugins (`python/resolve_app.py`) hat mit der Grafik nichts zu
tun; es löst Terminal- und Steam-Prozesse in Anwendungsnamen auf. Die eigene Datenhaltung
(`~/.config/omarchy/screen-time/history.json`) dagegen ist die eigentliche Abhängigkeit — dazu unten
mehr.

## Was inhaltlich auf uns passt

Der entscheidende Unterschied ist nicht technisch, sondern datenseitig. Screen Time führt ein
Archiv: Tage, Monate und ein ewiger Tagesspeicher pro Jahr. Wir führen keins. `emptyState()` und
`forToday()` in `js/shiftclock.mjs:45–63` setzen den Zustand bei jedem Tageswechsel zurück; was
bleibt, sind nur Aktivitätsfelder und das Merkmal `unclosed`. Alles, was beim fremden Plugin über
mehr als den heutigen Tag geht — Wochendiagramm, Monatszeilen, Jahresübersicht, Streaks, „vs
Yesterday", der Pokal für die beste Woche —, hat bei uns schlicht keine Datengrundlage. Das ließe
sich nachrüsten, wäre aber ein eigenes Vorhaben (Historie schreiben, aufräumen, migrieren) und
widerspräche der Linie aus `CONTEXT.md`, dass Calamari die einzige Quelle der Wahrheit ist. Diese
Darstellungen sind also nicht „aufwendig", sondern gegenstandslos, solange wir keine Historie führen.

Was dagegen trägt:

**Der Kopfbereich mit Fortschrittsbalken** (`qml/components/HeroHeader.qml:243–305`) passt fast
unverändert. Unser Hauptpanel ist heute eine Folge gleichrangiger Textzeilen in `Style.font.body`
(`Panel.qml:102–167`) — es gibt keine Hierarchie, die Schichtdauer sieht aus wie die Fehlermeldung.
Dieselbe Anordnung mit großer Zahl (die laufende Schichtdauer aus `ShiftClock.barView`), kleiner
Zeile darunter („Schicht läuft seit 08:14" oder „Feierabend seit 17:30") und darunter dem dünnen
Balken würde sofort tragen. Für den Balken haben wir sogar zwei sinnvolle Bezugsgrößen, die Screen
Time nicht hat: den Fortschritt durch die Kernzeit (`js/daycalendar.mjs:37` liefert sie als
`{start, end}` in Minuten) oder die heute beobachtete Arbeitszeit gegen ein Tagessoll
(`ShiftClock.workedMinutes`). Die Restzeit-Zeile darunter („noch 2:15 bis Ende der Kernzeit") ersetzt
eine unserer heutigen Textzeilen, statt eine hinzuzufügen.

**Die liegende Balkenzeile** aus `qml/MonthRow.qml:48–74` — Beschriftung links, Balken proportional,
Zahl rechts — ist die Form, die am besten auf unseren Tag passt, aber in einer Abwandlung: nicht
zwölf Zeilen für Monate, sondern eine Zeile als Zeitstrahl des Tages. Wir haben dafür alles:
`state.shifts` ist eine Liste `{start, end}` in HH:MM (`js/shiftclock.mjs:122–124`), `startedAt` die
laufende Schicht, `breakSince`/`breakMinutes` die Pause, `coreTime` das erwartete Fenster. Eine
einzige Zeile von Kernzeit-Anfang bis -Ende, in der Schichten voll gefüllt und Pausen ausgespart
sind, plus eine Markierung für „jetzt", beantwortet auf einen Blick, was heute zwölf Textzeilen nicht
beantworten. Das ist nicht Code-Übernahme, sondern dasselbe Bauprinzip: `Rectangle` mit
`radius: Style.space(2)`, Breite aus einem Verhältnis, Akzentfarbe für das Laufende, 10 %
Vordergrund für das Leere — und ausdrücklich ohne Hintergrundspur hinter den gefüllten Teilen, aus
dem in `MonthRow.qml:46` genannten Grund. Der `ScreenTip` pro Balken wird bei uns ein `tooltipText`.

**Der Donut** passt inhaltlich nicht, und das sollte man klar sagen. Er lebt davon, dass eine Summe
in sechs bis zwanzig ungleiche Teile zerfällt. Unser Tag zerfällt in Arbeit und Pause, gelegentlich
mit einer zweiten Schicht — zwei bis drei Segmente, von denen eines fast immer über 80 % hat. Ein
Ring mit zwei Segmenten sagt weniger als eine Zahl. Übertragbar ist allenfalls die *Technik* für
einen ganz anderen Zweck: ein einzelner Bogen als Fortschrittsanzeige („X von Y Stunden"), der als
`Canvas` mit zwei `ctx.arc`-Aufrufen in etwa fünfzehn Zeilen fertig ist. Ob ein Ring dafür besser
ist als der 3 px-Balken aus dem Kopfbereich, ist Geschmack; der Balken ist erheblich billiger und
fügt sich ruhiger ein.

**Die Einstellungen als Sektionskarten** sind der zweite große Gewinn, und zwar als Idee, nicht als
Code. Unsere `SettingsForm.qml` reiht 22 Felder aus dem Manifest-Schema flach untereinander
(`SettingsForm.qml:71–110`), jedes mit einer vollen Beschriftungszeile darüber — eine Liste ohne
Gliederung, durch die man scrollt. Screen Time gruppiert in getönte Karten mit Überschrift
(`qml/components/ConfigMenu.qml`, die Abschnitte beginnen bei Z. 234, 369, 674, 827, 937, 1442, 1553)
und stellt Gefährliches getrennt in eine rot umrandete „DANGER ZONE" (Z. 1553 ff.). Unser Schema hat
längst erkennbare Gruppen: Abfrage und Erinnerungen, Pause, Kernzeiten der sieben Wochentage,
Verbindung (Web- und API-URL), Projekt und Pausentyp. Sieben Kernzeit-Felder als eigene Karte mit
einer gemeinsamen Erklärung statt sieben langen Einzelbeschriftungen wäre allein schon eine
spürbare Verbesserung. Zu beachten: `ConfigMenu.qml` ist mit 1887 Zeilen die größte Datei des
fremden Projekts und vollständig an dessen Prefs geknüpft — hier etwas zu kopieren wäre falsch;
nachzubauen ist das Prinzip in wenigen `Rectangle`-Abschnitten um unsere vorhandene `Repeater`-Schleife.

**Der dünne Scrollbalken** (`qml/components/AppLegend.qml:72–82`) ist das billigste Stück auf dieser
Liste: zehn Zeilen, eine `Flickable` als Bezug. Unsere Einstellungsseite scrollt heute ohne jeden
Hinweis darauf, dass da noch mehr ist (`SettingsForm.qml:59–64`).

**Die gesperrten Versalien** für Sekundäraktionen („SHOW MORE", „BACK") und die
Hover-Aufhellung von `Qt.darker(foreground, 1.4)` auf volle Vordergrundfarbe sind reine Typografie
und kosten nichts. Unsere Knöpfe sind alle `bordered: true` und damit gleich laut; „Abbrechen" und
„Speichern" nebeneinander (`SettingsForm.qml:124–137`) sind optisch gleichrangig, obwohl sie es nicht
sind.

**Der Schubladen-Wechsel** (`qml/Panel.qml:450–524`) passt auf unsere drei Seiten „main", „menu",
„settings", die heute nur über `visible:` umgeschaltet werden (`Panel.qml:81–99`). Das ist eine
echte Verbesserung der Orientierung, aber sie hat einen Preis: die Seiten müssen dann gleichzeitig
existieren und Panelgröße füllen, und unsere Panelbreite ändert sich beim Wechsel auf „settings"
bereits von 320 auf 420 (`Panel.qml:65`). Das zusammenzubringen ist mehr Arbeit, als es aussieht.

**Der Tastaturmodus** mit `HintBadge` (`qml/Panel.qml:398–442` für die Tastenbehandlung) ist
handwerklich schön, lohnt bei uns aber kaum: das fremde Panel hat Dutzende anfassbarer Dinge, unser
Hauptpanel hat fünf Knöpfe, die ein `PanelKeyCatcher` ohnehin schon erreichbar macht. Die
Lesbarkeits-Idee aus `HintBadge.qml:32` — Schriftfarbe aus der Helligkeit der Hintergrundfarbe
wählen — ist trotzdem notierenswert, falls wir je etwas auf Akzentfarbe beschriften.

**Die Spielereien** (Funken, drehende Sanduhr, schwingender Kalender) passen nicht. Ein Werkzeug,
dessen Zweck es ist, an vergessenes Ausstempeln zu erinnern, gewinnt nichts durch Feierlichkeit; und
der Aufwand, sie wie dort hinter einem Schalter abschaltbar zu halten, steht in keinem Verhältnis.

## Lizenz

`LICENSE` des fremden Projekts ist die MIT-Lizenz im Standardwortlaut, „Copyright (c) 2026 agx".
Sie erlaubt Benutzen, Kopieren, Ändern, Zusammenführen, Veröffentlichen und Weitergeben ohne
Einschränkung. Die einzige Bedingung ist, dass der Urheberrechtsvermerk **und** der Lizenztext in
allen Kopien oder wesentlichen Teilen der Software enthalten bleiben. Es ist kein Copyleft: unser
Projekt muss deswegen nicht MIT werden, und wir müssen unseren eigenen Code nicht offenlegen. Eine
Änderungspflicht oder Namensnennung in der Benutzeroberfläche gibt es nicht.

Wir deklarieren in `manifest.json` selbst `"license": "MIT"`. Im Repository liegt allerdings **keine
`LICENSE`-Datei** — das ist unabhängig von dieser Recherche eine Lücke und wird spätestens dann
eine, wenn fremder MIT-Code dazukommt, weil dessen Lizenzhinweis irgendwo stehen muss.

Code-Übernahme ist damit zulässig, unter einer Auflage: den Vermerk mitführen. Praktisch heißt das
eine Zeile im Dateikopf der übernommenen Datei („Abgeleitet von ax1g/quickshell-screentime-plugin,
Commit 2c7b75a, MIT, Copyright (c) 2026 agx") und der vollständige MIT-Text samt Copyright-Zeile
irgendwo im Repository — üblicherweise als `LICENSE` (unser eigener) plus ein Abschnitt darin oder
eine Datei wie `THIRD-PARTY-LICENSES` für fremde Bestandteile.

Davon zu trennen ist das Nachbauen einer Idee. „Balken in einer Zeile mit Beschriftung links und
Zahl rechts", „großer Zahlenwert mit dünnem Fortschrittsbalken darunter", „Einstellungen in getönte
Abschnittskarten gruppieren", „dünner Scrollbalken nur bei Überlauf" sind Gestaltungskonzepte, an
denen niemand Rechte hält. Wer sie eigenständig in eigenem Code umsetzt, löst keine Lizenzpflicht
aus. Die Grenze verläuft dort, wo man die fremde Datei öffnet und ihren Aufbau Zeile für Zeile
übernimmt — dann ist es eine Ableitung, und der Vermerk gehört dazu. In Zweifelsfällen ist der
Vermerk billig; er kostet drei Zeilen.

Ein Punkt in eigener Sache: `lint/README.md` hält bereits fest, dass unsere `Quickshell/`-Stubs von
ax1g/quickshell-screentime-plugin stammen und MIT sind. Stichproben bestätigen das —
`lint/Quickshell/Quickshell.qml`, `Io/Process.qml`, `Io/IpcHandler.qml` und `Io/JsonAdapter.qml`
sind byteweise identisch mit denen des fremden Checkouts, `Io/FileView.qml` weicht ab (offenbar von
uns erweitert). Der Hinweis nennt Quelle und Lizenz, gibt aber weder die Copyright-Zeile noch den
Lizenztext wieder. Das ist heute schon die Auflage, die die MIT-Lizenz stellt, und sollte
nachgezogen werden — unabhängig davon, ob wir zusätzlich Oberflächencode übernehmen.

## Vorschläge, nach Wirkung je Aufwand

1. **Kopfbereich mit Fortschrittsbalken** im Hauptpanel. Größte sichtbare Wirkung, kleinster
   Eingriff; die Daten liegen alle vor. Vorbild `qml/components/HeroHeader.qml:243–305`, Ziel
   `Panel.qml:102–167`.
2. **Dünner Scrollbalken** auf der Einstellungsseite. Zehn Zeilen, sofort spürbar. Vorbild
   `qml/components/AppLegend.qml:72–82`, Ziel `SettingsForm.qml:59–64`.
3. **Typografische Hierarchie**: gesperrte Versalien für Sekundäraktionen, gedunkelte Ruhefarbe mit
   Aufhellung unter dem Zeiger, „Speichern" nicht gleich laut wie „Abbrechen". Kostet fast nichts.
   Vorbild `qml/components/BackButton.qml:22–38`, `qml/components/HeroHeader.qml:207–223`.
4. **Tageszeitstrahl** als eine liegende Balkenzeile über Kernzeit, Schichten und Pausen. Inhaltlich
   der stärkste Zugewinn, aber neuer Code (die fremde Vorlage taugt nur als Bauprinzip). Vorbild
   `qml/MonthRow.qml:48–74`, Daten aus `js/shiftclock.mjs:46, 122–143` und `js/daycalendar.mjs:37`.
5. **Einstellungen in Abschnittskarten**, insbesondere die sieben Kernzeit-Felder als eine Gruppe.
   Deutliche Verbesserung, aber Eingriff in `SettingsForm.qml` und vermutlich ins Schema
   (Gruppenzugehörigkeit müsste das Manifest mitliefern). Prinzip aus `qml/components/ConfigMenu.qml`,
   kein Code daraus.
6. **Schubladen-Wechsel zwischen den Panelseiten**. Schön, aber Aufwand und Risiko am größten wegen
   der unterschiedlichen Panelbreiten. Vorbild `qml/Panel.qml:450–524`.
7. **Nicht übernehmen**: Donut als Tagesaufteilung, Wochen- und Jahresansicht, Pokal und Streaks
   (keine Historie), Funken und Drehungen (falscher Ton), `ScreenTip` (die Shell hat
   `PanelToolTip`, unser `Button` hat `tooltipText`), Tastenkürzel-Modus (zu wenige Bedienelemente).

## Offen

- Ob `origin/main` seit dem 2026-09-17 weitergelaufen ist, wurde nicht geprüft (kein `fetch`). Alle
  Zeilenangaben gelten für Commit `2c7b75a`.
- Wie sich die Oberfläche tatsächlich anfühlt, wurde nicht beobachtet: das Plugin wurde nicht
  gestartet. Alle Aussagen über Bewegung und Verhalten stammen aus dem Quelltext und dem
  Vorschaubild, nicht aus dem Betrieb.
- Die Zahlen und Farben in `preview.png` sind gesetzt, nicht gemessen; ob dort ein reales Theme
  abgebildet ist, lässt sich von außen nicht sagen.
- Ob `PanelSeparator` und `ToggleSwitch` in der installierten Shell dieselbe Schnittstelle haben wie
  zum Zeitpunkt des fremden Commits, wurde nicht geprüft — die Dateien existieren in
  `/usr/share/omarchy/shell/Ui/`, ihr Inhalt wurde nicht gelesen.
- Nicht geprüft wurde, ob unser `qs.Ui`-Baukasten (`Button`, `TextField`, `BorderSurface`,
  `BarIconButton`) Teile der oben beschriebenen Gestaltung bereits fertig mitbringt. Das gehört vor
  jeden Nachbau: die Shell zuerst durchsehen, dann selbst zeichnen.
