// Russian. Written against the English reference. Two places needed a
// different sentence shape rather than a different word: the failure message
// cannot use the action's label as its subject, and "Calamari reports no
// break" wants a subordinate clause, so `stamp.says*` carry the "что …" here
// and the comma sits in the template.
//
// Vocabulary fixed once and kept: a shift is "смена", the core time is
// "основное время", clocking in and out are "вход" and "выход". Calamari's own
// values (the project name, the break type) stay untranslated.

export const ru = {
  "bar.name": "Calamari Tracker",
  "bar.authRequired": "Calamari: нужен вход",
  "bar.running": "Calamari: смена идёт",
  "bar.reminder": "Calamari: входа ещё нет",
  "bar.break": "Calamari: перерыв",
  "bar.idle": "Calamari: нет текущей смены",

  "stamp.clockIn": "Отметить вход",
  "stamp.clockOut": "Отметить выход",
  "stamp.breakStart": "Начать перерыв",
  "stamp.breakEnd": "Закончить перерыв",
  "stamp.endOfDay": "Конец рабочего дня",
  "stamp.clockOutNow": "Выйти сейчас",

  "cause.network": "Calamari недоступен",
  "cause.rateLimited": "слишком много запросов, повторите попытку чуть позже",
  "cause.authRequired": "нужен вход",
  "cause.apiTerminalMissing": "в Calamari Clockin нет терминала API",
  "cause.apiScopeMissing": "у ключа API не хватает прав",
  "cause.apiKeyRequired": "нет ключа API, запустите bin/calamari api-key",
  "cause.apiKeyRejected": "Calamari отклоняет ключ API",
  "cause.apiUrlRequired": "нет адреса REST API, укажите его в настройках",
  "cause.projectUnknown": (p) => `в Calamari нет проекта «${p.project}»`,
  "cause.breakTypeUnknown": (p) => `в Calamari нет типа перерыва «${p.breakType}»`,

  // The label is an imperative, so it cannot be the subject of "не удалось".
  "stamp.failed": (p) => `Не удалось – ${p.action}: ${p.cause}. Ничего не будет отправлено позже.`,
  "stamp.saysNoBreak": "что перерыва нет",
  "stamp.saysStillBreak": "что перерыв продолжается",
  "stamp.mismatch": (p) => `${p.action}: Calamari сообщает, ${p.says}. Проверьте в веб-версии.`,
  "stamp.noShift": (p) => `${p.action}: Calamari не сообщает о текущей смене.`,
  "stamp.noShiftCheck": (p) => `${p.action}: Calamari не сообщает о текущей смене. Проверьте в веб-версии.`,

  "shift.workedToday": (p) => `Отработано сегодня (по наблюдениям): ${p.span}`,
  "break.sinceAtLatest": (p) => `не позже ${p.time}`,

  "header.statusPolling": "Запрашивается состояние смены …",
  "header.statusUnknown": "Состояние смены неизвестно",
  "header.authRequired": "Нужен вход",
  "header.reminder": "Входа ещё нет, основное время идёт",
  "header.breakSince": (p) => `Перерыв с ${p.since}`,
  "header.endOfDaySince": (p) => `Рабочий день закончен в ${p.time}`,
  "header.noShift": "Нет текущей смены",
  "header.runningSince": (p) => `Смена идёт с ${p.time}`,
  "header.running": "Смена идёт",
  "header.coreDone": "Основное время закончилось",
  "header.coreLeft": (p) => `ещё ${p.span} до конца основного времени`,

  // "мин" and "ч" are invariant abbreviations, so the counted messages need no
  // plural forms — which is what Russian would otherwise demand three of.
  "backoff.retryIn": (p) => `следующая попытка через ${p.minutes} мин`,
  "backoff.network": (p) => `Calamari недоступен, ${p.retry}`,
  "backoff.rateLimited": (p) => `Calamari: слишком много запросов, ${p.retry}`,
  "backoff.apiUrlRequired": "Calamari: нет адреса REST API, укажите его в настройках",
  "backoff.apiKeyRequired": "Calamari: нет ключа API, запустите bin/calamari api-key",
  "backoff.apiKeyRejected": "Calamari отклоняет ключ API, запустите bin/calamari api-key снова",
  "backoff.apiTerminalMissing": "Calamari: в Clockin нет терминала API",
  "backoff.apiScopeMissing": "Calamari: у ключа API не хватает прав",
  "backoff.error": "Calamari: ошибка",

  "timeline.coreTime": (p) => `Основное время ${p.from}–${p.to}`,
  "timeline.shiftSince": (p) => `Смена с ${p.from} (идёт)`,
  "timeline.shiftRange": (p) => `Смена ${p.from}–${p.to}`,
  "timeline.breakSince": (p) => `Перерыв с ${p.since}`,
  "timeline.endedBreaks": (p) => `Законченные перерывы: ${p.span} (входят в смены)`,

  "notify.softHint.headline": "Смена всё ещё идёт",
  "notify.softHint.body": (p) => `Основное время закончилось в ${p.coreEnd}.`,
  "notify.finalWarning.headline": "Последнее предупреждение",
  "notify.finalWarning.body": (p) => `Автозакрытие в ${p.at}. В панели: ${p.extend} или ${p.alt}.`,
  "notify.finalWarning.altEndOfDay": "конец рабочего дня",
  "notify.finalWarning.altClockOut": "выйти сейчас",
  "notify.autoClosed.headline": "Смена закрыта автоматически",
  "notify.autoClosed.body": (p) => `Выход отмечен в ${p.at}. Исправьте время окончания в Calamari.`,
  "notify.autoClosed.bodyWithActivity": (p) =>
    `Выход отмечен в ${p.at}, последняя активность ${p.lastActivity}. Исправьте время окончания в Calamari на неё.`,
  "notify.dayEndClosed.headline": "Смена за прошлый день закрыта",
  "notify.dayEndClosed.body": (p) =>
    `Смена от ${p.date} шла до конца дня, Calamari закрыл её в 23:59. Исправьте там время окончания.`,
  "notify.dayEndClosed.bodyWithActivity": (p) =>
    `Смена от ${p.date} шла до конца дня, Calamari закрыл её в 23:59. Исправьте там время окончания на ${p.lastActivity} (последняя активность).`,
  "notify.breakReminder.headline": "Перерыв всё ещё идёт",
  "notify.breakReminder.body": (p) => `Перерыв идёт с ${p.since}.`,
  "notify.stampReminder.headline": "Входа ещё нет",
  "notify.stampReminder.body": (p) => `Основное время идёт с ${p.coreStart}.`,

  "panel.countdown": (p) => `Автозакрытие в ${p.at}, ещё ${p.left} мин`,
  "panel.extendHour": "+1 ч работы",
  "panel.extendMinutes": (p) => `+${p.minutes} мин работы`,
  "panel.settings": "Настройки",
  "panel.dayOff": "Сегодня выходной",
  "panel.dayOffUndo": "Сегодня выходной (отменить)",
  "login.inBrowser": "Вход в браузере …",
  "login.asUser": (p) => `Вы вошли как ${p.name}`,
  "login.signedIn": "Вы вошли",
  "login.required": "Нужен вход",
  "login.unreachable": "Calamari недоступен",
  "login.connecting": "Соединение …",
  "login.signInAgain": "Войти снова",

  "settings.title": "Настройки",
  "settings.cancel": "Отмена",
  "settings.save": "Сохранить",
  "settings.saveFailed": "Не удалось сохранить: оболочка не приняла настройки.",
  "group.other": "Прочее",
  "validate.integer": (p) => `Целое число от ${p.min} до ${p.max}`,
  "validate.time": "Время, например 19:00",
  "validate.coreTime": (p) => `Пусто, «${p.off}» или основное время, например 09:00-16:45`,
  "validate.choice": (p) => `Одно из: ${p.options}`,
  "validate.url": "Пусто или адрес, например https://firma.calamari.io",

  "coreTime.off": "выходной",

  "date.dayMonth": (p) => `${p.day}.${p.month}.`,

  // The settings page: one id per schema group and per field key. The
  // manifest keeps the structure and an English label as the last resort;
  // what the form shows comes from here.

  "group.general": "Общие",
  "group.polling": "Опрос и напоминания",
  "group.break": "Перерыв",
  "group.closing": "Конец рабочего дня",
  "group.core": "Основное время",
  "group.connection": "Подключение",
  "group.naming": "Проект и тип перерыва",
  "group.core.description": (p) =>
    `На каждый день недели HH:MM-HH:MM, «${p.off}» для выходного, или пусто для рабочего плана из Calamari.`,

  "setting.language": "Язык",
  "setting.pollIntervalMinutes": "Интервал опроса (минуты)",
  "setting.stampReminderMinutes": "Повторять напоминание об отметке каждые (минуты)",
  "setting.breakLimitMinutes": "Напоминание о перерыве через (минуты)",
  "setting.breakReminderMinutes": "Повторять напоминание о перерыве каждые (минуты)",
  "setting.softHintMinutes": "Мягкая подсказка после конца основного времени (минуты)",
  "setting.finalWarningTime": "Время последнего предупреждения (HH:MM)",
  "setting.autoCloseMinutes": "Автозакрытие после последнего предупреждения (минуты)",
  "setting.extendMinutes": "Сдвиг кнопкой «+1 ч» (минуты)",
  "setting.hardLimitTime": "Верхняя граница автозакрытия (HH:MM)",
  "setting.webUrl": "Calamari в браузере (например, https://firma.calamari.io)",
  "setting.apiUrl": "Calamari REST API, например https://firma.calamari.io/api (ключ через bin/calamari api-key)",
  "setting.defaultProject": "Проект по умолчанию при входе (имя в Calamari, пусто = Check-in)",
  "setting.breakType": "Тип перерыва (имя в Calamari, пусто = Break)",
  "setting.coreMonday": "Понедельник",
  "setting.coreTuesday": "Вторник",
  "setting.coreWednesday": "Среда",
  "setting.coreThursday": "Четверг",
  "setting.coreFriday": "Пятница",
  "setting.coreSaturday": "Суббота",
  "setting.coreSunday": "Воскресенье",
}
