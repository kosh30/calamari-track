import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { formFields, readForm } from "./settingsform.mjs"

const schema = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url))).barWidget.schema
const byKey = fields => Object.fromEntries(fields.map(f => [f.key, f]))

test("das Formular zeigt jede Einstellung mit ihrem aktuellen Wert oder dem Standardwert", () => {
  const fields = byKey(formFields(schema, { stampReminderMinutes: 1, coreFriday: "08:00-13:00" }))
  assert.equal(fields.stampReminderMinutes.text, "1")
  assert.equal(fields.pollIntervalMinutes.text, "3")
  assert.equal(fields.coreFriday.text, "08:00-13:00")
  assert.equal(fields.finalWarningTime.text, "19:00")
  assert.equal(fields.stampReminderMinutes.label, "Stempel-Erinnerung wiederholen alle (Minuten)")
  assert.deepEqual(formFields(schema, {}).map(f => f.key), schema.map(f => f.key))
})

const texts = changes => Object.assign(Object.fromEntries(formFields(schema, {}).map(f => [f.key, f.text])), changes)

test("gültige Eingaben werden zu Einstellungen, Zahlen als Zahlen", () => {
  const r = readForm(schema, texts({ stampReminderMinutes: " 2 ", finalWarningTime: "18:30", coreFriday: "8:00-13:00",
    coreMonday: "frei", webUrl: "https://firma.calamari.io" }))
  assert.deepEqual(r.errors, {})
  assert.equal(r.settings.stampReminderMinutes, 2)
  assert.equal(r.settings.finalWarningTime, "18:30")
  assert.equal(r.settings.coreFriday, "8:00-13:00")
  assert.equal(r.settings.coreMonday, "frei")
  assert.equal(r.settings.coreTuesday, "")
  assert.equal(r.settings.webUrl, "https://firma.calamari.io")
})

test("ungültige Eingaben nennen, was erwartet wird", () => {
  const r = readForm(schema, texts({ stampReminderMinutes: "0", pollIntervalMinutes: "drei", finalWarningTime: "25:00",
    coreFriday: "13:00-08:00", webUrl: "cti.calamari.io" }))
  assert.equal(r.settings, null)
  assert.deepEqual(r.errors, {
    stampReminderMinutes: "Eine ganze Zahl von 1 bis 60",
    pollIntervalMinutes: "Eine ganze Zahl von 1 bis 60",
    finalWarningTime: "Eine Uhrzeit wie 19:00",
    coreFriday: "Leer, „frei“ oder eine Kernzeit wie 09:00-16:45",
    webUrl: "Leer oder eine Adresse wie https://firma.calamari.io",
  })
})
