import copy,json,unittest
from pathlib import Path
from build_application_icons import bind,digest,read,sha,REPO

class ApplicationIconProjectionTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  pins=read(Path('C:/Code/CereBro/temp/parallel-reference-20261109/quest-icon-source-inputs.json'))
  cls.inputs={}
  for pin in pins['read_only_source_inputs']:
   p=Path(pin['path']);assert sha(p)==pin['sha256'];cls.inputs[p.name]=read(p)
  cls.catalog=cls.inputs['catalog.json'];cls.bindings=cls.inputs['icon-bindings.json'];cls.art=cls.inputs['artwork.json'];cls.bcg=cls.catalog['profile']['bcgSha256']
  cls.ledger=read(REPO/'src/data/game-quests/application-icons-expanded.json')
  cls.record=cls.ledger['maps']['me_crucible_ch02_q02']
  cls.native=read(REPO/'temp/quest-explorer-review/progressed-20261109/maps/me_crucible_ch02_q02.json')
 def test_each_bound_crucible_application_reproduces_exact_raw_version_glyph_and_source_join(self):
  self.assertEqual(len(self.record['applications']),402)
  p=REPO/'temp/quest-explorer-review/progressed-20261109/maps/me_crucible_ch02_q02.json'
  self.assertEqual(sha(p),self.record['sourceHash'])
  for appid,entry in self.record['applications'].items():
   node=self.native
   for part in entry['sourcePointer'].split('/')[1:]:node=node[int(part)] if isinstance(node,list) else node[part]
   self.assertEqual(digest(node['buff']),entry['definitionHash'])
   self.assertEqual(node['buffAppearance'],entry['nativeGlyph'])
   hit=bind(node['buff'],node['buffAppearance'],self.catalog,self.bindings,self.art,self.bcg)
   self.assertIsNotNone(hit)
   for key in ['effectId','versionHash','iconKey']:self.assertEqual(hit[key],entry[key])
   tile_index=int(entry['sourcePointer'].split('/')[3]);tile=self.native['map']['walkableTiles'][tile_index]
   side='attacker' if '/attackerBuffs/' in entry['sourcePointer'] else 'defender'
   self.assertEqual(appid,f"{tile['x']},{tile['y']}:{side}:{entry['sourcePointer'].split('/')[-1]}")
 def test_definition_glyph_bcg_and_component_drift_never_acquires_an_icon(self):
  entry=next(iter(self.record['applications'].values()));node=self.native
  for part in entry['sourcePointer'].split('/')[1:]:node=node[int(part)] if isinstance(node,list) else node[part]
  raw=node['buff'];glyph=node['buffAppearance']
  changed=copy.deepcopy(raw);changed['description']='changed definition'
  self.assertIsNone(bind(changed,glyph,self.catalog,self.bindings,self.art,self.bcg))
  self.assertIsNone(bind(raw,glyph+'-unproved',self.catalog,self.bindings,self.art,self.bcg))
  self.assertIsNone(bind(raw,glyph,self.catalog,self.bindings,self.art,'unproved-bcg'))
  changed_catalog=copy.deepcopy(self.catalog)
  for definition in changed_catalog['definitions']:
   for version in definition['versions']:
    if version['hash']==entry['versionHash']:version['components']=[] if version['components'] else [{'unproved':'component'}]
  self.assertIsNone(bind(raw,glyph,changed_catalog,self.bindings,self.art,self.bcg))

if __name__=='__main__':unittest.main()
