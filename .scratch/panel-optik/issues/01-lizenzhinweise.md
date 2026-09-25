# 01: Lizenzhinweise nachziehen

**What to build:** Das Repository führt seinen eigenen Lizenztext und die Vermerke für fremde Bestandteile. Heute deklariert das Manifest MIT, eine `LICENSE`-Datei gibt es nicht; die Quickshell-Stubs unter `lint/` stammen nachweislich aus ax1g/quickshell-screentime-plugin (ebenfalls MIT), und der Hinweis dort nennt zwar Quelle und Lizenz, gibt aber weder die Copyright-Zeile noch den Lizenztext wieder. Genau das verlangt die MIT-Lizenz. Nach diesem Ticket ist die schon heute bestehende Auflage erfüllt, und jede weitere Übernahme fremden Codes ist sauber möglich, statt die Lücke zu vergrößern.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `LICENSE` im Wurzelverzeichnis, inhaltlich passend zur Deklaration im Manifest
- [ ] Copyright-Vermerk und vollständiger Lizenztext des fremden Projekts liegen im Repository, entweder als eigene Datei für Fremdbestandteile oder als Abschnitt im eigenen Lizenztext
- [ ] Der Hinweis bei den Lint-Stubs verweist auf diesen Vermerk und nennt den Commit, aus dem die Dateien stammen
- [ ] Geprüft, ob im Repository weitere fremde Bestandteile ohne Vermerk liegen; das Ergebnis ist festgehalten

*Hintergrund: `docs/research/quickshell-screentime-plugin.md`, Abschnitt „Lizenz".*
