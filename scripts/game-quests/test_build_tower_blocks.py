"""Portable synthetic-fixture checks for the offline public Tower projection."""
import copy
import unittest

from build_tower_blocks import GAME_SHA, LAYOUT_SHA, READER_V1_SHA, project


def fixture():
    empty_rewards = {"Type": "gf", "Data": "7_star_hero_shard_crystal", "Quantity": 25,
                     "MinQuantity": 0, "MaxQuantity": 0, "Action": None, "Header": None, "Footer": None}
    return {"format": "cerebro.public-tower-definitions.v1", "gameAssemblySha256": GAME_SHA,
            "layoutSha256": LAYOUT_SHA, "readerSha256": READER_V1_SHA, "capturedAt": "2026-11-10T07:00:00Z",
            "towers": [{"Id": "class_skill", "FriendlyName": "SKILL TOWER", "Category": {"name": "Class"},
                        "NumBlocks": 999, "NumFloors": 9999}],
            "blocks": [{"TowerId": "class_skill", "Id": 1, "NumFloors": 2, "Hash": "fixture-block",
                        "TimeLimit": 0, "TopBuffs": [], "Buffs": [], "EntryCost": [], "Rewards": [],
                        "RatingRewards": [], "HeroRestrictionsList": []}],
            "floors": [{"TowerId": "class_skill", "BlockId": 1, "FloorNumber": 1, "Hash": "fixture-floor",
                        "BossData": {"mBlueprint": {"Blueprint": "hulk_t7", "Character": "hulk", "Rarity": 7,
                                                     "_imgID": "", "_heroClass": "science"},
                                     "mUserHero": {"Blueprint": "hulk_t7", "Rank": 3, "Level": 45,
                                                   "SigLvl": 0, "AscensionTier": 0}},
                        "AIDifficultyId": "AI_Hardest", "TotalLocalBuffCount": 0, "TopBuffs": [], "Buffs": [],
                        "Rewards": [empty_rewards]}]}


class TowerProjectionTests(unittest.TestCase):
    def test_partial_floor_observation_does_not_become_complete_tower_coverage(self):
        result = project([("a" * 64, fixture())])
        self.assertEqual(result["coverage"]["capturedFloors"], 1)
        self.assertFalse(result["coverage"]["completeTowerCoverage"])
        self.assertFalse(result["blocks"][0]["coverage"]["allDeclaredFloorsCaptured"])
        self.assertNotIn("NumFloors", result)
        self.assertNotIn("9999", str(result))

    def test_repeated_definition_merges_sources_without_duplicate_floors_or_rewards(self):
        result = project([("a" * 64, fixture()), ("b" * 64, fixture())])
        floor = result["blocks"][0]["floors"][0]
        self.assertEqual(result["coverage"]["capturedFloors"], 1)
        self.assertEqual(floor["sourceObservationSha256s"], ["a" * 64, "b" * 64])
        self.assertEqual(len(floor["rewards"]), 1)

    def test_conflicting_same_identity_requires_explicit_version_review(self):
        changed = fixture()
        changed["floors"][0]["Rewards"][0]["Quantity"] = 99
        with self.assertRaisesRegex(ValueError, "Conflicting"):
            project([("a" * 64, fixture()), ("b" * 64, changed)])

    def test_rejects_wrong_blueprint_join_and_private_reward_shape(self):
        changed = fixture()
        changed["floors"][0]["BossData"]["mUserHero"]["Blueprint"] = "other_t7"
        with self.assertRaisesRegex(ValueError, "identity disagreement"):
            project([("a" * 64, changed)])
        changed = copy.deepcopy(fixture())
        changed["floors"][0]["Rewards"][0]["Balance"] = 500
        with self.assertRaisesRegex(ValueError, "record shape"):
            project([("a" * 64, changed)])

    def test_rejects_unapproved_source_and_missing_parent(self):
        changed = fixture()
        changed["readerSha256"] = "unknown"
        with self.assertRaisesRegex(ValueError, "provenance"):
            project([("a" * 64, changed)])
        changed = fixture()
        changed["blocks"] = []
        with self.assertRaisesRegex(ValueError, "exact captured parent"):
            project([("a" * 64, changed)])


if __name__ == "__main__":
    unittest.main()
