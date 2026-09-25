// The panel's day line: today as one lying line, from the beginning to the
// end of the core time, with the shifts filled, the running Pause left out
// and a mark for "now". No Qt; tested with `node --test js/`.
//
// It answers without reading: how much of the day is worked, where the gaps
// are, how far it still is. The scale is the core time, widened when work
// falls outside it — nothing is cut off, and on an ordinary day the end
// labels read exactly the core time.
//
// What it cannot show: an ended Pause. The state keeps only the sum of
// today's ended Pauses (breakMinutes), not their spans, and they lie inside
// the shifts' spans (js/shiftclock.mjs). Only the running Pause has a known
// start, so only it is left out; the tooltip names the rest instead of
// carving holes it cannot place.

import { minuteOfDay, toHhmm, toMinutes, toSpan, ymd } from "./daytime.mjs"
import { breakSinceText, inPause } from "./shiftclock.mjs"

// Today's shifts as { start, end } in minutes of the day, in order: the ended
// ones the plugin saw, plus the running one up to now — or up to the start of
// the running Pause, which is the gap the line shows.
function shiftSpans(state, now) {
  if (state.date !== ymd(now)) return []
  const spans = state.shifts.map((shift) => ({
    start: toMinutes(shift.start),
    end: toMinutes(shift.end),
    running: false,
  }))
  // A running shift whose start Calamari did not give would have to be
  // invented, so it stays out — as the header's number does.
  if (state.running && state.startedAt) {
    const until = inPause(state) ? toMinutes(state.breakSince) : minuteOfDay(now)
    const start = toMinutes(state.startedAt)
    spans.push({ start, end: Math.max(until, start), running: true })
  }
  return spans.sort((a, b) => a.start - b.start)
}

// The exact times behind the picture, as the tooltip spells them.
function tooltip(core, spans, state) {
  const lines = [`Kernzeit ${toHhmm(core.start)}–${toHhmm(core.end)}`]
  for (const span of spans)
    lines.push(
      span.running ? `Schicht seit ${toHhmm(span.start)} (läuft)` : `Schicht ${toHhmm(span.start)}–${toHhmm(span.end)}`,
    )
  if (inPause(state)) lines.push(`Pause seit ${breakSinceText(state)}`)
  const ended = state.breakMinutes || 0
  if (ended > 0) lines.push(`Beendete Pausen: ${toSpan(ended)} (in den Schichten enthalten)`)
  return lines.join("\n")
}

// core is today's core time as { start, end } in minutes (js/daycalendar.mjs
// coreTime), null on a day without one. Returns null when there is no line to
// draw, else { startText, endText, segments, nowFraction, tooltip }: a segment
// is { from, to, running }, both ends a share of the line, and nowFraction is
// the share "now" sits at, null when it lies outside the line.
export function timelineView({ state, now, core }) {
  // A day without a core time has no window to be a share of: the line is
  // absent, as the header's core-time bar is (js/panelheader.mjs).
  if (!core) return null
  const spans = shiftSpans(state, now)
  const minute = minuteOfDay(now)
  // While a shift runs, the line reaches to now. After the Feierabend it
  // stops at the last shift instead: a line that grew with the clock would
  // squeeze the worked day into its left third as the evening goes on.
  const live = state.running === true && state.date === ymd(now) ? [minute] : []
  const start = Math.min(core.start, ...spans.map((span) => span.start))
  const end = Math.max(core.end, ...live, ...spans.map((span) => span.end))
  const share = (moment) => (moment - start) / (end - start)
  // Before the core time and after the line's end there is no mark to place;
  // with nothing filled either, there is no line worth drawing.
  const nowFraction = minute >= start && minute <= end ? share(minute) : null
  if (spans.length === 0 && nowFraction === null) return null
  return {
    startText: toHhmm(start),
    endText: toHhmm(end),
    segments: spans.map((span) => ({ from: share(span.start), to: share(span.end), running: span.running })),
    nowFraction,
    tooltip: tooltip(core, spans, state),
  }
}

// Where a filled part of the line sits on a line `width` pixels wide, as
// { x, width }: a shift of a few minutes still has to be seen, so a part
// keeps the floor width — and it stays inside the line, floor included.
export function placeSegment(segment, width, floor) {
  return placed(segment.from, Math.max(floor, (segment.to - segment.from) * width), width)
}

// Where the mark for "now" sits, `thickness` pixels wide.
export function placeMark(fraction, width, thickness) {
  return placed(fraction, thickness, width)
}

function placed(from, thickness, width) {
  return { x: Math.max(0, Math.min(from * width, width - thickness)), width: thickness }
}
