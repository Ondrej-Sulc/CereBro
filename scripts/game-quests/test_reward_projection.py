import hashlib,json,unittest
from pathlib import Path
from build_rewards import FIELDS,SCOPES,REPO
def read(p):return json.loads(p.read_text(encoding='utf-8'))
class RewardProjectionTests(unittest.TestCase):
 def test_every_owner_scope_and_quantity_matches_its_independent_saved_source(self):
  d=read(REPO/'src/data/game-quests/rewards.json');cache={};root=Path('C:/Code/CereBro/temp/quest-data-investigation/game-only')
  for h,s in d['sources'].items():
   paths=[root/s['file'],REPO/'temp/quest-explorer-review/progressed-20261109/maps'/s['file'],REPO/'temp/quest-explorer-review/permanent-20261109/maps'/s['file'],REPO/'temp/quest-explorer-review/rewards-controls-20261109'/s['file']]
   p=next(p for p in paths if p.exists());self.assertEqual(hashlib.sha256(p.read_bytes()).hexdigest(),h);cache[h]=read(p)
  total=0
  for owner in d['owners'].values():
   self.assertIn(owner['sourceHash'],owner['key']);native=cache[owner['sourceHash']]
   for part in owner['sourcePointer'].split('/')[1:]:native=native[int(part)] if isinstance(native,list) else native[part]
   for scope in SCOPES:
    rows=native[scope] or [];self.assertEqual(len(rows),len(owner['scopes'][scope]))
    for i,(source,public) in enumerate(zip(rows,owner['scopes'][scope])):
     self.assertEqual(public['sourceIndex'],i)
     for key,target in FIELDS.items():self.assertEqual(public.get(target),source.get(key))
     self.assertFalse({'Balance','Source','Context','ContextProto'}&public.keys());total+=1
  self.assertEqual(total,3531);self.assertEqual(len(d['owners']),308);self.assertEqual(d['missingParents'],[])
 def test_new_parent_receipt_is_distinct_from_historical_sources(self):
  d=read(REPO/'src/data/game-quests/rewards.json');h='496aab35a0ce29e4eae50f8a329c7febaa158dad4b674fe160294c5c5e43dfd7'
  owners=[r for r in d['owners'].values() if r['sourceHash']==h]
  self.assertEqual(len(owners),23);self.assertEqual(sum(len(r) for o in owners for r in o['scopes'].values()),10)
  self.assertEqual(sum(r['data']=='unknown_rewards' for o in owners for rs in o['scopes'].values() for r in rs),6)
if __name__=='__main__':unittest.main()
