import os
import re
import shutil
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# A name both an imported Qt module and the shell export is ambiguous: qmllint
# resolves it to the shell, the running shell to Qt. Qt 6.12 added a QtQuick
# singleton Color, and every bare Color.foreground went undefined at runtime
# while lint stayed clean. The shell's way out is `import qs.Commons as
# Commons` and `Commons.Color`; this test holds the plugin to it.

IMPORT = re.compile(r"^import\s+([\w.]+)(?:\s+[\d.]+)?\s*$", re.M)


def qt_qml_dir():
    # The Qt that qmllint belongs to: Arch's /usr/lib/qt6, or CI's install.
    qmllint = shutil.which("qmllint") or "/usr/lib/qt6/bin/qmllint"
    return Path(os.path.realpath(qmllint)).parent.parent / "qml"


def qt_exports(qml_dir, module, seen=None):
    seen = set() if seen is None else seen
    if module in seen:
        return set()
    seen.add(module)
    directory = qml_dir.joinpath(*module.split("."))
    qmldir = directory / "qmldir"
    if not qmldir.is_file():
        return set()
    names = set()
    for line in qmldir.read_text().splitlines():
        parts = line.split()
        if parts[:1] == ["typeinfo"]:
            text = (directory / parts[1]).read_text()
            names |= set(re.findall(r'"' + re.escape(module) + r'/(\w+) [\d.]+"', text))
        elif parts[:1] == ["import"]:
            names |= qt_exports(qml_dir, parts[1], seen)
    return names


def shell_exports(module):
    qmldir = ROOT / "lint" / Path(*module.split(".")) / "qmldir"
    names = set()
    for line in qmldir.read_text().splitlines():
        parts = line.split()
        if parts[:1] == ["singleton"]:
            parts = parts[1:]
        if len(parts) == 3 and parts[2].endswith(".qml"):
            names.add(parts[0])
    return names


def bare_uses(source, clashes):
    """(line number, name) for each unqualified use of a clashing name."""
    found = []
    for number, line in enumerate(source.splitlines(), 1):
        code = line.split("//", 1)[0]
        if code.lstrip().startswith("import "):
            continue
        for name in clashes:
            if re.search(r"(?<![.\w])" + name + r"\b", code):
                found.append((number, name))
    return found


def clashes_in(source, qml_dir):
    modules = IMPORT.findall(source)
    shell = set().union(*[shell_exports(m) for m in modules if m.startswith("qs.")])
    qt = set().union(*[qt_exports(qml_dir, m) for m in modules if not m.startswith("qs.")])
    return shell & qt


class ShadowingTest(unittest.TestCase):
    def setUp(self):
        self.qml_dir = qt_qml_dir()
        self.assertTrue((self.qml_dir / "QtQuick" / "qmldir").is_file(), "no Qt found next to qmllint")

    def test_no_shell_name_is_used_bare_where_qt_exports_it_too(self):
        found = []
        for path in sorted(ROOT.glob("*.qml")):
            source = path.read_text()
            for number, name in bare_uses(source, clashes_in(source, self.qml_dir)):
                found.append("%s:%d: bare %s is Qt's at runtime; write Commons.%s" % (path.name, number, name, name))
        self.assertEqual(found, [], "\n" + "\n".join(found))

    def test_catches_the_bare_color_that_qt_6_12_shadows(self):
        source = "import QtQuick\nimport qs.Commons\nText { color: Color.foreground }\n"
        clashes = clashes_in(source, self.qml_dir)
        if "Color" not in qt_exports(self.qml_dir, "QtQuick"):
            self.skipTest("this Qt has no QtQuick Color")
        self.assertEqual(bare_uses(source, clashes), [(3, "Color")])
        self.assertEqual(bare_uses("Text { color: Commons.Color.foreground }", clashes), [])
