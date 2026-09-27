# No drawers between the panel pages

The pages "main", "menu" and "settings" go on switching hard through `visible:`
(`Panel.qml`). An animated switch, in which the pages slide in and out sideways
as drawers, will not be built. That is proposal 6 from
[the research on the panel's look](../research/quickshell-screentime-plugin.md);
the research note is a snapshot and makes no decision itself, which is why this
one stands here.

What a drawer gains is orientation: seeing where you came from and where you are
going. Our navigation cannot deliver that, because inside the panel there is no
way back. „Abbrechen“ and „Speichern“ on the settings page call `done()`, and
that closes the whole panel (`SettingsForm.qml`, `Panel.qml`); no page carries a
back button. The only route from the settings back to the menu is a right-click
on the bar icon (`Widget.qml`) — an act outside the panel, so exactly where a
spatial back-gesture does not live. A drawer that slides in from the right and
then disappears together with the whole panel teaches a spatial model the
controls do not keep. That is not support, that is decoration.

On top of that "menu" is a single button, and every page change comes out of a
deliberate act: right-click on the bar icon for the menu, left-click for the
main panel, a click on that one button for the settings. Whoever stands there
knows how they got there.

## Consequences

- **Nothing in the chain under `KeyboardPanel` clips.** That is the real
  hardness the drawers fail on: pages existing at the same time need a clipping
  viewport, or the moving pages draw beside the card. The settings scroll bar
  relies on that, as it deliberately reaches out into the panel's padding
  (`SettingsForm.qml`): if anything in this chain starts clipping, the bar is
  silently gone, and neither `qmllint` nor the tests see it.
- Only ever one page is shown. The others stand at `visible: false` — they stay
  in the tree, but count neither towards the column's height nor towards the tab
  order. A switch in flight cannot make a page unreachable, because there is no
  switch in flight.
- **The height follows the visible page without animation.** `contentHeight`
  reads the page's `implicitHeight`, and that changes without a page switch too:
  an error message appears, the shift duration grows longer, the login line
  changes. Above all, though, the first point above applies here: nothing clips,
  so a card growing to its full height draws the rest of the form onto the
  desktop for as long as the movement lasts — measured with a `Behavior on
  contentHeight`, „Pausen-Erinnerung“, „Feierabend“ and the fields below them
  stood on the wallpaper with no card behind them. An animated height therefore
  needs the same clipping viewport as the drawers and fails on the same hardness.
- **The width no longer stands still.** The jump from 320 to 420 on the switch to
  the settings has been a movement since
  [#12](https://github.com/kosh30/calamari-track/issues/12). That was laid out
  here as its own and much smaller question already, and it has stayed one: the
  width reads only the visible page and the screen, never the content, and a page
  change in the open panel is the only thing that moves it. Neither clipping nor
  pages existing at the same time are needed for it.
