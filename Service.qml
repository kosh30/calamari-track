import QtQuick
import Quickshell
import Quickshell.Io
import "js/shiftclock.mjs" as ShiftClock
import "js/reminders.mjs" as Reminders

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
    property bool statusStale: false
    onDecisionChanged: Qt.callLater(root.runReminders)

    // Notification ids per reminder type, so a repetition replaces the last one.
    property var notificationIds: ({})

    // Stamping from the panel; stampError is the panel's line for the last
    // failed attempt. One helper call at a time, so an answer from before an
    // action cannot overwrite the action's result.
    property string stampError: ""
    readonly property bool stamping: stampProc.running
    readonly property string stampingAction: stampProc.running ? stampProc.action : ""
    readonly property bool busy: stampProc.running || statusProc.running || startTimeProc.running

    readonly property int pollInterval: root.setting("pollIntervalMinutes", 3) * 60 * 1000
    readonly property string helper: Qt.resolvedUrl("bin/calamari").toString().replace(/^file:\/\//, "")
    readonly property string stateDir: (Quickshell.env("XDG_STATE_HOME") || Quickshell.env("HOME") + "/.local/state") + "/calamari-tracker"

    function refreshIdentity() {
        if (!whoamiProc.running)
            whoamiProc.running = true
    }

    // Polls wait for the persisted state, so an answer cannot be undone by
    // loading an older file afterwards.
    function poll() {
        if (root.stateLoaded && !root.busy)
            statusProc.running = true
    }

    // "clock-in", "clock-out", "break-start" or "break-end", always now. A
    // failure is shown, never queued.
    // autoClose: the auto-close of js/reminders.mjs, which tells the user
    // to correct the end time afterwards.
    function stamp(action, autoClose) {
        if (!root.stateLoaded || root.busy)
            return
        root.stampError = ""
        stampProc.action = action
        stampProc.autoClose = autoClose === true
        stampProc.pollWhenDone = false
        stampProc.command = [root.helper, ShiftClock.helperCommand(action)]
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
            // The clock-out waits for a free helper; recorded once it starts.
            if (actions[i].type === "auto-close" && root.busy)
                continue
            root.setShiftState(Reminders.markSent(root.shiftState, actions[i].type, root.now))
            if (actions[i].type === "auto-close")
                root.stamp("clock-out", true)
            else
                root.notify(actions[i])
        }
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
        var result = ShiftClock.applyStatus(root.shiftState, out.running, root.now)
        root.setShiftState(result.state)
        if (result.startTimeQuery) {
            var after = result.startTimeQuery.after
            startTimeProc.command = after ? [root.helper, "start-time", "--after", after] : [root.helper, "start-time"]
            startTimeProc.running = true
        }
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
        if (out.ok && stampProc.autoClose)
            root.notify({ type: "auto-closed", at: Qt.formatTime(root.now, "HH:mm") })
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
        root.poll()
    }

    Process {
        id: whoamiProc
        command: [root.helper, "whoami"]
        stdout: StdioCollector {
            onStreamFinished: root.applyIdentity(root.parse(text))
        }
    }

    Process {
        id: statusProc
        command: [root.helper, "status"]
        stdout: StdioCollector {
            onStreamFinished: root.applyStatus(root.parse(text))
        }
    }

    Process {
        id: startTimeProc
        command: [root.helper, "start-time"]
        stdout: StdioCollector {
            onStreamFinished: root.applyStartTime(root.parse(text))
        }
    }

    Process {
        id: stampProc
        property string action: ""
        property bool autoClose: false
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
        onTriggered: root.poll()
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
        }
    }

    Component.onCompleted: {
        refreshIdentity()
        mkdirProc.running = true
    }
}
