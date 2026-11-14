import unittest
import io
import tempfile
import json
from pathlib import Path
from PIL import Image
from extract_mcoc_reward_artwork import build_bindings, resolve_material_tint, tint_image
from extract_mcoc_crystal_artwork import export_image


class MaterialShaderRegressionTests(unittest.TestCase):
    def test_material_binding_exports_native_overlay_highlights_and_straight_alpha(self):
        colors = {'class_none': [0.43921568989753723, 0.43529412150382996, 0.5137255191802979, 1]}
        cases = [({'_evoType': 'evolve', '_class': 'none'}, (200, 200, 200, 128), (193, 193, 202, 128)),
                 ({'_evoType': 'events', '_tintColor': '23c5ff'}, (172, 172, 172, 128), (112, 217, 255, 128))]
        for blueprint, pixel, expected in cases:
            tint = resolve_material_tint(blueprint, colors)
            self.assertEqual(tint.get('blendMode'), 'overlay')
            image = Image.new('RGBA', (1, 1), pixel)
            encoded = io.BytesIO(); image.save(encoded, format='PNG')
            rendered = tint_image(encoded.getvalue(), tint['rgba'], tint.get('blendMode', 'multiply'))
            with tempfile.TemporaryDirectory() as directory:
                result = export_image(rendered, Path(directory) / 'full')
                with Image.open(Path(directory) / result['file']) as exported:
                    self.assertEqual(exported.convert('RGBA').getpixel((0, 0)), expected)
class RewardArtworkBindingsTests(unittest.TestCase):
    def test_rank_up_gems_use_native_class_tags_and_keep_generic_or_unreviewed_items_neutral(self):
        classes = ['mutant', 'trained', 'chemical', 'mystic', 'cosmic', 'tech']
        colors = json.loads((Path(__file__).resolve().parents[1]/'src/data/game-reward-artwork/palette.json').read_text())['colors']
        item = {'Name': 'rankup_t73_mutant', 'HTags': 't7:mutant', 'UseOnHero': True,
                'Rank': 3, 'Redeemers': [{'Type': 'hrup', 'Quantity': 1}], 'image': {'en': 'inventory/RankUp_Gems'}}
        items = [{**item, 'Name': 'rankup_t73_'+key, 'HTags': 't7:'+key} for key in classes]
        controls = [{**item, 'Name': 'generic', 'HTags': 't7'},
                    {**item, 'Name': 'relic', 'UseOnHero': False, 'UseOnRelic': True},
                    {**item, 'Name': 'cdn', 'ImageS3': True},
                    {**item, 'Name': 'not_rank_up', 'Redeemers': [{'Type': 'skl', 'Quantity': 1}]},
                    {**item, 'Name': 'no_rank', 'Rank': 0}]
        opening = {'categories': [{'rewards': [{'type': 'inv', 'data': row['Name']} for row in items+controls]}]}
        result = build_bindings(opening, {}, [], items+controls, colors, hero_classes=[{'ClassID': key} for key in classes])
        rows = {row['data']: row for row in result['bindings']}
        for key in classes:
            self.assertEqual(rows['rankup_t73_'+key]['renderTint'], {'source': 'color-dictionary', 'key': 'class_'+key,
                             'rgba': colors['class_'+key], 'blendMode': 'overlay'})
        for control in controls:
            self.assertFalse(rows[control['Name']]['tintApplied'])

    def test_native_pve_energy_branch_does_not_alias_unrelated_tower_resources(self):
        opening = {'categories': [{'rewards': [{'type': 'res', 'data': value} for value in ['pve-energy', 'tower_energy', 'tower_challenge_energy']]}]}
        result = build_bindings(opening, {}, [], [])
        self.assertEqual([(r['data'],r['reference']) for r in result['bindings']], [('pve-energy','resources/resource_energy_pve')])
        self.assertEqual({r['data'] for r in result['missing']}, {'tower_energy','tower_challenge_energy'})
    def test_neutral_inventory_uses_exact_class_tags_not_item_names_or_quantity(self):
        classes = ['mutant', 'trained', 'chemical', 'mystic', 'cosmic', 'tech']
        colors = json.loads((Path(__file__).resolve().parents[1]/'src/data/game-reward-artwork/palette.json').read_text())['colors']
        hero_classes = [{'ClassID': key} for key in classes]
        items = [{'Name': f'{prefix}_{key}', 'HTags': f't6{key}, t6:{key}', 'UseOnHero': True,
                  'SigState': state, 'image': {'en': reference}, 'Redeemers': [{'Type': 'skl', 'Quantity': qty}]}
                 for prefix, reference, state, qty in [('awaken_t6', 'inventory/Awaken', 'd', 1),
                     ('sigup_t6', 'inventory/SkillUp', 'a', 1), ('sigupfive_t6', 'inventory/SkillUp', 'a', 5)]
                 for key in classes]
        items += [{'Name': 'awaken_t6_mutant_in_name_only', 'HTags': 't6', 'UseOnHero': True,
                   'SigState': 'd', 'image': {'en': 'inventory/Awaken'}},
                  {'Name': 'different_name', 'HTags': ' T6:TECH, t6:mutant', 'UseOnHero': True,
                   'SigState': 'd', 'image': {'en': 'inventory/Awaken'}}]
        opening = {'categories': [{'rewards': [{'type': 'inv', 'data': item['Name']} for item in items]}]}
        rows = {row['data']: row for row in build_bindings(opening, {}, [], items, colors, hero_classes=hero_classes)['bindings']}
        for item in items[:18]:
            tint = rows[item['Name']]['renderTint']
            self.assertEqual(tint, {'source': 'color-dictionary', 'key': 'class_'+item['HTags'].split(':')[-1],
                                   'rgba': colors['class_'+item['HTags'].split(':')[-1]], 'blendMode': 'overlay'})
        self.assertFalse(rows['awaken_t6_mutant_in_name_only']['tintApplied'])
        self.assertEqual(rows['different_name']['classId'], 'tech')  # Game uses the first exact class token.

    def test_duplicate_inventory_records_must_agree_on_rendering_and_missing_colors_stop(self):
        item = {'Name': 'exact_item', 'HTags': 't6:mutant', 'UseOnHero': True,
                'SigState': 'd', 'image': {'en': 'inventory/Awaken'}}
        opening = {'categories': [{'rewards': [{'type': 'inv', 'data': item['Name']}]}]}
        colors = {'class_mutant': [1, 0.8, 0, 1], 'class_tech': [0, 0.5, 1, 1]}
        classes = [{'ClassID': 'mutant'}, {'ClassID': 'tech'}]
        result = build_bindings(opening, {}, [], [item, {**item, 'HTags': 't6:tech'}], colors, hero_classes=classes)
        self.assertEqual(result['bindings'], [])
        self.assertEqual(result['missing'][0]['reason'], 'ambiguous-registry-artwork')
        with self.assertRaisesRegex(ValueError, 'class color'):
            build_bindings(opening, {}, [], [item], {}, hero_classes=classes)
        with self.assertRaisesRegex(ValueError, 'requires review'):
            build_bindings(opening, {}, [], [item], colors, hero_classes=[{'ClassID': 'mutant', '_defaultColour': 'ffffff'}])

    def test_collection_pieces_use_exact_inventory_art_without_inventing_crystal_membership(self):
        result = build_bindings({'categories': [], 'bonusRewards': []}, {}, [], [
            {'Name': 'piece_t7', 'image': {'en': 'inventory/piece7.png'}, 'ImageS3': True},
            {'Name': 'piece_t6', 'image': {'en': 'inventory/piece6.png'}, 'ImageS3': True},
        ], additional_inventory=['piece_t7', 'piece_t6', 'piece_t7'])
        self.assertEqual({(row['data'], row['reference']) for row in result['bindings']}, {('piece_t7', 'inventory/piece7.png'), ('piece_t6', 'inventory/piece6.png')})
        self.assertEqual(result['missing'], [])

    def test_exact_registries_keep_material_fragments_and_crystal_tokens_distinct(self):
        opening = {'categories': [{'rewards': [
            {'type': 'inv', 'data': 'stone'}, {'type': 'ebp', 'data': 't6_chemical'}, {'type': 'ebpf', 'data': 't6_chemical'},
            {'type': 'gs', 'data': 'token'}, {'type': 'gf', 'data': 'token'}, {'type': 'gs', 'data': 'box_id'},
            {'type': 'res', 'data': 'sc'}, {'type': 'res', 'data': 'unreviewed_resource'},
        ]}], 'bonusRewards': []}
        gacha = {'groups': [{'Set': {'Boxes': [{'Name': 'box_id', 'Token': 'token',
            '_tokenImage': {'en': 'gacha/full.png'}, 'TokenImageOnCDN': True,
            '_fragmentImage': {'en': 'gacha/shard.png'}, 'FragmentImageOnCDN': True}]}}]}
        result = build_bindings(opening, gacha, [{'EvoBlueprint': 't6_chemical', '_imgID': 'catalyst6', '_class': 'chemical'}],
            [{'Name': 'stone', 'image': {'en': 'inventory/Stone'}}])
        rows = {(row['type'], row['data']): row for row in result['bindings']}
        self.assertEqual(rows['ebp', 't6_chemical']['reference'], 'portraits/catalyst6')
        self.assertEqual(rows['ebpf', 't6_chemical']['reference'], 'portraits/catalyst6_fragment')
        self.assertEqual(rows['ebpf', 't6_chemical']['role'], 'fragment')
        self.assertEqual(rows['gs', 'token']['reference'], 'gacha/full.png')
        self.assertEqual(rows['gf', 'token']['reference'], 'gacha/shard.png')
        self.assertEqual(rows['res', 'sc']['reference'], 'resources/resource_currency_soft')
        self.assertEqual({(row['type'], row['data']) for row in result['missing']}, {('gs', 'box_id'), ('res', 'unreviewed_resource')})

    def test_disagreed_exact_token_and_inventory_bindings_are_not_guessed(self):
        opening = {'categories': [{'rewards': [{'type': 'gs', 'data': 'shared'}, {'type': 'inv', 'data': 'shared'}]}], 'bonusRewards': []}
        gacha = {'groups': [{'Set': {'Boxes': [
            {'Name': 'one', 'Token': 'shared', '_tokenImage': {'en': 'one.png'}},
            {'Name': 'two', 'Token': 'shared', '_tokenImage': {'en': 'two.png'}},
        ]}}]}
        result = build_bindings(opening, gacha, [], [
            {'Name': 'shared', 'image': {'en': 'inventory/One'}}, {'Name': 'shared', 'image': {'en': 'inventory/Two'}},
        ])
        self.assertEqual(result['bindings'], [])
        self.assertEqual(len(result['missing']), 2)
        self.assertTrue(all(row['reason'] == 'ambiguous-registry-artwork' for row in result['missing']))


if __name__ == '__main__': unittest.main()
