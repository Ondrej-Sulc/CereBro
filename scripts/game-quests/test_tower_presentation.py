"""Portable generator contract tests, using synthetic public data only."""
import json
import tempfile
import unittest
from pathlib import Path
from build_tower_presentation import clean, source_inventory, sha, observed_description, observed_icon_key


class TowerPresentationTests(unittest.TestCase):
    def test_native_text(self):
        self.assertEqual(clean('[16982bff]Health[-]\\n[k=glossary/test]Test[/k]'), 'Health\nTest')
        self.assertIsNone(clean(None))
        self.assertIsNone(clean('   '))

    def test_distinct_scopes_and_quantity_inventory(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td); package = root/'src/data/game-quests/tower-backend'
            (package/'blocks').mkdir(parents=True)
            data = dict(blockData=dict(buffs=[dict(t='buff',n='same',q=1)], topBuffs=[], rewards=[dict(t='hero',n='exact_blueprint',q=1)], ratingRewards=[dict(t='gsi',n='score',q=3)], floorCost=[dict(t='res',n='energy',q=1)]),
                floors=[dict(sourceData=dict(buffs=[],topBuffs=[dict(t='buff',n='same',q=7)],rewards=[dict(t='res',n='gold',q=100)]))])
            p=package/'blocks/one.json';p.write_text(json.dumps(data))
            (package/'manifest.json').write_text(json.dumps(dict(blocks={'one':dict(path='blocks/one.json',sha256=sha(p))})))
            blocks,pins,ids,rewards,quantities=source_inventory(root)
            self.assertEqual(len(blocks),1)
            self.assertEqual(ids,{'same'})
            self.assertEqual(quantities['same'],{1,7})
            self.assertEqual(rewards,{('hero','exact_blueprint'),('gsi','score'),('res','energy'),('res','gold')})
            self.assertEqual(len(pins),2)
            p.write_text('{}')
            with self.assertRaisesRegex(ValueError,'hash drift'):source_inventory(root)

    def test_manifest_escape_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td);package=root/'src/data/game-quests/tower-backend';package.mkdir(parents=True)
            (package/'manifest.json').write_text(json.dumps(dict(blocks={'one':dict(path='../escape.json',sha256='bad')})))
            with self.assertRaisesRegex(ValueError,'Unsafe block path'):source_inventory(root)

    def test_bounded_native_stat_formatter(self):
        raw=dict(localizedDesc='[16982bff]+{0}%[-] Attack',quantity=1,buffType='bcg',value=200)
        self.assertEqual(observed_description(raw,{},1),'+200% Attack')
        self.assertIsNone(observed_description(raw,{},7))
        raw['localizedDesc']='Unexpected {5}'
        self.assertIsNone(observed_description(raw,{},1))

    def test_timer_duration_comes_from_exact_first_bcg_component(self):
        raw=dict(localizedDesc='Timer: {2} seconds',quantity=1,buffType='statMods',valueStr=['first','second'])
        version=dict(components=[dict(id='first',raw=dict(Duration=60)),dict(id='second',raw=dict(Duration=999))])
        self.assertEqual(observed_description(raw,version,1),'Timer: 60 seconds')
        self.assertIsNone(observed_description(raw,dict(components=[]),1))

    def test_icon_requires_complete_observed_tower_version_not_only_node_proof(self):
        proof = dict(definitionHash='raw', versionHash='components-a', iconKey='native-icon', missingComponentIds=[])
        observed = dict(definitionHash='raw', hash='components-a', missingComponentIds=[])
        self.assertIsNone(observed_icon_key([proof], None))
        self.assertIsNone(observed_icon_key([proof], dict(observed, hash='components-b')))
        self.assertIsNone(observed_icon_key([proof], dict(observed, definitionHash='other-raw')))
        self.assertIsNone(observed_icon_key([proof], dict(observed, missingComponentIds=['unknown'])))
        self.assertEqual(observed_icon_key([proof], observed), 'native-icon')


if __name__=='__main__': unittest.main()
