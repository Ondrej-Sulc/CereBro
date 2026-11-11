import copy
import unittest
import tempfile
import subprocess
import sys
import json
from pathlib import Path

from extract_mcoc_node_modifiers import build_definitions, catalog_diff, reconciliation_plan


def application(identity='node_a', text='20%', modifier='component_a', side=False):
    return {'buff': {'id': identity, 'localizedName': 'Same name', 'localizedDesc': '{1}%',
                     'buffType': 'statMods', 'valueStr': [modifier], 'quantity': 1},
            'buffDescription': text, 'buffAmount': 1, 'sourceCoordinate': {'x': 2, 'y': 3},
            'nodeSource': {'type': {'name': 'Link', 'value': 1}, 'attk': side, 'remainActive': False}}


class NodeExtractionTests(unittest.TestCase):
    def build(self, rows, components=None):
        return build_definitions([('sample', '/map', rows)], components or {})

    def test_deterministic_identity_versions_and_application_sides(self):
        rows = [application(), application('node_b'), application(side=True), application(text='40%')]
        other = application(); other['buff']['quantity'] = 2; rows.append(other)
        a = self.build(rows)
        self.assertEqual(a, self.build(copy.deepcopy(rows)))
        self.assertEqual([d['id'] for d in a], ['node_a', 'node_b'])
        self.assertEqual(len(a[0]['versions']), 2)
        self.assertEqual(sum(len(v['applications']) for v in a[0]['versions']), 4)

    def test_missing_components_are_not_guessed_or_formatted(self):
        version = self.build([application()])[0]['versions'][0]
        self.assertEqual(version['missingComponentIds'], ['component_a'])
        self.assertEqual(version['raw']['localizedDesc'], '{1}%')
        self.assertEqual(version['applications'][0]['text'], '20%')

    def test_opaque_value_types_do_not_get_bcg_bindings(self):
        app = application(); app['buff']['buffType'] = 'unknown-future-type'
        version = self.build([app], {'component_a': {'ID': 'component_a'}})[0]['versions'][0]
        self.assertEqual(version['componentIds'], [])
        self.assertEqual(version['raw']['valueStr'], ['component_a'])

    def test_source_pin_and_pointer_fail_closed(self):
        from extract_mcoc_node_modifiers import pinned, pointer
        with tempfile.TemporaryDirectory() as folder:
            source = Path(folder)/'capture.json'; source.write_text('{}')
            with self.assertRaisesRegex(ValueError, 'hash mismatch'):
                pinned(source, '0'*64)
        self.assertEqual(pointer({'a/b': {'~': 3}}, '/a~1b/~0'), 3)
        with self.assertRaises(KeyError):
            pointer({'map': {}}, '/map/buff')

    def test_preserves_every_context_field_and_groups_only_exact_duplicates(self):
        local = application(); linked = application()
        local['nodeSource']['type'] = {'name': 'Local', 'value': 2}
        linked['nodeSource']['remainActive'] = True
        definitions = self.build([local, linked, copy.deepcopy(linked)])
        apps = definitions[0]['versions'][0]['applications']
        self.assertEqual(len(apps), 2)
        self.assertEqual(sorted(a['observations'] for a in apps), [1, 2])
        self.assertEqual({a['raw']['nodeSource']['remainActive'] for a in apps}, {False, True})

    def test_component_change_changes_revision_without_losing_raw_definition(self):
        first = self.build([application()], {'component_a': {'ID': 'component_a', 'Modifier': .2}})[0]['versions'][0]
        second = self.build([application()], {'component_a': {'ID': 'component_a', 'Modifier': .4}})[0]['versions'][0]
        self.assertEqual(first['definitionHash'], second['definitionHash'])
        self.assertNotEqual(first['hash'], second['hash'])

    def test_formula_or_inheritance_source_drift_invalidates_version(self):
        rows = [('sample', '/map', [application()])]
        first = build_definitions(rows, {}, 'a'*64)[0]['versions'][0]
        second = build_definitions(rows, {}, 'b'*64)[0]['versions'][0]
        self.assertNotEqual(first['hash'], second['hash'])
        self.assertEqual(first['definitionHash'], second['definitionHash'])

    def test_read_only_diff_and_curated_preservation(self):
        old = {'definitions': self.build([application()])}
        new = {'definitions': self.build([application(text='40%'), application('node_b')])}
        original = copy.deepcopy([old, new])
        diff = catalog_diff(old, new)
        self.assertEqual(diff['added'], ['node_b'])
        self.assertEqual(diff['changed'], ['node_a'])
        records = [{'id': 'cuid1', 'name': 'Same name', 'description': 'Reviewed copy'}]
        before = copy.deepcopy(records)
        plan = reconciliation_plan(new, records, [])
        self.assertEqual(plan['unboundCuratedIds'], ['cuid1'])
        self.assertEqual(plan['writes'], [])
        self.assertEqual(records, before)
        self.assertEqual([old, new], original)

    def test_diff_cli_writes_only_its_report_and_refuses_input_overwrite(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder); source = root/'catalog.json'; report = root/'report.json'
            source.write_text(json.dumps({'definitions': self.build([application()])}))
            before = source.read_bytes()
            command = [sys.executable, str(Path(__file__).with_name('extract_mcoc_node_modifiers.py')),
                       'diff', '--before', str(source), '--after', str(source), '--out']
            subprocess.run(command+[str(report)], check=True, capture_output=True)
            self.assertEqual(json.loads(report.read_text()), {'added': [], 'removed': [], 'changed': [], 'provenanceChanged': False, 'writes': []})
            self.assertNotEqual(subprocess.run(command+[str(source)], capture_output=True).returncode, 0)
            self.assertEqual(source.read_bytes(), before)

    def test_diff_detects_source_version_drift_and_duplicate_identities(self):
        definitions = self.build([application()])
        before = {'profile': {'bcgSha256': 'a'*64}, 'definitions': definitions}
        after = {'profile': {'bcgSha256': 'b'*64}, 'definitions': definitions}
        self.assertTrue(catalog_diff(before, after)['provenanceChanged'])
        after['definitions'] = definitions+definitions
        with self.assertRaisesRegex(ValueError, 'Duplicate Buff'):
            catalog_diff(before, after)

    def test_bundled_artifact_has_intact_source_and_revision_hashes(self):
        from extract_mcoc_node_modifiers import digest_json
        root = Path(__file__).resolve().parents[1]/'src/data/game-node-modifiers'
        catalog = json.loads((root/'catalog.json').read_text(encoding='utf-8'))
        self.assertEqual(catalog['profile'], json.loads((root/'source-profile.json').read_text(encoding='utf-8')))
        self.assertEqual(catalog['profileHash'], digest_json(catalog['profile']))
        self.assertEqual(catalog['contentHash'], digest_json({k: v for k, v in catalog.items() if k != 'contentHash'}))
        missing = []
        for definition in catalog['definitions']:
            for version in definition['versions']:
                self.assertEqual(definition['id'], version['raw']['id'])
                self.assertEqual(version['definitionHash'], digest_json(version['raw']))
                self.assertEqual(version['sourceBcgSha256'], catalog['profile']['bcgSha256'])
                self.assertEqual(version['hash'], digest_json({k: version[k] for k in ['raw', 'components', 'missingComponentIds', 'sourceBcgSha256']}))
                for component in version['components']:
                    self.assertEqual(component['hash'], digest_json(component['raw']))
                for application in version['applications']:
                    self.assertEqual(application['hash'], digest_json(application['raw']))
                missing.extend(version['missingComponentIds'])
        self.assertEqual(missing, ['saga_aspctstr_effct_ps1_seq1'])

    def test_binding_requires_cuid_and_both_hashes_never_name(self):
        catalog = {'definitions': self.build([application()])}
        v = catalog['definitions'][0]['versions'][0]
        from extract_mcoc_node_modifiers import digest_json
        record = {'id': 'cuid1', 'name': 'Same name', 'description': 'Reviewed'}
        binding = {'curatedId': 'cuid1', 'effectId': 'node_a', 'versionHash': v['hash'],
                   'curatedHash': digest_json(record)}
        self.assertEqual(reconciliation_plan(catalog, [record], [binding])['bindings'][0]['status'], 'verified')
        record['description'] = 'New reviewed copy'
        self.assertEqual(reconciliation_plan(catalog, [record], [binding])['bindings'][0]['status'], 'curated-drift')
        binding['effectId'] = 'missing'
        self.assertEqual(reconciliation_plan(catalog, [record], [binding])['bindings'][0]['status'], 'missing-definition')


if __name__ == '__main__':
    unittest.main()
