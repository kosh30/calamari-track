// Pure logic behind the shift status in the bar: what the service keeps in
// its local state, when it must ask the helper for the start time, and what
// the bar shows. No Qt; tested with `node --test js/`.
//
// State (persisted by the service):
//   date       YYYY-MM-DD the state belongs to
//   running    last known answer of `status` (null before the first one)
//   startedAt  HH:MM start of the running shift, cached until it ends
//   noShiftSince  HH:MM of the last poll that saw no running shift today
//
// Known limit: the start of a follow-up shift is only found if a poll saw
// the gap before it (noShiftSince). A break the plugin never observed (shell
// off, suspend) leaves the cached start of the earlier shift.

// `status` looks back this many minutes, so a shift that just ended can
// still look running for that long.
const STATUS_WINDOW = 2

export function emptyState() {
  return { date: "", running: null, startedAt: null, noShiftSince: null }
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
  next.running = running
  if (!running) {
    next.startedAt = null
    next.noShiftSince = toHhmm(minuteOfDay(now))
    return { state: next, startTimeQuery: null }
  }
  if (next.startedAt) return { state: next, startTimeQuery: null }
  const after = next.noShiftSince ? toHhmm(Math.max(toMinutes(next.noShiftSince) - STATUS_WINDOW, 0)) : null
  return { state: next, startTimeQuery: { after } }
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
