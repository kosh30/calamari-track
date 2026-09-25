// Pure logic behind the poll backoff: while Calamari cannot be reached or
// throttles us, the service asks less often, and the first answer that
// comes through returns it to the set interval. No Qt; tested with
// `node --test js/`.

// The failures that waiting helps with. Others (login needed, API key)
// wait for the user, so the interval stays as it is.
const BACKOFF_CODES = ["NETWORK", "RATE_LIMITED"]
// The longest wait between two polls; a set interval above it stays.
const MAX_MINUTES = 30

// The count of backoff failures in a row after the answer out of a poll.
export function failuresAfter(failures, out) {
  if (out.ok) return 0
  return BACKOFF_CODES.includes(out.error && out.error.code) ? failures + 1 : failures
}

// Minutes until the next poll: the set interval, doubled per failure in a
// row, up to MAX_MINUTES.
export function pollMinutes(baseMinutes, failures) {
  if (failures <= 0) return baseMinutes
  return Math.max(baseMinutes, Math.min(baseMinutes * 2 ** failures, MAX_MINUTES))
}

// The bar's tooltip for a failed poll with the error code.
export function errorTooltip(code, retryMinutes) {
  const retry = `nächster Versuch in ${retryMinutes} Min`
  if (code === "NETWORK") return `Calamari nicht erreichbar, ${retry}`
  if (code === "RATE_LIMITED") return `Calamari: zu viele Anfragen, ${retry}`
  return "Calamari: Fehler"
}
