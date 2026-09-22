import { test } from "node:test"
import assert from "node:assert/strict"
import { heartbeat, lastActivity, setIdle } from "./activity.mjs"
import { applyStatus, emptyState, restoreState } from "./shiftclock.mjs"

const at = (hhmm, date = "2026-09-22") => new Date(`${date}T${hhmm}:00`)
const running = now => applyStatus(emptyState(), true, at(now)).state

test("nach einer Heartbeat-Lücke über 5 Minuten gilt der Heartbeat davor als letzte Aktivität", () => {
  let state = heartbeat(heartbeat(running("17:00"), at("17:58")), at("17:59"))
  // Lid closed at 17:59:30, opened next morning.
  state = heartbeat(state, at("07:30", "2026-09-23"))
  assert.equal(lastActivity(state), "2026-09-22T17:59")
})

test("bei Leerlauf ist die letzte Aktivität der Beginn des Leerlaufs, auch über einen Suspend", () => {
  let state = heartbeat(running("17:00"), at("17:30"))
  // The idle monitor fires after the lock timeout of 300 s.
  state = setIdle(state, true, at("17:35"), 300)
  state = heartbeat(heartbeat(state, at("17:36")), at("17:50"))
  state = heartbeat(state, at("07:30", "2026-09-23"))
  assert.equal(lastActivity(state), "2026-09-22T17:30")
})

test("eine kurze Lücke ist kein Suspend", () => {
  let state = heartbeat(heartbeat(running("17:00"), at("17:00")), at("17:04"))
  assert.equal(lastActivity(state), null)
})

test("die letzte Aktivität übersteht einen Neustart der Shell und den Tageswechsel", () => {
  let state = heartbeat(heartbeat(running("17:00"), at("17:59")), at("07:30", "2026-09-23"))
  state = restoreState(JSON.stringify(state))
  state = applyStatus(state, true, at("07:31", "2026-09-23")).state
  assert.equal(lastActivity(state), "2026-09-22T17:59")
})

test("wer aus dem Leerlauf zurückkommt, ist wieder aktiv", () => {
  let state = setIdle(running("17:00"), true, at("17:35"), 300)
  state = setIdle(state, false, at("17:40"), 300)
  assert.equal(state.idle, false)
  assert.equal(lastActivity(state), "2026-09-22T17:30")
})

test("wer nach dem Aufwachen tippt, bevor der erste Heartbeat kommt, behält den Beginn des Leerlaufs", () => {
  let state = heartbeat(running("17:00"), at("17:30"))
  state = setIdle(state, true, at("17:35"), 300)
  state = heartbeat(state, at("17:50"))
  // Suspend; next morning the key press arrives before the tick.
  state = setIdle(state, false, at("07:30", "2026-09-23"), 300)
  state = heartbeat(state, at("07:30", "2026-09-23"))
  assert.equal(lastActivity(state), "2026-09-22T17:30")
})
