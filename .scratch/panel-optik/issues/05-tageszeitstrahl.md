# 05: Tageszeitstrahl über die Kernzeit

**What to build:** Das Hauptpanel zeigt den Tag als eine einzige liegende Zeile: von Beginn bis Ende der Kernzeit, darin die Schichten gefüllt, die Pausen ausgespart, dazu eine Markierung für „jetzt". Wer hinsieht, erkennt ohne Lesen, wie viel des Tages gearbeitet ist, wo die Lücken liegen und wie weit es noch ist — eine Frage, die heute mehrere Textzeilen nicht beantworten. Die Daten liegen vollständig vor (Schichten des Tages, laufende Schicht, Pause, Kernzeit). Aus dem fremden Projekt stammt nur das Bauprinzip, kein Code.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Eine Zeile über die Kernzeit mit Schichten, ausgesparten Pausen und Jetzt-Markierung
- [ ] Keine Hintergrundspur hinter den gefüllten Teilen — eine schwach gefüllte volle Zeile wirkt wie ein Ladebalken statt wie ein Messwert
- [ ] Mehrere Schichten an einem Tag erscheinen als getrennte Abschnitte
- [ ] Freie Tage und Tage ohne hinterlegte Kernzeit haben eine definierte Darstellung
- [ ] Reicht eine Schicht über die Kernzeit hinaus oder beginnt davor, bleibt die Darstellung richtig
- [ ] Die genauen Zeiten sind als Tooltip abrufbar
- [ ] Mit dem Benutzer an einem echten Arbeitstag angesehen

*Hintergrund: `docs/research/quickshell-screentime-plugin.md`, Vorschlag 4. Die Abhängigkeit von 02 ist keine technische, sondern vermeidet, die Hauptseite zweimal umzubauen.*
