import QtQuick
import qs.Commons
import qs.Ui

// Popup panel toggled from the bar icon. Shows the login state; shift
// status and the stamping actions arrive in later slices.
Panel {
    id: root
    moduleName: "kosh.calamari-tracker"
    manageIpc: false

    property var anchorItem: null
    property var hostWidget: null
    property var service: null
    readonly property string authState: service ? service.authState : "unknown"
    readonly property bool loggingIn: service ? service.loggingIn === true : false

    onOpenedChanged: {
        if (root.opened && root.service)
            root.service.refreshIdentity()
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
                    visible: root.authState !== "ok" && root.service !== null && root.service.errorMessage !== "" && !root.loggingIn
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
