// One test per module that produces prose, proving the translator actually
// reaches the string. Coverage of the catalogue is js/i18n.test.mjs's job;
// these cover wiring, which is the other way a language can fail: a module
// that never passes `t` on renders English however the setting is set.
//
// German is the language to assert in, because it is the one the plugin spoke
// before the catalogue existed — so these are also the last check that the
// move did not change a word.

import { test } from "node:test"
import assert from "node:assert/strict"
import { translator } from "./i18n.mjs"
import { applyStamp, emptyState, stampLabel } from "./shiftclock.mjs"
import { notification } from "./reminders.mjs"
import { headerView } from "./panelheader.mjs"
import { errorTooltip } from "./backoff.mjs"
import { timelineView } from "./daytimeline.mjs"
import { formCards, formFields, formTexts, readForm } from "./settingsform.mjs"

const de = translator("de")
const at = (clock) => new Date(`2026-09-22T${clock}`)

test("shiftclock: the stamp label and the failure text are the translator's", () => {
  assert.equal(stampLabel("clock-in"), "Clock in")
  assert.equal(stampLabel("clock-in", de), "Einstempeln")

  const out = { ok: false, error: { code: "NETWORK" } }
  assert.equal(
    applyStamp(emptyState(), "break-start", out, at("11:00"), de).error,
    "Pause beginnen fehlgeschlagen: Calamari nicht erreichbar. Es wird nichts nachgereicht.",
  )
})

test("reminders: the notification is the translator's", () => {
  const action = { type: "soft-hint", coreEnd: "16:45" }
  assert.deepEqual(notification(action, null, {}, {}), {
    headline: "A shift is still running",
    body: "The core time ended at 16:45.",
    click: "panel",
  })
  assert.deepEqual(notification(action, null, {}, {}, de), {
    headline: "Schicht läuft noch",
    body: "Die Kernzeit endete um 16:45.",
    click: "panel",
  })
})

test("panelheader: the caption is the translator's", () => {
  const view = { kind: "error", text: "" }
  const args = { view, state: {}, now: at("11:00"), day: null, config: {} }
  assert.equal(headerView(args).caption, "Shift status unknown")
  assert.equal(headerView(Object.assign({ t: de }, args)).caption, "Schichtstatus unbekannt")
})

test("backoff: the bar's error tooltip is the translator's", () => {
  assert.equal(errorTooltip("NETWORK", 6), "Calamari cannot be reached, next attempt in 6 min")
  assert.equal(errorTooltip("NETWORK", 6, de), "Calamari nicht erreichbar, nächster Versuch in 6 Min")
})

test("daytimeline: the day line's tooltip is the translator's", () => {
  const state = Object.assign(emptyState(), { date: "2026-09-22", running: false })
  const args = { state, now: at("11:00"), core: { start: 9 * 60, end: 16 * 60 + 45 } }
  assert.equal(timelineView(args).tooltip, "Core time 09:00–16:45")
  assert.equal(timelineView(Object.assign({ t: de }, args)).tooltip, "Kernzeit 09:00–16:45")
})

test("settingsform: the validation message is the translator's", () => {
  const schema = [{ key: "pollIntervalMinutes", type: "integer", min: 1, max: 60, defaultValue: 3 }]
  const texts = { pollIntervalMinutes: "999" }
  assert.equal(readForm(schema, texts).errors.pollIntervalMinutes, "A whole number from 1 to 60")
  assert.equal(readForm(schema, texts, de).errors.pollIntervalMinutes, "Eine ganze Zahl von 1 bis 60")
})

// The canonical token is the same value in every language, which is the whole
// point of it (ADR 0006): a setting saved in one language keeps its meaning in
// another.
test("settingsform: every locale's word for a day off stores the one token", () => {
  const schema = [{ key: "coreMonday", type: "string", format: "coreTime", defaultValue: "" }]
  for (const [locale, word] of [
    ["en", "off"],
    ["de", "frei"],
    ["pl", "wolne"],
    ["ru", "выходной"],
  ]) {
    const t = translator(locale)
    assert.equal(readForm(schema, { coreMonday: word }, t).settings.coreMonday, "frei", locale)
    // And the canonical token is accepted whatever the language.
    assert.equal(readForm(schema, { coreMonday: "frei" }, t).settings.coreMonday, "frei", locale)
  }
})

// QML hands an unset `var` property over as null, where a default parameter
// only answers to undefined. Node never does this, so nothing above would have
// caught it: the plugin failed in the running shell with a bare TypeError from
// inside settingsform.mjs while every test stayed green.
test("a null translator falls back to English instead of throwing", () => {
  const schema = [{ key: "pollIntervalMinutes", type: "integer", min: 1, max: 60, defaultValue: 3 }]
  assert.equal(formTexts(schema, {}, null).pollIntervalMinutes, "3")
  assert.equal(formFields(schema, {}, null)[0].label, "Polling interval (minutes)")
  assert.equal(formCards(schema, [], {}, null).length, 1)
  assert.equal(
    readForm(schema, { pollIntervalMinutes: "999" }, null).errors.pollIntervalMinutes,
    "A whole number from 1 to 60",
  )
  assert.equal(stampLabel("clock-in", null), "Clock in")
  assert.equal(errorTooltip("NETWORK", 6, null), "Calamari cannot be reached, next attempt in 6 min")
  assert.equal(
    notification({ type: "soft-hint", coreEnd: "16:45" }, null, {}, {}, null).headline,
    "A shift is still running",
  )
  assert.equal(
    headerView({ view: { kind: "error", text: "" }, state: {}, now: at("11:00"), day: null, config: {}, t: null })
      .caption,
    "Shift status unknown",
  )
  const state = Object.assign(emptyState(), { date: "2026-09-22", running: false })
  assert.equal(
    timelineView({ state, now: at("11:00"), core: { start: 540, end: 1005 }, t: null }).tooltip,
    "Core time 09:00–16:45",
  )
  assert.equal(
    applyStamp(emptyState(), "break-start", { ok: false, error: { code: "NETWORK" } }, at("11:00"), null).error,
    "Begin break failed: Calamari cannot be reached. Nothing will be filed later.",
  )
})
