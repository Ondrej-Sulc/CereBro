"""Offline supplement for the progressed client's exact public permanent definitions.

Existing archive, first supplement and captures are immutable. No game access.
"""
import argparse,hashlib,json,sys,io
from pathlib import Path
from PIL import Image
from build_permanent import project_map
from build_source_art import local_pack_reference
from capture_source_art import PINS
REPO=Path(__file__).resolve().parents[2]
NEW_SETS={
 '67466eac1fbd7c1224a0f6e2':('pain2024_finale','The Epoch of Pain'),
 '67f7ee588f9473addee407d3':('pve_crucible','The Crucible'),
 '675c7c6bc978b7131e691e92':('wheel_of_fate_2025','Wheel of Fate'),
 '6360688121824e1b6793b43f':('painquest_acceptance','Eternity of Pain - Acceptance'),
 '63eea1742a4fa65b9d878d3e':('necropolis','The Necropolis'),
 '5c671733b473cf3cd097f5c0':('realm3_abyss','Abyss of Legends'),
 '57a90ad550ec3ffc44c4a6c3':('labyrinth','Labyrinth of Legends'),
 '6360344121824e1b6793b35d':('grandmasters_gauntlet',"The Grandmaster's Gauntlet"),
 '63dd3c219de4ee20435258cb':('pve_may2023_shootingstars','Shooting Stars'),
 '6a209bc47cb2a9f719e61a83':('reversal_legends_final','Revenge of Legends'),
}
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,d):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(d,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')

def validate_sources(source):
 ledger=read(source/'capture-manifest.json')
 for name,digest in ledger['files'].items():
  path=source/name
  if not path.resolve().is_relative_to(source.resolve()) or sha(path)!=digest:raise ValueError('Captured source drift: '+name)
 maps={p.stem for p in (source/'maps').glob('*.json')}
 if maps!={Path(n).stem for n in ledger['files'] if n.startswith('maps/')}:raise ValueError('Unreviewed map files')
 receipts=[]
 for path in sorted(source.glob('maps-*.json')):
  d=read(path)
  if d['readerSha256']!=sha(REPO/'scripts/game-quests/capture_progressed.py') or d['issues'] or d['gameAssemblySha256']!=PINS['GameAssembly.dll'] or d['layoutSha256']!=PINS['layouts.json']:raise ValueError('Unsupported capture receipt')
  if d['readMetrics']['calls']>2_000_000 or d['readMetrics']['bytes']>64*1024*1024:raise ValueError('Capture exceeded budget')
  for qid in d['maps']:
   raw=read(source/'maps'/f'{qid}.json')
   if any(raw[k]!=d[k] for k in ['capturedAt','readerSha256','gameAssemblySha256','layoutSha256']):raise ValueError('Receipt identity mismatch')
  receipts+=d['maps']
 if len(receipts)!=len(set(receipts)) or set(receipts)!=maps:raise ValueError('Map receipts incomplete or duplicated')
 if not maps<=set(read(source/'targets.json')['questIds']):raise ValueError('Map outside finite target allowlist')
 for name,reader in [('initial-catalog.json','capture_permanent.py'),('source-art.json','capture_source_art.py')]:
  if read(source/name)['readerSha256']!=sha(REPO/'scripts/game-quests'/reader):raise ValueError('Definition reader drift')
 return ledger
def hierarchy(s,q):
 rows=[]
 for a in s['Acts'] or []:
  if not a['actId']:continue
  for c in a['Chapters'] or []:
   if not c['chapterId']:continue
   if any(v and v['qid']==q['qid'] for v in c['Quests'] or []):
    rows.append(dict(actId=a['actId'],actName=a['friendlyName'],actGroupIndex=a['groupIndex'],actDisplayIndex=a['displayIndex'],chapterId=c['chapterId'],chapterName=c['friendlyName']))
 return rows

def build(args):
 ledger=validate_sources(args.source)
 d=read(args.source/'initial-catalog.json');assert d['gameAssemblySha256']=='01f46bb2e36c2160a8df939bbb080bcf2ee89ca15427692a10334efc90fd4abb' and not d['issues']
 base=read(REPO/'src/data/game-quests/catalog.json');previous=read(REPO/'src/data/game-quests/permanent.json');byid={q['id']:q for q in base};extra=[];sets={s['setId']:s for s in d['pveSets']};source_hash=sha(args.source/'initial-catalog.json')
 for sid,(name,label) in NEW_SETS.items():
  s=sets[sid];assert s['setName']==name and s['expiryTime']==0 and s['timeLimit']==0
  for key,q in s['QuestSummarys'].items():
   assert key==q['qid'] and q['setId']==sid and q['end'] in (-1,0) and q['qid'] not in byid
   row=dict(id=q['qid'],name=q['friendlyName'],category=q['category']['name'],containerSetId=sid,containerSetName=name,summarySetId=q['setId'],summarySetName=q['setName'],mapId=q['mapId'],actIndex=q['actIndex'],chapterIndex=q['chapterIndex'],questIndex=q['questIndex'],hierarchy=hierarchy(s,q),hierarchyBinding='exact captured Act.Chapter.Quests membership',difficultyId=q['difficultyId'],difficulty=q['difficulty'],setDifficulty=s['difficulty'],minProgressionRank=None,maxProgressionRank=None,scalingCurve=None,coverage='summary-only',walkableNodes=None,authoredPaths=None,placedEncounters=None,sourceHash=source_hash)
   extra.append(row);byid[row['id']]=row
 write(args.output/'progressed-catalog.json',extra)
 public_ids=set(previous['publicQuestIds'])|{q['id'] for q in extra};summary_byid={q['qid']:(s,q,si) for si,s in enumerate(d['pveSets']) for q in s['QuestSummarys'].values()}
 # Existing labels/blueprint identities remain pinned to their actual retained BCG.
 bp={b['Blueprint']:b for b in read(args.evidence/'current-blueprints.json')};champs={c['gameId']:{k:c[k] for k in ('id','slug','name')} for c in read(args.champions) if c.get('gameId')}
 sys.path.insert(0,str(REPO/'scripts'));from mcoc_protobuf import Decoder,fields
 schema=args.champions.parent/'schema.json';bcg=args.evidence/'sources/bcg-E95E28EECECC04D6A358C8FD8089D01305D0FB73.bin';dec=Decoder(read(schema));characters={}
 for tag,_,v,_ in fields(bcg.read_bytes()):
  if tag==4:
   c=dec.message(v,'BCGCharacterData');characters[c['Character']]=c
 assert not dec.unknown and sha(bcg)==previous['bcgSha256']
 def identity(tier):
  b=bp[tier];gid=b['Character'];assert 1<=b['Rarity']<=7
  return dict(tierId=tier,gameId=gid,rarity=b['Rarity'],name=characters.get(gid,{}).get('_friendlyNameLoc',{}).get('en') or gid,champion=champs.get(gid))
 previews={}
 for qid in sorted(public_ids):
  s,n,si=summary_byid[qid];q=byid[qid]
  assert n['mapId']==q['mapId'] and s['setId']==q['containerSetId'] and n['setId']==q['summarySetId']
  assert [n[k] for k in ['actIndex','chapterIndex','questIndex','difficultyId']]==[q[k] for k in ['actIndex','chapterIndex','questIndex','difficultyId']]
  assert {(h['actId'],h['chapterId']) for h in hierarchy(s,n)}=={(h['actId'],h['chapterId']) for h in q['hierarchy']}
  previews[qid]=dict(catalogSourceHash=q['sourceHash'],mapId=q['mapId'],containerSetId=q['containerSetId'],sourceHash=source_hash,sourcePointer=f'/pveSets/{si}/QuestSummarys/{qid}/finalBosses',bosses=[identity(b['blueprint']) for b in n['finalBosses'] or []])
 maps={};encounters=[];sources={'initial-catalog.json':source_hash,'source-art.json':sha(args.source/'source-art.json')}
 for path in sorted((args.source/'maps').glob('*.json')):
  raw=read(path);q=raw['quest'];frozen=byid[q['qid']];assert q['qid'] in public_ids and not raw['issues'] and raw['gameAssemblySha256']==d['gameAssemblySha256'] and q['mapId']==frozen['mapId'] and raw['container']['setId']==frozen['containerSetId']
  projected=project_map(q,raw['map'],identity,path);projected['sourceFile']='progressed-20261109/maps/'+path.name;write(args.output/'progressed-maps'/path.name,projected)
  maps[q['qid']]=dict(publicMapSha256=sha(args.output/'progressed-maps'/path.name),mapId=q['mapId'],catalogSourceHash=frozen['sourceHash'],sourceHash=sha(path),walkableNodes=len(projected['tiles']),authoredPaths=len(projected['paths']),placedEncounters=len(projected['encounters']))
  sources['maps/'+path.name]=sha(path)
  for e in projected['encounters']:encounters.append(dict(questId=q['qid'],mapId=q['mapId'],sourceHash=sha(path),encounterId=e['id'],coordinate=e['coordinate'],gameId=e['gameId'],name=e['name'],rarity=e['rarity'],final=e['final'],pathIndices=e['pathIndices']))
 native={}
 for b in [b for p in previews.values() for b in p['bosses']]+[e for p in sorted((args.output/'progressed-maps').glob('*.json')) for e in read(p)['encounters']]:
  gid=b['gameId']
  if b['champion'] or gid in previous['nativePortraits'] or gid in native:continue
  c=characters.get(gid,{});bound=local_pack_reference('portraits/portrait_'+c['_imgID'],args.resources) if c.get('_imgID') and not c.get('_s3ImgID') else None
  if not bound:continue
  with Image.open(bound[0]) as im:
   buf=io.BytesIO();im.save(buf,'WEBP',lossless=True,exact=True,method=6);data=buf.getvalue();h=hashlib.sha256(data).hexdigest();args.assets.mkdir(parents=True,exist_ok=True);(args.assets/(h+'.webp')).write_bytes(data)
  native[gid]=dict(url='/game-quests/progressed-art/'+h+'.webp',sha256=h,character=gid,imageId=c['_imgID'],sourceBcgSha256=sha(bcg),sourceSha256=sha(bound[0]),nativePack=bound[1])
 write(args.output/'progressed.json',dict(version=1,id='public-progressed-quests-20261109-v1',exporterSha256=sha(Path(__file__)),sourceHashes=ledger['files'],captureManifestSha256=sha(args.source/'capture-manifest.json'),captureReaderSha256=sha(REPO/'scripts/game-quests/capture_progressed.py'),gameAssemblySha256=d['gameAssemblySha256'],layoutSha256=d['layoutSha256'],capturedAt=d['capturedAt'],previousSupplementSha256=sha(REPO/'src/data/game-quests/permanent.json'),archiveCatalogSha256=sha(REPO/'src/data/game-quests/catalog.json'),bcgSha256=sha(bcg),schemaSha256=sha(schema),blueprintsSha256=sha(args.evidence/'current-blueprints.json'),championsSha256=sha(args.champions),publicQuestIds=sorted(public_ids),publicSections={qid:('Story' if byid[qid]['containerSetId']=='690e3b48bca662fe207d0887' else 'Special') for qid in sorted(public_ids)},specialCollections={v[0]:v[1] for v in NEW_SETS.values()},collectionPolicy={k:dict(name=v[0],section='Special',expiryTime=sets[k]['expiryTime'],timeLimit=sets[k]['timeLimit']) for k,v in NEW_SETS.items()},bossPreviews=previews,nativePortraits=native,maps=maps,encounters=encounters))
 loaders='\n'.join(f'  {json.dumps(qid)}: () => import("./progressed-maps/{qid}.json"),' for qid in sorted(maps));(args.output/'progressed-map-loaders.js').write_text('// Generated offline. Literal lazy imports preserve deployment tracing.\nexport const progressedMapLoaders = {\n'+loaders+'\n};\n',encoding='utf-8')
 (args.output/'progressed-map-loaders.d.ts').write_text('import type { QuestMap } from "../../domain/game-quests";\nexport declare const progressedMapLoaders: Readonly<Record<string, () => Promise<{ default: QuestMap }>>>;\n',encoding='utf-8')
 print(dict(publicVariants=len(public_ids),newVariants=len(extra),newMaps=len(maps),newPlacements=len(encounters),newNativePortraits=len(native)))
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--source',type=Path,required=True);p.add_argument('--evidence',type=Path,default=Path('C:/Code/CereBro/temp/quest-data-investigation/game-only'));p.add_argument('--champions',type=Path,default=Path('C:/Code/CereBro/temp/crystals/champions.json'));p.add_argument('--resources',type=Path,default=Path('C:/Games/Marvel Contest of Champions/default/game/Champions_Data/Resources/Data'));p.add_argument('--output',type=Path,default=REPO/'src/data/game-quests');p.add_argument('--assets',type=Path,default=REPO/'web/public/game-quests/progressed-art');build(p.parse_args())
