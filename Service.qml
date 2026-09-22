import QtQuick

// Headless singleton for the plugin. It will own the runtime state, the
// poll timer and the calls to bin/calamari; for now it only exists so the
// shell mounts it (keepLoaded: code changes here need a shell restart).
Item {
    id: root

    property var shell: null
    property var manifest: null
}
