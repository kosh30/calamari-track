import { test } from "node:test"
import assert from "node:assert/strict"
import { applyStatus, applyStartTime, barView, emptyState, restoreState } from "./shiftclock.mjs"

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
