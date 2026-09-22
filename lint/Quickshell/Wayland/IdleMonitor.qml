import QtQuick

// Lint-only stand-in for Quickshell.Wayland.IdleMonitor.
QtObject {
    property bool enabled: true
    property real timeout: 0
    property bool respectInhibitors: true
    readonly property bool isIdle: false
}
