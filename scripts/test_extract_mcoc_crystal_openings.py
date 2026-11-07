"""Public all-reward projection tests. No game service or account access."""
import copy
import json
from pathlib import Path
import tempfile
import unittest

from extract_mcoc_crystal_openings import add_display_names, build_openings, localize_display_names
from test_extract_mcoc_crystal_rules import fixture


class CrystalOpeningExportTests(unittest.TestCase):
    def test_keeps_every_definition_and_mixed_reward_entry_in_source_order(self):
        data = fixture()
        data['categories'].append({'Name': 'banquet', 'DisplayRarityIndex': 4, 'Items': [
            {'Type': 'res', 'Data': 'sc', 'Quantity': 1, 'MinQuantity': 250000, 'MaxQuantity': 500000},
            {'Type': 'gs', 'Data': 'jubilant_crystal_dec25', 'Quantity': 1},
            {'Type': 'ebp', 'Data': 'selector_blueprint', 'Quantity': 1},
        ]})
        data['groups'][0]['Set'].update(Version='opaque_hash', PossiblePrizes=[{'Type': 'hero', 'Data': 'promo_only'}])
        data['groups'][0]['Set']['Boxes'].append({'Name': 'resource_only', '_possiblePrizeCategories': ['banquet'],
            'MinItems': 5, 'MaxItems': 5, 'Multiplier': 1, 'PickSet': 'choice', 'EndTime': -1, 'Token': 'opening_token',
            '_boxFeaturedPrizes': [{'Type': 'hero', 'Data': 'promo_only'}]})
        result = build_openings(data)
        opening = next(row for row in result['crystals'] if row['id'] == 'resource_only')
        self.assertEqual(result['coverage']['definitions'], 3)
        self.assertEqual(opening['categoryIds'], ['banquet'])
        self.assertEqual(opening['sourceMetadata'], {'setVersion': 'opaque_hash', 'minItems': 5, 'maxItems': 5,
            'multiplier': 1, 'pickSet': 'choice', 'endTime': -1, 'token': 'opening_token'})
        category = next(row for row in result['categories'] if row['id'] == 'banquet')
        self.assertEqual(category['displayRarityIndex'], 4)
        self.assertEqual([row['sourceIndex'] for row in category['rewards']], [0, 1, 2])
        self.assertEqual(category['rewards'][0]['minQuantity'], 250000)
        self.assertEqual(category['rewards'][1]['data'], 'jubilant_crystal_dec25')
        self.assertNotIn('rewards', category['rewards'][1])
        self.assertEqual(opening['presentation']['featuredRewards'][0]['data'], 'promo_only')
        self.assertNotIn('promo_only', str(category))
        self.assertEqual(result['numericOddsStatus'], 'not_in_static_catalog')

    def test_keeps_duplicate_rewards_and_conditional_bonus_identity(self):
        data = fixture()
        data['categories'][0]['Items'].append(copy.deepcopy(data['categories'][0]['Items'][0]))
        result = build_openings(data)
        category = next(row for row in result['categories'] if row['id'] == 'heroes')
        self.assertEqual([row['sourceIndex'] for row in category['rewards']], [0, 1])
        self.assertEqual(category['rewards'][0]['context']['bonusReward'], 'hulk_cluster')
        self.assertTrue(result['bonusRewards'][0]['autoAscend'])
        self.assertEqual(result['bonusRewards'][0]['rewards'][0]['sourceIndex'], 0)
        self.assertEqual(result['coverage']['conditionalBonusBindings'], 2)

    def test_preserves_absence_and_reversed_ranges_and_rejects_unresolved_bindings(self):
        data = fixture()
        data['categories'][1]['Items'][0].update(MinQuantity=600, MaxQuantity=500)
        result = build_openings(data)
        self.assertEqual(result['crystals'][0]['sourceMetadata'], {})
        category = next(row for row in result['categories'] if row['id'] == 'tokens')
        self.assertEqual(category['rewards'][0]['quantityRangeStatus'], 'reversed_in_source')
        data['groups'][0]['Set']['Boxes'][0]['_possiblePrizeCategories'] = ['absent']
        with self.assertRaises(ValueError): build_openings(data)

    def test_rejects_unreviewed_tab_definitions_instead_of_silently_omitting_them(self):
        data = fixture(); data['tabs'] = [{'name': 'new_tab'}]
        with self.assertRaisesRegex(ValueError, 'tab'): build_openings(data)

    def test_display_titles_require_exact_inventory_or_blueprint_registry_match(self):
        result = build_openings(fixture())
        add_display_names(result, [{'Blueprint': 'hulk_t7', 'Character': 'hulk', 'Rarity': 7}],
            [{'Character': 'hulk', '_friendlyNameLoc': {'en': 'Hulk'}}],
            [{'Name': 'ascension_token_class_chemical', 'Title': 'Science Ascension Token'}, {'Name': 'sc', 'Title': 'Not a resource join'}])
        hero = next(row for row in result['categories'] if row['id'] == 'heroes')['rewards'][0]
        token = next(row for row in result['categories'] if row['id'] == 'tokens')['rewards'][0]
        self.assertEqual(hero['displayName'], 'Hulk')
        self.assertEqual((hero['gameId'], hero['rarity']), ('hulk', 7))
        self.assertEqual(token['displayName'], 'Science Ascension Token')
        self.assertNotIn('displayName', result['bonusRewards'][0]['rewards'][0])

    def test_joins_nested_labels_by_token_not_name_and_leaves_conflicts_unresolved(self):
        data = fixture()
        data['categories'][1]['Items'] = [
            {'Type': 'gs', 'Data': 'reward_token'}, {'Type': 'gf', 'Data': 'reward_token'},
            {'Type': 'gs', 'Data': 'target_source_id'}, {'Type': 'gs', 'Data': 'ambiguous_token'},
            {'Type': 'ebp', 'Data': 't6_chemical'}, {'Type': 'ebpf', 'Data': 't6_chemical'},
            {'Type': 'gs', 'Data': 'shared_token'},
        ]
        data['groups'][0]['Set']['Boxes'] += [
            {'Name': 'target_source_id', 'Token': 'reward_token', '_displayName': {'en': 'Nested Crystal'}, '_fragmentName': {'en': 'Nested Shards'}},
            {'Name': 'ambiguous_one', 'Token': 'ambiguous_token', '_displayName': {'en': 'One'}},
            {'Name': 'ambiguous_two', 'Token': 'ambiguous_token', '_displayName': {'en': 'Two'}},
            {'Name': 'shared_one', 'Token': 'shared_token', '_displayName': {'en': 'Shared Label'}},
            {'Name': 'shared_two', 'Token': 'shared_token', '_displayName': {'en': 'Shared Label'}},
        ]
        result = build_openings(data)
        add_display_names(result, evo_blueprints=[{'EvoBlueprint': 't6_chemical', '_friendlyNameLoc': {'en': 'Tier 6 Science Catalyst'}}], gacha=data)
        items = next(row for row in result['categories'] if row['id'] == 'tokens')['rewards']
        self.assertEqual(items[0]['displayName'], 'Nested Crystal')
        self.assertEqual(items[0]['nestedCrystalId'], 'target_source_id')
        self.assertEqual(items[1]['displayName'], 'Nested Shards')
        self.assertEqual(items[1]['nestedCrystalId'], 'target_source_id')
        self.assertNotIn('displayName', items[2])
        self.assertNotIn('nestedCrystalId', items[2])
        self.assertNotIn('displayName', items[3])
        self.assertEqual(items[4]['displayName'], 'Tier 6 Science Catalyst')
        self.assertEqual(items[5]['displayName'], 'Tier 6 Science Catalyst')
        self.assertEqual(items[6]['displayName'], 'Shared Label')
        self.assertNotIn('nestedCrystalId', items[6])

    def test_resolves_exact_english_keys_with_sanitized_provenance_and_no_guess_on_conflicts(self):
        result = build_openings(fixture())
        items = next(row for row in result['categories'] if row['id'] == 'tokens')['rewards']
        items[0]['displayName'] = 'ID_TOKEN'
        items.append({'sourceIndex': 1, 'type': 'inv', 'data': 'conflict', 'displayName': 'ID_CONFLICT'})
        with tempfile.TemporaryDirectory() as directory:
            paths = [Path(directory)/'one.json', Path(directory)/'two.json']
            paths[0].write_text(json.dumps({'meta': {'format': 'sparx', 'language': 'en'}, 'strings': [
                {'k': 'ID_TOKEN', 'v': 'Science Token'}, {'k': 'ID_CONFLICT', 'v': 'One'}]}), encoding='utf8')
            paths[1].write_text(json.dumps({'meta': {'format': 'sparx', 'language': 'en'}, 'strings': [
                {'k': 'ID_CONFLICT', 'v': 'Two'}]}), encoding='utf8')
            sources = localize_display_names(result, paths)
        self.assertEqual(items[0]['displayName'], 'Science Token')
        self.assertNotIn('displayName', items[1])
        self.assertEqual([row['fileName'] for row in sources], ['one.json'])
        self.assertTrue(all('path' not in row for row in sources))


if __name__ == '__main__':
    unittest.main()
