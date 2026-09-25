// Minutes of the day and their HH:MM / YYYY-MM-DD spellings, shared by the
// logic modules. Local time throughout.

export function ymd(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function pad(n) {
  return String(n).padStart(2, "0")
}

export function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number)
  return h * 60 + m
}

export function minuteOfDay(d) {
  return d.getHours() * 60 + d.getMinutes()
}

export function toHhmm(minutes) {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`
}

// "H:MM" for a span of minutes; unlike a moment of the day its hours are
// not padded, the way the bar and the panel spell a duration.
export function toSpan(minutes) {
  return `${Math.floor(minutes / 60)}:${pad(minutes % 60)}`
}

// "YYYY-MM-DDTHH:MM", for moments that may lie on another day.
export function momentOf(d) {
  return `${ymd(d)}T${toHhmm(minuteOfDay(d))}`
}

export function fromMoment(moment) {
  return new Date(`${moment}:00`)
}
