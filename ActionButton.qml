import QtQuick
import qs.Commons
import qs.Ui

// A panel button that says its rank before its label is read.
//
// The page's main action (`primary`) keeps the border, the body size and the
// full foreground. Every other action steps back: no border, one size down,
// capitals, and a foreground that only comes up to full under the pointer or
// the keyboard cursor. Disabled dims either rank — the kit's Button greys
// nothing by itself, it only stops the click, so a busy panel used to look
// exactly like an idle one.
//
// The colours are the theme's foreground at three strengths rather than
// Qt.darker: darkening the dark foreground of a light theme would make a
// secondary action louder than the main one, while lowering the contrast
// against the background reads the same either way.
//
// The capitals are not letter-spaced, as the model in
// docs/research/quickshell-screentime-plugin.md is: the kit's Button has no
// letterSpacing to set, and rebuilding it to reach the label would cost the
// shared hover, focus and tooltip behaviour. In the shell's monospace font
// the capitals already stand at an even advance.
//
// Set `label`, not `text`: the capitals are put on here.
Button {
    id: root

    property bool primary: false
    property string label: ""

    // Full strength for the main action, for whatever the pointer or the
    // keyboard cursor is on, and for a secondary action that is switched on
    // ("Heute frei") — that is a state, not a whisper.
    readonly property bool _fullStrength: root.primary || root.hot || root.selected

    text: root.primary ? root.label : root.label.toUpperCase()
    // A switched-on secondary keeps the frame too: the kit falls back to the
    // normal border only where `bordered` is set, so without this the ON
    // state would lose the loudest thing that says it is on.
    bordered: root.primary || root.selected
    fontSize: root.primary ? Style.font.body : Style.font.bodySmall
    foreground: !root.enabled ? Util.alpha(Color.foreground, 0.35) : root._fullStrength ? Color.foreground : Util.alpha(Color.foreground, 0.62)

    // The 120 ms the kit's Button gives its own fill, so label and surface
    // come up together.
    Behavior on foreground {
        ColorAnimation {
            duration: 120
        }
    }
}
