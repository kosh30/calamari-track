pragma ComponentBehavior: Bound

import QtQuick
import qs.Commons
import qs.Ui
import "js/contrast.mjs" as Contrast
import "js/scrollindicator.mjs" as ScrollIndicator
import "js/settingsform.mjs" as SettingsFormLogic

// The settings page of the panel: one text field per entry of the
// manifest's barWidget.schema, grouped into cards by that schema's own
// barWidget.groups, checked by js/settingsform.mjs and saved through the
// service into the bar entry of shell.json.
//
// Checking and saving stay flat and schema-wide — a card is a way of showing
// the fields, not a unit anything is read or written by.
Column {
    id: root

    property var service: null
    signal done

    readonly property var widget: root.service && root.service.manifest ? root.service.manifest.barWidget || null : null
    readonly property var schema: root.widget ? root.widget.schema || [] : []
    readonly property var groups: root.widget ? root.widget.groups || [] : []
    readonly property string version: root.service && root.service.manifest ? root.service.manifest.version || "" : ""
    // Filled when the page opens, then edited in place; errors after "Speichern".
    property var cards: []
    property var texts: ({})
    property var errors: ({})
    property string saveError: ""
    property real maxFieldsHeight: Style.space(440)

    // How far the quiet things on this page may step back (js/contrast.mjs),
    // measured against the panel's own card rather than the desktop behind it
    // — see ActionButton.qml.
    readonly property var strength: Contrast.strengths(Color.foreground, Color.popups.background)

    function load() {
        var settings = root.service ? root.service.settings : null
        root.cards = SettingsFormLogic.formCards(root.schema, root.groups, settings)
        root.texts = SettingsFormLogic.formTexts(root.schema, settings)
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
                    model: root.cards

                    // One tinted card per group, headed in the spaced
                    // capitals a secondary action speaks in — a caption here
                    // against a body size there, but the same voice.
                    //
                    // The tint is the kit's own normal fill. The hairline is
                    // not: Style.normalBorderColor is a control's border at
                    // 40 %, which around a card full of bordered fields would
                    // shout. Without any line at all a 4 % tint vanishes on a
                    // light theme, where foreground and background are close.
                    Rectangle {
                        id: card

                        required property var modelData
                        readonly property real inset: Style.space(8)

                        width: fieldColumn.width
                        implicitHeight: cardColumn.implicitHeight + card.inset * 2
                        radius: Style.cornerRadius
                        color: Style.normalFill
                        border.width: Style.spacing.hairline
                        border.color: Util.alpha(Color.foreground, 0.1)

                        Column {
                            id: cardColumn

                            x: card.inset
                            y: card.inset
                            width: card.width - card.inset * 2
                            spacing: Style.space(6)

                            Text {
                                width: parent.width
                                wrapMode: Text.Wrap
                                color: Util.alpha(Color.foreground, root.strength.quiet)
                                font.family: Style.font.family
                                font.pixelSize: Style.font.caption
                                // The shell's own spacing for capitals
                                // (Ui/PanelHero.qml), as in ActionButton.qml.
                                font.letterSpacing: 1.2
                                font.bold: true
                                text: card.modelData.title.toUpperCase()
                            }

                            // Said once for the whole card, which is what
                            // spares the seven core times their own sentence.
                            Text {
                                width: parent.width
                                visible: text !== ""
                                wrapMode: Text.Wrap
                                color: Util.alpha(Color.foreground, root.strength.quiet)
                                font.family: Style.font.family
                                font.pixelSize: Style.font.bodySmall
                                text: card.modelData.description
                            }

                            Repeater {
                                model: card.modelData.fields

                                Column {
                                    id: row

                                    required property var modelData
                                    width: cardColumn.width
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
                }
            }
        }

        // Where in the fields the window stands, while there is more than
        // fits (js/scrollindicator.mjs). It hangs in the panel's own right
        // margin, beside the fields rather than on them: laid over their right
        // edge it came out the same width and colour as a text field's border
        // and read as one. Nothing is taken from the fields for it, and it is
        // gone altogether while everything fits.
        //
        // That margin is Ui/KeyboardPanel.qml's padding, so the bar is centred
        // in exactly that token rather than at a measured-off distance that
        // only happened to land inside it. It does draw outside its parent:
        // nothing in the chain clips today, and if that ever changes the bar
        // goes quietly, which neither qmllint nor the tests can see — the lint
        // snapshot of KeyboardPanel carries no padding at all. That nothing
        // clips is a decision now, not an accident: docs/adr/0005.
        Rectangle {
            readonly property var place: ScrollIndicator.thumb(fields.visibleArea.yPosition, fields.visibleArea.heightRatio, parent.height, Style.space(12))
            visible: place.visible
            anchors.right: parent.right
            anchors.rightMargin: -(Style.spacing.popupPadding + width) / 2
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
