# Calamari Tracker

Ein Omarchy-Shell-Plugin, das die eigene Arbeitszeit in Calamari (Modul „Clockin“) per Knopfdruck erfasst und an vergessenes Ein- oder Ausstempeln erinnert.

## Language

### Zeiterfassung

**Schicht**:
Ein zusammenhängender Zeitraum zwischen Einstempeln und Ausstempeln, so wie Calamari ihn als Timesheet-Eintrag speichert. Kann Pausen enthalten.
_Avoid_: Work in progress, Session, Eintrag

**Laufende Schicht**:
Eine Schicht, die in Calamari begonnen und noch nicht beendet wurde, egal ob per Plugin, Web oder Handy eingestempelt.
_Avoid_: WIP, laufende Zeit

**Einstempeln / Ausstempeln**:
Beginn bzw. Ende einer Schicht.
_Avoid_: Start/Stop, Clock-in/Clock-out (im Deutschen)

**Pause**:
Eine vom Benutzer als Pause markierte Lücke zwischen zwei Schichten desselben Tages. Beginnt nur aus einer laufenden Schicht heraus und ist kein Feierabend. Calamari selbst sieht nur die Lücke.
_Avoid_: Break (im Deutschen), Calamari-Pause

**Feierabend**:
Der Zustand nach dem Ausstempeln an einem Arbeitstag. Ab dann gibt es an diesem Tag keine Stempel-Erinnerungen mehr. Erneutes Einstempeln bleibt möglich.
_Avoid_: Tagesende, Abmelden

**Calamari**:
Die einzige Quelle der Wahrheit für den Schichtstatus. Das Plugin hält keinen eigenen Status, der Calamari widerspricht.

### Tagesplanung

**Arbeitsplan**:
Der wöchentliche Plan des Benutzers in Calamari. Legt für jeden Wochentag fest, ob er ein Arbeitstag ist und wann dessen Kernzeit liegt. Lokal überschreibbar.

**Arbeitstag**:
Ein Tag, der laut Arbeitsplan ein Arbeitstag ist.

**Kernzeit**:
Das Zeitfenster eines Arbeitstags laut Arbeitsplan, in dem eine laufende Schicht erwartet wird. Ein halber Feiertag verkürzt sie.
_Avoid_: Arbeitszeit, Normalzeit

**Freier Tag**:
Ein Arbeitstag, an dem keine Stempel-Erinnerungen kommen: wegen eines Feiertags, einer Abwesenheit (Urlaub, Krankheit) oder weil der Benutzer ihn manuell als frei markiert hat.
_Avoid_: Ruhetag, Off-Day

### Erinnerungen

**Stempel-Erinnerung**:
Eine wiederholte Benachrichtigung während der Kernzeit eines Arbeitstags, an dem noch gar nicht eingestempelt wurde. Entfällt an einem freien Tag und nach dem Feierabend.

**Pausen-Erinnerung**:
Eine Benachrichtigung, weil eine Pause länger als erlaubt dauert.

**Sanfter Hinweis**:
Eine einmalige Benachrichtigung kurz nach Ende der Kernzeit (standardmäßig 30 Minuten danach), dass noch eine Schicht läuft.

**Letzte Warnung**:
Die Benachrichtigung zur konfigurierbaren Uhrzeit (Standard 19:00), nach der ohne Reaktion der Auto-Abschluss folgt.

**Auto-Abschluss**:
Das automatische Ausstempeln einer vergessenen laufenden Schicht zum Zeitpunkt des Abschlusses. Danach wird der Benutzer aufgefordert, die Endzeit in Calamari auf die letzte Aktivität zu korrigieren.
_Avoid_: Tag abschließen, Tagesabschluss

**Letzte Aktivität**:
Der letzte Zeitpunkt, an dem der Benutzer am Rechner aktiv war, bevor er in den Leerlauf oder Suspend ging.
