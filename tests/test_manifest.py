import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class ManifestTest(unittest.TestCase):
    def test_entry_points_exist(self):
        manifest = json.loads((ROOT / "manifest.json").read_text())
        for path in manifest["entryPoints"].values():
            self.assertTrue((ROOT / path).is_file(), path)

    def test_every_setting_has_one_default(self):
        widget = json.loads((ROOT / "manifest.json").read_text())["barWidget"]
        schema = {field["key"]: field["defaultValue"] for field in widget["schema"]}
        self.assertEqual(schema, widget["defaults"])
        self.assertIn("stampReminderMinutes", schema)
        self.assertIn("pollIntervalMinutes", schema)


if __name__ == "__main__":
    unittest.main()
