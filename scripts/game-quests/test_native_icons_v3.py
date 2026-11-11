import copy,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
import build_native_icons_v3 as projection
from build_application_icons import REPO,read,sha

class NativeIconsV3Tests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.context=projection.load_context()
  cls.artifact=read(REPO/'src/data/game-quests/application-icons-v3.json')
  raw=read(REPO/'temp/quest-explorer-review/progressed-20261109/maps/me_crucible_ch02_q02.json')
  cls.app=next(a for tile in raw['map']['walkableTiles'] for side in ['attackerBuffs','defenderBuffs'] for a in tile[side] or [] if projection.match(a,cls.context)[0] is not None)
  cls.binding=cls.context['sources']['documents']['icon-bindings.json']['bindings'][0]
 def test_paths_index_output_and_asset_drift_fail_closed(self):
  for path in ['../outside','C:/outside','/outside','src/../../outside','src\\outside']:
   with self.assertRaises(ValueError):projection.safe_path(projection.NODE_ROOT,path)
  with tempfile.TemporaryDirectory(dir=REPO/'temp') as folder:
   path=Path(folder)/projection.INDEX;path.parent.mkdir(parents=True);path.write_text('{}')
   with self.assertRaisesRegex(ValueError,'source-index drift'):projection.load_sources(Path(folder))
  for output in [REPO/'src/data/game-quests/application-icons-v2.json',REPO.parent/'application-icons-v3.json']:
   with self.assertRaisesRegex(ValueError,'Output'):projection.build(output)
  original=projection.sha;target=projection.safe_path(projection.NODE_ROOT,self.context['sources']['index']['assets'][0]['path'])
  with patch.object(projection,'sha',side_effect=lambda p:'0'*64 if p.resolve()==target.resolve() else original(p)):
   with self.assertRaisesRegex(ValueError,'drift'):projection.load_sources()
 def test_full_version_component_missing_component_glyph_and_native_asset_proofs_are_required(self):
  base=self.context['base'];sources=self.context['sources'];document=self.context['sourceDocument']
  projection.verify_binding(self.binding,base,sources,document)
  changes=[('versionHash','0'*64),('glyph','not-the-recorded-glyph'),('svgSha256','0'*64),('fontSha256','0'*64)]
  for key,value in changes:
   b=copy.deepcopy(self.binding);b[key]=value
   with self.assertRaises(ValueError):projection.verify_binding(b,base,sources,document)
  for key,value in [('definitionHash','0'*64),('missingComponentIds',['unproved-component']),('sourceBcgSha256','0'*64)]:
   b=copy.deepcopy(self.binding);b['fullDefinition'][key]=value
   with self.assertRaises(ValueError):projection.verify_binding(b,base,sources,document)
  b=copy.deepcopy(self.binding);b['fullDefinition']['componentHashes'][0]['hash']='0'*64
  with self.assertRaises(ValueError):projection.verify_binding(b,base,sources,document)
 def test_exact_application_context_and_raw_definition_not_only_id_or_glyph(self):
  self.assertIsNotNone(projection.match(self.app,self.context)[0])
  for key,value in [('buffDescription','Unobserved wording'),('buffAmount',987654),('buffAppearance','unproved glyph')]:
   app=copy.deepcopy(self.app);app[key]=value;self.assertIsNone(projection.match(app,self.context)[0])
  app=copy.deepcopy(self.app);app['buff']['quantity']+=1
  self.assertEqual(projection.match(app,self.context)[1],'definitionVersionAbsent')
 def test_additive_only_all_prior_binding_bytes_and_exact_remaining_source_gaps(self):
  artifact=self.artifact;counts=artifact['counts'];self.assertEqual(counts['addedBindings'],62712);self.assertEqual(counts['mergedBindings'],212710);self.assertEqual(counts['remainingUnbound'],10)
  self.assertEqual(counts['nativeFirstComponentUnresolved'],4);self.assertEqual(counts['nativeGlyphMissing'],6)
  for name,expected in artifact['baselines'].items():self.assertEqual(sha(REPO/'src/data/game-quests'/name),expected)
  a,b,c=[read(REPO/'src/data/game-quests'/name) for name in ['application-icons.json','application-icons-expanded.json','application-icons-v2.json']];prior={**a['maps'],**b['maps']}
  self.assertEqual(len(artifact['maps']),218);self.assertEqual(len(artifact['proofs']),1089)
  for qid,row in artifact['maps'].items():
   self.assertEqual((row['mapId'],row['sourceHash']),(prior[qid]['mapId'],prior[qid]['sourceHash']))
   self.assertFalse(set(row['applications'])&(set(prior[qid]['applications'])|set(c['maps'][qid]['applications'])))
   self.assertTrue(all(isinstance(index,int) and 0<=index<len(artifact['proofs']) for index in row['applications'].values()))
  self.assertEqual(len(artifact['unresolved']),10)

if __name__=='__main__':unittest.main()
