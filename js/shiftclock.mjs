// Pure logic behind the shift status in the bar: what the service keeps in
// its local state, when it must ask the helper for the start time, and what
// the bar shows. No Qt; tested with `node --test js/`.
//
// State (persisted by the service):
//   date       YYYY-MM-DD the state belongs to
//   running    last known answer of `status` (null before the first one)
//   startedAt  HH:MM start of the running shift, cached until it ends
//   searchAfter  HH:MM from which no earlier shift of today reaches on:
//              the --after of the next start-time search. Set by a poll
//              that saw no shift and by the own clock-out.
//   clockedOutAt  HH:MM of the own clock-out that began the Feierabend today
//   breakSince HH:MM of the own clock-out that began the running Pause
//   stampedToday  true once a shift of today was seen running
//   dayOff     true after the panel switch "Heute frei" (today only)
//   postponedTo  HH:MM the next final warning was moved to by "+1 h"
//              (js/reminders.mjs postpone)
//   sent       { reminder type: HH:MM last sent today }, see js/reminders.mjs
//
// Known limit: the start of a follow-up shift is only found if the plugin
// saw the gap before it (searchAfter). A break the plugin never observed (shell
// off, suspend) leaves the cached start of the earlier shift.

import { minuteOfDay, pad, toHhmm, toMinutes, ymd } from "./daytime.mjs"

// `status` looks back this many minutes, so a shift that just ended can
// still look running for that long.
const STATUS_WINDOW = 2

export function emptyState() {
  return { date: "", running: null, startedAt: null, searchAfter: null, clockedOutAt: null, breakSince: null, stampedToday: false, dayOff: false, postponedTo: null, sent: {} }
}

function forToday(state, now) {
  const today = ymd(now)
  if (state && state.date === today) return Object.assign({}, state)
  // A new day: yesterday's polls say nothing about today's shift.
  return Object.assign(emptyState(), { date: today, running: state ? state.running : null })
}

// Applies an answer of `status`. Returns { state, startTimeQuery }, where
// startTimeQuery is null or { after: "HH:MM" | null }, the --after argument
// for `start-time` when the start of the running shift is unknown.
export function applyStatus(state, running, now) {
  const next = forToday(state, now)
  // Right after the own clock-out (Feierabend or Pause) the ended shift
  // still overlaps the status window; the clock-out is the newer truth.
  const stoppedAt = next.clockedOutAt || next.breakSince
  if (running && stoppedAt && minuteOfDay(now) - toMinutes(stoppedAt) <= STATUS_WINDOW)
    running = false
  // In the minute of the own clock-in the status window, which ends at the
  // full minute, cannot see the new shift yet. (A start found by start-time
  // always lies in an earlier minute.)
  if (!running && next.running && next.startedAt && minuteOfDay(now) === toMinutes(next.startedAt))
    running = true
  next.running = running
  if (!running) {
    next.startedAt = null
    // No shift overlapped the window, so any earlier one ended before it.
    next.searchAfter = laterOf(next.searchAfter, toHhmm(Math.max(minuteOfDay(now) - STATUS_WINDOW, 0)))
    return { state: next, startTimeQuery: null }
  }
  // A shift runs again (stamped in the web or on the phone): the
  // Feierabend or the Pause is over.
  next.clockedOutAt = null
  next.breakSince = null
  next.stampedToday = true
  if (next.startedAt) return { state: next, startTimeQuery: null }
  return { state: next, startTimeQuery: { after: next.searchAfter } }
}

function laterOf(a, b) {
  return a && toMinutes(a) > toMinutes(b) ? a : b
}

// Parses the persisted state; anything unreadable starts empty.
export function restoreState(text) {
  try {
    const saved = JSON.parse(text)
    if (saved && typeof saved === "object" && !Array.isArray(saved)) {
      const state = emptyState()
      for (const key of Object.keys(state))
        if (key in saved) state[key] = saved[key]
      return state
    }
  } catch (e) {
    // First run or a torn file.
  }
  return emptyState()
}

// The own clock-in succeeded and Calamari sees the shift: it started now,
// and a Feierabend earlier today is over.
function applyClockIn(state, now) {
  const next = forToday(state, now)
  const minute = toHhmm(minuteOfDay(now))
  return Object.assign(next, { running: true, startedAt: minute, clockedOutAt: null, breakSince: null, stampedToday: true })
}

// The own clock-out succeeded: no shift runs.
function stopShift(state, now) {
  const next = forToday(state, now)
  const minute = minuteOfDay(now)
  // The ended shift reaches into the minute of the clock-out.
  return Object.assign(next, {
    running: false, startedAt: null, clockedOutAt: null, breakSince: null,
    searchAfter: toHhmm(Math.min(minute + 1, 24 * 60 - 1)),
  })
}

// Ausstempeln: it is Feierabend.
function applyClockOut(state, now) {
  return Object.assign(stopShift(state, now), { clockedOutAt: toHhmm(minuteOfDay(now)) })
}

// Pause beginnen: a clock-out that is no Feierabend (ADR 0001: Calamari
// only sees the gap).
function applyBreakStart(state, now) {
  return Object.assign(stopShift(state, now), { breakSince: toHhmm(minuteOfDay(now)) })
}

// Going home straight from a Pause: nothing to stamp (the shift already
// ended when the Pause began), so the Feierabend starts back then.
export function endBreakAsFeierabend(state, now) {
  const next = forToday(state, now)
  if (!next.breakSince || next.running) return state
  return Object.assign(next, { clockedOutAt: next.breakSince, breakSince: null })
}

// The panel switch "Heute frei". Like everything in the state it belongs
// to today and is gone tomorrow.
export function setDayOff(state, on, now) {
  return Object.assign(forToday(state, now), { dayOff: on })
}

// Whether "Heute frei" is on for the day of now; a switch from yesterday
// no longer counts, even before the first poll of the new day.
export function dayOffToday(state, now) {
  return state.dayOff === true && state.date === ymd(now)
}

export function applyStartTime(state, startedAt) {
  return Object.assign({}, state, { startedAt })
}

// kind: "auth" (login needed), "error", "unknown", "running", "break",
// "reminder" (a stamp reminder is due, see js/reminders.mjs) or "idle";
// text: the duration H:MM of the running shift (once its start is known)
// or of the Pause.
export function barView({ state, now, authState, failed, reminding }) {
  if (authState === "required") return { kind: "auth", text: "" }
  if (failed) return { kind: "error", text: "" }
  if (!state || state.running === null) return { kind: "unknown", text: "" }
  if (!state.running && state.breakSince) return { kind: "break", text: duration(state.breakSince, now) }
  if (!state.running) return { kind: reminding ? "reminder" : "idle", text: "" }
  if (!state.startedAt) return { kind: "running", text: "" }
  return { kind: "running", text: duration(state.startedAt, now) }
}

function duration(since, now) {
  const minutes = Math.max(minuteOfDay(now) - toMinutes(since), 0)
  return `${Math.floor(minutes / 60)}:${pad(minutes % 60)}`
}

const STAMP_ACTIONS = {
  "clock-in": "Einstempeln", "clock-out": "Ausstempeln",
  "break-start": "Pause beginnen", "break-end": "Pause beenden",
}

// The panel's button text for a stamp action.
export function stampLabel(action) {
  return STAMP_ACTIONS[action]
}

// The helper command behind a stamp action: a Pause is a clock-out plus
// the local mark, its end a clock-in (ADR 0001).
export function helperCommand(action) {
  return action === "break-start" ? "clock-out" : action === "break-end" ? "clock-in" : action
}
const STAMP_CAUSES = {
  NETWORK: "Calamari nicht erreichbar",
  RATE_LIMITED: "zu viele Anfragen, bitte gleich erneut versuchen",
  AUTH_REQUIRED: "Anmeldung nötig",
}

function stampErrorText(action, code, message) {
  const cause = STAMP_CAUSES[code] || message || code
  return `${STAMP_ACTIONS[action]} fehlgeschlagen: ${cause}. Es wird nichts nachgereicht.`
}

// The stamp action the panel offers for a bar view: "clock-out" while a
// shift runs, "break-end" in a Pause, "clock-in" without a shift (reminded
// or not), null while the status is not known.
export function stampAction(view) {
  if (view.kind === "running") return "clock-out"
  if (view.kind === "break") return "break-end"
  if (view.kind === "idle" || view.kind === "reminder") return "clock-in"
  return null
}

// The Pause the panel offers beside stampAction(): only during a shift.
export function breakAction(view) {
  return view.kind === "running" ? "break-start" : null
}

// "end-break" (endBreakAsFeierabend) the panel offers during a Pause.
export function feierabendAction(view) {
  return view.kind === "break" ? "end-break" : null
}

// Applies an answer of `clock-in` / `clock-out` for a stamp action.
// Returns { state, error, pollNow }: error is the panel's line ("" when
// all is well). A failure keeps the state, so the user can retry; nothing
// is queued. Its outcome is unknown (a timeout may have stamped anyway),
// so pollNow asks Calamari right away, unless it is throttling us.
export function applyStamp(state, action, out, now) {
  if (!out.ok) {
    const { code, message } = out.error
    return { state, error: stampErrorText(action, code, message), pollNow: code !== "RATE_LIMITED" }
  }
  if (helperCommand(action) === "clock-out") {
    const next = action === "break-start" ? applyBreakStart(state, now) : applyClockOut(state, now)
    return { state: next, error: "", pollNow: false }
  }
  if (out.running) return { state: applyClockIn(state, now), error: "", pollNow: false }
  // Calamari took the clock-in but shows no shift: say so, and look again.
  return {
    state: applyStatus(state, false, now).state,
    error: `${STAMP_ACTIONS[action]}: Calamari meldet keine laufende Schicht. Bitte im Web prüfen.`,
    pollNow: true,
  }
}
