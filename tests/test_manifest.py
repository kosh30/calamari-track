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

    def test_every_group_is_named_once_and_carries_a_title(self):
        # A duplicated key would render the same fields in two cards; a group
        # without a title would head a card with nothing.
        groups = json.loads((ROOT / "manifest.json").read_text())["barWidget"]["groups"]
        keys = [group["key"] for group in groups]
        self.assertEqual(sorted(keys), sorted(set(keys)), keys)
        for group in groups:
            self.assertTrue(group["title"].strip(), group["key"])

    def test_every_setting_names_a_group_the_manifest_declares(self):
        # A field whose group does not exist is still shown, in a catch-all
        # card, but it is a mistake and belongs caught here.
        widget = json.loads((ROOT / "manifest.json").read_text())["barWidget"]
        declared = {group["key"] for group in widget["groups"]}
        for field in widget["schema"]:
            self.assertIn(field.get("group"), declared, field["key"])

    def test_the_rest_api_url_names_no_company(self):
        widget = json.loads((ROOT / "manifest.json").read_text())["barWidget"]
        (field,) = [f for f in widget["schema"] if f["key"] == "apiUrl"]
        self.assertEqual(field["defaultValue"], "")
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
