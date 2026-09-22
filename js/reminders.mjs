// Pure reminder logic: from the time, today's day info, the local state
// (js/shiftclock.mjs) and the config it decides which reminders are due and
// what the bar shows. No Qt; tested with `node --test js/`.
//
//   day     { date, workingDay, coreStart, coreEnd } from `day-info`, or
//           null while unknown
//   state   the shift state, plus failed: true while the status is unknown
//   config  { stampReminderMinutes }
//
// decide() is idempotent: what was sent is recorded with markSent() in
// state.sent, so the same moment never yields the same reminder twice.

import { minuteOfDay, toHhmm, toMinutes, ymd } from "./daytime.mjs"

function atMinute(now, minute) {
  const d = new Date(now)
  d.setHours(0, minute, 0, 0)
  return d
}

export function decide(now, day, state, config) {
  const quiet = { barState: null, actions: [], nextCheckAt: null }
  // A day info or state of another date (right after midnight, before the
  // first poll of the new day) or an unknown status must not remind.
  const today = ymd(now)
  if (!day || day.date !== today || !day.workingDay || !day.coreStart || !day.coreEnd) return quiet
  if (state.failed || state.date !== today) return quiet
  const minute = minuteOfDay(now)
  const coreStart = toMinutes(day.coreStart)
  const coreEnd = toMinutes(day.coreEnd)
  if (minute < coreStart) return Object.assign(quiet, { nextCheckAt: atMinute(now, coreStart) })
  // Only "noch gar nicht eingestempelt" earns a reminder; a Feierabend
  // implies a shift today.
  if (minute >= coreEnd || state.running !== false || state.stampedToday || state.clockedOutAt) return quiet
  const interval = config.stampReminderMinutes
  const last = state.sent && state.sent["stamp-reminder"]
  const due = !last || minute - toMinutes(last) >= interval
  return {
    barState: "reminder",
    actions: due ? [{ type: "stamp-reminder" }] : [],
    nextCheckAt: atMinute(now, Math.min((due ? minute : toMinutes(last)) + interval, coreEnd)),
  }
}

// Records that a reminder of this type went out now.
export function markSent(state, type, now) {
  const sent = Object.assign({}, state.sent, { [type]: toHhmm(minuteOfDay(now)) })
  return Object.assign({}, state, { sent })
}

// Headline and body of the notification for an action of decide().
export function notification(action, day) {
  return { headline: "Noch nicht eingestempelt", body: `Die Kernzeit läuft seit ${day.coreStart}.` }
}
