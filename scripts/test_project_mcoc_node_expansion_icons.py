import copy
import json
import unittest
from pathlib import Path

from extract_mcoc_node_modifiers import digest_json, pinned
from project_mcoc_node_expansion_icons import exact_proof

ROOT = Path(__file__).resolve().parents[1]


class ExpansionIconTests(unittest.TestCase):
    def fixture(self):
        app = dict(hash='application',raw=dict(buffAppearance='k'))
        version = dict(hash='full-version', raw=dict(buffType='statMods',valueStr=['component']),
            components=[dict(id='component',raw=dict(AppearanceID='appearance'))])
        appearances = dict(appearance=dict(ID='appearance',IconTexture='k'))
        assets = dict(k=dict(iconKey='reviewed-key',svgPath='immutable.svg',svgSha256='reviewed-hash'))
        return version,app,appearances,assets

    def test_exact_first_component_appearance_glyph_and_reviewed_svg_chain(self):
        version,app,appearances,assets = self.fixture()
        proof = exact_proof(version,app,appearances,assets)
        self.assertEqual(proof['iconKey'],'reviewed-key')
        self.assertEqual(proof['appearanceId'],'appearance')
        self.assertEqual(proof['appearanceHash'],digest_json(appearances['appearance']))
        self.assertEqual(proof['versionHash'],'full-version')
        self.assertEqual(proof['applicationHashes'],['application'])
        self.assertEqual(exact_proof(version,app,appearances,{})['status'],'shape-not-exported')

    def test_missing_identity_or_disagreeing_glyph_never_gets_a_name_match(self):
        version,app,appearances,assets = self.fixture()
        missing = copy.deepcopy(version);missing['components']=[]
        self.assertEqual(exact_proof(missing,app,appearances,assets)['status'],'unresolved-first-component')
        bad = copy.deepcopy(app);bad['raw']['buffAppearance']='other'
        with self.assertRaisesRegex(ValueError,'Appearance drift'):
            exact_proof(version,bad,appearances,assets)

    def test_frozen_build_index_pins_every_detail_artifact_and_shared_shape(self):
        path=ROOT/'src/data/game-node-modifiers/v2/source-index.json'
        index=json.loads(path.read_text(encoding='utf8'))
        self.assertEqual(index['contentHash'],digest_json({k:v for k,v in index.items() if k!='contentHash'}))
        self.assertEqual(len(index['definitions']),1688)
        for row in index['artifacts']+index['definitions']+index['glyphAssets']+index['sharedRendererSources']:
            pinned(ROOT/row['path'],row['sha256'])


if __name__=='__main__':
    unittest.main()
