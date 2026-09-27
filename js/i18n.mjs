// The message catalogue and the translator every user-visible string goes
// through. No Qt: the modules that produce those strings are pure functions
// tested with `node --test`, so a Qt translation would be invisible to the
// tests that guard them (ADR 0006).
//
// A message is either a string or a function of a params object. Functions
// exist so a locale can put a value where its own grammar wants it, which a
// positional %s cannot do — Polish and Russian do not order a sentence the
// way English does.

import { en } from "./messages/en.mjs"
import { de } from "./messages/de.mjs"
import { pl } from "./messages/pl.mjs"
import { ru } from "./messages/ru.mjs"

// The registry is the single source of truth for which locales exist: LOCALES
// is derived from it, so adding a catalogue adds a language everywhere at once.
const CATALOGUES = { en, de, pl, ru }

export const DEFAULT_LOCALE = "en"
export const LOCALES = Object.keys(CATALOGUES)

// The translator for a locale. An unknown or missing locale is the default
// rather than an error: a settings file can carry anything, and a plugin that
// throws on it shows nothing at all.
export function translator(locale) {
  const messages = CATALOGUES[locale] || CATALOGUES[DEFAULT_LOCALE]
  return function t(id, params) {
    const message = messages[id] !== undefined ? messages[id] : CATALOGUES[DEFAULT_LOCALE][id]
    // The id itself is the last resort. It is ugly on screen and that is the
    // point: `undefined` would look like a value the code computed, while a
    // dotted id reads as a missing translation and names the key that is gone.
    if (message === undefined) return id
    return typeof message === "function" ? message(params || {}) : message
  }
}

// The default translator, for a call that names no locale.
export const t = translator(DEFAULT_LOCALE)

// Whether an id exists at all. The settings form asks before falling back to
// the manifest's own label, so a missing entry shows a label rather than a key.
export function hasMessage(id) {
  return Object.prototype.hasOwnProperty.call(en, id)
}

// Whether a locale has a catalogue of its own, for the settings to offer it.
export function knownLocale(locale) {
  return Object.prototype.hasOwnProperty.call(CATALOGUES, locale)
}

// The catalogue of a locale, for the tests that compare them against English.
export function catalogue(locale) {
  return CATALOGUES[locale]
}
