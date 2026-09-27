import { test } from "node:test"
import { readFileSync } from "node:fs"
import assert from "node:assert/strict"
import {
  DEFAULTS,
  closeFor,
  countdownText,
  decide,
  extendLabel,
  markSent,
  notification,
  postpone,
} from "./reminders.mjs"
import { applyDayEnd, applyStamp, applyStatus, emptyState, restoreState, setDayOff } from "./shiftclock.mjs"
import { heartbeat, setIdle } from "./activity.mjs"

const at = (hhmm, date = "2026-09-22") => new Date(`${date}T${hhmm}:00`)
const workday = { date: "2026-09-22", workingDay: true, coreStart: "09:00", coreEnd: "16:45" }
const config = { stampReminderMinutes: 5 }
const noShift = (now) => applyStatus(emptyState(), "stopped", at(now)).state
const types = (r) => r.actions.map((a) => a.type)
const quietDay = { barState: null, actions: [], nextCheckAt: null, autoCloseAt: null, canExtend: false }

test("during the core time with no shift a stamp reminder comes at once", () => {
  const r = decide(at("09:00"), workday, noShift("09:00"), config)
  assert.deepEqual(types(r), ["stamp-reminder"])
  assert.equal(r.barState, "reminder")
})

test("a stamp reminder already sent does not come twice, only again after 5 minutes", () => {
  const state = markSent(noShift("09:00"), "stamp-reminder", at("09:00"))
  const again = decide(at("09:00"), workday, state, config)
  assert.deepEqual(types(again), [])
  assert.equal(again.barState, "reminder")
  assert.deepEqual(again.nextCheckAt, at("09:05"))
  assert.deepEqual(types(decide(at("09:04"), workday, state, config)), [])
  assert.deepEqual(types(decide(at("09:05"), workday, state, config)), ["stamp-reminder"])
})

test("the reminders already sent survive a restart of the shell", () => {
  const state = markSent(noShift("09:00"), "stamp-reminder", at("09:00"))
  assert.deepEqual(types(decide(at("09:02"), workday, restoreState(JSON.stringify(state)), config)), [])
})

test("the stamp reminder ends with the end of the core time", () => {
  const state = markSent(noShift("16:43"), "stamp-reminder", at("16:43"))
  assert.deepEqual(decide(at("16:43"), workday, state, config).nextCheckAt, at("16:45"))
  const r = decide(at("16:45"), workday, state, config)
  assert.deepEqual(types(r), [])
  assert.notEqual(r.barState, "reminder")
})

test("before the core time the next check is at its start", () => {
  const r = decide(at("08:30"), workday, noShift("08:30"), config)
  assert.deepEqual(types(r), [])
  assert.deepEqual(r.nextCheckAt, at("09:00"))
})

const stamp = (state, action, now) =>
  applyStamp(state, action, { ok: true, running: action === "clock-in", onBreak: action === "break-start" }, at(now))
    .state

test("after an end of day before the core time is over no stamp reminder comes any more", () => {
  const state = stamp(stamp(noShift("08:55"), "clock-in", "09:00"), "clock-out", "15:30")
  const r = decide(at("15:35"), workday, state, config)
  assert.deepEqual(types(r), [])
  assert.notEqual(r.barState, "reminder")
})

test("having clocked in already today means no stamp reminder", () => {
  // Stamped in and out in the web: no end of day, but not "not clocked in at all yet".
  let state = applyStatus(noShift("08:55"), "running", at("09:10")).state
  state = applyStatus(state, "stopped", at("12:00")).state
  assert.deepEqual(types(decide(at("12:05"), workday, state, config)), [])
})

test("after clocking in again past the end of day the shift runs with no reminder", () => {
  let state = stamp(stamp(noShift("08:55"), "clock-in", "09:00"), "clock-out", "12:00")
  state = stamp(state, "clock-in", "13:00")
  const r = decide(at("13:05"), workday, state, config)
  assert.deepEqual(types(r), [])
  assert.notEqual(r.barState, "reminder")
})

test("starting in the middle of the core time is reminded at once", () => {
  // Shell start or wake-up at 11:07: nothing sent today yet.
  assert.deepEqual(types(decide(at("11:07"), workday, noShift("11:07"), config)), ["stamp-reminder"])
})

test("at the weekend there is no stamp reminder", () => {
  const saturday = { date: "2026-09-26", workingDay: false, coreStart: null, coreEnd: null }
  const r = decide(
    at("10:00", "2026-09-26"),
    saturday,
    applyStatus(emptyState(), "stopped", at("10:00", "2026-09-26")).state,
    config,
  )
  assert.deepEqual(r, quietDay)
})

test("with no known work schedule or status nothing reminds", () => {
  assert.deepEqual(types(decide(at("10:00"), null, noShift("10:00"), config)), [])
  assert.deepEqual(types(decide(at("10:00"), workday, emptyState(), config)), [])
  const failed = Object.assign({ failed: true }, noShift("10:00"))
  assert.deepEqual(types(decide(at("10:00"), workday, failed, config)), [])
})

test("yesterday's work schedule does not apply today", () => {
  const yesterday = Object.assign({}, workday, { date: "2026-09-21" })
  assert.deepEqual(types(decide(at("10:00"), yesterday, noShift("10:00"), config)), [])
})

test("the stamp reminder names the start of the core time", () => {
  assert.deepEqual(notification({ type: "stamp-reminder" }, workday), {
    headline: "Noch nicht eingestempelt",
    body: "Die Kernzeit läuft seit 09:00.",
    click: "panel",
  })
})

test("a state from yesterday triggers no stamp reminder today", () => {
  // e.g. right after midnight, before the first poll of the new day
  const yesterday = Object.assign(noShift("10:00"), { date: "2026-09-21" })
  assert.deepEqual(types(decide(at("10:00"), workday, yesterday, config)), [])
})

test("a working day with no core time in the work schedule triggers no reminder", () => {
  const vague = Object.assign({}, workday, { coreStart: null, coreEnd: null })
  assert.deepEqual(decide(at("10:00"), vague, noShift("10:00"), config), quietDay)
})

// Days off

const withDay = (extra) => Object.assign({}, workday, { holiday: null, absence: null }, extra)

test("on a public holiday there is no stamp reminder", () => {
  const day = withDay({ holiday: { name: "Tag der Deutschen Einheit", halfDay: false, halfdayPeriod: null } })
  assert.deepEqual(decide(at("10:00"), day, noShift("10:00"), config), quietDay)
})

test("a half public holiday in the afternoon makes the core time end at 12:00", () => {
  const eve = withDay({ date: "2026-12-24", holiday: { name: "Heiligabend (PM)", halfDay: true, halfdayPeriod: "PM" } })
  const state = applyStatus(emptyState(), "stopped", at("11:50", "2026-12-24")).state
  assert.deepEqual(types(decide(at("11:50", "2026-12-24"), eve, state, config)), ["stamp-reminder"])
  assert.deepEqual(decide(at("12:00", "2026-12-24"), eve, state, config), quietDay)
})

test("a half public holiday in the morning makes the core time begin only at 12:00", () => {
  const morningOff = withDay({ holiday: { name: "Halber Tag (AM)", halfDay: true, halfdayPeriod: "AM" } })
  const r = decide(at("10:00"), morningOff, noShift("10:00"), config)
  assert.deepEqual(types(r), [])
  assert.deepEqual(r.nextCheckAt, at("12:00"))
})

test("on a holiday or a sick day there is no stamp reminder", () => {
  const day = withDay({ absence: { category: "TIMEOFF", fullDay: true } })
  assert.deepEqual(decide(at("10:00"), day, noShift("10:00"), config), quietDay)
})

test("an absence that is worked through is not a day off", () => {
  // e.g. a business trip: category WORK
  const day = withDay({ absence: { category: "WORK", fullDay: true } })
  assert.deepEqual(types(decide(at("10:00"), day, noShift("10:00"), config)), ["stamp-reminder"])
})

test("an absence by the hour is not a day off", () => {
  const day = withDay({ absence: { category: "TIMEOFF", fullDay: false } })
  assert.deepEqual(types(decide(at("10:00"), day, noShift("10:00"), config)), ["stamp-reminder"])
})

test("with „Heute frei“ there is no stamp reminder today, after a restart too", () => {
  const state = restoreState(JSON.stringify(setDayOff(noShift("08:00"), true, at("08:00"))))
  assert.deepEqual(decide(at("10:00"), withDay({}), state, config), quietDay)
})

test("„Heute frei“ can be taken back", () => {
  const state = setDayOff(setDayOff(noShift("08:00"), true, at("08:00")), false, at("10:00"))
  assert.deepEqual(types(decide(at("10:00"), withDay({}), state, config)), ["stamp-reminder"])
})

test("„Heute frei“ no longer applies the next day", () => {
  const monday = setDayOff(
    applyStatus(emptyState(), "stopped", at("08:00", "2026-09-21")).state,
    true,
    at("08:00", "2026-09-21"),
  )
  const tuesday = applyStatus(monday, "stopped", at("10:00")).state
  assert.deepEqual(types(decide(at("10:00"), withDay({}), tuesday, config)), ["stamp-reminder"])
})

test("a work-schedule override applies to its weekday", () => {
  // 2026-09-22 is a Tuesday
  const own = Object.assign({}, config, { coreTuesday: "08:00-13:00" })
  assert.deepEqual(types(decide(at("08:00"), withDay({}), noShift("08:00"), own)), ["stamp-reminder"])
  assert.deepEqual(decide(at("13:00"), withDay({}), noShift("13:00"), own), quietDay)
  const otherDay = Object.assign({}, config, { coreMonday: "08:00-13:00" })
  assert.deepEqual(types(decide(at("08:00"), withDay({}), noShift("08:00"), otherDay)), [])
})

test("a work-schedule override turns a non-working weekday into a working day", () => {
  const saturday = {
    date: "2026-09-26",
    workingDay: false,
    coreStart: null,
    coreEnd: null,
    holiday: null,
    absence: null,
  }
  const state = applyStatus(emptyState(), "stopped", at("10:00", "2026-09-26")).state
  const own = Object.assign({}, config, { coreSaturday: "09:00-12:00" })
  assert.deepEqual(types(decide(at("10:00", "2026-09-26"), saturday, state, own)), ["stamp-reminder"])
})

test("„frei“ as a work-schedule override makes the weekday a non-working one", () => {
  const own = Object.assign({}, config, { coreTuesday: "frei" })
  assert.deepEqual(decide(at("10:00"), withDay({}), noShift("10:00"), own), quietDay)
})

test("an unreadable work-schedule override leaves the work schedule standing", () => {
  for (const text of ["", "8-13 Uhr", "13:00-08:00", "09:00-99:99", "25:00-26:00"]) {
    const own = Object.assign({}, config, { coreTuesday: text })
    assert.deepEqual(types(decide(at("10:00"), withDay({}), noShift("10:00"), own)), ["stamp-reminder"], text)
  }
})

test("a public holiday applies on an overridden weekday too", () => {
  const day = withDay({ holiday: { name: "Tag der Deutschen Einheit", halfDay: false, halfdayPeriod: null } })
  const own = Object.assign({}, config, { coreTuesday: "08:00-13:00" })
  assert.deepEqual(decide(at("10:00"), day, noShift("10:00"), own), quietDay)
})

test("a work-schedule override may write the hour with one digit", () => {
  const own = Object.assign({}, config, { coreTuesday: "8:00-13:00" })
  assert.deepEqual(types(decide(at("08:00"), withDay({}), noShift("08:00"), own)), ["stamp-reminder"])
})

// Break

const breakConfig = Object.assign({}, config, { breakLimitMinutes: 30, breakReminderMinutes: 5 })
const onBreak = (since, begun = "09:00") => stamp(stamp(noShift("08:55"), "clock-in", begun), "break-start", since)

test("during a break no stamp reminder comes", () => {
  const r = decide(at("12:10"), workday, onBreak("12:00"), breakConfig)
  assert.deepEqual(types(r), [])
  assert.notEqual(r.barState, "reminder")
  assert.deepEqual(r.nextCheckAt, at("12:30"))
})

test("after 30 minutes of break a break reminder comes, then every 5 minutes", () => {
  let state = onBreak("12:00")
  assert.deepEqual(types(decide(at("12:29"), workday, state, breakConfig)), [])
  assert.deepEqual(types(decide(at("12:30"), workday, state, breakConfig)), ["break-reminder"])
  state = markSent(state, "break-reminder", at("12:30"))
  const again = decide(at("12:30"), workday, state, breakConfig)
  assert.deepEqual(types(again), [])
  assert.deepEqual(again.nextCheckAt, at("12:35"))
  assert.deepEqual(types(decide(at("12:35"), workday, state, breakConfig)), ["break-reminder"])
})

test("the break reminder of an earlier break does not count for the next one", () => {
  let state = markSent(onBreak("10:00"), "break-reminder", at("10:30"))
  state = stamp(state, "break-end", "10:40")
  state = stamp(state, "break-start", "15:00")
  assert.deepEqual(types(decide(at("15:30"), workday, state, breakConfig)), ["break-reminder"])
})

test("a long break reminds at the weekend too", () => {
  const saturday = {
    date: "2026-09-26",
    workingDay: false,
    coreStart: null,
    coreEnd: null,
    holiday: null,
    absence: null,
  }
  let state = applyStatus(emptyState(), "stopped", at("09:55", "2026-09-26")).state
  state = applyStamp(state, "clock-in", { ok: true, running: true }, at("10:00", "2026-09-26")).state
  state = applyStamp(state, "break-start", { ok: true, onBreak: true }, at("11:00", "2026-09-26")).state
  assert.deepEqual(types(decide(at("11:30", "2026-09-26"), saturday, state, breakConfig)), ["break-reminder"])
})

test("after the break ends no break reminder comes any more", () => {
  const state = stamp(onBreak("12:00"), "break-end", "12:45")
  assert.deepEqual(types(decide(at("12:50"), workday, state, breakConfig)), [])
})

test("the break reminder names the start of the break", () => {
  assert.deepEqual(notification({ type: "break-reminder" }, workday, onBreak("12:00")), {
    headline: "Pause läuft noch",
    body: "Die Pause läuft seit 12:00.",
    click: "panel",
  })
})

// Soft hint, final warning, auto-close

const eveningConfig = Object.assign({}, breakConfig, {
  softHintMinutes: 30,
  finalWarningTime: "19:00",
  autoCloseMinutes: 15,
  extendMinutes: 60,
  hardLimitTime: "23:00",
})
const working = (begun = "09:00") => stamp(noShift("08:55"), "clock-in", begun)

test("30 minutes after the end of the core time the soft hint comes exactly once", () => {
  let state = working()
  assert.deepEqual(types(decide(at("17:14"), workday, state, eveningConfig)), [])
  assert.deepEqual(decide(at("17:14"), workday, state, eveningConfig).nextCheckAt, at("17:15"))
  assert.deepEqual(types(decide(at("17:15"), workday, state, eveningConfig)), ["soft-hint"])
  state = markSent(state, "soft-hint", at("17:15"))
  assert.deepEqual(types(decide(at("17:15"), workday, state, eveningConfig)), [])
  assert.deepEqual(types(decide(at("18:30"), workday, state, eveningConfig)), [])
})

const hinted = (begun = "09:00") => markSent(working(begun), "soft-hint", at("17:15"))

test("the final warning comes at its time of day, the auto-close 15 minutes later", () => {
  let state = hinted()
  const before = decide(at("18:59"), workday, state, eveningConfig)
  assert.deepEqual(types(before), [])
  assert.deepEqual(before.nextCheckAt, at("19:00"))
  const warning = decide(at("19:00"), workday, state, eveningConfig)
  assert.deepEqual(types(warning), ["final-warning"])
  assert.deepEqual(warning.autoCloseAt, at("19:15"))
  state = markSent(state, "final-warning", at("19:00"))
  const countdown = decide(at("19:10"), workday, state, eveningConfig)
  assert.deepEqual(types(countdown), [])
  assert.deepEqual(countdown.autoCloseAt, at("19:15"))
  assert.deepEqual(countdown.nextCheckAt, at("19:15"))
  assert.deepEqual(types(decide(at("19:15"), workday, state, eveningConfig)), ["auto-close"])
})

test("„+1 h“ shifts the final warning and the auto-close, after a restart too", () => {
  let state = markSent(hinted(), "final-warning", at("19:00"))
  state = restoreState(JSON.stringify(postpone(state, eveningConfig, at("19:05"))))
  const r = decide(at("19:15"), workday, state, eveningConfig)
  assert.deepEqual(types(r), [])
  assert.deepEqual(r.autoCloseAt, null)
  assert.deepEqual(r.nextCheckAt, at("20:05"))
  assert.deepEqual(types(decide(at("20:05"), workday, state, eveningConfig)), ["final-warning"])
  state = markSent(state, "final-warning", at("20:05"))
  assert.deepEqual(types(decide(at("20:20"), workday, state, eveningConfig)), ["auto-close"])
})

test("„+1 h“ works after a late final warning too", () => {
  // Machine opened at 21:00: warned then, "+1 h" at 21:05.
  const state = postpone(markSent(hinted(), "final-warning", at("21:00")), eveningConfig, at("21:05"))
  const r = decide(at("21:15"), workday, state, eveningConfig)
  assert.deepEqual(types(r), [])
  assert.deepEqual(r.nextCheckAt, at("22:05"))
})

test("the upper limit wins against every „+1 h“", () => {
  let state = markSent(hinted(), "final-warning", at("21:50"))
  state = postpone(state, eveningConfig, at("21:55"))
  // 22:55 would leave no wait before 23:00; the warning comes at 22:45.
  assert.deepEqual(types(decide(at("22:45"), workday, state, eveningConfig)), ["final-warning"])
  state = markSent(state, "final-warning", at("22:50"))
  const r = decide(at("22:50"), workday, state, eveningConfig)
  assert.deepEqual(r.autoCloseAt, at("23:00"))
  assert.equal(r.canExtend, false)
  assert.deepEqual(types(decide(at("23:00"), workday, state, eveningConfig)), ["auto-close"])
})

test("„+1 h“ is only offered while it shifts anything", () => {
  const early = markSent(hinted(), "final-warning", at("19:00"))
  assert.equal(decide(at("19:05"), workday, early, eveningConfig).canExtend, true)
  const late = markSent(hinted(), "final-warning", at("22:45"))
  assert.equal(decide(at("22:50"), workday, late, eveningConfig).canExtend, false)
})

test("clocking in only after the upper limit is warned and clocked out after the wait", () => {
  let state = stamp(stamp(hinted(), "clock-out", "17:30"), "clock-in", "23:10")
  const r = decide(at("23:10"), workday, state, eveningConfig)
  assert.deepEqual(types(r), ["final-warning"])
  assert.deepEqual(r.autoCloseAt, at("23:25"))
  state = markSent(state, "final-warning", at("23:10"))
  assert.deepEqual(types(decide(at("23:11"), workday, state, eveningConfig)), [])
  assert.deepEqual(types(decide(at("23:25"), workday, state, eveningConfig)), ["auto-close"])
})

test("a shift begun only in the evening gets no soft hint", () => {
  const state = stamp(stamp(working(), "clock-out", "16:00"), "clock-in", "18:00")
  assert.deepEqual(types(decide(at("18:00"), workday, state, eveningConfig)), [])
})

test("at the weekend with a running shift the final warning and the auto-close come, but no soft hint", () => {
  const saturday = {
    date: "2026-09-26",
    workingDay: false,
    coreStart: null,
    coreEnd: null,
    holiday: null,
    absence: null,
  }
  let state = applyStatus(emptyState(), "stopped", at("09:55", "2026-09-26")).state
  state = applyStamp(state, "clock-in", { ok: true, running: true }, at("10:00", "2026-09-26")).state
  assert.deepEqual(types(decide(at("18:00", "2026-09-26"), saturday, state, eveningConfig)), [])
  assert.deepEqual(types(decide(at("19:00", "2026-09-26"), saturday, state, eveningConfig)), ["final-warning"])
  state = markSent(state, "final-warning", at("19:00", "2026-09-26"))
  assert.deepEqual(types(decide(at("19:15", "2026-09-26"), saturday, state, eveningConfig)), ["auto-close"])
})

test("clocking in only after the final warning's time of day is warned only before the upper limit", () => {
  const state = stamp(stamp(hinted(), "clock-out", "17:30"), "clock-in", "20:00")
  const r = decide(at("20:00"), workday, state, eveningConfig)
  assert.deepEqual(types(r), [])
  assert.deepEqual(r.nextCheckAt, at("22:45"))
})

test("opening the machine only after the final warning is warned and not clocked out at once", () => {
  let state = hinted()
  const r = decide(at("21:00"), workday, state, eveningConfig)
  assert.deepEqual(types(r), ["final-warning"])
  assert.deepEqual(r.autoCloseAt, at("21:15"))
  state = markSent(state, "final-warning", at("21:00"))
  assert.deepEqual(types(decide(at("21:10"), workday, state, eveningConfig)), [])
})

test("after the end of day neither a soft hint nor a final warning comes", () => {
  const state = stamp(working(), "clock-out", "16:00")
  for (const time of ["17:15", "19:00", "23:00"])
    assert.deepEqual(decide(at(time), workday, state, eveningConfig), quietDay, time)
})

test("a failed auto-close is retried after 5 minutes, not at every check", () => {
  let state = markSent(hinted(), "final-warning", at("19:00"))
  state = markSent(state, "auto-close", at("19:15"))
  assert.deepEqual(types(decide(at("19:16"), workday, state, eveningConfig)), [])
  assert.deepEqual(types(decide(at("19:20"), workday, state, eveningConfig)), ["auto-close"])
})

test("the logic's defaults are the manifest's", () => {
  const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url)))
  for (const [key, value] of Object.entries(DEFAULTS)) assert.equal(manifest.barWidget.defaults[key], value, key)
})

test("the soft hint, the final warning and the correction hint name their times", () => {
  const hint = decide(at("17:15"), workday, working(), eveningConfig).actions[0]
  assert.deepEqual(notification(hint, workday, working()), {
    headline: "Schicht läuft noch",
    body: "Die Kernzeit endete um 16:45.",
    click: "panel",
  })
  const warning = decide(at("19:00"), workday, hinted(), eveningConfig).actions[0]
  assert.deepEqual(notification(warning, workday, hinted()), {
    headline: "Letzte Warnung",
    body: "Auto-Abschluss um 19:15. Im Panel: +1 h weiterarbeiten oder jetzt ausstempeln.",
    click: "panel",
  })
  assert.deepEqual(notification({ type: "auto-closed", at: "19:15", lastActivity: null }, workday, hinted()), {
    headline: "Schicht automatisch beendet",
    body: "Um 19:15 ausgestempelt. Bitte die Endzeit in Calamari korrigieren.",
    click: "calamari",
  })
})

test("after the final warning the panel shows a countdown to the auto-close", () => {
  const state = markSent(hinted(), "final-warning", at("19:00"))
  const r = decide(at("19:03"), workday, state, eveningConfig)
  assert.equal(countdownText(r, new Date("2026-09-22T19:03:30")), "Auto-Abschluss um 19:15, noch 12 Min")
  assert.equal(countdownText(decide(at("18:00"), workday, hinted(), eveningConfig), at("18:00")), "")
})

test("the button that shifts it names the duration configured", () => {
  assert.equal(extendLabel({}), "+1 h weiterarbeiten")
  assert.equal(extendLabel({ extendMinutes: 90 }), "+90 Min weiterarbeiten")
})

test("the final warning names the shift configured", () => {
  const own = Object.assign({}, eveningConfig, { extendMinutes: 90 })
  const warning = decide(at("19:00"), workday, hinted(), own).actions[0]
  assert.match(
    notification(warning, workday, hinted(), own).body,
    /Im Panel: \+90 Min weiterarbeiten oder jetzt ausstempeln\.$/,
  )
})

// Last activity and the day-end close

const wednesday = {
  date: "2026-09-23",
  workingDay: true,
  coreStart: "09:00",
  coreEnd: "16:45",
  holiday: null,
  absence: null,
}
// Shift since 09:00 on Tuesday, lid closed at 17:59, opened Wednesday 07:30.
// Calamari ended the shift at 23:59 itself, so nothing runs this morning.
const morningAfter = () => {
  const state = heartbeat(heartbeat(working(), at("17:58")), at("17:59"))
  return heartbeat(state, at("07:30", "2026-09-23"))
}

test("after the correction hint for the previous day the new day begins normally", () => {
  const state = applyDayEnd(morningAfter(), "2026-09-22", true, at("07:30", "2026-09-23")).state
  assert.equal(state.clockedOutAt, null)
  assert.deepEqual(types(decide(at("07:30", "2026-09-23"), wednesday, state, eveningConfig)), [])
  const later = applyStatus(state, "stopped", at("09:00", "2026-09-23")).state
  assert.deepEqual(types(decide(at("09:00", "2026-09-23"), wednesday, later, eveningConfig)), ["stamp-reminder"])
  assert.equal(later.stampedToday, false)
})

test("the hint about the day-end close names the last activity of that day", () => {
  assert.deepEqual(
    notification(
      { type: "day-end-closed", date: "2026-09-22", lastActivity: "2026-09-22T17:59" },
      wednesday,
      morningAfter(),
    ),
    {
      headline: "Schicht vom Vortag beendet",
      body: "Die Schicht vom 22.09. lief bis zum Tagesende, Calamari hat sie um 23:59 beendet. Bitte die Endzeit dort auf 17:59 korrigieren (letzte Aktivität).",
      click: "calamari",
    },
  )
})

test("with no known last activity the hint only asks for the correction", () => {
  assert.deepEqual(
    notification({ type: "day-end-closed", date: "2026-09-22", lastActivity: null }, wednesday, morningAfter()),
    {
      headline: "Schicht vom Vortag beendet",
      body: "Die Schicht vom 22.09. lief bis zum Tagesende, Calamari hat sie um 23:59 beendet. Bitte die Endzeit dort korrigieren.",
      click: "calamari",
    },
  )
})

test("the correction hint after the auto-close names the last activity", () => {
  let state = markSent(hinted(), "final-warning", at("19:00"))
  state = setIdle(state, true, at("18:45"), 300)
  const close = decide(at("19:15"), workday, state, eveningConfig).actions[0]
  assert.deepEqual(close, { type: "auto-close", lastActivity: "2026-09-22T18:40" })
  assert.deepEqual(
    notification({ type: "auto-closed", at: "19:15", lastActivity: close.lastActivity }, workday, state).body,
    "Um 19:15 ausgestempelt, letzte Aktivität 18:40. Bitte die Endzeit in Calamari darauf korrigieren.",
  )
})

test("being active at the auto-close means no last activity is named", () => {
  const state = markSent(hinted(), "final-warning", at("19:00"))
  assert.deepEqual(decide(at("19:15"), workday, state, eveningConfig).actions, [
    { type: "auto-close", lastActivity: null },
  ])
})

test("the auto-close clocks out and announces its correction hint", () => {
  assert.deepEqual(closeFor({ type: "auto-close", lastActivity: "2026-09-22T18:40" }), {
    stamp: "clock-out",
    notice: { type: "auto-closed", lastActivity: "2026-09-22T18:40" },
  })
  assert.equal(closeFor({ type: "stamp-reminder" }), null)
})

test("after an auto-close a new shift gets its own final warning, after „+1 h“ too", () => {
  // Warned 19:00, "+1 h" to 20:00, warned again, auto-closed 20:15; back at work 20:30.
  let state = markSent(hinted(), "final-warning", at("19:00"))
  state = markSent(postpone(state, eveningConfig, at("19:00")), "final-warning", at("20:00"))
  state = markSent(state, "auto-close", at("20:15"))
  state = stamp(stamp(state, "clock-out", "20:15"), "clock-in", "20:30")
  const r = decide(at("20:35"), workday, state, eveningConfig)
  assert.deepEqual(types(r), [])
  assert.deepEqual(r.nextCheckAt, at("22:45"))
})

test("as long as the start of a shift begun in the web is unknown nothing is clocked out", () => {
  let state = markSent(
    postpone(markSent(hinted(), "final-warning", at("19:00")), eveningConfig, at("19:00")),
    "final-warning",
    at("20:00"),
  )
  state = stamp(markSent(state, "auto-close", at("20:15")), "clock-out", "20:15")
  // Clocked in on the phone; the poll sees it, start-time has not answered yet.
  state = applyStatus(state, "running", at("20:40")).state
  assert.deepEqual(types(decide(at("20:40"), workday, state, eveningConfig)), [])
})

// A break Calamari reports (in the web, on the phone)

const seenBreak = (seen, begun = "09:00") => applyStatus(working(begun), "break", at(seen)).state

test("in a break started elsewhere no stamp reminder and no soft hint come", () => {
  assert.deepEqual(types(decide(at("12:10"), workday, seenBreak("12:00"), breakConfig)), [])
  assert.deepEqual(types(decide(at("17:20"), workday, seenBreak("17:10"), eveningConfig)), [])
})

test("the break reminder of a break started elsewhere counts from first seeing it", () => {
  let state = seenBreak("12:10")
  state = applyStatus(state, "break", at("12:30")).state
  assert.deepEqual(types(decide(at("12:39"), workday, state, breakConfig)), [])
  assert.deepEqual(types(decide(at("12:40"), workday, state, breakConfig)), ["break-reminder"])
})

test("the break reminder of a break started elsewhere says its start is not known", () => {
  assert.deepEqual(notification({ type: "break-reminder" }, workday, seenBreak("12:10")), {
    headline: "Pause läuft noch",
    body: "Die Pause läuft seit spätestens 12:10.",
    click: "panel",
  })
})

test("after a break started elsewhere the shift goes on with its reminders", () => {
  const state = applyStatus(seenBreak("12:10"), "running", at("12:40")).state
  assert.deepEqual(types(decide(at("17:15"), workday, state, eveningConfig)), ["soft-hint"])
})

// A break in the evening (ticket 05)

const pausedAt = (since, begun = "09:00") => stamp(working(begun), "break-start", since)

test("in a break in the evening the final warning and the auto-close come as in the shift", () => {
  let state = markSent(pausedAt("18:30"), "break-reminder", at("19:00"))
  const warning = decide(at("19:00"), workday, state, eveningConfig)
  assert.deepEqual(types(warning), ["final-warning"])
  assert.deepEqual(warning.autoCloseAt, at("19:15"))
  state = markSent(state, "final-warning", at("19:00"))
  state = markSent(state, "break-reminder", at("19:15"))
  assert.deepEqual(decide(at("19:15"), workday, state, eveningConfig).actions, [
    { type: "auto-close", lastActivity: null, inPause: true },
  ])
})

test("in the evening the break reminder goes on beside the final warning", () => {
  const r = decide(at("19:00"), workday, pausedAt("18:30"), eveningConfig)
  assert.deepEqual(types(r).sort(), ["break-reminder", "final-warning"])
})

test("„+1 h“ shifts the final warning and the auto-close in a break too", () => {
  let state = markSent(markSent(pausedAt("18:30"), "final-warning", at("19:00")), "break-reminder", at("19:15"))
  state = postpone(state, eveningConfig, at("19:05"))
  const r = decide(at("19:15"), workday, state, eveningConfig)
  assert.deepEqual(types(r), [])
  assert.equal(r.canExtend, false)
  assert.deepEqual(types(decide(at("20:05"), workday, markSent(state, "break-reminder", at("20:05")), eveningConfig)), [
    "final-warning",
  ])
})

test("in a break there is still no soft hint", () => {
  assert.deepEqual(types(decide(at("17:20"), workday, pausedAt("17:10"), eveningConfig)), [])
})

test("the auto-close from a break clocks out at the start of the break", () => {
  assert.deepEqual(closeFor({ type: "auto-close", lastActivity: null, inPause: true }), {
    stamp: "break-clock-out",
    notice: { type: "auto-closed", lastActivity: null },
  })
})

test("the final warning in a break offers the end of day", () => {
  const state = pausedAt("18:30")
  const warning = decide(at("19:00"), workday, state, eveningConfig).actions.find((a) => a.type === "final-warning")
  assert.deepEqual(notification(warning, workday, state), {
    headline: "Letzte Warnung",
    body: "Auto-Abschluss um 19:15. Im Panel: +1 h weiterarbeiten oder Feierabend.",
    click: "panel",
  })
})
