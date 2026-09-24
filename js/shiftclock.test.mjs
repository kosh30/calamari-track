import { test } from "node:test"
import assert from "node:assert/strict"
import { applyDayEnd, applyStamp, breakSinceText, applyStatus, applyStartTime, barView, breakAction, dayOffToday, emptyState, endBreakAsFeierabend, feierabendAction, helperCommand, pendingDayEnd, applyEndTime, restoreState, setDayOff, stampAction, stampLabel, workedMinutes, workedText } from "./shiftclock.mjs"
import { setIdle } from "./activity.mjs"

const at = (hhmm, date = "2026-09-22") => new Date(`${date}T${hhmm}:00`)

test("eine neu erkannte laufende Schicht braucht ihre Startzeit", () => {
  const r = applyStatus(emptyState(), "running", at("10:00"))
  assert.deepEqual(r.startTimeQuery, { after: null })
  assert.equal(r.state.running, true)
})

test("die gecachte Startzeit wird nicht erneut ermittelt", () => {
  let state = applyStatus(emptyState(), "running", at("10:00")).state
  state = applyStartTime(state, "09:40")
  const r = applyStatus(state, "running", at("10:03"))
  assert.equal(r.startTimeQuery, null)
  assert.equal(r.state.startedAt, "09:40")
})

test("nach dem Ausstempeln wird die Folgeschicht erst ab der letzten Abfrage ohne laufende Schicht gesucht", () => {
  let state = applyStatus(emptyState(), "running", at("08:00")).state
  state = applyStartTime(state, "08:00")
  state = applyStatus(state, "stopped", at("12:03")).state
  assert.equal(state.startedAt, null)
  const r = applyStatus(state, "running", at("12:48"))
  // No shift ran at 12:03; one ended earlier in that minute still reaches into it.
  assert.deepEqual(r.startTimeQuery, { after: "12:04" })
})

test("an einem neuen Tag zählt die Abfrage ohne Schicht vom Vortag nicht", () => {
  let state = applyStatus(emptyState(), "stopped", at("18:00", "2026-09-21")).state
  const r = applyStatus(state, "running", at("08:30"))
  assert.deepEqual(r.startTimeQuery, { after: null })
  assert.equal(r.state.date, "2026-09-22")
})

test("ohne laufende Schicht zeigt die Bar idle", () => {
  const state = applyStatus(emptyState(), "stopped", at("10:00")).state
  assert.deepEqual(barView({ state, now: at("10:00"), authState: "ok", failed: false }),
    { kind: "idle", text: "" })
})

test("bei laufender Schicht zeigt die Bar die Dauer seit dem Einstempeln", () => {
  let state = applyStatus(emptyState(), "running", at("13:00")).state
  state = applyStartTime(state, "09:40")
  assert.deepEqual(barView({ state, now: at("13:22"), authState: "ok", failed: false }),
    { kind: "running", text: "3:42" })
})

test("solange die Startzeit fehlt, läuft die Schicht ohne Dauer", () => {
  const state = applyStatus(emptyState(), "running", at("13:00")).state
  assert.deepEqual(barView({ state, now: at("13:00"), authState: "ok", failed: false }),
    { kind: "running", text: "" })
})

test("ein Fehler verdrängt den veralteten Status", () => {
  let state = applyStatus(emptyState(), "running", at("13:00")).state
  state = applyStartTime(state, "09:40")
  assert.equal(barView({ state, now: at("13:22"), authState: "ok", failed: true }).kind, "error")
})

test("nötige Anmeldung hat Vorrang vor allem anderen", () => {
  const state = applyStatus(emptyState(), "running", at("13:00")).state
  assert.equal(barView({ state, now: at("13:22"), authState: "required", failed: true }).kind, "auth")
})

test("vor der ersten Abfrage ist der Status unbekannt", () => {
  assert.equal(barView({ state: emptyState(), now: at("13:00"), authState: "unknown", failed: false }).kind, "unknown")
})

test("der gespeicherte Zustand übersteht einen Neustart der Shell", () => {
  let state = applyStatus(emptyState(), "running", at("13:00")).state
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

const running = (startedAt, now) => applyStartTime(applyStatus(emptyState(), "running", at(now)).state, startedAt)
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

test("kurz nach dem Ausstempeln gilt, was Calamari meldet: der Status hat keinen Nachlauf mehr", () => {
  const state = clockOut(running("09:40", "17:00"), "17:30")
  const r = applyStatus(state, "running", at("17:31"))
  assert.equal(r.state.running, true)
  assert.equal(r.state.clockedOutAt, null)
  assert.deepEqual(r.startTimeQuery, { after: "17:31" })
})

test("Einstempeln nach dem Feierabend hebt ihn auf und die Dauer zählt ab jetzt", () => {
  const state = clockIn(clockOut(running("09:40", "17:00"), "17:30"), "20:15")
  assert.equal(state.clockedOutAt, null)
  assert.deepEqual(view(state, "20:17"), { kind: "running", text: "0:02" })
  assert.equal(applyStatus(state, "running", at("20:18")).startTimeQuery, null)
})

test("meldet Calamari nach dem Einstempeln keine laufende Schicht, zählt Calamari und das Panel sagt es", () => {
  const r = applyStamp(emptyState(), "clock-in", { ok: true, running: false }, at("08:00"))
  assert.deepEqual(view(r.state, "08:00"), { kind: "idle", text: "" })
  assert.equal(r.error, "Einstempeln: Calamari meldet keine laufende Schicht. Bitte im Web prüfen.")
  assert.equal(r.pollNow, true)
})

test("eine im Web begonnene Schicht nach dem Feierabend hebt ihn auf und wird erst nach dem Ausstempeln gesucht", () => {
  const state = clockOut(running("09:40", "17:00"), "17:30")
  const r = applyStatus(state, "running", at("17:40"))
  assert.equal(r.state.running, true)
  assert.equal(r.state.clockedOutAt, null)
  // The ended shift reaches into minute 17:30.
  assert.deepEqual(r.startTimeQuery, { after: "17:31" })
})

test("eine Abfrage kurz nach dem Ausstempeln lässt die Startzeit-Suche trotzdem erst danach beginnen", () => {
  let state = clockOut(running("09:40", "17:00"), "17:30")
  state = applyStatus(state, "running", at("17:31")).state
  const r = applyStatus(state, "running", at("17:50"))
  assert.deepEqual(r.startTimeQuery, { after: "17:31" })
})

test("der Feierabend von gestern gilt heute nicht mehr", () => {
  const state = clockOut(running("09:40", "17:00"), "17:30")
  const yesterday = Object.assign({}, state, { date: "2026-09-21" })
  assert.equal(applyStatus(yesterday, "stopped", at("08:00")).state.clockedOutAt, null)
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

test("scheitert das Einstempeln über REST, nennt das Panel die Ursache verständlich", () => {
  const fail = (code, extra) => applyStamp(emptyState(), "clock-in", { ok: false, error: Object.assign({ code, message: "raw" }, extra) }, at("08:00")).error
  assert.equal(fail("API_TERMINAL_MISSING"),
    "Einstempeln fehlgeschlagen: API Terminal fehlt in Calamari Clockin. Es wird nichts nachgereicht.")
  assert.equal(fail("API_SCOPE_MISSING"),
    "Einstempeln fehlgeschlagen: keine Berechtigung für den API-Key. Es wird nichts nachgereicht.")
  assert.equal(fail("API_KEY_REQUIRED"),
    "Einstempeln fehlgeschlagen: kein API-Key, bitte bin/calamari api-key ausführen. Es wird nichts nachgereicht.")
  assert.equal(fail("API_KEY_REJECTED"),
    "Einstempeln fehlgeschlagen: Calamari lehnt den API-Key ab. Es wird nichts nachgereicht.")
  assert.equal(fail("PROJECT_UNKNOWN", { project: "Kunde B" }),
    "Einstempeln fehlgeschlagen: Projekt „Kunde B“ gibt es in Calamari nicht. Es wird nichts nachgereicht.")
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

test("auch in der Minute des Einstempelns gilt, was Calamari meldet", () => {
  const state = clockIn(emptyState(), "11:21")
  const r = applyStatus(state, "stopped", at("11:21"))
  assert.equal(view(r.state, "11:21").kind, "idle")
})

test("solange eine Stempel-Erinnerung fällig ist, zeigt die Bar sie an", () => {
  const state = applyStatus(emptyState(), "stopped", at("09:10")).state
  assert.equal(barView({ state, now: at("09:10"), authState: "ok", failed: false, reminding: true }).kind, "reminder")
  assert.equal(barView({ state, now: at("09:10"), authState: "ok", failed: true, reminding: true }).kind, "error")
})

test("„Heute frei“ gilt nur für den Tag, an dem es gesetzt wurde", () => {
  const state = setDayOff(applyStatus(emptyState(), "stopped", at("08:00")).state, true, at("08:00"))
  assert.equal(dayOffToday(state, at("23:59")), true)
  // after midnight, even before the first poll of the new day
  assert.equal(dayOffToday(state, at("00:01", "2026-09-23")), false)
})

// Pause

const breakStart = (state, now) => applyStamp(state, "break-start", { ok: true, running: false }, at(now)).state

test("eine Pause stempelt aus, ist aber kein Feierabend, und die Bar zeigt ihre Dauer", () => {
  const state = breakStart(clockIn(emptyState(), "09:00"), "12:00")
  assert.equal(state.breakSince, "12:00")
  assert.equal(state.breakStartUnknown, false)
  assert.equal(state.clockedOutAt, null)
  assert.deepEqual(view(state, "12:12"), { kind: "break", text: "0:12" })
})

test("Pause beenden stempelt ein, und die Dauer zählt ab dann", () => {
  let state = breakStart(clockIn(emptyState(), "09:00"), "12:00")
  state = applyStamp(state, "break-end", { ok: true, running: true }, at("12:30")).state
  assert.equal(state.breakSince, null)
  assert.deepEqual(view(state, "12:31"), { kind: "running", text: "0:01" })
})

test("die Pause übersteht einen Neustart der Shell", () => {
  const state = breakStart(clockIn(emptyState(), "09:00"), "12:00")
  assert.deepEqual(view(restoreState(JSON.stringify(state)), "12:10"), { kind: "break", text: "0:10" })
})

test("wer die Pause im Web beendet, ist wieder in der Schicht", () => {
  const state = breakStart(clockIn(emptyState(), "09:00"), "12:00")
  const r = applyStatus(state, "running", at("12:40"))
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
  assert.deepEqual(helperCommand("break-start"), ["clock-out"])
  assert.deepEqual(helperCommand("break-end"), ["clock-in"])
  assert.deepEqual(helperCommand("clock-in"), ["clock-in"])
})

test("Einstempeln nennt dem Helper das Standard-Projekt, leer heißt seine Vorgabe", () => {
  assert.deepEqual(helperCommand("clock-in", "Kunde A"), ["clock-in", "--project", "Kunde A"])
  assert.deepEqual(helperCommand("break-end", "Check-in"), ["clock-in", "--project", "Check-in"])
  assert.deepEqual(helperCommand("clock-in", ""), ["clock-in"])
  assert.deepEqual(helperCommand("clock-in", "  "), ["clock-in"])
  assert.deepEqual(helperCommand("clock-in", " Kunde A "), ["clock-in", "--project", "Kunde A"])
  assert.deepEqual(helperCommand("clock-out", "Kunde A"), ["clock-out"])
  assert.deepEqual(helperCommand("break-start", "Kunde A"), ["clock-out"])
})

test("lief beim Ausstempeln gar keine Schicht, ist es kein Feierabend und das Panel sagt es", () => {
  const state = clockIn(emptyState(), "09:00")
  const r = applyStamp(state, "clock-out", { ok: true, running: false, stamped: false }, at("16:00"))
  assert.equal(r.state.clockedOutAt, null)
  assert.deepEqual(view(r.state, "16:00"), { kind: "idle", text: "" })
  assert.equal(r.error, "Ausstempeln: Calamari meldet keine laufende Schicht.")
  assert.equal(r.pollNow, true)
  assert.equal(workedMinutes(r.state, at("16:00")), 0)
})

test("lief beim Pausenbeginn gar keine Schicht, gibt es keine Pause", () => {
  const r = applyStamp(clockIn(emptyState(), "09:00"), "break-start", { ok: true, running: false, stamped: false }, at("12:00"))
  assert.deepEqual(view(r.state, "12:00"), { kind: "idle", text: "" })
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

test("lief gestern zuletzt eine Schicht, fragt das Plugin morgens nach dem Ende des Vortags", () => {
  const yesterday = applyStatus(emptyState(), "running", at("17:00", "2026-09-21")).state
  assert.equal(pendingDayEnd(yesterday, at("07:30")), "2026-09-21")
  // Still yesterday: nothing to ask, the shift is simply running.
  assert.equal(pendingDayEnd(yesterday, at("17:05", "2026-09-21")), null)
  const idleYesterday = applyStatus(emptyState(), "stopped", at("17:00", "2026-09-21")).state
  assert.equal(pendingDayEnd(idleYesterday, at("07:30")), null)
})

test("die Frage nach dem Vortag übersteht den Tageswechsel im Zustand", () => {
  const yesterday = applyStatus(emptyState(), "running", at("17:00", "2026-09-21")).state
  // A poll of the new day rolls the state over before the answer arrives.
  const today = applyStatus(yesterday, "stopped", at("07:30")).state
  assert.equal(pendingDayEnd(today, at("07:33")), "2026-09-21")
  const answered = applyDayEnd(today, "2026-09-21", false, at("07:33")).state
  assert.equal(pendingDayEnd(answered, at("07:40")), null)
})

test("lief die Schicht bis zum Tagesende, bittet ein Hinweis um die Korrektur der Endzeit", () => {
  let state = applyStatus(emptyState(), "running", at("17:00", "2026-09-21")).state
  state = setIdle(state, true, at("18:00", "2026-09-21"), 300)
  const r = applyDayEnd(state, "2026-09-21", true, at("07:30"))
  assert.deepEqual(r.notice, { type: "day-end-closed", date: "2026-09-21", lastActivity: "2026-09-21T17:55" })
  assert.equal(r.state.running, null)
  assert.equal(r.state.stampedToday, false)
})

test("hat der Benutzer gestern selbst ausgestempelt, kommt kein Hinweis", () => {
  const state = applyStatus(emptyState(), "running", at("17:00", "2026-09-21")).state
  assert.equal(applyDayEnd(state, "2026-09-21", false, at("07:30")).notice, null)
})

test("eine letzte Aktivität von heute gehört nicht in den Hinweis für gestern", () => {
  // Woke up at 07:30 and walked away before the answer came back.
  let state = applyStatus(emptyState(), "running", at("17:00", "2026-09-21")).state
  state = setIdle(state, true, at("07:40"), 300)
  assert.equal(applyDayEnd(state, "2026-09-21", true, at("07:45")).notice.lastActivity, null)
})

test("wer wieder da war und weitergearbeitet hat, bekommt den Hinweis ohne Uhrzeit", () => {
  // Away at lunch, back at 13:00: 12:30 is no end time for that day.
  let state = applyStatus(emptyState(), "running", at("09:00", "2026-09-21")).state
  state = setIdle(state, true, at("12:35", "2026-09-21"), 300)
  state = setIdle(state, false, at("13:00", "2026-09-21"), 300)
  assert.equal(applyDayEnd(state, "2026-09-21", true, at("07:30")).notice.lastActivity, null)
})

test("eine Antwort auf eine andere Frage ändert nichts", () => {
  const state = applyStatus(emptyState(), "running", at("17:00", "2026-09-21")).state
  const r = applyDayEnd(state, "2026-09-20", true, at("07:30"))
  assert.equal(r.notice, null)
  assert.equal(r.state, state)
})

// Gesamtzeit heute (beobachtet)

test("die Gesamtzeit heute zählt beendete und laufende Schichten, auch vor einer Pause", () => {
  let state = clockIn(applyStatus(emptyState(), "stopped", at("08:55")).state, "09:00")
  state = breakStart(state, "12:00")
  state = applyStamp(state, "break-end", { ok: true, running: true }, at("12:30")).state
  assert.equal(workedMinutes(state, at("13:00")), 180 + 30)
  state = clockOut(state, "16:30")
  assert.equal(workedMinutes(state, at("18:00")), 180 + 240)
})

test("eine im Web beendete Schicht wird mit ihrem Ende nachgetragen", () => {
  let state = applyStartTime(applyStatus(emptyState(), "running", at("10:00")).state, "09:40")
  const r = applyStatus(state, "stopped", at("12:03"))
  assert.deepEqual(r.endTimeQuery, { after: "09:40" })
  state = applyEndTime(r.state, "09:40", "12:00")
  assert.equal(workedMinutes(state, at("12:05")), 140)
})

test("ohne bekannten Beginn wird kein Ende gesucht", () => {
  const state = applyStatus(emptyState(), "running", at("10:00")).state
  assert.equal(applyStatus(state, "stopped", at("12:03")).endTimeQuery, null)
})

test("eine eigene Stempelung braucht keine Suche nach dem Ende", () => {
  const state = clockOut(clockIn(emptyState(), "09:00"), "12:00")
  assert.equal(applyStatus(state, "stopped", at("12:05")).endTimeQuery, null)
})

test("die Gesamtzeit übersteht einen Neustart und beginnt am nächsten Tag neu", () => {
  const state = restoreState(JSON.stringify(clockOut(clockIn(emptyState(), "09:00"), "12:00")))
  assert.equal(workedMinutes(state, at("13:00")), 180)
  const tomorrow = applyStatus(state, "stopped", at("08:00", "2026-09-23")).state
  assert.equal(workedMinutes(tomorrow, at("08:00", "2026-09-23")), 0)
})

test("die Schicht vom Vortag zählt nicht zur Gesamtzeit heute", () => {
  const yesterday = applyStatus(emptyState(), "running", at("22:00", "2026-09-21")).state
  const state = applyDayEnd(yesterday, "2026-09-21", true, at("07:30")).state
  assert.equal(workedMinutes(state, at("08:00")), 0)
})

test("das Panel nennt die beobachtete Gesamtzeit heute, sobald es eine gibt", () => {
  assert.equal(workedText(clockIn(emptyState(), "09:00"), at("09:00")), "")
  assert.equal(workedText(clockOut(clockIn(emptyState(), "09:00"), "12:05"), at("13:00")), "Heute gearbeitet (beobachtet): 3:05")
})

test("scheitert die Suche nach dem Ende, versucht es die nächste Abfrage erneut", () => {
  const state = applyStartTime(applyStatus(emptyState(), "running", at("10:00")).state, "09:40")
  const first = applyStatus(state, "stopped", at("12:03"))
  // end-time failed: nothing applied; the next poll asks again.
  const again = applyStatus(first.state, "stopped", at("12:06"))
  assert.deepEqual(again.endTimeQuery, { after: "09:40" })
  const done = applyEndTime(again.state, "09:40", "12:00")
  assert.equal(applyStatus(done, "stopped", at("12:09")).endTimeQuery, null)
  assert.equal(workedMinutes(done, at("12:10")), 140)
})

test("findet die Suche kein Ende, wird nicht weiter gesucht", () => {
  const state = applyStartTime(applyStatus(emptyState(), "running", at("10:00")).state, "09:40")
  const r = applyStatus(state, "stopped", at("12:03"))
  const none = applyEndTime(r.state, "09:40", null)
  assert.equal(applyStatus(none, "stopped", at("12:06")).endTimeQuery, null)
})

test("eine Antwort auf die Suche vom Vortag ändert den neuen Tag nicht", () => {
  const state = applyStartTime(applyStatus(emptyState(), "running", at("22:00", "2026-09-21")).state, "21:40")
  const r = applyStatus(state, "stopped", at("23:59", "2026-09-21"))
  const tomorrow = applyStatus(r.state, "stopped", at("00:05")).state
  assert.equal(workedMinutes(applyEndTime(tomorrow, "21:40", "23:50"), at("00:10")), 0)
})

// Pause, die Calamari meldet (im Web, auf dem Handy)

const seenBreak = (begun, now) => applyStatus(running(begun, now), "break", at(now)).state

test("eine fremde Pause unterbricht die Schicht, beendet sie aber nicht", () => {
  const state = seenBreak("09:00", "12:10")
  assert.equal(state.running, true)
  assert.equal(state.onBreak, true)
  assert.equal(state.startedAt, "09:00")
  assert.equal(state.clockedOutAt, null)
  assert.equal(state.breakSince, "12:10")
  // ... but that is only when the plugin first saw it.
  assert.equal(state.breakStartUnknown, true)
})

test("eine fremde Pause zeigt die Bar als Pause, gezählt ab dem ersten Sehen", () => {
  let state = seenBreak("09:00", "12:10")
  state = applyStatus(state, "break", at("12:25")).state
  assert.equal(state.breakSince, "12:10")
  assert.deepEqual(view(state, "12:25"), { kind: "break", text: "0:15" })
  assert.equal(stampAction(view(state, "12:25")), "break-end")
})

test("endet die fremde Pause, läuft die Schicht mit ihrer Startzeit weiter", () => {
  const r = applyStatus(seenBreak("09:00", "12:10"), "running", at("12:40"))
  assert.equal(r.state.onBreak, false)
  assert.equal(r.state.breakSince, null)
  assert.equal(r.startTimeQuery, null)
  assert.deepEqual(view(r.state, "12:40"), { kind: "running", text: "3:40" })
})

test("endet die Schicht aus der fremden Pause heraus, ist keine Pause mehr und ihr Ende wird gesucht", () => {
  const r = applyStatus(seenBreak("09:00", "12:10"), "stopped", at("12:40"))
  assert.equal(r.state.running, false)
  assert.equal(r.state.onBreak, false)
  assert.equal(r.state.breakSince, null)
  assert.deepEqual(r.endTimeQuery, { after: "09:00" })
  assert.equal(view(r.state, "12:40").kind, "idle")
})

test("eine Pause, die das Plugin schon beim Start vorfindet, braucht die Startzeit der Schicht", () => {
  const r = applyStatus(emptyState(), "break", at("12:10"))
  assert.deepEqual(r.startTimeQuery, { after: null })
  assert.equal(r.state.breakSince, "12:10")
  assert.equal(r.state.stampedToday, true)
})

test("die fremde Pause übersteht einen Neustart der Shell", () => {
  const state = restoreState(JSON.stringify(seenBreak("09:00", "12:10")))
  assert.equal(state.onBreak, true)
  assert.deepEqual(view(state, "12:20"), { kind: "break", text: "0:10" })
})

test("eine Pause über Mitternacht zählt wie eine laufende Schicht als offener Tag", () => {
  const yesterday = seenBreak("20:00", "23:30")
  const r = applyStatus(Object.assign({}, yesterday, { date: "2026-09-21" }), "stopped", at("08:00"))
  assert.equal(r.state.onBreak, false)
  assert.equal(r.state.breakSince, null)
  assert.equal(r.state.unclosed, "2026-09-21")
})

test("die Zeit einer fremden Pause zählt nicht zur Gesamtzeit heute", () => {
  const state = seenBreak("09:00", "12:00")
  assert.equal(workedMinutes(state, at("12:30")), 180)
})

test("aus einer fremden Pause bietet das Panel keinen Feierabend ohne Stempeln an", () => {
  const state = seenBreak("09:00", "12:10")
  assert.equal(feierabendAction(view(state, "12:20"), state), null)
  assert.equal(endBreakAsFeierabend(state, at("12:20")), state)
})

test("nach einer fremden Pause zählt ihre Zeit weiter nicht zur Gesamtzeit heute", () => {
  let state = seenBreak("09:00", "12:00")
  state = applyStatus(state, "running", at("12:30")).state
  assert.equal(workedMinutes(state, at("13:00")), 210)
  state = applyStatus(state, "break", at("14:00")).state
  state = applyStatus(state, "stopped", at("14:10")).state
  // The shift ended in its second Pause; end-time adds it from 09:00 to 14:05.
  state = applyEndTime(state, "09:00", "14:05")
  assert.equal(workedMinutes(state, at("15:00")), 305 - 30 - 10)
})

test("meldet Calamari nach Pause beenden weiter eine Pause, zählt sie ab ihrem ersten Sehen weiter", () => {
  let state = applyStamp(seenBreak("09:00", "12:10"), "break-end", { ok: true, running: true }, at("12:30")).state
  state = applyStatus(state, "break", at("12:33")).state
  assert.deepEqual(view(state, "12:40"), { kind: "break", text: "0:30" })
})

test("die Pause nennt ihren Beginn, oder dass er nicht bekannt ist", () => {
  assert.equal(breakSinceText(breakStart(clockIn(emptyState(), "09:00"), "12:00")), "12:00")
  assert.equal(breakSinceText(seenBreak("09:00", "12:10")), "spätestens 12:10")
})

test("Pause beenden aus einer fremden Pause behält die Startzeit der Schicht", () => {
  const r = applyStamp(seenBreak("09:00", "12:10"), "break-end", { ok: true, running: true }, at("12:30"))
  assert.equal(r.state.startedAt, "09:00")
  assert.equal(r.state.onBreak, false)
  assert.equal(view(r.state, "12:31").kind, "running")
})
