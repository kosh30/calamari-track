import { test } from "node:test"
import assert from "node:assert/strict"
import { CONTROL, TEXT, alphaFor, mix, ratio, strengths } from "./contrast.mjs"

const rgb = (hex) => ({
  r: parseInt(hex.slice(1, 3), 16) / 255,
  g: parseInt(hex.slice(3, 5), 16) / 255,
  b: parseInt(hex.slice(5, 7), 16) / 255,
})

// The two themes the rule was measured against.
const solitude = { fg: rgb("#cacccc"), bg: rgb("#101315") }
const latte = { fg: rgb("#4c4f69"), bg: rgb("#eff1f5") }

const black = rgb("#000000")
const white = rgb("#ffffff")

// What a theme is left with after the colour has stepped back as far as it may.
const reached = (theme, target) => ratio(mix(theme.fg, theme.bg, alphaFor(theme.fg, theme.bg, target)), theme.bg)

test("black on white is the highest contrast there is", () => {
  assert.equal(Math.round(ratio(black, white)), 21)
})

test("a colour has no contrast with itself", () => {
  assert.equal(ratio(latte.fg, latte.fg), 1)
})

test("the direction makes no difference", () => {
  assert.equal(ratio(black, white), ratio(white, black))
})

test("full opacity is the foreground, none is the background", () => {
  assert.deepEqual(mix(latte.fg, latte.bg, 1), latte.fg)
  assert.deepEqual(mix(latte.fg, latte.bg, 0), latte.bg)
})

test("the colour that has given way meets the ratio required", () => {
  for (const theme of [solitude, latte])
    for (const target of [TEXT, CONTROL]) {
      const got = reached(theme, target)
      assert.ok(got >= target, `${got} < ${target}`)
      assert.ok(got < target + 0.1, `${got} weit über ${target}`)
    }
})

test("on a dark ground the colour may give way further than on a light one", () => {
  assert.ok(alphaFor(solitude.fg, solitude.bg, TEXT) < alphaFor(latte.fg, latte.bg, TEXT))
})

test("a higher target demands more colour", () => {
  assert.ok(alphaFor(latte.fg, latte.bg, TEXT) > alphaFor(latte.fg, latte.bg, CONTROL))
})

test("if the foreground does not reach the target itself it is not diluted", () => {
  // Latte's own muted role: 1.9:1 on its background, the trap this replaces.
  const muted = rgb("#acb0be")
  assert.ok(ratio(muted, latte.bg) < TEXT)
  assert.equal(alphaFor(muted, latte.bg, TEXT), 1)
})

test("there is no more than full opacity", () => {
  for (const theme of [solitude, latte]) assert.ok(alphaFor(theme.fg, theme.bg, 21) <= 1)
})

test("a foreground equal to the background stays as it is", () => {
  assert.equal(alphaFor(latte.bg, latte.bg, TEXT), 1)
})

test("where the theme leaves room the strength chosen stands", () => {
  const s = strengths(solitude.fg, solitude.bg)
  assert.equal(s.quiet, 0.62)
  assert.equal(s.mark, 0.55)
})

test("a tight theme raises the strengths until they hold their threshold", () => {
  const s = strengths(latte.fg, latte.bg)
  assert.ok(s.quiet > 0.62)
  assert.ok(ratio(mix(latte.fg, latte.bg, s.quiet), latte.bg) >= TEXT)
  assert.ok(ratio(mix(latte.fg, latte.bg, s.mark), latte.bg) >= CONTROL)
})

test("the bar gives way further than the label, the spaced capitals furthest", () => {
  for (const theme of [solitude, latte]) {
    const s = strengths(theme.fg, theme.bg)
    assert.ok(s.mark < s.quiet)
    assert.ok(s.inert <= s.mark)
  }
})

test("the spaced capitals stay legible on every theme too", () => {
  for (const theme of [solitude, latte])
    assert.ok(ratio(mix(theme.fg, theme.bg, strengths(theme.fg, theme.bg).inert), theme.bg) >= CONTROL)
})
