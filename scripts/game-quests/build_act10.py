"""Deterministic offline Act10 increment. Immutable earlier corpus; no game access."""
import argparse
import hashlib
import json
import sys
from pathlib import Path
from act10_normalizer import IDS,normalize,require

REPO=Path(__file__).resolve().parents[2]
EVIDENCE=REPO/'temp/quest-explorer-review/act10-backend-20261110'
RUN=EVIDENCE/'revision-2/runs/3fa58d9e0e664f85bfc1b05d4c772f64'
SUPPORT=Path('C:/Code/CereBro/temp/quest-data-investigation/game-only')
BCG_SHA='b821489b5451d1d6ee0927f39a80d964f6c1d3aaf13bd76531e5f77d93deba8e'
BP_SHA='2059a0b12ab54b3a582a60371dbc10b9e24b966ae202e6ee8127d464effb2313'
SCHEMA_SHA='9cc5236aef043cf7e5655458e790ed1f0897f67398e37af3020bca74511e97c4'

def read(p):return json.loads(p.read_text(encoding='utf8'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,d):
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(d,ensure_ascii=False,separators=(',',':'),allow_nan=False)+'\n',encoding='utf8',newline='\n')

def source_documents(source):
    end=read(source/'run-receipt.json')
    require(end['stopCode']=='completed' and end['reservedRequests']==end['savedDefinitions']==16,'Incomplete Act10 run')
    require({p.stem for p in source.glob('epilogue*.json')}==set(IDS),'Act10 source set mismatch')
    docs={};pins={}
    for i,qid in enumerate(IDS,1):
        p=source/(qid+'.json');r=source/f'{i:02d}-receipt.json';receipt=read(r)
        require(receipt['qid']==qid and receipt['status']==200 and receipt['saved'] and sha(p)==receipt['publicShardSha256'],'Act10 receipt hash mismatch')
        docs[qid]=read(p)
        require(docs[qid]['responseSha256']==receipt['responseSha256'],'Act10 body hash mismatch')
        pins[qid+'.json']=sha(p);pins[r.name]=sha(r)
    pins['run-receipt.json']=sha(source/'run-receipt.json')
    return docs,pins

def build(source,output):
    docs,pins=source_documents(source)
    proof=read(EVIDENCE/'integration/native-normalization-proof.json')
    native_sources={}
    for row in proof['methods']:
        require(sha(Path(row['source']))==row['sha256'],'Native normalization proof drift')
        native_sources[Path(row['source']).name]=row['sha256']
    bp_path=SUPPORT/'current-blueprints.json';bcg=SUPPORT/'sources/bcg-E95E28EECECC04D6A358C8FD8089D01305D0FB73.bin'
    schema=Path('C:/Code/CereBro/temp/crystals/schema.json');champions=Path('C:/Code/CereBro/temp/crystals/champions.json')
    require(sha(bp_path)==BP_SHA and sha(bcg)==BCG_SHA and sha(schema)==SCHEMA_SHA,'Frozen identity input drift')
    blueprints={b['Blueprint']:b for b in read(bp_path)}
    playable={c['gameId']:{k:c[k] for k in ['id','slug','name']} for c in read(champions) if c.get('gameId')}
    sys.path.insert(0,str(REPO/'scripts'));from mcoc_protobuf import Decoder,fields
    decoder=Decoder(read(schema));characters={}
    for tag,wire,value,_ in fields(bcg.read_bytes()):
        if tag==4:
            c=decoder.message(value,'BCGCharacterData');characters[c['Character']]=c
    require(not decoder.unknown,'Unknown BCG character schema')
    def identity(tier):
        require(tier in blueprints,'Unresolved exact blueprint')
        b=blueprints[tier];gid=b['Character'];require(gid in characters,'Unresolved exact character')
        name=(characters[gid].get('_friendlyNameLoc') or {}).get('en')
        require(isinstance(name,str) and bool(name) and not name.startswith('#!#'),'Unresolved character name')
        return dict(tierId=tier,gameId=gid,rarity=b['Rarity'],name=name,champion=playable.get(gid))
    catalog={q['id']:q for q in read(REPO/'src/data/game-quests/catalog.json')}
    old_rewards=read(REPO/'src/data/game-quests/rewards.json')
    portraits={**read(REPO/'src/data/game-quests/permanent.json')['nativePortraits'],**read(REPO/'src/data/game-quests/progressed.json')['nativePortraits']}
    maps={};encounters=[];rewards={};sources={};totals=dict(maps=0,tiles=0,paths=0,placements=0,portals=0,applications=0);omitted={};npc={}
    for qid in IDS:
        p=source/(qid+'.json');doc=docs[qid];source_hash=sha(p);q=catalog[qid]
        m,scopes,unplaced=normalize(doc,identity,source_hash,p.relative_to(REPO/'temp/quest-explorer-review').as_posix(),q)
        maps[qid]=dict(mapId=qid,catalogSourceHash=q['sourceHash'],sourceHash=source_hash,walkableNodes=len(m['tiles']),authoredPaths=len(m['paths']),placedEncounters=len(m['encounters']))
        write(output/'act10-maps'/p.name,m);maps[qid]['publicMapSha256']=sha(output/'act10-maps'/p.name)
        omitted[qid]=unplaced
        for e in m['encounters']:
            encounters.append({k:m[k] for k in ['questId','mapId','sourceHash']}|dict(encounterId=e['id'],**{k:e[k] for k in ['coordinate','gameId','name','rarity','final','pathIndices']}))
            if e['champion'] is None:
                art=portraits.get(e['gameId']);require(art and art['character']==e['gameId'] and art['sourceBcgSha256']==BCG_SHA,'Unverified NPC portrait binding')
                asset=REPO/'web/public'/art['url'].lstrip('/');require(sha(asset)==art['sha256'],'NPC portrait asset drift');npc[e['gameId']]=art
        # Reuse reviewed display metadata only for a fully matching item row;
        # native scope/quantity and this fresh observation remain independent.
        previous=old_rewards['owners'].get(old_rewards['quests'].get(qid,''),{})
        priorrows=[r for rows in previous.get('scopes',{}).values() for r in rows]
        for rows in scopes.values():
            for row in rows:
                exact=[r for r in priorrows if all(r.get(k)==row.get(k) for k in ['type','data','quantity','minQuantity','maxQuantity','action'])]
                names={r.get('displayName') for r in exact if r.get('displayName')}
                if len(names)==1:row['displayName']=next(iter(names))
                if row['type']=='hero':row['identity']=identity(row['data'])
        rewards[qid]=dict(key='act10:'+qid,kind='quest',ownerId=qid,containerSetId=q['containerSetId'],mapId=qid,
            catalogSourceHash=q['sourceHash'],sourceHash=source_hash,sourcePointer='/data/completionRewards',scopes=scopes)
        sources[source_hash]=dict(capturedAt=doc['capturedAt'])
        for name,value in [('maps',1),('tiles',len(m['tiles'])),('paths',len(m['paths'])),('placements',len(m['encounters'])),
            ('portals',sum(len(t['portals']) for t in m['tiles'])),('applications',sum(len(t['applications']) for t in m['tiles']))]:totals[name]+=value
    require(totals==dict(maps=16,tiles=249,paths=37,placements=32,portals=13,applications=271),'Act10 actual coverage drift')
    loaders='\n'.join(f'  {json.dumps(qid)}: () => import("./act10-maps/{qid}.json"),' for qid in IDS)
    (output/'act10-map-loaders.js').write_text('// Generated offline; exact literal identities only.\nexport const act10MapLoaders = {\n'+loaders+'\n};\n',encoding='utf8',newline='\n')
    (output/'act10-map-loaders.d.ts').write_text('import type { QuestMap } from "../../domain/game-quests";\nexport declare const act10MapLoaders: Readonly<Record<string, () => Promise<{ default: QuestMap }>>>;\n',encoding='utf8',newline='\n')
    write(output/'act10.json',dict(version=1,id='public-act10-20261110-v1',bcgSha256=BCG_SHA,maps=maps,encounters=encounters,rewards=rewards,sources=sources,
        coverage=totals,modifierCoverage=dict(applications=271,distinctIds=149,resolvedDefinitions=0,verifiedIcons=0),nativePortraits=npc,
        unplacedBossTableKeys=omitted,sourceHashes=pins,identityInputs=dict(blueprintsSha256=BP_SHA,bcgSha256=BCG_SHA,schemaSha256=SCHEMA_SHA,championsSha256=sha(champions)),
        nativeConstructorSources=native_sources,normalizationProofSha256=sha(EVIDENCE/'integration/native-normalization-proof.json'),
        exporterSha256=sha(Path(__file__)),normalizerSha256=sha(Path(__file__).with_name('act10_normalizer.py'))))
    print(json.dumps(totals))

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--source',type=Path,default=RUN);p.add_argument('--output',type=Path,default=REPO/'src/data/game-quests');a=p.parse_args();build(a.source,a.output)
