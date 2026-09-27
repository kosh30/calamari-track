// What the panel's header shows: the running duration as the page's largest
// number, one line placing it, the progress through today's core time and
// the day line under it (js/daytimeline.mjs). No Qt; tested with
// `node --test js/`.
//
// The duration is the same figure the bar shows (barView.text), so the two
// never disagree. The caption is the panel's old status line minus that
// duration, which now stands on its own above it.

import { coreTime } from "./daycalendar.mjs"
import { timelineView } from "./daytimeline.mjs"
import { minuteOfDay, toSpan, ymd } from "./daytime.mjs"
import { breakSinceText, dayOffToday } from "./shiftclock.mjs"
import { t as defaultT } from "./i18n.mjs"

// The line under the number: where the shift stands, without repeating the
// duration.
function caption(view, state, t) {
  if (view.kind === "unknown") return t("header.statusPolling")
  if (view.kind === "error") return t("header.statusUnknown")
  if (view.kind === "auth") return t("header.authRequired")
  if (view.kind === "reminder") return t("header.reminder")
  if (view.kind === "break") return t("header.breakSince", { since: breakSinceText(state, t) })
  if (view.kind === "idle")
    return state.clockedOutAt ? t("header.endOfDaySince", { time: state.clockedOutAt }) : t("header.noShift")
  return state.startedAt ? t("header.runningSince", { time: state.startedAt }) : t("header.running")
}

// Today's core time as { start, end } in minutes, or null on a day without
// one. Both the bar and the day line hang on it, so it is looked up once.
//
// coreTime reads state.dayOff as it stands. A state that stopped being
// rewritten (status failing under backoff after a restart) still carries
// yesterday's switch, which would take today's bar away while the panel's
// own day-off button — it asks dayOffToday — shows it off.
function todayCore(state, now, day, config) {
  if (!day || day.date !== ymd(now)) return null
  const today = Object.assign({}, state, { dayOff: dayOffToday(state, now) })
  return coreTime(day, today, config)
}

// The progress through today's core time, or null when there is none to
// show. It belongs to the day, not to the shift: it is the same answer in a
// break, after the end of day and while the status is unknown.
//
// Before the core time starts there is nothing to be a fraction of, and an
// empty bar reads as "nothing done" rather than "not yet begun" — so the
// bar only appears once the core time is under way.
function progress(core, now, t) {
  if (!core) return null
  const minute = minuteOfDay(now)
  if (minute < core.start) return null
  const done = minute - core.start
  const total = core.end - core.start
  if (done >= total) return { fraction: 1, text: t("header.coreDone") }
  return { fraction: done / total, text: t("header.coreLeft", { span: toSpan(total - done) }) }
}

// view is the bar's view (js/shiftclock.mjs barView), day today's
// `day-info` (null until it arrives), config the widget settings.
export function headerView({ view, state, now, day, config, t = defaultT }) {
  const core = todayCore(state, now, day, config)
  return {
    // barView only fills text for a shift or a break whose start is known.
    // Anywhere else a number would be invented, so the header shows none.
    duration: view.text || "",
    caption: caption(view, state, t),
    progress: progress(core, now, t),
    timeline: timelineView({ state, now, core, t }),
  }
}
