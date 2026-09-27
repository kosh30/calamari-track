// The settings form behind the bar's right-click: which fields to show
// (from the manifest's barWidget.schema) and how to read them back. No Qt;
// tested with `node --test js/`.

import { hasMessage, t as defaultT } from "./i18n.mjs"
import { CORE_TIME_OFF } from "./daycalendar.mjs"

// One field per schema entry: { key, label, type, text }, text being the
// current value (or the default) as the form shows it.
export function formFields(schema, settings, t = defaultT) {
  // QML hands an unset `var` property over as null, and a default parameter
  // only answers to undefined — so the default is taken here rather than in
  // the signature. Without it the first t(...) throws a bare TypeError.
  t = t || defaultT
  return schema.map((field) => {
    const value =
      settings && settings[field.key] !== undefined && settings[field.key] !== null
        ? settings[field.key]
        : field.defaultValue
    const entry = { key: field.key, label: labelOf(field, t), type: field.type, text: shown(field, value, t) }
    // A choice carries its options along, so the form can offer them without
    // reading the schema a second time. The option labels are endonyms and
    // stay as the manifest wrote them.
    if (field.format === "choice") entry.options = field.options || []
    return entry
  })
}

// The label is the catalogue's. The manifest's own label is the last resort,
// for a field added without one — tests/test_manifest.py keeps that from being
// the normal case.
function labelOf(field, t) {
  const id = `setting.${field.key}`
  return hasMessage(id) ? t(id) : field.label || field.key
}

// The stored core-time token is a German word whatever the language (ADR 0006),
// so the form shows the current locale's word in its place. Everything else is
// its value as it stands.
function shown(field, value, t) {
  if (field.format === "coreTime" && String(value).toLowerCase() === CORE_TIME_OFF) return t("coreTime.off")
  return String(value)
}

// The form's texts, flat by key, which is how they are edited and read back:
// a card is a way of showing the fields, never a unit anything is saved by.
export function formTexts(schema, settings, t = defaultT) {
  // QML hands an unset `var` property over as null, and a default parameter
  // only answers to undefined — so the default is taken here rather than in
  // the signature. Without it the first t(...) throws a bare TypeError.
  t = t || defaultT
  // Not Object.fromEntries: Quickshell's JS engine does not have it, and the
  // failure is silent — the assignment throws, the property keeps its old
  // value, and the form looks right while holding nothing (js/enginecompat.test.mjs).
  const texts = {}
  for (const field of formFields(schema, settings, t)) texts[field.key] = field.text
  return texts
}

function titleOf(group, t) {
  const id = `group.${group.key}`
  return hasMessage(id) ? t(id) : group.title || ""
}

// Only the core-time group carries one today, and it names the locale's word
// for a day off, so it is a message with a value rather than a constant.
function descriptionOf(group, t) {
  const id = `group.${group.key}.description`
  return hasMessage(id) ? t(id, { off: t("coreTime.off") }) : group.description || ""
}

// Where a field goes whose group the manifest does not name, or names and
// does not declare. It is a card like any other rather than a silent drop:
// a setting added without a group has to be visible, or nobody notices it is
// homeless.
const STRAY_KEY = "other"

// The fields of `schema` as cards: one per entry of `groups`, in that order,
// each { key, title, description, fields }. Empty groups fall away, and
// whatever is left over lands in one card at the end.
export function formCards(schema, groups, settings, t = defaultT) {
  // QML hands an unset `var` property over as null, and a default parameter
  // only answers to undefined — so the default is taken here rather than in
  // the signature. Without it the first t(...) throws a bare TypeError.
  t = t || defaultT
  const declared = groups || []
  const known = new Set(declared.map((group) => group.key))
  const fields = formFields(schema, settings, t)
  // By position rather than by the field objects: formFields promises one
  // field per schema entry in order, and nothing more than that.
  const where = (key) => fields.filter((_, i) => schema[i].group === key)

  const cards = declared
    .map((group) => ({
      key: group.key,
      title: titleOf(group, t),
      description: descriptionOf(group, t),
      fields: where(group.key),
    }))
    .filter((card) => card.fields.length > 0)

  const stray = fields.filter((_, i) => !known.has(schema[i].group))
  if (stray.length) cards.push({ key: STRAY_KEY, title: t("group.other"), description: "", fields: stray })
  return cards
}

function clockMinutes(text) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(text)
  return match && Number(match[1]) < 24 && Number(match[2]) < 60 ? Number(match[1]) * 60 + Number(match[2]) : null
}

// Readers per field kind: return the value, or undefined if the text does
// not fit (the message says what would).
const READERS = {
  integer: (field, t) => ({
    read: (text) => {
      const n = /^\d+$/.test(text) ? Number(text) : NaN
      const min = field.min === undefined ? 0 : field.min
      const max = field.max === undefined ? Infinity : field.max
      return n >= min && n <= max ? n : undefined
    },
    message: t("validate.integer", { min: field.min === undefined ? 0 : field.min, max: field.max }),
  }),
  time: (field, t) => ({
    read: (text) => (clockMinutes(text) !== null ? text : undefined),
    message: t("validate.time"),
  }),
  coreTime: (field, t) => ({
    read: (text) => {
      if (text === "") return ""
      // The canonical token is accepted in every language, the current
      // locale's word beside it — but not every locale's, which would make
      // the accepted set depend on nothing the user can see (ADR 0006).
      const lower = text.toLowerCase()
      if (lower === CORE_TIME_OFF || lower === String(t("coreTime.off")).toLowerCase()) return CORE_TIME_OFF
      const [start, end] = text.split("-").map((part) => clockMinutes(part.trim()))
      return start !== null && end !== null && start < end ? text : undefined
    },
    message: t("validate.coreTime", { off: t("coreTime.off") }),
  }),
  choice: (field, t) => ({
    read: (text) => ((field.options || []).some((option) => option.value === text) ? text : undefined),
    message: t("validate.choice", {
      options: (field.options || []).map((option) => option.label).join(", "),
    }),
  }),
  url: (field, t) => ({
    read: (text) => (text === "" || /^https?:\/\/\S+$/.test(text) ? text : undefined),
    message: t("validate.url"),
  }),
  string: () => ({ read: (text) => text, message: "" }),
}

function readerFor(field, t) {
  const kind = field.type === "integer" ? "integer" : field.format || "string"
  return (READERS[kind] || READERS.string)(field, t)
}

// Reads the form texts ({ key: text }) back. Returns { settings, errors }:
// settings is null while any field is wrong, errors maps keys to messages.
export function readForm(schema, texts, t = defaultT) {
  // QML hands an unset `var` property over as null, and a default parameter
  // only answers to undefined — so the default is taken here rather than in
  // the signature. Without it the first t(...) throws a bare TypeError.
  t = t || defaultT
  const settings = {}
  const errors = {}
  for (const field of schema) {
    const reader = readerFor(field, t)
    const value = reader.read(String(texts[field.key] === undefined ? "" : texts[field.key]).trim())
    if (value === undefined) errors[field.key] = reader.message
    else settings[field.key] = value
  }
  return { settings: Object.keys(errors).length ? null : settings, errors }
}
