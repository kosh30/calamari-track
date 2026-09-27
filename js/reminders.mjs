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

import { lastActivity } from "./activity.mjs"
import { coreTime } from "./daycalendar.mjs"
import { fromMoment, minuteOfDay, pad, toHhmm, toMinutes, ymd } from "./daytime.mjs"
import { breakSinceText, inPause } from "./shiftclock.mjs"
import { t as defaultT } from "./i18n.mjs"

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
  stampReminderMinutes: 5,
  breakLimitMinutes: 30,
  breakReminderMinutes: 5,
  softHintMinutes: 30,
  finalWarningTime: "19:00",
  autoCloseMinutes: 15,
  extendMinutes: 60,
  hardLimitTime: "23:00",
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
  return match && Number(match[1]) < 24 && Number(match[2]) < 60
    ? Number(match[1]) * 60 + Number(match[2])
    : toMinutes(fallback)
}

export function decide(now, day, state, settings) {
  const config = withDefaults(settings)
  // A state of another date (right after midnight, before the first poll
  // of the new day) or an unknown status must not remind.
  if (state.failed || state.running === null || state.date !== ymd(now)) return quiet()
  if (inPause(state)) return decidePause(now, state, config)
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
  // The start of a shift begun in the web is looked up right away; until
  // then nothing of an earlier shift (warning, "+1 h") may apply to it.
  if (!state.startedAt) return r
  const minute = minuteOfDay(now)
  const wait = config.autoCloseMinutes
  const started = toMinutes(state.startedAt)
  let limit = clockSetting(config.hardLimitTime, DEFAULTS.hardLimitTime)
  if (started > limit - wait) limit = Math.min(started + wait, LAST_MINUTE)
  const lastWarning = limit - wait
  let warnAt = clockSetting(config.finalWarningTime, DEFAULTS.finalWarningTime)
  // A "+1 h" belongs to the shift it was clicked in, not to a later one.
  const postponed = state.postponedTo ? toMinutes(state.postponedTo) : null
  if (postponed !== null && postponed > started) warnAt = postponed
  else if (started >= warnAt) warnAt = lastWarning
  warnAt = Math.min(warnAt, lastWarning)

  const sent = state.sent && state.sent["final-warning"]
  const warnedAt = sent && toMinutes(sent) >= warnAt ? toMinutes(sent) : null
  if (warnedAt === null) {
    if (minute < warnAt) return Object.assign(r, { nextCheckAt: atMinute(now, warnAt) })
    const closeMinute = Math.min(minute + wait, limit)
    const closeAt = atMinute(now, closeMinute)
    const warning = { type: "final-warning", autoCloseAt: toHhmm(closeMinute) }
    return Object.assign(r, {
      actions: [warning],
      autoCloseAt: closeAt,
      nextCheckAt: closeAt,
      canExtend: closeMinute < limit,
    })
  }
  const closeMinute = Math.min(warnedAt + wait, limit)
  r.autoCloseAt = atMinute(now, closeMinute)
  if (minute < closeMinute) return Object.assign(r, { nextCheckAt: r.autoCloseAt, canExtend: closeMinute < limit })
  // Due until the shift is gone; a failed clock-out is retried now and then.
  // Someone idle at the auto-close gets told when they were last active.
  const close = { type: "auto-close", lastActivity: state.idle ? lastActivity(state) : null }
  return Object.assign(repeating(now, state, close, AUTO_CLOSE_RETRY, closeMinute, null), {
    autoCloseAt: r.autoCloseAt,
  })
}

// "+1 h weiterarbeiten": the next final warning comes extendMinutes from
// now (and the auto-close a wait after it); the hard limit still wins.
export function postpone(state, settings, now) {
  if (state.date !== ymd(now)) return state
  const minute = Math.min(minuteOfDay(now) + withDefaults(settings).extendMinutes, LAST_MINUTE)
  return Object.assign({}, state, { postponedTo: toHhmm(minute) })
}

// A break: its reminder and, as in the shift, the final warning and the
// auto-close (a break still open in the evening is a forgotten end of day).
// No soft hint. The auto-close ends the shift at the break's start.
function decidePause(now, state, config) {
  const pause = decideBreak(now, state, config)
  const r = decideEvening(now, state, config)
  const evening = r.actions.map((a) => (a.type === "auto-close" ? Object.assign({}, a, { inPause: true }) : a))
  r.actions = pause.actions.concat(evening)
  r.nextCheckAt = earlier(r.nextCheckAt, pause.nextCheckAt)
  return r
}

// The break reminder: from breakLimitMinutes into the break on, every
// breakReminderMinutes. Any day, working or not.
function decideBreak(now, state, config) {
  const minute = minuteOfDay(now)
  const since = toMinutes(state.breakSince)
  const limit = since + config.breakLimitMinutes
  if (minute < limit) return Object.assign(quiet(), { nextCheckAt: atMinute(now, limit) })
  // A reminder sent before this break began belongs to an earlier one.
  return repeating(now, state, { type: "break-reminder" }, config.breakReminderMinutes, since, null)
}

// The action is due unless one of its type went out within the last
// interval minutes (ignoring those sent before `since`); next look at the
// following one, or at `until` if that is earlier.
function repeating(now, state, action, interval, since, until) {
  const minute = minuteOfDay(now)
  const sent = state.sent && state.sent[action.type]
  const last = sent && toMinutes(sent) >= since ? toMinutes(sent) : null
  const due = last === null || minute - last >= interval
  const next = (due ? minute : last) + interval
  return Object.assign(quiet(), {
    actions: due ? [action] : [],
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
  // Only "not clocked in at all yet" earns a reminder; an end of day or a
  // break implies a shift today.
  if (minute >= coreEnd || state.running !== false || state.stampedToday || state.clockedOutAt) return quiet()
  const r = repeating(now, state, { type: "stamp-reminder" }, config.stampReminderMinutes, 0, coreEnd)
  return Object.assign(r, { barState: "reminder" })
}

// Records that a reminder of this type went out now.
export function markSent(state, type, now) {
  const sent = Object.assign({}, state.sent, { [type]: toHhmm(minuteOfDay(now)) })
  return Object.assign({}, state, { sent })
}

// Headline, body and click target ("panel" or "calamari", the web app) of
// the notification for an action of decide(), for the correction hint
// { type: "auto-closed", at: "HH:MM", lastActivity } once the auto-close
// stamped out, or for { type: "day-end-closed", date, lastActivity }, the
// hint about a day Calamari itself ended (js/shiftclock.mjs applyDayEnd).
export function notification(action, day, state, settings, t = defaultT) {
  const panel = (headline, body) => ({ headline, body, click: "panel" })
  if (action.type === "soft-hint")
    return panel(t("notify.softHint.headline"), t("notify.softHint.body", { coreEnd: action.coreEnd }))
  if (action.type === "final-warning")
    return panel(
      t("notify.finalWarning.headline"),
      t("notify.finalWarning.body", {
        at: action.autoCloseAt,
        extend: extendLabel(settings, t),
        alt: inPause(state) ? t("notify.finalWarning.altEndOfDay") : t("notify.finalWarning.altClockOut"),
      }),
    )
  if (action.type === "auto-closed") {
    const body = action.lastActivity
      ? t("notify.autoClosed.bodyWithActivity", { at: action.at, lastActivity: clockOf(action.lastActivity) })
      : t("notify.autoClosed.body", { at: action.at })
    return { headline: t("notify.autoClosed.headline"), body, click: "calamari" }
  }
  if (action.type === "day-end-closed") {
    const date = dayOf(action.date, t)
    const body = action.lastActivity
      ? t("notify.dayEndClosed.bodyWithActivity", { date, lastActivity: clockOf(action.lastActivity) })
      : t("notify.dayEndClosed.body", { date })
    return { headline: t("notify.dayEndClosed.headline"), body, click: "calamari" }
  }
  if (action.type === "break-reminder")
    return panel(
      t("notify.breakReminder.headline"),
      t("notify.breakReminder.body", { since: breakSinceText(state, t) }),
    )
  return panel(t("notify.stampReminder.headline"), t("notify.stampReminder.body", { coreStart: day.coreStart }))
}

function clockOf(stamp) {
  return toHhmm(minuteOfDay(fromMoment(stamp)))
}

// A day without a year, of a "YYYY-MM-DD" date or a "YYYY-MM-DDTHH:MM"
// moment. The order is the locale's own: day first in de, pl and ru, month
// first in en.
function dayOf(stamp, t) {
  const d = fromMoment(`${String(stamp).slice(0, 10)}T00:00`)
  return t("date.dayMonth", { day: pad(d.getDate()), month: pad(d.getMonth() + 1) })
}

// The panel's countdown line for a decision with a pending auto-close.
export function countdownText(decision, now, t = defaultT) {
  if (!decision.autoCloseAt) return ""
  const left = Math.max(Math.ceil((decision.autoCloseAt - now) / 60000), 0)
  return t("panel.countdown", { at: toHhmm(minuteOfDay(decision.autoCloseAt)), left })
}

// The text of the panel's "work on" button for the configured shift.
export function extendLabel(settings, t = defaultT) {
  const minutes = withDefaults(settings).extendMinutes
  return minutes === 60 ? t("panel.extendHour") : t("panel.extendMinutes", { minutes })
}

// For the closing actions of decide(): the stamp action to run and the
// correction hint to send once it went through; null for plain reminders.
export function closeFor(action) {
  if (action.type === "auto-close")
    return {
      stamp: action.inPause ? "break-clock-out" : "clock-out",
      notice: { type: "auto-closed", lastActivity: action.lastActivity },
    }
  return null
}
