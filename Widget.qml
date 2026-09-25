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
    // kind: auth | error | unknown | running | break | reminder | idle (js/shiftclock.mjs barView)
    readonly property var view: service && service.barView ? service.barView : ({
            kind: "unknown",
            text: ""
        })
    readonly property bool alerting: view.kind === "auth" || view.kind === "error"
    readonly property color barForeground: bar ? bar.barForeground : Color.foreground

    function viewForeground() {
        switch (root.view.kind) {
        case "running":
            return root.themeGreen
        case "break":
            return root.themeYellow
        case "reminder":
            return Color.urgent
        case "idle":
            return Color.muted
        }
        return root.barForeground
    }

    function viewTooltip() {
        switch (root.view.kind) {
        case "auth":
            return "Calamari: Anmeldung nötig"
        case "error":
            return root.service.errorTooltip
        case "running":
            return "Calamari: Schicht läuft"
        case "reminder":
            return "Calamari: noch nicht eingestempelt"
        case "break":
            return "Calamari: Pause"
        case "idle":
            return "Calamari: keine laufende Schicht"
        }
        return "Calamari Tracker"
    }

    // The theme's green and yellow from colors.toml; the shell palette has none.
    property color themeGreen: "#5faf5f"
    property color themeYellow: "#d7af5f"

    FileView {
        path: Color.currentThemePath + "/colors.toml"
        printErrors: false
        onLoaded: {
            root.themeGreen = root.themeColor(text(), "green", root.themeGreen)
            root.themeYellow = root.themeColor(text(), "yellow", root.themeYellow)
        }
    }

    function themeColor(toml, name, fallback) {
        var match = new RegExp("^" + name + "\\s*=\\s*\"(#[0-9a-fA-F]{6})\"", "m").exec(toml)
        return match ? match[1] : fallback
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
    // Left click: the stamping page; right click: the menu with the settings.
    function openPage(page) {
        if (!panelItem)
            return
        if (panelItem.opened && panelItem.page === page) {
            panelItem.close()
            return
        }
        panelItem.showPage(page)
        if (!panelItem.opened)
            panelItem.open()
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

    // The service owns the timers and reminders; it reads this widget's settings.
    function injectSettings() {
        if (root.service)
            root.service.settings = root.settings
    }

    onBarChanged: injectPanel()
    onSettingsChanged: {
        injectPanel()
        injectSettings()
    }
    onServiceChanged: {
        injectPanel()
        injectSettings()
    }

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
        readonly property string glyph: root.view.kind === "break" ? "󰅶" : "󰔟"
        text: root.alerting ? "󰀦" : (root.view.text ? glyph + " " + root.view.text : glyph)
        active: root.alerting
        foreground: root.viewForeground()
        dimmed: root.view.kind === "unknown"
        tooltipText: root.opened ? "" : root.viewTooltip()

        onPressed: function (b) {
            if (b === Qt.LeftButton)
                root.openPage("main")
            else if (b === Qt.RightButton)
                root.openPage("menu")
        }
    }
}
