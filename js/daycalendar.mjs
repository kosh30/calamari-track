// Calendar rules behind the reminders: is today a working day, and when is
// its core time? Tested only through decide() in js/reminders.mjs.

import { toMinutes } from "./daytime.mjs"

// Where a half holiday splits the day.
const HALF_DAY = 12 * 60

// The widget settings coreMonday .. coreSunday override the work plan:
// "HH:MM-HH:MM" is the core time, "frei" makes the weekday non-working,
// anything else (empty, unreadable) keeps the plan from Calamari.
const OVERRIDE_KEYS = ["coreSunday", "coreMonday", "coreTuesday", "coreWednesday",
  "coreThursday", "coreFriday", "coreSaturday"]
const OVERRIDE = /^\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s*$/

// Minutes of the day for "H:MM" / "HH:MM", or null if it is no time of day.
function clockTime(text) {
  const [h, m] = text.split(":").map(Number)
  return h < 24 && m < 60 ? h * 60 + m : null
}

function plannedCore(day, config) {
  const weekday = new Date(`${day.date}T12:00:00`).getDay()
  const text = String((config && config[OVERRIDE_KEYS[weekday]]) || "")
  if (text.trim().toLowerCase() === "frei") return null
  const match = OVERRIDE.exec(text)
  const start = match && clockTime(match[1])
  const end = match && clockTime(match[2])
  if (start !== null && end !== null && start < end) return { start, end }
  if (!day.workingDay || !day.coreStart || !day.coreEnd) return null
  return { start: toMinutes(day.coreStart), end: toMinutes(day.coreEnd) }
}

// Core time of the day as { start, end } in minutes of the day, or null on
// a day without one: no working day, or a free day (public holiday, time
// off for the whole day, the panel switch "Heute frei").
export function coreTime(day, state, config) {
  if (state.dayOff) return null
  if (day.holiday && !day.holiday.halfDay) return null
  // Working absences (category WORK, e.g. a business trip) and hourly ones
  // keep the day.
  if (day.absence && day.absence.category === "TIMEOFF" && day.absence.fullDay) return null
  const core = plannedCore(day, config)
  if (!core) return null
  let { start, end } = core
  // A half holiday takes the morning (AM) or the afternoon (PM) off.
  if (day.holiday && day.holiday.halfdayPeriod === "PM") end = Math.min(end, HALF_DAY)
  if (day.holiday && day.holiday.halfdayPeriod === "AM") start = Math.max(start, HALF_DAY)
  return start < end ? { start, end } : null
}
