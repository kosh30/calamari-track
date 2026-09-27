// English, the default locale (ADR 0006). This catalogue is the reference id
// set: every other locale is tested against it, so a key added here without a
// translation fails the suite rather than falling back silently.
//
// Ids are named after the thing, not the text, so rewording a message does not
// rename its key. A message with values is a function of a params object.

export const en = {
  // The bar's tooltip, one per barView kind (js/shiftclock.mjs).
  "bar.name": "Calamari Tracker",
  "bar.authRequired": "Calamari: login needed",
  "bar.running": "Calamari: shift running",
  "bar.reminder": "Calamari: not clocked in yet",
  "bar.break": "Calamari: break",
  "bar.idle": "Calamari: no running shift",

  // The panel's stamp buttons: the labels of the actions in js/shiftclock.mjs.
  "stamp.clockIn": "Clock in",
  "stamp.clockOut": "Clock out",
  "stamp.breakStart": "Begin break",
  "stamp.breakEnd": "End break",
  "stamp.endOfDay": "End of day",
  "stamp.clockOutNow": "Clock out now",

  // Why a stamping failed. Whole clauses, because stamp.failed puts them after
  // the action's name.
  "cause.network": "Calamari cannot be reached",
  "cause.rateLimited": "too many requests, please try again shortly",
  "cause.authRequired": "login needed",
  "cause.apiTerminalMissing": "no API Terminal in Calamari Clockin",
  "cause.apiScopeMissing": "the API key lacks a permission",
  "cause.apiKeyRequired": "no API key, please run bin/calamari api-key",
  "cause.apiKeyRejected": "Calamari rejects the API key",
  "cause.apiUrlRequired": "no REST API URL, please set it in the settings",
  // The project and the break type are Calamari's own values, typed by the
  // user into the settings. They are quoted, never translated.
  "cause.projectUnknown": (p) => `there is no project “${p.project}” in Calamari`,
  "cause.breakTypeUnknown": (p) => `there is no break type “${p.breakType}” in Calamari`,

  "stamp.failed": (p) => `${p.action} failed: ${p.cause}. Nothing will be filed later.`,
  "stamp.saysNoBreak": "no break",
  "stamp.saysStillBreak": "a break still",
  "stamp.mismatch": (p) => `${p.action}: Calamari reports ${p.says}. Please check in the web.`,
  "stamp.noShift": (p) => `${p.action}: Calamari reports no running shift.`,
  "stamp.noShiftCheck": (p) => `${p.action}: Calamari reports no running shift. Please check in the web.`,

  // The panel's line for the observed total of today.
  "shift.workedToday": (p) => `Worked today (observed): ${p.span}`,
  // The start of a running break, which the plugin may only know as "no later
  // than this" (js/shiftclock.mjs breakSinceText).
  "break.sinceAtLatest": (p) => `${p.time} at the latest`,

  // The caption under the panel's big number (js/panelheader.mjs).
  "header.statusPolling": "Asking for the shift status …",
  "header.statusUnknown": "Shift status unknown",
  "header.authRequired": "Login needed",
  "header.reminder": "Not clocked in yet, the core time is running",
  "header.breakSince": (p) => `On break since ${p.since}`,
  "header.endOfDaySince": (p) => `End of day since ${p.time}`,
  "header.noShift": "No running shift",
  "header.runningSince": (p) => `Shift running since ${p.time}`,
  "header.running": "Shift running",
  "header.coreDone": "Core time over",
  "header.coreLeft": (p) => `${p.span} left until the end of core time`,

  // The bar's tooltip for a failed poll (js/backoff.mjs). The retry clause is
  // its own id so the two codes that name a retry can share it.
  "backoff.retryIn": (p) => `next attempt in ${p.minutes} min`,
  "backoff.network": (p) => `Calamari cannot be reached, ${p.retry}`,
  "backoff.rateLimited": (p) => `Calamari: too many requests, ${p.retry}`,
  "backoff.apiUrlRequired": "Calamari: the REST API URL is missing, please set it in the settings",
  "backoff.apiKeyRequired": "Calamari: the API key is missing, please run bin/calamari api-key",
  "backoff.apiKeyRejected": "Calamari rejects the API key, please run bin/calamari api-key again",
  "backoff.apiTerminalMissing": "Calamari: no API Terminal in Clockin",
  "backoff.apiScopeMissing": "Calamari: the API key lacks a permission",
  "backoff.error": "Calamari: error",

  // The day line's tooltip (js/daytimeline.mjs).
  "timeline.coreTime": (p) => `Core time ${p.from}–${p.to}`,
  "timeline.shiftSince": (p) => `Shift since ${p.from} (running)`,
  "timeline.shiftRange": (p) => `Shift ${p.from}–${p.to}`,
  "timeline.breakSince": (p) => `Break since ${p.since}`,
  "timeline.endedBreaks": (p) => `Breaks ended: ${p.span} (contained in the shifts)`,

  // The notifications (js/reminders.mjs).
  "notify.softHint.headline": "A shift is still running",
  "notify.softHint.body": (p) => `The core time ended at ${p.coreEnd}.`,
  "notify.finalWarning.headline": "Final warning",
  "notify.finalWarning.body": (p) => `Auto-close at ${p.at}. In the panel: ${p.extend} or ${p.alt}.`,
  "notify.finalWarning.altEndOfDay": "end of day",
  "notify.finalWarning.altClockOut": "clock out now",
  "notify.autoClosed.headline": "Shift ended automatically",
  "notify.autoClosed.body": (p) => `Clocked out at ${p.at}. Please correct the end time in Calamari.`,
  "notify.autoClosed.bodyWithActivity": (p) =>
    `Clocked out at ${p.at}, last activity ${p.lastActivity}. Please correct the end time in Calamari to that.`,
  "notify.dayEndClosed.headline": "Yesterday's shift ended",
  "notify.dayEndClosed.body": (p) =>
    `The shift of ${p.date} ran to the day's end, Calamari ended it at 23:59. Please correct the end time there.`,
  "notify.dayEndClosed.bodyWithActivity": (p) =>
    `The shift of ${p.date} ran to the day's end, Calamari ended it at 23:59. Please correct the end time there to ${p.lastActivity} (the last activity).`,
  "notify.breakReminder.headline": "The break is still running",
  "notify.breakReminder.body": (p) => `The break has been running since ${p.since}.`,
  "notify.stampReminder.headline": "Not clocked in yet",
  "notify.stampReminder.body": (p) => `The core time has been running since ${p.coreStart}.`,

  // The panel outside the header: countdown, extend button, menu, login line.
  "panel.countdown": (p) => `Auto-close at ${p.at}, ${p.left} min left`,
  "panel.extendHour": "+1 h more work",
  "panel.extendMinutes": (p) => `+${p.minutes} min more work`,
  "panel.settings": "Settings",
  "panel.dayOff": "Today off",
  "panel.dayOffUndo": "Today off (undo)",
  "login.inBrowser": "Signing in, in the browser …",
  "login.asUser": (p) => `Signed in as ${p.name}`,
  "login.signedIn": "Signed in",
  "login.required": "Login needed",
  "login.unreachable": "Calamari cannot be reached",
  "login.connecting": "Connecting …",
  "login.signInAgain": "Sign in again",

  // The settings page (SettingsForm.qml, js/settingsform.mjs).
  "settings.title": "Settings",
  "settings.cancel": "Cancel",
  "settings.save": "Save",
  "settings.saveFailed": "Cannot save: the shell did not take the settings.",
  "group.other": "Other",
  "validate.integer": (p) => `A whole number from ${p.min} to ${p.max}`,
  "validate.time": "A time of day like 19:00",
  "validate.coreTime": (p) => `Empty, “${p.off}” or a core time like 09:00-16:45`,
  "validate.choice": (p) => `One of: ${p.options}`,
  "validate.url": "Empty or an address like https://company.calamari.io",

  // The word for a weekday with no core time. A stored token as well as a
  // label, so it is translated for input and display only (see ADR 0006).
  "coreTime.off": "off",

  // A day without a year, for the hint about a shift Calamari closed at 23:59.
  // Each locale orders it its own way; English puts the month first.
  "date.dayMonth": (p) => `${p.month}/${p.day}`,

  // The settings page: one id per schema group and per field key. The
  // manifest keeps the structure and an English label as the last resort;
  // what the form shows comes from here.

  "group.general": "General",
  "group.polling": "Polling and reminders",
  "group.break": "Break",
  "group.closing": "End of day",
  "group.core": "Core times",
  "group.connection": "Connection",
  "group.naming": "Project and break type",
  "group.core.description": (p) =>
    `Per weekday HH:MM-HH:MM, “${p.off}” for a day off, or empty for the work schedule from Calamari.`,

  "setting.language": "Language",
  "setting.pollIntervalMinutes": "Polling interval (minutes)",
  "setting.stampReminderMinutes": "Repeat the stamp reminder every (minutes)",
  "setting.breakLimitMinutes": "Break reminder after (minutes)",
  "setting.breakReminderMinutes": "Repeat the break reminder every (minutes)",
  "setting.softHintMinutes": "Soft hint after the end of core time (minutes)",
  "setting.finalWarningTime": "Time of the final warning (HH:MM)",
  "setting.autoCloseMinutes": "Auto-close after the final warning (minutes)",
  "setting.extendMinutes": "Shift from the “+1 h” button (minutes)",
  "setting.hardLimitTime": "Upper limit for the auto-close (HH:MM)",
  "setting.webUrl": "Calamari in the browser (e.g. https://company.calamari.io)",
  "setting.apiUrl": "Calamari REST API, e.g. https://company.calamari.io/api (key via bin/calamari api-key)",
  "setting.defaultProject": "Default project when clocking in (name in Calamari, empty = Check-in)",
  "setting.breakType": "Break type (name in Calamari, empty = Break)",
  "setting.coreMonday": "Monday",
  "setting.coreTuesday": "Tuesday",
  "setting.coreWednesday": "Wednesday",
  "setting.coreThursday": "Thursday",
  "setting.coreFriday": "Friday",
  "setting.coreSaturday": "Saturday",
  "setting.coreSunday": "Sunday",
}
