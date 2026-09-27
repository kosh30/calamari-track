import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { LOCALES, DEFAULT_LOCALE, translator, t, knownLocale, catalogue, hasMessage } from "./i18n.mjs"

const widget = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8")).barWidget

// Every message that takes values, with the values it takes. The table is not
// documentation: the test below fails when a function message is missing from
// it, so a new message cannot be added without saying what it interpolates.
// The values are distinctive on purpose — they are searched for in the output.
const PARAMS = {
  "cause.projectUnknown": { project: "Kunde B" },
  "cause.breakTypeUnknown": { breakType: "Siesta" },
  "stamp.failed": { action: "ACTION", cause: "CAUSE" },
  "stamp.mismatch": { action: "ACTION", says: "SAYS" },
  "stamp.noShift": { action: "ACTION" },
  "stamp.noShiftCheck": { action: "ACTION" },
  "shift.workedToday": { span: "6:12" },
  "break.sinceAtLatest": { time: "12:30" },
  "header.breakSince": { since: "12:30" },
  "header.endOfDaySince": { time: "17:30" },
  "header.runningSince": { time: "08:14" },
  "header.coreLeft": { span: "2:15" },
  "backoff.retryIn": { minutes: 6 },
  "backoff.network": { retry: "RETRY" },
  "backoff.rateLimited": { retry: "RETRY" },
  "timeline.coreTime": { from: "09:00", to: "16:45" },
  "timeline.shiftSince": { from: "09:00" },
  "timeline.shiftRange": { from: "09:00", to: "12:30" },
  "timeline.breakSince": { since: "12:30" },
  "timeline.endedBreaks": { span: "0:45" },
  "notify.softHint.body": { coreEnd: "16:45" },
  "notify.finalWarning.body": { at: "19:15", extend: "EXTEND", alt: "ALT" },
  "notify.autoClosed.body": { at: "19:15" },
  "notify.autoClosed.bodyWithActivity": { at: "19:15", lastActivity: "18:02" },
  "notify.dayEndClosed.body": { date: "DATE" },
  "notify.dayEndClosed.bodyWithActivity": { date: "DATE", lastActivity: "18:02" },
  "notify.breakReminder.body": { since: "12:30" },
  "notify.stampReminder.body": { coreStart: "09:00" },
  "panel.countdown": { at: "19:15", left: 7 },
  "panel.extendMinutes": { minutes: 45 },
  "login.asUser": { name: "Erika Mustermann" },
  "validate.integer": { min: 1, max: 60 },
  "validate.coreTime": { off: "OFF" },
  "validate.choice": { options: "English, Deutsch" },
  "group.core.description": { off: "OFF" },
  "date.dayMonth": { day: "21", month: "09" },
}

test("the default locale is English and every catalogue is registered", () => {
  assert.equal(DEFAULT_LOCALE, "en")
  assert.deepEqual(LOCALES, ["en", "de", "pl", "ru"])
  for (const locale of LOCALES) assert.equal(knownLocale(locale), true)
  assert.equal(knownLocale("fr"), false)
})

test("a translator answers in its own language", () => {
  assert.equal(translator("en")("settings.save"), "Save")
  assert.equal(translator("de")("settings.save"), "Speichern")
  assert.equal(translator("pl")("settings.save"), "Zapisz")
  assert.equal(translator("ru")("settings.save"), "Сохранить")
})

test("the bare translator is English", () => {
  assert.equal(t("settings.save"), "Save")
})

test("an unknown locale is the default rather than an error", () => {
  assert.equal(translator("fr")("settings.save"), "Save")
  assert.equal(translator(undefined)("settings.save"), "Save")
  assert.equal(translator(null)("settings.save"), "Save")
  assert.equal(translator("")("settings.save"), "Save")
})

test("an unknown id renders as the id, never as undefined", () => {
  const out = translator("de")("nothing.here")
  assert.equal(out, "nothing.here")
  assert.doesNotMatch(out, /undefined/)
})

test("a message that wants values survives being given none", () => {
  for (const locale of LOCALES) {
    for (const id of Object.keys(PARAMS)) {
      for (const params of [undefined, null, {}]) {
        const out = translator(locale)(id, params)
        assert.equal(typeof out, "string", `${locale} ${id}`)
      }
    }
  }
})

// The test that makes the English fallback a safety net instead of a hiding
// place: without it, a missing translation silently reads as English forever.
test("every locale carries every id of the reference catalogue", () => {
  const reference = Object.keys(catalogue(DEFAULT_LOCALE)).sort()
  for (const locale of LOCALES) {
    assert.deepEqual(Object.keys(catalogue(locale)).sort(), reference, `catalogue ${locale}`)
  }
})

// A string where the reference has a function would drop its values without a
// word — the sentence would simply lose its time.
test("a message is a function in every locale or in none", () => {
  const reference = catalogue(DEFAULT_LOCALE)
  for (const locale of LOCALES) {
    const messages = catalogue(locale)
    for (const id of Object.keys(reference)) {
      assert.equal(typeof messages[id], typeof reference[id], `${locale} ${id}`)
    }
  }
})

test("every message renders as a non-empty string in every locale", () => {
  for (const locale of LOCALES) {
    for (const id of Object.keys(catalogue(locale))) {
      const out = translator(locale)(id, PARAMS[id])
      assert.equal(typeof out, "string", `${locale} ${id}`)
      assert.notEqual(out.trim(), "", `${locale} ${id}`)
      assert.doesNotMatch(out, /undefined|\[object/, `${locale} ${id}`)
    }
  }
})

test("the params table covers exactly the messages that take values", () => {
  const reference = catalogue(DEFAULT_LOCALE)
  const functions = Object.keys(reference)
    .filter((id) => typeof reference[id] === "function")
    .sort()
  assert.deepEqual(Object.keys(PARAMS).sort(), functions)
})

// A translation that forgets to place a value loses it silently: the sentence
// still reads, just without the time in it.
test("every locale places every value it is given", () => {
  for (const locale of LOCALES) {
    for (const [id, params] of Object.entries(PARAMS)) {
      const out = translator(locale)(id, params)
      for (const value of Object.values(params)) {
        assert.ok(out.includes(String(value)), `${locale} ${id} drops ${value}`)
      }
    }
  }
})

test("Calamari's own values are quoted, not translated", () => {
  for (const locale of LOCALES) {
    assert.ok(translator(locale)("cause.projectUnknown", { project: "Kunde B" }).includes("Kunde B"))
    assert.ok(translator(locale)("cause.breakTypeUnknown", { breakType: "Siesta" }).includes("Siesta"))
  }
})

test("the day-month order is the locale's own", () => {
  const p = { day: "21", month: "09" }
  assert.equal(translator("de")("date.dayMonth", p), "21.09.")
  assert.equal(translator("pl")("date.dayMonth", p), "21.09.")
  assert.equal(translator("ru")("date.dayMonth", p), "21.09.")
  assert.equal(translator("en")("date.dayMonth", p), "09/21")
})

test("the word for a day without a core time is the locale's own", () => {
  assert.equal(translator("en")("coreTime.off"), "off")
  assert.equal(translator("de")("coreTime.off"), "frei")
  assert.equal(translator("pl")("coreTime.off"), "wolne")
  assert.equal(translator("ru")("coreTime.off"), "выходной")
})

// The settings form falls back to the manifest's own label when the catalogue
// lacks an id. That fallback is for a field just added, not for the normal
// case, so the normal case is asserted here: a field or group the catalogue
// does not know would otherwise show an English label in a Russian form and
// nothing would fail.
test("the catalogue names every schema field, in every locale", () => {
  for (const field of widget.schema) {
    const id = `setting.${field.key}`
    assert.ok(hasMessage(id), `no catalogue entry for ${id}`)
    for (const locale of LOCALES) {
      assert.notEqual(translator(locale)(id).trim(), "", `${locale} ${id}`)
    }
  }
})

test("the catalogue names every schema group, in every locale", () => {
  for (const group of widget.groups) {
    const id = `group.${group.key}`
    assert.ok(hasMessage(id), `no catalogue entry for ${id}`)
    for (const locale of LOCALES) {
      assert.notEqual(translator(locale)(id).trim(), "", `${locale} ${id}`)
    }
  }
})

test("the language setting offers exactly the locales that have a catalogue", () => {
  const field = widget.schema.find((entry) => entry.key === "language")
  assert.deepEqual(
    field.options.map((option) => option.value),
    LOCALES,
  )
  assert.equal(field.defaultValue, DEFAULT_LOCALE)
  assert.equal(widget.defaults.language, DEFAULT_LOCALE)
})
