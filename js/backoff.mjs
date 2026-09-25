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

// The failures that no waiting fixes: they sit there until the user acts.
// Naming a next attempt would be a lie, so the tooltip names the remedy
// instead. Same causes as STAMP_CAUSES in shiftclock.mjs, but as a whole
// sentence, because the bar has no failed action to put in front of them.
// AUTH_REQUIRED is missing on purpose: it turns authState to "required",
// so the bar shows the view "auth" and never gets here.
const USER_ACTION_HINTS = {
  API_URL_REQUIRED: "Calamari: REST-API-URL fehlt, bitte in den Einstellungen setzen",
  API_KEY_REQUIRED: "Calamari: API-Key fehlt, bitte bin/calamari api-key ausführen",
  API_KEY_REJECTED: "Calamari lehnt den API-Key ab, bitte bin/calamari api-key erneut ausführen",
  API_TERMINAL_MISSING: "Calamari: API Terminal fehlt in Clockin",
  API_SCOPE_MISSING: "Calamari: dem API-Key fehlt eine Berechtigung",
}

// The bar's tooltip for a failed poll with the error code.
export function errorTooltip(code, retryMinutes) {
  const retry = `nächster Versuch in ${retryMinutes} Min`
  if (code === "NETWORK") return `Calamari nicht erreichbar, ${retry}`
  if (code === "RATE_LIMITED") return `Calamari: zu viele Anfragen, ${retry}`
  return USER_ACTION_HINTS[code] || "Calamari: Fehler"
}
