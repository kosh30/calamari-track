# 07: Schubladen-Wechsel zwischen den Panelseiten

**What to build:** Die Panelseiten „main", „menu" und „settings" wechseln als seitlich fahrende Schubladen, statt hart umgeschaltet zu werden, damit erkennbar bleibt, wo man herkommt und wohin man geht.

Dieses Ticket steht bewusst am Ende und ist als einziges in Frage gestellt. Der Gewinn ist reine Orientierung; der Preis ist, dass die Seiten dann gleichzeitig existieren und die Panelgröße füllen müssen, während sich die Panelbreite beim Wechsel auf die Einstellungen ohnehin ändert. Das zusammenzubringen ist mehr Arbeit, als es aussieht, und es kann bestehendes Verhalten beschädigen. Wer das Ticket aufnimmt, entscheidet zuerst, ob es sich lohnt.

**Blocked by:** 02, 06

**Status:** ready-for-agent

- [ ] Zuerst entschieden und im Ticket begründet, ob der Gewinn den Aufwand trägt; ein begründetes Nein schließt das Ticket als `wontfix` und ist ein vollwertiges Ergebnis
- [ ] Der Wechsel ist animiert, und die Richtung entspricht der Navigation
- [ ] Eine Größenänderung des Panels löst keine Animation aus
- [ ] Die unterschiedliche Breite der Einstellungsseite ist aufgelöst — keine springenden, abgeschnittenen oder überlappenden Seiten
- [ ] Jede Seite bleibt vollständig erreichbar, auch wenn eine Animation unterbrochen wird

*Hintergrund: `docs/research/quickshell-screentime-plugin.md`, Vorschlag 6.*
