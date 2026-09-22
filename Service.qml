import QtQuick
import Quickshell
import Quickshell.Io
import "js/shiftclock.mjs" as ShiftClock

// Headless singleton for the plugin. Owns the runtime state, the poll timer
// and the calls to bin/calamari (keepLoaded: code changes here need a shell
// restart). Decisions live in js/shiftclock.mjs; this file only wires them.
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
        state: root.shiftState, now: root.now, authState: root.authState, failed: root.statusFailed
    })

    readonly property int pollInterval: 3 * 60 * 1000
    readonly property string helper: Qt.resolvedUrl("bin/calamari").toString().replace(/^file:\/\//, "")
    readonly property string stateDir: (Quickshell.env("XDG_STATE_HOME") || Quickshell.env("HOME") + "/.local/state") + "/calamari-tracker"

    function refreshIdentity() {
        if (!whoamiProc.running)
            whoamiProc.running = true
    }

    // Polls wait for the persisted state, so an answer cannot be undone by
    // loading an older file afterwards.
    function poll() {
        if (root.stateLoaded && !statusProc.running && !startTimeProc.running)
            statusProc.running = true
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
        root.errorMessage = ""
        if (root.authState !== "ok")
            root.refreshIdentity()
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

    // The duration ticks locally between two polls.
    Timer {
        interval: 15 * 1000
        running: true
        repeat: true
        onTriggered: root.now = new Date()
    }

    Component.onCompleted: {
        refreshIdentity()
        mkdirProc.running = true
    }
}
