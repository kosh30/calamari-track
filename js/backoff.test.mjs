import { test } from "node:test"
import assert from "node:assert/strict"
import { errorTooltip, failuresAfter, pollMinutes } from "./backoff.mjs"

const fail = (code) => ({ ok: false, error: { code, message: code } })

test("without an error the query runs at the interval configured", () => {
  assert.equal(pollMinutes(3, 0), 3)
})

test("every network or rate-limit error in a row doubles the interval", () => {
  let failures = 0
  failures = failuresAfter(failures, fail("NETWORK"))
  assert.equal(pollMinutes(3, failures), 6)
  failures = failuresAfter(failures, fail("RATE_LIMITED"))
  assert.equal(pollMinutes(3, failures), 12)
})

test("the interval grows to at most 30 minutes", () => {
  assert.equal(pollMinutes(3, 5), 30)
  assert.equal(pollMinutes(3, 100), 30)
})

test("a configured interval above the upper limit stays", () => {
  assert.equal(pollMinutes(45, 3), 45)
})

test("after a successful answer the normal interval applies again", () => {
  const failures = failuresAfter(failuresAfter(0, fail("NETWORK")), { ok: true })
  assert.equal(failures, 0)
  assert.equal(pollMinutes(3, failures), 3)
})

test("other errors do not change the interval", () => {
  assert.equal(failuresAfter(0, fail("AUTH_REQUIRED")), 0)
  assert.equal(failuresAfter(2, fail("API_KEY_REJECTED")), 2)
})

test("the bar names the cause and the next attempt", () => {
  assert.equal(errorTooltip("NETWORK", 6), "Calamari cannot be reached, next attempt in 6 min")
  assert.equal(errorTooltip("RATE_LIMITED", 12), "Calamari: too many requests, next attempt in 12 min")
})

test("other errors show the bar as before", () => {
  assert.equal(errorTooltip("API_ERROR", 3), "Calamari: error")
})

test("errors that wait on the user name the remedy instead of a next attempt", () => {
  assert.equal(
    errorTooltip("API_URL_REQUIRED", 3),
    "Calamari: the REST API URL is missing, please set it in the settings",
  )
  assert.equal(errorTooltip("API_KEY_REQUIRED", 3), "Calamari: the API key is missing, please run bin/calamari api-key")
  assert.equal(
    errorTooltip("API_KEY_REJECTED", 3),
    "Calamari rejects the API key, please run bin/calamari api-key again",
  )
  assert.equal(errorTooltip("API_TERMINAL_MISSING", 3), "Calamari: no API Terminal in Clockin")
  assert.equal(errorTooltip("API_SCOPE_MISSING", 3), "Calamari: the API key lacks a permission")
})

test("no waiting helps, so these hints carry no wait time", () => {
  for (const code of ["API_URL_REQUIRED", "API_KEY_REQUIRED", "API_SCOPE_MISSING"])
    assert.ok(!errorTooltip(code, 30).includes("next attempt"), code)
})

// AUTH_REQUIRED never reaches errorTooltip: it turns authState to
// "required", and barView answers with the view "auth" before the error.
test("a login needed stays the business of the auth view", () => {
  assert.equal(errorTooltip("AUTH_REQUIRED", 3), "Calamari: error")
})
