"""Exact path reward identities, native display semantics, and artwork receipts."""
import io
import hashlib
from pathlib import Path
import tempfile
import unittest

from PIL import Image

from build_path_reward_artwork import acquire_image, png_info, project_crystals, project_inventory, project_materials


class PathRewardArtworkTests(unittest.TestCase):
    def item(self, **changes):
        return {"Name": "unrelated_t1", "Title": "DEATHLESS SIGNATURE STONE", "Description": "Native description.",
                "UseOnHero": True, "HTags": "t7:deathless", "SigState": "a",
                "Redeemers": [{"Type": "res", "Quantity": 99}, {"Type": "skl", "Quantity": 1}],
                "image": {"en": "inventory/exact.png"}, "ImageS3": False, **changes}

    def test_exact_inventory_identity_and_native_tags_supply_the_display(self):
        item = self.item()
        rows = project_inventory({("inv", "unrelated_t1"), ("inv", "unrelated_t7"), ("gs", "unrelated_t1")},
                                 [("/items/consumable/gameStoreItems/0", item)], {"t7": 7}, {})
        self.assertEqual(set(rows), {'["inv","unrelated_t1"]'})
        row = rows['["inv","unrelated_t1"]']
        self.assertEqual({key: row[key] for key in ("name", "description", "rarity", "signaturePoints")},
                         {"name": "DEATHLESS SIGNATURE STONE", "description": "Native description.", "rarity": 7, "signaturePoints": 1})
        self.assertEqual(row["source"]["definitionPointers"], ["/items/consumable/gameStoreItems/0"])
        self.assertEqual(item["Name"], "unrelated_t1")

    def test_conflicting_exact_definitions_are_rejected_and_unresolved_words_are_omitted(self):
        item = self.item()
        with self.assertRaisesRegex(ValueError, "Ambiguous"):
            project_inventory({("inv", item["Name"])}, [("/0", item), ("/1", self.item(Title="Other"))], {}, {})
        self.assertEqual(project_inventory({("inv", item["Name"])}, [("/0", self.item(Title="ID_MISSING"))], {}, {}), {})
        localized = project_inventory({("inv", item["Name"])}, [("/0", self.item(Title="ID_TITLE"))], {},
                                      {"ID_TITLE": {"Native localized name": {"words.json"}}})
        self.assertEqual(localized['["inv","unrelated_t1"]']["name"], "Native localized name")

    def test_native_png_bytes_are_preserved_and_receipts_are_verified_without_network(self):
        buffer = io.BytesIO()
        Image.new("RGBA", (3, 2), (10, 20, 30, 0)).save(buffer, format="PNG")
        payload = buffer.getvalue()
        with tempfile.TemporaryDirectory() as directory:
            assets = Path(directory)
            data, receipt = acquire_image("inventory/exact.png", False, None, assets,
                                          retained_payload=payload)
            self.assertEqual(data, payload)
            self.assertEqual((assets / receipt["file"]).read_bytes(), payload)
            self.assertEqual(png_info(payload)["width"], 3)
            again, repeated = acquire_image("inventory/exact.png", False, None, assets, receipt=receipt)
            self.assertEqual((again, repeated), (payload, receipt))
            (assets / receipt["file"]).write_bytes(b"changed")
            with self.assertRaisesRegex(ValueError, "drift"):
                acquire_image("inventory/exact.png", False, None, assets, receipt=receipt)

    def test_unsafe_references_and_non_png_payloads_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            for reference in ("../secret.png", "https://other.test/a.png", "a.png?token=secret", "a\\b.png"):
                with self.assertRaises(ValueError):
                    acquire_image(reference, True, None, Path(directory))
        with self.assertRaises(ValueError):
            png_info(b"not a PNG")

    def test_native_cdn_cache_joins_the_exact_reference_including_case_and_directories(self):
        reference = "gamestore/exact/Stone.png"
        buffer = io.BytesIO()
        Image.new("RGBA", (2, 2), (5, 6, 7, 255)).save(buffer, format="PNG")
        payload = buffer.getvalue()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            cache = root / "cache"
            cache.mkdir()
            key = hashlib.sha1(("/" + reference).encode()).hexdigest().upper() + ".png"
            (cache / key).write_bytes(payload)
            data, receipt = acquire_image(reference, True, None, root / "assets", cache=cache)
            self.assertEqual(data, payload)
            self.assertEqual(receipt["cacheKey"], key)
            self.assertEqual(receipt["sourceUrl"], "https://kabam-marvel.shared.mcoc-cdn.net/" + reference)
            with self.assertRaisesRegex(ValueError, "unavailable"):
                acquire_image(reference.lower(), True, None, root / "assets", cache=cache)

    def test_crystal_tokens_use_the_native_fragment_and_whole_crystal_roles(self):
        box = {"Name": "different_box_id", "Token": "exact_token", "_displayName": {"en": "Whole crystal"},
               "_fragmentName": {"en": "Shard label"}, "_tokenImage": {"en": "uigacha/crystal"},
               "TokenImageOnCDN": False, "_fragmentImage": {"en": "gacha/exact/Shard.png"}, "FragmentImageOnCDN": True}
        rows = project_crystals({("gf", "exact_token"), ("gs", "exact_token"), ("gs", "different_box_id")}, [("/groups/0/Set/Boxes/1", box)], {})
        self.assertEqual(set(rows), {'["gf","exact_token"]', '["gs","exact_token"]'})
        self.assertEqual(rows['["gf","exact_token"]']["name"], "Shard label")
        self.assertEqual(rows['["gf","exact_token"]']["imageReference"], "gacha/exact/Shard.png")
        self.assertEqual(rows['["gs","exact_token"]']["imageReference"], "uigacha/crystal")
        self.assertFalse(rows['["gs","exact_token"]']["imageS3"])
        with self.assertRaisesRegex(ValueError, "Ambiguous"):
            project_crystals({("gs", "exact_token")}, [("/0", box), ("/1", {**box, "_displayName": {"en": "Other"}})], {})

    def test_material_identity_localizes_native_keys_and_keeps_its_exact_texture_binding(self):
        material = {"EvoBlueprint": "exact_material", "_friendlyNameLoc": {"en": "ID_NATIVE_NAME"},
                    "_descriptionLoc": {"en": "Native description"}, "_imgID": "portrait_exact", "Rarity": 7}
        tokens = {("ebp", "exact_material"), ("ebp", "portrait_exact")}
        rows = project_materials(tokens, [("/BCGEvoBlueprintBase/0", material)],
                                 {"ID_NATIVE_NAME": {"CYGNUS CATALYST": {"words.json"}}})
        self.assertEqual(set(rows), {'["ebp","exact_material"]'})
        row = rows['["ebp","exact_material"]']
        self.assertEqual(row["name"], "CYGNUS CATALYST")
        self.assertEqual(row["imageReference"], "portraits/portrait_exact")
        self.assertNotIn("rarity", row)  # Native material rarity is not a champion star rating.
        self.assertEqual(project_materials(tokens, [("/0", material)], {}), {})


if __name__ == "__main__":
    unittest.main()
