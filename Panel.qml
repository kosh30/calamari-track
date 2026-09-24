import QtQuick
import qs.Commons
import qs.Ui
import "js/shiftclock.mjs" as ShiftClock
import "js/reminders.mjs" as Reminders

// Popup panel toggled from the bar icon: login state, shift status and
// clocking in/out (page "main"); on right-click a small menu (page "menu")
// leading to the settings (page "settings", SettingsForm.qml). Clocking
// out means Feierabend (js/shiftclock.mjs).
Panel {
    id: root
    moduleName: "kosh.calamari-tracker"
    manageIpc: false

    property var anchorItem: null
    property var hostWidget: null
    property var service: null
    readonly property string authState: service ? service.authState : "unknown"
    readonly property bool loggingIn: service ? service.loggingIn === true : false
    readonly property var view: service ? service.barView : null
    readonly property var stampAction: authState === "ok" && view !== null ? ShiftClock.stampAction(view) : null
    readonly property var breakAction: authState === "ok" && view !== null ? ShiftClock.breakAction(view) : null
    readonly property var feierabendAction: authState === "ok" && view !== null ? ShiftClock.feierabendAction(view) : null
    // After the final warning: the countdown to the auto-close.
    readonly property string countdown: service ? Reminders.countdownText(service.decision, service.now) : ""

    // A button's text, with "…" while its own action runs.
    // During the countdown clocking out is "Jetzt ausstempeln".
    function actionText(action) {
        var busy = root.service !== null && root.service.stampingAction === action
        var label = action === "clock-out" && root.countdown !== "" ? "Jetzt ausstempeln" : ShiftClock.stampLabel(action)
        return label + (busy ? " …" : "")
    }

    property string page: "main"

    function showPage(name) {
        root.page = name
        if (name === "settings")
            settingsForm.load()
    }

    onOpenedChanged: {
        if (!root.opened)
            root.page = "main"
        else if (root.page === "main" && root.service)
            root.service.poll()
    }
    readonly property var barIdentity: hostWidget || root

    function switchPanel(direction) {
        if (root.bar && typeof root.bar.switchPanelFrom === "function")
            return root.bar.switchPanelFrom(root.barIdentity, direction)
        return false
    }

    KeyboardPanel {
        id: panel
        anchorItem: root.anchorItem
        owner: root.barIdentity
        bar: root.bar
        open: root.opened
        focusTarget: keyCatcher
        contentWidth: panel.fittedContentWidth(Style.space(root.page === "settings" ? 420 : 320))
        contentHeight: panel.fittedContentHeight(content.implicitHeight)

        PanelKeyCatcher {
            id: keyCatcher
            anchors.fill: parent
            onCloseRequested: root.close()
            onTabRequested: function (direction) {
                root.switchPanel(direction)
            }

            Column {
                id: content
                width: parent.width

                Button {
                    visible: root.page === "menu"
                    text: "Einstellungen"
                    iconText: "󰒓"
                    bordered: true
                    onClicked: root.showPage("settings")
                }

                SettingsForm {
                    id: settingsForm
                    visible: root.page === "settings"
                    width: parent.width
                    service: root.service
                    onDone: root.close()
                }

                Column {
                    id: mainPage
                    visible: root.page === "main"
                    width: parent.width
                    spacing: Style.space(8)

                    Text {
                        text: "Calamari Tracker"
                        color: Color.foreground
                        font.family: Style.font.family
                        font.pixelSize: Style.font.body
                        font.bold: true
                    }

                    Text {
                        width: parent.width
                        wrapMode: Text.Wrap
                        color: Color.foreground
                        font.family: Style.font.family
                        font.pixelSize: Style.font.body
                        text: root.loggingIn ? "Anmeldung im Browser läuft …"
                            : root.authState === "ok" ? (root.service.userName ? "Angemeldet als " + root.service.userName : "Angemeldet")
                            : root.authState === "required" ? "Anmeldung nötig"
                            : root.authState === "error" ? "Calamari nicht erreichbar"
                            : "Verbinde …"
                    }

                    Text {
                        width: parent.width
                        visible: root.authState === "ok" && root.service !== null
                        wrapMode: Text.Wrap
                        color: Color.foreground
                        font.family: Style.font.family
                        font.pixelSize: Style.font.body
                        readonly property var shift: root.service ? root.service.shiftState : null
                        readonly property var view: root.view
                        text: !view || view.kind === "unknown" ? "Schichtstatus wird abgefragt …"
                            : view.kind === "error" ? "Schichtstatus unbekannt"
                            : view.kind === "reminder" ? "Noch nicht eingestempelt, die Kernzeit läuft"
                            : view.kind === "break" ? "Pause seit " + ShiftClock.breakSinceText(shift) + " (" + view.text + ")"
                            : view.kind === "idle" ? (shift.clockedOutAt ? "Feierabend seit " + shift.clockedOutAt : "Keine laufende Schicht")
                            : shift.startedAt ? "Schicht läuft seit " + shift.startedAt + " (" + view.text + ")"
                            : "Schicht läuft"
                    }

                    Text {
                        width: parent.width
                        visible: root.countdown !== ""
                        wrapMode: Text.Wrap
                        color: Color.urgent
                        font.family: Style.font.family
                        font.pixelSize: Style.font.body
                        font.bold: true
                        text: root.countdown
                    }

                    Button {
                        visible: root.service !== null && root.service.decision.canExtend === true
                        text: Reminders.extendLabel(root.service ? root.service.config : null)
                        bordered: true
                        onClicked: root.service.postpone()
                    }

                    Text {
                        width: parent.width
                        visible: text !== "" && root.authState === "ok"
                        wrapMode: Text.Wrap
                        color: Color.foreground
                        font.family: Style.font.family
                        font.pixelSize: Style.font.body
                        text: root.service ? ShiftClock.workedText(root.service.shiftState, root.service.now) : ""
                    }

                    Button {
                        visible: root.stampAction !== null
                        enabled: root.service !== null && !root.service.busy
                        text: root.actionText(root.stampAction)
                        bordered: true
                        onClicked: root.service.stamp(root.stampAction)
                    }

                    Button {
                        visible: root.breakAction !== null
                        enabled: root.service !== null && !root.service.busy
                        text: root.actionText(root.breakAction)
                        bordered: true
                        onClicked: root.service.stamp(root.breakAction)
                    }

                    Button {
                        visible: root.feierabendAction !== null
                        enabled: root.service !== null && !root.service.busy
                        text: root.actionText(root.feierabendAction)
                        tooltipText: "Die Schicht endet beim Beginn der Pause (ist er Calamari nicht bekannt: jetzt)"
                        bordered: true
                        onClicked: root.service.stamp(root.feierabendAction)
                    }

                    Button {
                        visible: root.service !== null && root.authState === "ok"
                        readonly property bool dayOff: root.service !== null && root.service.dayOff
                        text: dayOff ? "Heute frei (zurücknehmen)" : "Heute frei"
                        tooltipText: "Keine Stempel-Erinnerungen bis morgen"
                        selected: dayOff
                        bordered: true
                        onClicked: root.service.setDayOff(!dayOff)
                    }

                    Text {
                        width: parent.width
                        visible: root.service !== null && root.service.stampError !== ""
                        wrapMode: Text.Wrap
                        color: Color.urgent
                        font.family: Style.font.family
                        font.pixelSize: Style.font.body
                        text: root.service ? root.service.stampError : ""
                    }

                    Text {
                        width: parent.width
                        visible: root.service !== null && root.service.errorMessage !== "" && !root.loggingIn
                        wrapMode: Text.Wrap
                        color: Color.urgent
                        font.family: Style.font.family
                        font.pixelSize: Style.font.body
                        text: root.service ? root.service.errorMessage : ""
                    }

                    Button {
                        visible: root.service !== null && root.authState !== "ok" && !root.loggingIn
                        text: "Neu anmelden"
                        bordered: true
                        onClicked: root.service.login()
                    }
                }
            }
        }
    }
}
