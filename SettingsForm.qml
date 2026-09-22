pragma ComponentBehavior: Bound

import QtQuick
import qs.Commons
import qs.Ui
import "js/settingsform.mjs" as SettingsFormLogic

// The settings page of the panel: one text field per entry of the
// manifest's barWidget.schema, checked by js/settingsform.mjs and saved
// through the service into the bar entry of shell.json.
Column {
    id: root

    property var service: null
    signal done

    readonly property var schema: root.service && root.service.manifest && root.service.manifest.barWidget
        ? root.service.manifest.barWidget.schema || [] : []
    // Filled when the page opens, then edited in place; errors after "Speichern".
    property var fields: []
    property var texts: ({})
    property var errors: ({})
    property string saveError: ""
    property real maxFieldsHeight: Style.space(440)

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
    Flickable {
        width: parent.width
        height: Math.min(fieldColumn.implicitHeight, root.maxFieldsHeight)
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

        Button {
            text: "Abbrechen"
            bordered: true
            onClicked: root.done()
        }

        Button {
            text: "Speichern"
            bordered: true
            onClicked: root.save()
        }
    }
}
