# 03: Dünner Scrollbalken auf der Einstellungsseite

**What to build:** Die Einstellungsseite zeigt an ihrem rechten Rand einen dünnen, abgerundeten Balken, der die Scrollposition anzeigt, sobald der Inhalt höher ist als das Sichtfenster — und der sonst gar nicht da ist. Heute scrollt die Seite ohne jeden Hinweis darauf, dass unterhalb des Sichtfensters weitere Felder stehen; wer das nicht weiß, findet sie nicht.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Der Balken erscheint nur bei Überlauf und folgt der Scrollposition
- [ ] Er verschiebt oder verschmälert die Felder nicht
- [ ] Passen alle Felder ins Fenster, ist nichts zu sehen
- [ ] Wird Code aus dem fremden Projekt übernommen statt nachgebaut, trägt die Datei den Herkunftsvermerk nach Ticket 01

*Hintergrund: `docs/research/quickshell-screentime-plugin.md`, Vorschlag 2. Die Abhängigkeit von 01 besteht, weil dies die Stelle ist, an der fremder Code am ehesten nahezu wörtlich übernommen wird.*
