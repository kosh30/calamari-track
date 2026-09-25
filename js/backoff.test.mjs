import { test } from "node:test"
import assert from "node:assert/strict"
import { errorTooltip, failuresAfter, pollMinutes } from "./backoff.mjs"

const fail = (code) => ({ ok: false, error: { code, message: code } })

test("ohne Fehler wird im eingestellten Intervall abgefragt", () => {
  assert.equal(pollMinutes(3, 0), 3)
})

test("jeder Netz- oder Rate-Limit-Fehler in Folge verdoppelt das Intervall", () => {
  let failures = 0
  failures = failuresAfter(failures, fail("NETWORK"))
  assert.equal(pollMinutes(3, failures), 6)
  failures = failuresAfter(failures, fail("RATE_LIMITED"))
  assert.equal(pollMinutes(3, failures), 12)
})

test("das Intervall wächst höchstens bis 30 Minuten", () => {
  assert.equal(pollMinutes(3, 5), 30)
  assert.equal(pollMinutes(3, 100), 30)
})

test("ein eingestelltes Intervall über der Obergrenze bleibt", () => {
  assert.equal(pollMinutes(45, 3), 45)
})

test("nach einer erfolgreichen Antwort gilt wieder das normale Intervall", () => {
  const failures = failuresAfter(failuresAfter(0, fail("NETWORK")), { ok: true })
  assert.equal(failures, 0)
  assert.equal(pollMinutes(3, failures), 3)
})

test("andere Fehler ändern das Intervall nicht", () => {
  assert.equal(failuresAfter(0, fail("AUTH_REQUIRED")), 0)
  assert.equal(failuresAfter(2, fail("API_KEY_REJECTED")), 2)
})

test("die Bar nennt Ursache und nächsten Versuch", () => {
  assert.equal(errorTooltip("NETWORK", 6), "Calamari nicht erreichbar, nächster Versuch in 6 Min")
  assert.equal(errorTooltip("RATE_LIMITED", 12), "Calamari: zu viele Anfragen, nächster Versuch in 12 Min")
})

test("andere Fehler zeigen die Bar wie bisher", () => {
  assert.equal(errorTooltip("API_ERROR", 3), "Calamari: Fehler")
})
