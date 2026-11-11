"""Offline public rewards sidecar. Source arrays/owners/scopes are never merged or counted twice."""
import argparse,json,hashlib,sys
from pathlib import Path
from build_snapshot import read,sha,REPO
SCOPES=['firstCompletionRewards','masteryCompletionRewards','potentialCompletionRewards']
FIELDS={'Type':'type','Data':'data','Quantity':'quantity','MinQuantity':'minQuantity','MaxQuantity':'maxQuantity','Action':'action','Header':'header','Footer':'footer'}
def owner_key(s,kind,act='',chapter='',quest=''):return json.dumps([s,kind,act,chapter,quest],separators=(',',':'))
def project_rows(owner):
 return {scope:[dict(sourceIndex=i,**{v:r[k] for k,v in FIELDS.items() if k in r}) for i,r in enumerate(owner[scope] or [])] for scope in SCOPES}
def build(args):
 assert sha(args.source/'runtime-november.json')=='fc84deb4880021ddb92d77305dc3ff11248e67cccfb1148681ae76af90ebb78d'
 original=read(args.source/'runtime-november.json');assert not original['issues']
 catalog=read(REPO/'src/data/game-quests/catalog.json')+read(REPO/'src/data/game-quests/progressed-catalog.json')
 public=set(read(REPO/'src/data/game-quests/progressed.json')['publicQuestIds']);catalog=[q for q in catalog if q['id'] in public]
 rows={};quests={};parents={};sources={};missing=[]
 def source(p):
  d=read(p);h=sha(p);assert d['gameAssemblySha256']==original['gameAssemblySha256'] and not d['issues'];sources[h]=dict(file=p.name,sha256=h,capturedAt=d['capturedAt']);return d,h
 d,oh=source(args.source/'runtime-november.json');sets={s['setId']:s for s in d['pveSets']}
 parent_sets={s['setId']:(s,oh,i) for i,s in enumerate(d['pveSets'])}
 if args.parent_rewards:
  assert sha(args.parent_rewards)=='496aab35a0ce29e4eae50f8a329c7febaa158dad4b674fe160294c5c5e43dfd7'
  supplement,sh=source(args.parent_rewards)
  assert supplement['readerSha256']=='724bb3a0b5ed3cf8c75dd4b31e5ce7699d962fa54113bbb75e1e40a450b14ac9'==sha(REPO/'scripts/game-quests/capture_public_rewards.py')
  parent_sets.update({s['setId']:(s,sh,i) for i,s in enumerate(supplement['pveSets'])})
 for q in catalog:
  native=None;h=oh;pointer='';mapfile=args.progressed/'maps'/f"{q['id']}.json"
  previous=args.progressed.parent/'permanent-20261109'
  if not mapfile.exists() and (previous/'maps'/mapfile.name).exists():mapfile=previous/'maps'/mapfile.name
  if mapfile.exists():
   cap,h=source(mapfile);receipt=read(mapfile.parent.parent/'capture-manifest.json');assert h==receipt.get('files',receipt.get('sourceFiles'))['maps/'+mapfile.name];native=cap['quest'];assert cap['container']['setId']==q['containerSetId'];pointer='/quest'
  else:
   s=sets.get(q['containerSetId']);native=(s or {}).get('QuestSummarys',{}).get(q['id']);pointer=f"/pveSets/{list(sets).index(q['containerSetId'])}/QuestSummarys/{q['id']}" if s else ''
  if native and all(k in native for k in SCOPES):
   assert native['qid']==q['id'] and native['mapId']==q['mapId'] and native['setId']==q['summarySetId']
   key=owner_key(q['containerSetId'],'quest',quest=q['id']);rows[key]=dict(key=key,kind='quest',ownerId=q['id'],containerSetId=q['containerSetId'],mapId=q['mapId'],catalogSourceHash=q['sourceHash'],sourceHash=h,sourcePointer=pointer,scopes=project_rows(native));quests[q['id']]=key
  for member in q['hierarchy']:
   for kind in ['act','chapter']:
    aid=member['actId'];cid=member['chapterId'] if kind=='chapter' else '';key=owner_key(q['containerSetId'],kind,aid,cid)
    if key in parents or key in missing:continue
    s,ph,si=parent_sets.get(q['containerSetId'],(None,None,None));act=next((a for a in (s or {}).get('Acts',[]) or [] if a.get('actId')==aid),None)
    obj=act if kind=='act' else next((c for c in (act or {}).get('Chapters',[]) or [] if c.get('chapterId')==cid),None)
    if not obj or not all(k in obj for k in SCOPES):missing.append(key);continue
    allowed={z['id'] for z in catalog if z['containerSetId']==q['containerSetId'] and any(x['actId']==aid and (not cid or x['chapterId']==cid) for x in z['hierarchy'])}
    actual={z['qid'] for c in ([obj] if kind=='chapter' else obj['Chapters'] or []) for z in c['Quests'] or [] if z and z.get('qid')}
    if not allowed<=actual:raise ValueError('Parent membership drift: '+key)
    pointer=f"/pveSets/{si}/Acts/{s['Acts'].index(act)}"
    if kind=='chapter':pointer+=f"/Chapters/{act['Chapters'].index(obj)}"
    rows[key]=dict(key=key,kind=kind,ownerId=cid or aid,actId=aid,containerSetId=q['containerSetId'],sourceHash=ph,sourcePointer=pointer,questBindings={z['id']:dict(mapId=z['mapId'],sourceHash=z['sourceHash']) for z in catalog if z['id'] in allowed},scopes=project_rows(obj));parents[key]=key
 # Reuse exact canonical display metadata from the existing opening catalog; ambiguous names stay absent.
 opening=read(REPO/'src/data/game-crystal-openings/catalog.json');names={}
 bp={b['Blueprint']:b for b in read(args.source/'current-blueprints.json')};champs={c['gameId']:dict(id=c['id'],slug=c['slug'],name=c['name']) for c in read(Path('C:/Code/CereBro/temp/crystals/champions.json')) if c.get('gameId')}
 for c in opening['categories']:
  for r in c['rewards']:
   if r.get('displayName'):names.setdefault((r['type'],r['data']),set()).add(r['displayName'])
 for o in rows.values():
  for rewards in o['scopes'].values():
   for r in rewards:
    values=names.get((r['type'],r['data']),set())
    if len(values)==1:r['displayName']=next(iter(values))
    if r['type']=='hero' and r['data'] in bp:
     b=bp[r['data']];c=champs.get(b['Character']);r['identity']=dict(tierId=r['data'],gameId=b['Character'],rarity=b['Rarity'],name=c['name'] if c else b['Character'],champion=c)
 keys={k:k+':'+v['sourceHash'] for k,v in rows.items()};rows={keys[k]:dict(v,key=keys[k]) for k,v in rows.items()};quests={k:keys[v] for k,v in quests.items()};parents={k:keys[v] for k,v in parents.items()}
 # The same canonical native display readers used by crystal rewards cover materials/items absent from crystal pools.
 sys.path.insert(0,str(REPO/'scripts'))
 from mcoc_protobuf import Decoder,fields
 from extract_mcoc_crystal_openings import add_display_names,localize_display_names
 schema_path=Path('C:/Code/CereBro/temp/crystals/schema.json');schema=read(schema_path);assert hashlib.sha256(json.dumps(schema['types'],sort_keys=True,separators=(',',':')).encode()).hexdigest()==opening['source']['schemaSha256'];dec=Decoder(schema)
 bcg=args.source/'sources/bcg-E95E28EECECC04D6A358C8FD8089D01305D0FB73.bin';store=Path('C:/Code/CereBro/temp/crystal-openings/gamestore-5AFEBC8CC99BE2C1546DB91EF7B1F6360DFD7154.bin')
 pins={r['fileName']:r['sha256'] for r in opening['source']['displayMetadata']}
 assert sha(bcg)==pins[bcg.name] and sha(store)==pins[store.name]
 registries={3:[],4:[],5:[]}
 for tag,wire,value,_ in fields(bcg.read_bytes()):
  if tag in registries:registries[tag].append(dec.message(value,{3:'BCGBlueprintBase',4:'BCGCharacterData',5:'BCGEvoBlueprintBase'}[tag]))
 native_store=dec.message(store.read_bytes(),'EB.Sparx.GameStoreDataBuffer');assert not dec.unknown
 holder=dict(categories=[dict(rewards=[r for o in rows.values() for scope in o['scopes'].values() for r in scope])],bonusRewards=[],crystals=[],coverage={})
 add_display_names(holder,registries[3],registries[4],[r for g in native_store.get('items',{}).values() for r in g.get('gameStoreItems',[])],registries[5])
 words=localize_display_names(holder,list(Path('C:/Code/CereBro/temp/crystal-openings/words').glob('*.json')))
 result=dict(version=1,exporterSha256=sha(Path(__file__)),sources=sources,openingCatalogSha256=sha(REPO/'src/data/game-crystal-openings/catalog.json'),identityInputs={n:sha(p) for n,p in [('blueprints',args.source/'current-blueprints.json'),('champions',Path('C:/Code/CereBro/temp/crystals/champions.json'))]},owners=rows,quests=quests,parents=parents,missingParents=sorted(missing),policy='Independent public definition reward scopes. One observation per owner. Source dates and exact set/act/chapter identity retained. No account progress or source dictionaries.')
 result['displayInputs']=dict(bcgSha256=sha(bcg),gameStoreSha256=sha(store),schemaSha256=sha(schema_path),localization=words)
 args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8');print(dict(quests=len(quests),parents=len(parents),missingParents=len(missing),rows=sum(len(r) for o in rows.values() for r in o['scopes'].values())))
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--source',type=Path,default=Path('C:/Code/CereBro/temp/quest-data-investigation/game-only'));p.add_argument('--progressed',type=Path,default=REPO/'temp/quest-explorer-review/progressed-20261109');p.add_argument('--parent-rewards',type=Path,default=REPO/'temp/quest-explorer-review/rewards-controls-20261109/public-parent-rewards.json');p.add_argument('--output',type=Path,default=REPO/'src/data/game-quests/rewards.json');build(p.parse_args())
