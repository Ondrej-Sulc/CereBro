import copy,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
import build_native_icons_v2 as projection
from build_application_icons import read,sha,REPO

class NativeIconsV2Tests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.context=projection.load_context()
  cls.artifact=read(REPO/'src/data/game-quests/application-icons-v2.json')
  cls.sample=read(REPO/'temp/quest-explorer-review/progressed-20261109/maps/me_crucible_ch02_q02.json')
  cls.app=next(a for t in cls.sample['map']['walkableTiles'] for side in ['attackerBuffs','defenderBuffs'] for a in t[side] or [] if projection.match(a,cls.context)[0] is not None)
 def test_source_paths_and_frozen_index_fail_closed(self):
  for name in ['../outside.json','C:/outside.json','/outside.json','src/../../outside.json','src\\outside.json']:
   with self.assertRaises(ValueError):projection.safe_path(projection.NODE_ROOT,name)
  with tempfile.TemporaryDirectory(dir=REPO/'temp') as folder:
   p=Path(folder)/projection.INDEX;p.parent.mkdir(parents=True);p.write_text('{}')
   with self.assertRaisesRegex(ValueError,'source-index drift'):projection.load_context(Path(folder))
 def test_exact_raw_application_and_glyph_are_required(self):
  self.assertIsNotNone(projection.match(self.app,self.context)[0])
  changed=copy.deepcopy(self.app);changed['buff']['localizedName']='Same ID, different raw definition'
  self.assertIsNone(projection.match(changed,self.context)[0])
  changed=copy.deepcopy(self.app);changed['buffAppearance']='unproved glyph'
  self.assertIsNone(projection.match(changed,self.context)[0])
  changed=copy.deepcopy(self.app);changed['buffDescription']='Unobserved application context'
  self.assertEqual(projection.match(changed,self.context)[1],'applicationContextAbsent')
 def test_component_and_bcg_drift_change_complete_version_identity(self):
  raw=self.app['buff'];v=projection.version(raw,self.context['components'],self.context['bcg'])
  self.assertEqual(v['hash'],self.context['versions'][v['definitionHash']]['hash'])
  self.assertNotEqual(v['hash'],projection.version(raw,self.context['components'],'wrong BCG')['hash'])
  version=next(v for v in self.context['versions'].values() if v['components']);components=dict(self.context['components']);key=version['components'][0]['id'];components[key]={**components[key],'Modifier':123456}
  self.assertNotEqual(version['hash'],projection.version(version['raw'],components,self.context['bcg'])['hash'])
 def test_input_bcg_and_svg_byte_drift_is_rejected_before_projection(self):
  original=projection.sha
  for target in [projection.BCG,projection.safe_path(projection.NODE_ROOT,self.context['index']['glyphAssets'][0]['path'])]:
   with patch.object(projection,'sha',side_effect=lambda p: '0'*64 if p.resolve()==target.resolve() else original(p)):
    with self.assertRaisesRegex(ValueError,'drift'):projection.load_context()
 def test_additive_references_never_replace_frozen_assignments_or_change_map_joins(self):
  old=read(REPO/'src/data/game-quests/application-icons.json');expanded=read(REPO/'src/data/game-quests/application-icons-expanded.json');base={**old['maps'],**expanded['maps']};artifact=self.artifact
  self.assertEqual(sha(REPO/'src/data/game-quests/application-icons-expanded.json'),projection.BASE_EXPANDED_SHA)
  self.assertEqual(sha(REPO/'src/data/game-quests/application-icons.json'),projection.BASE_OLD_SHA)
  self.assertEqual(len(artifact['maps']),218);self.assertEqual(artifact['counts']['totalApplications'],212720)
  self.assertEqual(artifact['counts']['baselineBindings'],51718)
  self.assertEqual(artifact['counts']['addedBindings'],98280)
  self.assertEqual(artifact['counts']['mergedBindings'],149998)
  self.assertEqual(artifact['counts']['nativeGlyphShapeNotExported'],62712)
  self.assertEqual(artifact['counts']['nativeFirstComponentUnresolved'],4)
  self.assertEqual(artifact['counts']['nativeGlyphMissing'],6)
  self.assertEqual(len(artifact['unboundShapeCounts']),204)
  for qid,row in artifact['maps'].items():
   self.assertEqual((row['sourceHash'],row['mapId']),(base[qid]['sourceHash'],base[qid]['mapId']))
   self.assertFalse(set(row['applications'])&set(base[qid]['applications']))
   self.assertTrue(all(isinstance(index,int) and 0<=index<len(artifact['proofs']) for index in row['applications'].values()))

if __name__=='__main__':unittest.main()
