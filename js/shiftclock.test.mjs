import { test } from "node:test"
import assert from "node:assert/strict"
import {
  applyDayEnd,
  applyStamp,
  breakSinceText,
  applyStatus,
  applyStartTime,
  barView,
  breakAction,
  dayOffToday,
  emptyState,
  feierabendAction,
  helperCommand,
  pendingDayEnd,
  applyEndTime,
  restoreState,
  setDayOff,
  stampAction,
  stampLabel,
  workedMinutes,
  workedText,
} from "./shiftclock.mjs"
import { setIdle } from "./activity.mjs"

const at = (hhmm, date = "2026-09-22") => new Date(`${date}T${hhmm}:00`)

test("a newly recognised running shift needs its start time", () => {
  const r = applyStatus(emptyState(), "running", at("10:00"))
  assert.deepEqual(r.startTimeQuery, { after: null })
  assert.equal(r.state.running, true)
})

test("the cached start time is not determined again", () => {
  let state = applyStatus(emptyState(), "running", at("10:00")).state
  state = applyStartTime(state, "09:40")
  const r = applyStatus(state, "running", at("10:03"))
  assert.equal(r.startTimeQuery, null)
  assert.equal(r.state.startedAt, "09:40")
})

test("after clocking out the following shift is searched for only from the last query without a running shift", () => {
  let state = applyStatus(emptyState(), "running", at("08:00")).state
  state = applyStartTime(state, "08:00")
  state = applyStatus(state, "stopped", at("12:03")).state
  assert.equal(state.startedAt, null)
  const r = applyStatus(state, "running", at("12:48"))
  // No shift ran at 12:03; one ended earlier in that minute still reaches into it.
  assert.deepEqual(r.startTimeQuery, { after: "12:04" })
})

test("on a new day the previous day's query without a shift does not count", () => {
  let state = applyStatus(emptyState(), "stopped", at("18:00", "2026-09-21")).state
  const r = applyStatus(state, "running", at("08:30"))
  assert.deepEqual(r.startTimeQuery, { after: null })
  assert.equal(r.state.date, "2026-09-22")
})

test("with no running shift the bar shows idle", () => {
  const state = applyStatus(emptyState(), "stopped", at("10:00")).state
  assert.deepEqual(barView({ state, now: at("10:00"), authState: "ok", failed: false }), { kind: "idle", text: "" })
})

test("with a running shift the bar shows the duration since clocking in", () => {
  let state = applyStatus(emptyState(), "running", at("13:00")).state
  state = applyStartTime(state, "09:40")
  assert.deepEqual(barView({ state, now: at("13:22"), authState: "ok", failed: false }), {
    kind: "running",
    text: "3:42",
  })
})

test("while the start time is missing the shift runs with no duration", () => {
  const state = applyStatus(emptyState(), "running", at("13:00")).state
  assert.deepEqual(barView({ state, now: at("13:00"), authState: "ok", failed: false }), { kind: "running", text: "" })
})

test("an error displaces the stale status", () => {
  let state = applyStatus(emptyState(), "running", at("13:00")).state
  state = applyStartTime(state, "09:40")
  assert.equal(barView({ state, now: at("13:22"), authState: "ok", failed: true }).kind, "error")
})

test("a login needed takes precedence over everything else", () => {
  const state = applyStatus(emptyState(), "running", at("13:00")).state
  assert.equal(barView({ state, now: at("13:22"), authState: "required", failed: true }).kind, "auth")
})

test("before the first query the status is unknown", () => {
  assert.equal(barView({ state: emptyState(), now: at("13:00"), authState: "unknown", failed: false }).kind, "unknown")
})

test("the stored state survives a restart of the shell", () => {
  let state = applyStatus(emptyState(), "running", at("13:00")).state
  state = applyStartTime(state, "09:40")
  assert.deepEqual(restoreState(JSON.stringify(state)), state)
})

test("a missing or broken state begins empty", () => {
  assert.deepEqual(restoreState(""), emptyState())
  assert.deepEqual(restoreState("{kaputt"), emptyState())
  assert.deepEqual(restoreState("[]"), emptyState())
})

test("unknown fields from older versions are dropped on load", () => {
  const restored = restoreState(
    JSON.stringify({ date: "2026-09-22", running: true, startedAt: "09:40", idleSince: null }),
  )
  assert.deepEqual(Object.keys(restored).sort(), Object.keys(emptyState()).sort())
  assert.equal(restored.startedAt, "09:40")
})

const running = (startedAt, now) => applyStartTime(applyStatus(emptyState(), "running", at(now)).state, startedAt)
const clockOut = (state, now) => applyStamp(state, "clock-out", { ok: true, running: false }, at(now)).state
const clockIn = (state, now) => applyStamp(state, "clock-in", { ok: true, running: true }, at(now)).state
const view = (state, now) => barView({ state, now: at(now), authState: "ok", failed: false })

test("after clocking out it is the end of day and no shift runs", () => {
  const state = clockOut(running("09:40", "17:00"), "17:30")
  assert.equal(state.clockedOutAt, "17:30")
  assert.deepEqual(view(state, "17:30"), { kind: "idle", text: "" })
})

test("the end of day survives a restart of the shell", () => {
  const state = clockOut(running("09:40", "17:00"), "17:30")
  assert.equal(restoreState(JSON.stringify(state)).clockedOutAt, "17:30")
})

test("shortly after clocking out what Calamari reports applies: the status no longer runs on", () => {
  const state = clockOut(running("09:40", "17:00"), "17:30")
  const r = applyStatus(state, "running", at("17:31"))
  assert.equal(r.state.running, true)
  assert.equal(r.state.clockedOutAt, null)
  assert.deepEqual(r.startTimeQuery, { after: "17:31" })
})

test("clocking in after the end of day lifts it and the duration counts from now", () => {
  const state = clockIn(clockOut(running("09:40", "17:00"), "17:30"), "20:15")
  assert.equal(state.clockedOutAt, null)
  assert.deepEqual(view(state, "20:17"), { kind: "running", text: "0:02" })
  assert.equal(applyStatus(state, "running", at("20:18")).startTimeQuery, null)
})

test("if Calamari reports no running shift after clocking in, Calamari counts and the panel says so", () => {
  const r = applyStamp(emptyState(), "clock-in", { ok: true, running: false }, at("08:00"))
  assert.deepEqual(view(r.state, "08:00"), { kind: "idle", text: "" })
  assert.equal(r.error, "Einstempeln: Calamari meldet keine laufende Schicht. Bitte im Web prüfen.")
  assert.equal(r.pollNow, true)
})

test("a shift begun in the web after the end of day lifts it and is searched for only after the clock-out", () => {
  const state = clockOut(running("09:40", "17:00"), "17:30")
  const r = applyStatus(state, "running", at("17:40"))
  assert.equal(r.state.running, true)
  assert.equal(r.state.clockedOutAt, null)
  // The ended shift reaches into minute 17:30.
  assert.deepEqual(r.startTimeQuery, { after: "17:31" })
})

test("a query shortly after clocking out still lets the start-time search begin only after it", () => {
  let state = clockOut(running("09:40", "17:00"), "17:30")
  state = applyStatus(state, "running", at("17:31")).state
  const r = applyStatus(state, "running", at("17:50"))
  assert.deepEqual(r.startTimeQuery, { after: "17:31" })
})

test("yesterday's end of day no longer applies today", () => {
  const state = clockOut(running("09:40", "17:00"), "17:30")
  const yesterday = Object.assign({}, state, { date: "2026-09-21" })
  assert.equal(applyStatus(yesterday, "stopped", at("08:00")).state.clockedOutAt, null)
})

test("a failed stamping leaves the status standing, so that it can be tried again", () => {
  const state = running("09:40", "17:00")
  const r = applyStamp(
    state,
    "clock-out",
    { ok: false, error: { code: "NETWORK", message: "cannot reach" } },
    at("17:30"),
  )
  assert.deepEqual(r.state, state)
  assert.equal(stampAction(view(r.state, "17:30")), "clock-out")
})

test("a failed stamping names the action and the cause, and that nothing is filed later", () => {
  const fail = (action, code, message) =>
    applyStamp(running("09:40", "17:00"), action, { ok: false, error: { code, message } }, at("17:30")).error
  assert.equal(
    fail("clock-out", "NETWORK"),
    "Ausstempeln fehlgeschlagen: Calamari nicht erreichbar. Es wird nichts nachgereicht.",
  )
  assert.equal(
    fail("clock-in", "RATE_LIMITED"),
    "Einstempeln fehlgeschlagen: zu viele Anfragen, bitte gleich erneut versuchen. Es wird nichts nachgereicht.",
  )
  assert.equal(
    fail("clock-in", "AUTH_REQUIRED"),
    "Einstempeln fehlgeschlagen: Anmeldung nötig. Es wird nichts nachgereicht.",
  )
  assert.equal(
    fail("clock-out", "MCP_ERROR", "clockOut: no started shift"),
    "Ausstempeln fehlgeschlagen: clockOut: no started shift. Es wird nichts nachgereicht.",
  )
})

test("if clocking in over REST fails the panel names the cause in plain words", () => {
  const fail = (code, extra) =>
    applyStamp(
      emptyState(),
      "clock-in",
      { ok: false, error: Object.assign({ code, message: "raw" }, extra) },
      at("08:00"),
    ).error
  assert.equal(
    fail("API_TERMINAL_MISSING"),
    "Einstempeln fehlgeschlagen: API Terminal fehlt in Calamari Clockin. Es wird nichts nachgereicht.",
  )
  assert.equal(
    fail("API_SCOPE_MISSING"),
    "Einstempeln fehlgeschlagen: keine Berechtigung für den API-Key. Es wird nichts nachgereicht.",
  )
  assert.equal(
    fail("API_KEY_REQUIRED"),
    "Einstempeln fehlgeschlagen: kein API-Key, bitte bin/calamari api-key ausführen. Es wird nichts nachgereicht.",
  )
  assert.equal(
    fail("API_KEY_REJECTED"),
    "Einstempeln fehlgeschlagen: Calamari lehnt den API-Key ab. Es wird nichts nachgereicht.",
  )
  assert.equal(
    fail("API_URL_REQUIRED"),
    "Einstempeln fehlgeschlagen: keine REST-API-URL, bitte in den Einstellungen setzen. Es wird nichts nachgereicht.",
  )
  assert.equal(
    fail("PROJECT_UNKNOWN", { project: "Kunde B" }),
    "Einstempeln fehlgeschlagen: Projekt „Kunde B“ gibt es in Calamari nicht. Es wird nichts nachgereicht.",
  )
})

test("after a failure the real status is queried, unless Calamari is throttling", () => {
  const fail = (code) =>
    applyStamp(emptyState(), "clock-in", { ok: false, error: { code, message: "" } }, at("08:00")).pollNow
  assert.equal(fail("NETWORK"), true)
  assert.equal(fail("MCP_ERROR"), true)
  assert.equal(fail("RATE_LIMITED"), false)
  assert.equal(applyStamp(emptyState(), "clock-in", { ok: true, running: true }, at("08:00")).pollNow, false)
})

test("the panel offers clocking out during a running shift and clocking in otherwise", () => {
  assert.equal(stampAction({ kind: "running", text: "1:00" }), "clock-out")
  assert.equal(stampAction({ kind: "idle", text: "" }), "clock-in")
  assert.equal(stampAction({ kind: "reminder", text: "" }), "clock-in")
})

test("with no known status the panel offers no stamping", () => {
  for (const kind of ["unknown", "error", "auth"]) assert.equal(stampAction({ kind, text: "" }), null)
})

test("in the minute of clocking in, too, what Calamari reports applies", () => {
  const state = clockIn(emptyState(), "11:21")
  const r = applyStatus(state, "stopped", at("11:21"))
  assert.equal(view(r.state, "11:21").kind, "idle")
})

test("while a stamp reminder is due the bar shows it", () => {
  const state = applyStatus(emptyState(), "stopped", at("09:10")).state
  assert.equal(barView({ state, now: at("09:10"), authState: "ok", failed: false, reminding: true }).kind, "reminder")
  assert.equal(barView({ state, now: at("09:10"), authState: "ok", failed: true, reminding: true }).kind, "error")
})

test("„Heute frei“ applies only to the day it was set on", () => {
  const state = setDayOff(applyStatus(emptyState(), "stopped", at("08:00")).state, true, at("08:00"))
  assert.equal(dayOffToday(state, at("23:59")), true)
  // after midnight, even before the first poll of the new day
  assert.equal(dayOffToday(state, at("00:01", "2026-09-23")), false)
})

// Break (real, inside the running shift: break-start / break-stop)

const breakStart = (state, now) => applyStamp(state, "break-start", { ok: true, onBreak: true }, at(now)).state
const breakEnd = (state, now) => applyStamp(state, "break-end", { ok: true, onBreak: false }, at(now)).state

test("a break interrupts the shift, does not end it, and the bar shows its duration", () => {
  const state = breakStart(clockIn(emptyState(), "09:00"), "12:00")
  assert.equal(state.running, true)
  assert.equal(state.onBreak, true)
  assert.equal(state.startedAt, "09:00")
  assert.equal(state.breakSince, "12:00")
  assert.equal(state.breakStartUnknown, false)
  assert.equal(state.clockedOutAt, null)
  assert.deepEqual(view(state, "12:12"), { kind: "break", text: "0:12" })
})

test("after ending the break the shift goes on with its start time, the break does not count", () => {
  const state = breakEnd(breakStart(clockIn(emptyState(), "09:00"), "12:00"), "12:30")
  assert.equal(state.onBreak, false)
  assert.equal(state.breakSince, null)
  assert.deepEqual(view(state, "12:31"), { kind: "running", text: "3:31" })
  assert.equal(workedMinutes(state, at("13:00")), 240 - 30)
})

test("the break survives a restart of the shell, and the status confirms it", () => {
  let state = restoreState(JSON.stringify(breakStart(clockIn(emptyState(), "09:00"), "12:00")))
  assert.deepEqual(view(state, "12:10"), { kind: "break", text: "0:10" })
  state = applyStatus(state, "break", at("12:10"), { startedAt: "09:00", breakSince: "12:00" }).state
  assert.deepEqual(view(state, "12:10"), { kind: "break", text: "0:10" })
})

test("ending the break in the web puts you back in the shift", () => {
  const state = breakStart(clockIn(emptyState(), "09:00"), "12:00")
  const r = applyStatus(state, "running", at("12:40"))
  assert.equal(r.state.breakSince, null)
  assert.equal(r.state.startedAt, "09:00")
  assert.equal(r.startTimeQuery, null)
})

test("during a shift the panel offers the break, during the break its end", () => {
  assert.equal(breakAction({ kind: "running", text: "1:00" }), "break-start")
  assert.equal(breakAction({ kind: "idle", text: "" }), null)
  assert.equal(stampAction({ kind: "break", text: "0:10" }), "break-end")
})

test("a failed break names the action and leaves the status standing", () => {
  const state = clockIn(emptyState(), "09:00")
  const fail = (action) =>
    applyStamp(state, action, { ok: false, error: { code: "NETWORK", message: "" } }, at("12:00"))
  assert.match(fail("break-start").error, /^Pause beginnen fehlgeschlagen/)
  assert.match(fail("break-end").error, /^Pause beenden fehlgeschlagen/)
  assert.equal(fail("break-start").state, state)
})

test("an unknown break type names its name", () => {
  const r = applyStamp(
    clockIn(emptyState(), "09:00"),
    "break-start",
    { ok: false, error: { code: "BREAK_TYPE_UNKNOWN", message: "raw", breakType: "Siesta" } },
    at("12:00"),
  )
  assert.equal(
    r.error,
    "Pause beginnen fehlgeschlagen: Pausentyp „Siesta“ gibt es in Calamari nicht. Es wird nichts nachgereicht.",
  )
})

test("if Calamari reports no break after beginning one the panel says so and asks again", () => {
  const state = clockIn(emptyState(), "09:00")
  const r = applyStamp(state, "break-start", { ok: true, onBreak: false }, at("12:00"))
  assert.equal(view(r.state, "12:00").kind, "running")
  assert.equal(r.error, "Pause beginnen: Calamari meldet keine Pause. Bitte im Web prüfen.")
  assert.equal(r.pollNow, true)
})

test("if Calamari still reports a break after ending one it stays and the panel says so", () => {
  const state = breakStart(clockIn(emptyState(), "09:00"), "12:00")
  const r = applyStamp(state, "break-end", { ok: true, onBreak: true }, at("12:30"))
  assert.deepEqual(view(r.state, "12:30"), { kind: "break", text: "0:30" })
  assert.equal(r.error, "Pause beenden: Calamari meldet weiter eine Pause. Bitte im Web prüfen.")
  assert.equal(r.pollNow, true)
})

test("every stamp action has its helper command with the names from the settings", () => {
  const settings = { defaultProject: "Kunde A", breakType: "Mittagspause" }
  assert.deepEqual(helperCommand("clock-in", settings), ["clock-in", "--project", "Kunde A"])
  assert.deepEqual(helperCommand("clock-out", settings), ["clock-out"])
  assert.deepEqual(helperCommand("break-start", settings), ["break-start", "--break-type", "Mittagspause"])
  assert.deepEqual(helperCommand("break-end", settings), ["break-stop", "--break-type", "Mittagspause"])
})

test("empty names in the settings mean the helper's own default", () => {
  assert.deepEqual(helperCommand("clock-in", {}), ["clock-in"])
  assert.deepEqual(helperCommand("clock-in", { defaultProject: "  " }), ["clock-in"])
  assert.deepEqual(helperCommand("clock-in", { defaultProject: " Kunde A " }), ["clock-in", "--project", "Kunde A"])
  assert.deepEqual(helperCommand("break-start", { breakType: "" }), ["break-start"])
  assert.deepEqual(helperCommand("break-end", null), ["break-stop"])
})

test("if no shift was running at all at the clock-out it is not an end of day and the panel says so", () => {
  const state = clockIn(emptyState(), "09:00")
  const r = applyStamp(state, "clock-out", { ok: true, running: false, stamped: false }, at("16:00"))
  assert.equal(r.state.clockedOutAt, null)
  assert.deepEqual(view(r.state, "16:00"), { kind: "idle", text: "" })
  assert.equal(r.error, "Ausstempeln: Calamari meldet keine laufende Schicht.")
  assert.equal(r.pollNow, true)
  assert.equal(workedMinutes(r.state, at("16:00")), 0)
})

test("the buttons are named after the actions", () => {
  assert.equal(stampLabel("break-start"), "Pause beginnen")
  assert.equal(stampLabel("break-end"), "Pause beenden")
  assert.equal(stampLabel("clock-out"), "Ausstempeln")
})

test("if a shift was last running yesterday the plugin asks in the morning about the previous day's end", () => {
  const yesterday = applyStatus(emptyState(), "running", at("17:00", "2026-09-21")).state
  assert.equal(pendingDayEnd(yesterday, at("07:30")), "2026-09-21")
  // Still yesterday: nothing to ask, the shift is simply running.
  assert.equal(pendingDayEnd(yesterday, at("17:05", "2026-09-21")), null)
  const idleYesterday = applyStatus(emptyState(), "stopped", at("17:00", "2026-09-21")).state
  assert.equal(pendingDayEnd(idleYesterday, at("07:30")), null)
})

test("the question about the previous day survives the change of day in the state", () => {
  const yesterday = applyStatus(emptyState(), "running", at("17:00", "2026-09-21")).state
  // A poll of the new day rolls the state over before the answer arrives.
  const today = applyStatus(yesterday, "stopped", at("07:30")).state
  assert.equal(pendingDayEnd(today, at("07:33")), "2026-09-21")
  const answered = applyDayEnd(today, "2026-09-21", false, at("07:33")).state
  assert.equal(pendingDayEnd(answered, at("07:40")), null)
})

test("if the shift ran to the day's end a hint asks for the end time to be corrected", () => {
  let state = applyStatus(emptyState(), "running", at("17:00", "2026-09-21")).state
  state = setIdle(state, true, at("18:00", "2026-09-21"), 300)
  const r = applyDayEnd(state, "2026-09-21", true, at("07:30"))
  assert.deepEqual(r.notice, { type: "day-end-closed", date: "2026-09-21", lastActivity: "2026-09-21T17:55" })
  assert.equal(r.state.running, null)
  assert.equal(r.state.stampedToday, false)
})

test("if the user clocked out themselves yesterday no hint comes", () => {
  const state = applyStatus(emptyState(), "running", at("17:00", "2026-09-21")).state
  assert.equal(applyDayEnd(state, "2026-09-21", false, at("07:30")).notice, null)
})

test("a last activity from today does not belong in yesterday's hint", () => {
  // Woke up at 07:30 and walked away before the answer came back.
  let state = applyStatus(emptyState(), "running", at("17:00", "2026-09-21")).state
  state = setIdle(state, true, at("07:40"), 300)
  assert.equal(applyDayEnd(state, "2026-09-21", true, at("07:45")).notice.lastActivity, null)
})

test("having been back and gone on working gets the hint with no time of day", () => {
  // Away at lunch, back at 13:00: 12:30 is no end time for that day.
  let state = applyStatus(emptyState(), "running", at("09:00", "2026-09-21")).state
  state = setIdle(state, true, at("12:35", "2026-09-21"), 300)
  state = setIdle(state, false, at("13:00", "2026-09-21"), 300)
  assert.equal(applyDayEnd(state, "2026-09-21", true, at("07:30")).notice.lastActivity, null)
})

test("an answer to a different question changes nothing", () => {
  const state = applyStatus(emptyState(), "running", at("17:00", "2026-09-21")).state
  const r = applyDayEnd(state, "2026-09-20", true, at("07:30"))
  assert.equal(r.notice, null)
  assert.equal(r.state, state)
})

// Gesamtzeit heute (beobachtet)

test("the total time today counts ended and running shifts, before a break too", () => {
  let state = clockIn(applyStatus(emptyState(), "stopped", at("08:55")).state, "09:00")
  state = breakStart(state, "12:00")
  state = breakEnd(state, "12:30")
  assert.equal(workedMinutes(state, at("13:00")), 180 + 30)
  state = clockOut(state, "16:30")
  assert.equal(workedMinutes(state, at("18:00")), 180 + 240)
})

test("a shift ended in the web is entered afterwards with its end", () => {
  let state = applyStartTime(applyStatus(emptyState(), "running", at("10:00")).state, "09:40")
  const r = applyStatus(state, "stopped", at("12:03"))
  assert.deepEqual(r.endTimeQuery, { after: "09:40" })
  state = applyEndTime(r.state, "09:40", "12:00")
  assert.equal(workedMinutes(state, at("12:05")), 140)
})

test("with no known start no end is searched for", () => {
  const state = applyStatus(emptyState(), "running", at("10:00")).state
  assert.equal(applyStatus(state, "stopped", at("12:03")).endTimeQuery, null)
})

test("a stamping of our own needs no search for the end", () => {
  const state = clockOut(clockIn(emptyState(), "09:00"), "12:00")
  assert.equal(applyStatus(state, "stopped", at("12:05")).endTimeQuery, null)
})

test("the total time survives a restart and begins again the next day", () => {
  const state = restoreState(JSON.stringify(clockOut(clockIn(emptyState(), "09:00"), "12:00")))
  assert.equal(workedMinutes(state, at("13:00")), 180)
  const tomorrow = applyStatus(state, "stopped", at("08:00", "2026-09-23")).state
  assert.equal(workedMinutes(tomorrow, at("08:00", "2026-09-23")), 0)
})

test("the previous day's shift does not count towards today's total time", () => {
  const yesterday = applyStatus(emptyState(), "running", at("22:00", "2026-09-21")).state
  const state = applyDayEnd(yesterday, "2026-09-21", true, at("07:30")).state
  assert.equal(workedMinutes(state, at("08:00")), 0)
})

test("the panel names the total time observed today as soon as there is one", () => {
  assert.equal(workedText(clockIn(emptyState(), "09:00"), at("09:00")), "")
  assert.equal(
    workedText(clockOut(clockIn(emptyState(), "09:00"), "12:05"), at("13:00")),
    "Heute gearbeitet (beobachtet): 3:05",
  )
})

test("if the search for the end fails the next query tries again", () => {
  const state = applyStartTime(applyStatus(emptyState(), "running", at("10:00")).state, "09:40")
  const first = applyStatus(state, "stopped", at("12:03"))
  // end-time failed: nothing applied; the next poll asks again.
  const again = applyStatus(first.state, "stopped", at("12:06"))
  assert.deepEqual(again.endTimeQuery, { after: "09:40" })
  const done = applyEndTime(again.state, "09:40", "12:00")
  assert.equal(applyStatus(done, "stopped", at("12:09")).endTimeQuery, null)
  assert.equal(workedMinutes(done, at("12:10")), 140)
})

test("if the search finds no end no further search is made", () => {
  const state = applyStartTime(applyStatus(emptyState(), "running", at("10:00")).state, "09:40")
  const r = applyStatus(state, "stopped", at("12:03"))
  const none = applyEndTime(r.state, "09:40", null)
  assert.equal(applyStatus(none, "stopped", at("12:06")).endTimeQuery, null)
})

test("an answer to the previous day's search does not change the new day", () => {
  const state = applyStartTime(applyStatus(emptyState(), "running", at("22:00", "2026-09-21")).state, "21:40")
  const r = applyStatus(state, "stopped", at("23:59", "2026-09-21"))
  const tomorrow = applyStatus(r.state, "stopped", at("00:05")).state
  assert.equal(workedMinutes(applyEndTime(tomorrow, "21:40", "23:50"), at("00:10")), 0)
})

// A break Calamari reports (in the web, on the phone)

const seenBreak = (begun, now) => applyStatus(running(begun, now), "break", at(now)).state

test("a break started elsewhere interrupts the shift but does not end it", () => {
  const state = seenBreak("09:00", "12:10")
  assert.equal(state.running, true)
  assert.equal(state.onBreak, true)
  assert.equal(state.startedAt, "09:00")
  assert.equal(state.clockedOutAt, null)
  assert.equal(state.breakSince, "12:10")
  // ... but that is only when the plugin first saw it.
  assert.equal(state.breakStartUnknown, true)
})

test("a break started elsewhere shows the bar as a break, counted from first seeing it", () => {
  let state = seenBreak("09:00", "12:10")
  state = applyStatus(state, "break", at("12:25")).state
  assert.equal(state.breakSince, "12:10")
  assert.deepEqual(view(state, "12:25"), { kind: "break", text: "0:15" })
  assert.equal(stampAction(view(state, "12:25")), "break-end")
})

test("when the break started elsewhere ends the shift goes on with its start time", () => {
  const r = applyStatus(seenBreak("09:00", "12:10"), "running", at("12:40"))
  assert.equal(r.state.onBreak, false)
  assert.equal(r.state.breakSince, null)
  assert.equal(r.startTimeQuery, null)
  assert.deepEqual(view(r.state, "12:40"), { kind: "running", text: "3:40" })
})

test("if the shift ends out of the break started elsewhere there is no break any more and its end is searched for", () => {
  const r = applyStatus(seenBreak("09:00", "12:10"), "stopped", at("12:40"))
  assert.equal(r.state.running, false)
  assert.equal(r.state.onBreak, false)
  assert.equal(r.state.breakSince, null)
  assert.deepEqual(r.endTimeQuery, { after: "09:00" })
  assert.equal(view(r.state, "12:40").kind, "idle")
})

test("a break the plugin already finds at startup needs the shift's start time", () => {
  const r = applyStatus(emptyState(), "break", at("12:10"))
  assert.deepEqual(r.startTimeQuery, { after: null })
  assert.equal(r.state.breakSince, "12:10")
  assert.equal(r.state.stampedToday, true)
})

test("the break started elsewhere survives a restart of the shell", () => {
  const state = restoreState(JSON.stringify(seenBreak("09:00", "12:10")))
  assert.equal(state.onBreak, true)
  assert.deepEqual(view(state, "12:20"), { kind: "break", text: "0:10" })
})

test("a break past midnight counts as an open day like a running shift", () => {
  const yesterday = seenBreak("20:00", "23:30")
  const r = applyStatus(Object.assign({}, yesterday, { date: "2026-09-21" }), "stopped", at("08:00"))
  assert.equal(r.state.onBreak, false)
  assert.equal(r.state.breakSince, null)
  assert.equal(r.state.unclosed, "2026-09-21")
})

test("the time of a break started elsewhere does not count towards today's total time", () => {
  const state = seenBreak("09:00", "12:00")
  assert.equal(workedMinutes(state, at("12:30")), 180)
})

test("after a break started elsewhere its time still does not count towards today's total time", () => {
  let state = seenBreak("09:00", "12:00")
  state = applyStatus(state, "running", at("12:30")).state
  assert.equal(workedMinutes(state, at("13:00")), 210)
  state = applyStatus(state, "break", at("14:00")).state
  state = applyStatus(state, "stopped", at("14:10")).state
  // The shift ended in its second break; end-time adds it from 09:00 to 14:05.
  state = applyEndTime(state, "09:00", "14:05")
  assert.equal(workedMinutes(state, at("15:00")), 305 - 30 - 10)
})

test("the break names its start, or that it is not known", () => {
  assert.equal(breakSinceText(breakStart(clockIn(emptyState(), "09:00"), "12:00")), "12:00")
  assert.equal(breakSinceText(seenBreak("09:00", "12:10")), "spätestens 12:10")
})

test("ending a break started elsewhere keeps the shift's start time", () => {
  const state = breakEnd(seenBreak("09:00", "12:10"), "12:30")
  assert.equal(state.startedAt, "09:00")
  assert.equal(state.onBreak, false)
  assert.equal(view(state, "12:31").kind, "running")
  assert.equal(workedMinutes(state, at("12:30")), 190)
})

// The start of shift and break from Calamari's timesheet entry

test("if Calamari knows the break's start it counts from there and not from first seeing it", () => {
  const r = applyStatus(running("09:00", "12:00"), "break", at("12:10"), { startedAt: "09:00", breakSince: "11:46" })
  assert.equal(r.state.breakSince, "11:46")
  assert.equal(r.state.breakStartUnknown, false)
  assert.deepEqual(view(r.state, "12:10"), { kind: "break", text: "0:24" })
  assert.equal(breakSinceText(r.state), "11:46")
})

test("if Calamari knows the shift's start no start-time search is needed", () => {
  const r = applyStatus(emptyState(), "running", at("12:10"), { startedAt: "11:24", breakSince: null })
  assert.equal(r.startTimeQuery, null)
  assert.equal(r.state.startedAt, "11:24")
})

test("Calamari's start of the shift replaces a stale cached one", () => {
  // A break the plugin never observed (shell off) left the earlier shift's start.
  const r = applyStatus(running("08:00", "10:00"), "running", at("12:10"), { startedAt: "11:24", breakSince: null })
  assert.equal(r.state.startedAt, "11:24")
})

test("with no known times it stays with first seeing it and with the start-time search", () => {
  const r = applyStatus(emptyState(), "break", at("12:10"), { startedAt: null, breakSince: null })
  assert.equal(r.state.breakSince, "12:10")
  assert.equal(r.state.breakStartUnknown, true)
  assert.deepEqual(r.startTimeQuery, { after: null })
})

// End of day out of the break (ticket 05)

const pausedAt = (since, begun = "09:00") => breakStart(clockIn(emptyState(), begun), since)

test("in a break the panel offers the end of day, otherwise not", () => {
  assert.equal(feierabendAction({ kind: "break", text: "0:10" }), "break-clock-out")
  assert.equal(feierabendAction({ kind: "running", text: "1:00" }), null)
  assert.equal(feierabendAction({ kind: "idle", text: "" }), null)
  assert.equal(stampLabel("break-clock-out"), "Feierabend")
  assert.deepEqual(helperCommand("break-clock-out", { defaultProject: "X", breakType: "Y" }), ["clock-out-break"])
})

test("an end of day out of the break ends the shift at the break's start, the end time is already right", () => {
  const r = applyStamp(
    pausedAt("17:32"),
    "break-clock-out",
    { ok: true, running: false, stamped: true, endedAt: "17:32", atBreakStart: true },
    at("17:35"),
  )
  assert.equal(r.error, "")
  assert.equal(r.endTimeKnown, true)
  assert.equal(r.state.clockedOutAt, "17:32")
  assert.equal(r.state.running, false)
  assert.equal(r.state.onBreak, false)
  assert.deepEqual(view(r.state, "17:40"), { kind: "idle", text: "" })
  assert.equal(workedMinutes(r.state, at("18:00")), 8 * 60 + 32)
})

test("with no known break start the shift ends now, and the end time wants correcting", () => {
  const r = applyStamp(
    pausedAt("17:32"),
    "break-clock-out",
    { ok: true, running: false, stamped: true, endedAt: "17:35", atBreakStart: false },
    at("17:35"),
  )
  assert.equal(r.endTimeKnown, false)
  assert.equal(r.state.clockedOutAt, "17:35")
  // The break is no work, whatever end Calamari has.
  assert.equal(workedMinutes(r.state, at("18:00")), 8 * 60 + 32)
})

test("if no shift was running any more at the end of day out of the break the panel says so", () => {
  const r = applyStamp(
    pausedAt("17:32"),
    "break-clock-out",
    { ok: true, running: false, stamped: false, endedAt: null, atBreakStart: false },
    at("17:35"),
  )
  assert.equal(r.state.clockedOutAt, null)
  assert.equal(r.error, "Feierabend: Calamari meldet keine laufende Schicht.")
  assert.equal(r.pollNow, true)
})

test("the ordinary clock-out does not know its end time in advance", () => {
  const r = applyStamp(
    clockIn(emptyState(), "09:00"),
    "clock-out",
    { ok: true, running: false, stamped: true },
    at("17:00"),
  )
  assert.equal(r.endTimeKnown, false)
})
