"""Behavioral tests for source-specific crystal rules, without inferred probabilities."""
import copy
import unittest

from extract_mcoc_crystal_rules import build_rules


def fixture():
    return {
        'categories': [
            {'Name': 'heroes', 'Items': [{'Type': 'hero', 'Data': 'hulk_t7', 'Quantity': 1, 'MinQuantity': 1, 'MaxQuantity': 1, 'ContextProto': {'bonusReward': 'hulk_cluster'}}]},
            {'Name': 'tokens', 'Items': [{'Type': 'inv', 'Data': 'ascension_token_class_chemical', 'Quantity': 1, 'MinQuantity': 2, 'MaxQuantity': 2}]},
        ],
        'groups': [{'Name': 'events', 'Set': {'Name': 'events', 'Boxes': [
            {'Name': 'hero_box', '_displayName': {'en': 'Hero Box'}, '_possiblePrizeCategories': ['heroes', 'tokens'], 'PityTemplate': 'hero_pity', 'IsBoxGacha': True, 'BoxGachaOpenLimit': 6, 'HideOddsInfo': False},
            {'Name': 'other_opening', '_possiblePrizeCategories': ['heroes'], 'SelectableEnabled': True, 'SelectableSpinCount': 3, 'SelectablePickCount': 1},
        ]}}],
        'pityTemplates': [{'Name': 'hero_pity', 'PityGroups': ['hero_threshold']}],
        'pityGroups': [{'Name': 'hero_threshold', 'PayoutLimit': 35, '_description': {'en': 'A champion within {0} crystals'}, 'PityTags': ['shared_counter_tag']}],
        'bonusRewards': [{'Name': 'hulk_cluster', 'AutoAscend': True, 'Redeemers': [{'Type': 'inv', 'Data': 'ascension_token_champion_hulk', 'Quantity': 1}]}],
    }


class CrystalRulesTests(unittest.TestCase):
    def test_preserves_source_openings_and_exact_pity_bonus_bindings(self):
        result = build_rules(fixture())
        boxes = {row['id']: row for row in result['crystals']}
        self.assertEqual(boxes['hero_box']['pityTemplateId'], 'hero_pity')
        self.assertEqual(boxes['hero_box']['boxRules']['openLimit'], 6)
        self.assertEqual(boxes['other_opening']['selection'], {'draw': 3, 'pick': 1})
        self.assertEqual(result['pityTemplates'][0]['groupIds'], ['hero_threshold'])
        self.assertEqual(result['pityGroups'][0]['pityTags'], ['shared_counter_tag'])
        self.assertEqual(result['pityGroups'][0]['descriptionTemplate'], 'A champion within {0} crystals')
        self.assertEqual(result['bonusRewards'][0]['autoAscend'], True)
        self.assertEqual(result['categoryRules'][0]['bonusBindings'][0]['bonusRewardId'], 'hulk_cluster')
        self.assertEqual(result['numericOddsStatus'], 'not_in_static_catalog')
        self.assertNotIn('probability', str(result))

    def test_preserves_reward_ranges_instead_of_treating_entry_quantity_as_the_amount(self):
        result = build_rules(fixture())
        tokens = next(row for row in result['categoryRules'] if row['id'] == 'tokens')
        self.assertEqual(tokens['nonChampionRewards'][0], {'sourceIndex': 0, 'type': 'inv', 'data': 'ascension_token_class_chemical', 'quantity': 1, 'minQuantity': 2, 'maxQuantity': 2})

    def test_counts_repeated_context_bindings_and_retains_cosmetic_bonus_items(self):
        data = fixture()
        data['categories'][0]['Items'].append(copy.deepcopy(data['categories'][0]['Items'][0]))
        data['bonusRewards'][0]['Redeemers'].append({'Type': 'profilebadge', 'Data': 'example_badge', 'Quantity': 1})
        result = build_rules(data)
        self.assertEqual(result['coverage']['contextKeys'], {'bonusReward': 2})
        self.assertEqual(result['coverage']['conditionalBonusBindings'], 2)
        self.assertEqual(result['bonusRewards'][0]['rewards'][1]['type'], 'profilebadge')

    def test_marks_a_reversed_source_quantity_range_without_repairing_it(self):
        data = fixture()
        data['categories'][1]['Items'][0].update(MinQuantity=600, MaxQuantity=500)
        result = build_rules(data)
        item = next(row for row in result['categoryRules'] if row['id'] == 'tokens')['nonChampionRewards'][0]
        self.assertEqual((item['minQuantity'], item['maxQuantity']), (600, 500))
        self.assertEqual(item['quantityRangeStatus'], 'reversed_in_source')
        self.assertEqual(result['coverage']['reversedQuantityRanges'], 1)

    def test_rejects_missing_template_group_category_and_bonus_bindings(self):
        for mutate in [
            lambda data: data['groups'][0]['Set']['Boxes'][0].update(PityTemplate='unknown'),
            lambda data: data['pityTemplates'][0].update(PityGroups=['unknown']),
            lambda data: data['groups'][0]['Set']['Boxes'][0].update(_possiblePrizeCategories=['unknown']),
            lambda data: data['categories'][0]['Items'][0]['ContextProto'].update(bonusReward='unknown'),
        ]:
            data = fixture(); mutate(data)
            with self.assertRaises(ValueError): build_rules(data)

    def test_rejects_duplicate_ids_and_unreviewed_reward_types(self):
        for mutate in [lambda data: data['pityGroups'].append(copy.deepcopy(data['pityGroups'][0])), lambda data: data['categories'][0]['Items'][0].update(Type='unknown')]:
            data = fixture(); mutate(data)
            with self.assertRaises(ValueError): build_rules(data)

    def test_rejects_invalid_thresholds_selection_and_box_limits(self):
        for mutate in [lambda data: data['pityGroups'][0].update(PayoutLimit=0), lambda data: data['groups'][0]['Set']['Boxes'][0].update(BoxGachaOpenLimit=0), lambda data: data['groups'][0]['Set']['Boxes'][1].update(SelectablePickCount=4)]:
            data = fixture(); mutate(data)
            with self.assertRaises(ValueError): build_rules(data)


if __name__ == '__main__':
    unittest.main()
