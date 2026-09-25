import QtQuick

// Lint-only stand-in for Quickshell.Io.StdioCollector.
// Derived from ax1g/quickshell-screentime-plugin, commit 2c7b75a,
// MIT, Copyright (c) 2026 agx. See THIRD-PARTY-LICENSES.md.
QtObject {
    property bool waitForEnd: false
    property string text: ""

    signal streamFinished
}
