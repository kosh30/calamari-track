import QtQuick
import qs.Commons
import qs.Ui
import "js/shiftclock.mjs" as ShiftClock
import "js/reminders.mjs" as Reminders
import "js/panelheader.mjs" as PanelHeader
import "js/daytimeline.mjs" as DayTimeline

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

    // The header block (js/panelheader.mjs): the duration as the page's
    // largest number, the line placing it, the core-time progress and the day
    // line. Null while no login stands, when the shift says nothing worth a
    // header.
    readonly property var headerModel: authState === "ok" && service !== null && view !== null ? PanelHeader.headerView({
        view: view,
        state: service.shiftState,
        now: service.now,
        day: service.dayInfo,
        config: service.config
    }) : null
    readonly property var progress: headerModel ? headerModel.progress : null
    readonly property var timeline: headerModel ? headerModel.timeline : null

    // A button's text, with "…" while its own action runs.
    // During the countdown clocking out is "Jetzt ausstempeln".
    function actionText(action) {
        var busy = root.service !== null && root.service.stampingAction === action
        var label = action === "clock-out" && root.countdown !== "" ? "Jetzt ausstempeln" : ShiftClock.stampLabel(action)
        return label + (busy ? " …" : "")
    }

    function loginText() {
        if (root.loggingIn)
            return "Anmeldung im Browser läuft …"
        if (root.authState === "ok")
            return root.service.userName ? "Angemeldet als " + root.service.userName : "Angemeldet"
        if (root.authState === "required")
            return "Anmeldung nötig"
        if (root.authState === "error")
            return "Calamari nicht erreichbar"
        return "Verbinde …"
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

                    // The page's anchor: the running duration as the largest
                    // number, the line placing it, the progress through today's
                    // core time, and the day as one line. The "Calamari Tracker"
                    // title used to sit here; the number is the better anchor,
                    // and dropping the title pays for the remaining-time line.
                    Column {
                        visible: root.headerModel !== null
                        width: parent.width
                        spacing: Style.space(4)

                        Text {
                            visible: text !== ""
                            color: Color.foreground
                            font.family: Style.font.family
                            font.pixelSize: Style.fontPx(1.5)
                            font.bold: true
                            text: root.headerModel ? root.headerModel.duration : ""
                        }

                        Text {
                            width: parent.width
                            wrapMode: Text.Wrap
                            color: Qt.darker(Color.foreground, 1.4)
                            font.family: Style.font.family
                            font.pixelSize: Style.font.bodySmall
                            text: root.headerModel ? root.headerModel.caption : ""
                        }

                        // Progress through the core time: absent on a day
                        // without one and before it starts, so there is never
                        // an empty bar. Two rectangles, the shell's own way
                        // with a read-only meter (Ui has no such component).
                        Rectangle {
                            visible: root.progress !== null
                            width: parent.width
                            height: Style.space(4)
                            radius: height / 2
                            color: Qt.rgba(Color.foreground.r, Color.foreground.g, Color.foreground.b, 0.15)

                            Rectangle {
                                anchors.left: parent.left
                                anchors.verticalCenter: parent.verticalCenter
                                height: parent.height
                                radius: parent.radius
                                color: Color.accent
                                width: parent.width * (root.progress ? root.progress.fraction : 0)

                                Behavior on width {
                                    NumberAnimation {
                                        duration: 320
                                        easing.type: Easing.OutCubic
                                    }
                                }
                            }
                        }

                        Text {
                            width: parent.width
                            visible: root.progress !== null
                            wrapMode: Text.Wrap
                            color: Qt.darker(Color.foreground, 1.4)
                            font.family: Style.font.family
                            font.pixelSize: Style.font.caption
                            text: root.progress ? root.progress.text : ""
                        }

                        // The day as one lying line (js/daytimeline.mjs): the
                        // shifts filled, the running Pause left out, a mark for
                        // "now", the span's ends written underneath. Deliberately
                        // without a background track behind the filled parts — a
                        // faintly filled full line reads as a loading bar instead
                        // of a measurement.
                        Column {
                            visible: root.timeline !== null
                            width: parent.width
                            spacing: Style.space(2)

                            Item {
                                width: parent.width
                                height: Style.space(10)

                                Repeater {
                                    model: root.timeline ? root.timeline.segments : []

                                    Rectangle {
                                        required property var modelData
                                        readonly property var place: DayTimeline.placeSegment(modelData, parent.width, Style.space(2))
                                        anchors.verticalCenter: parent.verticalCenter
                                        x: place.x
                                        width: place.width
                                        height: Style.space(6)
                                        radius: Style.space(2)
                                        color: modelData.running ? Color.accent : Qt.darker(Color.foreground, 1.2)
                                    }
                                }

                                // "Now": taller than the segments, so its ends show
                                // even where it crosses one. Gone once it would sit
                                // outside the line, rather than lying at its edge.
                                Rectangle {
                                    readonly property var place: DayTimeline.placeMark(root.timeline && root.timeline.nowFraction !== null ? root.timeline.nowFraction : 0, parent.width, Style.space(1))
                                    visible: root.timeline !== null && root.timeline.nowFraction !== null
                                    x: place.x
                                    width: place.width
                                    height: parent.height
                                    color: Color.foreground

                                    Behavior on x {
                                        NumberAnimation {
                                            duration: 320
                                            easing.type: Easing.OutCubic
                                        }
                                    }
                                }

                                // The exact times on hover; clicks go through to the
                                // page underneath.
                                MouseArea {
                                    id: dayLineHover
                                    anchors.fill: parent
                                    acceptedButtons: Qt.NoButton
                                    hoverEnabled: true

                                    PanelToolTip {
                                        visible: dayLineHover.containsMouse
                                        text: root.timeline ? root.timeline.tooltip : ""
                                    }
                                }
                            }

                            Item {
                                width: parent.width
                                height: spanStart.implicitHeight

                                Text {
                                    id: spanStart
                                    anchors.left: parent.left
                                    color: Qt.darker(Color.foreground, 1.4)
                                    font.family: Style.font.family
                                    font.pixelSize: Style.font.caption
                                    text: root.timeline ? root.timeline.startText : ""
                                }

                                Text {
                                    anchors.right: parent.right
                                    color: Qt.darker(Color.foreground, 1.4)
                                    font.family: Style.font.family
                                    font.pixelSize: Style.font.caption
                                    text: root.timeline ? root.timeline.endText : ""
                                }
                            }
                        }
                    }

                    Text {
                        width: parent.width
                        wrapMode: Text.Wrap
                        color: Color.foreground
                        font.family: Style.font.family
                        font.pixelSize: Style.font.body
                        text: root.loginText()
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
