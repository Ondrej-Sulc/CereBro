"""Importer tests use synthetic disclosures only; these are never published as rates."""
import base64
import copy
import hashlib
import tempfile
import unittest
from pathlib import Path

from import_mcoc_crystal_odds import import_disclosures, parse_displayed_percent

PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN9sAAAAASUVORK5CYII=')


def fixture():
    return {'version': 1, 'gachaSha256': 'a'*64, 'captures': [{
        'crystalId': 'fixture', 'displayName': 'FIXTURE CRYSTAL', 'description': 'Fixture description.', 'storeTab': 'Crystals',
        'observedAt': '2026-11-05T12:00:00+00:00', 'timestampBasis': 'snapshot-observed', 'complete': True, 'expectedTotalPercent': '100.00',
        'evidence': [{'file': 'fixture.png', 'sha256': hashlib.sha256(PNG).hexdigest(), 'role': 'odds-tooltip'}],
        'rows': [{'label': '6-Star Hero', 'displayedPercent': '50.00%'}, {'label': '5-Star Nexus Hero Crystal', 'displayedPercent': '50.00%'}],
    }]}


def catalog():
    return {'groups': [{'Name': 'events', 'Set': {'Boxes': [{'Name': 'fixture', '_displayName': {'en': 'FIXTURE CRYSTAL'}, '_description': {'en': 'Fixture description.'}, 'GameSpecificData': {}}]}}]}


class CrystalOddsImportTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        (self.root/'fixture.png').write_bytes(PNG)

    def run_import(self, data=None, definitions=None):
        return import_disclosures(data or fixture(), definitions or catalog(), 'a'*64, self.root)

    def test_imports_source_bound_disclosures_and_keeps_nexus_separate(self):
        result = self.run_import()['disclosures'][0]
        self.assertEqual(result['sourceCrystalId'], 'fixture')
        self.assertEqual(result['sourceMethod'], 'game-ui-transcription')
        self.assertEqual(result['sumValidation'], 'within-display-rounding')
        self.assertEqual(result['rows'][0]['outcomeHint'], {'kind': 'champion-rarity', 'rarity': 6})
        self.assertEqual(result['rows'][1]['outcomeHint'], {'kind': 'nested-crystal', 'rarityHint': 5, 'selectionHint': 'nexus'})
        self.assertEqual(result['rows'][0]['rateBasis'], 'displayed-category')
        self.assertNotIn('championProbability', str(result))

    def test_preserves_prefix_precision_and_partial_capture_without_inventing_remainder(self):
        data = fixture(); capture = data['captures'][0]
        capture.pop('expectedTotalPercent'); capture['complete'] = False
        capture['rows'] = [{'label': 'Rare outcome', 'displayedPercent': '<0.01%'}]
        result = self.run_import(data)['disclosures'][0]
        self.assertEqual(result['rows'][0]['comparison'], 'less-than')
        self.assertEqual(result['rows'][0]['decimalPlaces'], 2)
        self.assertEqual(len(result['rows']), 1)
        self.assertEqual(result['sumValidation'], 'not-requested')
        self.assertFalse(result['captureComplete'])

    def test_rejects_wrong_snapshot_identity_ambiguity_and_unproved_aliases(self):
        data = fixture(); data['gachaSha256'] = 'b'*64
        with self.assertRaises(ValueError): self.run_import(data)
        definitions = catalog(); alias = copy.deepcopy(definitions['groups'][0]['Set']['Boxes'][0]); alias['Name'] = 'alias'
        definitions['groups'][0]['Set']['Boxes'].append(alias)
        with self.assertRaises(ValueError): self.run_import(definitions=definitions)
        alias['GameSpecificData'] = {'Tab': 'Shards'}
        self.assertEqual(self.run_import(definitions=definitions)['disclosures'][0]['sourceCrystalId'], 'fixture')

    def test_rejects_bad_evidence_and_path_traversal(self):
        for name, digest in [('fixture.png', '0'*64), ('../outside.png', hashlib.sha256(PNG).hexdigest())]:
            data = fixture(); data['captures'][0]['evidence'][0].update(file=name, sha256=digest)
            with self.assertRaises(ValueError): self.run_import(data)

    def test_rejects_credentials_wrong_totals_and_unzoned_observations(self):
        for mutate in [lambda data: data.update(sessionToken='must-not-be-exported'), lambda data: data['captures'][0]['rows'].pop(), lambda data: data['captures'][0].update(observedAt='2026-11-05T12:00:00')]:
            data = fixture(); mutate(data)
            with self.assertRaises(ValueError): self.run_import(data)

    def test_rejects_invalid_percentages(self):
        for text in ['NaN%', '-1%', '100.01%', '1e2%', '0.5', '', 'Infinity%']:
            with self.assertRaises(ValueError): parse_displayed_percent(text)

    def test_keeps_display_precision_and_bounds_and_rejects_bad_expected_totals(self):
        self.assertEqual(parse_displayed_percent('≤0.10%')['comparison'], 'at-most')
        self.assertEqual(parse_displayed_percent('≥99.90%')['comparison'], 'at-least')
        self.assertEqual(parse_displayed_percent('0.0100%')['percentValue'], '0.0100')
        for text in ['NaN', 'Infinity', 'not-a-total', '-1', '100.01']:
            data = fixture(); data['captures'][0]['expectedTotalPercent'] = text
            with self.assertRaises(ValueError): self.run_import(data)


if __name__ == '__main__':
    unittest.main()
