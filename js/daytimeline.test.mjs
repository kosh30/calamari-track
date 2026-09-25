import { test } from "node:test"
import assert from "node:assert/strict"
import { placeMark, placeSegment, timelineView } from "./daytimeline.mjs"
import { toMinutes } from "./daytime.mjs"
import { applyStamp, applyStatus, emptyState } from "./shiftclock.mjs"

const at = (hhmm, date = "2026-09-22") => new Date(`${date}T${hhmm}:00`)

// Today's core time, the scale the line starts from.
const core = { start: toMinutes("09:00"), end: toMinutes("16:45") }

const line = (state, now, ownCore = core) => timelineView({ state, now, core: ownCore })

// A shift that started at `from` and still runs at `now`.
function running(state, from, now = from) {
  return applyStatus(state, "running", at(now), { startedAt: from }).state
}

// A shift from `start` to `end`, ended by the own clock-out (the path that
// puts it into state.shifts).
function ended(state, start, end) {
  return applyStamp(running(state, start), "clock-out", { ok: true }, at(end)).state
}

function onBreak(state, from, since, now) {
  return applyStatus(running(state, from), "break", at(now), { startedAt: from, breakSince: since }).state
}

// The share of the line a moment sits at, so the expectations read as times
// instead of as decimals.
const share = (hhmm, from = "09:00", to = "16:45") =>
  (toMinutes(hhmm) - toMinutes(from)) / (toMinutes(to) - toMinutes(from))

test("die Zeile spannt über die Kernzeit und trägt ihre Enden als Beschriftung", () => {
  const v = line(running(emptyState(), "09:30", "11:00"), at("11:00"))
  assert.equal(v.startText, "09:00")
  assert.equal(v.endText, "16:45")
})

test("die laufende Schicht ist ein Abschnitt von ihrem Beginn bis jetzt", () => {
  const v = line(running(emptyState(), "09:30", "11:00"), at("11:00"))
  assert.equal(v.segments.length, 1)
  assert.equal(v.segments[0].from, share("09:30"))
  assert.equal(v.segments[0].to, share("11:00"))
  assert.equal(v.segments[0].running, true)
})

test("die Jetzt-Markierung sitzt auf der laufenden Minute", () => {
  const v = line(running(emptyState(), "09:30", "11:00"), at("11:00"))
  assert.equal(v.nowFraction, share("11:00"))
})

test("mehrere Schichten an einem Tag erscheinen als getrennte Abschnitte", () => {
  const state = ended(ended(emptyState(), "09:00", "12:00"), "13:00", "15:00")
  const v = line(state, at("15:30"))
  assert.equal(v.segments.length, 2)
  assert.deepEqual(
    v.segments.map((s) => [s.from, s.to]),
    [
      [share("09:00"), share("12:00")],
      [share("13:00"), share("15:00")],
    ],
  )
  // Keine laufende Schicht: kein Abschnitt trägt die Akzentfarbe.
  assert.deepEqual(
    v.segments.map((s) => s.running),
    [false, false],
  )
})

test("die laufende Pause ist ausgespart: der Abschnitt endet an ihrem Beginn", () => {
  const v = line(onBreak(emptyState(), "09:00", "12:30", "12:30"), at("13:10"))
  assert.equal(v.segments.length, 1)
  assert.equal(v.segments[0].to, share("12:30"))
  // Die Schicht läuft während der Pause weiter.
  assert.equal(v.segments[0].running, true)
  assert.equal(v.nowFraction, share("13:10"))
})

test("eine Schicht vor der Kernzeit weitet die Spanne, statt abgeschnitten zu werden", () => {
  const v = line(running(emptyState(), "07:30", "11:00"), at("11:00"))
  assert.equal(v.startText, "07:30")
  assert.equal(v.endText, "16:45")
  assert.equal(v.segments[0].from, 0)
  assert.equal(v.segments[0].to, share("11:00", "07:30"))
})

test("eine Schicht über die Kernzeit hinaus weitet die Spanne bis zu ihrem Ende", () => {
  const v = line(ended(emptyState(), "09:00", "18:20"), at("18:30"))
  assert.equal(v.endText, "18:20")
  assert.equal(v.segments[0].to, 1)
})

test("die laufende Schicht zieht die Spanne über die Kernzeit hinaus bis jetzt", () => {
  const v = line(running(emptyState(), "09:00", "17:30"), at("17:30"))
  assert.equal(v.endText, "17:30")
  assert.equal(v.nowFraction, 1)
})

test("die laufende Pause hält die Zeile offen, auch nach dem Ende der Kernzeit", () => {
  // Die Schicht läuft weiter: ohne jetzt in der Spanne verschwände die
  // Markierung mitten in der laufenden Schicht.
  const v = line(onBreak(emptyState(), "09:00", "16:30", "16:30"), at("17:00"))
  assert.equal(v.endText, "17:00")
  assert.equal(v.nowFraction, 1)
})

test("nach dem Feierabend wächst die Zeile nicht mit der Uhr weiter", () => {
  // Sonst quetschte der gearbeitete Tag im Laufe des Abends immer weiter
  // nach links, an einem völlig gewöhnlichen Tag.
  const abend = ended(emptyState(), "09:00", "16:00")
  assert.equal(line(abend, at("17:30")).endText, "16:45")
  assert.equal(line(abend, at("22:00")).endText, "16:45")
  assert.deepEqual(line(abend, at("22:00")).segments, line(abend, at("17:30")).segments)
})

test("jenseits des Zeilenendes gibt es keine Jetzt-Markierung, statt einer falschen am Rand", () => {
  assert.equal(line(ended(emptyState(), "09:00", "16:00"), at("17:30")).nowFraction, null)
})

test("ohne Stempelung ist die Zeile nach der Kernzeit weg, nicht leer", () => {
  assert.equal(line(emptyState(), at("17:30")), null)
})

test("vor dem Beginn der Kernzeit und ohne Arbeit gibt es keine Zeile", () => {
  assert.equal(line(emptyState(), at("07:00")), null)
})

test("ohne Kernzeit gibt es keine Zeile: freier Tag, Tag ohne Plan", () => {
  assert.equal(line(running(emptyState(), "09:30", "11:00"), at("11:00"), null), null)
})

test("in der Kernzeit ohne Stempelung steht die Zeile leer da, mit der Markierung", () => {
  const v = line(emptyState(), at("10:00"))
  assert.deepEqual(v.segments, [])
  assert.equal(v.nowFraction, share("10:00"))
})

test("der Zustand eines anderen Tages trägt keine Abschnitte bei", () => {
  const yesterday = ended(emptyState(), "09:00", "17:00")
  assert.equal(yesterday.date, "2026-09-22")
  const v = timelineView({ state: yesterday, now: at("10:00", "2026-09-23"), core })
  assert.deepEqual(v.segments, [])
})

test("eine Schicht ohne bekannten Beginn wird nicht erfunden", () => {
  const v = line(applyStatus(emptyState(), "running", at("11:00")).state, at("11:00"))
  assert.equal(v.segments.length, 0)
})

test("Abschnitte stehen nach der Zeit, auch wenn eine Endzeit später nachkam", () => {
  // end-time kann die Endzeit einer früheren Schicht nachreichen, nachdem
  // eine spätere schon beendet ist (js/shiftclock.mjs applyEndTime).
  const state = Object.assign(ended(emptyState(), "13:00", "15:00"), {
    shifts: [
      { start: "13:00", end: "15:00" },
      { start: "09:30", end: "11:00" },
    ],
  })
  const v = line(state, at("15:30"))
  assert.deepEqual(
    v.segments.map((s) => s.from),
    [share("09:30"), share("13:00")],
  )
})

test("der Tooltip nennt die Kernzeit und die genauen Zeiten der Schichten", () => {
  const state = running(ended(emptyState(), "09:00", "12:00"), "12:30", "14:00")
  assert.equal(
    line(state, at("14:00")).tooltip,
    ["Kernzeit 09:00–16:45", "Schicht 09:00–12:00", "Schicht seit 12:30 (läuft)"].join("\n"),
  )
})

test("der Tooltip nennt die laufende Pause und wie genau ihr Beginn bekannt ist", () => {
  const known = onBreak(emptyState(), "09:00", "12:30", "12:30")
  assert.equal(
    line(known, at("13:10")).tooltip,
    ["Kernzeit 09:00–16:45", "Schicht seit 09:00 (läuft)", "Pause seit 12:30"].join("\n"),
  )
  const guessed = applyStatus(running(emptyState(), "09:00"), "break", at("12:40")).state
  assert.ok(line(guessed, at("13:10")).tooltip.endsWith("Pause seit spätestens 12:40"))
})

test("beendete Pausen stecken in den Schichten: der Tooltip sagt das, statt sie auszusparen", () => {
  // Beendete Pausen liegen nur als Minutensumme im Zustand, nicht als
  // Intervalle — aussparen lässt sich nur die laufende.
  const back = applyStatus(onBreak(emptyState(), "09:00", "12:30", "12:30"), "running", at("13:00"), {
    startedAt: "09:00",
  }).state
  assert.equal(back.breakMinutes, 30)
  assert.ok(line(back, at("14:00")).tooltip.endsWith("Beendete Pausen: 0:30 (in den Schichten enthalten)"))
})

test("ohne beendete Pause schweigt der Tooltip darüber", () => {
  assert.ok(!line(ended(emptyState(), "09:00", "12:00"), at("13:00")).tooltip.includes("Beendete Pausen"))
})

test("die Zeile bleibt heil, wenn die Kernzeit nur eine Minute lang ist", () => {
  // coreTime() lässt start < end zu, also auch eine Minute (halber Feiertag
  // auf einen kurzen Plan). Geteilt wird dann durch 1, nicht durch 0.
  const minute = { start: toMinutes("09:00"), end: toMinutes("09:01") }
  const v = line(running(emptyState(), "09:00", "09:00"), at("09:00"), minute)
  assert.equal(v.nowFraction, 0)
  assert.equal(v.segments[0].from, 0)
  assert.equal(v.segments[0].to, 0)
})

test("ein Abschnitt von wenigen Minuten behält eine Mindestbreite", () => {
  // Sonst wäre eine Schicht von einer Minute auf 300 Pixeln unsichtbar.
  assert.deepEqual(placeSegment({ from: 0.5, to: 0.5 }, 300, 2), { x: 150, width: 2 })
})

test("ein längerer Abschnitt behält seinen Anteil an der Zeile", () => {
  assert.deepEqual(placeSegment({ from: 0, to: 0.5 }, 300, 2), { x: 0, width: 150 })
})

test("ein Abschnitt am Ende bleibt samt Mindestbreite in der Zeile", () => {
  const place = placeSegment({ from: 1, to: 1 }, 300, 2)
  assert.equal(place.x, 298)
  assert.equal(place.width, 2)
})

test("die Jetzt-Markierung bleibt an beiden Rändern in der Zeile", () => {
  assert.deepEqual(placeMark(1, 300, 2), { x: 298, width: 2 })
  assert.deepEqual(placeMark(0, 300, 2), { x: 0, width: 2 })
})
