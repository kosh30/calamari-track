import { test } from "node:test"
import assert from "node:assert/strict"
import { applyStamp, applyStatus, applyStartTime, barView, breakAction, dayOffToday, emptyState, endBreakAsFeierabend, feierabendAction, helperCommand, needsOvernightCheck, applyEndTime, restoreState, setDayOff, stampAction, stampLabel, workedMinutes, workedText } from "./shiftclock.mjs"

const at = (hhmm, date = "2026-09-22") => new Date(`${date}T${hhmm}:00`)

test("eine neu erkannte laufende Schicht braucht ihre Startzeit", () => {
  const r = applyStatus(emptyState(), true, at("10:00"))
  assert.deepEqual(r.startTimeQuery, { after: null })
  assert.equal(r.state.running, true)
})

test("die gecachte Startzeit wird nicht erneut ermittelt", () => {
  let state = applyStatus(emptyState(), true, at("10:00")).state
  state = applyStartTime(state, "09:40")
  const r = applyStatus(state, true, at("10:03"))
  assert.equal(r.startTimeQuery, null)
  assert.equal(r.state.startedAt, "09:40")
})

test("nach dem Ausstempeln wird die Folgeschicht erst ab der letzten Abfrage ohne laufende Schicht gesucht", () => {
  let state = applyStatus(emptyState(), true, at("08:00")).state
  state = applyStartTime(state, "08:00")
  state = applyStatus(state, false, at("12:03")).state
  assert.equal(state.startedAt, null)
  const r = applyStatus(state, true, at("12:48"))
  // The ended shift may still show as running up to 2 minutes after its end.
  assert.deepEqual(r.startTimeQuery, { after: "12:01" })
})

test("an einem neuen Tag zählt die Abfrage ohne Schicht vom Vortag nicht", () => {
  let state = applyStatus(emptyState(), false, at("18:00", "2026-09-21")).state
  const r = applyStatus(state, true, at("08:30"))
  assert.deepEqual(r.startTimeQuery, { after: null })
  assert.equal(r.state.date, "2026-09-22")
})

test("ohne laufende Schicht zeigt die Bar idle", () => {
  const state = applyStatus(emptyState(), false, at("10:00")).state
  assert.deepEqual(barView({ state, now: at("10:00"), authState: "ok", failed: false }),
    { kind: "idle", text: "" })
})

test("bei laufender Schicht zeigt die Bar die Dauer seit dem Einstempeln", () => {
  let state = applyStatus(emptyState(), true, at("13:00")).state
  state = applyStartTime(state, "09:40")
  assert.deepEqual(barView({ state, now: at("13:22"), authState: "ok", failed: false }),
    { kind: "running", text: "3:42" })
})

test("solange die Startzeit fehlt, läuft die Schicht ohne Dauer", () => {
  const state = applyStatus(emptyState(), true, at("13:00")).state
  assert.deepEqual(barView({ state, now: at("13:00"), authState: "ok", failed: false }),
    { kind: "running", text: "" })
})

test("ein Fehler verdrängt den veralteten Status", () => {
  let state = applyStatus(emptyState(), true, at("13:00")).state
  state = applyStartTime(state, "09:40")
  assert.equal(barView({ state, now: at("13:22"), authState: "ok", failed: true }).kind, "error")
})

test("nötige Anmeldung hat Vorrang vor allem anderen", () => {
  const state = applyStatus(emptyState(), true, at("13:00")).state
  assert.equal(barView({ state, now: at("13:22"), authState: "required", failed: true }).kind, "auth")
})

test("vor der ersten Abfrage ist der Status unbekannt", () => {
  assert.equal(barView({ state: emptyState(), now: at("13:00"), authState: "unknown", failed: false }).kind, "unknown")
})

test("der gespeicherte Zustand übersteht einen Neustart der Shell", () => {
  let state = applyStatus(emptyState(), true, at("13:00")).state
  state = applyStartTime(state, "09:40")
  assert.deepEqual(restoreState(JSON.stringify(state)), state)
})

test("ein fehlender oder kaputter Zustand beginnt leer", () => {
  assert.deepEqual(restoreState(""), emptyState())
  assert.deepEqual(restoreState("{kaputt"), emptyState())
  assert.deepEqual(restoreState("[]"), emptyState())
})

test("unbekannte Felder aus älteren Versionen fallen beim Laden weg", () => {
  const restored = restoreState(JSON.stringify({ date: "2026-09-22", running: true, startedAt: "09:40", idleSince: null }))
  assert.deepEqual(Object.keys(restored).sort(), Object.keys(emptyState()).sort())
  assert.equal(restored.startedAt, "09:40")
})

const running = (startedAt, now) => applyStartTime(applyStatus(emptyState(), true, at(now)).state, startedAt)
const clockOut = (state, now) => applyStamp(state, "clock-out", { ok: true, running: false }, at(now)).state
const clockIn = (state, now) => applyStamp(state, "clock-in", { ok: true, running: true }, at(now)).state
const view = (state, now) => barView({ state, now: at(now), authState: "ok", failed: false })

test("nach dem Ausstempeln ist Feierabend und keine Schicht läuft", () => {
  const state = clockOut(running("09:40", "17:00"), "17:30")
  assert.equal(state.clockedOutAt, "17:30")
  assert.deepEqual(view(state, "17:30"), { kind: "idle", text: "" })
})

test("der Feierabend übersteht einen Neustart der Shell", () => {
  const state = clockOut(running("09:40", "17:00"), "17:30")
  assert.equal(restoreState(JSON.stringify(state)).clockedOutAt, "17:30")
})

test("kurz nach dem Ausstempeln gilt die noch sichtbare Schicht nicht als laufend", () => {
  const state = clockOut(running("09:40", "17:00"), "17:30")
  const r = applyStatus(state, true, at("17:32"))
  assert.equal(r.state.running, false)
  assert.equal(r.startTimeQuery, null)
  assert.equal(r.state.clockedOutAt, "17:30")
})

test("Einstempeln nach dem Feierabend hebt ihn auf und die Dauer zählt ab jetzt", () => {
  const state = clockIn(clockOut(running("09:40", "17:00"), "17:30"), "20:15")
  assert.equal(state.clockedOutAt, null)
  assert.deepEqual(view(state, "20:17"), { kind: "running", text: "0:02" })
  assert.equal(applyStatus(state, true, at("20:18")).startTimeQuery, null)
})

test("meldet Calamari nach dem Einstempeln keine laufende Schicht, zählt Calamari und das Panel sagt es", () => {
  const r = applyStamp(emptyState(), "clock-in", { ok: true, running: false }, at("08:00"))
  assert.deepEqual(view(r.state, "08:00"), { kind: "idle", text: "" })
  assert.equal(r.error, "Einstempeln: Calamari meldet keine laufende Schicht. Bitte im Web prüfen.")
  assert.equal(r.pollNow, true)
})

test("eine im Web begonnene Schicht nach dem Feierabend hebt ihn auf und wird erst nach dem Ausstempeln gesucht", () => {
  const state = clockOut(running("09:40", "17:00"), "17:30")
  const r = applyStatus(state, true, at("17:40"))
  assert.equal(r.state.running, true)
  assert.equal(r.state.clockedOutAt, null)
  // The ended shift reaches into minute 17:30.
  assert.deepEqual(r.startTimeQuery, { after: "17:31" })
})

test("eine Abfrage kurz nach dem Ausstempeln lässt die Startzeit-Suche trotzdem erst danach beginnen", () => {
  let state = clockOut(running("09:40", "17:00"), "17:30")
  state = applyStatus(state, true, at("17:31")).state
  const r = applyStatus(state, true, at("17:50"))
  assert.deepEqual(r.startTimeQuery, { after: "17:31" })
})

test("der Feierabend von gestern gilt heute nicht mehr", () => {
  const state = clockOut(running("09:40", "17:00"), "17:30")
  const yesterday = Object.assign({}, state, { date: "2026-09-21" })
  assert.equal(applyStatus(yesterday, false, at("08:00")).state.clockedOutAt, null)
})

test("ein fehlgeschlagenes Stempeln lässt den Status stehen, damit man es erneut versuchen kann", () => {
  const state = running("09:40", "17:00")
  const r = applyStamp(state, "clock-out", { ok: false, error: { code: "NETWORK", message: "cannot reach" } }, at("17:30"))
  assert.deepEqual(r.state, state)
  assert.equal(stampAction(view(r.state, "17:30")), "clock-out")
})

test("ein fehlgeschlagenes Stempeln nennt Aktion und Ursache und dass nichts nachgereicht wird", () => {
  const fail = (action, code, message) => applyStamp(running("09:40", "17:00"), action, { ok: false, error: { code, message } }, at("17:30")).error
  assert.equal(fail("clock-out", "NETWORK"),
    "Ausstempeln fehlgeschlagen: Calamari nicht erreichbar. Es wird nichts nachgereicht.")
  assert.equal(fail("clock-in", "RATE_LIMITED"),
    "Einstempeln fehlgeschlagen: zu viele Anfragen, bitte gleich erneut versuchen. Es wird nichts nachgereicht.")
  assert.equal(fail("clock-in", "AUTH_REQUIRED"),
    "Einstempeln fehlgeschlagen: Anmeldung nötig. Es wird nichts nachgereicht.")
  assert.equal(fail("clock-out", "MCP_ERROR", "clockOut: no started shift"),
    "Ausstempeln fehlgeschlagen: clockOut: no started shift. Es wird nichts nachgereicht.")
})

test("nach einem Fehlschlag wird der echte Status abgefragt, außer Calamari drosselt", () => {
  const fail = code => applyStamp(emptyState(), "clock-in", { ok: false, error: { code, message: "" } }, at("08:00")).pollNow
  assert.equal(fail("NETWORK"), true)
  assert.equal(fail("MCP_ERROR"), true)
  assert.equal(fail("RATE_LIMITED"), false)
  assert.equal(applyStamp(emptyState(), "clock-in", { ok: true, running: true }, at("08:00")).pollNow, false)
})

test("das Panel bietet Ausstempeln bei laufender Schicht und sonst Einstempeln an", () => {
  assert.equal(stampAction({ kind: "running", text: "1:00" }), "clock-out")
  assert.equal(stampAction({ kind: "idle", text: "" }), "clock-in")
  assert.equal(stampAction({ kind: "reminder", text: "" }), "clock-in")
})

test("ohne bekannten Status bietet das Panel kein Stempeln an", () => {
  for (const kind of ["unknown", "error", "auth"])
    assert.equal(stampAction({ kind, text: "" }), null)
})

test("in der Minute des Einstempelns gilt die eben begonnene Schicht weiter als laufend", () => {
  // `status` looks at full minutes and cannot see a shift begun in the current one yet.
  const state = clockIn(emptyState(), "11:21")
  const r = applyStatus(state, false, at("11:21"))
  assert.deepEqual(view(r.state, "11:21"), { kind: "running", text: "0:00" })
  assert.equal(view(applyStatus(r.state, false, at("11:24")).state, "11:24").kind, "idle")
})

test("solange eine Stempel-Erinnerung fällig ist, zeigt die Bar sie an", () => {
  const state = applyStatus(emptyState(), false, at("09:10")).state
  assert.equal(barView({ state, now: at("09:10"), authState: "ok", failed: false, reminding: true }).kind, "reminder")
  assert.equal(barView({ state, now: at("09:10"), authState: "ok", failed: true, reminding: true }).kind, "error")
})

test("„Heute frei“ gilt nur für den Tag, an dem es gesetzt wurde", () => {
  const state = setDayOff(applyStatus(emptyState(), false, at("08:00")).state, true, at("08:00"))
  assert.equal(dayOffToday(state, at("23:59")), true)
  // after midnight, even before the first poll of the new day
  assert.equal(dayOffToday(state, at("00:01", "2026-09-23")), false)
})

// Pause

const breakStart = (state, now) => applyStamp(state, "break-start", { ok: true, running: false }, at(now)).state

test("eine Pause stempelt aus, ist aber kein Feierabend, und die Bar zeigt ihre Dauer", () => {
  const state = breakStart(clockIn(emptyState(), "09:00"), "12:00")
  assert.equal(state.breakSince, "12:00")
  assert.equal(state.clockedOutAt, null)
  assert.deepEqual(view(state, "12:12"), { kind: "break", text: "0:12" })
})

test("Pause beenden stempelt ein, und die Dauer zählt ab dann", () => {
  let state = breakStart(clockIn(emptyState(), "09:00"), "12:00")
  state = applyStamp(state, "break-end", { ok: true, running: true }, at("12:30")).state
  assert.equal(state.breakSince, null)
  assert.deepEqual(view(state, "12:31"), { kind: "running", text: "0:01" })
})

test("kurz nach Pausenbeginn gilt die noch sichtbare Schicht nicht als laufend", () => {
  const state = breakStart(clockIn(emptyState(), "09:00"), "12:00")
  const r = applyStatus(state, true, at("12:02"))
  assert.equal(view(r.state, "12:02").kind, "break")
  assert.equal(r.startTimeQuery, null)
})

test("die Pause übersteht einen Neustart der Shell", () => {
  const state = breakStart(clockIn(emptyState(), "09:00"), "12:00")
  assert.deepEqual(view(restoreState(JSON.stringify(state)), "12:10"), { kind: "break", text: "0:10" })
})

test("wer die Pause im Web beendet, ist wieder in der Schicht", () => {
  const state = breakStart(clockIn(emptyState(), "09:00"), "12:00")
  const r = applyStatus(state, true, at("12:40"))
  assert.equal(r.state.breakSince, null)
  assert.deepEqual(r.startTimeQuery, { after: "12:01" })
})

test("während einer Schicht bietet das Panel die Pause an, in der Pause ihr Ende", () => {
  assert.equal(breakAction({ kind: "running", text: "1:00" }), "break-start")
  assert.equal(breakAction({ kind: "idle", text: "" }), null)
  assert.equal(stampAction({ kind: "break", text: "0:10" }), "break-end")
})

test("aus einer Pause lässt sich direkt in den Feierabend gehen, ohne zu stempeln", () => {
  const state = endBreakAsFeierabend(breakStart(clockIn(emptyState(), "09:00"), "15:00"), at("15:20"))
  assert.equal(state.breakSince, null)
  assert.equal(state.clockedOutAt, "15:00")
  assert.deepEqual(view(state, "15:20"), { kind: "idle", text: "" })
})

test("eine fehlgeschlagene Pause nennt die Aktion", () => {
  const fail = action => applyStamp(emptyState(), action, { ok: false, error: { code: "NETWORK", message: "" } }, at("12:00")).error
  assert.match(fail("break-start"), /^Pause beginnen fehlgeschlagen/)
  assert.match(fail("break-end"), /^Pause beenden fehlgeschlagen/)
})

test("Pausen-Aktionen stempeln bei Calamari aus bzw. ein", () => {
  assert.equal(helperCommand("break-start"), "clock-out")
  assert.equal(helperCommand("break-end"), "clock-in")
  assert.equal(helperCommand("clock-in"), "clock-in")
})

test("die Buttons heißen wie die Aktionen", () => {
  assert.equal(stampLabel("break-start"), "Pause beginnen")
  assert.equal(stampLabel("break-end"), "Pause beenden")
  assert.equal(stampLabel("clock-out"), "Ausstempeln")
})

test("ohne laufende Pause ändert „Feierabend“ nichts", () => {
  const state = clockOut(clockIn(emptyState(), "09:00"), "15:00")
  assert.deepEqual(endBreakAsFeierabend(state, at("15:20")), state)
})

test("„Feierabend“ bietet das Panel nur während einer Pause an", () => {
  assert.equal(feierabendAction({ kind: "break", text: "0:10" }), "end-break")
  assert.equal(feierabendAction({ kind: "running", text: "1:00" }), null)
  assert.equal(feierabendAction({ kind: "idle", text: "" }), null)
})

test("lief gestern zuletzt eine Schicht, fragt die erste Abfrage des Tages auch nach dem Vortag", () => {
  const yesterday = applyStatus(emptyState(), true, at("17:00", "2026-09-21")).state
  assert.equal(needsOvernightCheck(yesterday, at("07:30")), true)
  assert.equal(needsOvernightCheck(applyStatus(yesterday, false, at("07:30")).state, at("07:33")), false)
  const idleYesterday = applyStatus(emptyState(), false, at("17:00", "2026-09-21")).state
  assert.equal(needsOvernightCheck(idleYesterday, at("07:30")), false)
})

test("solange die Schicht vom Vortag offen ist, fragt jede Abfrage auch nach dem Vortag", () => {
  const yesterday = applyStatus(emptyState(), true, at("17:00", "2026-09-21")).state
  const overnight = applyStatus(yesterday, true, at("07:30"), true).state
  assert.equal(needsOvernightCheck(overnight, at("07:35")), true)
  assert.equal(overnight.stampedToday, false)
  const gone = applyStatus(overnight, false, at("07:36"), false).state
  assert.equal(gone.overnight, false)
  assert.equal(needsOvernightCheck(gone, at("07:40")), false)
})

// Gesamtzeit heute (beobachtet)

test("die Gesamtzeit heute zählt beendete und laufende Schichten, auch vor einer Pause", () => {
  let state = clockIn(applyStatus(emptyState(), false, at("08:55")).state, "09:00")
  state = breakStart(state, "12:00")
  state = applyStamp(state, "break-end", { ok: true, running: true }, at("12:30")).state
  assert.equal(workedMinutes(state, at("13:00")), 180 + 30)
  state = clockOut(state, "16:30")
  assert.equal(workedMinutes(state, at("18:00")), 180 + 240)
})

test("eine im Web beendete Schicht wird mit ihrem Ende nachgetragen", () => {
  let state = applyStartTime(applyStatus(emptyState(), true, at("10:00")).state, "09:40")
  const r = applyStatus(state, false, at("12:03"))
  assert.deepEqual(r.endTimeQuery, { after: "09:40" })
  state = applyEndTime(r.state, "09:40", "12:00")
  assert.equal(workedMinutes(state, at("12:05")), 140)
})

test("ohne bekannten Beginn wird kein Ende gesucht", () => {
  const state = applyStatus(emptyState(), true, at("10:00")).state
  assert.equal(applyStatus(state, false, at("12:03")).endTimeQuery, null)
})

test("eine eigene Stempelung braucht keine Suche nach dem Ende", () => {
  const state = clockOut(clockIn(emptyState(), "09:00"), "12:00")
  assert.equal(applyStatus(state, false, at("12:05")).endTimeQuery, null)
})

test("die Gesamtzeit übersteht einen Neustart und beginnt am nächsten Tag neu", () => {
  const state = restoreState(JSON.stringify(clockOut(clockIn(emptyState(), "09:00"), "12:00")))
  assert.equal(workedMinutes(state, at("13:00")), 180)
  const tomorrow = applyStatus(state, false, at("08:00", "2026-09-23")).state
  assert.equal(workedMinutes(tomorrow, at("08:00", "2026-09-23")), 0)
})

test("die Schicht vom Vortag zählt nicht zur Gesamtzeit heute", () => {
  let state = applyStatus(emptyState(), true, at("22:00", "2026-09-21")).state
  state = applyStatus(state, true, at("07:30"), true).state
  state = applyStamp(state, "overnight-close", { ok: true, running: false }, at("07:31")).state
  assert.equal(workedMinutes(state, at("08:00")), 0)
})

test("das Panel nennt die beobachtete Gesamtzeit heute, sobald es eine gibt", () => {
  assert.equal(workedText(clockIn(emptyState(), "09:00"), at("09:00")), "")
  assert.equal(workedText(clockOut(clockIn(emptyState(), "09:00"), "12:05"), at("13:00")), "Heute gearbeitet (beobachtet): 3:05")
})

test("scheitert die Suche nach dem Ende, versucht es die nächste Abfrage erneut", () => {
  const state = applyStartTime(applyStatus(emptyState(), true, at("10:00")).state, "09:40")
  const first = applyStatus(state, false, at("12:03"))
  // end-time failed: nothing applied; the next poll asks again.
  const again = applyStatus(first.state, false, at("12:06"))
  assert.deepEqual(again.endTimeQuery, { after: "09:40" })
  const done = applyEndTime(again.state, "09:40", "12:00")
  assert.equal(applyStatus(done, false, at("12:09")).endTimeQuery, null)
  assert.equal(workedMinutes(done, at("12:10")), 140)
})

test("findet die Suche kein Ende, wird nicht weiter gesucht", () => {
  const state = applyStartTime(applyStatus(emptyState(), true, at("10:00")).state, "09:40")
  const r = applyStatus(state, false, at("12:03"))
  const none = applyEndTime(r.state, "09:40", null)
  assert.equal(applyStatus(none, false, at("12:06")).endTimeQuery, null)
})

test("eine Antwort auf die Suche vom Vortag ändert den neuen Tag nicht", () => {
  const state = applyStartTime(applyStatus(emptyState(), true, at("22:00", "2026-09-21")).state, "21:40")
  const r = applyStatus(state, false, at("23:59", "2026-09-21"))
  const tomorrow = applyStatus(r.state, false, at("00:05")).state
  assert.equal(workedMinutes(applyEndTime(tomorrow, "21:40", "23:50"), at("00:10")), 0)
})
