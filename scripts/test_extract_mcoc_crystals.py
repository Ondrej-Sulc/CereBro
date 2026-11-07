"""Synthetic source-contract tests; no game installation required."""
import unittest

from extract_mcoc_crystals import build_catalog


def source():
    return {
        "categories": [{"Name": "actual", "Items": [{"Type": "hero", "Data": "strange_7", "Quantity": 1, "MinQuantity": 1, "MaxQuantity": 1}]},
                       {"Name": "preview", "Items": [{"Type": "hero", "Data": "hulk_6", "Quantity": 1, "MinQuantity": 1, "MaxQuantity": 1}]}],
        "groups": [{"Name": "events", "Set": {"Name": "catalog", "Boxes": [
            {"Name": "titan", "_displayName": {"en": "TITAN", "fr": "OTHER"}, "_possiblePrizeCategories": ["actual"],
             "_carouselFeaturedPrizesCategories": ["preview"], "_boxFeaturedPrizes": [{"Type": "hero", "Data": "hulk_6"}]}]}}],
    }


BLUEPRINTS = [{"Blueprint": "strange_7", "Character": "drstrange", "Rarity": 7, "UserCollection": True},
              {"Blueprint": "hulk_6", "Character": "hulk", "Rarity": 6, "UserCollection": True}]


class CrystalExtractionTest(unittest.TestCase):
    def test_first_edition_champion_rewards_join_exact_blueprints_and_preserve_cosmetic_data(self):
        data = source()
        data['categories'][0]['Items'] = [{'Type': 'hcos', 'Data': 'strange_7|first_edition', 'Quantity': 1, 'MinQuantity': 1, 'MaxQuantity': 1,
                                          'ContextProto': {'bonusReward': 'unrelated_bonus'}}]
        data['groups'][0]['Set']['Boxes'][0]['_boxFeaturedPrizes'] = [{'Type': 'hcos', 'Data': 'strange_7|first_edition'}]
        result = build_catalog(data, BLUEPRINTS)
        pool = next(p for p in result['pools'] if p['id'] == 'actual')
        self.assertEqual(pool['heroTierIds'], ['strange_7'])
        self.assertEqual(pool['heroCosmeticRewards'], [{'tierId': 'strange_7', 'cosmeticId': 'first_edition', 'sourceData': 'strange_7|first_edition'}])
        self.assertEqual(result['crystals'][0]['promotedChampionIds'], ['drstrange'])

    def test_unrecognized_or_malformed_cosmetic_champion_rewards_fail_closed(self):
        for value in ['strange_7', 'strange_7|', '|first_edition', 'strange_7|first_edition|extra', 'strange_7|unverified_style', 'unknown_7|first_edition']:
            with self.subTest(value=value):
                data = source()
                data['categories'][0]['Items'] = [{'Type': 'hcos', 'Data': value, 'Quantity': 1, 'MinQuantity': 1, 'MaxQuantity': 1}]
                with self.assertRaises(ValueError):
                    build_catalog(data, BLUEPRINTS)

    def test_unknown_reward_types_require_review_instead_of_silent_omission(self):
        data = source()
        data['categories'][0]['Items'][0]['Type'] = 'unreviewed_champion_format'
        with self.assertRaisesRegex(ValueError, 'Unknown reward item type'):
            build_catalog(data, BLUEPRINTS)

    def test_promotional_champions_are_separate_from_possible_rewards(self):
        result = build_catalog(source(), BLUEPRINTS)
        self.assertEqual(result['crystals'][0]['promotedChampionIds'], ['hulk'])
        self.assertEqual(next(p for p in result['pools'] if p['id'] == 'actual')['heroTierIds'], ['strange_7'])

    def test_reward_names_come_from_exact_character_localization(self):
        result = build_catalog(source(), BLUEPRINTS, [{'Character': 'drstrange', '_friendlyNameLoc': {'en': 'DOCTOR STRANGE'}}])
        self.assertEqual(result['champions'], [{'id': 'drstrange', 'name': 'DOCTOR STRANGE'}])

    def test_membership_uses_possible_prizes_and_named_blueprints_only(self):
        result = build_catalog(source(), BLUEPRINTS)
        self.assertEqual(result["crystals"][0]["categoryIds"], ["actual"])
        self.assertEqual(result["crystals"][0]["name"], "TITAN")
        self.assertEqual(next(p for p in result["pools"] if p["id"] == "actual")["heroTierIds"], ["strange_7"])
        self.assertEqual(next(t for t in result["tiers"] if t["id"] == "strange_7"), {"id": "strange_7", "championId": "drstrange", "rarity": 7})

    def test_unknown_blueprint_fails_instead_of_guessing_from_suffix(self):
        with self.assertRaisesRegex(ValueError, "Unknown hero blueprint"):
            build_catalog(source(), BLUEPRINTS[1:])

    def test_artwork_is_bound_to_the_actual_closed_image_with_token_fallback(self):
        data = source()
        box = data['groups'][0]['Set']['Boxes'][0]
        box.update({'_closedImage': {'en': 'gacha/titan.png'}, 'ClosedOnCDN': True,
                    '_tokenImage': {'en': 'uigacha/token'}, 'TokenImageOnCDN': False})
        self.assertEqual(build_catalog(data, BLUEPRINTS)['crystals'][0]['artwork'], {'reference': 'gacha/titan.png', 'source': 'cdn'})
        box['_closedImage'] = {'en': ''}
        self.assertEqual(build_catalog(data, BLUEPRINTS)['crystals'][0]['artwork'], {'reference': 'uigacha/token', 'source': 'resource'})

    def test_banner_artwork_uses_the_background_reference_and_never_the_hologram(self):
        data = source()
        box = data['groups'][0]['Set']['Boxes'][0]
        box.update({'_backgroundImage': {'en': 'gacha/banner.jpg'}, 'BackgroundOnCDN': True,
                    'GameSpecificData': {'HologramImage': 'gacha/hologram.png', 'HologramImageOnCDN': True}})
        self.assertEqual(build_catalog(data, BLUEPRINTS)['crystals'][0]['bannerArtwork'], {'reference': 'gacha/banner.jpg', 'source': 'cdn'})
        box['BackgroundOnCDN'] = False
        self.assertEqual(build_catalog(data, BLUEPRINTS)['crystals'][0]['bannerArtwork']['source'], 'resource')
        box['_backgroundImage'] = {'en': ''}
        self.assertIsNone(build_catalog(data, BLUEPRINTS)['crystals'][0]['bannerArtwork'])

    def test_missing_category_is_not_silently_dropped(self):
        data = source()
        data["categories"] = data["categories"][1:]
        with self.assertRaisesRegex(ValueError, "Unknown reward category"):
            build_catalog(data, BLUEPRINTS)

    def test_source_identity_is_preserved_for_equal_display_names(self):
        data = source()
        data["groups"][0]["Set"]["Boxes"].append({"Name": "other_titan", "_displayName": {"en": "TITAN"}, "_possiblePrizeCategories": ["preview"]})
        self.assertEqual([c["id"] for c in build_catalog(data, BLUEPRINTS)["crystals"]], ["other_titan", "titan"])

    def test_duplicate_identity_and_unrecognized_reward_actions_fail(self):
        data = source()
        data["groups"][0]["Set"]["Boxes"] *= 2
        with self.assertRaisesRegex(ValueError, "Duplicate crystal"):
            build_catalog(data, BLUEPRINTS)
        data = source()
        data["categories"][0]["Items"][0]["Action"] = "unknown"
        with self.assertRaisesRegex(ValueError, "Unsupported hero reward"):
            build_catalog(data, BLUEPRINTS)


if __name__ == "__main__":
    unittest.main()
