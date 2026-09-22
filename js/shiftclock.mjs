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
//
// Known limit: the start of a follow-up shift is only found if the plugin
// saw the gap before it (searchAfter). A break the plugin never observed (shell
// off, suspend) leaves the cached start of the earlier shift.

// `status` looks back this many minutes, so a shift that just ended can
// still look running for that long.
const STATUS_WINDOW = 2

export function emptyState() {
  return { date: "", running: null, startedAt: null, searchAfter: null, clockedOutAt: null }
}

function ymd(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function pad(n) {
  return String(n).padStart(2, "0")
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number)
  return h * 60 + m
}

function minuteOfDay(d) {
  return d.getHours() * 60 + d.getMinutes()
}

function toHhmm(minutes) {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`
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
  // Right after the own clock-out the ended shift still overlaps the
  // status window; the clock-out is the newer truth.
  if (running && next.clockedOutAt && minuteOfDay(now) - toMinutes(next.clockedOutAt) <= STATUS_WINDOW)
    running = false
  next.running = running
  if (!running) {
    next.startedAt = null
    // No shift overlapped the window, so any earlier one ended before it.
    next.searchAfter = laterOf(next.searchAfter, toHhmm(Math.max(minuteOfDay(now) - STATUS_WINDOW, 0)))
    return { state: next, startTimeQuery: null }
  }
  // A shift runs again (stamped in the web or on the phone): the
  // Feierabend is over.
  next.clockedOutAt = null
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
  return Object.assign(next, { running: true, startedAt: minute, clockedOutAt: null })
}

// The own clock-out succeeded: no shift runs, and it is Feierabend.
function applyClockOut(state, now) {
  const next = forToday(state, now)
  const minute = minuteOfDay(now)
  // The ended shift reaches into the minute of the clock-out.
  return Object.assign(next, {
    running: false, startedAt: null, clockedOutAt: toHhmm(minute),
    searchAfter: toHhmm(Math.min(minute + 1, 24 * 60 - 1)),
  })
}

export function applyStartTime(state, startedAt) {
  return Object.assign({}, state, { startedAt })
}

// kind: "auth" (login needed), "error", "unknown", "running" or "idle";
// text: the shift duration H:MM while running and its start is known.
export function barView({ state, now, authState, failed }) {
  if (authState === "required") return { kind: "auth", text: "" }
  if (failed) return { kind: "error", text: "" }
  if (!state || state.running === null) return { kind: "unknown", text: "" }
  if (!state.running) return { kind: "idle", text: "" }
  if (!state.startedAt) return { kind: "running", text: "" }
  const minutes = Math.max(minuteOfDay(now) - toMinutes(state.startedAt), 0)
  return { kind: "running", text: `${Math.floor(minutes / 60)}:${pad(minutes % 60)}` }
}

const STAMP_ACTIONS = { "clock-in": "Einstempeln", "clock-out": "Ausstempeln" }
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
// shift runs, "clock-in" without one, null while the status is not known.
export function stampAction(view) {
  if (view.kind === "running") return "clock-out"
  if (view.kind === "idle") return "clock-in"
  return null
}

// Applies an answer of `clock-in` / `clock-out`. Returns { state, error,
// pollNow }: error is the panel's line for a failure ("" on success). A
// failure keeps the state, so the user can retry; nothing is queued. Its
// outcome is unknown (a timeout may have stamped anyway), so pollNow asks
// Calamari right away, unless it is throttling us.
export function applyStamp(state, action, out, now) {
  if (!out.ok) {
    const { code, message } = out.error
    return { state, error: stampErrorText(action, code, message), pollNow: code !== "RATE_LIMITED" }
  }
  let next
  if (action === "clock-out") next = applyClockOut(state, now)
  else if (out.running) next = applyClockIn(state, now)
  else next = applyStatus(state, false, now).state
  return { state: next, error: "", pollNow: false }
}
