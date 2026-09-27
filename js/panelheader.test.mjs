import { test } from "node:test"
import assert from "node:assert/strict"
import { headerView } from "./panelheader.mjs"
import { applyStamp, applyStatus, barView, emptyState, setDayOff } from "./shiftclock.mjs"

const at = (hhmm, date = "2026-09-22") => new Date(`${date}T${hhmm}:00`)
const workday = { date: "2026-09-22", workingDay: true, coreStart: "09:00", coreEnd: "16:45" }
const config = {}

// The panel builds the view the same way the bar does, so the tests go
// through the real barView instead of hand-written kinds.
const view = (state, now, extra = {}) =>
  barView(Object.assign({ state, now, authState: "ok", failed: false, reminding: false }, extra))

const header = (state, now, opts = {}) =>
  headerView({
    view: opts.view || view(state, now, opts.viewOpts),
    state,
    now,
    day: "day" in opts ? opts.day : workday,
    config: opts.config || config,
  })

// A shift that started at `from` and still runs at `now`.
function running(from, now = from) {
  return applyStatus(emptyState(), "running", at(now), { startedAt: from }).state
}

function onBreak(from, since, now) {
  const shift = applyStatus(emptyState(), "running", at(from), { startedAt: from }).state
  return applyStatus(shift, "break", at(now), { startedAt: from, breakSince: since }).state
}

test("the running shift duration is the large number, its caption stands below it", () => {
  const h = header(running("08:14"), at("11:56"))
  assert.equal(h.duration, "3:42")
  assert.equal(h.caption, "Shift running since 08:14")
})

test("the duration no longer sits in the caption, only in the large number", () => {
  const h = header(running("08:14"), at("11:56"))
  assert.ok(!h.caption.includes("3:42"), h.caption)
})

test("during a break the break duration counts, and the caption names its start", () => {
  const h = header(onBreak("08:00", "12:30", "12:30"), at("13:00"))
  assert.equal(h.duration, "0:30")
  assert.equal(h.caption, "On break since 12:30")
})

test("if the break's start is only estimated the caption says so", () => {
  const shift = applyStatus(running("08:00"), "break", at("12:40")).state
  assert.equal(header(shift, at("13:00")).caption, "On break since 12:40 at the latest")
})

test("with no running shift there is no number, only the caption", () => {
  const idle = applyStatus(emptyState(), "stopped", at("17:30")).state
  const h = header(idle, at("18:00"))
  assert.equal(h.duration, "")
  assert.equal(h.caption, "No running shift")
})

test("after your own end of day the caption names its time", () => {
  const out = applyStamp(running("08:00"), "clock-out", { ok: true }, at("17:30")).state
  assert.equal(header(out, at("18:00")).caption, "End of day since 17:30")
})

test("as long as the status is unknown no number stands there", () => {
  const h = header(emptyState(), at("09:30"))
  assert.equal(h.duration, "")
  assert.equal(h.caption, "Asking for the shift status …")
})

test("on an error the number stays empty and the caption says what is not working", () => {
  const h = header(running("08:00"), at("11:00"), { viewOpts: { failed: true } })
  assert.equal(h.duration, "")
  assert.equal(h.caption, "Shift status unknown")
})

test("if the login is missing the caption says so instead of a shift reading", () => {
  // The panel does not show the header area then, but barView knows the kind
  // "auth", and headerView answers for every kind it delivers.
  const h = header(running("08:00"), at("11:00"), { viewOpts: { authState: "required" } })
  assert.equal(h.duration, "")
  assert.equal(h.caption, "Login needed")
})

test("if the core time is running with no shift the caption says so", () => {
  const idle = applyStatus(emptyState(), "stopped", at("09:30")).state
  const h = header(idle, at("09:30"), { viewOpts: { reminding: true } })
  assert.equal(h.duration, "")
  assert.equal(h.caption, "Not clocked in yet, the core time is running")
})

test("when a shift runs whose start Calamari does not know there is no invented number", () => {
  const h = header(applyStatus(emptyState(), "running", at("11:00")).state, at("11:00"))
  assert.equal(h.duration, "")
  assert.equal(h.caption, "Shift running")
})

test("the bar measures the core time: half way through it is half full", () => {
  // 09:00–16:45 is 465 minutes, half of it lies 232.5 minutes later.
  const h = header(running("08:00"), at("12:52"))
  assert.equal(Math.round(h.progress.fraction * 100), 50)
  assert.equal(h.progress.text, "3:53 left until the end of core time")
})

test("the time left counts to the end of the core time, not to the end of day", () => {
  assert.equal(header(running("08:00"), at("16:00")).progress.text, "0:45 left until the end of core time")
})

test("before the start of the core time there is no empty bar", () => {
  assert.equal(header(running("07:30"), at("08:00")).progress, null)
})

test("from the start of the core time the bar is there, even while it still stands at zero", () => {
  const h = header(running("07:30"), at("09:00"))
  assert.equal(h.progress.fraction, 0)
  assert.equal(h.progress.text, "7:45 left until the end of core time")
})

test("after the end of the core time the bar is full and says so", () => {
  const h = header(running("08:00"), at("17:30"))
  assert.equal(h.progress.fraction, 1)
  assert.equal(h.progress.text, "Core time over")
})

test("without a core time the bar is dropped with nothing in its place", () => {
  assert.equal(header(running("08:00"), at("11:00"), { day: null }).progress, null)
  const noCore = { date: "2026-09-22", workingDay: false }
  assert.equal(header(running("08:00"), at("11:00"), { day: noCore }).progress, null)
})

test("on a day off the bar is dropped", () => {
  const holiday = Object.assign({}, workday, { holiday: { halfDay: false } })
  assert.equal(header(running("08:00"), at("11:00"), { day: holiday }).progress, null)
})

test("„Today off“ takes the bar away without touching the shift", () => {
  const state = setDayOff(running("08:00"), true, at("11:00"))
  const h = header(state, at("11:00"))
  assert.equal(h.progress, null)
  assert.equal(h.duration, "3:00")
})

test("a „Today off“ from yesterday does not take today's bar away", () => {
  // The switch applies only to its own day (ShiftClock.dayOffToday), and the
  // button in the panel shows it off again in the morning. If the status hangs
  // (backoff after a restart), the bar must not silently disappear while the
  // button „Today off" shows off.
  const yesterday = setDayOff(emptyState(), true, at("11:00", "2026-09-21"))
  assert.equal(yesterday.dayOff, true)
  assert.equal(yesterday.date, "2026-09-21")
  const h = header(yesterday, at("11:00"))
  assert.equal(h.progress.text, "5:45 left until the end of core time")
})

test("the day reading of another day does not count", () => {
  const yesterday = Object.assign({}, workday, { date: "2026-09-21" })
  assert.equal(header(running("08:00"), at("11:00"), { day: yesterday }).progress, null)
})

test("the bar hangs on the day, not on the shift: during a break and with no shift too", () => {
  const pause = onBreak("08:00", "12:00", "12:00")
  assert.equal(header(pause, at("12:52")).progress.text, "3:53 left until the end of core time")
  const idle = applyStatus(emptyState(), "stopped", at("12:52")).state
  assert.equal(header(idle, at("12:52")).progress.text, "3:53 left until the end of core time")
})

test("a core time set by hand beats the schedule from Calamari", () => {
  const own = { coreTuesday: "10:00-12:00" }
  const h = header(running("08:00"), at("11:00"), { config: own })
  assert.equal(Math.round(h.progress.fraction * 100), 50)
  assert.equal(h.progress.text, "1:00 left until the end of core time")
})

test("the setting „frei“ takes the bar away", () => {
  const h = header(running("08:00"), at("11:00"), { config: { coreTuesday: "frei" } })
  assert.equal(h.progress, null)
})

test("the header area passes the day row on as well", () => {
  const h = header(running("08:14"), at("11:56"))
  assert.equal(h.timeline.startText, "08:14")
  assert.equal(h.timeline.endText, "16:45")
  assert.equal(h.timeline.segments.length, 1)
})

test("the setting „frei“ takes the day row away too", () => {
  assert.equal(header(running("08:00"), at("11:00"), { config: { coreTuesday: "frei" } }).timeline, null)
})

test("a „Today off“ from yesterday does not take the day row away either", () => {
  // The same filtering as for the bar: the core time is determined once.
  const yesterday = setDayOff(emptyState(), true, at("11:00", "2026-09-21"))
  assert.notEqual(header(yesterday, at("11:00")).timeline, null)
})
