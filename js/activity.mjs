// The user's last activity, for the correction hints after an auto-close:
// the start of the idle time (Quickshell's idle monitor with the lock
// timeout) or, across a suspend, the last heartbeat before the gap. No Qt;
// tested with `node --test js/`.
//
// State fields (persisted with the shift state, kept across days):
//   lastSeen   YYYY-MM-DDTHH:MM of the last heartbeat
//   idle       true while the idle monitor says so
//   awaySince  YYYY-MM-DDTHH:MM the latest absence began (null before any)

import { fromMoment, momentOf } from "./daytime.mjs"

// A longer silence between two heartbeats means the machine slept.
const SUSPEND_GAP_MINUTES = 5

// Called on every tick of the service (15 s), recorded to the minute. A
// heartbeat after a gap does not count as activity yet: the absence it ends
// is what the next close reports.
export function heartbeat(state, now) {
  const seen = momentOf(now)
  if (state.lastSeen === seen) return state
  const next = Object.assign({}, state, { lastSeen: seen })
  const gap = state.lastSeen ? (now - fromMoment(state.lastSeen)) / 60000 : 0
  if (gap > SUSPEND_GAP_MINUTES && !state.idle) next.awaySince = state.lastSeen
  return next
}

// The idle monitor reports idle `timeoutSeconds` after the last input.
// Coming back from idle is activity now, so a suspend gap it ends (the key
// press may beat the first tick after waking) keeps the idle start.
export function setIdle(state, idle, now, timeoutSeconds) {
  if (!idle) return state.idle ? Object.assign({}, state, { idle: false, lastSeen: momentOf(now) }) : state
  const since = new Date(now.getTime() - timeoutSeconds * 1000)
  return Object.assign({}, state, { idle: true, awaySince: momentOf(since) })
}

// YYYY-MM-DDTHH:MM the latest absence began, or null if none is known.
export function lastActivity(state) {
  return state.awaySince || null
}
