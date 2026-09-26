# Keine Schubladen zwischen den Panelseiten

Die Seiten „main“, „menu“ und „settings“ wechseln weiterhin hart über `visible:`
(`Panel.qml`). Ein animierter Wechsel, bei dem die Seiten als Schubladen seitlich
ein- und ausfahren, wird nicht gebaut. Das ist Vorschlag 6 aus
[der Recherche zur Panel-Optik](../research/quickshell-screentime-plugin.md); die
Recherchenotiz ist ein Schnappschuss und trifft selbst keine Entscheidung, darum
steht sie hier.

Der Gewinn einer Schublade ist Orientierung: zu sehen, wo man herkommt und wohin
man geht. Den kann unsere Navigation nicht einlösen, weil es im Panel keinen
Rückweg gibt. „Abbrechen“ und „Speichern“ auf der Einstellungsseite rufen
`done()`, und das schließt das ganze Panel (`SettingsForm.qml`, `Panel.qml`);
einen Zurück-Knopf trägt keine Seite. Der einzige Weg von den Einstellungen
zurück ins Menü ist ein Rechtsklick auf das Bar-Symbol (`Widget.qml`) — eine
Handlung außerhalb des Panels, also genau dort, wo eine räumliche Zurück-Geste
nicht wohnt. Eine Schublade, die von rechts einfährt und dann zusammen mit dem
ganzen Panel verschwindet, lehrt ein räumliches Modell, das die Bedienung nicht
einhält. Das ist kein Halt, das ist Schmuck.

Dazu ist „menu“ eine einzige Schaltfläche, und jeder Seitenwechsel kommt aus
einer bewussten Handlung: Rechtsklick auf das Bar-Symbol für das Menü,
Linksklick für das Hauptpanel, ein Klick auf genau diese eine Schaltfläche für
die Einstellungen. Wer dort steht, weiß, wie er hinkam.

## Consequences

- **Nichts in der Kette unter `KeyboardPanel` schneidet ab.** Das ist die
  eigentliche Härte, an der die Schubladen scheitern: gleichzeitig existierende
  Seiten brauchen ein abschneidendes Sichtfenster, sonst zeichnen die fahrenden
  Seiten neben die Karte. Darauf verlässt sich der Scrollbalken der
  Einstellungen, der absichtlich in den Rand des Panels hinausragt
  (`SettingsForm.qml`): Fängt irgendetwas in dieser Kette an abzuschneiden, ist
  er lautlos weg, und weder `qmllint` noch die Tests sehen das.
- Es wird immer nur eine Seite gezeigt. Die übrigen stehen auf `visible: false`
  — sie liegen weiter im Baum, zählen aber weder zur Höhe der Spalte noch zur
  Tab-Reihenfolge. Ein laufender Wechsel kann keine Seite unerreichbar machen,
  weil es keinen laufenden Wechsel gibt.
- **Die Höhe folgt der sichtbaren Seite ohne Animation.** `contentHeight`
  liest die `implicitHeight` der Seite, und die ändert sich auch ohne
  Seitenwechsel: eine Fehlermeldung erscheint, die Schichtdauer wird länger,
  die Anmeldezeile wechselt. Vor allem aber gilt hier der erste Punkt oben:
  Nichts schneidet ab, also zeichnet eine Karte, die auf ihre volle Höhe
  wächst, den Rest des Formulars für die Dauer der Bewegung auf den Desktop —
  gemessen mit einem `Behavior on contentHeight` standen „Pausen-Erinnerung“,
  „Feierabend“ und die Felder darunter ohne Karte dahinter auf dem
  Hintergrundbild. Eine bewegte Höhe braucht damit dasselbe abschneidende
  Sichtfenster wie die Schubladen und scheitert an derselben Härte.
- **Die Breite tut es nicht mehr.** Der Sprung von 320 auf 420 beim Wechsel auf
  die Einstellungen ist seit [#12](https://github.com/kosh30/calamari-track/issues/12)
  eine Bewegung. Das war hier schon als eigene und viel kleinere Frage angelegt,
  und sie ist es geblieben: die Breite liest nur die sichtbare Seite und den
  Bildschirm, nie den Inhalt, und ein Seitenwechsel im offenen Panel ist das
  einzige, was sie bewegt. Weder Abschneiden noch gleichzeitig existierende
  Seiten sind dafür nötig.
