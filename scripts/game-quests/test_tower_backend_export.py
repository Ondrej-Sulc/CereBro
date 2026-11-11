"""Portable checks for source-bound Tower backend export."""
import unittest
from build_tower_backend import project_block


def fixture():
    return {"format": "cerebro.public-server-tower-block.v1", "capturedAt": "2026-11-10T08:00:00Z",
            "requestedTowerId": "class_skill", "requestedBlockId": 147, "responseSha256": "a" * 64,
            "readerSha256": "b" * 64, "blocks": [{"id": 147, "towerId": "class_skill", "numFloors": 1,
            "hash": "native-block", "buffs": [], "rewards": []}], "floors": [{"id": "1", "blockId": 147,
            "towerId": "class_skill", "hash": "native-floor", "bossData": {"bid": "shehulk_t7",
            "rank": 6, "level": 75, "sig_lvl": 200, "ascensionTier": 11, "hp": 123456, "attack": 15000},
            "buffs": [], "rewards": []}], "privateResponseDataExcluded": ["userFloors", "skipData"]}


class TowerBackendExportTests(unittest.TestCase):
    def test_preserves_native_enemy_ascension_without_using_player_limits(self):
        projected = project_block(fixture(), "c" * 64, {"shehulk_t7": {"Character": "shehulk", "Rarity": 7, "_heroClass": "chemical"}})
        enemy = projected["floors"][0]["defender"]
        self.assertEqual(enemy["ascensionTier"], 11)
        self.assertEqual(enemy["gameId"], "shehulk")
        self.assertEqual(projected["floors"][0]["sourceData"]["id"], "1")
        self.assertEqual(projected["source"]["captureSha256"], "c" * 64)

    def test_unknown_blueprint_stays_unresolved_without_suffix_guessing(self):
        row = fixture()
        row["floors"][0]["bossData"]["bid"] = "not_a_verified_champion_t7"
        projected = project_block(row, "c" * 64, {})
        enemy = projected["floors"][0]["defender"]
        self.assertIsNone(enemy["gameId"])
        self.assertIsNone(enemy["rarity"])
        self.assertEqual(enemy["blueprint"], "not_a_verified_champion_t7")

    def test_rejects_nonpublic_subtrees_and_wrong_parent(self):
        row = fixture()
        row["floors"][0]["userFloors"] = [{"private": True}]
        with self.assertRaisesRegex(ValueError, "Nonpublic"):
            project_block(row, "c" * 64, {})
        row = fixture()
        row["floors"][0]["blockId"] = 1
        with self.assertRaisesRegex(ValueError, "identity"):
            project_block(row, "c" * 64, {})


if __name__ == "__main__":
    unittest.main()
