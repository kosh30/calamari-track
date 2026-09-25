"""tools/release: the parts that decide, without git, gh or the network."""

import unittest
from importlib.machinery import SourceFileLoader
from importlib.util import module_from_spec, spec_from_loader
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def load_release():
    loader = SourceFileLoader("release", str(ROOT / "tools" / "release"))
    module = module_from_spec(spec_from_loader("release", loader))
    loader.exec_module(module)
    return module


release = load_release()
REPO = "https://github.com/kosh30/calamari-track"

FIRST = """# Changelog

Intro.

## [Unreleased]

### Added

- Clock in from the bar.

[Unreleased]: https://github.com/kosh30/calamari-track/commits/main
"""

LATER = """# Changelog

## [Unreleased]

### Fixed

- The bar no longer freezes.

## [0.1.0] - 2026-09-25

### Added

- Clock in from the bar.

[Unreleased]: https://github.com/kosh30/calamari-track/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/kosh30/calamari-track/releases/tag/v0.1.0
"""


class VersionTest(unittest.TestCase):
    def test_a_greater_version_is_allowed(self):
        release.check_version("0.2.0", "0.1.0", tag_exists=False)
        release.check_version("0.1.10", "0.1.9", tag_exists=False)
        release.check_version("1.0.0", "0.9.9", tag_exists=False)

    def test_the_same_version_is_allowed_only_while_its_tag_is_missing(self):
        release.check_version("0.1.0", "0.1.0", tag_exists=False)
        with self.assertRaisesRegex(release.Abort, "v0.1.0"):
            release.check_version("0.1.0", "0.1.0", tag_exists=True)

    def test_a_smaller_version_is_refused(self):
        with self.assertRaisesRegex(release.Abort, "0.0.9"):
            release.check_version("0.0.9", "0.1.0", tag_exists=False)

    def test_an_existing_tag_is_refused(self):
        with self.assertRaisesRegex(release.Abort, "v0.2.0"):
            release.check_version("0.2.0", "0.1.0", tag_exists=True)

    def test_only_plain_x_y_z_is_a_version(self):
        for bad in ("v0.2.0", "0.2", "0.2.0-rc1", "01.2.3", ""):
            with self.assertRaises(release.Abort, msg=bad):
                release.check_version(bad, "0.1.0", tag_exists=False)


class ChangelogTest(unittest.TestCase):
    def test_the_first_release_dates_unreleased_and_links_the_tag(self):
        text, _ = release.release_changelog(FIRST, "0.1.0", "2026-09-25")

        self.assertEqual(
            text,
            """# Changelog

Intro.

## [Unreleased]

## [0.1.0] - 2026-09-25

### Added

- Clock in from the bar.

[Unreleased]: https://github.com/kosh30/calamari-track/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/kosh30/calamari-track/releases/tag/v0.1.0
""",
        )

    def test_a_later_release_compares_with_the_previous_one(self):
        text, _ = release.release_changelog(LATER, "0.1.1", "2026-10-02")

        self.assertIn("## [Unreleased]\n\n## [0.1.1] - 2026-10-02\n\n### Fixed\n", text)
        self.assertIn("## [0.1.0] - 2026-09-25\n", text)
        self.assertTrue(
            text.endswith(
                "[Unreleased]: %s/compare/v0.1.1...HEAD\n"
                "[0.1.1]: %s/compare/v0.1.0...v0.1.1\n"
                "[0.1.0]: %s/releases/tag/v0.1.0\n" % (REPO, REPO, REPO)
            ),
            text,
        )

    def test_the_section_is_the_release_notes(self):
        _, notes = release.release_changelog(LATER, "0.1.1", "2026-10-02")

        self.assertEqual(notes, "### Fixed\n\n- The bar no longer freezes.")

    def test_an_empty_unreleased_section_is_refused(self):
        for body in ("", "### Added\n\n", "### Added\n\n### Fixed\n"):
            text = "# Changelog\n\n## [Unreleased]\n\n%s\n## [0.1.0] - 2026-09-25\n\n- x\n" % body
            with self.assertRaisesRegex(release.Abort, "Unreleased"):
                release.release_changelog(text, "0.1.1", "2026-10-02")

    def test_a_changelog_without_unreleased_is_refused(self):
        with self.assertRaisesRegex(release.Abort, "Unreleased"):
            release.release_changelog("# Changelog\n", "0.1.0", "2026-09-25")


class ManifestTest(unittest.TestCase):
    def test_only_the_version_changes(self):
        text = '{\n  "schemaVersion": 1,\n  "version": "0.1.0",\n  "kinds": ["service"]\n}\n'

        self.assertEqual(
            release.bump_manifest(text, "0.2.0"),
            '{\n  "schemaVersion": 1,\n  "version": "0.2.0",\n  "kinds": ["service"]\n}\n',
        )

    def test_the_real_manifest_has_a_version_to_bump(self):
        text = (ROOT / "manifest.json").read_text()

        self.assertIn('"version": "9.9.9"', release.bump_manifest(text, "9.9.9"))


class QtPinTest(unittest.TestCase):
    def test_the_pin_is_read_from_the_install_qt_step(self):
        self.assertEqual(release.qt_pin((ROOT / ".github" / "workflows" / "ci.yml").read_text()), "6.11.2")

    def test_jobs_that_pin_different_qt_versions_are_refused(self):
        ci = "".join(
            '      - uses: jurplel/install-qt-action@v4\n        with:\n          version: "%s"\n' % v
            for v in ("6.11.2", "6.12.0")
        )

        with self.assertRaisesRegex(release.Abort, "6.11.2.*6.12.0"):
            release.qt_pin(ci)

    def test_the_local_qmllint_version_is_its_last_word(self):
        self.assertEqual(release.qmllint_version("qmllint 6.11.2\n"), "6.11.2")


class CiRunTest(unittest.TestCase):
    def test_a_successful_run_is_green(self):
        self.assertEqual(
            release.ci_verdict([{"databaseId": 1, "status": "completed", "conclusion": "success"}]), "green"
        )

    def test_a_running_run_is_awaited(self):
        self.assertEqual(release.ci_verdict([{"databaseId": 1, "status": "in_progress", "conclusion": ""}]), "running")
        self.assertEqual(release.ci_verdict([{"databaseId": 1, "status": "queued", "conclusion": ""}]), "running")

    def test_a_failed_or_missing_run_aborts(self):
        for runs in ([], [{"databaseId": 1, "status": "completed", "conclusion": "failure"}]):
            with self.assertRaises(release.Abort):
                release.ci_verdict(runs)


if __name__ == "__main__":
    unittest.main()
