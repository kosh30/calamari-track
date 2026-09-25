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

test("Fehler, die auf den Benutzer warten, nennen die Abhilfe statt eines nächsten Versuchs", () => {
  assert.equal(errorTooltip("API_URL_REQUIRED", 3),
    "Calamari: REST-API-URL fehlt, bitte in den Einstellungen setzen")
  assert.equal(errorTooltip("API_KEY_REQUIRED", 3),
    "Calamari: API-Key fehlt, bitte bin/calamari api-key ausführen")
  assert.equal(errorTooltip("API_KEY_REJECTED", 3),
    "Calamari lehnt den API-Key ab, bitte bin/calamari api-key erneut ausführen")
  assert.equal(errorTooltip("API_TERMINAL_MISSING", 3),
    "Calamari: API Terminal fehlt in Clockin")
  assert.equal(errorTooltip("API_SCOPE_MISSING", 3),
    "Calamari: dem API-Key fehlt eine Berechtigung")
})

test("kein Warten hilft, also steht in diesen Hinweisen keine Wartezeit", () => {
  for (const code of ["API_URL_REQUIRED", "API_KEY_REQUIRED", "API_SCOPE_MISSING"])
    assert.ok(!errorTooltip(code, 30).includes("nächster Versuch"), code)
})

// AUTH_REQUIRED never reaches errorTooltip: it turns authState to
// "required", and barView answers with the view "auth" before the error.
test("die nötige Anmeldung bleibt Sache der Ansicht auth", () => {
  assert.equal(errorTooltip("AUTH_REQUIRED", 3), "Calamari: Fehler")
})
