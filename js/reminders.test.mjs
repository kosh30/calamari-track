import { test } from "node:test"
import assert from "node:assert/strict"
import { decide, markSent, notification } from "./reminders.mjs"
import { applyStamp, applyStatus, emptyState, restoreState } from "./shiftclock.mjs"

const at = (hhmm, date = "2026-09-22") => new Date(`${date}T${hhmm}:00`)
const workday = { date: "2026-09-22", workingDay: true, coreStart: "09:00", coreEnd: "16:45" }
const config = { stampReminderMinutes: 5 }
const noShift = now => applyStatus(emptyState(), false, at(now)).state
const types = r => r.actions.map(a => a.type)

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
  applyStamp(state, action, { ok: true, running: action === "clock-in" }, at(now)).state

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
  assert.deepEqual(r, { barState: null, actions: [], nextCheckAt: null })
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
  assert.deepEqual(decide(at("10:00"), vague, noShift("10:00"), config), { barState: null, actions: [], nextCheckAt: null })
})
