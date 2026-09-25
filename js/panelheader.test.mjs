import { test } from "node:test"
import assert from "node:assert/strict"
import { headerView } from "./panelheader.mjs"
import { applyStamp, applyStatus, barView, emptyState, setDayOff } from "./shiftclock.mjs"

const at = (hhmm, date = "2026-09-22") => new Date(`${date}T${hhmm}:00`)
const workday = { date: "2026-09-22", workingDay: true, coreStart: "09:00", coreEnd: "16:45" }
const config = {}

// The panel builds the view the same way the bar does, so the tests go
// through the real barView instead of hand-written kinds.
const view = (state, now, extra = {}) =>
  barView(Object.assign({ state, now, authState: "ok", failed: false, reminding: false }, extra))

const header = (state, now, opts = {}) =>
  headerView({
    view: opts.view || view(state, now, opts.viewOpts),
    state,
    now,
    day: "day" in opts ? opts.day : workday,
    config: opts.config || config,
  })

// A shift that started at `from` and still runs at `now`.
function running(from, now = from) {
  return applyStatus(emptyState(), "running", at(now), { startedAt: from }).state
}

function onBreak(from, since, now) {
  const shift = applyStatus(emptyState(), "running", at(from), { startedAt: from }).state
  return applyStatus(shift, "break", at(now), { startedAt: from, breakSince: since }).state
}

test("die laufende Schichtdauer ist die große Zahl, ihre Einordnung steht darunter", () => {
  const h = header(running("08:14"), at("11:56"))
  assert.equal(h.duration, "3:42")
  assert.equal(h.caption, "Schicht läuft seit 08:14")
})

test("die Dauer steckt nicht mehr in der Einordnung, sondern nur in der großen Zahl", () => {
  const h = header(running("08:14"), at("11:56"))
  assert.ok(!h.caption.includes("3:42"), h.caption)
})

test("in der Pause zählt die Pausendauer, und die Einordnung nennt ihren Beginn", () => {
  const h = header(onBreak("08:00", "12:30", "12:30"), at("13:00"))
  assert.equal(h.duration, "0:30")
  assert.equal(h.caption, "Pause seit 12:30")
})

test("ist der Beginn der Pause nur geschätzt, sagt die Einordnung das", () => {
  const shift = applyStatus(running("08:00"), "break", at("12:40")).state
  assert.equal(header(shift, at("13:00")).caption, "Pause seit spätestens 12:40")
})

test("ohne laufende Schicht gibt es keine Zahl, nur die Einordnung", () => {
  const idle = applyStatus(emptyState(), "stopped", at("17:30")).state
  const h = header(idle, at("18:00"))
  assert.equal(h.duration, "")
  assert.equal(h.caption, "Keine laufende Schicht")
})

test("nach dem eigenen Feierabend nennt die Einordnung dessen Uhrzeit", () => {
  const out = applyStamp(running("08:00"), "clock-out", { ok: true }, at("17:30")).state
  assert.equal(header(out, at("18:00")).caption, "Feierabend seit 17:30")
})

test("solange der Status unbekannt ist, steht dort keine Zahl", () => {
  const h = header(emptyState(), at("09:30"))
  assert.equal(h.duration, "")
  assert.equal(h.caption, "Schichtstatus wird abgefragt …")
})

test("im Fehlerfall bleibt die Zahl leer und die Einordnung sagt, was nicht geht", () => {
  const h = header(running("08:00"), at("11:00"), { viewOpts: { failed: true } })
  assert.equal(h.duration, "")
  assert.equal(h.caption, "Schichtstatus unbekannt")
})

test("fehlt die Anmeldung, sagt die Einordnung das statt einer Schichtangabe", () => {
  // Das Panel zeigt den Kopfbereich dann nicht, aber barView kennt die Art
  // "auth", und headerView antwortet für jede Art, die es liefert.
  const h = header(running("08:00"), at("11:00"), { viewOpts: { authState: "required" } })
  assert.equal(h.duration, "")
  assert.equal(h.caption, "Anmeldung nötig")
})

test("läuft die Kernzeit ohne Schicht, sagt die Einordnung das", () => {
  const idle = applyStatus(emptyState(), "stopped", at("09:30")).state
  const h = header(idle, at("09:30"), { viewOpts: { reminding: true } })
  assert.equal(h.duration, "")
  assert.equal(h.caption, "Noch nicht eingestempelt, die Kernzeit läuft")
})

test("läuft eine Schicht, deren Beginn Calamari nicht kennt, gibt es keine erfundene Zahl", () => {
  const h = header(applyStatus(emptyState(), "running", at("11:00")).state, at("11:00"))
  assert.equal(h.duration, "")
  assert.equal(h.caption, "Schicht läuft")
})

test("der Balken misst die Kernzeit: zur Hälfte durch ist er halb voll", () => {
  // 09:00–16:45 ist 465 Minuten, die Hälfte liegt 232,5 Minuten später.
  const h = header(running("08:00"), at("12:52"))
  assert.equal(Math.round(h.progress.fraction * 100), 50)
  assert.equal(h.progress.text, "noch 3:53 bis Ende der Kernzeit")
})

test("die Restzeit zählt bis zum Ende der Kernzeit, nicht bis zum Feierabend", () => {
  assert.equal(header(running("08:00"), at("16:00")).progress.text, "noch 0:45 bis Ende der Kernzeit")
})

test("vor dem Beginn der Kernzeit gibt es keinen leeren Balken", () => {
  assert.equal(header(running("07:30"), at("08:00")).progress, null)
})

test("ab dem Beginn der Kernzeit ist der Balken da, auch wenn er noch bei null steht", () => {
  const h = header(running("07:30"), at("09:00"))
  assert.equal(h.progress.fraction, 0)
  assert.equal(h.progress.text, "noch 7:45 bis Ende der Kernzeit")
})

test("nach dem Ende der Kernzeit ist der Balken voll und sagt es", () => {
  const h = header(running("08:00"), at("17:30"))
  assert.equal(h.progress.fraction, 1)
  assert.equal(h.progress.text, "Kernzeit beendet")
})

test("ohne Kernzeit entfällt der Balken ersatzlos", () => {
  assert.equal(header(running("08:00"), at("11:00"), { day: null }).progress, null)
  const noCore = { date: "2026-09-22", workingDay: false }
  assert.equal(header(running("08:00"), at("11:00"), { day: noCore }).progress, null)
})

test("an einem freien Tag entfällt der Balken", () => {
  const holiday = Object.assign({}, workday, { holiday: { halfDay: false } })
  assert.equal(header(running("08:00"), at("11:00"), { day: holiday }).progress, null)
})

test("„Heute frei“ nimmt den Balken weg, ohne die Schicht anzurühren", () => {
  const state = setDayOff(running("08:00"), true, at("11:00"))
  const h = header(state, at("11:00"))
  assert.equal(h.progress, null)
  assert.equal(h.duration, "3:00")
})

test("ein „Heute frei“ von gestern nimmt den heutigen Balken nicht weg", () => {
  // Der Schalter gilt nur für seinen Tag (ShiftClock.dayOffToday), und der
  // Knopf im Panel zeigt ihn morgens wieder aus. Bleibt der Status hängen
  // (Backoff nach einem Neustart), darf der Balken nicht still verschwinden,
  // während der Knopf „Heute frei" aus zeigt.
  const yesterday = setDayOff(emptyState(), true, at("11:00", "2026-09-21"))
  assert.equal(yesterday.dayOff, true)
  assert.equal(yesterday.date, "2026-09-21")
  const h = header(yesterday, at("11:00"))
  assert.equal(h.progress.text, "noch 5:45 bis Ende der Kernzeit")
})

test("die Tagesangabe eines anderen Tages zählt nicht", () => {
  const yesterday = Object.assign({}, workday, { date: "2026-09-21" })
  assert.equal(header(running("08:00"), at("11:00"), { day: yesterday }).progress, null)
})

test("der Balken hängt am Tag, nicht an der Schicht: auch in der Pause und ohne Schicht", () => {
  const pause = onBreak("08:00", "12:00", "12:00")
  assert.equal(header(pause, at("12:52")).progress.text, "noch 3:53 bis Ende der Kernzeit")
  const idle = applyStatus(emptyState(), "stopped", at("12:52")).state
  assert.equal(header(idle, at("12:52")).progress.text, "noch 3:53 bis Ende der Kernzeit")
})

test("die Einstellung einer eigenen Kernzeit schlägt den Plan aus Calamari", () => {
  const own = { coreTuesday: "10:00-12:00" }
  const h = header(running("08:00"), at("11:00"), { config: own })
  assert.equal(Math.round(h.progress.fraction * 100), 50)
  assert.equal(h.progress.text, "noch 1:00 bis Ende der Kernzeit")
})

test("die Einstellung „frei“ nimmt den Balken weg", () => {
  const h = header(running("08:00"), at("11:00"), { config: { coreTuesday: "frei" } })
  assert.equal(h.progress, null)
})
