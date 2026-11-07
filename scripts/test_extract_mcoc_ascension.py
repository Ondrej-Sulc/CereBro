import unittest
from copy import deepcopy
import json
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
from extract_mcoc_ascension import build_catalog, build_public_catalog, classify_ascension_blueprint, limits_module


def tier(identity="7s_t1", token="ascension_token_champion"):
    return {"Tier": identity, "Cost": [{"Type": "inv", "Data": token, "Quantity": 1}], "Attack": .08, "Health": .08, "MightGain": 3.6, "ChallengeRating": 15}


def blueprint(identity="hero_t7", game_id="hero"):
    return {"Blueprint": identity, "Character": game_id, "Rarity": 7, "_heroClass": "cosmic", "MaxRank": 6, "UserCollection": True, "IsEventCharacter": False,
            "AscensionTiers": ["7s_t1"], "EligibleAscensionTiers": [tier(token="ascension_token_champion_hero")]}


class AscensionExtractionTests(unittest.TestCase):
    def test_exact_collectible_carina_event_exception_and_coverage(self):
        carina = blueprint("carina_white_t7", "carina_white")
        carina["IsEventCharacter"] = True
        carina["EligibleAscensionTiers"][0]["Cost"] = [
            {"Type": "inv", "Data": "ascension_token_champion_carina_white", "Quantity": 1},
            {"Type": "inv", "Data": "ascension_token_class_cosmic", "Quantity": 1},
        ]
        excluded = []
        for overrides in [
            {"Blueprint": "carina_white_t6", "Rarity": 6, "UserCollection": False},
            {"Blueprint": "carina_white_boss_t7"},
            {"Blueprint": "future_event_t7", "Character": "future_event"},
        ]:
            excluded.append({**deepcopy(carina), **overrides})
        raw = build_catalog([carina, *excluded], [], [tier(), tier("7s_t15_def")], [])
        self.assertEqual(raw["coverage"]["collectibleBlueprints"], 1)
        # Source metadata here is a test fixture; the real artifact is re-projected separately.
        raw["source"] = {"observedAt": "2026-11-03T09:10:42+00:00", "capturedAt": "2026-11-05T14:03:52+00:00",
                          "bcg": {"path": "bcg.bin.gz", "sha256": "a"*64, "fileSha256": "b"*64, "bytes": 100, "mtimeUtc": "2026-11-03T09:11:20+00:00"},
                          "gameStore": None, "metadata": [{"path": "Marvel.Runtime.dll", "sha256": "c"*64}], "schemaSha256": "d"*64}
        public = build_public_catalog(raw)
        self.assertEqual([row["id"] for row in public["blueprints"]], ["carina_white_t7"])
        self.assertEqual(public["blueprints"][0], next(row for row in raw["blueprints"] if row["id"] == "carina_white_t7"))
        self.assertEqual(public["coverage"]["collectibleBlueprints"], 1)
        self.assertEqual(public["coverage"]["excludedBlueprints"], 3)
        self.assertEqual(public["source"]["observedAt"], raw["source"]["observedAt"])

    def test_playable_event_classification_requires_all_identity_assertions(self):
        row = {"id": "carina_white_t7", "gameId": "carina_white", "rarity": 7, "userCollection": True, "isEventCharacter": True}
        self.assertEqual(classify_ascension_blueprint(row), "verified-playable-event")
        for override in [{"id": "carina_white_boss_t7"}, {"id": "carina_white_t6", "rarity": 6},
                         {"gameId": "another_character"}, {"rarity": 6}, {"userCollection": False}, {"isEventCharacter": 1},
                         {"id": "future_event_t7", "gameId": "future_event"}]:
            with self.subTest(override=override):
                self.assertEqual(classify_ascension_blueprint({**row, **override}), "excluded")

    def test_offline_public_roundtrip_preserves_provenance_and_rejects_different_sources(self):
        root = Path(__file__).resolve().parents[1]
        public = json.loads((root / "src/data/game-ascension/catalog.json").read_text(encoding="utf-8"))
        full = deepcopy(public)
        for key in ["bcg", "gameStore"]:
            if full["source"][key]:
                full["source"][key]["path"] = full["source"][key].pop("fileName")
        for row in full["source"]["metadata"]: row["path"] = row.pop("assembly")
        # The original full extraction and original public export were separate reads.
        full["source"]["capturedAt"] = "2026-11-05T14:03:52.841252+00:00"
        with TemporaryDirectory() as directory:
            folder = Path(directory)
            raw_path, old_path, out_path = [folder / name for name in ["full.json", "old.json", "out.json"]]
            raw_path.write_text(json.dumps(full), encoding="utf-8")
            old_path.write_text(json.dumps(public), encoding="utf-8")
            command = [sys.executable, str(root / "scripts/extract_mcoc_ascension.py"), "--from-extraction", str(raw_path),
                       "--public", "--preserve-public-source", str(old_path), "--out", str(out_path)]
            for _ in range(2):
                result = subprocess.run(command, capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stderr)
                projected = json.loads(out_path.read_text(encoding="utf-8"))
                for key in ["source", "blueprints", "tiers", "resources"]: self.assertEqual(projected[key], public[key], key)
                if _ == 0: first = out_path.read_bytes()
                else: self.assertEqual(out_path.read_bytes(), first)
            public["source"]["bcg"]["sha256"] = "f"*64
            old_path.write_text(json.dumps(public), encoding="utf-8")
            result = subprocess.run(command, capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("different ascension source", result.stderr)
            self.assertEqual(out_path.read_bytes(), first)

    def test_generic_stat_fallback_does_not_extend_a_shorter_recorded_player_path(self):
        source = {"observedAt": "2026-11-03T09:10:42+00:00", "bcg": {"sha256": "a"*64}}
        one = {"attackBonus": .08, "healthBonus": .08}
        paths = [{"rarity": 7, "maxRecordedLevel": 1, "steps": [one]},
                 {"rarity": 7, "maxRecordedLevel": 2, "steps": [one, one]}]
        text = limits_module({"source": source, "blueprints": paths})
        self.assertIn('"7":2', text)
        self.assertIn('"7":[]', text)

    def test_public_export_filters_variants_and_strips_machine_paths(self):
        normal, npc = blueprint(), blueprint("hero_event_t7", "event")
        npc["IsEventCharacter"] = True
        raw = build_catalog([normal, npc], [], [tier(), tier("7s_t15_def")], [])
        raw.update(version=1, source={"observedAt": "2026-11-03T09:10:42+00:00", "capturedAt": "2026-11-05T14:03:52+00:00",
                                     "bcg": {"path": "C:\\private\\bcg.bin.gz", "sha256": "a"*64, "fileSha256": "b"*64, "bytes": 100, "mtimeUtc": "2026-11-03T09:11:20+00:00"},
                                     "gameStore": None, "metadata": [{"path": "D:\\private\\Marvel.Runtime.dll", "sha256": "c"*64}], "schemaSha256": "d"*64})
        public = build_public_catalog(raw)
        self.assertEqual(len(public["blueprints"]), 1)
        self.assertEqual(public["source"]["bcg"]["fileName"], "bcg.bin.gz")
        self.assertEqual(public["source"]["metadata"][0]["assembly"], "Marvel.Runtime.dll")
        self.assertNotIn("7s_t15_def", [row["id"] for row in public["tiers"]])
        self.assertIn("7s_t15_def", public["coverage"]["excludedGlobalTierIds"])
        self.assertNotIn("private", str(public))
        self.assertIn('"7":1', limits_module(public))

    def test_public_export_rejects_conflicting_collectible_variants(self):
        raw = build_catalog([blueprint(), blueprint("hero_legacy_t7")], [], [tier()], [])
        with self.assertRaisesRegex(ValueError, "Conflicting collectible"): build_public_catalog(raw)

    def test_generic_stat_fallback_does_not_choose_between_conflicting_paths(self):
        source = {"observedAt": "2026-11-03T09:10:42+00:00", "bcg": {"sha256": "a"*64}}
        paths = [{"rarity": 7, "maxRecordedLevel": 1, "steps": [{"attackBonus": value, "healthBonus": value}]} for value in [.08, .10]]
        text = limits_module({"source": source, "blueprints": paths})
        self.assertIn('"7":[]', text)

    def test_uses_materialized_blueprint_costs_and_preserves_unbound_templates(self):
        output = build_catalog([blueprint()], [{"Character": "hero", "_friendlyNameLoc": {"en": "Hero"}}], [tier(), tier("7s_t15_def")], [])
        row = output["blueprints"][0]
        self.assertEqual(row["name"], "Hero")
        self.assertEqual(row["maxRecordedLevel"], 1)
        self.assertEqual(row["steps"][0]["cost"], [{"type": "inv", "id": "ascension_token_champion_hero", "quantity": 1}])
        self.assertIn("7s_t15_def", output["coverage"]["unboundGlobalTierIds"])

    def test_does_not_grant_global_tiers_to_an_ineligible_blueprint(self):
        row = blueprint(); row.pop("AscensionTiers"); row.pop("EligibleAscensionTiers")
        output = build_catalog([row], [], [tier()], [])
        self.assertEqual(output["blueprints"][0]["maxRecordedLevel"], 0)
        self.assertEqual(output["blueprints"][0]["steps"], [])

    def test_preserves_duplicate_character_star_variants_without_silently_merging(self):
        normal, event = blueprint(), blueprint("hero_event_t7")
        event["IsEventCharacter"] = True
        output = build_catalog([normal, event], [], [tier()], [])
        self.assertEqual(len(output["blueprints"]), 2)
        self.assertEqual(output["coverage"]["collectibleBlueprints"], 1)

    def test_rejects_conflicting_materialized_and_global_tuning(self):
        row = blueprint(); row["EligibleAscensionTiers"][0]["Health"] = .2
        with self.assertRaisesRegex(ValueError, "modifier mismatch"): build_catalog([row], [], [tier()], [])

    def test_resolves_exact_resource_display_metadata_and_keeps_missing_metadata_explicit(self):
        item = {"Name": "ascension_token_champion_hero", "Title": "HERO TOKEN", "Description": "Use to Ascend Hero", "image": {"en": "gamestore/hero.png"}, "ImageS3": True, "HTags": "t7:hero"}
        output = build_catalog([blueprint()], [], [tier()], [item])
        self.assertEqual(output["resources"][0]["name"], "HERO TOKEN")
        self.assertEqual(output["resources"][0]["artwork"], {"reference": "gamestore/hero.png", "onCdn": True})
        missing = build_catalog([blueprint()], [], [tier()], [])["resources"][0]
        self.assertFalse(missing["metadataResolved"])
        self.assertNotIn("name", missing)

    def test_rejects_unknown_tiers_order_mismatches_and_invalid_costs(self):
        row = blueprint(); row["AscensionTiers"] = ["7s_t99"]
        with self.assertRaisesRegex(ValueError, "Unknown tier"): build_catalog([row], [], [tier()], [])
        row = blueprint(); row["EligibleAscensionTiers"][0]["Tier"] = "7s_t2"
        with self.assertRaisesRegex(ValueError, "Eligible tier order"): build_catalog([row], [], [tier()], [])
        row = blueprint(); row["EligibleAscensionTiers"][0]["Cost"][0]["Quantity"] = -1
        with self.assertRaisesRegex(ValueError, "quantity"): build_catalog([row], [], [tier()], [])

    def test_rejects_unverified_cost_semantics_nonfinite_stats_and_duplicate_ids(self):
        row = blueprint(); row["EligibleAscensionTiers"][0]["Cost"][0]["Context"] = "unverified"
        with self.assertRaisesRegex(ValueError, "cost fields"): build_catalog([row], [], [tier()], [])
        row = blueprint(); row["EligibleAscensionTiers"][0]["Health"] = float("nan")
        with self.assertRaisesRegex(ValueError, "finite"): build_catalog([row], [], [tier()], [])
        with self.assertRaisesRegex(ValueError, "Duplicate blueprint"): build_catalog([blueprint(), blueprint()], [], [tier()], [])


if __name__ == "__main__": unittest.main()
