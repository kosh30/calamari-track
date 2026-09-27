// What Quickshell's JS engine does not have.
//
// The plugin's logic runs in two engines: Node, where the tests run, and
// Quickshell's V4, where the plugin actually runs. V4 is the older of the two,
// and where it lacks something the failure is quiet in the worst way: the
// expression throws, QML logs one line of "TypeError: Type error" to the
// journal, the assignment never happens, and the property keeps whatever it
// held before. Nothing looks broken.
//
// That is not hypothetical. `formTexts` used Object.fromEntries, so the
// settings form built its texts, threw, and kept `{}` — every field showed its
// value (those come from the cards) while the object the page saves from was
// empty. Every test passed, because Node has the function.
//
// The list was established by probing the running shell rather than by reading
// a compatibility table: a temporary console.log in Service.qml reported
// `typeof` for each name. Re-probe the same way before adding to it, and say
// in the comment which shell version answered.
//
// Probed on Omarchy 4.0.0.alpha / Quickshell 0.3.1, 2026-09-27:
//   Object.assign, Object.entries, Object.values  present
//   String.prototype.padStart, includes           present
//   Object.fromEntries                            MISSING
//   Array.prototype.at                            MISSING

import { test } from "node:test"
import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"

const MISSING = [
  { pattern: /\bObject\.fromEntries\s*\(/, name: "Object.fromEntries", instead: "build the object in a loop" },
  {
    pattern: /\)\s*\.at\s*\(|\]\s*\.at\s*\(|\w\.at\s*\(\s*-/,
    name: "Array.prototype.at",
    instead: "index with [i] or [len - 1]",
  },
  { pattern: /\?\?/, name: "nullish coalescing (??)", instead: "use || where the falsy cases cannot occur" },
  { pattern: /\?\./, name: "optional chaining (?.)", instead: "guard with && " },
]

const shipped = readdirSync(new URL(".", import.meta.url)).filter(
  (name) => name.endsWith(".mjs") && !name.endsWith(".test.mjs"),
)

test("the shipped modules avoid what Quickshell's engine lacks", () => {
  assert.ok(shipped.length > 0, "no modules found to check")
  for (const name of shipped) {
    const source = readFileSync(new URL(name, import.meta.url), "utf8")
    for (const { pattern, name: missing, instead } of MISSING) {
      const lines = source.split("\n")
      for (let i = 0; i < lines.length; i++) {
        // A mention in a comment is how this file documents itself.
        if (lines[i].trim().startsWith("//")) continue
        assert.ok(
          !pattern.test(lines[i]),
          `js/${name}:${i + 1} uses ${missing}, which Quickshell's engine does not have — ${instead}`,
        )
      }
    }
  }
})

test("the catalogues are checked too, wherever they live", () => {
  const catalogues = readdirSync(new URL("./messages/", import.meta.url))
  assert.ok(catalogues.length >= 4)
  for (const name of catalogues) {
    const source = readFileSync(new URL(`./messages/${name}`, import.meta.url), "utf8")
    for (const { pattern, name: missing } of MISSING) {
      assert.ok(!pattern.test(source), `js/messages/${name} uses ${missing}`)
    }
  }
})
