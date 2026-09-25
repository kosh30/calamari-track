// The settings form behind the bar's right-click: which fields to show
// (from the manifest's barWidget.schema) and how to read them back. No Qt;
// tested with `node --test js/`.

// One field per schema entry: { key, label, type, text }, text being the
// current value (or the default) as the form shows it.
export function formFields(schema, settings) {
  return schema.map((field) => {
    const value =
      settings && settings[field.key] !== undefined && settings[field.key] !== null
        ? settings[field.key]
        : field.defaultValue
    return { key: field.key, label: field.label, type: field.type, text: String(value) }
  })
}

// The form's texts, flat by key, which is how they are edited and read back:
// a card is a way of showing the fields, never a unit anything is saved by.
export function formTexts(schema, settings) {
  return Object.fromEntries(formFields(schema, settings).map((field) => [field.key, field.text]))
}

// Where a field goes whose group the manifest does not name, or names and
// does not declare. It is a card like any other rather than a silent drop:
// a setting added without a group has to be visible, or nobody notices it is
// homeless.
const STRAY = { key: "other", title: "Weitere" }

// The fields of `schema` as cards: one per entry of `groups`, in that order,
// each { key, title, description, fields }. Empty groups fall away, and
// whatever is left over lands in one card at the end.
export function formCards(schema, groups, settings) {
  const declared = groups || []
  const known = new Set(declared.map((group) => group.key))
  const fields = formFields(schema, settings)
  // By position rather than by the field objects: formFields promises one
  // field per schema entry in order, and nothing more than that.
  const where = (key) => fields.filter((_, i) => schema[i].group === key)

  const cards = declared
    .map((group) => ({
      key: group.key,
      title: group.title || "",
      description: group.description || "",
      fields: where(group.key),
    }))
    .filter((card) => card.fields.length > 0)

  const stray = fields.filter((_, i) => !known.has(schema[i].group))
  if (stray.length) cards.push({ key: STRAY.key, title: STRAY.title, description: "", fields: stray })
  return cards
}

function clockMinutes(text) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(text)
  return match && Number(match[1]) < 24 && Number(match[2]) < 60 ? Number(match[1]) * 60 + Number(match[2]) : null
}

// Readers per field kind: return the value, or undefined if the text does
// not fit (the message says what would).
const READERS = {
  integer: (field) => ({
    read: (text) => {
      const n = /^\d+$/.test(text) ? Number(text) : NaN
      const min = field.min === undefined ? 0 : field.min
      const max = field.max === undefined ? Infinity : field.max
      return n >= min && n <= max ? n : undefined
    },
    message: `Eine ganze Zahl von ${field.min === undefined ? 0 : field.min} bis ${field.max}`,
  }),
  time: () => ({
    read: (text) => (clockMinutes(text) !== null ? text : undefined),
    message: "Eine Uhrzeit wie 19:00",
  }),
  coreTime: () => ({
    read: (text) => {
      if (text === "" || text.toLowerCase() === "frei") return text.toLowerCase()
      const [start, end] = text.split("-").map((t) => clockMinutes(t.trim()))
      return start !== null && end !== null && start < end ? text : undefined
    },
    message: "Leer, „frei“ oder eine Kernzeit wie 09:00-16:45",
  }),
  url: () => ({
    read: (text) => (text === "" || /^https?:\/\/\S+$/.test(text) ? text : undefined),
    message: "Leer oder eine Adresse wie https://firma.calamari.io",
  }),
  string: () => ({ read: (text) => text, message: "" }),
}

function readerFor(field) {
  const kind = field.type === "integer" ? "integer" : field.format || "string"
  return (READERS[kind] || READERS.string)(field)
}

// Reads the form texts ({ key: text }) back. Returns { settings, errors }:
// settings is null while any field is wrong, errors maps keys to messages.
export function readForm(schema, texts) {
  const settings = {}
  const errors = {}
  for (const field of schema) {
    const reader = readerFor(field)
    const value = reader.read(String(texts[field.key] === undefined ? "" : texts[field.key]).trim())
    if (value === undefined) errors[field.key] = reader.message
    else settings[field.key] = value
  }
  return { settings: Object.keys(errors).length ? null : settings, errors }
}
