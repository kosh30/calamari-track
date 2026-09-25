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

test("Schwarz auf Weiß ist der höchste Kontrast, den es gibt", () => {
  assert.equal(Math.round(ratio(black, white)), 21)
})

test("eine Farbe hat zu sich selbst keinen Kontrast", () => {
  assert.equal(ratio(latte.fg, latte.fg), 1)
})

test("die Richtung ist egal", () => {
  assert.equal(ratio(black, white), ratio(white, black))
})

test("volle Deckkraft ist der Vordergrund, keine ist der Hintergrund", () => {
  assert.deepEqual(mix(latte.fg, latte.bg, 1), latte.fg)
  assert.deepEqual(mix(latte.fg, latte.bg, 0), latte.bg)
})

test("die zurückgetretene Farbe trifft das geforderte Verhältnis", () => {
  for (const theme of [solitude, latte])
    for (const target of [TEXT, CONTROL]) {
      const got = reached(theme, target)
      assert.ok(got >= target, `${got} < ${target}`)
      assert.ok(got < target + 0.1, `${got} weit über ${target}`)
    }
})

test("auf dunklem Grund darf die Farbe weiter zurücktreten als auf hellem", () => {
  assert.ok(alphaFor(solitude.fg, solitude.bg, TEXT) < alphaFor(latte.fg, latte.bg, TEXT))
})

test("ein höheres Ziel verlangt mehr Farbe", () => {
  assert.ok(alphaFor(latte.fg, latte.bg, TEXT) > alphaFor(latte.fg, latte.bg, CONTROL))
})

test("erreicht der Vordergrund das Ziel selbst nicht, wird er nicht verdünnt", () => {
  // Latte's own muted role: 1.9:1 on its background, the trap this replaces.
  const muted = rgb("#acb0be")
  assert.ok(ratio(muted, latte.bg) < TEXT)
  assert.equal(alphaFor(muted, latte.bg, TEXT), 1)
})

test("mehr als volle Deckkraft gibt es nicht", () => {
  for (const theme of [solitude, latte]) assert.ok(alphaFor(theme.fg, theme.bg, 21) <= 1)
})

test("ein Vordergrund gleich dem Hintergrund bleibt, wie er ist", () => {
  assert.equal(alphaFor(latte.bg, latte.bg, TEXT), 1)
})

test("wo das Theme Platz lässt, bleibt die gewählte Stärke stehen", () => {
  const s = strengths(solitude.fg, solitude.bg)
  assert.equal(s.quiet, 0.62)
  assert.equal(s.mark, 0.55)
})

test("ein enges Theme hebt die Stärken an, bis sie ihre Schwelle halten", () => {
  const s = strengths(latte.fg, latte.bg)
  assert.ok(s.quiet > 0.62)
  assert.ok(ratio(mix(latte.fg, latte.bg, s.quiet), latte.bg) >= TEXT)
  assert.ok(ratio(mix(latte.fg, latte.bg, s.mark), latte.bg) >= CONTROL)
})

test("die Leiste tritt weiter zurück als die Beschriftung, das Gesperrte am weitesten", () => {
  for (const theme of [solitude, latte]) {
    const s = strengths(theme.fg, theme.bg)
    assert.ok(s.mark < s.quiet)
    assert.ok(s.inert <= s.mark)
  }
})

test("auch das Gesperrte bleibt auf jedem Theme zu erkennen", () => {
  for (const theme of [solitude, latte])
    assert.ok(ratio(mix(theme.fg, theme.bg, strengths(theme.fg, theme.bg).inert), theme.bg) >= CONTROL)
})
