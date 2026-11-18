"""Small offline regression checks for exact chest artwork joins."""
import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from build_chest_artwork import collect_definitions, resolve_reference


class ChestArtworkTests(unittest.TestCase):
    def test_frozen_quest_chest_join_and_hash_drift(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "source.json"
            raw = json.dumps({"quest": {"qid": "q", "chests": {"chests03": "object_chest_level03"}}}).encode()
            path.write_bytes(raw)
            rows = [{"questId": "q", "sourceFile": str(path), "sourceSha256": hashlib.sha256(raw).hexdigest(), "pointer": "/quest"}]
            quests, bindings = collect_definitions(rows)
            self.assertEqual(quests["q"]["chests"], {"chests03": "object_chest_level03"})
            self.assertNotIn(str(path), json.dumps(quests))
            self.assertEqual(bindings["object_chest_level03"][0]["pointer"], "/quest/chests/chests03")
            path.write_bytes(raw + b" ")
            with self.assertRaisesRegex(ValueError, "source hash"):
                collect_definitions(rows)

    def test_no_normalization_alias_or_path_guess(self):
        self.assertEqual(resolve_reference("object_chest_level03"), "chests/object_chest_level03")
        for value in (None, "", "chests03", "OBJECT_CHEST_LEVEL03", "../object_chest_level03", "object_chest_level03.png", "object_chest_level03/other"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                resolve_reference(value)


if __name__ == "__main__":
    unittest.main()
