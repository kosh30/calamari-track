import { test } from "node:test"
import assert from "node:assert/strict"
import { thumb } from "./scrollindicator.mjs"

// A track 100 px tall, so the expectations read as percentages, and a floor
// of 12 px, the shortest thumb that still reads as one.
const place = (position, ratio) => thumb(position, ratio, 100, 12)

test("if the content fits the window there is nothing to see", () => {
  assert.equal(place(0, 1).visible, false)
})

test("on overflow the bar shows what share stands in the window", () => {
  assert.deepEqual(place(0, 0.5), { visible: true, y: 0, height: 50 })
})

test("the bar follows the scroll position", () => {
  assert.equal(place(0.25, 0.5).y, 25)
})

test("at the end of the content the bar sits flush with the bottom edge", () => {
  const t = place(0.75, 0.25)
  assert.equal(t.y + t.height, 100)
})

test("with very long content the bar stays visibly long", () => {
  assert.equal(place(0, 0.02).height, 12)
})

test("the bar brought up to its minimum length does not run out at the bottom", () => {
  const t = place(0.98, 0.02)
  assert.equal(t.y, 88)
  assert.equal(t.y + t.height, 100)
})

test("a scroll position past the edge keeps the bar inside", () => {
  assert.equal(place(-0.2, 0.5).y, 0)
  assert.equal(place(1.5, 0.5).y, 50)
})

test("with no height there is nothing to show", () => {
  assert.equal(thumb(0, 0.5, 0, 12).visible, false)
})

test("nonsensical values make no bar", () => {
  assert.equal(place(0, 0).visible, false)
  assert.equal(place(0, NaN).visible, false)
  assert.equal(place(NaN, 0.5).visible, false)
  assert.equal(thumb(0, 0.5, NaN, 12).visible, false)
  assert.equal(thumb(0, 0.5, 100, NaN).visible, false)
})
