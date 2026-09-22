import QtQuick
import qs.Commons
import qs.Ui

// Bar entry point: the icon in the bar plus the popup panel it toggles.
// The bar identifies an open popup by this widget (slot.activeItem), so the
// open/close/opened contract is forwarded from the nested Panel.qml.
BarWidget {
    id: root
    moduleName: "kosh.calamari-tracker"

    property var panelItem: null

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
    }

    implicitWidth: button.implicitWidth
    implicitHeight: button.implicitHeight

    onBarChanged: injectPanel()
    onSettingsChanged: injectPanel()

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

    BarIconButton {
        id: button
        anchors.fill: parent
        bar: root.bar
        text: "󰔟"
        slotSize: Style.bar.statusSlot
        tooltipText: root.opened ? "" : "Calamari Tracker"

        onPressed: function (b) {
            if (b === Qt.LeftButton)
                root.togglePanel()
        }
    }
}
