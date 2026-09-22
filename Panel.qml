import QtQuick
import qs.Commons
import qs.Ui
import "js/shiftclock.mjs" as ShiftClock

// Popup panel toggled from the bar icon: login state, shift status and
// clocking in/out. Clocking out means Feierabend (js/shiftclock.mjs).
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

    onOpenedChanged: {
        if (root.opened && root.service)
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
        contentWidth: panel.fittedContentWidth(Style.space(320))
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
                        : view.kind === "idle" ? (shift.clockedOutAt ? "Feierabend seit " + shift.clockedOutAt : "Keine laufende Schicht")
                        : shift.startedAt ? "Schicht läuft seit " + shift.startedAt + " (" + view.text + ")"
                        : "Schicht läuft"
                }

                Button {
                    visible: root.stampAction !== null
                    enabled: root.service !== null && !root.service.busy
                    readonly property bool clockOut: root.stampAction === "clock-out"
                    text: root.service && root.service.stamping ? (clockOut ? "Stemple aus …" : "Stemple ein …")
                        : clockOut ? "Ausstempeln" : "Einstempeln"
                    bordered: true
                    onClicked: root.service.stamp(root.stampAction)
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
