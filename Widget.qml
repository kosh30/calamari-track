import QtQuick
import Quickshell.Io
import qs.Commons
import qs.Ui

// Bar entry point: the icon in the bar plus the popup panel it toggles.
// The bar identifies an open popup by this widget (slot.activeItem), so the
// open/close/opened contract is forwarded from the nested Panel.qml.
BarWidget {
    id: root
    moduleName: "kosh.calamari-tracker"

    property var panelItem: null
    readonly property var service: bar && bar.shell ? bar.shell.serviceFor(moduleName) : null
    // kind: auth | error | unknown | running | idle (js/shiftclock.mjs barView)
    readonly property var view: service && service.barView ? service.barView : ({ kind: "unknown", text: "" })
    readonly property bool alerting: view.kind === "auth" || view.kind === "error"
    readonly property color barForeground: bar ? bar.barForeground : Color.foreground

    // The theme's green from colors.toml; the shell palette has none.
    property color themeGreen: "#5faf5f"

    FileView {
        path: Color.currentThemePath + "/colors.toml"
        printErrors: false
        onLoaded: {
            var match = /^green\s*=\s*"(#[0-9a-fA-F]{6})"/m.exec(text())
            if (match)
                root.themeGreen = match[1]
        }
    }

    readonly property bool opened: panelItem ? panelItem.opened === true : false
    readonly property bool popoutSwitchClosing: panelItem ? panelItem.popoutSwitchClosing === true : false

    function open() {
        if (panelItem)
            panelItem.open()
    }
    function close() {
        if (panelItem)
            panelItem.close()
    }
    function togglePanel() {
        if (panelItem)
            panelItem.toggle()
    }
    function closeForPopoutSwitch() {
        if (panelItem)
            panelItem.closeForPopoutSwitch()
    }

    function injectPanel() {
        var target = panelLoader.item
        if (!target)
            return
        panelItem = target
        target.bar = root.bar
        target.settings = root.settings
        target.anchorItem = button
        target.hostWidget = root
        target.service = root.service
    }

    implicitWidth: button.implicitWidth
    implicitHeight: button.implicitHeight

    onBarChanged: injectPanel()
    onSettingsChanged: injectPanel()
    onServiceChanged: injectPanel()

    Loader {
        id: panelLoader
        active: true
        source: Qt.resolvedUrl("Panel.qml")
        visible: false
        onLoaded: {
            root.injectPanel()
            Qt.callLater(root.injectPanel)
        }
    }

    WidgetButton {
        id: button
        anchors.fill: parent
        bar: root.bar
        text: root.alerting ? "󰀦" : (root.view.text ? "󰔟 " + root.view.text : "󰔟")
        active: root.alerting
        foreground: root.view.kind === "running" ? root.themeGreen
            : root.view.kind === "idle" ? Color.muted : root.barForeground
        dimmed: root.view.kind === "unknown"
        tooltipText: root.opened ? "" : root.view.kind === "auth" ? "Calamari: Anmeldung nötig"
            : root.view.kind === "error" ? "Calamari: Fehler"
            : root.view.kind === "running" ? "Calamari: Schicht läuft"
            : root.view.kind === "idle" ? "Calamari: keine laufende Schicht" : "Calamari Tracker"

        onPressed: function (b) {
            if (b === Qt.LeftButton)
                root.togglePanel()
        }
    }
}
