import { test } from "node:test"
import assert from "node:assert/strict"
import { placeMark, placeSegment, timelineView } from "./daytimeline.mjs"
import { toMinutes } from "./daytime.mjs"
import { applyStamp, applyStatus, emptyState } from "./shiftclock.mjs"

const at = (hhmm, date = "2026-09-22") => new Date(`${date}T${hhmm}:00`)

// Today's core time, the scale the line starts from.
const core = { start: toMinutes("09:00"), end: toMinutes("16:45") }

const line = (state, now, ownCore = core) => timelineView({ state, now, core: ownCore })

// A shift that started at `from` and still runs at `now`.
function running(state, from, now = from) {
  return applyStatus(state, "running", at(now), { startedAt: from }).state
}

// A shift from `start` to `end`, ended by the own clock-out (the path that
// puts it into state.shifts).
function ended(state, start, end) {
  return applyStamp(running(state, start), "clock-out", { ok: true }, at(end)).state
}

function onBreak(state, from, since, now) {
  return applyStatus(running(state, from), "break", at(now), { startedAt: from, breakSince: since }).state
}

// The share of the line a moment sits at, so the expectations read as times
// instead of as decimals.
const share = (hhmm, from = "09:00", to = "16:45") =>
  (toMinutes(hhmm) - toMinutes(from)) / (toMinutes(to) - toMinutes(from))

test("the row spans the core time and carries its ends as labels", () => {
  const v = line(running(emptyState(), "09:30", "11:00"), at("11:00"))
  assert.equal(v.startText, "09:00")
  assert.equal(v.endText, "16:45")
})

test("the running shift is a section from its start until now", () => {
  const v = line(running(emptyState(), "09:30", "11:00"), at("11:00"))
  assert.equal(v.segments.length, 1)
  assert.equal(v.segments[0].from, share("09:30"))
  assert.equal(v.segments[0].to, share("11:00"))
  assert.equal(v.segments[0].running, true)
})

test("the now marker sits on the current minute", () => {
  const v = line(running(emptyState(), "09:30", "11:00"), at("11:00"))
  assert.equal(v.nowFraction, share("11:00"))
})

test("several shifts in a day appear as separate sections", () => {
  const state = ended(ended(emptyState(), "09:00", "12:00"), "13:00", "15:00")
  const v = line(state, at("15:30"))
  assert.equal(v.segments.length, 2)
  assert.deepEqual(
    v.segments.map((s) => [s.from, s.to]),
    [
      [share("09:00"), share("12:00")],
      [share("13:00"), share("15:00")],
    ],
  )
  // No running shift: no section carries the accent colour.
  assert.deepEqual(
    v.segments.map((s) => s.running),
    [false, false],
  )
})

test("the running break is left out: the section ends at its start", () => {
  const v = line(onBreak(emptyState(), "09:00", "12:30", "12:30"), at("13:10"))
  assert.equal(v.segments.length, 1)
  assert.equal(v.segments[0].to, share("12:30"))
  // The shift goes on during the break.
  assert.equal(v.segments[0].running, true)
  assert.equal(v.nowFraction, share("13:10"))
})

test("a shift before the core time widens the span instead of being cut off", () => {
  const v = line(running(emptyState(), "07:30", "11:00"), at("11:00"))
  assert.equal(v.startText, "07:30")
  assert.equal(v.endText, "16:45")
  assert.equal(v.segments[0].from, 0)
  assert.equal(v.segments[0].to, share("11:00", "07:30"))
})

test("a shift past the core time widens the span up to its end", () => {
  const v = line(ended(emptyState(), "09:00", "18:20"), at("18:30"))
  assert.equal(v.endText, "18:20")
  assert.equal(v.segments[0].to, 1)
})

test("the running shift pulls the span past the core time up to now", () => {
  const v = line(running(emptyState(), "09:00", "17:30"), at("17:30"))
  assert.equal(v.endText, "17:30")
  assert.equal(v.nowFraction, 1)
})

test("the running break keeps the row open, after the end of the core time too", () => {
  // The shift goes on: without now inside the span the marker would vanish
  // in the middle of the running shift.
  const v = line(onBreak(emptyState(), "09:00", "16:30", "16:30"), at("17:00"))
  assert.equal(v.endText, "17:00")
  assert.equal(v.nowFraction, 1)
})

test("after the end of day the row does not go on growing with the clock", () => {
  // Otherwise the day worked would be squeezed further and further to the
  // left over the course of the evening, on a perfectly ordinary day.
  const abend = ended(emptyState(), "09:00", "16:00")
  assert.equal(line(abend, at("17:30")).endText, "16:45")
  assert.equal(line(abend, at("22:00")).endText, "16:45")
  assert.deepEqual(line(abend, at("22:00")).segments, line(abend, at("17:30")).segments)
})

test("beyond the row's end there is no now marker, rather than a wrong one at the edge", () => {
  assert.equal(line(ended(emptyState(), "09:00", "16:00"), at("17:30")).nowFraction, null)
})

test("with no stamping the row is gone after the core time, not empty", () => {
  assert.equal(line(emptyState(), at("17:30")), null)
})

test("before the start of the core time and with no work there is no row", () => {
  assert.equal(line(emptyState(), at("07:00")), null)
})

test("without a core time there is no row: a day off, a day with no schedule", () => {
  assert.equal(line(running(emptyState(), "09:30", "11:00"), at("11:00"), null), null)
})

test("during the core time with no stamping the row stands there empty, with the marker", () => {
  const v = line(emptyState(), at("10:00"))
  assert.deepEqual(v.segments, [])
  assert.equal(v.nowFraction, share("10:00"))
})

test("the state of another day contributes no sections", () => {
  const yesterday = ended(emptyState(), "09:00", "17:00")
  assert.equal(yesterday.date, "2026-09-22")
  const v = timelineView({ state: yesterday, now: at("10:00", "2026-09-23"), core })
  assert.deepEqual(v.segments, [])
})

test("a shift with no known start is not invented", () => {
  const v = line(applyStatus(emptyState(), "running", at("11:00")).state, at("11:00"))
  assert.equal(v.segments.length, 0)
})

test("sections stand in time order, even when an end time arrived later", () => {
  // end-time can supply the end time of an earlier shift after a later one
  // has already ended (js/shiftclock.mjs applyEndTime).
  const state = Object.assign(ended(emptyState(), "13:00", "15:00"), {
    shifts: [
      { start: "13:00", end: "15:00" },
      { start: "09:30", end: "11:00" },
    ],
  })
  const v = line(state, at("15:30"))
  assert.deepEqual(
    v.segments.map((s) => s.from),
    [share("09:30"), share("13:00")],
  )
})

test("the tooltip names the core time and the exact times of the shifts", () => {
  const state = running(ended(emptyState(), "09:00", "12:00"), "12:30", "14:00")
  assert.equal(
    line(state, at("14:00")).tooltip,
    ["Kernzeit 09:00–16:45", "Schicht 09:00–12:00", "Schicht seit 12:30 (läuft)"].join("\n"),
  )
})

test("the tooltip names the running break and how exactly its start is known", () => {
  const known = onBreak(emptyState(), "09:00", "12:30", "12:30")
  assert.equal(
    line(known, at("13:10")).tooltip,
    ["Kernzeit 09:00–16:45", "Schicht seit 09:00 (läuft)", "Pause seit 12:30"].join("\n"),
  )
  const guessed = applyStatus(running(emptyState(), "09:00"), "break", at("12:40")).state
  assert.ok(line(guessed, at("13:10")).tooltip.endsWith("Pause seit spätestens 12:40"))
})

test("breaks that have ended sit inside the shifts: the tooltip says so instead of leaving them out", () => {
  // Breaks that have ended sit in the state only as a sum of minutes, not as
  // intervals — only the running one can be left out.
  const back = applyStatus(onBreak(emptyState(), "09:00", "12:30", "12:30"), "running", at("13:00"), {
    startedAt: "09:00",
  }).state
  assert.equal(back.breakMinutes, 30)
  assert.ok(line(back, at("14:00")).tooltip.endsWith("Beendete Pausen: 0:30 (in den Schichten enthalten)"))
})

test("with no ended break the tooltip stays silent about it", () => {
  assert.ok(!line(ended(emptyState(), "09:00", "12:00"), at("13:00")).tooltip.includes("Beendete Pausen"))
})

test("the row stays intact when the core time is only one minute long", () => {
  // coreTime() allows start < end, so one minute too (a half public holiday
  // on a short schedule). The division is then by 1, not by 0.
  const minute = { start: toMinutes("09:00"), end: toMinutes("09:01") }
  const v = line(running(emptyState(), "09:00", "09:00"), at("09:00"), minute)
  assert.equal(v.nowFraction, 0)
  assert.equal(v.segments[0].from, 0)
  assert.equal(v.segments[0].to, 0)
})

test("a section of a few minutes keeps a minimum width", () => {
  // Otherwise a shift of one minute would be invisible across 300 pixels.
  assert.deepEqual(placeSegment({ from: 0.5, to: 0.5 }, 300, 2), { x: 150, width: 2 })
})

test("a longer section keeps its share of the row", () => {
  assert.deepEqual(placeSegment({ from: 0, to: 0.5 }, 300, 2), { x: 0, width: 150 })
})

test("a section at the end stays inside the row, minimum width and all", () => {
  const place = placeSegment({ from: 1, to: 1 }, 300, 2)
  assert.equal(place.x, 298)
  assert.equal(place.width, 2)
})

test("the now marker stays inside the row at both edges", () => {
  assert.deepEqual(placeMark(1, 300, 2), { x: 298, width: 2 })
  assert.deepEqual(placeMark(0, 300, 2), { x: 0, width: 2 })
})
