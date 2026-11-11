"""Contract checks for the offline, versioned assignment expansion."""
import copy
import hashlib
import json
import unittest
from pathlib import Path

from build_mcoc_node_expansion import FROZEN, definition_version, display_text
from diff_mcoc_node_expansion import diff, dry_run

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT/'src/data/game-node-modifiers'


class ExpansionTests(unittest.TestCase):
    def test_diff_and_reconciliation_preserve_unlinked_curated_rows_and_propose_no_writes(self):
        index = dict(contract='cerebro.node-modifier-index/v2', profileHash='source-a', records=[dict(id='native-a', versionHashes=['v-a'], detailSha256='d-a')])
        before = copy.deepcopy(index)
        changed = copy.deepcopy(index)
        changed['records'][0]['detailSha256'] = 'd-b'
        changed['profileHash'] = 'source-b'
        self.assertEqual(diff(index, changed), dict(added=[], removed=[], changed=['native-a'], provenanceChanged=True, writes=[]))
        curated = [dict(id='existing-cuid', name='Same title', description='Keep exactly')]
        result = dry_run(index, curated, [])
        self.assertEqual(result['writes'], [])
        self.assertEqual(result['unboundCuratedIds'], ['existing-cuid'])
        self.assertEqual(result['preservedCuratedRecords'], curated)
        self.assertEqual(index, before)

    def test_versions_preserve_parameters_components_and_bcg_revision(self):
        raw = dict(id='exact', localizedName='Same title', buffType='statMods', valueStr=['first', 'missing'], quantity=2)
        components = dict(first=dict(ID='first', Modifier=0.2))
        first = definition_version(raw, components, 'a'*64)
        self.assertEqual(first['missingComponentIds'], ['missing'])
        self.assertEqual(first['raw'], raw)
        for changed, source, bcg in [(dict(raw, quantity=3), components, 'a'*64),
                                     (raw, dict(first=dict(ID='first', Modifier=0.4)), 'a'*64),
                                     (raw, components, 'b'*64)]:
            self.assertNotEqual(first['hash'], definition_version(changed, source, bcg)['hash'])
        self.assertEqual(first, definition_version(copy.deepcopy(raw), copy.deepcopy(components), 'a'*64))

    def test_unresolved_templates_are_not_presented_as_resolved_values(self):
        self.assertEqual(display_text('[FF0000]20%[-] attack'), '20% attack')
        self.assertEqual(display_text('{1}% attack'), '')

    def test_original_source_artifacts_remain_frozen(self):
        for name, expected in FROZEN.items():
            self.assertEqual(hashlib.sha256((DATA/name).read_bytes()).hexdigest(), expected)

    def test_disarray_preserves_distinct_sources_without_equating_assignments_with_activation(self):
        path = DATA/'v2/details'/(hashlib.sha256(b'pve_disarray').hexdigest()+'.json')
        detail = json.loads(path.read_text(encoding='utf8'))
        uses = detail['projection']['uses']
        culmination = next(q['key'] for q in detail['projection']['quests'] if q.get('storyNumber') == '4.4.6')
        self.assertEqual(sum(u['questKey'] == culmination for u in uses), 6)
        self.assertGreater(len(uses), 6)
        self.assertEqual(len({u['id'] for u in uses}), len(uses))
        for use in uses:
            self.assertIn(use['versionHash'], [v['hash'] for v in detail['definition']['versions']])
            self.assertTrue(use['assignments'])
            self.assertTrue(all(a['target'] == use['side'] for a in use['assignments']))
            self.assertNotIn('active', use)

    def test_native_portraits_and_public_links_use_exact_game_ids(self):
        projection = json.loads((DATA/'v2/portraits.json').read_text(encoding='utf8'))
        self.assertEqual(len(projection['bindings']), 409)
        for game_id, row in projection['bindings'].items():
            self.assertEqual(row['gameId'], game_id)
            if row['status'] == 'verified':
                asset = ROOT/'web/public'/row['src'].lstrip('/')
                self.assertEqual(hashlib.sha256(asset.read_bytes()).hexdigest(), row['sha256'])
        self.assertIsNone(projection['bindings']['maestro'].get('public'))


if __name__ == '__main__':
    unittest.main()
