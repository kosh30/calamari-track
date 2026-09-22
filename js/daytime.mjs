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
