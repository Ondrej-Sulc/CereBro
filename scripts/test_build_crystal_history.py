import unittest
from build_crystal_history import build_history, snapshot


def previous():
    return {"source": {"observedAt": "2026-11-03T09:10:42+00:00", "gachaSha256": "a"*64},
            "crystals": [{"id": "old", "name": "Old", "group": "events", "set": "all", "categoryIds": ["heroes"]}],
            "pools": [{"id": "heroes", "heroTierIds": ["hulk_t7"], "heroCosmeticRewards": []}]}


def current():
    return {"source": {"observedAt": "2026-11-05T14:05:24+00:00", "gachaSha256": "b"*64},
            "crystals": [{"id": "old", "name": "Old", "sourceGroup": "events", "sourceSet": "all", "categoryIds": ["heroes"]}, {"id": "new", "name": "New", "sourceGroup": "events", "sourceSet": "all", "categoryIds": ["heroes"]}],
            "categories": [{"id": "heroes", "rewards": [{"type": "hero", "data": "hulk_t7", "quantity": 1}, {"type": "inv", "data": "token", "quantity": 10}]}]}


class CrystalHistoryTests(unittest.TestCase):
    def test_tracks_added_definitions_without_treating_newly_exported_fields_as_old_changes(self):
        history = build_history(previous(), current())
        self.assertEqual(history["transitions"][0]["addedSourceIds"], ["new"])
        self.assertEqual(history["transitions"][0]["changed"], [])
        self.assertNotIn("releasedAt", str(history))

    def test_detects_changes_only_in_the_shared_name_identity_and_direct_reward_projection(self):
        now = current(); now["categories"][0]["rewards"].append({"type": "hcos", "data": "gwenom_t7|first_edition", "quantity": 1})
        history = build_history(previous(), now)
        change = history["transitions"][0]["changed"][0]
        self.assertEqual(change["sourceId"], "old")
        self.assertEqual(change["fields"], ["directChampionRewards"])
        self.assertNotEqual(change["previousProjectionSha256"], change["projectionSha256"])

    def test_display_annotations_do_not_create_history_and_reannotation_can_extend_existing_chain(self):
        now = current(); history = build_history(previous(), now)
        annotated = current(); annotated["categories"][0]["rewards"][0].update({"displayName": "Hulk", "gameId": "hulk", "rarity": 7})
        self.assertEqual(snapshot(now)[0]["projectionSha256"], snapshot(annotated)[0]["projectionSha256"])
        later = current(); later["source"] = {"observedAt": "2026-11-06T12:00:00+00:00", "gachaSha256": "c"*64}
        result = build_history(annotated, later, history)
        self.assertEqual(result["observations"][1], history["observations"][1])
        self.assertEqual(result["transitions"][-1]["changed"], [])

    def test_appending_preserves_the_original_baseline_and_rejects_a_different_chain(self):
        now = current(); history = build_history(previous(), now)
        later = current(); later["source"] = {"observedAt": "2026-11-06T12:00:00+00:00", "gachaSha256": "c"*64}
        result = build_history(now, later, history)
        self.assertEqual(result["baselineSourceIds"], ["old"])
        self.assertEqual(len(result["observations"]), 3)
        self.assertEqual(result["transitions"][0]["addedSourceIds"], ["new"])
        wrong = current(); wrong["crystals"][0]["name"] = "Changed elsewhere"
        with self.assertRaisesRegex(ValueError, "history chain"): build_history(wrong, later, history)

    def test_rejects_unknown_category_references_and_backwards_observations(self):
        now = current(); now["crystals"][0]["categoryIds"] = ["missing"]
        with self.assertRaisesRegex(ValueError, "Unknown category"): build_history(previous(), now)
        now = current(); now["source"]["observedAt"] = "2026-11-01T00:00:00+00:00"
        with self.assertRaisesRegex(ValueError, "later"): build_history(previous(), now)


if __name__ == "__main__": unittest.main()
