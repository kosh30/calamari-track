import QtQuick
import Quickshell
import Quickshell.Io
import Quickshell.Wayland
import "js/shiftclock.mjs" as ShiftClock
import "js/reminders.mjs" as Reminders
import "js/activity.mjs" as Activity

// Headless singleton for the plugin. Owns the runtime state, the poll timer
// and the calls to bin/calamari (keepLoaded: code changes here need a shell
// restart). Decisions live in js/shiftclock.mjs and js/reminders.mjs; this
// file only wires them.
Item {
    id: root

    property var shell: null
    property var manifest: null

    // "unknown" until the first answer, then "ok", "required" (login
    // needed) or "error" (network, rate limit, ...; see errorMessage).
    property string authState: "unknown"
    property string userName: ""
    property string errorMessage: ""
    readonly property bool authRequired: authState === "required"
    readonly property bool loggingIn: loginProc.running

    // Shift status, see js/shiftclock.mjs for the fields.
    property var shiftState: ShiftClock.emptyState()
    property bool statusFailed: false
    property date now: new Date()
    readonly property var barView: ShiftClock.barView({
        state: root.shiftState, now: root.now, authState: root.authState, failed: root.statusFailed,
        reminding: root.decision.barState === "reminder"
    })

    // The widget's settings (manifest barWidget.schema), handed over by Widget.qml.
    property var settings: ({})
    function setting(name, fallback) {
        var value = root.settings ? root.settings[name] : undefined
        return value === undefined || value === null ? fallback : value
    }
    // Saves the settings form (SettingsForm.qml) into this plugin's bar
    // entry of shell.json, as `omarchy bar set` would; the shell hands them
    // back through Widget.qml.
    function saveSettings(values) {
        if (!root.shell || typeof root.shell.updateEntryInline !== "function")
            return false
        return root.shell.updateEntryInline("kosh.calamari-tracker", Object.assign({}, root.settings, values)) !== false
    }

    // The settings as they are; js/reminders.mjs fills in the defaults.
    readonly property var config: root.settings || ({})

    // Today's `day-info`, fetched once per date; null until then.
    property var dayInfo: null

    // What js/reminders.mjs decides for this moment. Re-evaluated whenever
    // time or state move; its actions are sent and recorded right away, so
    // the next evaluation no longer yields them.
    readonly property var decision: Reminders.decide(root.now, root.dayInfo,
        Object.assign({ failed: root.statusFailed || root.statusStale }, root.shiftState), root.config)

    // After a suspend the last status is old news (a shift may have been
    // stamped on the phone meanwhile): no reminder until a fresh answer.
    // Also from the start of the shell until the first answer: the saved
    // state may be hours old (a shift ended in the web meanwhile).
    property bool statusStale: true
    onDecisionChanged: Qt.callLater(root.runReminders)

    // Notification ids per reminder type, so a repetition replaces the last one.
    property var notificationIds: ({})

    // Stamping from the panel; stampError is the panel's line for the last
    // failed attempt. One helper call at a time, so an answer from before an
    // action cannot overwrite the action's result.
    property string stampError: ""
    readonly property bool stamping: stampProc.running
    readonly property string stampingAction: stampProc.running ? stampProc.action : ""
    readonly property bool busy: stampProc.running || statusProc.running || startTimeProc.running || endTimeProc.running || dayEndProc.running

    readonly property int pollInterval: root.setting("pollIntervalMinutes", 3) * 60 * 1000
    readonly property string helper: Qt.resolvedUrl("bin/calamari").toString().replace(/^file:\/\//, "")
    // Added to the shell's environment for every helper call: the REST API
    // of the setting apiUrl (docs/adr/0003); empty leaves the helper's default.
    readonly property var helperEnv: ({ CALAMARI_API_URL: root.setting("apiUrl", "") || null })
    readonly property string stateDir: (Quickshell.env("XDG_STATE_HOME") || Quickshell.env("HOME") + "/.local/state") + "/calamari-tracker"

    function refreshIdentity() {
        if (!whoamiProc.running)
            whoamiProc.running = true
    }

    // Polls wait for the persisted state, so an answer cannot be undone by
    // loading an older file afterwards.
    function poll() {
        if (!root.stateLoaded || root.busy)
            return
        // A day the plugin left with a running shift is settled first: no
        // shift survives midnight, but its end time may need a correction.
        // A failed question waits for the next tick, so it never keeps the
        // status from being asked (waking up, the network is often late).
        var pending = dayEndProc.blocked ? null : ShiftClock.pendingDayEnd(root.shiftState, new Date())
        if (pending) {
            dayEndProc.date = pending
            dayEndProc.command = [root.helper, "day-end", "--date", pending]
            dayEndProc.running = true
            return
        }
        statusProc.running = true
    }

    // "clock-in", "clock-out", "break-start" or "break-end", always now. A
    // clock-in goes over REST with the default project (docs/adr/0003). A
    // failure is shown, never queued, and never retried another way.
    // notice: the correction hint ({ type, lastActivity }, see
    // js/reminders.mjs notification) to send once the clock-out went through.
    function stamp(action, notice) {
        if (!root.stateLoaded || root.busy)
            return
        root.stampError = ""
        stampProc.action = action
        stampProc.notice = notice || null
        stampProc.pollWhenDone = false
        stampProc.command = [root.helper].concat(ShiftClock.helperCommand(action, root.setting("defaultProject", "")))
        stampProc.running = true
    }

    // From a Pause straight into the Feierabend; nothing to stamp.
    function endBreakAsFeierabend() {
        if (root.stateLoaded)
            root.setShiftState(ShiftClock.endBreakAsFeierabend(root.shiftState, new Date()))
    }

    // The panel switch "Heute frei".
    readonly property bool dayOff: ShiftClock.dayOffToday(root.shiftState, root.now)
    function setDayOff(on) {
        if (root.stateLoaded)
            root.setShiftState(ShiftClock.setDayOff(root.shiftState, on, new Date()))
    }

    function fetchDayInfo() {
        var today = Qt.formatDate(root.now, "yyyy-MM-dd")
        if (!dayProc.running && (!root.dayInfo || root.dayInfo.date !== today))
            dayProc.running = true
    }

    function runReminders() {
        var actions = root.decision.actions
        for (var i = 0; i < actions.length; i++) {
            var close = Reminders.closeFor(actions[i])
            // A clock-out waits for a free helper; recorded once it starts.
            if (close && root.busy)
                continue
            root.setShiftState(Reminders.markSent(root.shiftState, actions[i].type, root.now))
            if (close)
                root.stamp(close.stamp, close.notice)
            else
                root.notify(actions[i])
        }
    }

    // The user's activity (js/activity.mjs): a heartbeat each tick, and the
    // idle monitor with the lock timeout of the shell's idle config.
    readonly property int lockTimeoutSeconds: root.shell && root.shell.idleConfig && root.shell.idleConfig.lock > 0
        ? root.shell.idleConfig.lock : 300

    function recordActivity(next) {
        if (root.stateLoaded && next !== root.shiftState)
            root.setShiftState(next)
    }

    // "+1 h weiterarbeiten" in the panel.
    function postpone() {
        if (root.stateLoaded)
            root.setShiftState(Reminders.postpone(root.shiftState, root.config, new Date()))
    }

    // Notifications go out one at a time, in order; the queue only holds
    // what is due right now (nothing is sent to Calamari from here).
    property var noticeQueue: []

    function notify(action) {
        var text = Reminders.notification(action, root.dayInfo, root.shiftState, root.config)
        var webUrl = root.setting("webUrl", "")
        var click = text.click === "panel" ? ["omarchy-shell", "shell", "summon", "kosh.calamari-tracker"]
            : webUrl ? ["xdg-open", webUrl] : []
        root.noticeQueue = root.noticeQueue.concat([{ type: action.type, text: text, click: click }])
        root.sendNextNotice()
    }

    function sendNextNotice() {
        if (notifyProc.running || root.noticeQueue.length === 0)
            return
        var notice = root.noticeQueue[0]
        root.noticeQueue = root.noticeQueue.slice(1)
        var id = root.notificationIds[notice.type]
        var command = ["omarchy-notification-send", "-p", "-u", "normal", "-g", "󰔟"]
        if (id)
            command.push("-r", String(id))
        command.push(notice.text.headline, notice.text.body)
        if (notice.click.length > 0)
            command = command.concat(["--exec"], notice.click)
        notifyProc.type = notice.type
        notifyProc.command = command
        notifyProc.running = true
    }

    function login() {
        if (!loginProc.running)
            loginProc.running = true
    }

    function parse(text) {
        try {
            return JSON.parse(text)
        } catch (e) {
            return { ok: false, error: { code: "INTERNAL", message: "helper printed no JSON" } }
        }
    }

    function applyError(out) {
        // A failed or abandoned login leaves the user as logged out as before.
        var code = out.error.code
        root.authState = code === "AUTH_REQUIRED" || code === "LOGIN_FAILED" ? "required" : "error"
        root.errorMessage = out.error.message || out.error.code
    }

    function applyIdentity(out) {
        if (!out.ok)
            return applyError(out)
        root.authState = "ok"
        root.userName = out.name || ""
        root.errorMessage = ""
    }

    function applyStatus(out) {
        root.now = new Date()
        if (!out.ok) {
            root.statusFailed = true
            return applyError(out)
        }
        root.statusFailed = false
        root.statusStale = false
        root.errorMessage = ""
        if (root.authState !== "ok")
            root.refreshIdentity()
        root.fetchDayInfo()
        var result = ShiftClock.applyStatus(root.shiftState, out.shift, root.now,
            { startedAt: out.startedAt || null, breakSince: out.breakSince || null })
        root.setShiftState(result.state)
        if (result.startTimeQuery) {
            var after = result.startTimeQuery.after
            startTimeProc.command = after ? [root.helper, "start-time", "--after", after] : [root.helper, "start-time"]
            startTimeProc.running = true
        }
        if (result.endTimeQuery) {
            endTimeProc.after = result.endTimeQuery.after
            endTimeProc.command = [root.helper, "end-time", "--after", result.endTimeQuery.after]
            endTimeProc.running = true
        }
    }

    // How a day ended that the plugin left with a running shift. Calamari
    // ends an open shift at 23:59 (docs/adr/0002), so nothing is stamped
    // here; only the end time in Calamari may need the user's correction.
    // A failure leaves the question open for the next poll.
    function applyDayEnd(date, out) {
        dayEndProc.blocked = !out.ok
        if (!out.ok)
            return applyError(out)
        var result = ShiftClock.applyDayEnd(root.shiftState, date, out.ranToMidnight === true, new Date())
        root.setShiftState(result.state)
        if (result.notice)
            root.notify(result.notice)
    }

    // The end of a shift that ended outside the plugin, for today's total.
    // A failure is asked again with the next poll (pendingEnd).
    function applyEndTime(start, out) {
        if (out.ok)
            root.setShiftState(ShiftClock.applyEndTime(root.shiftState, start, out.endedAt))
    }

    function applyStartTime(out) {
        if (!out.ok) {
            root.statusFailed = true
            return applyError(out)
        }
        root.setShiftState(ShiftClock.applyStartTime(root.shiftState, out.startedAt))
    }

    function applyStamp(action, out) {
        root.now = new Date()
        var result = ShiftClock.applyStamp(root.shiftState, action, out, root.now)
        root.stampError = result.error
        stampProc.pollWhenDone = result.pollNow
        if (out.ok) {
            root.statusFailed = false
            root.errorMessage = ""
        }
        root.setShiftState(result.state)
        // A close that found no shift stamped nothing, so there is nothing to correct.
        if (out.ok && out.stamped !== false && stampProc.notice)
            root.notify(Object.assign({ at: Qt.formatTime(root.now, "HH:mm") }, stampProc.notice))
    }

    function setShiftState(next) {
        root.shiftState = next
        stateFile.setText(JSON.stringify(next, null, 2) + "\n")
    }

    // FileView preloads when path resolves and reloads after mkdir; only
    // the first answer counts.
    property bool stateLoaded: false

    function loadShiftState(text) {
        if (root.stateLoaded)
            return
        root.stateLoaded = true
        root.shiftState = ShiftClock.restoreState(text)
        // A saved idle state from before a restart is not today's truth.
        root.recordActivity(Activity.setIdle(root.shiftState, idleMonitor.isIdle, new Date(), root.lockTimeoutSeconds))
        root.poll()
    }

    Process {
        id: whoamiProc
        environment: root.helperEnv
        command: [root.helper, "whoami"]
        stdout: StdioCollector {
            onStreamFinished: root.applyIdentity(root.parse(text))
        }
    }

    Process {
        id: statusProc
        environment: root.helperEnv
        command: [root.helper, "status"]
        stdout: StdioCollector {
            onStreamFinished: root.applyStatus(root.parse(text))
        }
    }

    Process {
        id: endTimeProc
        environment: root.helperEnv
        property string after: ""
        stdout: StdioCollector {
            onStreamFinished: root.applyEndTime(endTimeProc.after, root.parse(text))
        }
    }

    Process {
        id: dayEndProc
        environment: root.helperEnv
        property string date: ""
        // Set by a failed question, cleared by the next tick of the timer.
        property bool blocked: false
        stdout: StdioCollector {
            onStreamFinished: root.applyDayEnd(dayEndProc.date, root.parse(text))
        }
        // The status of today is asked once the day before is settled, and
        // after a failure too (blocked then skips the question).
        onRunningChanged: if (!running) root.poll()
    }

    Process {
        id: startTimeProc
        environment: root.helperEnv
        command: [root.helper, "start-time"]
        stdout: StdioCollector {
            onStreamFinished: root.applyStartTime(root.parse(text))
        }
    }

    Process {
        id: stampProc
        environment: root.helperEnv
        property string action: ""
        property var notice: null
        // Ask Calamari for the real status once the helper has exited
        // (poll() waits while it runs).
        property bool pollWhenDone: false
        stdout: StdioCollector {
            onStreamFinished: root.applyStamp(stampProc.action, root.parse(text))
        }
        onRunningChanged: if (!running && pollWhenDone) root.poll()
    }

    Process {
        id: dayProc
        environment: root.helperEnv
        command: [root.helper, "day-info"]
        stdout: StdioCollector {
            onStreamFinished: {
                // A failure leaves the day unknown (no reminders); the next poll retries.
                var out = root.parse(text)
                if (out.ok)
                    root.dayInfo = out
            }
        }
    }

    Process {
        id: notifyProc
        property string type: ""
        onRunningChanged: if (!running) Qt.callLater(root.sendNextNotice)
        stdout: StdioCollector {
            onStreamFinished: {
                var id = parseInt(text, 10)
                if (id > 0) {
                    var ids = Object.assign({}, root.notificationIds)
                    ids[notifyProc.type] = id
                    root.notificationIds = ids
                }
            }
        }
    }

    Process {
        id: loginProc
        environment: root.helperEnv
        command: [root.helper, "login"]
        stdout: StdioCollector {
            onStreamFinished: {
                var out = root.parse(text)
                if (out.ok) {
                    root.refreshIdentity()
                    root.poll()
                } else {
                    root.applyError(out)
                }
            }
        }
    }

    Process {
        id: mkdirProc
        command: ["mkdir", "-p", root.stateDir]
        onRunningChanged: if (!running) stateFile.reload()
    }

    FileView {
        id: stateFile
        path: root.stateDir + "/state.json"
        watchChanges: false
        atomicWrites: true
        printErrors: false
        onLoaded: root.loadShiftState(text())
        onLoadFailed: root.loadShiftState("")
    }

    Timer {
        interval: root.pollInterval
        running: true
        repeat: true
        onTriggered: {
            dayEndProc.blocked = false
            root.poll()
        }
    }

    IdleMonitor {
        id: idleMonitor
        timeout: root.lockTimeoutSeconds
        respectInhibitors: true
        onIsIdleChanged: root.recordActivity(Activity.setIdle(root.shiftState, isIdle, new Date(), root.lockTimeoutSeconds))
    }

    // The duration ticks locally between two polls, and the reminder logic
    // looks again (its nextCheckAt is never further off than a tick matters).
    // A tick far too late means the machine slept: ask Calamari right away.
    property double lastTick: Date.now()
    Timer {
        interval: 15 * 1000
        running: true
        repeat: true
        onTriggered: {
            var tick = Date.now()
            if (tick - root.lastTick > 60 * 1000) {
                root.statusStale = true
                root.poll()
            }
            root.lastTick = tick
            root.now = new Date()
            root.recordActivity(Activity.heartbeat(root.shiftState, root.now))
        }
    }

    Component.onCompleted: {
        refreshIdentity()
        mkdirProc.running = true
    }
}
