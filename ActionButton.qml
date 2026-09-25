// Modelled on omarchy-shell's Ui/Button.qml (basecamp/omarchy, MIT,
// Copyright (c) David Heinemeier Hansson) — see THIRD-PARTY-LICENSES.md.
// Its state cascade and its trick of reserving the widest border are taken
// from there; everything else is ours.

import QtQuick
import qs.Commons
import qs.Ui

// A panel button that says its rank before its label is read.
//
// The page's main action (`primary`) keeps the frame, the body size and the
// full foreground. Every other action steps back: no frame, one size down,
// and spaced capitals at a lowered foreground that only comes up to full
// under the pointer. Disabled dims either rank.
//
// This sits on BorderSurface rather than on the kit's Button because the
// spaced capitals are the point and Button has no letterSpacing to set. What
// is left out against Button, because no button of ours uses it: the focus
// ring and Tab handling, the keyboard-cursor model, right-clicks, left
// alignment, the spinning icon and the `active` state. Should the panel ever
// want one of those, take it back from the kit rather than growing this.
//
// The colours are the theme's foreground at three strengths rather than
// Qt.darker: darkening the dark foreground of a light theme would make a
// secondary action louder than the main one. How far back the quiet strength
// steps is not the same on both, though — see _quietAlpha.
//
// Set `label`, not `text`: the capitals are put on here.
BorderSurface {
    id: root

    property bool primary: false
    property bool selected: false
    property string label: ""
    property string iconText: ""
    property string tooltipText: ""

    signal clicked

    // 1.2 px is what the shell spaces its own capitals by (Ui/PanelHero.qml).
    readonly property real _spacing: 1.2

    readonly property bool _hot: mouse.containsMouse && root.enabled
    // A switched-on secondary keeps the frame: without it the ON state of
    // "Heute frei" would carry nothing but its fill.
    readonly property bool _framed: root.primary || root.selected

    // How far a quiet label steps back. A light theme has far less room
    // between foreground and background than a dark one — measured on the
    // running shell, Catppuccin Latte offers 6.5:1 where Solitude offers 11:1
    // — so the alpha that reads as quiet on dark spends all of it and lands at
    // 2.8:1, under the 4.5:1 a label of this size needs. The step is therefore
    // smaller on a light theme. The rank survives that: the frame, the size and
    // the capitals carry it, the colour only seconds them.
    readonly property bool _onLight: Color.background.hslLightness > 0.5
    readonly property real _quietAlpha: root._onLight ? 0.85 : 0.62
    readonly property real _disabledAlpha: root._onLight ? 0.5 : 0.35

    // Full strength for the main action and for whatever the pointer is on.
    // Switched on beats both, so the theme's own selected colour still shows;
    // disabled beats everything, so a button that cannot be pressed never
    // renders at full strength.
    readonly property color _labelColor: !root.enabled ? Util.alpha(Color.foreground, root._disabledAlpha) : root.selected ? Style.selectedStateColor(Color.foreground, Color.accent) : root.primary || root._hot ? Color.foreground : Util.alpha(Color.foreground, root._quietAlpha)

    readonly property var _hoverBorder: Border.controlSpec("hover-cursor", Color.foreground, Color.accent)
    readonly property var _normalBorder: Border.controlSpec("normal", Color.foreground, Color.accent)

    // Reserve the widest border any state can paint, so coming under the
    // pointer never nudges the buttons below.
    readonly property real _reservedX: Math.max(Border.left(root._hoverBorder), Border.left(root._normalBorder)) + Math.max(Border.right(root._hoverBorder), Border.right(root._normalBorder))
    readonly property real _reservedY: Math.max(Border.top(root._hoverBorder), Border.top(root._normalBorder)) + Math.max(Border.bottom(root._hoverBorder), Border.bottom(root._normalBorder))

    leftPadding: Style.spacing.controlPaddingX
    rightPadding: Style.spacing.controlPaddingX
    topPadding: Style.spacing.controlPaddingY
    bottomPadding: Style.spacing.controlPaddingY

    implicitWidth: content.implicitWidth + root.leftPadding + root.rightPadding + root._reservedX
    implicitHeight: content.implicitHeight + root.topPadding + root.bottomPadding + root._reservedY
    radius: Style.cornerRadius

    borderSpec: root._hot ? root._hoverBorder : root._framed ? root._normalBorder : Border.none()
    color: mouse.pressed ? Style.pressedFillFor(Color.foreground, Color.accent) : root._hot ? Style.hoverFillFor(Color.foreground, Color.accent) : root.selected ? Style.selectedFillFor(Color.foreground, Color.accent) : "transparent"

    Behavior on color {
        ColorAnimation {
            duration: 120
        }
    }

    Row {
        id: content

        anchors.verticalCenter: parent.verticalCenter
        anchors.horizontalCenter: parent.horizontalCenter
        // Letter spacing is added after the last glyph too, so the text is
        // one spacing wider than what it draws; without this the capitals
        // would sit half a spacing left of centre.
        anchors.horizontalCenterOffset: root.primary ? 0 : root._spacing / 2
        spacing: Style.spacing.controlGap

        Text {
            anchors.verticalCenter: parent.verticalCenter
            visible: root.iconText !== ""
            textFormat: Text.PlainText
            text: root.iconText
            color: root._labelColor
            font.family: Style.font.family
            font.pixelSize: Style.font.icon

            Behavior on color {
                ColorAnimation {
                    duration: 120
                }
            }
        }

        Text {
            anchors.verticalCenter: parent.verticalCenter
            textFormat: Text.PlainText
            text: root.primary ? root.label : root.label.toUpperCase()
            color: root._labelColor
            font.family: Style.font.family
            font.pixelSize: root.primary ? Style.font.body : Style.font.bodySmall
            font.letterSpacing: root.primary ? 0 : root._spacing
            font.bold: root.selected

            Behavior on color {
                ColorAnimation {
                    duration: 120
                }
            }
        }
    }

    MouseArea {
        id: mouse

        anchors.fill: parent
        hoverEnabled: true
        cursorShape: Qt.PointingHandCursor
        onClicked: root.clicked()
    }

    PanelToolTip {
        visible: root.tooltipText !== "" && mouse.containsMouse
        text: root.tooltipText
    }
}
