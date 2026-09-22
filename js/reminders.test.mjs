import { test } from "node:test"
import assert from "node:assert/strict"
import { decide, markSent, notification } from "./reminders.mjs"
import { applyStamp, applyStatus, emptyState, restoreState, setDayOff } from "./shiftclock.mjs"

const at = (hhmm, date = "2026-09-22") => new Date(`${date}T${hhmm}:00`)
const workday = { date: "2026-09-22", workingDay: true, coreStart: "09:00", coreEnd: "16:45" }
const config = { stampReminderMinutes: 5 }
const noShift = now => applyStatus(emptyState(), false, at(now)).state
const types = r => r.actions.map(a => a.type)
const quietDay = { barState: null, actions: [], nextCheckAt: null }

test("in der Kernzeit ohne Schicht kommt sofort eine Stempel-Erinnerung", () => {
  const r = decide(at("09:00"), workday, noShift("09:00"), config)
  assert.deepEqual(types(r), ["stamp-reminder"])
  assert.equal(r.barState, "reminder")
})

test("eine verschickte Stempel-Erinnerung kommt nicht doppelt, sondern erst nach 5 Minuten wieder", () => {
  const state = markSent(noShift("09:00"), "stamp-reminder", at("09:00"))
  const again = decide(at("09:00"), workday, state, config)
  assert.deepEqual(types(again), [])
  assert.equal(again.barState, "reminder")
  assert.deepEqual(again.nextCheckAt, at("09:05"))
  assert.deepEqual(types(decide(at("09:04"), workday, state, config)), [])
  assert.deepEqual(types(decide(at("09:05"), workday, state, config)), ["stamp-reminder"])
})

test("die verschickten Erinnerungen überstehen einen Neustart der Shell", () => {
  const state = markSent(noShift("09:00"), "stamp-reminder", at("09:00"))
  assert.deepEqual(types(decide(at("09:02"), workday, restoreState(JSON.stringify(state)), config)), [])
})

test("mit dem Ende der Kernzeit endet die Stempel-Erinnerung", () => {
  const state = markSent(noShift("16:43"), "stamp-reminder", at("16:43"))
  assert.deepEqual(decide(at("16:43"), workday, state, config).nextCheckAt, at("16:45"))
  const r = decide(at("16:45"), workday, state, config)
  assert.deepEqual(types(r), [])
  assert.notEqual(r.barState, "reminder")
})

test("vor der Kernzeit wird zu ihrem Beginn wieder geprüft", () => {
  const r = decide(at("08:30"), workday, noShift("08:30"), config)
  assert.deepEqual(types(r), [])
  assert.deepEqual(r.nextCheckAt, at("09:00"))
})

const stamp = (state, action, now) =>
  applyStamp(state, action, { ok: true, running: action === "clock-in" || action === "break-end" }, at(now)).state

test("nach einem Feierabend vor Ende der Kernzeit kommt keine Stempel-Erinnerung mehr", () => {
  const state = stamp(stamp(noShift("08:55"), "clock-in", "09:00"), "clock-out", "15:30")
  const r = decide(at("15:35"), workday, state, config)
  assert.deepEqual(types(r), [])
  assert.notEqual(r.barState, "reminder")
})

test("wer heute schon eingestempelt war, bekommt keine Stempel-Erinnerung", () => {
  // Stamped in and out in the web: no Feierabend, but not "noch gar nicht eingestempelt".
  let state = applyStatus(noShift("08:55"), true, at("09:10")).state
  state = applyStatus(state, false, at("12:00")).state
  assert.deepEqual(types(decide(at("12:05"), workday, state, config)), [])
})

test("nach dem Wiedereinstempeln nach dem Feierabend läuft die Schicht ohne Erinnerung", () => {
  let state = stamp(stamp(noShift("08:55"), "clock-in", "09:00"), "clock-out", "12:00")
  state = stamp(state, "clock-in", "13:00")
  const r = decide(at("13:05"), workday, state, config)
  assert.deepEqual(types(r), [])
  assert.notEqual(r.barState, "reminder")
})

test("wer mitten in der Kernzeit startet, wird sofort erinnert", () => {
  // Shell start or wake-up at 11:07: nothing sent today yet.
  assert.deepEqual(types(decide(at("11:07"), workday, noShift("11:07"), config)), ["stamp-reminder"])
})

test("am Wochenende gibt es keine Stempel-Erinnerung", () => {
  const saturday = { date: "2026-09-26", workingDay: false, coreStart: null, coreEnd: null }
  const r = decide(at("10:00", "2026-09-26"), saturday, applyStatus(emptyState(), false, at("10:00", "2026-09-26")).state, config)
  assert.deepEqual(r, quietDay)
})

test("ohne bekannten Arbeitsplan oder Status wird nicht erinnert", () => {
  assert.deepEqual(types(decide(at("10:00"), null, noShift("10:00"), config)), [])
  assert.deepEqual(types(decide(at("10:00"), workday, emptyState(), config)), [])
  const failed = Object.assign({ failed: true }, noShift("10:00"))
  assert.deepEqual(types(decide(at("10:00"), workday, failed, config)), [])
})

test("der Arbeitsplan von gestern gilt heute nicht", () => {
  const yesterday = Object.assign({}, workday, { date: "2026-09-21" })
  assert.deepEqual(types(decide(at("10:00"), yesterday, noShift("10:00"), config)), [])
})

test("die Stempel-Erinnerung nennt den Beginn der Kernzeit", () => {
  assert.deepEqual(notification({ type: "stamp-reminder" }, workday),
    { headline: "Noch nicht eingestempelt", body: "Die Kernzeit läuft seit 09:00." })
})

test("ein Zustand von gestern löst heute keine Stempel-Erinnerung aus", () => {
  // e.g. right after midnight, before the first poll of the new day
  const yesterday = Object.assign(noShift("10:00"), { date: "2026-09-21" })
  assert.deepEqual(types(decide(at("10:00"), workday, yesterday, config)), [])
})

test("ein Arbeitstag ohne Kernzeit im Arbeitsplan löst keine Erinnerung aus", () => {
  const vague = Object.assign({}, workday, { coreStart: null, coreEnd: null })
  assert.deepEqual(decide(at("10:00"), vague, noShift("10:00"), config), quietDay)
})

// Freie Tage

const withDay = extra => Object.assign({}, workday, { holiday: null, absence: null }, extra)

test("an einem Feiertag gibt es keine Stempel-Erinnerung", () => {
  const day = withDay({ holiday: { name: "Tag der Deutschen Einheit", halfDay: false, halfdayPeriod: null } })
  assert.deepEqual(decide(at("10:00"), day, noShift("10:00"), config), quietDay)
})

test("ein halber Feiertag am Nachmittag lässt die Kernzeit um 12:00 enden", () => {
  const eve = withDay({ date: "2026-12-24", holiday: { name: "Heiligabend (PM)", halfDay: true, halfdayPeriod: "PM" } })
  const state = applyStatus(emptyState(), false, at("11:50", "2026-12-24")).state
  assert.deepEqual(types(decide(at("11:50", "2026-12-24"), eve, state, config)), ["stamp-reminder"])
  assert.deepEqual(decide(at("12:00", "2026-12-24"), eve, state, config), quietDay)
})

test("ein halber Feiertag am Vormittag lässt die Kernzeit erst um 12:00 beginnen", () => {
  const morningOff = withDay({ holiday: { name: "Halber Tag (AM)", halfDay: true, halfdayPeriod: "AM" } })
  const r = decide(at("10:00"), morningOff, noShift("10:00"), config)
  assert.deepEqual(types(r), [])
  assert.deepEqual(r.nextCheckAt, at("12:00"))
})

test("an einem Urlaubs- oder Krankheitstag gibt es keine Stempel-Erinnerung", () => {
  const day = withDay({ absence: { category: "TIMEOFF", fullDay: true } })
  assert.deepEqual(decide(at("10:00"), day, noShift("10:00"), config), quietDay)
})

test("eine Abwesenheit, bei der gearbeitet wird, ist kein freier Tag", () => {
  // e.g. a business trip: category WORK
  const day = withDay({ absence: { category: "WORK", fullDay: true } })
  assert.deepEqual(types(decide(at("10:00"), day, noShift("10:00"), config)), ["stamp-reminder"])
})

test("eine stundenweise Abwesenheit ist kein freier Tag", () => {
  const day = withDay({ absence: { category: "TIMEOFF", fullDay: false } })
  assert.deepEqual(types(decide(at("10:00"), day, noShift("10:00"), config)), ["stamp-reminder"])
})

test("mit „Heute frei“ gibt es heute keine Stempel-Erinnerung, auch nach einem Neustart", () => {
  const state = restoreState(JSON.stringify(setDayOff(noShift("08:00"), true, at("08:00"))))
  assert.deepEqual(decide(at("10:00"), withDay({}), state, config), quietDay)
})

test("„Heute frei“ lässt sich zurücknehmen", () => {
  const state = setDayOff(setDayOff(noShift("08:00"), true, at("08:00")), false, at("10:00"))
  assert.deepEqual(types(decide(at("10:00"), withDay({}), state, config)), ["stamp-reminder"])
})

test("„Heute frei“ gilt am nächsten Tag nicht mehr", () => {
  const monday = setDayOff(applyStatus(emptyState(), false, at("08:00", "2026-09-21")).state, true, at("08:00", "2026-09-21"))
  const tuesday = applyStatus(monday, false, at("10:00")).state
  assert.deepEqual(types(decide(at("10:00"), withDay({}), tuesday, config)), ["stamp-reminder"])
})

test("eine Arbeitsplan-Überschreibung gilt für ihren Wochentag", () => {
  // 2026-09-22 is a Tuesday
  const own = Object.assign({}, config, { coreTuesday: "08:00-13:00" })
  assert.deepEqual(types(decide(at("08:00"), withDay({}), noShift("08:00"), own)), ["stamp-reminder"])
  assert.deepEqual(decide(at("13:00"), withDay({}), noShift("13:00"), own), quietDay)
  const otherDay = Object.assign({}, config, { coreMonday: "08:00-13:00" })
  assert.deepEqual(types(decide(at("08:00"), withDay({}), noShift("08:00"), otherDay)), [])
})

test("eine Arbeitsplan-Überschreibung macht einen arbeitsfreien Wochentag zum Arbeitstag", () => {
  const saturday = { date: "2026-09-26", workingDay: false, coreStart: null, coreEnd: null, holiday: null, absence: null }
  const state = applyStatus(emptyState(), false, at("10:00", "2026-09-26")).state
  const own = Object.assign({}, config, { coreSaturday: "09:00-12:00" })
  assert.deepEqual(types(decide(at("10:00", "2026-09-26"), saturday, state, own)), ["stamp-reminder"])
})

test("„frei“ als Arbeitsplan-Überschreibung macht den Wochentag arbeitsfrei", () => {
  const own = Object.assign({}, config, { coreTuesday: "frei" })
  assert.deepEqual(decide(at("10:00"), withDay({}), noShift("10:00"), own), quietDay)
})

test("eine unlesbare Arbeitsplan-Überschreibung lässt den Arbeitsplan gelten", () => {
  for (const text of ["", "8-13 Uhr", "13:00-08:00", "09:00-99:99", "25:00-26:00"]) {
    const own = Object.assign({}, config, { coreTuesday: text })
    assert.deepEqual(types(decide(at("10:00"), withDay({}), noShift("10:00"), own)), ["stamp-reminder"], text)
  }
})

test("ein Feiertag gilt auch an einem überschriebenen Wochentag", () => {
  const day = withDay({ holiday: { name: "Tag der Deutschen Einheit", halfDay: false, halfdayPeriod: null } })
  const own = Object.assign({}, config, { coreTuesday: "08:00-13:00" })
  assert.deepEqual(decide(at("10:00"), day, noShift("10:00"), own), quietDay)
})

test("eine Arbeitsplan-Überschreibung darf die Stunde einstellig schreiben", () => {
  const own = Object.assign({}, config, { coreTuesday: "8:00-13:00" })
  assert.deepEqual(types(decide(at("08:00"), withDay({}), noShift("08:00"), own)), ["stamp-reminder"])
})

// Pause

const breakConfig = Object.assign({}, config, { breakLimitMinutes: 30, breakReminderMinutes: 5 })
const onBreak = (since, begun = "09:00") => stamp(stamp(noShift("08:55"), "clock-in", begun), "break-start", since)

test("während einer Pause kommt keine Stempel-Erinnerung", () => {
  const r = decide(at("12:10"), workday, onBreak("12:00"), breakConfig)
  assert.deepEqual(types(r), [])
  assert.notEqual(r.barState, "reminder")
  assert.deepEqual(r.nextCheckAt, at("12:30"))
})

test("nach 30 Minuten Pause kommt eine Pausen-Erinnerung, danach alle 5 Minuten", () => {
  let state = onBreak("12:00")
  assert.deepEqual(types(decide(at("12:29"), workday, state, breakConfig)), [])
  assert.deepEqual(types(decide(at("12:30"), workday, state, breakConfig)), ["break-reminder"])
  state = markSent(state, "break-reminder", at("12:30"))
  const again = decide(at("12:30"), workday, state, breakConfig)
  assert.deepEqual(types(again), [])
  assert.deepEqual(again.nextCheckAt, at("12:35"))
  assert.deepEqual(types(decide(at("12:35"), workday, state, breakConfig)), ["break-reminder"])
})

test("die Pausen-Erinnerung einer früheren Pause zählt bei der nächsten nicht", () => {
  let state = markSent(onBreak("10:00"), "break-reminder", at("10:30"))
  state = stamp(state, "break-end", "10:40")
  state = stamp(state, "break-start", "15:00")
  assert.deepEqual(types(decide(at("15:30"), workday, state, breakConfig)), ["break-reminder"])
})

test("auch am Wochenende erinnert eine lange Pause", () => {
  const saturday = { date: "2026-09-26", workingDay: false, coreStart: null, coreEnd: null, holiday: null, absence: null }
  let state = applyStatus(emptyState(), false, at("09:55", "2026-09-26")).state
  state = applyStamp(state, "clock-in", { ok: true, running: true }, at("10:00", "2026-09-26")).state
  state = applyStamp(state, "break-start", { ok: true, running: false }, at("11:00", "2026-09-26")).state
  assert.deepEqual(types(decide(at("11:30", "2026-09-26"), saturday, state, breakConfig)), ["break-reminder"])
})

test("nach dem Pausenende kommt keine Pausen-Erinnerung mehr", () => {
  const state = stamp(onBreak("12:00"), "break-end", "12:45")
  assert.deepEqual(types(decide(at("12:50"), workday, state, breakConfig)), [])
})

test("die Pausen-Erinnerung nennt den Beginn der Pause", () => {
  assert.deepEqual(notification({ type: "break-reminder" }, workday, onBreak("12:00")),
    { headline: "Pause läuft noch", body: "Die Pause läuft seit 12:00." })
})
