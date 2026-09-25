import { test } from "node:test"
import assert from "node:assert/strict"
import { thumb } from "./scrollindicator.mjs"

// A track 100 px tall, so the expectations read as percentages, and a floor
// of 12 px, the shortest thumb that still reads as one.
const place = (position, ratio) => thumb(position, ratio, 100, 12)

test("passt der Inhalt ins Fenster, ist nichts zu sehen", () => {
  assert.equal(place(0, 1).visible, false)
})

test("bei Überlauf zeigt der Balken, welcher Anteil im Fenster steht", () => {
  assert.deepEqual(place(0, 0.5), { visible: true, y: 0, height: 50 })
})

test("der Balken folgt der Scrollposition", () => {
  assert.equal(place(0.25, 0.5).y, 25)
})

test("am Ende des Inhalts steht der Balken bündig am unteren Rand", () => {
  const t = place(0.75, 0.25)
  assert.equal(t.y + t.height, 100)
})

test("bei sehr langem Inhalt bleibt der Balken sichtbar lang", () => {
  assert.equal(place(0, 0.02).height, 12)
})

test("der auf die Mindestlänge gebrachte Balken tritt unten nicht aus", () => {
  const t = place(0.98, 0.02)
  assert.equal(t.y, 88)
  assert.equal(t.y + t.height, 100)
})

test("eine Scrollposition über den Rand hinaus hält den Balken drinnen", () => {
  assert.equal(place(-0.2, 0.5).y, 0)
  assert.equal(place(1.5, 0.5).y, 50)
})

test("ohne Höhe gibt es nichts zu zeigen", () => {
  assert.equal(thumb(0, 0.5, 0, 12).visible, false)
})

test("unsinnige Werte machen keinen Balken", () => {
  assert.equal(place(0, 0).visible, false)
  assert.equal(place(0, NaN).visible, false)
  assert.equal(place(NaN, 0.5).visible, false)
  assert.equal(thumb(0, 0.5, NaN, 12).visible, false)
  assert.equal(thumb(0, 0.5, 100, NaN).visible, false)
})
