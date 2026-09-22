import QtQuick
import Quickshell.Io

// Headless singleton for the plugin. Owns the runtime state and the calls
// to bin/calamari (keepLoaded: code changes here need a shell restart).
// It makes no decisions of its own beyond mapping helper answers to state.
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

    readonly property string helper: Qt.resolvedUrl("bin/calamari").toString().replace(/^file:\/\//, "")

    function refreshIdentity() {
        if (!whoamiProc.running)
            whoamiProc.running = true
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

    Process {
        id: whoamiProc
        command: [root.helper, "whoami"]
        stdout: StdioCollector {
            onStreamFinished: root.applyIdentity(root.parse(text))
        }
    }

    Process {
        id: loginProc
        command: [root.helper, "login"]
        stdout: StdioCollector {
            onStreamFinished: {
                var out = root.parse(text)
                if (out.ok)
                    root.refreshIdentity()
                else
                    root.applyError(out)
            }
        }
    }

    Component.onCompleted: refreshIdentity()
}
