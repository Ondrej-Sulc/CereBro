"""Offline permanent browser supplement. Original catalog/maps remain immutable."""
import argparse
import hashlib
import io
import json
import sys
from pathlib import Path
from PIL import Image
from build_source_art import local_pack_reference, HOST, NoRedirect
from urllib.parse import urlsplit
from urllib.request import Request, build_opener

REPO = Path(__file__).resolve().parents[2]
SPECIAL = {'road_to_labyrinth': 'Road to the Labyrinth', 'danger_room': 'Realm of Legends', 'mausoleum': 'Deathless Mausoleum'}
# Reviewed exact public collection identities. Native categories do not decide permanence.
PUBLIC_SETS = {
    '690e3b48bca662fe207d0887': ('epilogue', 'Story'),
    '5404f1d507bcdbe22d4bd831': ('danger_room', 'Special'),
    '57a913c450ec3ffc44c4aaf3': ('road_to_labyrinth', 'Special'),
    '6704090b86b017125a9d43b4': ('mausoleum', 'Special'),
}
def read(p): return json.loads(p.read_text(encoding='utf-8'))
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def xy(v): return [int(v['x']),int(v['y'])] if isinstance(v,dict) else list(map(int,v))
def write(p,d): p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(d,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')

def project_map(q,m,identity,source):
    paths=[dict(index=i,coordinates=[xy(v) for v in p['tiles']]) for i,p in enumerate(m['paths'])]
    tiles,encounters=[],[]
    for t in m['walkableTiles']:
        c=xy(t);apps=[]
        for side in ['attacker','defender']:
            for i,a in enumerate(t[side+'Buffs'] or []):
                b=a['buff'];s=a['nodeSource']
                apps.append(dict(id=f'{c[0]},{c[1]}:{side}:{i}',effectId=b['id'],target=side,name=b['localizedName'],description=a['buffDescription'],rawDescription=b['localizedDesc'],amount=a['buffAmount'],extra=a['isExtra'],sourceCoordinate=xy(a['sourceCoordinate']),sourceType=s['type']['name'] if s else 'Unspecified',remainActive=s['remainActive'] if s else None,linkedTargets=[xy(v) for v in (s['bt'] or [])] if s else [],parameters={k:b[k] for k in ['value','displayValue','valueStr','quantity','buffType','buffStatMods','valueType']}))
        tiles.append(dict(coordinate=c,nodeNumber=t['nodeNumber'],start=t['start'],final=t['final'],hidden=t['hidden'],links=[xy(v) for v in t['links'] or []],portals=[dict(target=xy(p['target']),label=p['label'],randomChance=p['randomChance'],tags=p['tags']) for p in t['portalTargets'] or []],randomPortal=t['IsRandomPortal'],barrier=t['barrier'],applications=apps))
        keys=list(dict.fromkeys(([t['bossId']] if t['bossId'] else [])+[e['bossId'] for e in t['tileEntities'] or [] if e['bossId']]))
        for key in keys:
            b=q['bosses'][key]
            encounters.append(dict(id=f"{q['qid']}:{c[0]},{c[1]}:{key}",coordinate=c,bossKey=key,**identity(b['blueprint']),rank=b['rank'],level=b['level'],signature=b['sigLvl'],ascension=b['ascensionTier'],final=t['final'],candidates=[identity(t) for t in b['potentialCharacters'] or []],pathIndices=[p['index'] for p in paths if c in p['coordinates']]))
    fixed=[];crystals=[]
    for scope in ['firstCompletionRewards','masteryCompletionRewards','potentialCompletionRewards']:
        for r in q[scope] or []:
            if r['Type']=='hero': fixed.append(dict(scope=scope,quantity=r['Quantity'],**identity(r['Data'])))
            elif r['Type']=='gs': crystals.append(dict(scope=scope,quantity=r['Quantity'],token=r['Data']))
    return dict(version=1,questId=q['qid'],mapId=q['mapId'],sourceHash=sha(source),sourceFile='permanent-20261109/maps/'+source.name,capturedAt=read(source)['capturedAt'],gridDimension=m['gridDimension'],adaptive=q['scaleBosses'],tiles=tiles,paths=paths,encounters=encounters,rewards=dict(fixedChampions=fixed,possibleCrystals=crystals))

def build(args):
    for rel,digest in read(args.source/'capture-manifest.json')['sourceFiles'].items():
        assert sha(args.source/rel)==digest, 'Source hash drift: '+rel
    capture=args.source/'final-catalog.json';current=read(capture);old=read(REPO/'src/data/game-quests/catalog.json')
    assert current['gameAssemblySha256']=='01f46bb2e36c2160a8df939bbb080bcf2ee89ca15427692a10334efc90fd4abb'
    bp={b['Blueprint']:b for b in read(args.evidence/'current-blueprints.json')}
    champs={c['gameId']:{k:c[k] for k in ['id','slug','name']} for c in read(args.champions) if c.get('gameId')}
    sys.path.insert(0,str(REPO/'scripts'));from mcoc_protobuf import Decoder,fields
    schema=args.champions.parent/'schema.json';bcg=args.evidence/'sources/bcg-E95E28EECECC04D6A358C8FD8089D01305D0FB73.bin'
    dec=Decoder(read(schema));characters={}
    for tag,_,value,_ in fields(bcg.read_bytes()):
        if tag==4:
            c=dec.message(value,'BCGCharacterData');characters[c['Character']]=c
    assert not dec.unknown
    def identity(tier):
        b=bp[tier];gid=b['Character'];assert 1<=b['Rarity']<=7
        return dict(tierId=tier,gameId=gid,rarity=b['Rarity'],name=characters.get(gid,{}).get('_friendlyNameLoc',{}).get('en') or gid,champion=champs.get(gid))
    byqid={q['qid']:(s,q,si) for si,s in enumerate(current['pveSets']) for q in (s['QuestSummarys'] or {}).values()}
    permitted={q['id'] for q in old if q['containerSetId'] in PUBLIC_SETS and q['containerSetName']==PUBLIC_SETS[q['containerSetId']][0]}
    previews={};nativePortraits={};sourceHashes={capture.name:sha(capture)}
    for q in old:
        if q['id'] not in permitted:continue
        s,n,si=byqid[q['id']]
        assert n['qid']==q['id'] and n['mapId']==q['mapId'] and s['setId']==q['containerSetId'] and n['setId']==q['summarySetId']
        assert [n[k] for k in ['actIndex','chapterIndex','questIndex','difficultyId']]==[q[k] for k in ['actIndex','chapterIndex','questIndex','difficultyId']]
        previews[q['id']]=dict(catalogSourceHash=q['sourceHash'],mapId=q['mapId'],containerSetId=q['containerSetId'],sourceHash=sha(capture),sourcePointer=f"/pveSets/{si}/QuestSummarys/{q['id']}/finalBosses",bosses=[identity(b['blueprint']) for b in n['finalBosses'] or []])
    # Exact Character._imgID -> native portraits/portrait_<id>, resolved by pack membership.
    for b in [b for v in previews.values() for b in v['bosses']]:
        if b['champion'] or b['gameId'] in nativePortraits:continue
        c=characters.get(b['gameId'],{});ref='portraits/portrait_'+c['_imgID'] if c.get('_imgID') and not c.get('_s3ImgID') else None
        bound=local_pack_reference(ref,args.resources) if ref else None
        if bound:
            im=Image.open(bound[0]);buf=io.BytesIO();im.save(buf,'WEBP',lossless=True,exact=True,method=6);data=buf.getvalue();h=hashlib.sha256(data).hexdigest();asset=args.assets/(h+'.webp');asset.parent.mkdir(parents=True,exist_ok=True);asset.write_bytes(data)
            nativePortraits[b['gameId']]=dict(url='/game-quests/permanent-art/'+asset.name,sha256=h,character=b['gameId'],imageId=c['_imgID'],sourceBcgSha256=sha(bcg),sourceSha256=sha(bound[0]),nativePack=bound[1])
    maps={};occurrences=[]
    for path in sorted((args.source/'maps').glob('*.json')):
        d=read(path);q=d['quest'];assert not d['issues'] and q['qid'] in permitted and d['gameAssemblySha256']==current['gameAssemblySha256']
        frozen=next(o for o in old if o['id']==q['qid']);assert frozen['mapId']==q['mapId'] and frozen['summarySetId']==q['setId']
        projected=project_map(q,d['map'],identity,path);write(args.output/'permanent-maps'/path.name,projected)
        maps[q['qid']]=dict(publicMapSha256=sha(args.output/'permanent-maps'/path.name),mapId=q['mapId'],catalogSourceHash=frozen['sourceHash'],sourceHash=sha(path),walkableNodes=len(projected['tiles']),authoredPaths=len(projected['paths']),placedEncounters=len(projected['encounters']))
        sourceHashes['maps/'+path.name]=sha(path)
        for e in projected['encounters']:occurrences.append(dict(questId=q['qid'],mapId=q['mapId'],sourceHash=sha(path),encounterId=e['id'],coordinate=e['coordinate'],gameId=e['gameId'],name=e['name'],rarity=e['rarity'],final=e['final'],pathIndices=e['pathIndices']))
    support=read(args.source/'public-support.json');towers=[];args.retained.mkdir(parents=True,exist_ok=True)
    for t in support['towers']:
        if t['Category']['name']!='Class' or t['EndTime']!=-1:continue
        url=t['TowerPanelTexture'];u=urlsplit(url);assert u.scheme=='https' and u.netloc==HOST and u.path.startswith('/tower/') and not u.query and not u.fragment and '..' not in u.path
        native=args.cache/(hashlib.sha1(u.path.encode()).hexdigest().upper()+Path(u.path).suffix)
        saved=args.retained/(hashlib.sha256(url.encode()).hexdigest()+'.source')
        if not saved.exists():
            if native.exists():saved.write_bytes(native.read_bytes())
            elif args.fetch:
                with build_opener(NoRedirect).open(Request(url,headers={'User-Agent':'CereBro-public-art-export/1'}),timeout=20) as response:data=response.read(8*1024*1024+1)
                assert len(data)<=8*1024*1024;saved.write_bytes(data)
        art=None
        if saved.exists():
            with Image.open(saved) as im:
                assert im.format in ['JPEG','PNG','WEBP'] and im.width*im.height<=16_000_000
                buf=io.BytesIO();im.save(buf,'WEBP',lossless=True,exact=True,method=6);data=buf.getvalue();h=hashlib.sha256(data).hexdigest();asset=args.assets/(h+'.webp');asset.parent.mkdir(parents=True,exist_ok=True);asset.write_bytes(data);art=dict(url='/game-quests/permanent-art/'+asset.name,sha256=h,sourceSha256=sha(saved),width=im.width,height=im.height,sourceUrl=url)
        towers.append(dict(id=t['Id'],name=t['FriendlyName'],category=t['Category']['name'],artwork=art,sourcePointer='/towers/'+str(support['towers'].index(t))))
    sourceHashes['public-support.json']=sha(args.source/'public-support.json');sourceHashes['tower-membership.json']=sha(args.source/'tower-membership.json')
    write(args.output/'permanent.json',dict(version=1,id='public-permanent-quests-20261109-v1',exporterSha256=sha(Path(__file__)),resolverSha256=sha(Path(__file__).with_name('build_source_art.py')),sourceHashes=sourceHashes,bcgSha256=sha(bcg),schemaSha256=sha(schema),blueprintsSha256=sha(args.evidence/'current-blueprints.json'),championsSha256=sha(args.champions),publicQuestIds=sorted(permitted),publicSections={q['id']:PUBLIC_SETS[q['containerSetId']][1] for q in old if q['id'] in permitted},collectionPolicy={k:dict(name=v[0],section=v[1]) for k,v in PUBLIC_SETS.items()},specialCollections=SPECIAL,bossPreviews=previews,nativePortraits=nativePortraits,maps=maps,encounters=occurrences,towers=towers,unavailableCollections=['Shooting Stars',"Grandmaster’s Gauntlet",'Epoch of Pain','Wheel of Fate','Eternity of Pain Acceptance','Abyss of Legends','Labyrinth of Legends','Revenge of Legends','Crucible'],limits='Only three Special collections resident on chosen account. Missing collections are unobserved, not nonexistent. Tower reported totals excluded: no block/floor membership captured. Boss previews are not placed encounter occurrences.'))
    loaders='\n'.join(f'  {json.dumps(qid)}: () => import("./permanent-maps/{qid}.json"),' for qid in sorted(maps))
    (args.output/'permanent-map-loaders.ts').write_text('// Generated offline. Selected maps only.\nexport const permanentMapLoaders = {\n'+loaders+'\n};\n',encoding='utf-8')
    print(json.dumps(dict(permanentQuests=len(permitted),newMaps=len(maps),newPlacements=len(occurrences),bossPreviews=sum(len(v['bosses']) for v in previews.values()),nativeNpcPortraits=len(nativePortraits),towers=len(towers))))

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--source',type=Path,required=True);p.add_argument('--evidence',type=Path,default=Path('C:/Code/CereBro/temp/quest-data-investigation/game-only'));p.add_argument('--champions',type=Path,default=Path('C:/Code/CereBro/temp/crystals/champions.json'));p.add_argument('--resources',type=Path,default=Path('C:/Games/Marvel Contest of Champions/default/game/Champions_Data/Resources/Data'));p.add_argument('--cache',type=Path,default=Path('C:/Users/ossul/AppData/LocalLow/Kabam/Champions/asset_cache/files'));p.add_argument('--retained',type=Path,default=REPO/'temp/quest-explorer-review/permanent-20261109/tower-art');p.add_argument('--output',type=Path,default=REPO/'src/data/game-quests');p.add_argument('--assets',type=Path,default=REPO/'web/public/game-quests/permanent-art');p.add_argument('--fetch',action='store_true');build(p.parse_args())
