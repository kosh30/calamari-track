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
        self.assertIn("breakLimitMinutes", schema)
        self.assertIn("breakReminderMinutes", schema)

    def test_the_rest_api_url_defaults_to_the_company_tenant(self):
        widget = json.loads((ROOT / "manifest.json").read_text())["barWidget"]
        (field,) = [f for f in widget["schema"] if f["key"] == "apiUrl"]
        self.assertEqual(field["defaultValue"], "https://cti.calamari.io/api")
        self.assertEqual(field["format"], "url")

    def test_the_default_project_is_check_in_by_name(self):
        widget = json.loads((ROOT / "manifest.json").read_text())["barWidget"]
        (field,) = [f for f in widget["schema"] if f["key"] == "defaultProject"]
        self.assertEqual((field["type"], field["defaultValue"]), ("string", "Check-in"))

    def test_the_break_type_is_break_by_name(self):
        widget = json.loads((ROOT / "manifest.json").read_text())["barWidget"]
        (field,) = [f for f in widget["schema"] if f["key"] == "breakType"]
        self.assertEqual((field["type"], field["defaultValue"]), ("string", "Break"))


if __name__ == "__main__":
    unittest.main()
