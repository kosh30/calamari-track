// Polish. Written against the English reference, not translated word by word:
// where a German or English sentence puts a label in front of a verb, Polish
// needs the label after a colon or the case would be wrong. That is what the
// message functions are for.
//
// Vocabulary fixed once and kept: a shift is "zmiana", the core time is
// "czas podstawowy", clocking in and out are "wejście" and "wyjście".
// Calamari's own values (the project name, the break type) stay untranslated.

export const pl = {
  "bar.name": "Calamari Tracker",
  "bar.authRequired": "Calamari: wymagane zalogowanie",
  "bar.running": "Calamari: zmiana trwa",
  "bar.reminder": "Calamari: brak wejścia",
  "bar.break": "Calamari: przerwa",
  "bar.idle": "Calamari: brak trwającej zmiany",

  "stamp.clockIn": "Wejście",
  "stamp.clockOut": "Wyjście",
  "stamp.breakStart": "Rozpocznij przerwę",
  "stamp.breakEnd": "Zakończ przerwę",
  "stamp.endOfDay": "Koniec pracy",
  "stamp.clockOutNow": "Wyjście teraz",

  "cause.network": "Calamari jest nieosiągalne",
  "cause.rateLimited": "zbyt wiele żądań, spróbuj ponownie za chwilę",
  "cause.authRequired": "wymagane zalogowanie",
  "cause.apiTerminalMissing": "brak terminala API w Calamari Clockin",
  "cause.apiScopeMissing": "klucz API nie ma wymaganego uprawnienia",
  "cause.apiKeyRequired": "brak klucza API, uruchom bin/calamari api-key",
  "cause.apiKeyRejected": "Calamari odrzuca klucz API",
  "cause.apiUrlRequired": "brak adresu REST API, ustaw go w ustawieniach",
  "cause.projectUnknown": (p) => `w Calamari nie ma projektu „${p.project}”`,
  "cause.breakTypeUnknown": (p) => `w Calamari nie ma typu przerwy „${p.breakType}”`,

  // The label cannot be the subject here: "Rozpocznij przerwę nie powiodło się"
  // is not Polish. It goes after an impersonal opening instead.
  "stamp.failed": (p) => `Nie udało się – ${p.action}: ${p.cause}. Nic nie zostanie dosłane później.`,
  "stamp.saysNoBreak": "brak przerwy",
  "stamp.saysStillBreak": "nadal przerwę",
  "stamp.mismatch": (p) => `${p.action}: Calamari zgłasza ${p.says}. Sprawdź w przeglądarce.`,
  "stamp.noShift": (p) => `${p.action}: Calamari nie zgłasza trwającej zmiany.`,
  "stamp.noShiftCheck": (p) => `${p.action}: Calamari nie zgłasza trwającej zmiany. Sprawdź w przeglądarce.`,

  "shift.workedToday": (p) => `Przepracowano dziś (zaobserwowane): ${p.span}`,
  "break.sinceAtLatest": (p) => `najpóźniej ${p.time}`,

  "header.statusPolling": "Pobieranie stanu zmiany …",
  "header.statusUnknown": "Nieznany stan zmiany",
  "header.authRequired": "Wymagane zalogowanie",
  "header.reminder": "Brak wejścia, trwa czas podstawowy",
  "header.breakSince": (p) => `Przerwa od ${p.since}`,
  "header.endOfDaySince": (p) => `Koniec pracy o ${p.time}`,
  "header.noShift": "Brak trwającej zmiany",
  "header.runningSince": (p) => `Zmiana trwa od ${p.time}`,
  "header.running": "Zmiana trwa",
  "header.coreDone": "Czas podstawowy zakończony",
  "header.coreLeft": (p) => `jeszcze ${p.span} do końca czasu podstawowego`,

  // "min" is invariant in Polish, so the counted messages need no plural forms.
  "backoff.retryIn": (p) => `następna próba za ${p.minutes} min`,
  "backoff.network": (p) => `Calamari jest nieosiągalne, ${p.retry}`,
  "backoff.rateLimited": (p) => `Calamari: zbyt wiele żądań, ${p.retry}`,
  "backoff.apiUrlRequired": "Calamari: brak adresu REST API, ustaw go w ustawieniach",
  "backoff.apiKeyRequired": "Calamari: brak klucza API, uruchom bin/calamari api-key",
  "backoff.apiKeyRejected": "Calamari odrzuca klucz API, uruchom ponownie bin/calamari api-key",
  "backoff.apiTerminalMissing": "Calamari: brak terminala API w Clockin",
  "backoff.apiScopeMissing": "Calamari: klucz API nie ma wymaganego uprawnienia",
  "backoff.error": "Calamari: błąd",

  "timeline.coreTime": (p) => `Czas podstawowy ${p.from}–${p.to}`,
  "timeline.shiftSince": (p) => `Zmiana od ${p.from} (trwa)`,
  "timeline.shiftRange": (p) => `Zmiana ${p.from}–${p.to}`,
  "timeline.breakSince": (p) => `Przerwa od ${p.since}`,
  "timeline.endedBreaks": (p) => `Zakończone przerwy: ${p.span} (zawarte w zmianach)`,

  "notify.softHint.headline": "Zmiana nadal trwa",
  "notify.softHint.body": (p) => `Czas podstawowy zakończył się o ${p.coreEnd}.`,
  "notify.finalWarning.headline": "Ostatnie ostrzeżenie",
  "notify.finalWarning.body": (p) => `Automatyczne zamknięcie o ${p.at}. W panelu: ${p.extend} lub ${p.alt}.`,
  "notify.finalWarning.altEndOfDay": "koniec pracy",
  "notify.finalWarning.altClockOut": "wyjście teraz",
  "notify.autoClosed.headline": "Zmiana zamknięta automatycznie",
  "notify.autoClosed.body": (p) => `Wyjście o ${p.at}. Popraw godzinę zakończenia w Calamari.`,
  "notify.autoClosed.bodyWithActivity": (p) =>
    `Wyjście o ${p.at}, ostatnia aktywność ${p.lastActivity}. Popraw na nią godzinę zakończenia w Calamari.`,
  "notify.dayEndClosed.headline": "Zmiana z poprzedniego dnia zamknięta",
  "notify.dayEndClosed.body": (p) =>
    `Zmiana z ${p.date} trwała do końca dnia, Calamari zamknęło ją o 23:59. Popraw tam godzinę zakończenia.`,
  "notify.dayEndClosed.bodyWithActivity": (p) =>
    `Zmiana z ${p.date} trwała do końca dnia, Calamari zamknęło ją o 23:59. Popraw tam godzinę zakończenia na ${p.lastActivity} (ostatnia aktywność).`,
  "notify.breakReminder.headline": "Przerwa nadal trwa",
  "notify.breakReminder.body": (p) => `Przerwa trwa od ${p.since}.`,
  "notify.stampReminder.headline": "Brak wejścia",
  "notify.stampReminder.body": (p) => `Czas podstawowy trwa od ${p.coreStart}.`,

  "panel.countdown": (p) => `Automatyczne zamknięcie o ${p.at}, jeszcze ${p.left} min`,
  "panel.extendHour": "+1 h dalszej pracy",
  "panel.extendMinutes": (p) => `+${p.minutes} min dalszej pracy`,
  "panel.settings": "Ustawienia",
  "panel.dayOff": "Dziś wolne",
  "panel.dayOffUndo": "Dziś wolne (cofnij)",
  "login.inBrowser": "Logowanie w przeglądarce …",
  "login.asUser": (p) => `Zalogowano jako ${p.name}`,
  "login.signedIn": "Zalogowano",
  "login.required": "Wymagane zalogowanie",
  "login.unreachable": "Calamari jest nieosiągalne",
  "login.connecting": "Łączenie …",
  "login.signInAgain": "Zaloguj ponownie",

  "settings.title": "Ustawienia",
  "settings.cancel": "Anuluj",
  "settings.save": "Zapisz",
  "settings.saveFailed": "Nie można zapisać: powłoka nie przyjęła ustawień.",
  "group.other": "Pozostałe",
  "validate.integer": (p) => `Liczba całkowita od ${p.min} do ${p.max}`,
  "validate.time": "Godzina, na przykład 19:00",
  "validate.coreTime": (p) => `Puste, „${p.off}” lub czas podstawowy, na przykład 09:00-16:45`,
  "validate.choice": (p) => `Jedno z: ${p.options}`,
  "validate.url": "Puste lub adres, na przykład https://firma.calamari.io",

  "coreTime.off": "wolne",

  "date.dayMonth": (p) => `${p.day}.${p.month}.`,

  // The settings page: one id per schema group and per field key. The
  // manifest keeps the structure and an English label as the last resort;
  // what the form shows comes from here.

  "group.general": "Ogólne",
  "group.polling": "Odpytywanie i przypomnienia",
  "group.break": "Przerwa",
  "group.closing": "Koniec pracy",
  "group.core": "Czasy podstawowe",
  "group.connection": "Połączenie",
  "group.naming": "Projekt i typ przerwy",
  "group.core.description": (p) =>
    `Na każdy dzień tygodnia HH:MM-HH:MM, „${p.off}” dla dnia wolnego, albo puste dla planu pracy z Calamari.`,

  "setting.language": "Język",
  "setting.pollIntervalMinutes": "Interwał odpytywania (minuty)",
  "setting.stampReminderMinutes": "Powtarzaj przypomnienie o wejściu co (minuty)",
  "setting.breakLimitMinutes": "Przypomnienie o przerwie po (minuty)",
  "setting.breakReminderMinutes": "Powtarzaj przypomnienie o przerwie co (minuty)",
  "setting.softHintMinutes": "Delikatna wskazówka po końcu czasu podstawowego (minuty)",
  "setting.finalWarningTime": "Godzina ostatniego ostrzeżenia (HH:MM)",
  "setting.autoCloseMinutes": "Automatyczne zamknięcie po ostatnim ostrzeżeniu (minuty)",
  "setting.extendMinutes": "Przesunięcie przyciskiem „+1 h” (minuty)",
  "setting.hardLimitTime": "Górna granica automatycznego zamknięcia (HH:MM)",
  "setting.webUrl": "Calamari w przeglądarce (np. https://firma.calamari.io)",
  "setting.apiUrl": "Calamari REST API, np. https://firma.calamari.io/api (klucz przez bin/calamari api-key)",
  "setting.defaultProject": "Domyślny projekt przy wejściu (nazwa w Calamari, puste = Check-in)",
  "setting.breakType": "Typ przerwy (nazwa w Calamari, puste = Break)",
  "setting.coreMonday": "Poniedziałek",
  "setting.coreTuesday": "Wtorek",
  "setting.coreWednesday": "Środa",
  "setting.coreThursday": "Czwartek",
  "setting.coreFriday": "Piątek",
  "setting.coreSaturday": "Sobota",
  "setting.coreSunday": "Niedziela",
}
