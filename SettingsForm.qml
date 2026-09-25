pragma ComponentBehavior: Bound

import QtQuick
import qs.Commons
import qs.Ui
import "js/contrast.mjs" as Contrast
import "js/scrollindicator.mjs" as ScrollIndicator
import "js/settingsform.mjs" as SettingsFormLogic

// The settings page of the panel: one text field per entry of the
// manifest's barWidget.schema, checked by js/settingsform.mjs and saved
// through the service into the bar entry of shell.json.
Column {
    id: root

    property var service: null
    signal done

    readonly property var schema: root.service && root.service.manifest && root.service.manifest.barWidget ? root.service.manifest.barWidget.schema || [] : []
    readonly property string version: root.service && root.service.manifest ? root.service.manifest.version || "" : ""
    // Filled when the page opens, then edited in place; errors after "Speichern".
    property var fields: []
    property var texts: ({})
    property var errors: ({})
    property string saveError: ""
    property real maxFieldsHeight: Style.space(440)

    // How far the quiet things on this page may step back (js/contrast.mjs).
    readonly property var strength: Contrast.strengths(Color.foreground, Color.background)

    function load() {
        root.fields = SettingsFormLogic.formFields(root.schema, root.service ? root.service.settings : null)
        var texts = {}
        for (var i = 0; i < root.fields.length; i++)
            texts[root.fields[i].key] = root.fields[i].text
        root.texts = texts
        root.errors = {}
        root.saveError = ""
    }

    function save() {
        var result = SettingsFormLogic.readForm(root.schema, root.texts)
        root.errors = result.errors
        if (!result.settings)
            return
        if (root.service.saveSettings(result.settings))
            root.done()
        else
            root.saveError = "Speichern nicht möglich: die Shell hat die Einstellungen nicht übernommen."
    }

    spacing: Style.space(6)

    Text {
        text: "Einstellungen"
        color: Color.foreground
        font.family: Style.font.family
        font.pixelSize: Style.font.body
        font.bold: true
    }

    // The fields scroll (wheel or drag) so that title and buttons stay on
    // screen, however many settings the schema has.
    Item {
        width: parent.width
        height: Math.min(fieldColumn.implicitHeight, root.maxFieldsHeight)

        Flickable {
            id: fields
            anchors.fill: parent
            contentHeight: fieldColumn.implicitHeight
            clip: true
            boundsBehavior: Flickable.StopAtBounds

            Column {
                id: fieldColumn
                width: parent.width
                spacing: Style.space(6)

                Repeater {
                    model: root.fields

                    Column {
                        id: row
                        required property var modelData
                        width: fieldColumn.width
                        spacing: Style.space(2)

                        Text {
                            width: parent.width
                            wrapMode: Text.Wrap
                            color: Color.foreground
                            font.family: Style.font.family
                            font.pixelSize: Style.font.body
                            text: row.modelData.label
                        }

                        TextField {
                            width: parent.width
                            text: row.modelData.text
                            onTextEdited: {
                                var texts = Object.assign({}, root.texts)
                                texts[row.modelData.key] = text
                                root.texts = texts
                            }
                            onAccepted: root.save()
                        }

                        Text {
                            width: parent.width
                            visible: root.errors[row.modelData.key] !== undefined
                            wrapMode: Text.Wrap
                            color: Color.urgent
                            font.family: Style.font.family
                            font.pixelSize: Style.font.body
                            text: root.errors[row.modelData.key] || ""
                        }
                    }
                }
            }
        }

        // Where in the fields the window stands, while there is more than
        // fits (js/scrollindicator.mjs). It hangs in the panel's own right
        // margin, beside the fields rather than on them: laid over their right
        // edge it came out the same width and colour as a text field's border
        // and read as one. Nothing is taken from the fields for it, and it is
        // gone altogether while everything fits. Bar and margin are both
        // Style.space, so they keep their proportion at any spacing scale.
        Rectangle {
            readonly property var place: ScrollIndicator.thumb(fields.visibleArea.yPosition, fields.visibleArea.heightRatio, parent.height, Style.space(12))
            visible: place.visible
            anchors.right: parent.right
            anchors.rightMargin: -Style.space(6)
            y: place.y
            width: Style.space(3)
            height: place.height
            radius: width / 2
            color: Util.alpha(Color.foreground, root.strength.mark)
        }
    }

    Text {
        width: parent.width
        visible: root.saveError !== ""
        wrapMode: Text.Wrap
        color: Color.urgent
        font.family: Style.font.family
        font.pixelSize: Style.font.body
        text: root.saveError
    }

    Row {
        spacing: Style.space(8)

        ActionButton {
            label: "Abbrechen"
            onClicked: root.done()
        }

        ActionButton {
            label: "Speichern"
            primary: true
            onClicked: root.save()
        }
    }

    // The version comes from manifest.json, its only copy. Not Color.muted,
    // which a theme is free to put anywhere: Catppuccin Latte sets it to a
    // grey that stands at 1.9:1 on its own background, and this line was
    // unreadable there.
    Text {
        width: parent.width
        visible: text !== ""
        color: Util.alpha(Color.foreground, root.strength.quiet)
        font.family: Style.font.family
        font.pixelSize: Style.font.bodySmall
        text: root.version ? "Calamari Tracker " + root.version : ""
    }
}
