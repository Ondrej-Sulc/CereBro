"""Portable Event Tower checks. No live reader imports, client, credentials or network."""
import contextlib
import copy
import hashlib
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import build_event_towers as exporter


def catalog():
    return {'format': 'cerebro.public-event-tower-catalog.v1',
            'capturedAt': '2026-11-10T08:00:00+00:00',
            'source': {'readerSha256': 'a' * 64, 'layoutSha256': 'b' * 64},
            'towers': [{'Id': identity, 'FriendlyName': f'EXACT NAME {identity}', 'Category': 2,
                        'NumBlocks': 1, 'NumFloors': 1, 'EndTime': 1795024800,
                        'TowerPanelTexture': 'https://example.invalid/source-bound.jpg',
                        'TowerVisualDataId': 'source-visual', 'LocalizedLockedDescription': '',
                        'DateConditions': []} for identity in exporter.TOWERS]}


def capture():
    return {'format': 'cerebro.public-server-tower-block.v1', 'capturedAt': '2026-11-10T08:00:00Z',
            'requestedTowerId': exporter.TOWERS[0], 'requestedBlockId': 1,
            'responseSha256': 'c' * 64, 'readerSha256': 'd' * 64,
            'blocks': [{'towerId': exporter.TOWERS[0], 'id': 1, 'numFloors': 1,
                        'rewards': [{'type': 'res', 'id': 'exact-reward', 'q': 7}],
                        'ratingRewards': [{'type': 'gsi', 'id': 'exact-score', 'q': 2}],
                        'heroRestrictions': {'tags': ['exact-tag']},
                        'floorCost': [{'type': 'res', 'id': 'exact-cost', 'q': 1}],
                        'topBuffs': ['exact-rule'], 'buffs': [{'id': 'exact-rule', 'q': 9}]}],
            'floors': [{'towerId': exporter.TOWERS[0], 'blockId': 1, 'id': '1',
                        'rewards': [], 'buffs': [{'id': 'exact-modifier', 'q': 3}],
                        'bossData': {'bid': 'exact_blueprint', 'ascensionTier': 11, 'rank': 6,
                                     'level': 50, 'sig_lvl': 200, 'hp': 1, 'max_hp': 123456,
                                     'attack': 8765, 'challenge_rating': 250}}]}


BLUEPRINTS = {'exact_blueprint': {'Character': 'exact_character', 'Rarity': 7, '_heroClass': 'skill'}}


def project(row):
    return exporter.project_block(row, 'e' * 64, BLUEPRINTS, {exporter.TOWERS[0]: 1})


class EventTowerTests(unittest.TestCase):
    def test_exact_end_iso_observation_and_no_inferred_start_or_availability(self):
        source = catalog()
        rows = exporter.catalog_towers(source, 'f' * 64, {})
        for native, row in zip(source['towers'], rows):
            self.assertEqual(row['name'], native['FriendlyName'])
            self.assertEqual(row['endsAt'], '2026-11-18T18:00:00Z')
            self.assertIsNone(row['startsAt'])
            self.assertEqual(row['observedAt'], source['capturedAt'])
            self.assertEqual(row['source']['nativeData'], native)
            self.assertEqual(row['archiveStatus'], 'unknown')
            self.assertEqual(row['availabilityStatus'], 'unknown')
            self.assertFalse(row['source']['currentAccessEstablished'])
            self.assertEqual(row['capturedBlockNumbers'], [])

    def test_native_negative_end_preserved_without_permanence_claim(self):
        source = catalog(); source['towers'][0]['EndTime'] = -1
        row = exporter.catalog_towers(source, 'f' * 64, {})[0]
        self.assertIsNone(row['endsAt'])
        self.assertEqual(row['source']['nativeData']['EndTime'], -1)
        self.assertEqual(row['availabilityStatus'], 'unknown')

    def test_native_date_strings_timezone_and_or_are_retained_without_evaluation(self):
        source = catalog()
        condition = {'ConditionType': 'start', 'DateTime': 'native,date,syntax', 'TimeZone': 'native-zone',
                     'Or': True, 'GUID': 'public-condition', '_duration': 42, '_interval': 17}
        source['towers'][0]['DateConditions'] = [condition]
        row = exporter.catalog_towers(source, 'f' * 64, {})[0]
        self.assertEqual(row['dates']['nativeDateConditions'], [condition])
        self.assertIsNone(row['startsAt'])

    def test_catalog_rejects_missing_duplicate_guessed_wrong_category_and_bad_counts(self):
        mutations = [lambda x: x['towers'].pop(),
                     lambda x: x['towers'].append(copy.deepcopy(x['towers'][0])),
                     lambda x: x['towers'][0].update(Id='event_guessed'),
                     lambda x: x['towers'][0].update(Category=1),
                     lambda x: x['towers'][0].update(NumBlocks=0),
                     lambda x: x['towers'][0].update(NumFloors=True),
                     lambda x: x['towers'][0].update(EndTime=True)]
        for mutate in mutations:
            source = catalog(); mutate(source)
            with self.subTest(mutate=mutate), self.assertRaises(ValueError):
                exporter.catalog_towers(source, 'f' * 64, {})

    def test_artwork_requires_exact_source_binding(self):
        with self.assertRaises(ValueError):
            exporter.catalog_towers(catalog(), 'f' * 64,
                                    {exporter.TOWERS[0]: {'sourceUrl': 'https://example.invalid/guessed.jpg'}})

    def test_block_keeps_rewards_cost_restrictions_modifiers_and_wire_floor(self):
        source = capture(); row = project(source)
        self.assertEqual(row['blockData'], source['blocks'][0])
        self.assertEqual(row['floors'][0]['sourceData'], source['floors'][0])
        self.assertEqual(row['floors'][0]['floorNumber'], 1)
        self.assertEqual(row['floors'][0]['sourceData']['id'], '1')
        self.assertFalse(row['coverage']['currentAccessOrEligibilityEstablished'])

    def test_exact_blueprint_high_ascension_and_current_vs_max_hp(self):
        enemy = project(capture())['floors'][0]['defender']
        self.assertEqual(enemy, {'blueprint': 'exact_blueprint', 'gameId': 'exact_character',
            'rarity': 7, 'classId': 'skill', 'rank': 6, 'level': 50, 'signature': 200,
            'ascensionTier': 11, 'health': 1, 'maxHealth': 123456, 'attack': 8765, 'challengeRating': 250})

    def test_missing_or_suffix_similar_blueprints_never_guessed(self):
        for bid in [None, '', 'exact_blueprint_variant', 'exact_character']:
            source = capture(); source['floors'][0]['bossData']['bid'] = bid
            with self.subTest(bid=bid), self.assertRaises(ValueError):
                project(source)

    def test_rejects_duplicate_gapped_missing_and_cross_parent_floors(self):
        mutations = [lambda x: x['floors'].append(copy.deepcopy(x['floors'][0])),
                     lambda x: x.update(floors=[]),
                     lambda x: x['floors'][0].update(id='2'),
                     lambda x: x['floors'][0].update(blockId=2),
                     lambda x: x['floors'][0].update(towerId=exporter.TOWERS[1]),
                     lambda x: x.update(requestedBlockId=2),
                     lambda x: x.update(requestedTowerId='event_guessed')]
        for mutate in mutations:
            source = capture(); mutate(source)
            with self.subTest(mutate=mutate), self.assertRaises(ValueError):
                project(source)

    def test_private_and_unknown_fields_rejected_at_public_boundaries(self):
        for mutate in [lambda x: x['blocks'][0].update(userFloors=[]),
                       lambda x: x['blocks'][0]['rewards'][0].update(balance=1),
                       lambda x: x['floors'][0].update(unknownData={}),
                       lambda x: x['floors'][0]['bossData'].update(owned=True)]:
            source = capture(); mutate(source)
            with self.subTest(mutate=mutate), self.assertRaises(ValueError):
                project(source)

    def test_offline_session_failure_exports_only_verified_catalog_and_zero_blocks(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder); source = root / 'source'; source.mkdir()
            bp = root / 'blueprints.json'
            bp.write_text(json.dumps([{'Blueprint': 'exact_blueprint', **BLUEPRINTS['exact_blueprint']}]))
            exporter.write(source / 'public-catalog.json', catalog())
            exporter.write(source / 'art-receipts.json', {})
            exporter.write(source / 'event-block-receipts.json', [{'towerId': exporter.TOWERS[0],
                'blockRequested': 1, 'status': 200, 'error': 'ID_SPARX_ERROR_SESSION', 'saved': False}])
            outcome = {'format': 'cerebro.event-tower-collection-outcome.v1',
                'receiptSha256': exporter.sha(source / 'event-block-receipts.json'), 'planned': 2,
                'completed': 0, 'credentialsLoggedOrSaved': False, 'outcome': 'session-unavailable',
                'stopReason': 'ID_SPARX_ERROR_SESSION', 'readerSha256': 'd' * 64, 'networkRequestsThisRun': 1}
            exporter.write(source / 'collection-outcome.json', outcome)
            with patch.object(exporter, 'BLUEPRINT_SHA', exporter.sha(bp)), contextlib.redirect_stdout(io.StringIO()):
                exporter.build(source, root / 'out', bp)
            index = json.loads((root / 'out/manifest.json').read_text())
            self.assertEqual(index['blocks'], {})
            self.assertFalse(index['coverage']['observedEventDefinitionsComplete'])
            self.assertEqual(len(index['coverage']['missingBlocks']), 2)
            self.assertEqual(index['coverage']['floors'], 0)
            outcome.update(outcome='complete')
            exporter.write(source / 'collection-outcome.json', outcome)
            with patch.object(exporter, 'BLUEPRINT_SHA', exporter.sha(bp)), self.assertRaises(ValueError):
                exporter.build(source, root / 'bad', bp)

    def test_published_catalog_exact_dates_hashes_art_and_explicit_missing_range(self):
        repo = Path(__file__).resolve().parents[2]
        root = repo / 'src/data/game-quests/tower-events'
        index = json.loads((root / 'manifest.json').read_text(encoding='utf-8'))
        self.assertEqual(index['observedAt'], index['towers'][0]['source']['capturedAt'])
        self.assertEqual([(row['id'], row['name'], row['endsAt']) for row in index['towers']], [
            ('event_castellan_5', 'DOOM TOWER', '2026-11-18T18:00:00Z'),
            ('event_ggsfa1', 'GREEN GOBLIN (STELLAR-FORGED) TOWER', '2026-12-09T18:00:00Z')])
        expected = {(row['id'], number) for row in index['towers'] for number in row['blockNumbers']}
        captured = {(row['towerId'], row['blockNumber']) for row in index['blocks'].values()}
        missing = {(row['towerId'], row['blockNumber']) for row in index['coverage']['missingBlocks']}
        self.assertEqual(captured | missing, expected)
        self.assertFalse(captured & missing)
        self.assertEqual(len(expected), 12)
        self.assertEqual(index['coverage']['configuredFloors'], 63)
        self.assertEqual(index['coverage']['blocks'], 12)
        self.assertEqual(index['coverage']['floors'], 63)
        self.assertEqual(index['coverage']['perTowerFloors'], {'event_castellan_5': 61, 'event_ggsfa1': 2})
        self.assertTrue(index['coverage']['observedEventDefinitionsComplete'])
        self.assertEqual(index['acquisition']['status'], 'complete')
        self.assertIsNone(index['acquisition']['stopReason'])
        self.assertEqual(index['coverage']['missingBlocks'], [])
        for row in index['towers']:
            self.assertIsNone(row['startsAt'])
            self.assertEqual(row['dates']['nativeDateConditions'], [])
            self.assertEqual(row['availabilityStatus'], 'unknown')
            art = row['artwork']; path = repo / 'web/public' / art['url'].lstrip('/')
            self.assertEqual(exporter.sha(path), art['sha256'])
            self.assertEqual(path.stat().st_size, art['bytes'])
            self.assertEqual((art['width'], art['height']), (326, 659))
            self.assertEqual(art['sourceUrl'], row['source']['nativeData']['TowerPanelTexture'])
            self.assertEqual(row['capturedBlockNumbers'], row['blockNumbers'])
        floors = 0
        memberships = set()
        for key, meta in index['blocks'].items():
            path = root / meta['path']; self.assertTrue(path.resolve().is_relative_to(root.resolve()))
            self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), meta['sha256'])
            row = json.loads(path.read_text(encoding='utf-8'))
            self.assertEqual(row['id'], key)
            self.assertEqual(row['declaredFloorCount'], meta['floors'])
            self.assertEqual(len(row['floors']), meta['floors'])
            self.assertEqual([f['floorNumber'] for f in row['floors']], list(range(1, meta['floors'] + 1)))
            self.assertEqual((row['towerId'], row['blockNumber']), (meta['towerId'], meta['blockNumber']))
            for floor in row['floors']:
                native = floor['sourceData']; boss = native['bossData']; enemy = floor['defender']
                identity = (key, floor['floorNumber'])
                self.assertNotIn(identity, memberships); memberships.add(identity)
                self.assertEqual(native['towerId'], row['towerId'])
                self.assertEqual(int(native['blockId']), row['blockNumber'])
                self.assertEqual(int(native['id']), floor['floorNumber'])
                self.assertEqual(enemy['blueprint'], boss['bid'])
                self.assertTrue(enemy['gameId'])
                for projected, source in [('rank', 'rank'), ('level', 'level'), ('signature', 'sig_lvl'),
                    ('ascensionTier', 'ascensionTier'), ('health', 'hp'), ('maxHealth', 'max_hp'),
                    ('attack', 'attack'), ('challengeRating', 'challenge_rating')]:
                    self.assertEqual(enemy[projected], boss.get(source))
            exporter.reject_private(row)
            floors += len(row['floors'])
        self.assertEqual(floors, index['coverage']['floors'])
        exporter.reject_private(index)

    def test_complete_synthetic_capture_has_exact_floor_totals_hashes_and_literal_loaders(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder); source = root / 'source'; source.mkdir()
            bp = root / 'blueprints.json'
            bp.write_text(json.dumps([{'Blueprint': 'exact_blueprint', **BLUEPRINTS['exact_blueprint']}]))
            exporter.write(source / 'public-catalog.json', catalog())
            exporter.write(source / 'art-receipts.json', {})
            receipts = []
            for identity in exporter.TOWERS:
                row = capture(); row['requestedTowerId'] = identity
                row['blocks'][0]['towerId'] = identity
                row['floors'][0]['towerId'] = identity
                path = source / 'event-blocks' / f'{identity}-001.json'
                exporter.write(path, row)
                receipts.append({'towerId': identity, 'blockRequested': 1, 'status': 200, 'error': False,
                    'saved': True, 'publicShardSha256': exporter.sha(path), 'responseSha256': row['responseSha256']})
            exporter.write(source / 'event-block-receipts.json', receipts)
            exporter.write(source / 'collection-outcome.json', {
                'format': 'cerebro.event-tower-collection-outcome.v1', 'planned': 2, 'completed': 2,
                'receiptSha256': exporter.sha(source / 'event-block-receipts.json'),
                'credentialsLoggedOrSaved': False, 'outcome': 'complete', 'stopReason': None,
                'readerSha256': 'd' * 64, 'networkRequestsThisRun': 2})
            with patch.object(exporter, 'BLUEPRINT_SHA', exporter.sha(bp)), contextlib.redirect_stdout(io.StringIO()):
                exporter.build(source, root / 'out', bp)
            index = json.loads((root / 'out/manifest.json').read_text())
            self.assertTrue(index['coverage']['observedEventDefinitionsComplete'])
            self.assertEqual(index['coverage']['floors'], 2)
            self.assertEqual(index['coverage']['missingBlocks'], [])
            loaders = (root / 'out/index.js').read_text()
            for key, meta in index['blocks'].items():
                self.assertIn(f'"{key}": () => import("./{meta["path"]}")', loaders)
                self.assertEqual(exporter.sha(root / 'out' / meta['path']), meta['sha256'])
                row = json.loads((root / 'out' / meta['path']).read_text())
                self.assertEqual(row['floors'][0]['defender']['health'], 1)
                self.assertEqual(row['floors'][0]['defender']['maxHealth'], 123456)


if __name__ == '__main__':
    unittest.main()
