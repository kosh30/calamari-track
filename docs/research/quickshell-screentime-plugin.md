# quickshell-screentime-plugin: what its look is made of and what of it fits us

A research note, not a decision. It describes what the other plugin does graphically, how it is
built technically, and which parts carry for Calamari Tracker in substance. Decisions that follow
from it belong in `docs/adr/`.

## State of the source

What was read is the local checkout `~/.config/omarchy/plugins/agx.screen-time`. Its `origin` is
`https://github.com/ax1g/quickshell-screentime-plugin.git`, it stands at commit
`2c7b75abde55b23ee6d6e1356797c8f50f60b8a1` of 2026-09-17 ("fix(panel): parent gear tooltip to its
hit area"), branch `main`, working tree clean, no local changes. `manifest.json` names version
1.6.2. Whether `origin/main` has moved on since was not checked — no `fetch` was run; every
statement below refers to exactly that commit. File paths of the other project are given relative
to that checkout, paths without a prefix are ours.

## What the preview image shows

`preview.png` is promotional art, not a screenshot, but it shows real interface. Three surfaces are
stacked on it.

In the middle the main panel: top left an hourglass glyph, beside it a large "4h" and below it a
small "Sep 12, 2026"; top right a gear and "SHOW LESS" with a triangle. Below that, on the left a
donut ring of blue, violet and pink segments with "Sep 12 / 4h" in the middle, and to its right a
legend of round colour dots with app name and time (zen 2h 13m, nvim 1h 26m, vscode 13m, fish 4m,
agent 2m, cliamp 1m). Below that a row with arrows left and right around "Sep 7 – 13, 2026 · W37"
and, at the far right, "19%". Below that a bar chart Mon–Sun: light columns, rounded at the top, on
three very faint horizontal lines whose labels read "11h", "5h", "0h" at the outer right; the
Saturday bar is set off in blue (that is the selected day, not a second colour scale).
At the very bottom three rows with symbol, label and value: a blue filled star "Top app" —
"zen · (55%) 2h 13m", a green arrow pointing down-right "vs Yesterday" — "− 6h 46m" in green, a red
hollow star "Busiest day (7d)" — "Fri · 10h 46m".

Top right, the settings as a surface of their own: a gear glyph, "Settings", below it a small
"Display, tracking, goals & data", on the right "‹ BACK"; below that a lighter card "COLORS" with two
entries, each with a title, an explaining line and a row of round colour swatches plus a reset
arrow. In front of it a red-bordered card "DANGER ZONE" with two rows and the buttons "RESET" and
"WIPE ALL" in red.

Bottom right, the year view: a calendar glyph, a large "241h", below it "‹ 2026 ›", on the right
"‹ BACK". Below that twelve rows of month abbreviation, horizontal bar and hour count on the right —
Aug with a long lavender bar and "159h", Sep with a shorter turquoise bar and "82h", Oct/Nov/Dec with
"8h" and no visible bar. Turquoise is the theme's accent colour here, marking the current month.
Below that "Insights 2026" and four cards in two columns of differing height (SCREEN SHARE, TOP
MONTHS with medal emoji, DAY COUNT, LONGEST STREAK), each with a coloured glyph, a lower-case title,
a bold figure and a grey explaining line.

## How that is built

The most striking finding is how little technology is behind it. There is exactly one `Canvas` in
the whole project — the donut. Everything else is `Rectangle`, `Text`, `Row`, `Column`, `Repeater`
and `Flickable`. No `Shape`, no `PathLine`, no `ShaderEffect`, no graphics library, no image files in
the interface.

**The donut** sits in `qml/components/DonutChart.qml`. A `Canvas` paints the rings in `onPaint`
(lines 100–127) as a sequence of `ctx.arc` strokes with `lineWidth` equal to `Style.space(14)`;
without data it draws a single ring in 10 % foreground colour (lines 110–117). The comment on line 6
names the reason for `Canvas` instead of `Shape`: "Shape won't host a Repeater". The angles come not
from QML but from `js/Model.js:1086` (`arcSegments`): start at −90°, the share times 360° minus a
fixed gap per segment. The colours are supplied by `sliceColors` (`js/Model.js:1050`), which takes
the theme's accent colour apart in HSL and turns the hue on per segment — with a grey accent, a
lightness ramp instead. The ring can be pointed at without there being elements per segment: a
single `MouseArea` works back in `sliceAt` (lines 56–77), from radius and angle, to which segment
lies under the pointer; the one hit stays fully opaque, all others fall to alpha 0.25 (line 122), and
the middle switches from the day's date and total to the app name and app time (lines 149–175).

**The week chart** is pure rectangle composition. A column is `qml/components/WeekDayBar.qml`: a
`Rectangle` half as wide as its column, `radius: Style.space(2)`, height
`Style.space(64) * ms / axisMax` with a 3 px floor (line 33), anchored at the bottom to the weekday
abbreviation. The colour is a single nested condition (line 38): future and empty days 10 %
foreground, the chosen day accent colour, lightened under the pointer, otherwise 90 % foreground.
The grid lines are `qml/components/WeekTick.qml`: a 1 px high `Rectangle` in 6 % foreground colour
(line 29), positioned with the same formula as the bar height (line 21), so that the tops of bars
land on lines, and the hour label at the outer right. Both hang in `qml/WeekTrend.qml:186–238`:
first the tick `Repeater`, then the columns above it with `z: 2`.
The header line above that (lines 38–181) is arrow–date range–arrow on the left, trophy and week
total on the right, where the total switches on a click between hours and a percentage of the week's
168 hours.

**The month rows** of the year view (`qml/MonthRow.qml`) are the same pattern lying down:
abbreviation on the left at a fixed width, a `Rectangle` with `width = available * ms / max`, the
hour count right-aligned on the right. The current month gets the accent colour and bold type, the
rest 55 % opacity (lines 36, 54, 82). Worth noting is the comment on lines 46–47: there is
deliberately **no** background track behind the bar, because a faintly filled full row reads like a
progress bar instead of a measurement.

**The insight cards** (`qml/components/InsightCard.qml`) are a `Rectangle` with
`radius: Style.space(6)`, a fill of 6 % and a border of 8 % of the foreground colour, inside a glyph
plus a lower-case title, then the figure (as `Text.RichText`, so that medal markup works) and a grey
explaining line. The height follows the content. They are arranged in two columns by hand in
`qml/YearDrawer.qml:325–393`: `splitCards` estimates each card's line count through `estimateLines`
from text length and column width and distributes them to the shorter column — a masonry layout
without a layout engine, in about thirty lines of JavaScript.

**The single-line pattern rows** under the week chart are `qml/components/InsightList.qml`. What
matters about them is the separation: the data row carries `kind` and `dir` as meaning, and only the
functions `insightIcon`/`insightIconColor` (lines 30–53) translate that into star, arrow and colour.
The colours themselves come from the theme again (`js/Model.js:1069` `insightColors`), not from fixed
hex values; only the direction "down" is nailed to hue 155 (green).

**The header area** `qml/components/HeroHeader.qml:243–305` is what makes the panel look expensive at
once, and it is trivial: a `Column` with the day's total in `Style.fontPx(1.5)` bold, below it the
date in `Style.font.caption` and a darkened colour, below that — only if a daily goal is set — a 3 px
high progress bar of two `Rectangle`s (a track at 15 %, a fill at 55 % or the full foreground colour
once the goal is reached) and a remaining-time line.

**The small parts** deserve mentioning individually, because they are what makes the handwriting:

- `qml/components/HintBadge.qml` — the keyboard-shortcut box for keyboard mode. A solid accent
  colour, and the text colour is chosen from `accent.hslLightness` (line 32), so that the letter
  stays readable on light and dark accent colours alike. When invisible it has width and height 0
  (lines 21–22), so it never shifts the layout, and it has no `MouseArea` of its own, clicks go
  through it.
- `qml/components/AppLegend.qml:72–82` — a 2 px wide, rounded scroll bar that only appears when the
  content overflows, and whose position is computed from `contentY`. The same pattern stands word for
  word twice more in the project (`qml/Panel.qml:732–742`, `qml/YearDrawer.qml:400–410`).
- `qml/components/PagerArrow.qml` and `qml/components/BackButton.qml` — glyph buttons that switch
  from `Qt.darker(foreground, 1.4)` to the full foreground colour under the pointer and fall to
  opacity 0.25 when disabled, with a soft crossfade. "BACK" stands in capitals with
  `font.letterSpacing: 1.2` — the same goes for "SHOW MORE" (`HeroHeader.qml:213`). These spaced
  capitals are the typographic trick of the whole plugin.
- `qml/components/ScreenTip.qml` — a `ToolTip` from `QtQuick.Controls` with a 300 ms delay, so that
  sweeping across several bars does not flicker.
- `qml/components/Sparkle.qml` and `HeroHeader.qml:39–74, 111–143, 158–166` — the playthings: the
  hourglass turns on the hour and on returning to the main panel, six golden sparks rise on hover,
  the gear makes one revolution when the settings open, the calendar symbol swings like a pendulum as
  it slides in (`qml/YearDrawer.qml:101–119`). All of it hangs on a "Playful extras" switch that
  silences it completely.

**The page change**, finally: the year view and the settings are not swapped contents but drawers
that travel across the main panel (`qml/Panel.qml:450–524`). An `Item` at the full panel size sits at
`x = ±width` and travels to 0 through a `Behavior on x` in 200 ms with `OutCubic`. The trick in it is
the `sliding` flag: it switches the animation on only for a deliberate change and is switched off
again once the resting position is reached (lines 471–474), so that a change of the panel's size does
not send the drawer flying across the screen.

## What what is shown depends on

Pleasingly little. The decisive check: the shell snapshots under `lint/qs/` of both projects are
identical byte for byte — `Commons/Style.qml`, `Commons/Color.qml`, `Ui/BarWidget.qml`,
`Ui/Panel.qml` and `Ui/WidgetButton.qml` match exactly. Both plugins therefore speak the same shell
API of the same version (Omarchy 4.0.0.alpha here) and use the same building blocks:
`Style.space()`, `Style.fontPx()`, the font-size marks
`Style.font.caption/bodySmall/body/title/icon` and the colour roles from `Color`. The other plugin
brings no style tokens of its own; it computes its colour ramps at runtime from `Color.accent`,
`Color.foreground`, `Color.muted` and `Color.urgent` (`js/Model.js:1013–1078`). Which means: blocks
taken over are theme-capable without adjustment.

In Qt modules, nothing is added beyond `QtQuick` but `QtQuick.Controls`, and that exactly once, for
the tooltip (`qml/components/ScreenTip.qml:2`). That one piece we do not need: the shell supplies
`Ui/PanelToolTip.qml`, and our `qs.Ui.Button` already renders a tooltip by itself as soon as
`tooltipText` is set (`lint/qs/Ui/Button.qml:25, 131`).

The other plugin uses two shell building blocks we do not know yet: `PanelSeparator`
(`qml/Panel.qml:877`, `qml/YearDrawer.qml:305`) and `ToggleSwitch`
(`qml/components/ConfigMenu.qml:332`). Both lie in `/usr/share/omarchy/shell/Ui/` but are missing
from our list in `lint/refresh.sh:12` — whoever uses them has to add the line, or `qmllint` fails.

The other plugin's Python directory (`python/resolve_app.py`) has nothing to do with the graphics; it
resolves terminal and Steam processes into application names. Its own data keeping
(`~/.config/omarchy/screen-time/history.json`), on the other hand, is the real dependency — more on
that below.

## What fits us in substance

The decisive difference is not technical but on the data side. Screen Time keeps an archive: days,
months and an everlasting day store per year. We keep none. `emptyState()` and `forToday()` in
`js/shiftclock.mjs:45–63` reset the state at every change of day; what remains is only activity
fields and the `unclosed` marker. Everything in the other plugin that goes beyond today — the week
chart, the month rows, the year overview, streaks, "vs Yesterday", the trophy for the best week — has
simply no data basis with us. That could be retrofitted, but it would be a project of its own
(writing history, tidying it, migrating it) and would contradict the line from `CONTEXT.md` that
Calamari is the single source of truth. These displays are therefore not "expensive" but moot, as
long as we keep no history.

What does carry:

**The header area with the progress bar** (`qml/components/HeroHeader.qml:243–305`) fits almost
unchanged. Our main panel is today a sequence of equally ranked text lines in `Style.font.body`
(`Panel.qml:102–167`) — there is no hierarchy, the shift duration looks like the error message. The
same arrangement with a large number (the running shift duration from `ShiftClock.barView`), a small
line below it („Schicht läuft seit 08:14“ or „Feierabend seit 17:30“) and the thin bar below that
would carry at once. For the bar we even have two sensible reference quantities that Screen Time does
not have: the progress through core time (`js/daycalendar.mjs:37` delivers it as `{start, end}` in
minutes) or the working time observed today against a daily target
(`ShiftClock.workedMinutes`). The remaining-time line below it („noch 2:15 bis Ende der Kernzeit“)
replaces one of today's text lines instead of adding one.

**The horizontal bar row** from `qml/MonthRow.qml:48–74` — label on the left, bar proportional,
number on the right — is the form that fits our day best, but in a variation: not twelve rows for
months, but one row as a timeline of the day. We have everything for it: `state.shifts` is a list of
`{start, end}` in HH:MM (`js/shiftclock.mjs:122–124`), `startedAt` the running shift,
`breakSince`/`breakMinutes` the break, `coreTime` the expected window. A single row from the start of
core time to its end, in which shifts are filled solid and breaks are left out, plus a marker for
"now", answers at a glance what twelve text lines do not answer today. That is not taking code over
but the same building principle: `Rectangle` with `radius: Style.space(2)`, width out of a ratio,
accent colour for what is running, 10 % foreground for what is empty — and explicitly without a
background track behind the filled parts, for the reason named in `MonthRow.qml:46`. The `ScreenTip`
per bar becomes a `tooltipText` for us.

**The donut** does not fit in substance, and that should be said plainly. It lives on a total falling
into six to twenty unequal parts. Our day falls into work and break, occasionally with a second
shift — two to three segments, one of which almost always has over 80 %. A ring with two segments
says less than a number. What is transferable at most is the *technique*, for an entirely different
purpose: a single arc as a progress indicator ("X of Y hours"), which is finished as a `Canvas` with
two `ctx.arc` calls in about fifteen lines. Whether a ring is better for that than the 3 px bar from
the header area is taste; the bar is considerably cheaper and settles in more quietly.

**The settings as section cards** are the second big gain, and as an idea, not as code. Our
`SettingsForm.qml` lines up 22 fields from the manifest schema flat underneath one another
(`SettingsForm.qml:71–110`), each with a full label line above it — a list without structure, that
you scroll through. Screen Time groups into tinted cards with a heading
(`qml/components/ConfigMenu.qml`, the sections begin at lines 234, 369, 674, 827, 937, 1442, 1553)
and puts dangerous things separately into a red-bordered "DANGER ZONE" (line 1553 ff.). Our schema
has recognisable groups long since: „Abfrage und Erinnerungen“, „Pause“, the core times of the seven
weekdays, „Verbindung“ (web and API URL), „Projekt und Pausentyp“. Seven core-time fields as a card
of their own with one shared explanation instead of seven long individual labels would be a
noticeable improvement on its own. To note: `ConfigMenu.qml` is at 1887 lines the largest file of the
other project and tied entirely to its prefs — copying something here would be wrong; what is to be
rebuilt is the principle, in a few `Rectangle` sections around our existing `Repeater` loop.

**The thin scroll bar** (`qml/components/AppLegend.qml:72–82`) is the cheapest piece on this list:
ten lines, a `Flickable` as its reference. Our settings page scrolls today without any hint that
there is more (`SettingsForm.qml:59–64`).

**The spaced capitals** for secondary actions ("SHOW MORE", "BACK") and the hover lightening from
`Qt.darker(foreground, 1.4)` to the full foreground colour are pure typography and cost nothing. Our
buttons are all `bordered: true` and therefore equally loud; „Abbrechen“ and „Speichern“ beside one
another (`SettingsForm.qml:124–137`) are visually of equal rank although they are not.

**The drawer change** (`qml/Panel.qml:450–524`) fits our three pages "main", "menu", "settings",
which today are only switched through `visible:` (`Panel.qml:81–99`). That is a real improvement in
orientation, but it has a price: the pages then have to exist at the same time and fill the panel
size, and our panel width already changes from 320 to 420 on the switch to "settings"
(`Panel.qml:65`). Bringing that together is more work than it looks.

**Keyboard mode** with `HintBadge` (`qml/Panel.qml:398–442` for the key handling) is nicely made, but
hardly worth it for us: the other panel has dozens of things to point at, our main panel has five
buttons, which a `PanelKeyCatcher` already makes reachable anyway. The readability idea from
`HintBadge.qml:32` — choosing the text colour from the lightness of the background colour — is worth
noting all the same, in case we ever label something on the accent colour.

**The playthings** (sparks, turning hourglass, swinging calendar) do not fit. A tool whose purpose is
to remind you of a forgotten clock-out gains nothing from festivity; and the effort of keeping them
switchable behind a switch, as they are there, is out of all proportion.

## Licence

The other project's `LICENSE` is the MIT licence in its standard wording, "Copyright (c) 2026 agx".
It permits use, copying, modification, merging, publication and distribution without restriction. The
only condition is that the copyright notice **and** the licence text remain contained in all copies
or substantial portions of the software. It is not copyleft: our project does not have to become MIT
because of it, and we do not have to disclose our own code. There is no obligation to state changes
or to give attribution in the user interface.

We declare `"license": "MIT"` in `manifest.json` ourselves. There is, however, **no `LICENSE` file**
in the repository — that is a gap independent of this research, and it becomes one at the latest when
third-party MIT code arrives, because its licence notice has to stand somewhere.

Taking code over is therefore permissible, under one obligation: carry the notice along. In practice
that means one line in the file header of the file taken over ("Derived from
ax1g/quickshell-screentime-plugin, commit 2c7b75a, MIT, Copyright (c) 2026 agx") and the full MIT
text including the copyright line somewhere in the repository — usually as `LICENSE` (our own) plus a
section in it, or a file like `THIRD-PARTY-LICENSES` for third-party components.

To be kept apart from that is rebuilding an idea. "A bar in a row with a label on the left and a
number on the right", "a large numeric value with a thin progress bar below it", "group the settings
into tinted section cards", "a thin scroll bar only on overflow" are design concepts nobody holds
rights in. Whoever implements them independently in their own code triggers no licence obligation.
The line runs where you open the other file and take its structure over line by line — then it is a
derivative, and the notice belongs with it. In doubtful cases the notice is cheap; it costs three
lines.

One point on our own account: `lint/README.md` already records that our `Quickshell/` stubs come from
ax1g/quickshell-screentime-plugin and are MIT. Spot checks confirm that —
`lint/Quickshell/Quickshell.qml`, `Io/Process.qml`, `Io/IpcHandler.qml` and `Io/JsonAdapter.qml` are
identical byte for byte with those of the other checkout, `Io/FileView.qml` differs (apparently
extended by us). The note names source and licence but reproduces neither the copyright line nor the
licence text. That is already today the obligation the MIT licence imposes, and it should be caught
up on — independently of whether we additionally take interface code over.

## Proposals, by effect per effort

1. **A header area with a progress bar** in the main panel. The greatest visible effect, the smallest
   intervention; the data are all there. Model `qml/components/HeroHeader.qml:243–305`, target
   `Panel.qml:102–167`.
2. **A thin scroll bar** on the settings page. Ten lines, noticeable at once. Model
   `qml/components/AppLegend.qml:72–82`, target `SettingsForm.qml:59–64`.
3. **Typographic hierarchy**: spaced capitals for secondary actions, a darkened resting colour with
   lightening under the pointer, „Speichern“ not as loud as „Abbrechen“. Costs almost nothing.
   Model `qml/components/BackButton.qml:22–38`, `qml/components/HeroHeader.qml:207–223`.
4. **A day timeline** as one horizontal bar row over core time, shifts and breaks. In substance the
   strongest gain, but new code (the other template serves only as a building principle). Model
   `qml/MonthRow.qml:48–74`, data from `js/shiftclock.mjs:46, 122–143` and `js/daycalendar.mjs:37`.
5. **Settings in section cards**, the seven core-time fields as one group in particular. A clear
   improvement, but an intervention in `SettingsForm.qml` and presumably in the schema (the manifest
   would have to supply group membership). The principle from `qml/components/ConfigMenu.qml`, no
   code out of it.
6. **A drawer change between the panel pages**. Nice, but the greatest effort and risk because of the
   differing panel widths. Model `qml/Panel.qml:450–524`.
7. **Not to take over**: the donut as the day's division, the week and year views, the trophy and
   streaks (no history), sparks and revolutions (the wrong tone), `ScreenTip` (the shell has
   `PanelToolTip`, our `Button` has `tooltipText`), keyboard-shortcut mode (too few controls).

## Open

- Whether `origin/main` has moved on since 2026-09-17 was not checked (no `fetch`). All line
  references hold for commit `2c7b75a`.
- How the interface actually feels was not observed: the plugin was not started. All statements about
  movement and behaviour come from the source and the preview image, not from running it.
- The numbers and colours in `preview.png` are set, not measured; whether a real theme is depicted
  there cannot be told from outside.
- Whether `PanelSeparator` and `ToggleSwitch` have the same interface in the installed shell as at
  the time of the other commit was not checked — the files exist in `/usr/share/omarchy/shell/Ui/`,
  their content was not read.
- What was not checked is whether our `qs.Ui` kit (`Button`, `TextField`, `BorderSurface`,
  `BarIconButton`) already brings parts of the design described above ready-made. That belongs before
  any rebuild: look through the shell first, then draw it yourself.
