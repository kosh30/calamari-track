// Pure reminder logic: from the time, today's day info, the local state
// (js/shiftclock.mjs) and the config it decides which reminders are due and
// what the bar shows. No Qt; tested with `node --test js/`.
//
//   day     { date, workingDay, coreStart, coreEnd, holiday, absence }
//           from `day-info`, or null while unknown
//   state   the shift state, plus failed: true while the status is unknown
//   config  the widget settings (DEFAULTS below fill in what is not set,
//           coreMonday .. coreSunday see js/daycalendar.mjs)
//
// decide() is idempotent: what was sent is recorded with markSent() in
// state.sent, so the same moment never yields the same reminder twice.

import { coreTime } from "./daycalendar.mjs"
import { minuteOfDay, toHhmm, toMinutes, ymd } from "./daytime.mjs"

// A failed auto-close is tried again after this many minutes.
const AUTO_CLOSE_RETRY = 5
const LAST_MINUTE = 24 * 60 - 1

function atMinute(now, minute) {
  const d = new Date(now)
  d.setHours(0, minute, 0, 0)
  return d
}

// The config values decide() falls back to, as in manifest.json.
export const DEFAULTS = {
  stampReminderMinutes: 5, breakLimitMinutes: 30, breakReminderMinutes: 5, softHintMinutes: 30,
  finalWarningTime: "19:00", autoCloseMinutes: 15, extendMinutes: 60, hardLimitTime: "23:00",
}

function withDefaults(config) {
  const merged = Object.assign({}, DEFAULTS)
  for (const key of Object.keys(config || {}))
    if (config[key] !== undefined && config[key] !== null) merged[key] = config[key]
  return merged
}

// autoCloseAt: when the auto-close comes, once the final warning went out
// (the panel's countdown); canExtend: whether "+1 h" still moves it.
function quiet() {
  return { barState: null, actions: [], nextCheckAt: null, autoCloseAt: null, canExtend: false }
}

function earlier(a, b) {
  return !a || (b && b < a) ? b : a
}

// Minutes of the day for an "H:MM" / "HH:MM" setting, else of the fallback.
function clockSetting(text, fallback) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(text || "").trim())
  return match && Number(match[1]) < 24 && Number(match[2]) < 60 ? Number(match[1]) * 60 + Number(match[2]) : toMinutes(fallback)
}

export function decide(now, day, state, settings) {
  const config = withDefaults(settings)
  // A state of another date (right after midnight, before the first poll
  // of the new day) or an unknown status must not remind.
  if (state.failed || state.date !== ymd(now)) return quiet()
  if (state.breakSince && !state.running) return decideBreak(now, state, config)
  if (state.running) return decideShift(now, day, state, config)
  return decideStamp(now, day, state, config)
}

// A running shift: the soft hint and, any day, the final warning and the
// auto-close.
function decideShift(now, day, state, config) {
  const r = decideEvening(now, state, config)
  const hint = decideSoftHint(now, day, state, config)
  r.actions = hint.actions.concat(r.actions)
  r.nextCheckAt = earlier(r.nextCheckAt, hint.nextCheckAt)
  return r
}

// Once, softHintMinutes after the core time of a working day ends.
function decideSoftHint(now, day, state, config) {
  const r = quiet()
  const core = day && day.date === ymd(now) ? coreTime(day, state, config) : null
  if (!core || (state.sent && state.sent["soft-hint"])) return r
  const hintAt = core.end + config.softHintMinutes
  // A shift begun after that is no forgotten one.
  if (state.startedAt && toMinutes(state.startedAt) >= hintAt) return r
  if (minuteOfDay(now) >= hintAt) r.actions.push({ type: "soft-hint", coreEnd: toHhmm(core.end) })
  else r.nextCheckAt = atMinute(now, hintAt)
  return r
}

// The final warning at finalWarningTime, or where "+1 h" postponed it to;
// the auto-close autoCloseMinutes after the warning actually went out (so
// a late start of the machine still gets its warning first), and at the
// latest at hardLimitTime. The warning comes no later than a wait before
// the limit. A shift begun after the warning time (the user is evidently
// there) is only warned before the limit; one begun after that is warned
// at its start and closed a wait later.
function decideEvening(now, state, config) {
  const r = quiet()
  const minute = minuteOfDay(now)
  const wait = config.autoCloseMinutes
  const started = state.startedAt ? toMinutes(state.startedAt) : null
  let limit = clockSetting(config.hardLimitTime, DEFAULTS.hardLimitTime)
  if (started !== null && started > limit - wait) limit = Math.min(started + wait, LAST_MINUTE)
  const lastWarning = limit - wait
  let warnAt = clockSetting(config.finalWarningTime, DEFAULTS.finalWarningTime)
  if (state.postponedTo) warnAt = toMinutes(state.postponedTo)
  else if (started !== null && started >= warnAt) warnAt = lastWarning
  warnAt = Math.min(warnAt, lastWarning)

  const sent = state.sent && state.sent["final-warning"]
  const warnedAt = sent && toMinutes(sent) >= warnAt ? toMinutes(sent) : null
  if (warnedAt === null) {
    if (minute < warnAt) return Object.assign(r, { nextCheckAt: atMinute(now, warnAt) })
    const closeMinute = Math.min(minute + wait, limit)
    const closeAt = atMinute(now, closeMinute)
    const warning = { type: "final-warning", autoCloseAt: toHhmm(closeMinute) }
    return Object.assign(r, { actions: [warning], autoCloseAt: closeAt, nextCheckAt: closeAt, canExtend: closeMinute < limit })
  }
  const closeMinute = Math.min(warnedAt + wait, limit)
  r.autoCloseAt = atMinute(now, closeMinute)
  if (minute < closeMinute)
    return Object.assign(r, { nextCheckAt: r.autoCloseAt, canExtend: closeMinute < limit })
  // Due until the shift is gone; a failed clock-out is retried now and then.
  return Object.assign(repeating(now, state, "auto-close", AUTO_CLOSE_RETRY, closeMinute, null), { autoCloseAt: r.autoCloseAt })
}

// "+1 h weiterarbeiten": the next final warning comes extendMinutes from
// now (and the auto-close a wait after it); the hard limit still wins.
export function postpone(state, settings, now) {
  if (state.date !== ymd(now)) return state
  const minute = Math.min(minuteOfDay(now) + withDefaults(settings).extendMinutes, LAST_MINUTE)
  return Object.assign({}, state, { postponedTo: toHhmm(minute) })
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
  return Object.assign(quiet(), {
    actions: due ? [{ type }] : [],
    nextCheckAt: atMinute(now, until === null ? next : Math.min(next, until)),
  })
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

// Headline, body and click target ("panel" or "calamari", the web app) of
// the notification for an action of decide(), or for { type:
// "auto-closed", at: "HH:MM" } after the auto-close stamped out.
export function notification(action, day, state, settings) {
  const panel = (headline, body) => ({ headline, body, click: "panel" })
  if (action.type === "soft-hint")
    return panel("Schicht läuft noch", `Die Kernzeit endete um ${action.coreEnd}.`)
  if (action.type === "final-warning")
    return panel("Letzte Warnung",
      `Auto-Abschluss um ${action.autoCloseAt}. Im Panel: ${extendLabel(settings)} oder jetzt ausstempeln.`)
  if (action.type === "auto-closed")
    return { headline: "Schicht automatisch beendet",
      body: `Um ${action.at} ausgestempelt. Bitte die Endzeit in Calamari korrigieren.`, click: "calamari" }
  if (action.type === "break-reminder")
    return panel("Pause läuft noch", `Die Pause läuft seit ${state.breakSince}.`)
  return panel("Noch nicht eingestempelt", `Die Kernzeit läuft seit ${day.coreStart}.`)
}

// The panel's countdown line for a decision with a pending auto-close.
export function countdownText(decision, now) {
  if (!decision.autoCloseAt) return ""
  const left = Math.max(Math.ceil((decision.autoCloseAt - now) / 60000), 0)
  return `Auto-Abschluss um ${toHhmm(minuteOfDay(decision.autoCloseAt))}, noch ${left} Min`
}

// The text of the "+1 h weiterarbeiten" button for the configured shift.
export function extendLabel(settings) {
  const minutes = withDefaults(settings).extendMinutes
  return minutes === 60 ? "+1 h weiterarbeiten" : `+${minutes} Min weiterarbeiten`
}
