# 01: Lizenzhinweise nachziehen

**What to build:** Das Repository führt seinen eigenen Lizenztext und die Vermerke für fremde Bestandteile. Heute deklariert das Manifest MIT, eine `LICENSE`-Datei gibt es nicht; die Quickshell-Stubs unter `lint/` stammen nachweislich aus ax1g/quickshell-screentime-plugin (ebenfalls MIT), und der Hinweis dort nennt zwar Quelle und Lizenz, gibt aber weder die Copyright-Zeile noch den Lizenztext wieder. Genau das verlangt die MIT-Lizenz. Nach diesem Ticket ist die schon heute bestehende Auflage erfüllt, und jede weitere Übernahme fremden Codes ist sauber möglich, statt die Lücke zu vergrößern.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] `LICENSE` im Wurzelverzeichnis, inhaltlich passend zur Deklaration im Manifest
- [x] Copyright-Vermerk und vollständiger Lizenztext des fremden Projekts liegen im Repository, entweder als eigene Datei für Fremdbestandteile oder als Abschnitt im eigenen Lizenztext
- [x] Der Hinweis bei den Lint-Stubs verweist auf diesen Vermerk und nennt den Commit, aus dem die Dateien stammen
- [x] Geprüft, ob im Repository weitere fremde Bestandteile ohne Vermerk liegen; das Ergebnis ist festgehalten

*Hintergrund: `docs/research/quickshell-screentime-plugin.md`, Abschnitt „Lizenz".*

## Comments

**2026-09-25 (Agent):** Umgesetzt. `LICENSE` (MIT, „Copyright (c) 2026 Wjatscheslaw Poluschin" — der Name aus der Git-Identität, nicht das `author`-Kürzel `kosh` des Manifests) und `THIRD-PARTY-LICENSES.md` mit einem Abschnitt je Fremdbestandteil liegen im Wurzelverzeichnis. `lint/README.md` verweist auf den Vermerk und nennt den Commit, `README.md` verlinkt beide Dateien. `tests/test_licenses.py` (9 Tests) hält die Auflage fest: Lizenztext einmal **pro** Bestandteil, Copyright-Zeilen wortgetreu, Commit genannt.

- **Die Prüfung hat einen zweiten Fremdbestandteil gefunden, den die Recherche nicht als Lizenzfrage behandelt hat:** `lint/qs/Commons/` und `lint/qs/Ui/` sind wortgetreue Kopien der installierten omarchy-shell (basecamp/omarchy, MIT, „Copyright (c) David Heinemeier Hansson"). `lint/README.md` nannte sie bisher nur als Bequemlichkeit („verbatim snapshots … never hand-edit"), ohne Lizenzbezug. Die Auflage gilt für sie genauso, und sie sind der größere Teil des fremden Codes im Repo. Beide sind jetzt vermerkt.
- Der omarchy-Text ist **nicht** der Standard-MIT-Wortlaut: keine Kopfzeile „MIT License", kein Jahr in der Copyright-Zeile, anderer Zeilenumbruch. Er liegt darum wortgetreu im Vermerk, nicht als „MIT" abgekürzt. Das Arch-Paket liefert keine Lizenzdatei mit (`/usr/share/licenses/omarchy/` existiert nicht), der Text kommt aus dem Projekt-Repository.
- Jede Datei unter `lint/` wurde mit `cmp` gegen ihr Original verglichen, statt der bisherigen Stichprobe. Ergebnis: neun der Quickshell-Stubs sind byteweise identisch; `Io/FileView.qml` und `Io/StdioCollector.qml` haben wir erweitert (also Ableitungen, vermerkpflichtig); `Wayland/IdleMonitor.qml` **und** `Wayland/qmldir` sind unsere — die fremde `Wayland/qmldir` deklariert einen `ToplevelManager`, den wir nicht haben, unsere den `IdleMonitor`. Von den omarchy-Schnappschüssen weicht keiner ab außer den beiden, die als unsere gelten (`Ui/KeyboardPanel.qml`, `Ui/qmldir`).
- Der restliche Baum (`bin/`, `docs/`, `js/`, `tests/`, die vier `*.qml` im Wurzelverzeichnis) ist unser: die Suche nach Copyright-Kopfzeilen und nach „adapted from / derived from / taken from / SPDX" fand nichts. Das Ergebnis steht als Tabelle im Abschnitt „Audit" von `THIRD-PARTY-LICENSES.md`, mit dem Datum und der geprüften omarchy-Version.
- Damit das Ergebnis nicht still veraltet, prüft `test_the_audit_classifies_every_top_level_directory`, dass jedes Verzeichnis der obersten Ebene in der Tabelle vorkommt. Ein neues Verzeichnis lässt den Test fehlschlagen, bis es eingeordnet ist. `lint/refresh.sh` überschreibt die omarchy-Kopien mit der jeweils installierten Version — der Vermerk sagt darum, nach einem omarchy-Update Version und Lizenz nachzusehen.
- Volle Suite grün: 104 Python-Tests, 176 Node-Tests, `qmllint` ohne Warnung.

**2026-09-25 (Agent):** Das Code-Review hat den Vermerk in einem wesentlichen Punkt widerlegt, und zwar aus einem Fehler in der Prüfmethode: Ich habe `lint/qs/` nur gegen **einen** Ursprung verglichen (die installierte omarchy-shell). Was davon abwich, fiel als „unser" durch — obwohl ax1g selbst einen `lint/qs/`-Baum hat und die betroffenen Dateien von dort stammen. Korrigiert:

- `lint/qs/Ui/KeyboardPanel.qml` ist eine Ableitung von ax1g, nicht unser Werk: dieselben 23 Zeilen, zwei Änderungen (eine Kommentar-Klausel umformuliert, `fittedContentHeight` auf ein Argument reduziert). Es ist **keine** omarchy-Datei — der echte Rahmen ist viel umfangreicher, der Stub ist ax1gs Arbeit. Der Vermerk behauptete das Gegenteil.
- `.qmllint.ini` ist ebenfalls eine Ableitung und war überhaupt nicht eingeordnet: dieselben `[General]`-Schlüssel, der „Zero tolerance"-Kommentar fast wortgleich, `MissingProperty=disable`. Unsere Fassung ist die gekürzte.
- `lint/qs/Ui/qmldir` und `lint/Quickshell/Wayland/qmldir` sind Formatgerüste mit unserer Typliste. Jetzt trotzdem genannt: der Vermerk ist billiger als die Diskussion.
- Die Richtung der Ableitung ist geprüft, nicht vermutet: ax1gs Dateien sind vom 2026-09-09/10, unser ganzes Lint-Gerüst samt `.qmllint.ini` kam am 2026-09-22 in einem Commit (`ac10438`) herein.
- Die vier abgeleiteten Dateien tragen jetzt die Herkunftszeile im eigenen Kopf, wie es der Vermerk selbst und `docs/research/…` Abschnitt „Lizenz" verlangen. Vorher stand die Regel da und war im selben Commit gebrochen. `test_every_derived_file_names_its_origin_in_its_own_header` hält sie fest.
- Die Audit-Tabelle deckt jetzt auch Wurzeldateien und Dotfiles ab (`.qmllint.ini`, `.gitignore`, `.scratch/`), und der Methodenabsatz sagt, was die Grep-Suche prinzipiell **nicht** kann: eine unvermerkte Ableitung hat per Definition keinen Copyright-Kopf. Die Einordnung stützt sich auf die Byte-Vergleiche und die eigene Historie, nicht auf Grep.

Drei Tests waren außerdem so verankert, dass sie aus dem falschen Grund grün waren; alle drei sind durch Mutationsproben abgesichert, dass sie wirklich fehlschlagen:

- Der Lizenztext wurde global gezählt statt je Abschnitt — zwei Kopien von ax1g und keine von omarchy hätten den Test bestanden. Jetzt je Abschnitt.
- Die Audit-Prüfung lief über das Dateisystem und filterte nur Punkt-Namen: ein `npm install` (`node_modules/`) hätte die Suite gebrochen, ohne dass sich an der Lizenzlage etwas ändert. Jetzt über `git ls-files`, und auf die Tabellenzelle verankert statt als freie Teilstring-Suche (ein unvermerktes `Quickshell/` wäre sonst durchgelaufen, weil `lint/Quickshell/` im Text steht).
- `LICENSE` enthält wieder nur den MIT-Text. Die beiden angehängten Sätze hätten GitHubs Lizenzerkennung auf „Other" schieben können, während das Manifest MIT deklariert; der Verweis steht in `README.md`.

Suite danach: 107 Python-Tests, 176 Node-Tests, `qmllint` ohne Warnung. Die drei Lizenztexte sind byteweise gegen ihre Originale geprüft.
