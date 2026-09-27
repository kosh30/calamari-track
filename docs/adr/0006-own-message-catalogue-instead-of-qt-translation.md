# An own message catalogue in JavaScript instead of Qt translation

Every user-visible string goes through `js/i18n.mjs`: a catalogue per locale in `js/messages/<locale>.mjs`, and a translator `t(id, params)` that the producing function receives as a parameter. English is the default; German, Polish and Russian follow. A message is either a string or a function of a params object.

The plugin spoke German only, with the text written at the place it was used. The four languages are the requirement; where the text lives is the decision.

## Considered Options

- **Qt's `qsTr` with `.ts`/`.qm` files**, the obvious answer in a Qt project, and the one that does not work here. The strings are produced in `js/*.mjs` — pure functions without Qt, run under `node --test` (`CLAUDE.md`, `docs/PLAN.md`). `qsTr` does not exist in that runtime, so every test guarding a message would either have to move into QML, where there are no tests, or stop asserting the text. The architecture that makes this plugin testable is exactly what rules `qsTr` out.
- **A module-level current locale**, set once at startup and read by the messages. It is the cheapest to write and it makes the pure modules stateful: two tests that assume different languages then pass or fail by the order they run in. The modules are pure on purpose, and this is the one change that would end that.
- **Message descriptors**, where a view returns `{id, params}` and QML renders the text at the edge. Architecturally the tidiest: the logic never holds a string, and the tests become locale-independent by construction. Rejected for its price, not its merit — every view's contract changes, all of the QML that consumes ready strings changes with it, and the gain is a property the completeness tests below already buy more cheaply.
- **Chosen: an explicit translator, passed in.** `t` is a parameter with an English default, so the modules stay pure, a call that names no locale gets English, and a test can ask for any language without touching global state.

## Consequences

- **A message with values is a function, not a template with `%1`.** Polish and Russian do not order a sentence the way English does, and two messages needed a different shape rather than different words: in Polish and Russian the action's label cannot be the subject of "failed", so `stamp.failed` puts it after an impersonal opening; in Russian `stamp.says*` carry a `что …` clause and the comma sits in the template. A positional scheme would have forced those sentences to be wrong.
- **English is the reference catalogue, and the fallback.** An unknown locale, and an id a locale lacks, both fall back to English; an id English lacks too renders as the id itself. That is deliberately ugly: `undefined` would read as a value the code computed, while a dotted id names the key that is missing.
- **The fallback is not allowed to hide a gap.** `js/i18n.test.mjs` asserts that every locale carries every id of English, that a message is a function in every locale or in none, that every message renders non-empty in every locale, and that every locale places every value it is given. The last two are the ones that catch a real translation mistake: a sentence that quietly loses its time still reads fine.
- **Counted messages avoid plural forms.** `min`, `h`, `мин`, `ч` are invariant abbreviations in all four languages, so the two messages that carry a count need no plural rules. Russian would otherwise want three forms and Polish three, and a plural engine for two messages is not worth its own bugs.
- **Calamari's own values are never translated.** The project name and the break type are what the user typed into the settings and what Calamari stores. They are quoted inside a message, never looked up in it.
- **`manifest.description` and `barWidget.displayName` stay in one language.** The shell reads them from the file before any plugin code runs (`/usr/share/omarchy/shell/shell.qml:1400`), so no translator can reach them. The schema's field labels *are* reachable, because only our own `SettingsForm.qml` renders them — the shell merely parks the schema in its registry.
- **The docs quote on-screen text, which is now locale-dependent.** `CONTEXT.md` names the German label beside each English headword. Those quotes are the German UI, and the glossary says so rather than pretending there is one label per term.

## The core-time token

`"frei"` was a German word in the UI and a **stored value** at the same time, parsed in `js/daycalendar.mjs` and `js/settingsform.mjs`. Translating it as a label alone would have changed what an existing setting means.

So `"frei"` stays the canonical stored token. Input accepts the canonical token plus the current locale's word; storage is always the token; display shows the locale's word. Accepting every locale's word at once was rejected: it makes the accepted set depend on nothing the user can see.

The reason this is written down rather than left to the code: a canonical German token in an otherwise English codebase looks exactly like something left behind by the translation, and the next reader's instinct will be to tidy it into `"off"`. That rename is a silent data migration for every core-time setting already on disk.
