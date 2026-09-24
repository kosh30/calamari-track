import { test } from "node:test"
import { readFileSync } from "node:fs"
import assert from "node:assert/strict"
import { DEFAULTS, closeFor, countdownText, decide, extendLabel, markSent, notification, postpone } from "./reminders.mjs"
import { applyDayEnd, applyStamp, applyStatus, emptyState, restoreState, setDayOff } from "./shiftclock.mjs"
import { heartbeat, setIdle } from "./activity.mjs"

const at = (hhmm, date = "2026-09-22") => new Date(`${date}T${hhmm}:00`)
const workday = { date: "2026-09-22", workingDay: true, coreStart: "09:00", coreEnd: "16:45" }
const config = { stampReminderMinutes: 5 }
const noShift = now => applyStatus(emptyState(), "stopped", at(now)).state
const types = r => r.actions.map(a => a.type)
const quietDay = { barState: null, actions: [], nextCheckAt: null, autoCloseAt: null, canExtend: false }

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
  applyStamp(state, action, { ok: true, running: action === "clock-in", onBreak: action === "break-start" }, at(now)).state

test("nach einem Feierabend vor Ende der Kernzeit kommt keine Stempel-Erinnerung mehr", () => {
  const state = stamp(stamp(noShift("08:55"), "clock-in", "09:00"), "clock-out", "15:30")
  const r = decide(at("15:35"), workday, state, config)
  assert.deepEqual(types(r), [])
  assert.notEqual(r.barState, "reminder")
})

test("wer heute schon eingestempelt war, bekommt keine Stempel-Erinnerung", () => {
  // Stamped in and out in the web: no Feierabend, but not "noch gar nicht eingestempelt".
  let state = applyStatus(noShift("08:55"), "running", at("09:10")).state
  state = applyStatus(state, "stopped", at("12:00")).state
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
  const r = decide(at("10:00", "2026-09-26"), saturday, applyStatus(emptyState(), "stopped", at("10:00", "2026-09-26")).state, config)
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
    { headline: "Noch nicht eingestempelt", body: "Die Kernzeit läuft seit 09:00.", click: "panel" })
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
  const state = applyStatus(emptyState(), "stopped", at("11:50", "2026-12-24")).state
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
  const monday = setDayOff(applyStatus(emptyState(), "stopped", at("08:00", "2026-09-21")).state, true, at("08:00", "2026-09-21"))
  const tuesday = applyStatus(monday, "stopped", at("10:00")).state
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
  const state = applyStatus(emptyState(), "stopped", at("10:00", "2026-09-26")).state
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
  let state = applyStatus(emptyState(), "stopped", at("09:55", "2026-09-26")).state
  state = applyStamp(state, "clock-in", { ok: true, running: true }, at("10:00", "2026-09-26")).state
  state = applyStamp(state, "break-start", { ok: true, onBreak: true }, at("11:00", "2026-09-26")).state
  assert.deepEqual(types(decide(at("11:30", "2026-09-26"), saturday, state, breakConfig)), ["break-reminder"])
})

test("nach dem Pausenende kommt keine Pausen-Erinnerung mehr", () => {
  const state = stamp(onBreak("12:00"), "break-end", "12:45")
  assert.deepEqual(types(decide(at("12:50"), workday, state, breakConfig)), [])
})

test("die Pausen-Erinnerung nennt den Beginn der Pause", () => {
  assert.deepEqual(notification({ type: "break-reminder" }, workday, onBreak("12:00")),
    { headline: "Pause läuft noch", body: "Die Pause läuft seit 12:00.", click: "panel" })
})

// Sanfter Hinweis, letzte Warnung, Auto-Abschluss

const eveningConfig = Object.assign({}, breakConfig, {
  softHintMinutes: 30, finalWarningTime: "19:00", autoCloseMinutes: 15, extendMinutes: 60, hardLimitTime: "23:00",
})
const working = (begun = "09:00") => stamp(noShift("08:55"), "clock-in", begun)

test("30 Minuten nach Ende der Kernzeit kommt genau einmal der sanfte Hinweis", () => {
  let state = working()
  assert.deepEqual(types(decide(at("17:14"), workday, state, eveningConfig)), [])
  assert.deepEqual(decide(at("17:14"), workday, state, eveningConfig).nextCheckAt, at("17:15"))
  assert.deepEqual(types(decide(at("17:15"), workday, state, eveningConfig)), ["soft-hint"])
  state = markSent(state, "soft-hint", at("17:15"))
  assert.deepEqual(types(decide(at("17:15"), workday, state, eveningConfig)), [])
  assert.deepEqual(types(decide(at("18:30"), workday, state, eveningConfig)), [])
})

const hinted = (begun = "09:00") => markSent(working(begun), "soft-hint", at("17:15"))

test("zur Uhrzeit der letzten Warnung kommt sie, 15 Minuten später der Auto-Abschluss", () => {
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

test("„+1 h“ verschiebt letzte Warnung und Auto-Abschluss, auch nach einem Neustart", () => {
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

test("„+1 h“ wirkt auch nach einer späten letzten Warnung", () => {
  // Machine opened at 21:00: warned then, "+1 h" at 21:05.
  const state = postpone(markSent(hinted(), "final-warning", at("21:00")), eveningConfig, at("21:05"))
  const r = decide(at("21:15"), workday, state, eveningConfig)
  assert.deepEqual(types(r), [])
  assert.deepEqual(r.nextCheckAt, at("22:05"))
})

test("die Obergrenze gewinnt gegen jedes „+1 h“", () => {
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

test("„+1 h“ wird nur angeboten, solange es etwas verschiebt", () => {
  const early = markSent(hinted(), "final-warning", at("19:00"))
  assert.equal(decide(at("19:05"), workday, early, eveningConfig).canExtend, true)
  const late = markSent(hinted(), "final-warning", at("22:45"))
  assert.equal(decide(at("22:50"), workday, late, eveningConfig).canExtend, false)
})

test("wer erst nach der Obergrenze einstempelt, wird gewarnt und nach der Wartezeit ausgestempelt", () => {
  let state = stamp(stamp(hinted(), "clock-out", "17:30"), "clock-in", "23:10")
  const r = decide(at("23:10"), workday, state, eveningConfig)
  assert.deepEqual(types(r), ["final-warning"])
  assert.deepEqual(r.autoCloseAt, at("23:25"))
  state = markSent(state, "final-warning", at("23:10"))
  assert.deepEqual(types(decide(at("23:11"), workday, state, eveningConfig)), [])
  assert.deepEqual(types(decide(at("23:25"), workday, state, eveningConfig)), ["auto-close"])
})

test("eine erst abends begonnene Schicht bekommt keinen sanften Hinweis", () => {
  const state = stamp(stamp(working(), "clock-out", "16:00"), "clock-in", "18:00")
  assert.deepEqual(types(decide(at("18:00"), workday, state, eveningConfig)), [])
})

test("am Wochenende mit laufender Schicht kommen letzte Warnung und Auto-Abschluss, aber kein sanfter Hinweis", () => {
  const saturday = { date: "2026-09-26", workingDay: false, coreStart: null, coreEnd: null, holiday: null, absence: null }
  let state = applyStatus(emptyState(), "stopped", at("09:55", "2026-09-26")).state
  state = applyStamp(state, "clock-in", { ok: true, running: true }, at("10:00", "2026-09-26")).state
  assert.deepEqual(types(decide(at("18:00", "2026-09-26"), saturday, state, eveningConfig)), [])
  assert.deepEqual(types(decide(at("19:00", "2026-09-26"), saturday, state, eveningConfig)), ["final-warning"])
  state = markSent(state, "final-warning", at("19:00", "2026-09-26"))
  assert.deepEqual(types(decide(at("19:15", "2026-09-26"), saturday, state, eveningConfig)), ["auto-close"])
})

test("wer erst nach der Uhrzeit der letzten Warnung einstempelt, wird erst vor der Obergrenze gewarnt", () => {
  const state = stamp(stamp(hinted(), "clock-out", "17:30"), "clock-in", "20:00")
  const r = decide(at("20:00"), workday, state, eveningConfig)
  assert.deepEqual(types(r), [])
  assert.deepEqual(r.nextCheckAt, at("22:45"))
})

test("wer den Rechner erst nach der letzten Warnung aufklappt, wird gewarnt und nicht sofort ausgestempelt", () => {
  let state = hinted()
  const r = decide(at("21:00"), workday, state, eveningConfig)
  assert.deepEqual(types(r), ["final-warning"])
  assert.deepEqual(r.autoCloseAt, at("21:15"))
  state = markSent(state, "final-warning", at("21:00"))
  assert.deepEqual(types(decide(at("21:10"), workday, state, eveningConfig)), [])
})

test("nach dem Feierabend kommen weder sanfter Hinweis noch letzte Warnung", () => {
  const state = stamp(working(), "clock-out", "16:00")
  for (const time of ["17:15", "19:00", "23:00"])
    assert.deepEqual(decide(at(time), workday, state, eveningConfig), quietDay, time)
})

test("ein fehlgeschlagener Auto-Abschluss wird nach 5 Minuten wiederholt, nicht bei jeder Prüfung", () => {
  let state = markSent(hinted(), "final-warning", at("19:00"))
  state = markSent(state, "auto-close", at("19:15"))
  assert.deepEqual(types(decide(at("19:16"), workday, state, eveningConfig)), [])
  assert.deepEqual(types(decide(at("19:20"), workday, state, eveningConfig)), ["auto-close"])
})

test("die Standardwerte der Logik sind die des Manifests", () => {
  const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url)))
  for (const [key, value] of Object.entries(DEFAULTS))
    assert.equal(manifest.barWidget.defaults[key], value, key)
})

test("sanfter Hinweis, letzte Warnung und Korrektur-Hinweis nennen ihre Uhrzeiten", () => {
  const hint = decide(at("17:15"), workday, working(), eveningConfig).actions[0]
  assert.deepEqual(notification(hint, workday, working()),
    { headline: "Schicht läuft noch", body: "Die Kernzeit endete um 16:45.", click: "panel" })
  const warning = decide(at("19:00"), workday, hinted(), eveningConfig).actions[0]
  assert.deepEqual(notification(warning, workday, hinted()),
    { headline: "Letzte Warnung", body: "Auto-Abschluss um 19:15. Im Panel: +1 h weiterarbeiten oder jetzt ausstempeln.", click: "panel" })
  assert.deepEqual(notification({ type: "auto-closed", at: "19:15", lastActivity: null }, workday, hinted()),
    { headline: "Schicht automatisch beendet", body: "Um 19:15 ausgestempelt. Bitte die Endzeit in Calamari korrigieren.", click: "calamari" })
})

test("nach der letzten Warnung zeigt das Panel einen Countdown bis zum Auto-Abschluss", () => {
  const state = markSent(hinted(), "final-warning", at("19:00"))
  const r = decide(at("19:03"), workday, state, eveningConfig)
  assert.equal(countdownText(r, new Date("2026-09-22T19:03:30")), "Auto-Abschluss um 19:15, noch 12 Min")
  assert.equal(countdownText(decide(at("18:00"), workday, hinted(), eveningConfig), at("18:00")), "")
})

test("der Button zum Verschieben nennt die eingestellte Dauer", () => {
  assert.equal(extendLabel({}), "+1 h weiterarbeiten")
  assert.equal(extendLabel({ extendMinutes: 90 }), "+90 Min weiterarbeiten")
})

test("die letzte Warnung nennt die eingestellte Verschiebung", () => {
  const own = Object.assign({}, eveningConfig, { extendMinutes: 90 })
  const warning = decide(at("19:00"), workday, hinted(), own).actions[0]
  assert.match(notification(warning, workday, hinted(), own).body, /Im Panel: \+90 Min weiterarbeiten oder jetzt ausstempeln\.$/)
})

// Letzte Aktivität und Tagesende-Abschluss

const wednesday = { date: "2026-09-23", workingDay: true, coreStart: "09:00", coreEnd: "16:45", holiday: null, absence: null }
// Shift since 09:00 on Tuesday, lid closed at 17:59, opened Wednesday 07:30.
// Calamari ended the shift at 23:59 itself, so nothing runs this morning.
const morningAfter = () => {
  const state = heartbeat(heartbeat(working(), at("17:58")), at("17:59"))
  return heartbeat(state, at("07:30", "2026-09-23"))
}

test("nach dem Korrektur-Hinweis für den Vortag beginnt der neue Tag normal", () => {
  const state = applyDayEnd(morningAfter(), "2026-09-22", true, at("07:30", "2026-09-23")).state
  assert.equal(state.clockedOutAt, null)
  assert.deepEqual(types(decide(at("07:30", "2026-09-23"), wednesday, state, eveningConfig)), [])
  const later = applyStatus(state, "stopped", at("09:00", "2026-09-23")).state
  assert.deepEqual(types(decide(at("09:00", "2026-09-23"), wednesday, later, eveningConfig)), ["stamp-reminder"])
  assert.equal(later.stampedToday, false)
})

test("der Hinweis zum Tagesende-Abschluss nennt die letzte Aktivität von jenem Tag", () => {
  assert.deepEqual(notification({ type: "day-end-closed", date: "2026-09-22", lastActivity: "2026-09-22T17:59" }, wednesday, morningAfter()),
    { headline: "Schicht vom Vortag beendet",
      body: "Die Schicht vom 22.09. lief bis zum Tagesende, Calamari hat sie um 23:59 beendet. Bitte die Endzeit dort auf 17:59 korrigieren (letzte Aktivität).",
      click: "calamari" })
})

test("ohne bekannte letzte Aktivität bittet der Hinweis nur um die Korrektur", () => {
  assert.deepEqual(notification({ type: "day-end-closed", date: "2026-09-22", lastActivity: null }, wednesday, morningAfter()),
    { headline: "Schicht vom Vortag beendet",
      body: "Die Schicht vom 22.09. lief bis zum Tagesende, Calamari hat sie um 23:59 beendet. Bitte die Endzeit dort korrigieren.",
      click: "calamari" })
})

test("der Korrektur-Hinweis nach dem Auto-Abschluss nennt die letzte Aktivität", () => {
  let state = markSent(hinted(), "final-warning", at("19:00"))
  state = setIdle(state, true, at("18:45"), 300)
  const close = decide(at("19:15"), workday, state, eveningConfig).actions[0]
  assert.deepEqual(close, { type: "auto-close", lastActivity: "2026-09-22T18:40" })
  assert.deepEqual(notification({ type: "auto-closed", at: "19:15", lastActivity: close.lastActivity }, workday, state).body,
    "Um 19:15 ausgestempelt, letzte Aktivität 18:40. Bitte die Endzeit in Calamari darauf korrigieren.")
})

test("wer beim Auto-Abschluss aktiv ist, bekommt keine letzte Aktivität genannt", () => {
  const state = markSent(hinted(), "final-warning", at("19:00"))
  assert.deepEqual(decide(at("19:15"), workday, state, eveningConfig).actions, [{ type: "auto-close", lastActivity: null }])
})

test("der Auto-Abschluss stempelt aus und kündigt seinen Korrektur-Hinweis an", () => {
  assert.deepEqual(closeFor({ type: "auto-close", lastActivity: "2026-09-22T18:40" }),
    { stamp: "clock-out", notice: { type: "auto-closed", lastActivity: "2026-09-22T18:40" } })
  assert.equal(closeFor({ type: "stamp-reminder" }), null)
})

test("nach einem Auto-Abschluss bekommt eine neue Schicht ihre eigene letzte Warnung, auch nach „+1 h“", () => {
  // Warned 19:00, "+1 h" to 20:00, warned again, auto-closed 20:15; back at work 20:30.
  let state = markSent(hinted(), "final-warning", at("19:00"))
  state = markSent(postpone(state, eveningConfig, at("19:00")), "final-warning", at("20:00"))
  state = markSent(state, "auto-close", at("20:15"))
  state = stamp(stamp(state, "clock-out", "20:15"), "clock-in", "20:30")
  const r = decide(at("20:35"), workday, state, eveningConfig)
  assert.deepEqual(types(r), [])
  assert.deepEqual(r.nextCheckAt, at("22:45"))
})

test("solange der Beginn einer im Web begonnenen Schicht unbekannt ist, wird nicht ausgestempelt", () => {
  let state = markSent(postpone(markSent(hinted(), "final-warning", at("19:00")), eveningConfig, at("19:00")), "final-warning", at("20:00"))
  state = stamp(markSent(state, "auto-close", at("20:15")), "clock-out", "20:15")
  // Clocked in on the phone; the poll sees it, start-time has not answered yet.
  state = applyStatus(state, "running", at("20:40")).state
  assert.deepEqual(types(decide(at("20:40"), workday, state, eveningConfig)), [])
})

// Pause, die Calamari meldet (im Web, auf dem Handy)

const seenBreak = (seen, begun = "09:00") => applyStatus(working(begun), "break", at(seen)).state

test("in einer fremden Pause kommt keine Stempel-Erinnerung und kein sanfter Hinweis", () => {
  assert.deepEqual(types(decide(at("12:10"), workday, seenBreak("12:00"), breakConfig)), [])
  assert.deepEqual(types(decide(at("17:20"), workday, seenBreak("17:10"), eveningConfig)), [])
})

test("die Pausen-Erinnerung einer fremden Pause zählt ab dem ersten Sehen", () => {
  let state = seenBreak("12:10")
  state = applyStatus(state, "break", at("12:30")).state
  assert.deepEqual(types(decide(at("12:39"), workday, state, breakConfig)), [])
  assert.deepEqual(types(decide(at("12:40"), workday, state, breakConfig)), ["break-reminder"])
})

test("die Pausen-Erinnerung einer fremden Pause sagt, dass ihr Beginn nicht bekannt ist", () => {
  assert.deepEqual(notification({ type: "break-reminder" }, workday, seenBreak("12:10")),
    { headline: "Pause läuft noch", body: "Die Pause läuft seit spätestens 12:10.", click: "panel" })
})

test("nach einer fremden Pause läuft die Schicht mit ihren Erinnerungen weiter", () => {
  const state = applyStatus(seenBreak("12:10"), "running", at("12:40")).state
  assert.deepEqual(types(decide(at("17:15"), workday, state, eveningConfig)), ["soft-hint"])
})

// Pause am Abend (Ticket 05)

const pausedAt = (since, begun = "09:00") => stamp(working(begun), "break-start", since)

test("in einer Pause am Abend kommen letzte Warnung und Auto-Abschluss wie in der Schicht", () => {
  let state = markSent(pausedAt("18:30"), "break-reminder", at("19:00"))
  const warning = decide(at("19:00"), workday, state, eveningConfig)
  assert.deepEqual(types(warning), ["final-warning"])
  assert.deepEqual(warning.autoCloseAt, at("19:15"))
  state = markSent(state, "final-warning", at("19:00"))
  state = markSent(state, "break-reminder", at("19:15"))
  assert.deepEqual(decide(at("19:15"), workday, state, eveningConfig).actions,
    [{ type: "auto-close", lastActivity: null, inPause: true }])
})

test("die Pausen-Erinnerung läuft am Abend neben der letzten Warnung weiter", () => {
  const r = decide(at("19:00"), workday, pausedAt("18:30"), eveningConfig)
  assert.deepEqual(types(r).sort(), ["break-reminder", "final-warning"])
})

test("„+1 h“ verschiebt auch in einer Pause letzte Warnung und Auto-Abschluss", () => {
  let state = markSent(markSent(pausedAt("18:30"), "final-warning", at("19:00")), "break-reminder", at("19:15"))
  state = postpone(state, eveningConfig, at("19:05"))
  const r = decide(at("19:15"), workday, state, eveningConfig)
  assert.deepEqual(types(r), [])
  assert.equal(r.canExtend, false)
  assert.deepEqual(types(decide(at("20:05"), workday, markSent(state, "break-reminder", at("20:05")), eveningConfig)),
    ["final-warning"])
})

test("in einer Pause kommt weiterhin kein sanfter Hinweis", () => {
  assert.deepEqual(types(decide(at("17:20"), workday, pausedAt("17:10"), eveningConfig)), [])
})

test("der Auto-Abschluss aus einer Pause stempelt auf den Pausenbeginn aus", () => {
  assert.deepEqual(closeFor({ type: "auto-close", lastActivity: null, inPause: true }),
    { stamp: "break-clock-out", notice: { type: "auto-closed", lastActivity: null } })
})

test("die letzte Warnung in einer Pause bietet den Feierabend an", () => {
  const state = pausedAt("18:30")
  const warning = decide(at("19:00"), workday, state, eveningConfig).actions.find(a => a.type === "final-warning")
  assert.deepEqual(notification(warning, workday, state),
    { headline: "Letzte Warnung", body: "Auto-Abschluss um 19:15. Im Panel: +1 h weiterarbeiten oder Feierabend.", click: "panel" })
})
