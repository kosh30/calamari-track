// What the panel's header shows: the running duration as the page's largest
// number, one line placing it, and the progress through today's core time.
// No Qt; tested with `node --test js/`.
//
// The duration is the same figure the bar shows (barView.text), so the two
// never disagree. The caption is the panel's old status line minus that
// duration, which now stands on its own above it.

import { coreTime } from "./daycalendar.mjs"
import { minuteOfDay, pad, ymd } from "./daytime.mjs"
import { breakSinceText, dayOffToday } from "./shiftclock.mjs"

// "H:MM" for a span of minutes; hours are not padded, the way the bar
// spells a duration.
function span(minutes) {
  return `${Math.floor(minutes / 60)}:${pad(minutes % 60)}`
}

// The line under the number: where the shift stands, without repeating the
// duration.
function caption(view, state) {
  if (view.kind === "unknown") return "Schichtstatus wird abgefragt …"
  if (view.kind === "error") return "Schichtstatus unbekannt"
  if (view.kind === "auth") return "Anmeldung nötig"
  if (view.kind === "reminder") return "Noch nicht eingestempelt, die Kernzeit läuft"
  if (view.kind === "break") return `Pause seit ${breakSinceText(state)}`
  if (view.kind === "idle")
    return state.clockedOutAt ? `Feierabend seit ${state.clockedOutAt}` : "Keine laufende Schicht"
  return state.startedAt ? `Schicht läuft seit ${state.startedAt}` : "Schicht läuft"
}

// The progress through today's core time, or null when there is none to
// show. It belongs to the day, not to the shift: it is the same answer in a
// Pause, after the Feierabend and while the status is unknown.
//
// Before the core time starts there is nothing to be a fraction of, and an
// empty bar reads as "nothing done" rather than "not yet begun" — so the
// bar only appears once the core time is under way.
function progress(state, now, day, config) {
  if (!day || day.date !== ymd(now)) return null
  // coreTime reads state.dayOff as it stands. A state that stopped being
  // rewritten (status failing under backoff after a restart) still carries
  // yesterday's switch, which would take today's bar away while the panel's
  // own "Heute frei" button — it asks dayOffToday — shows it off.
  const today = Object.assign({}, state, { dayOff: dayOffToday(state, now) })
  const core = coreTime(day, today, config)
  if (!core) return null
  const minute = minuteOfDay(now)
  if (minute < core.start) return null
  const done = minute - core.start
  const total = core.end - core.start
  if (done >= total) return { fraction: 1, text: "Kernzeit beendet" }
  return { fraction: done / total, text: `noch ${span(total - done)} bis Ende der Kernzeit` }
}

// view is the bar's view (js/shiftclock.mjs barView), day today's
// `day-info` (null until it arrives), config the widget settings.
export function headerView({ view, state, now, day, config }) {
  return {
    // barView only fills text for a shift or a Pause whose start is known.
    // Anywhere else a number would be invented, so the header shows none.
    duration: view.text || "",
    caption: caption(view, state),
    progress: progress(state, now, day, config),
  }
}
