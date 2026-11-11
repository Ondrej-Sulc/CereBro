"""Native item semantics, independent of item-name suffixes and prize quantity."""
import unittest
from build_reward_presentation import inventory_details


class InventoryPresentationTests(unittest.TestCase):
    def test_signature_points_follow_the_first_matching_native_redeemer_not_the_prize_count(self):
        item = {'Name': 'arbitrary_name', 'UseOnHero': True, 'HTags': 't7', 'SigState': 'a',
                'Redeemers': [{'Type': 'res', 'Quantity': 99}, {'Type': 'skl', 'Quantity': 5}, {'Type': 'skl', 'Quantity': 10}]}
        self.assertEqual(inventory_details(item, {'t7': 7}, {}), {'rarity': 7, 'signaturePoints': 5})
        item['Redeemers'][1] = {'Type': 'rskl', 'Quantity': 200}
        item['UseOnHero'], item['UseOnRelic'] = False, True
        self.assertEqual(inventory_details(item, {'t7': 7}, {}), {'rarity': 7, 'signaturePoints': 200})
        item['SigState'] = 'd'
        self.assertNotIn('signaturePoints', inventory_details(item, {'t7': 7}, {}))

    def test_native_relic_rank_items_use_the_same_display_for_both_directions(self):
        item = {'Name': 'unrelated_relic_item', 'UseOnHero': False, 'UseOnRelic': True,
                'HTags': 't6', 'Rank': 2, 'Redeemers': [{'Type': 'rrup', 'Quantity': 7}]}
        self.assertEqual(inventory_details(item, {'t6': 6}, {}),
                         {'rarity': 6, 'rankChange': {'from': 2, 'to': 3}})
        item['Redeemers'][0]['Type'] = 'rrdwn'
        self.assertEqual(inventory_details(item, {'t6': 6}, {}),
                         {'rarity': 6, 'rankChange': {'from': 2, 'to': 1}})

    def test_native_rank_display_uses_first_redeemer_and_required_rank(self):
        item = {'Name': 'unrelated_name', 'Title': 'RANK UP GEM', 'UseOnHero': True,
                'HTags': 't7', 'Rank': 3, 'Redeemers': [{'Type': 'hrup', 'Quantity': 12}]}
        self.assertEqual(inventory_details(item, {'t7': 7}, {}),
                         {'rarity': 7, 'rankChange': {'from': 3, 'to': 4}})

    def test_rank_and_rarity_are_not_inferred_from_an_item_name(self):
        item = {'Name': 'rankup_t73', 'Title': 'Rank up gem', 'Rank': 3,
                'Redeemers': [{'Type': 'hrup'}]}
        self.assertEqual(inventory_details(item, {'t7': 7}, {}), {})

    def test_down_rank_and_first_redeemer_match_native_display(self):
        item = {'Name': 'x', 'UseOnHero': True, 'HTags': ' t6:chemical ',
                'Rank': 4, 'Redeemers': [{'Type': 'hrdwn'}]}
        self.assertEqual(inventory_details(item, {'t6': 6}, {'chemical': 'Science'}),
                         {'rarity': 6, 'className': 'Science', 'rankChange': {'from': 4, 'to': 3}})
        item['Redeemers'].insert(0, {'Type': 'res'})
        self.assertNotIn('rankChange', inventory_details(item, {'t6': 6}, {}))

    def test_unknown_or_unrestricted_rank_keeps_numbers_unset(self):
        item = {'Name': 'x', 'UseOnHero': True, 'Rank': 0, 'Redeemers': [{'Type': 'hrup'}]}
        self.assertNotIn('rankChange', inventory_details(item, {}, {}))


if __name__ == '__main__':
    unittest.main()
