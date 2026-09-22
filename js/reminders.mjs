// Pure reminder logic: from the time, today's day info, the local state
// (js/shiftclock.mjs) and the config it decides which reminders are due and
// what the bar shows. No Qt; tested with `node --test js/`.
//
//   day     { date, workingDay, coreStart, coreEnd, holiday, absence }
//           from `day-info`, or null while unknown
//   state   the shift state, plus failed: true while the status is unknown
//   config  { stampReminderMinutes, breakLimitMinutes, breakReminderMinutes,
//           coreMonday .. coreSunday }; the calendar rules are in
//           js/daycalendar.mjs
//
// decide() is idempotent: what was sent is recorded with markSent() in
// state.sent, so the same moment never yields the same reminder twice.

import { coreTime } from "./daycalendar.mjs"
import { minuteOfDay, toHhmm, toMinutes, ymd } from "./daytime.mjs"

function atMinute(now, minute) {
  const d = new Date(now)
  d.setHours(0, minute, 0, 0)
  return d
}

function quiet() {
  return { barState: null, actions: [], nextCheckAt: null }
}

export function decide(now, day, state, config) {
  // A state of another date (right after midnight, before the first poll
  // of the new day) or an unknown status must not remind.
  if (state.failed || state.date !== ymd(now)) return quiet()
  if (state.breakSince && !state.running) return decideBreak(now, state, config)
  return decideStamp(now, day, state, config)
}

// The Pause reminder: from breakLimitMinutes into the Pause on, every
// breakReminderMinutes. Any day, working or not.
function decideBreak(now, state, config) {
  const minute = minuteOfDay(now)
  const since = toMinutes(state.breakSince)
  const limit = since + config.breakLimitMinutes
  if (minute < limit) return Object.assign(quiet(), { nextCheckAt: atMinute(now, limit) })
  // A reminder sent before this Pause began belongs to an earlier one.
  return repeating(now, state, "break-reminder", config.breakReminderMinutes, since, null)
}

// A reminder of this type is due unless one went out within the last
// interval minutes (ignoring those sent before `since`); next look at the
// following one, or at `until` if that is earlier.
function repeating(now, state, type, interval, since, until) {
  const minute = minuteOfDay(now)
  const sent = state.sent && state.sent[type]
  const last = sent && toMinutes(sent) >= since ? toMinutes(sent) : null
  const due = last === null || minute - last >= interval
  const next = (due ? minute : last) + interval
  return {
    barState: null,
    actions: due ? [{ type }] : [],
    nextCheckAt: atMinute(now, until === null ? next : Math.min(next, until)),
  }
}

// The stamp reminder: in the core time of a working day while nothing was
// stamped yet today, every stampReminderMinutes.
function decideStamp(now, day, state, config) {
  // A day info of another date is not today's.
  if (!day || day.date !== ymd(now)) return quiet()
  const core = coreTime(day, state, config)
  if (!core) return quiet()
  const minute = minuteOfDay(now)
  const { start: coreStart, end: coreEnd } = core
  if (minute < coreStart) return Object.assign(quiet(), { nextCheckAt: atMinute(now, coreStart) })
  // Only "noch gar nicht eingestempelt" earns a reminder; a Feierabend or a
  // Pause implies a shift today.
  if (minute >= coreEnd || state.running !== false || state.stampedToday || state.clockedOutAt) return quiet()
  const r = repeating(now, state, "stamp-reminder", config.stampReminderMinutes, 0, coreEnd)
  return Object.assign(r, { barState: "reminder" })
}

// Records that a reminder of this type went out now.
export function markSent(state, type, now) {
  const sent = Object.assign({}, state.sent, { [type]: toHhmm(minuteOfDay(now)) })
  return Object.assign({}, state, { sent })
}

// Headline and body of the notification for an action of decide().
export function notification(action, day, state) {
  if (action.type === "break-reminder")
    return { headline: "Pause läuft noch", body: `Die Pause läuft seit ${state.breakSince}.` }
  return { headline: "Noch nicht eingestempelt", body: `Die Kernzeit läuft seit ${day.coreStart}.` }
}
