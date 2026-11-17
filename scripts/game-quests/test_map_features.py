import copy
import json
import unittest
from pathlib import Path

from build_map_features import DEFAULT_SUPPLEMENT, REPO, gate_definition, project, reward, validate_source_tiles


LABELS = dict(blueprints={'hero_t6': 'Example Hero', 'hero_t7': 'Example Hero'},
              classes={'chemical': 'Science', 'mutant': 'Mutant'},
              tags={'tg_vill': 'Villain', 'tg_gam': 'Gamma', 'tg_god': 'God'})
SOURCE = dict(file='frozen.json', sha256='a' * 64, pointer='/quest', capturedAt='2026-11-09T00:00:00Z')


class MapFeatureTests(unittest.TestCase):
    def public(self):
        return dict(questId='quest', mapId='map', sourceHash='a' * 64,
                    tiles=[dict(coordinate=[1, 2], barrier='gate')],
                    paths=[dict(index=4, coordinates=[[1, 2]])])

    def quest(self):
        return dict(qid='quest', mapId='map', barriers={}, pathBasedRewardsList=[])

    def test_missing_definition_preserves_position_and_unknown_coverage(self):
        result = project(self.public(), self.quest(), SOURCE, LABELS)
        self.assertEqual(result['coverage']['gates'], 'uncaptured')
        self.assertEqual(result['gates'][0]['coordinate'], [1, 2])
        self.assertEqual(result['gates'][0]['pathIndices'], [4])
        self.assertFalse(result['gates'][0]['resolved'])
        self.assertNotIn('constraints', result['gates'][0])

    def test_class_and_star_count_requires_same_matching_champions(self):
        native = dict(barrierType='hasClassAndRarity', champions=[], barrierClass='mutant',
                      BarrierRarity='legendary', ChampionCount=2, CountOperator='gte')
        result = gate_definition('gate', native, LABELS, SOURCE)
        self.assertEqual(result['kind'], 'class-and-rarity')
        self.assertEqual(result['label'], 'At least 2 5★ Mutant champions')
        self.assertEqual(result['constraints']['nativeType'], 'hasClassAndRarity')
        self.assertEqual(result['constraints']['count'], 2)

    def test_champion_variants_are_alternatives_not_multiple_requirements(self):
        result = gate_definition('gate', dict(barrierType='hasChampion',
                                 champions=['hero_t6', 'hero_t7'], ChampionCount=1, CountOperator=''), LABELS, SOURCE)
        self.assertEqual(result['label'], 'Example Hero required')
        self.assertEqual(result['constraints']['championLogic'], 'any')
        self.assertEqual(result['constraints']['champions'], ['hero_t6', 'hero_t7'])

    def test_tag_groups_preserve_outer_or_inner_and_and_negation(self):
        result = gate_definition('gate', dict(barrierType='hasTags', Tags=['tg_vill:tg_gam', '!tg_god'],
                                 ChampionCount=3, CountOperator='gte'), LABELS, SOURCE)
        self.assertEqual(result['label'], 'At least 3 champions: (Villain and Gamma) or not God')
        self.assertEqual(result['constraints']['tagLogic'], 'any-group-all-terms')

    def test_unplaced_definitions_never_invent_locations(self):
        quest = self.quest()
        quest['barriers'] = {'other': dict(barrierType='hasRarity', BarrierRarity='t6',
                                         ChampionCount=2, CountOperator='gte')}
        result = project(self.public(), quest, SOURCE, LABELS)
        unplaced = result['unplacedGateDefinitions'][0]
        self.assertEqual(unplaced['label'], 'At least 2 6★ champions')
        self.assertNotIn('coordinate', unplaced)
        self.assertNotIn('pathIndices', unplaced)

    def test_reward_projection_excludes_claim_collection_and_account_fields(self):
        native = dict(Type='inv', Data='stone', Quantity=10, MinQuantity=10, MaxQuantity=10,
                      Id='static-item', DisplayName='Stone', collected=True, claimed=True,
                      playerId='private', accountId='private', progress={'private': True})
        self.assertEqual(reward(native, 2), dict(sourceIndex=2, type='inv', data='stone', quantity=10,
                         minQuantity=10, maxQuantity=10, id='static-item', displayName='Stone'))
        quest = self.quest()
        quest['pathBasedRewardsList'] = [dict(x=1, y=2, items=[native], collected=True)]
        quest['collectedPathBasedRewardsList'] = [dict(x=99, y=99, items=[native])]
        result = project(self.public(), quest, SOURCE, LABELS)
        clean = copy.deepcopy(quest)
        del clean['collectedPathBasedRewardsList']
        self.assertEqual(project(self.public(), clean, SOURCE, LABELS), result)

    def test_wire_resource_cost_and_exact_native_name(self):
        labels = dict(LABELS, items={('inv', 'key'): 'PURIFIED TEMPORAL SHARD'})
        native = dict(barrierType='redeemer', cost=[dict(t='inv', n='key', q=5, claimed=True)],
                      startingState=True, countOperator='gte')
        result = gate_definition('gate', native, labels, SOURCE, wire=True)
        self.assertEqual(result['label'], 'Requires 5 PURIFIED TEMPORAL SHARD')
        self.assertEqual(result['constraints']['costs'], [dict(sourceIndex=0, type='inv', data='key', quantity=5)])
        self.assertNotIn('startingState', json.dumps(result))

    def test_source_barrier_or_coordinate_drift_is_rejected(self):
        source = dict(walkableTiles=[dict(x=1, y=2, barrier='gate', tileEntities=[dict(bossId='boss', allBuffs=[])])])
        self.assertEqual(sum(validate_source_tiles(self.public(), source, False).values()), 1)
        source['walkableTiles'][0]['barrier'] = 'different'
        with self.assertRaisesRegex(ValueError, 'barrier position differs'):
            validate_source_tiles(self.public(), source, False)
        source['walkableTiles'][0]['x'] = 3
        with self.assertRaisesRegex(ValueError, 'coordinates differ'):
            validate_source_tiles(self.public(), source, False)

    def test_wrong_quest_map_or_reward_coordinate_fails_closed(self):
        for field in ('qid', 'mapId'):
            quest = self.quest(); quest[field] = 'different'
            with self.assertRaisesRegex(ValueError, 'identity mismatch'):
                project(self.public(), quest, SOURCE, LABELS)
        quest = self.quest()
        quest['pathBasedRewardsList'] = [dict(x=8, y=9, items=[])]
        with self.assertRaisesRegex(ValueError, 'coordinate absent'):
            project(self.public(), quest, SOURCE, LABELS)

    def test_missing_reward_field_is_unknown_and_empty_capture_is_known(self):
        quest = self.quest(); del quest['pathBasedRewardsList']
        self.assertEqual(project(self.public(), quest, SOURCE, LABELS)['coverage']['pathRewards'], 'uncaptured')
        self.assertEqual(project(self.public(), self.quest(), SOURCE, LABELS)['coverage']['pathRewards'], 'captured')

    def test_mausoleum_exact_four_native_rewards_and_paths(self):
        for number, tier, quantity in [('01', 't6', 50), ('02', 't7', 10)]:
            qid = 'me_mausoleum_ch01_q' + number
            public = json.loads((REPO / 'src/data/game-quests/permanent-maps' / (qid + '.json')).read_bytes())
            raw = json.loads((DEFAULT_SUPPLEMENT / 'permanent-20261109/maps' / (qid + '.json')).read_bytes())
            result = project(public, raw['quest'], SOURCE, LABELS)
            self.assertEqual([p['coordinate'] for p in result['pathRewards']], [[4, 15], [7, 9], [9, 7], [15, 4]])
            self.assertEqual(len(result['pathRewards']), 4)
            for placement in result['pathRewards']:
                self.assertEqual(placement['rewards'][0]['data'], 'deathless_signature_stone_' + tier)
                self.assertEqual(placement['rewards'][0]['quantity'], quantity)
                self.assertTrue(placement['pathIndices'])


if __name__ == '__main__':
    unittest.main()
