import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class ManifestTest(unittest.TestCase):
    def test_entry_points_exist(self):
        manifest = json.loads((ROOT / "manifest.json").read_text())
        for path in manifest["entryPoints"].values():
            self.assertTrue((ROOT / path).is_file(), path)


if __name__ == "__main__":
    unittest.main()
