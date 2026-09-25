import json
import re
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NOTICE = ROOT / "THIRD-PARTY-LICENSES.md"

# The three pieces that make a text the MIT licence rather than a reference to
# it. Both upstreams wrap their lines differently, so match inside a line.
GRANT = "Permission is hereby granted, free of charge"
CONDITION = "above copyright notice and this permission notice"
DISCLAIMER = 'THE SOFTWARE IS PROVIDED "AS IS"'

# The components we carry copies of, keyed by the heading of their section in
# the notice, with the copyright line each one's licence obliges us to
# reproduce inside that section.
BORROWED = {
    "ax1g/quickshell-screentime-plugin": "Copyright (c) 2026 agx",
    "basecamp/omarchy": "Copyright (c) David Heinemeier Hansson",
}
AX1G_COMMIT = "2c7b75abde55b23ee6d6e1356797c8f50f60b8a1"

# Files we took from ax1g and edited. Each has to say so in its own header, the
# rule the notice states; the notice is not the only place a reader looks.
DERIVED_FILES = (
    "lint/Quickshell/Io/FileView.qml",
    "lint/Quickshell/Io/StdioCollector.qml",
    "lint/qs/Ui/KeyboardPanel.qml",
    ".qmllint.ini",
)


def sections(text):
    """The notice split on its `## ` headings, as {heading: body}."""
    parts = re.split(r"^## (.+)$", text, flags=re.M)[1:]
    return dict(zip(parts[::2], parts[1::2]))


class OwnLicenseTest(unittest.TestCase):
    def test_the_repository_carries_the_license_the_manifest_declares(self):
        declared = json.loads((ROOT / "manifest.json").read_text())["license"]
        self.assertEqual(declared, "MIT")
        text = (ROOT / "LICENSE").read_text()
        self.assertIn("MIT License", text)
        for part in (GRANT, CONDITION, DISCLAIMER):
            self.assertIn(part, text)

    def test_the_own_license_names_a_copyright_holder(self):
        text = (ROOT / "LICENSE").read_text()
        self.assertRegex(text, r"Copyright \(c\) \d{4} \S")

    def test_the_own_license_is_nothing_but_the_mit_text(self):
        # Licence detectors match on the whole file. Anything appended after the
        # disclaimer can make them report "Other" while the manifest says MIT,
        # so the pointer to the third-party notice lives in README.md instead.
        text = (ROOT / "LICENSE").read_text()
        self.assertTrue(text.rstrip().endswith("SOFTWARE."), text[-200:])


class ThirdPartyNoticeTest(unittest.TestCase):
    def setUp(self):
        self.text = NOTICE.read_text()
        self.sections = sections(self.text)

    def test_the_notice_has_one_section_per_borrowed_component(self):
        for heading in BORROWED:
            self.assertIn(heading, self.sections)

    def test_each_section_carries_its_own_copyright_line_and_license_text(self):
        # Per section, not per file: two copies of one upstream's licence would
        # satisfy a whole-file count while reproducing the other's notice
        # nowhere.
        for heading, copyright_line in BORROWED.items():
            body = self.sections[heading]
            self.assertIn(copyright_line, body, heading)
            for part in (GRANT, CONDITION, DISCLAIMER):
                self.assertIn(part, body, f"{heading}: {part}")

    def test_the_notice_says_which_paths_each_component_covers(self):
        self.assertIn("lint/Quickshell/", self.text)
        self.assertIn("lint/qs/", self.text)

    def test_the_notice_names_the_commit_the_quickshell_stubs_came_from(self):
        self.assertIn(AX1G_COMMIT, self.text)

    def test_the_audit_classifies_every_tracked_top_level_entry(self):
        # The audit result only holds for the repository it was taken on. A new
        # top-level entry has to be classified before this passes again.
        #
        # Driven off git rather than the filesystem: an ignored build directory
        # (node_modules/, __pycache__/) is not a licence question, and walking
        # the working tree would fail the suite over one.
        listed = subprocess.run(
            ["git", "-C", str(ROOT), "ls-files", "-z"],
            capture_output=True,
            text=True,
            check=True,
        ).stdout.split("\0")
        entries = set()
        for path in filter(None, listed):
            head, slash, _ = path.partition("/")
            entries.add(head + slash)
        table = self.sections["Audit"]
        for entry in sorted(entries):
            # Anchored to a table cell: a bare substring search would pass for
            # an unclassified `Quickshell/` on the strength of the
            # `lint/Quickshell/` mentioned elsewhere in the notice.
            self.assertRegex(table, rf"\|[^|\n]*`{re.escape(entry)}`", entry)


class DerivedFileHeaderTest(unittest.TestCase):
    def test_every_derived_file_names_its_origin_in_its_own_header(self):
        for rel in DERIVED_FILES:
            head = "".join((ROOT / rel).read_text().splitlines(keepends=True)[:6])
            self.assertIn("ax1g/quickshell-screentime-plugin", head, rel)
            self.assertIn(AX1G_COMMIT[:7], head, rel)
            self.assertIn("Copyright (c) 2026 agx", head, rel)

    def test_the_notice_lists_every_file_that_carries_such_a_header(self):
        text = NOTICE.read_text()
        for rel in DERIVED_FILES:
            self.assertIn(rel, text, rel)


class LintStubNoteTest(unittest.TestCase):
    def setUp(self):
        self.text = (ROOT / "lint" / "README.md").read_text()

    def test_the_stub_note_points_at_the_notice_and_names_the_commit(self):
        self.assertIn(NOTICE.name, self.text)
        self.assertIn(AX1G_COMMIT[:7], self.text)

    def test_the_snapshot_bullet_itself_names_its_upstream(self):
        # lint/qs/ is a copy of omarchy-shell. This bullet used to present it as
        # a mere convenience, which is how its licence went unrecorded; asserting
        # against the whole file would pass on the closing paragraph alone.
        (bullet,) = [line for line in self.text.splitlines() if "verbatim snapshots" in line]
        self.assertIn("basecamp/omarchy", bullet)


if __name__ == "__main__":
    unittest.main()
