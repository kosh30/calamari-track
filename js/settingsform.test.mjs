import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { formCards, formFields, formTexts, readForm } from "./settingsform.mjs"

const widget = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url))).barWidget
const schema = widget.schema
const byKey = (fields) => Object.fromEntries(fields.map((f) => [f.key, f]))

test("das Formular zeigt jede Einstellung mit ihrem aktuellen Wert oder dem Standardwert", () => {
  const fields = byKey(formFields(schema, { stampReminderMinutes: 1, coreFriday: "08:00-13:00" }))
  assert.equal(fields.stampReminderMinutes.text, "1")
  assert.equal(fields.pollIntervalMinutes.text, "3")
  assert.equal(fields.coreFriday.text, "08:00-13:00")
  assert.equal(fields.finalWarningTime.text, "19:00")
  assert.equal(fields.stampReminderMinutes.label, "Stempel-Erinnerung wiederholen alle (Minuten)")
  assert.deepEqual(
    formFields(schema, {}).map((f) => f.key),
    schema.map((f) => f.key),
  )
})

const texts = (changes) =>
  Object.assign(Object.fromEntries(formFields(schema, {}).map((f) => [f.key, f.text])), changes)

test("gültige Eingaben werden zu Einstellungen, Zahlen als Zahlen", () => {
  const r = readForm(
    schema,
    texts({
      stampReminderMinutes: " 2 ",
      finalWarningTime: "18:30",
      coreFriday: "8:00-13:00",
      coreMonday: "frei",
      webUrl: "https://firma.calamari.io",
    }),
  )
  assert.deepEqual(r.errors, {})
  assert.equal(r.settings.stampReminderMinutes, 2)
  assert.equal(r.settings.finalWarningTime, "18:30")
  assert.equal(r.settings.coreFriday, "8:00-13:00")
  assert.equal(r.settings.coreMonday, "frei")
  assert.equal(r.settings.coreTuesday, "")
  assert.equal(r.settings.webUrl, "https://firma.calamari.io")
})

test("ungültige Eingaben nennen, was erwartet wird", () => {
  const r = readForm(
    schema,
    texts({
      stampReminderMinutes: "0",
      pollIntervalMinutes: "drei",
      finalWarningTime: "25:00",
      coreFriday: "13:00-08:00",
      webUrl: "firma.calamari.io",
    }),
  )
  assert.equal(r.settings, null)
  assert.deepEqual(r.errors, {
    stampReminderMinutes: "Eine ganze Zahl von 1 bis 60",
    pollIntervalMinutes: "Eine ganze Zahl von 1 bis 60",
    finalWarningTime: "Eine Uhrzeit wie 19:00",
    coreFriday: "Leer, „frei“ oder eine Kernzeit wie 09:00-16:45",
    webUrl: "Leer oder eine Adresse wie https://firma.calamari.io",
  })
})

// A schema of our own, so the grouping is tested on what it does rather than
// on whatever the manifest happens to hold today.
const grouped = [
  { key: "a", label: "A", type: "string", defaultValue: "", group: "second" },
  { key: "b", label: "B", type: "string", defaultValue: "", group: "first" },
  { key: "c", label: "C", type: "string", defaultValue: "", group: "second" },
]
const groups = [
  { key: "first", title: "Erste" },
  { key: "second", title: "Zweite", description: "Gilt für alle drei" },
  { key: "empty", title: "Leer" },
]

const keysOf = (group) => group.fields.map((f) => f.key)

test("die Gruppen stehen in der Reihenfolge des Manifests, mit ihren Feldern", () => {
  const got = formCards(grouped, groups, {})
  assert.deepEqual(
    got.map((g) => g.key),
    ["first", "second"],
  )
  assert.deepEqual(keysOf(got[0]), ["b"])
  assert.deepEqual(keysOf(got[1]), ["a", "c"])
})

test("eine Gruppe trägt ihren Titel und ihre gemeinsame Erklärung", () => {
  const [, second] = formCards(grouped, groups, {})
  assert.equal(second.title, "Zweite")
  assert.equal(second.description, "Gilt für alle drei")
})

test("eine Gruppe ohne Felder erscheint nicht", () => {
  assert.ok(!formCards(grouped, groups, {}).some((g) => g.key === "empty"))
})

test("ein Feld ohne Gruppe verschwindet nicht, sondern landet sichtbar am Ende", () => {
  const stray = grouped.concat([{ key: "d", label: "D", type: "string", defaultValue: "" }])
  const got = formCards(stray, groups, {})
  const last = got[got.length - 1]
  assert.deepEqual(keysOf(last), ["d"])
  assert.ok(last.title.length > 0)
})

test("eine Gruppe, die das Manifest nicht kennt, landet in derselben Sammlung", () => {
  const stray = grouped.concat([{ key: "d", label: "D", type: "string", defaultValue: "", group: "weg" }])
  const last = formCards(stray, groups, {}).at(-1)
  assert.deepEqual(keysOf(last), ["d"])
})

test("die Felder einer Gruppe tragen ihren Wert wie im flachen Formular", () => {
  const [, second] = formCards(grouped, groups, { a: "gesetzt" })
  assert.equal(second.fields[0].text, "gesetzt")
})

test("die sieben Kernzeiten stehen als eine Gruppe mit einer gemeinsamen Erklärung", () => {
  const core = formCards(schema, widget.groups, {}).find((g) => g.fields.some((f) => f.key === "coreMonday"))
  assert.equal(core.fields.length, 7)
  assert.ok(core.description.length > 0)
  // The explanation moved to the card, so the fields are just the weekdays.
  assert.deepEqual(keysOf(core)[0], "coreMonday")
  assert.equal(core.fields[0].label, "Montag")
})

test("die Texte des Formulars stehen flach beim Schlüssel ihres Feldes", () => {
  const texts = formTexts(grouped, { a: "gesetzt" })
  assert.deepEqual(texts, { a: "gesetzt", b: "", c: "" })
})

test("die Texte decken jedes Feld ab, auch das ohne Gruppe", () => {
  const stray = grouped.concat([{ key: "d", label: "D", type: "string", defaultValue: "x" }])
  assert.deepEqual(Object.keys(formTexts(stray, {})).sort(), ["a", "b", "c", "d"])
})
