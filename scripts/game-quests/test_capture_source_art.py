import json
import unittest
from pathlib import Path
from capture_source_art import ALLOW, public_field_specs, validate_support

SUPPORT = Path("C:/Code/CereBro/temp/quest-data-investigation/game-only")


class PublicArtCaptureTests(unittest.TestCase):
    def test_allowlist_excludes_gameplay_private_and_raw_objects(self):
        self.assertEqual(set(ALLOW), {"QuestSet", "Act", "Chapter", "QuestSummary"})
        names = set().union(*ALLOW.values())
        self.assertFalse(names & {"QuestMaps", "unlocked", "completed", "mastered", "bosses", "rewards", "player", "account", "inventory", "teams"})

    def test_new_image_fields_bind_named_metadata_not_inferred_offsets(self):
        layout = validate_support(SUPPORT)
        specs = public_field_specs(layout)
        self.assertEqual(specs["Act"]["image"]["type"], "string")
        self.assertEqual(specs["Chapter"]["image"]["type"], "string")
        self.assertEqual(specs["QuestSummary"]["actImage"]["name"], "<actImage>k__BackingField")
        changed = json.loads(json.dumps(layout))
        changed["types"]["Act"]["fields"] = [f for f in changed["types"]["Act"]["fields"] if f["name"] != "image"]
        with self.assertRaisesRegex(ValueError, "exact named field"):
            public_field_specs(changed)


if __name__ == "__main__":
    unittest.main()
