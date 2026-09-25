// Pure logic behind the shift status in the bar: what the service keeps in
// its local state, when it must ask the helper for the start time, and what
// the bar shows. No Qt; tested with `node --test js/`.
//
// State (persisted by the service):
//   date       YYYY-MM-DD the state belongs to
//   running    whether a shift runs in Calamari, in a Pause too (null
//              before the first answer of `status`)
//   onBreak    true while the running shift is in a Pause (own or from
//              the web, phone); the shift and its start stay
//   startedAt  HH:MM start of the running shift, cached until it ends
//   searchAfter  HH:MM from which no earlier shift of today reaches on:
//              the --after of the next start-time search. Set by a poll
//              that saw no shift and by the own clock-out.
//   clockedOutAt  HH:MM of the own clock-out that began the Feierabend today
//   breakSince HH:MM start of the running Pause: the own break-start,
//              Calamari's entry, or else the poll that first saw it
//   breakStartUnknown  true when breakSince is only that first sight: the
//              real start of the Pause is unknown
//   breakMinutes  minutes of today's ended Pauses (they are in the
//              shifts' spans, but no work)
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
// Known limit: when `status` cannot read the running shift's start from
// Calamari, the start of a follow-up shift is only found if the plugin saw
// the gap before it (searchAfter); a gap it never observed (shell off,
// suspend) leaves the cached start of the earlier shift.

import { awayCovers, lastActivity } from "./activity.mjs"
import { minuteOfDay, pad, toHhmm, toMinutes, ymd } from "./daytime.mjs"

export function emptyState() {
  return {
    date: "",
    running: null,
    onBreak: false,
    startedAt: null,
    searchAfter: null,
    clockedOutAt: null,
    breakSince: null,
    breakStartUnknown: false,
    breakMinutes: 0,
    unclosed: null,
    stampedToday: false,
    dayOff: false,
    postponedTo: null,
    sent: {},
    shifts: [],
    pendingEnd: null,
    lastSeen: null,
    idle: false,
    awaySince: null,
    awayUntil: null,
  }
}

function forToday(state, now) {
  const today = ymd(now)
  if (state && state.date === today) return Object.assign({}, state)
  // A new day: yesterday's polls say nothing about today, and no shift
  // survives midnight (Calamari ends an open one at 23:59), so the status
  // is unknown again. A day left with a running shift is noted for
  // pendingDayEnd; when the user was last active still holds.
  const carried = emptyState()
  for (const key of ["lastSeen", "idle", "awaySince", "awayUntil"]) if (state && key in state) carried[key] = state[key]
  if (state && state.running === true && state.date) carried.unclosed = state.date
  else if (state && state.unclosed) carried.unclosed = state.unclosed
  return Object.assign(carried, { date: today })
}

// Applies an answer of `status`: shift is "running", "break" (a Pause
// inside the running shift) or "stopped". Calamari's answer is exact, so
// it counts as it is. known holds what `status` read from the running
// shift's timesheet entry: { startedAt, breakSince }, HH:MM or null when
// unknown. Returns { state, startTimeQuery, endTimeQuery }:
// startTimeQuery is null or { after: "HH:MM" | null }, the --after argument
// for `start-time` when the start of the running shift is unknown;
// endTimeQuery is null or { after: "HH:MM" }, for `end-time` when a shift
// of known start ended outside the plugin (web, phone).
export function applyStatus(state, shift, now, known = {}) {
  const next = forToday(state, now)
  const before = { running: next.running, startedAt: next.startedAt, onBreak: next.onBreak }
  const minute = minuteOfDay(now)
  // A Pause is over (ended in the web, or with its shift); the first poll
  // that tells may come late.
  if (shift !== "break") endPause(next, minute)
  next.running = shift !== "stopped"
  next.onBreak = shift === "break"
  if (!next.running) {
    next.startedAt = null
    // No shift ran at this poll; one that ended earlier in this minute
    // still reaches into it.
    next.searchAfter = laterOf(next.searchAfter, toHhmm(Math.min(minute + 1, 24 * 60 - 1)))
    // A shift of known start ended outside the plugin (web, phone); asked
    // again on every poll until end-time answered.
    if (before.running === true && before.startedAt) next.pendingEnd = before.startedAt
    return { state: next, startTimeQuery: null, endTimeQuery: next.pendingEnd ? { after: next.pendingEnd } : null }
  }
  // A shift runs (maybe stamped in the web or on the phone): the
  // Feierabend is over. A Pause counts from its start if known (own
  // break-start, Calamari's entry), else from its first sight.
  next.clockedOutAt = null
  if (known.startedAt) next.startedAt = known.startedAt
  // (A Pause that goes on kept its breakSince: endPause above skips "break".)
  if (next.onBreak && known.breakSince) Object.assign(next, { breakSince: known.breakSince, breakStartUnknown: false })
  else if (next.onBreak && !(before.onBreak && next.breakSince))
    Object.assign(next, { breakSince: toHhmm(minute), breakStartUnknown: true })
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

// Ends the Pause of a running shift at minute: its time is no work.
function endPause(state, minute) {
  if (state.running && state.breakSince) state.breakMinutes += Math.max(minute - toMinutes(state.breakSince), 0)
  return Object.assign(state, { onBreak: false, breakSince: null, breakStartUnknown: false })
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
  // The time of a Pause is no work.
  const until = state.onBreak && state.breakSince ? toMinutes(state.breakSince) : minuteOfDay(now)
  if (state.running && state.startedAt) total += Math.max(until - toMinutes(state.startedAt), 0)
  return Math.max(total - (state.breakMinutes || 0), 0)
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
      for (const key of Object.keys(state)) if (key in saved) state[key] = saved[key]
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
  return Object.assign(next, {
    running: true,
    onBreak: false,
    startedAt: toHhmm(minuteOfDay(now)),
    clockedOutAt: null,
    breakSince: null,
    breakStartUnknown: false,
    stampedToday: true,
  })
}

// The own clock-out succeeded: no shift runs since minute (default now).
function stopShift(state, now, minute = minuteOfDay(now)) {
  const next = forToday(state, now)
  // The own clock-out knows the end of today's shift right away.
  if (next.running && next.startedAt) addShift(next, next.startedAt, toHhmm(minute))
  endPause(next, minute)
  // The ended shift reaches into the minute of the clock-out.
  return Object.assign(next, {
    running: false,
    startedAt: null,
    clockedOutAt: null,
    searchAfter: toHhmm(Math.min(minute + 1, 24 * 60 - 1)),
  })
}

// Ausstempeln: it is Feierabend since minute (default now).
function applyClockOut(state, now, minute = minuteOfDay(now)) {
  return Object.assign(stopShift(state, now, minute), { clockedOutAt: toHhmm(minute) })
}

// Pause beginnen: the shift goes on, in a Pause from now.
function applyBreakStart(state, now) {
  return Object.assign(forToday(state, now), {
    running: true,
    onBreak: true,
    breakSince: toHhmm(minuteOfDay(now)),
    breakStartUnknown: false,
    clockedOutAt: null,
    stampedToday: true,
  })
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
  if (inPause(state)) return { kind: "break", text: duration(state.breakSince, now) }
  if (!state.running) return { kind: reminding ? "reminder" : "idle", text: "" }
  if (!state.startedAt) return { kind: "running", text: "" }
  return { kind: "running", text: duration(state.startedAt, now) }
}

// When the running Pause began, as far as the plugin knows.
export function breakSinceText(state) {
  return `${state.breakStartUnknown ? "spätestens " : ""}${state.breakSince}`
}

// Whether the running shift is in a Pause.
export function inPause(state) {
  return state.running === true && state.onBreak === true && Boolean(state.breakSince)
}

function duration(since, now) {
  const minutes = Math.max(minuteOfDay(now) - toMinutes(since), 0)
  return `${Math.floor(minutes / 60)}:${pad(minutes % 60)}`
}

const STAMP_ACTIONS = {
  "clock-in": "Einstempeln",
  "clock-out": "Ausstempeln",
  "break-start": "Pause beginnen",
  "break-end": "Pause beenden",
  "break-clock-out": "Feierabend",
}

// The panel's button text for a stamp action.
export function stampLabel(action) {
  return STAMP_ACTIONS[action]
}

// The helper command behind a stamp action, with the names from the
// settings (defaultProject, breakType); an empty one leaves the helper's
// default. A Pause is a real one inside the shift (ADR 0003).
export function helperCommand(action, settings) {
  const named = (command, flag, value) => {
    const name = String(value || "").trim()
    return name ? [command, flag, name] : [command]
  }
  const s = settings || {}
  if (action === "clock-in") return named("clock-in", "--project", s.defaultProject)
  if (action === "break-start") return named("break-start", "--break-type", s.breakType)
  if (action === "break-end") return named("break-stop", "--break-type", s.breakType)
  if (action === "break-clock-out") return ["clock-out-break"]
  return [action]
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
  API_URL_REQUIRED: "keine REST-API-URL, bitte in den Einstellungen setzen",
}

function stampErrorText(action, error) {
  const cause =
    error.code === "PROJECT_UNKNOWN"
      ? `Projekt „${error.project}“ gibt es in Calamari nicht`
      : error.code === "BREAK_TYPE_UNKNOWN"
        ? `Pausentyp „${error.breakType}“ gibt es in Calamari nicht`
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

// Feierabend instead of the Pause's end: only in a Pause.
export function feierabendAction(view) {
  return view.kind === "break" ? "break-clock-out" : null
}

// Applies an answer of `clock-in`, `clock-out`, `break-start`,
// `break-stop` or `clock-out-break` for a stamp action.
// Returns { state, error, pollNow, endTimeKnown }: error is the panel's
// line ("" when all is well). A failure keeps the state, so the user can
// retry; nothing is queued. Its outcome is unknown (a timeout may have
// stamped anyway), so pollNow asks Calamari right away, unless it is
// throttling us. endTimeKnown: the clock-out ended the shift at its
// Pause's start, so the end time needs no correction.
export function applyStamp(state, action, out, now) {
  return Object.assign({ endTimeKnown: false }, stampResult(state, action, out, now))
}

function stampResult(state, action, out, now) {
  if (!out.ok) {
    return { state, error: stampErrorText(action, out.error), pollNow: out.error.code !== "RATE_LIMITED" }
  }
  // A Pause answers with Calamari's break status; one it does not confirm
  // is left as it was, and the panel says so.
  if (action === "break-start" || action === "break-end") {
    const begin = action === "break-start"
    if (out.onBreak === begin) {
      const next = begin ? applyBreakStart(state, now) : endPause(forToday(state, now), minuteOfDay(now))
      return { state: next, error: "", pollNow: false }
    }
    const says = begin ? "keine Pause" : "weiter eine Pause"
    return { state, error: `${STAMP_ACTIONS[action]}: Calamari meldet ${says}. Bitte im Web prüfen.`, pollNow: true }
  }
  if ((action === "clock-out" || action === "break-clock-out") && out.stamped === false) {
    // No shift ran, so nothing was stamped: no Feierabend, and nothing to
    // correct; look again.
    return {
      state: stopShift(Object.assign({}, state, { running: false }), now),
      error: `${STAMP_ACTIONS[action]}: Calamari meldet keine laufende Schicht.`,
      pollNow: true,
    }
  }
  if (action === "clock-out") return { state: applyClockOut(state, now), error: "", pollNow: false }
  if (action === "break-clock-out") {
    const end = out.endedAt ? toMinutes(out.endedAt) : minuteOfDay(now)
    return { state: applyClockOut(state, now, end), error: "", pollNow: false, endTimeKnown: out.atBreakStart === true }
  }
  if (out.running) return { state: applyClockIn(state, now), error: "", pollNow: false }
  // Calamari took the clock-in but shows no shift: say so, and look again.
  return {
    state: applyStatus(state, "stopped", now).state,
    error: `${STAMP_ACTIONS[action]}: Calamari meldet keine laufende Schicht. Bitte im Web prüfen.`,
    pollNow: true,
  }
}
