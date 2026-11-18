import copy
import unittest

from build_quest_details import champion_requirement, preparation, project

SOURCE = dict(file='frozen/map.json', sha256='a' * 64, pointer='/quest', capturedAt='2026-11-09T00:00:00Z')
LABELS = dict(tags={'tg_deathless': 'Deathless'}, classes={'mutant': 'Mutant'}, characters={'hero': 'Example Hero'})


class QuestDetailsTests(unittest.TestCase):
    def fixture(self):
        public = dict(questId='q', mapId='m', sourceHash=SOURCE['sha256'], tiles=[dict(coordinate=[1, 2])],
                      paths=[dict(index=0, coordinates=[[1, 2]]), dict(index=1, coordinates=[[1, 2]])])
        quest = dict(qid='q', mapId='m', energyPerTile=2, teamSizeMin=1, teamSizeMax=0, recommendedPartyPI=12062,
                     championRestrictions='tg_deathless:t6,tg_deathless:t7', chests={'c': 'object_chest_level03'})
        source_map = dict(walkableTiles=[dict(x=1, y=2, item='c')])
        return public, quest, source_map

    def test_groups_are_alternatives_and_terms_all_required(self):
        self.assertEqual(champion_requirement('tg_deathless:t6,tg_deathless:t7', LABELS),
                         dict(groups=[['tg_deathless', 't6'], ['tg_deathless', 't7']],
                              label='Each champion: (Deathless and 6\u2605) or (Deathless and 7\u2605)', resolved=True))
        self.assertEqual(champion_requirement('!mutant:hero', LABELS)['label'], 'Each champion: not Mutant and Example Hero')

    def test_unknown_restriction_is_retained_without_a_guessed_label(self):
        result = champion_requirement('unknown:t7', LABELS)
        self.assertFalse(result['resolved'])
        self.assertEqual(result['groups'], [['unknown', 't7']])
        self.assertEqual(result['label'], 'Champion requirements not captured')

    def test_zero_team_limit_missing_fields_and_exceptional_ratings_are_omitted(self):
        result = preparation(dict(energyPerTile=0, teamSizeMax=0, recommendedPartyPI=9999999), SOURCE, LABELS)
        self.assertEqual(result, dict(energyPerTile=0, source=SOURCE))
        self.assertEqual(preparation({}, SOURCE, LABELS), dict(source=SOURCE))
        for exceptional in [9999999, 99999999]:
            self.assertNotIn('recommendedTeamRating', preparation(dict(recommendedPartyPI=exceptional), SOURCE, LABELS))
        for recorded in [99999, 999999, 250000]:
            self.assertEqual(preparation(dict(recommendedPartyPI=recorded), SOURCE, LABELS)['recommendedTeamRating'], recorded)

    def test_chest_preserves_exact_source_position_asset_and_shared_route_membership(self):
        public, quest, source_map = self.fixture()
        result = project(public, quest, source_map, SOURCE, LABELS)
        self.assertEqual(result['chestCoverage'], 'captured')
        self.assertEqual(result['chests'], [dict(id='q:chest:1,2:c', coordinate=[1, 2], pathIndices=[0, 1], chestId='c',
                         asset='object_chest_level03', source=dict(SOURCE, pointer='/map/walkableTiles/0/item'))])
        del quest['chests']['c']
        self.assertIsNone(project(public, quest, source_map, SOURCE, LABELS)['chests'][0]['asset'])

    def test_wire_missing_item_field_is_uncaptured_and_exact_binding_if_present(self):
        public, quest, _ = self.fixture()
        quest['chestTable'] = {'c': dict(asset='object_chest_book2_level01', id='redeemer', persistent=False)}
        source_map = dict(grid=[[dict(x=1, y=2, walkable=True)]])
        self.assertEqual(project(public, quest, source_map, SOURCE, LABELS, True)['chestCoverage'], 'uncaptured')
        source_map['grid'][0][0]['item'] = 'c'
        result = project(public, quest, source_map, SOURCE, LABELS, True)
        self.assertEqual(result['chestCoverage'], 'captured')
        self.assertEqual(result['chests'][0]['asset'], 'object_chest_book2_level01')
        self.assertEqual(result['chests'][0]['source']['pointer'], '/map/grid/0/0/item')

    def test_projection_ignores_account_collection_and_contents_fields(self):
        public, quest, source_map = self.fixture()
        expected = project(public, quest, source_map, SOURCE, LABELS)
        native = copy.deepcopy(quest)
        native.update(collectedPathBasedRewardsList=['private'], claimedPersistentChests=['private'], playerId='private',
                      progress={'private': True}, inventory=['private'], eligible=True)
        source_map['walkableTiles'][0].update(claimed=True, contents=['private'], spawnedItems=['private'])
        self.assertEqual(project(public, native, source_map, SOURCE, LABELS), expected)

    def test_foreign_identity_duplicate_or_invented_coordinate_is_rejected(self):
        public, quest, source_map = self.fixture()
        quest['qid'] = 'other'
        with self.assertRaisesRegex(ValueError, 'identity mismatch'):
            project(public, quest, source_map, SOURCE, LABELS)
        quest['qid'] = 'q'
        source_map['walkableTiles'][0]['x'] = 9
        with self.assertRaisesRegex(ValueError, 'coordinates differ'):
            project(public, quest, source_map, SOURCE, LABELS)
        source_map['walkableTiles'] *= 2
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            project(public, quest, source_map, SOURCE, LABELS)


if __name__ == '__main__':
    unittest.main()
