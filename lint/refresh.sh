#!/usr/bin/env bash
# Refresh the verbatim omarchy-shell snapshots under lint/qs/ from the
# locally installed shell. Never hand-edit the snapshots; rerun this instead.
set -euo pipefail

src="${OMARCHY_PATH:-/usr/share/omarchy}/shell"
dst="$(cd "$(dirname "$0")" && pwd)/qs"

rm -rf "$dst/Commons"
cp -r "$src/Commons" "$dst/Commons"

for f in BarWidget BarIconButton WidgetButton OpticalGlyph Panel PanelController PanelKeyCatcher; do
  cp "$src/Ui/$f.qml" "$dst/Ui/$f.qml"
done
