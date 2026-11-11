import copy
import unittest
import json
from pathlib import Path

from extract_mcoc_node_modifiers import build_definitions
from project_mcoc_node_uses import project_uses, quest_label


def app(role='Local', source=(1, 2)):
    return {'buff': {'id': 'effect', 'localizedName': 'Effect'}, 'buffDescription': '20% effect',
            'buffAmount': 1, 'sourceCoordinate': {'x': source[0], 'y': source[1]},
            'nodeSource': {'type': {'name': role, 'value': 2}, 'attk': False, 'remainActive': False}}


class NodeUseTests(unittest.TestCase):
    def fixture(self):
        a = app('Link')
        quest = {'qid': 'opaque-native-id', 'mapId': 'opaque-map', 'category': {'name': 'Story'},
                 'actIndex': 4, 'chapterIndex': 4, 'questIndex': 6, 'friendlyName': '6. Culmination',
                 'difficulty': '', 'difficultyId': '', 'bosses': {'origin': {'blueprint': 'bp-a'}, 'target': {'blueprint': 'bp-b'}}}
        tiles = [dict(x=1, y=2, nodeNumber=3, bossId='origin', sourceAllBuffs=[a], sourceLinkBuffs=[a], defenderBuffs=[]),
                 dict(x=3, y=4, nodeNumber=5, bossId='target', sourceAllBuffs=[], defenderBuffs=[a])]
        document = {'quest': quest, 'map': {'walkableTiles': tiles}, 'pveSets': [{'Acts': [{'displayIndex': 4, 'actId': 'act', 'Chapters': [{'chapterId': 'chapter', 'friendlyName': 'Devastation', 'Quests': [quest]}]}]}]}
        definitions = build_definitions([('sample', '/map', document['map'])], {})
        catalog = {'contentHash': 'catalog-hash', 'profile': {'inputs': [{'id': 'sample', 'path': 'sample.json', 'sha256': 'source-hash', 'pointers': ['/map']}]}, 'definitions': definitions}
        return catalog, {'sample': document}, {'bp-a': {'Character': 'a'}, 'bp-b': {'Character': 'b'}}, {'a': 'Origin champion', 'b': 'Affected champion'}

    def test_native_hierarchy_number_not_id_suffix(self):
        catalog, sources, _, _ = self.fixture()
        row = quest_label(sources['sample']['quest'], sources)
        self.assertEqual(row['storyNumber'], '4.4.6')
        self.assertEqual(row['name'], 'Culmination')
        self.assertEqual(row['chapter'], 'Devastation')
        sources['sample']['pveSets'][0]['Acts'][0]['displayIndex'] = 99
        self.assertEqual(quest_label(sources['sample']['quest'], sources)['storyNumber'], '4.4.6')
        self.assertEqual(quest_label(sources['sample']['quest'], sources)['labelEvidence']['memberships'][0]['actDisplayIndex'], 99)
        changed = copy.deepcopy(sources['sample']['quest']); changed['qid'] = 'a09_ch09_q09'
        self.assertIsNone(quest_label(changed, sources)['storyNumber'])

    def test_source_origin_is_not_affected_fight_and_aliases_deduplicate(self):
        catalog, sources, bps, names = self.fixture()
        result = project_uses(catalog, sources, bps, names)
        self.assertEqual(len(result['uses']), 1)
        use = result['uses'][0]
        self.assertEqual(use['sourceNode']['defenders'][0]['name'], 'Origin champion')
        self.assertEqual(use['affectedNodes'][0]['defenders'][0]['name'], 'Affected champion')
        self.assertEqual(use['sourceNode']['nodeNumber'], 3)
        self.assertEqual(use['affectedNodes'][0]['nodeNumber'], 5)
        self.assertEqual(len(use['sourcePointers']), 2)
        self.assertEqual(use['role'], 'Link')
        self.assertNotIn('active', use)

    def test_no_propagation_from_link_targets_or_unplaced_boss_definitions(self):
        catalog, sources, bps, names = self.fixture()
        sources['sample']['map']['walkableTiles'][1]['defenderBuffs'] = []
        sources['sample']['quest']['bosses']['unplaced'] = {'blueprint': 'bp-b'}
        use = project_uses(catalog, sources, bps, names)['uses'][0]
        self.assertEqual(use['affectedNodes'], [])

    def test_same_name_other_buff_and_stale_application_do_not_join(self):
        catalog, sources, bps, names = self.fixture()
        sources['sample']['map']['walkableTiles'][1]['defenderBuffs'][0] = app()
        sources['sample']['map']['walkableTiles'][1]['defenderBuffs'][0]['buffAmount'] = 2
        with self.assertRaisesRegex(ValueError, 'Unbound application'):
            project_uses(catalog, sources, bps, names)

    def test_missing_blueprint_or_localization_stays_unknown(self):
        catalog, sources, _, _ = self.fixture()
        use = project_uses(catalog, sources, {}, {})['uses'][0]
        self.assertIsNone(use['affectedNodes'][0]['defenders'][0]['name'])
        self.assertIsNone(use['affectedNodes'][0]['defenders'][0]['gameId'])

    def test_deterministic_non_mutating_projection_and_explicit_difficulty(self):
        catalog, sources, bps, names = self.fixture()
        before = copy.deepcopy([catalog, sources])
        self.assertEqual(project_uses(catalog, sources, bps, names), project_uses(catalog, sources, bps, names))
        self.assertEqual([catalog, sources], before)
        quest = sources['sample']['quest']; quest['difficultyId'] = 'd2'
        sources['sample']['pveSets'][0]['QuestSummarys'] = {quest['qid']: quest}
        sources['sample']['pveSets'][0]['difficulties'] = {'d2': {'minPRG': 4, 'maxPRG': 4}}
        self.assertEqual(quest_label(quest, sources)['difficulty'], 'Progression rank 4')

    def test_bundled_projection_has_intact_hashes_and_exact_application_joins(self):
        from extract_mcoc_node_modifiers import digest_json
        root = Path(__file__).resolve().parents[1]/'src/data/game-node-modifiers'
        uses = json.loads((root/'uses.json').read_text(encoding='utf-8'))
        catalog = json.loads((root/'catalog.json').read_text(encoding='utf-8'))
        self.assertEqual(uses['contentHash'], digest_json({k: v for k, v in uses.items() if k != 'contentHash'}))
        self.assertEqual(uses['modifierCatalogHash'], catalog['contentHash'])
        self.assertEqual(uses['provenance']['inputs'], catalog['profile']['inputs'])
        identities = {(d['id'], v['hash'], a['hash']) for d in catalog['definitions'] for v in d['versions'] for a in v['applications']}
        self.assertEqual({(u['effectId'], u['versionHash'], u['applicationHash']) for u in uses['uses']}, identities)
        self.assertEqual(len(uses['quests']), 5)
        self.assertNotIn('paths', uses)


if __name__ == '__main__':
    unittest.main()
