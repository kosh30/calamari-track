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
//   stoppedAt  HH:MM of the last own clock-out of any kind (status lag)
//   unclosed   YYYY-MM-DD of a day the plugin left with a running shift,
//              until `day-end` said how that day ended (pendingDayEnd)
//   shifts     [{ start, end }] HH:MM of today's ended shifts the plugin saw
//              (the observed total of today, see workedMinutes)
//   pendingEnd HH:MM start of a shift that ended outside the plugin and
//              whose end `end-time` still has to find
//   stampedToday  true once a shift of today was seen running
//   dayOff     true after the panel switch "Heute frei" (today only)
//   postponedTo  HH:MM the next final warning was moved to by "+1 h"
//              (js/reminders.mjs postpone)
//   sent       { reminder type: HH:MM last sent today }, see js/reminders.mjs
//   lastSeen, idle, awaySince, awayUntil  the user's activity, see
//              js/activity.mjs; unlike the rest they carry over to the
//              next day
//
// Known limit: the start of a follow-up shift is only found if the plugin
// saw the gap before it (searchAfter). A break the plugin never observed (shell
// off, suspend) leaves the cached start of the earlier shift.

import { awayCovers, lastActivity } from "./activity.mjs"
import { minuteOfDay, pad, toHhmm, toMinutes, ymd } from "./daytime.mjs"

// `status` looks back this many minutes, so a shift that just ended can
// still look running for that long.
const STATUS_WINDOW = 2

export function emptyState() {
  return { date: "", running: null, startedAt: null, searchAfter: null, clockedOutAt: null, breakSince: null, stoppedAt: null, unclosed: null, stampedToday: false, dayOff: false, postponedTo: null, sent: {}, shifts: [], pendingEnd: null,
    lastSeen: null, idle: false, awaySince: null, awayUntil: null }
}

function forToday(state, now) {
  const today = ymd(now)
  if (state && state.date === today) return Object.assign({}, state)
  // A new day: yesterday's polls say nothing about today, and no shift
  // survives midnight (Calamari ends an open one at 23:59), so the status
  // is unknown again. A day left with a running shift is noted for
  // pendingDayEnd; when the user was last active still holds.
  const carried = emptyState()
  for (const key of ["lastSeen", "idle", "awaySince", "awayUntil"])
    if (state && key in state) carried[key] = state[key]
  if (state && state.running === true && state.date) carried.unclosed = state.date
  else if (state && state.unclosed) carried.unclosed = state.unclosed
  return Object.assign(carried, { date: today })
}

// Applies an answer of `status`. Returns { state, startTimeQuery,
// endTimeQuery }: startTimeQuery is null or { after: "HH:MM" | null }, the
// --after argument for `start-time` when the start of the running shift is
// unknown; endTimeQuery is null or { after: "HH:MM" }, for `end-time` when
// a shift of known start ended outside the plugin (web, phone).
export function applyStatus(state, running, now) {
  const next = forToday(state, now)
  const before = { running: next.running, startedAt: next.startedAt }
  // Right after the own clock-out (Feierabend, Pause) the ended shift still
  // overlaps the status window; the clock-out is the newer truth.
  if (running && next.stoppedAt && minuteOfDay(now) - toMinutes(next.stoppedAt) <= STATUS_WINDOW)
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
    // A shift of known start ended outside the plugin (web, phone); asked
    // again on every poll until end-time answered.
    if (before.running === true && before.startedAt) next.pendingEnd = before.startedAt
    return { state: next, startTimeQuery: null, endTimeQuery: next.pendingEnd ? { after: next.pendingEnd } : null }
  }
  // A shift runs again (stamped in the web or on the phone): the
  // Feierabend or the Pause is over.
  next.clockedOutAt = null
  next.breakSince = null
  next.stampedToday = true
  if (next.startedAt) return { state: next, startTimeQuery: null, endTimeQuery: null }
  return { state: next, startTimeQuery: { after: next.searchAfter }, endTimeQuery: null }
}

// Records the answer of `end-time` (end: HH:MM or null if none was found)
// for the pending shift that began at start. An answer for another search
// (e.g. from before midnight) changes nothing.
export function applyEndTime(state, start, end) {
  if (state.pendingEnd !== start) return state
  const next = Object.assign({}, state, { pendingEnd: null })
  return end && toMinutes(end) >= toMinutes(start) ? addShift(next, start, end) : next
}

function addShift(state, start, end) {
  return Object.assign(state, { shifts: state.shifts.concat([{ start, end }]) })
}

// The panel's line for the observed total of today ("" before any).
export function workedText(state, now) {
  const minutes = workedMinutes(state, now)
  return minutes > 0 ? `Heute gearbeitet (beobachtet): ${Math.floor(minutes / 60)}:${pad(minutes % 60)}` : ""
}

// Minutes worked today as far as the plugin saw: its ended shifts plus
// the running one.
export function workedMinutes(state, now) {
  if (state.date !== ymd(now)) return 0
  let total = 0
  for (const shift of state.shifts) total += toMinutes(shift.end) - toMinutes(shift.start)
  if (state.running && state.startedAt)
    total += Math.max(minuteOfDay(now) - toMinutes(state.startedAt), 0)
  return total
}

// The minute Calamari ends an open shift in (docs/adr/0002); the day-end
// question asks whether the shift still reached it.
const CLOSE_MOMENT = "T23:58"

// The date to ask `day-end` for: a day the plugin left with a running
// shift, until the answer came. Null when there is nothing to ask.
export function pendingDayEnd(state, now) {
  if (state.date && state.date !== ymd(now) && state.running === true) return state.date
  return state.unclosed || null
}

// Records the answer of `day-end` for that date and returns { state,
// notice }. A shift that ran to the end of the day was ended by Calamari
// at 23:59, not by the user, so its end time is wrong: the notice asks for
// the correction (js/reminders.mjs notification). One the user ended
// themselves needs nothing. An answer to another question changes nothing.
export function applyDayEnd(state, date, ranToMidnight, now) {
  if (pendingDayEnd(state, now) !== date) return { state, notice: null }
  const next = Object.assign(forToday(state, now), { unclosed: null })
  if (!ranToMidnight) return { state: next, notice: null }
  // The last activity is an end time only if the user was away while
  // Calamari closed. Someone who came back and kept working gets the hint
  // without one: their earlier absence says nothing about the end.
  const away = awayCovers(state, date + CLOSE_MOMENT) ? lastActivity(state) : null
  return { state: next, notice: { type: "day-end-closed", date, lastActivity: away } }
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
  // The own clock-out knows the end of today's shift right away.
  if (next.running && next.startedAt) addShift(next, next.startedAt, toHhmm(minute))
  // The ended shift reaches into the minute of the clock-out.
  return Object.assign(next, {
    running: false, startedAt: null, clockedOutAt: null, breakSince: null,
    stoppedAt: toHhmm(minute), searchAfter: toHhmm(Math.min(minute + 1, 24 * 60 - 1)),
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
// the local mark, its end a clock-in (ADR 0001). A clock-in names the
// default project (the setting defaultProject); empty leaves the helper's.
export function helperCommand(action, project) {
  if (action === "break-start") return ["clock-out"]
  if (action !== "clock-in" && action !== "break-end") return [action]
  const name = (project || "").trim()
  return name ? ["clock-in", "--project", name] : ["clock-in"]
}
const STAMP_CAUSES = {
  NETWORK: "Calamari nicht erreichbar",
  RATE_LIMITED: "zu viele Anfragen, bitte gleich erneut versuchen",
  AUTH_REQUIRED: "Anmeldung nötig",
  // The REST API of the clock-in (ADR 0003).
  API_TERMINAL_MISSING: "API Terminal fehlt in Calamari Clockin",
  API_SCOPE_MISSING: "keine Berechtigung für den API-Key",
  API_KEY_REQUIRED: "kein API-Key, bitte bin/calamari api-key ausführen",
  API_KEY_REJECTED: "Calamari lehnt den API-Key ab",
}

function stampErrorText(action, error) {
  const cause = error.code === "PROJECT_UNKNOWN" ? `Projekt „${error.project}“ gibt es in Calamari nicht`
    : STAMP_CAUSES[error.code] || error.message || error.code
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
    return { state, error: stampErrorText(action, out.error), pollNow: out.error.code !== "RATE_LIMITED" }
  }
  if (helperCommand(action)[0] === "clock-out" && out.stamped === false) {
    // No shift ran, so nothing was stamped: no Feierabend, no Pause, and
    // nothing to correct; look again.
    return {
      state: stopShift(Object.assign({}, state, { running: false }), now),
      error: `${STAMP_ACTIONS[action]}: Calamari meldet keine laufende Schicht.`,
      pollNow: true,
    }
  }
  if (helperCommand(action)[0] === "clock-out") {
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
