// Modelled on omarchy-shell's Ui/Button.qml (basecamp/omarchy, MIT,
// Copyright (c) David Heinemeier Hansson) — see THIRD-PARTY-LICENSES.md.
// Its state cascade and its trick of reserving the widest border are taken
// from there; everything else is ours.

import QtQuick
import qs.Commons
import qs.Ui
import "js/contrast.mjs" as Contrast

// A panel button that says its rank before its label is read.
//
// The page's main action (`primary`) keeps the frame, the body size and the
// full foreground. Every other action steps back: no frame, one size down,
// and spaced capitals at a lowered foreground that only comes up to full
// under the pointer. Disabled dims either rank.
//
// This sits on BorderSurface rather than on the kit's Button because the
// spaced capitals are the point and Button has no letterSpacing to set.
// Against Button it leaves out, among other things no button of ours uses:
// the focus ring and Tab handling, the keyboard-cursor model and its
// `hovered` signal, right-clicks, left alignment, the spinning icon, the
// `active` state, per-instance colour overrides — and the dedicated selected
// border token, so a theme that sets selected-border-width gets our normal
// frame instead of its own. Should the panel want one of those, take it back
// from the kit rather than growing this.
//
// Three channels, each with its own precedence, which is why they are read
// apart below rather than from one state:
//
//   label   disabled ▸ selected ▸ primary or pointer ▸ quiet
//   frame   pointer ▸ primary or selected ▸ none
//   fill    pressed ▸ pointer ▸ selected ▸ none
//
// All three fade. The frame is the awkward one: a spec carries a colour, a
// set of widths and an optional gradient, and only a colour can be animated.
// So the theme's own spec is kept for its widths and its gradient and only
// its colour is swapped for one that fades — to transparent where no frame
// should show, which leaves the widths standing and the geometry still. A
// gradient border cannot be faded that way, because the overlay draws the
// gradient and never looks at the colour; those keep the hard switch.
//
// The colours are the theme's foreground at three strengths rather than
// Qt.darker: darkening the dark foreground of a light theme would make a
// secondary action louder than the main one. How far back the quiet ones step
// is the theme's business rather than a constant — js/contrast.mjs works it
// out from what the theme leaves between its foreground and its background.
//
// The label goes in `label`, not `text`: what is painted is the capitalised
// form, so the plain one has to arrive under its own name.
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
    // The kit's Button fades its fill over 120 ms; label and surface travel
    // together only if ours agree with it.
    readonly property int _fade: 120

    readonly property bool _hot: mouse.containsMouse && root.enabled
    // A switched-on secondary keeps the frame: without it the ON state of
    // "Heute frei" would carry nothing but its fill.
    readonly property bool _framed: root.primary || root.selected

    // How far the quiet strengths may step back on this theme. Measured
    // against the panel's own card (Ui/KeyboardPanel.qml paints it in
    // Color.popups.background), not against the desktop background: a theme
    // is free to give popups a surface of their own, and a floor held against
    // a surface the text never sits on is no floor. The rank survives a theme
    // that leaves little room — the frame, the size and the capitals carry
    // it, the colour only seconds them.
    readonly property var _strength: Contrast.strengths(Color.foreground, Color.popups.background)

    // Full strength for the main action and for whatever the pointer is on.
    // Switched on beats both, so the theme's own selected colour still shows;
    // disabled beats everything, so a button that cannot be pressed never
    // renders at full strength.
    readonly property color _labelColor: !root.enabled ? Util.alpha(Color.foreground, root._strength.inert) : root.selected ? Style.selectedStateColor(Color.foreground, Color.accent) : root.primary || root._hot ? Color.foreground : Util.alpha(Color.foreground, root._strength.quiet)

    readonly property var _hoverBorder: Border.controlSpec("hover-cursor", Color.foreground, Color.accent)
    readonly property var _normalBorder: Border.controlSpec("normal", Color.foreground, Color.accent)

    // The spec whose widths and gradient are in force. A frame on its way out
    // keeps the shape it is fading from, which is the pointer's.
    readonly property var _frameShape: root._framed && !root._hot ? root._normalBorder : root._hoverBorder
    readonly property bool _frameFades: !root._frameShape.gradient || !root._frameShape.gradient.enabled
    readonly property var _frameHard: root._hot ? root._hoverBorder : root._framed ? root._normalBorder : Border.none()

    property color _frameColor: root._hot ? Border.color(root._hoverBorder) : root._framed ? Border.color(root._normalBorder) : "transparent"

    Behavior on _frameColor {
        ColorAnimation {
            duration: root._fade
        }
    }

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

    borderSpec: root._frameFades ? {
        color: root._frameColor,
        widths: root._frameShape.widths,
        gradient: root._frameShape.gradient
    } : root._frameHard
    color: mouse.pressed ? Style.pressedFillFor(Color.foreground, Color.accent) : root._hot ? Style.hoverFillFor(Color.foreground, Color.accent) : root.selected ? Style.selectedFillFor(Color.foreground, Color.accent) : "transparent"

    Behavior on color {
        ColorAnimation {
            duration: root._fade
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
                    duration: root._fade
                }
            }
        }

        Text {
            anchors.verticalCenter: parent.verticalCenter
            visible: root.label !== ""
            textFormat: Text.PlainText
            text: root.primary ? root.label : root.label.toUpperCase()
            color: root._labelColor
            font.family: Style.font.family
            font.pixelSize: root.primary ? Style.font.body : Style.font.bodySmall
            font.letterSpacing: root.primary ? 0 : root._spacing
            font.bold: root.selected

            Behavior on color {
                ColorAnimation {
                    duration: root._fade
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
