# Auslieferung über einen eigenen Branch `stable` statt über `main`

`omarchy plugin add` klont den Default-Branch, und `omarchy plugin update` spielt dessen `HEAD` per Fast-Forward ein (`/usr/share/omarchy/bin/omarchy-plugin-update`). Tags spielen dabei keine Rolle. Jeder Push auf den Default-Branch würde also sofort ausgeliefert. Deshalb ist der Default-Branch auf GitHub `stable`. Er bewegt sich nur beim Release, per Fast-Forward auf den getaggten Commit. Entwickelt wird weiter direkt auf `main`, auch mit Zwischenständen.

## Considered Options

- **`main` als Kanal, Release nur als Beschriftung**: Dann müsste jeder Commit auf `main` auslieferbar sein, und unfertige Arbeit gehörte auf Feature-Branches.
- **Feature-Branches, die erst beim Release gemergt werden**: Das ist mehr Branch-Verwaltung, als ein Ein-Personen-Projekt braucht.

## Consequences

- PRs gehen nach `main`, nicht in den Default-Branch. Das muss im README stehen.
- `stable` bewegt sich nur per Fast-Forward. Einen Hotfix-Weg an `main` vorbei gibt es nicht: Ein Fix kommt auf `main`, Unfertiges wird fertig gemacht oder zurückgenommen, dann folgt ein normales Release.
