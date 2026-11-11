"""Portable Challenge Tower identity, privacy and source projection regression checks."""
import copy
import hashlib
import json
import unittest
from pathlib import Path

from build_challenge_towers import catalog_towers, project_block


def catalog():
    return {'format': 'cerebro.public-challenge-tower-catalog.v1', 'capturedAt': '2026-11-10T08:00:00Z',
            'source': {'readerSha256': 'a'*64, 'layoutSha256': 'b'*64},
            'towers': [{'Id': 'exact_observed_id', 'FriendlyName': 'EXACT NATIVE NAME', 'Category': 1,
                        'NumBlocks': 2, 'NumFloors': 2, 'EndTime': -1,
                        'TowerPanelTexture': '', 'LocalizedLockedDescription': 'Native condition'}]}


def capture():
    return {'format': 'cerebro.public-server-tower-block.v1', 'capturedAt': '2026-11-10T08:00:00Z',
            'requestedTowerId': 'exact_observed_id', 'requestedBlockId': 1,
            'responseSha256': 'c'*64, 'readerSha256': 'd'*64,
            'blocks': [{'towerId': 'exact_observed_id', 'id': 1, 'numFloors': 1, 'rewards': []}],
            'floors': [{'towerId': 'exact_observed_id', 'blockId': 1, 'id': '1',
                        'bossData': {'bid': 'exact_blueprint', 'ascensionTier': 11, 'rank': 6}}]}


class ChallengeTowerTests(unittest.TestCase):
    def test_native_name_range_and_unknown_archive_status(self):
        row = catalog_towers(catalog(), 'e'*64, {})[0]
        self.assertEqual((row['id'], row['name'], row['blockNumbers']),
                         ('exact_observed_id', 'EXACT NATIVE NAME', [1, 2]))
        self.assertEqual(row['archiveStatus'], 'unknown')
        self.assertIsNone(row['artwork'])
        self.assertFalse(row['source']['currentAccessEstablished'])

    def test_blueprint_identity_and_numeric_wire_floor(self):
        row = project_block(capture(), 'e'*64, {'exact_blueprint':
            {'Character': 'exact_character', 'Rarity': 7, '_heroClass': 'skill'}}, {'exact_observed_id': 2})
        self.assertEqual(row['floors'][0]['floorNumber'], 1)
        self.assertEqual(row['floors'][0]['sourceData']['id'], '1')
        self.assertEqual(row['floors'][0]['defender']['gameId'], 'exact_character')
        self.assertEqual(row['floors'][0]['defender']['ascensionTier'], 11)

    def test_unobserved_tower_or_block_and_wrong_parent_rejected(self):
        for key, value in [('requestedTowerId', 'guessed_id'), ('requestedBlockId', 3)]:
            row = capture(); row[key] = value
            with self.assertRaises(ValueError): project_block(row, 'a'*64, {}, {'exact_observed_id': 2})
        row = capture(); row['floors'][0]['blockId'] = 2
        with self.assertRaises(ValueError): project_block(row, 'a'*64, {}, {'exact_observed_id': 2})

    def test_duplicates_gaps_and_private_subtrees_rejected(self):
        for mutate in [lambda x: x['floors'].append(copy.deepcopy(x['floors'][0])),
                       lambda x: x.update(floors=[]),
                       lambda x: x['floors'][0].update(skipData={})]:
            row = capture(); mutate(row)
            with self.assertRaises(ValueError): project_block(row, 'a'*64, {}, {'exact_observed_id': 2})

    def test_unknown_blueprint_never_guessed(self):
        row = project_block(capture(), 'a'*64, {}, {'exact_observed_id': 2})
        self.assertIsNone(row['floors'][0]['defender']['gameId'])

    def test_catalog_duplicate_nonchallenge_and_invalid_counts_rejected(self):
        for mutate in [lambda x: x['towers'].append(copy.deepcopy(x['towers'][0])),
                       lambda x: x['towers'][0].update(Category=0),
                       lambda x: x['towers'][0].update(NumBlocks=0)]:
            row = catalog(); mutate(row)
            with self.assertRaises(ValueError): catalog_towers(row, 'a'*64, {})

    def test_published_finite_catalog_hashes_and_all_floor_memberships(self):
        root = Path(__file__).resolve().parents[2]/'src/data/game-quests/tower-challenges'
        index = json.loads((root/'manifest.json').read_text(encoding='utf-8'))
        self.assertEqual([(t['id'], t['blockNumbers']) for t in index['towers']],
                         [('challenge_saga', [1, 2, 3, 4, 5, 6])])
        self.assertEqual(index['coverage']['floors'], 44)
        seen = set(); count = 0
        for key, meta in index['blocks'].items():
            relative = Path(meta['path'])
            self.assertFalse(relative.is_absolute())
            self.assertNotIn('..', relative.parts)
            raw = (root/relative).read_bytes()
            self.assertEqual(hashlib.sha256(raw).hexdigest(), meta['sha256'])
            self.assertEqual(len(raw), meta['bytes'])
            block = json.loads(raw)
            self.assertEqual(key, block['id'])
            self.assertEqual((block['towerId'], block['blockNumber']), (meta['towerId'], meta['blockNumber']))
            self.assertEqual([f['floorNumber'] for f in block['floors']], list(range(1, meta['floors']+1)))
            self.assertEqual(block['declaredFloorCount'], meta['floors'])
            for floor in block['floors']:
                identity = (block['id'], floor['floorNumber'])
                self.assertNotIn(identity, seen); seen.add(identity)
                self.assertEqual(floor['sourceData']['towerId'], block['towerId'])
                self.assertEqual(floor['sourceData']['blockId'], block['blockNumber'])
                self.assertEqual(int(floor['sourceData']['id']), floor['floorNumber'])
                self.assertEqual(floor['defender']['blueprint'], floor['sourceData']['bossData']['bid'])
                self.assertTrue(floor['defender']['gameId'])
                count += 1
        self.assertEqual(count, 44)


if __name__ == '__main__': unittest.main()
