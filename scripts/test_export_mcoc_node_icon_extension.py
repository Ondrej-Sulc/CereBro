import hashlib
import json
import math
import subprocess
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

from export_mcoc_node_icon_extension import BASE_INDEX_SHA, validate_output
from extract_mcoc_node_modifiers import digest_json, pinned, pointer

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT/'src/data/game-node-modifiers/v3-native-icons'


class AdditionalNativeGlyphTests(unittest.TestCase):
    def test_complete_finite_glyph_geometry_frames_and_registered_assets(self):
        source = json.loads((ROOT/'src/data/game-node-modifiers/v2/artwork.json').read_text(encoding='utf8'))
        glyphs = json.loads((DATA/'glyphs.json').read_text(encoding='utf8'))
        self.assertEqual({r['glyph'] for r in glyphs['glyphs']}, {r['glyph'] for r in source['newGlyphRequirements']})
        self.assertEqual(len(glyphs['glyphs']), 204)
        self.assertEqual(len({r['glyphIndex'] for r in glyphs['glyphs']}), 204)
        for row in glyphs['glyphs']:
            self.assertEqual(row['status'], 'verified')
            self.assertEqual(row['codepoint'], f'U+{ord(row["glyph"]):04X}')
            svg = ET.fromstring(pinned(ROOT/'web/public'/row['src'].lstrip('/'),row['sha256']))
            self.assertEqual(list(map(float,svg.attrib['viewBox'].split())), row['viewBox'])
            x,y,w,h = row['viewBox'];x1,y1,x2,y2 = row['pathBounds']
            self.assertTrue(all(math.isfinite(v) for v in row['viewBox']))
            self.assertGreater(w,0);self.assertGreater(h,0)
            self.assertLess(x,x1);self.assertLess(y,y1);self.assertGreater(x+w,x2);self.assertGreater(y+h,y2)
            path = svg.find('{http://www.w3.org/2000/svg}path')
            self.assertEqual(path.attrib['fill'],'currentColor')
            self.assertEqual(hashlib.sha256(path.attrib['d'].encode()).hexdigest(),row['outlineSha256'])
            self.assertEqual(len(list(svg)),1)

    def test_full_version_application_glyph_source_chain_and_explicit_unresolved_cases(self):
        base_path = ROOT/'src/data/game-node-modifiers/v2/artwork.json'
        original = json.loads(base_path.read_text(encoding='utf8'))
        extension = json.loads((DATA/'application-proofs.json').read_text(encoding='utf8'))
        shapes = {r['glyph']:r for r in json.loads((DATA/'glyphs.json').read_text(encoding='utf8'))['glyphs']}
        self.assertEqual(len(extension['applications']),3894)
        self.assertEqual(sum(p['status']=='unresolved-first-component' for p in extension['unresolved']),4)
        self.assertEqual(sum(p['status']=='missing-glyph' for p in extension['unresolved']),1)
        for proof in extension['applications']:
            prior = pointer(original,proof['sourceV2Proof']['pointer'])
            self.assertEqual(prior['status'],'shape-not-exported')
            for key in ['effectId','versionHash','applicationHash','glyph','componentId','appearanceId','appearanceHash']:
                self.assertEqual(proof[key],prior[key])
            self.assertEqual(proof['iconKey'],shapes[proof['glyph']]['iconKey'])
            self.assertEqual(proof['svgSha256'],shapes[proof['glyph']]['sha256'])

    def test_source_index_registration_is_exact_and_baseline_unchanged(self):
        index = json.loads((DATA/'source-index.json').read_text(encoding='utf8'))
        self.assertEqual(index['baseSourceIndex']['sha256'],BASE_INDEX_SHA)
        self.assertEqual(index['contentHash'],digest_json({k:v for k,v in index.items() if k!='contentHash'}))
        for row in index['artifacts']+index['assets']+index['exporters']+[index['registry'],index['baseSourceIndex']]:
            pinned(ROOT/row['path'],row['sha256'])
        self.assertEqual(len(index['assets']),204)
        registry_text=(ROOT/index['registry']['path']).read_text(encoding='utf8')
        registry=json.loads(registry_text.split('= ',1)[1].split(' as const')[0])
        self.assertEqual({(r['key'],'web/public'+r['src']) for r in registry}, {(r['iconKey'],r['path']) for r in index['assets']})

    def test_font_source_drift_fails_before_any_asset_output_and_old_namespaces_reject_writes(self):
        with tempfile.TemporaryDirectory(dir=ROOT/'temp') as folder:
            base=Path(folder);font=base/'wrong.ttf';font.write_bytes(b'wrong source')
            chars=base/'chars.json';chars.write_text('[]')
            command=['node',str(ROOT/'scripts/export_mcoc_node_game_glyphs.cjs'),str(font),'0'*64,str(chars),str(base/'assets'),str(base/'out.json')]
            result=subprocess.run(command,capture_output=True,text=True)
            self.assertNotEqual(result.returncode,0);self.assertIn('Native font source hash drift',result.stderr)
            self.assertFalse((base/'assets').exists());self.assertFalse((base/'out.json').exists())
        for path in [ROOT/'src/data/game-node-modifiers/v2',ROOT/'src/data/game-node-modifiers',ROOT/'web/public/node-modifiers/icons']:
            with self.assertRaises(ValueError):validate_output(ROOT,path)


if __name__=='__main__':
    unittest.main()
