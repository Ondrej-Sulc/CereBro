"""Public-boundary checks for the frozen native special-character projection."""
import importlib.util
import unittest
from pathlib import Path


SPEC = importlib.util.spec_from_file_location("native_specials", Path(__file__).with_name("build_native_specials.py"))
native = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(native)


def character(gid, name):
    return {"Character": gid, "_friendlyNameLoc": {"en": name}, "ModelID": gid, "_imgID": gid}


def blueprint(gid, *, hero_class="tech", collectible=False, event=False):
    return {"Blueprint": gid + "_t7", "Character": gid, "Rarity": 7,
            "_heroClass": hero_class, "UserCollection": collectible, "IsEventCharacter": event}


class NativeSpecialsTests(unittest.TestCase):
    def test_exact_id_join_keeps_same_named_playable_and_legacy_separate(self):
        chars = [character("maestro", "MAESTRO"), character("maestro_trophy", "MAESTRO")]
        blueprints = [blueprint("maestro"), blueprint("maestro_trophy", collectible=True)]
        existing = [{"id": 1, "gameId": "maestro_trophy", "name": "Maestro", "slug": "maestro", "isPlayable": True}]
        rows, _ = native.project_definitions(chars, blueprints, existing, repairs={})
        self.assertEqual([(row["gameId"], row["name"], row["existingChampion"]) for row in rows],
                         [("maestro", "MAESTRO [maestro]", None)])
        self.assertEqual(rows[0]["nativeRarities"], [7])
        self.assertNotIn("obtainable", rows[0])
        self.assertIsNone(rows[0]["releaseDate"])

    def test_collectible_npc_registry_does_not_admit_unknown_events_or_placeholders(self):
        ids = ["doombot_tech", "comingsoon", "new_event", "tuning_normal", "heimdall_legacy"]
        chars = [character(gid, "COMING SOON" if gid == "comingsoon" else gid.upper()) for gid in ids]
        blueprints = [blueprint(gid, collectible=True, event=gid == "new_event") for gid in ids if gid != "heimdall_legacy"]
        rows, excluded = native.project_definitions(chars, blueprints, [], repairs={})
        self.assertEqual([row["gameId"] for row in rows], ["doombot_tech"])
        self.assertEqual({row["gameId"] for row in excluded}, {"comingsoon", "tuning_normal", "heimdall_legacy"})

    def test_conflicting_source_classes_and_existing_slug_collision_fail_closed(self):
        chars = [character("boss", "BOSS")]
        with self.assertRaisesRegex(ValueError, "class"):
            native.project_definitions(chars, [blueprint("boss"), {**blueprint("boss", hero_class="cosmic"), "Blueprint": "boss_t6"}], [], repairs={})
        existing = [{"id": 2, "gameId": "other", "name": "Other", "slug": "npc-boss", "isPlayable": True}]
        with self.assertRaisesRegex(ValueError, "slug"):
            native.project_definitions(chars, [blueprint("boss")], existing, repairs={})

    def test_reviewed_existing_identity_preserves_name_slug_and_requires_full_text_proof(self):
        chars = [character("ares", "ARES")]
        existing = [{"id": 799, "gameId": None, "name": "Ares", "slug": "ares", "isPlayable": False}]
        rows, _ = native.project_definitions(chars, [blueprint("ares", hero_class="superior")], existing,
                                            repairs={799: "ares"})
        self.assertEqual(rows[0]["name"], "Ares")
        self.assertEqual(rows[0]["slug"], "ares")
        export = {"ares": {"base_abilities": [{"description": "Exact native text."}]}}
        evidence = [{"id": 1, "championId": 799, "sourceId": "base:1", "group": "base", "sortOrder": 0, "raw": "Exact native text."}]
        proof = native.verify_identity_evidence(export, evidence, {799: "ares"})
        self.assertEqual(proof[799]["rows"], 1)
        evidence[0]["raw"] = "Different text."
        with self.assertRaisesRegex(ValueError, "identity"):
            native.verify_identity_evidence(export, evidence, {799: "ares"})

    def test_published_catalog_and_all_portrait_bytes_verify_without_private_sources(self):
        catalog = Path(__file__).resolve().parents[2] / "src/data/game-champions/native-specials.json"
        self.assertTrue(catalog.is_file())
        native.check_public(catalog)


if __name__ == "__main__":
    unittest.main()
