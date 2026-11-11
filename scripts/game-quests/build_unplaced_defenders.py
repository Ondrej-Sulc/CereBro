"""Offline projection of saved ambush definitions; never creates map encounters.

Writes only the dedicated unplaced-defenders data directory and unplaced-art.
No game/session/process/database/network access. All inputs are retained files.
"""
import argparse
from collections import defaultdict
import hashlib
import io
import json
from pathlib import Path
import sys

from PIL import Image, __version__ as pillow_version
from build_source_art import local_pack_reference

REPO = Path(__file__).resolve().parents[2]
RESEARCH = REPO/'temp/quest-explorer-review/hidden-defenders-20261110'
EVIDENCE = Path('C:/Code/CereBro/temp/quest-data-investigation/game-only')
RESOURCES = Path('C:/Games/Marvel Contest of Champions/default/game/Champions_Data/Resources/Data')
PINS = {
    'researchManifest': 'b077ec9d03ae1057f2adf8143ec2764cc3033e9b6413dfd179a4cbfc1ddf8f47',
    'blueprints': '2059a0b12ab54b3a582a60371dbc10b9e24b966ae202e6ee8127d464effb2313',
    'bcg': 'b821489b5451d1d6ee0927f39a80d964f6c1d3aaf13bd76531e5f77d93deba8e',
    'schema': '9cc5236aef043cf7e5655458e790ed1f0897f67398e37af3020bca74511e97c4',
    'catalog.json': 'f1278d93fcb258e76619ace0eee16ae4f9cbd5c42e3b47a4916a74488ee74641',
    'progressed-catalog.json': 'ac62564ff31965db9165650c52f129952817e9e1c9db7b3214e1fc191e9b228c',
    'packManifest': '0baf2b2a75789331ce0cbc7e4062bcd9867387fe0b2218f7463adc34b338740d',
    'packResolver': '91640f8c4cb255847114aff6b731af5602ce391b4e7d92982ed24baa964ca62b',
    'bcgDecoder': '2d62d58c2ecf16fb18e09fc8567b401e3274815c8f0acc344e6926ed2f2f8596',
}
PORTRAIT_TOC_PINS = {
    'ui_portraits': '18b4bd4d14b67be9cb9ed562b733c2c3ecc8b8329dd3af3777aefa47dd0c945f',
    'ui_portraits_17.1': '4e70502bef31e6c5a514ad16845fc015018e21b8d621433210313e3e15779b77',
    'ui_portraits_18.0': '3b6b379c3bb366339024e39cd9902bd73a4fac56b202aff71d320150820225b9',
    'ui_portraits_18.1': '44368bd889ba7eb8d9310b2c48abcc4b572ca98c08f458df5405eeef44e53870',
    'ui_portraits_19.0': '995628438e525bbe329d6c48a592b8a92857e5eef5d763b6a2247576acd5d47e',
    'ui_portraits_19.1': '2693fc52bac48edeab4dd524cdffa6e5db73902b58945c91805ffa0ed5d3542a',
    'ui_portraits_20.0': '86906d536086c819bb0a37c5e7c42addd2d8b23530b810d9e0e084723c6834a1',
    'ui_portraits_20.1': '7f1531a012c1a8eafd69d59053e9b8f51c93ed0ebee558f2fe61af5253baf6ac',
    'ui_portraits_21.0': '3ebe5a17bb78b59c1c1bc3a45ca76813452224270177ede579c1919d3f72907a',
    'ui_portraits_21.1': 'd9be33a5246746c0f77d91f485234df85e6200e4dd33f3e77134069451e6bb2e',
    'ui_portraits_21.2': '7adedcd3fe92f8fbff0372163373794d7893e0f8dcc9a717caefa5193fe17fb6',
    'ui_portraits_21.3': '26afb78bbfa88a6e4f1c18c0a760a2ddc7d2ac005b9beec7c5c7529014c57df2',
    'ui_portraits_22.0': '0034dbab6eb7ef85d8d17b5bba4cf580fcc28ae24ff545611869a43f424c00ce',
    'ui_portraits_22.1': 'b988d749168ec5348702daeb44cc760c96e88b86c360f1534242639f5dba9686',
    'ui_portraits_23.0': 'fed892667fefde39c619920c232d1d4e034e9b3f59d9e32b5046030f2108f836',
    'ui_portraits_23.1': 'b7afb27f111e268bfff56b37da55b5f811abb556f6aa9cf7e1670793e7636d34',
    'ui_portraits_32.3': '7a88d5f22f43d4ab4dac9888054c18cd1a712624ee0caf3e5ad9b55d05f63358',
}

def sha(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def read(path): return json.loads(Path(path).read_text(encoding='utf-8-sig'))
def encoded(obj): return (json.dumps(obj, ensure_ascii=False, separators=(',', ':'), allow_nan=False)+'\n').encode('utf-8')
def write(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(encoded(obj))
def check(path, expected):
    if sha(path) != expected: raise ValueError('Pinned source drift: '+str(path))
def at_pointer(doc, pointer):
    value=doc
    for part in pointer.split('/')[1:]:
        key=part.replace('~1','/').replace('~0','~')
        value=value[int(key)] if isinstance(value,list) else value[key]
    return value

def saved_row(row, native):
    """Reconcile each audited selection to its original native array item."""
    fields = dict(bossId='bossId', blueprint='blueprint', candidateBlueprints='potentialCharacters',
                  rank='rank', level='level', signature='sigLvl', ascension='ascensionTier', type='Type')
    if any(row[k] != native[n] for k,n in fields.items()): raise ValueError('Audited native row drift')
    if row['coordinate'] is not None: raise ValueError('Unplaced row acquired a coordinate')
    if any(type(row[k]) is not int for k in ['ordinal','rank','level','signature','ascension']): raise ValueError('Unsupported native build')
    return dict(sourceIndex=row['ordinal'], bossId=row['bossId'], tierId=row['blueprint'],
        candidateTierIds=row['candidateBlueprints'], rank=row['rank'], level=row['level'],
        signature=row['signature'], ascension=row['ascension'], nativeType=row['type'])

def bind_identity(tier_id, blueprints, characters):
    bp=blueprints.get(tier_id)
    if not bp or bp['Character'] not in characters: raise ValueError('Unresolved exact Blueprint/Character')
    c=characters[bp['Character']]
    label=c.get('_friendlyNameLoc',{}).get('en')
    if not isinstance(label,str) or not label: raise ValueError('Missing native English name')
    if type(bp['Rarity']) is not int or not 1<=bp['Rarity']<=7: raise ValueError('Unsupported native rarity')
    return dict(tierId=tier_id, gameId=bp['Character'], rarity=bp['Rarity'], name=label, portraitUrl=None)

def build(args):
    check(RESEARCH/'package-manifest.json',PINS['researchManifest'])
    research_manifest=read(RESEARCH/'package-manifest.json')['files']
    for name in ['coverage-audit.json','unplaced-public-definitions.json','input-hashes.json','source-proof.json']:
        check(RESEARCH/name,research_manifest[name]['sha256'])
    if read(RESEARCH/'root-lease-TEMPLATE.json')['enabled'] is not False: raise ValueError('Supplemental collector must remain disabled')
    check(Path(__file__).with_name('build_source_art.py'),PINS['packResolver'])
    check(REPO/'scripts/mcoc_protobuf.py',PINS['bcgDecoder'])
    captured=read(RESEARCH/'unplaced-public-definitions.json')
    audit={r['qid']:r for r in read(RESEARCH/'coverage-audit.json')['rows']}
    rows=captured['rows']
    if len(rows)!=461 or len({r['qid'] for r in rows})!=138: raise ValueError('Audited finite scope changed')
    summaries={}
    inputs={}
    for name in ['catalog.json','progressed-catalog.json']:
        p=REPO/'src/data/game-quests'/name;check(p,PINS[name]);inputs['catalog/'+name]=PINS[name]
        for q in read(p):
            if q['id'] in summaries: raise ValueError('Duplicate saved catalog identity')
            summaries[q['id']]=q
    blueprint_file=args.evidence/'current-blueprints.json';check(blueprint_file,PINS['blueprints'])
    bp_rows=read(blueprint_file);blueprints={b['Blueprint']:b for b in bp_rows}
    if len(bp_rows)!=len(blueprints): raise ValueError('Ambiguous exact Blueprint')
    bcg=args.evidence/'sources/bcg-E95E28EECECC04D6A358C8FD8089D01305D0FB73.bin'
    check(bcg,PINS['bcg']);check(args.schema,PINS['schema'])
    sys.path.insert(0,str(REPO/'scripts'))
    from mcoc_protobuf import Decoder, fields
    decoder=Decoder(read(args.schema));characters={}
    for tag,_,value,_ in fields(bcg.read_bytes()):
        if tag==4:
            c=decoder.message(value,'BCGCharacterData')
            if c['Character'] in characters: raise ValueError('Ambiguous exact Character')
            characters[c['Character']]=c
    if decoder.unknown: raise ValueError('Unrecognized retained BCG schema')
    identities={};identity_evidence={};portrait_evidence={};assets={}
    tier_ids=sorted({r['blueprint'] for r in rows}|{t for r in rows for t in r['candidateBlueprints']})
    for tier in tier_ids:
        identity=bind_identity(tier,blueprints,characters);gid=identity['gameId'];c=characters[gid]
        image_id=c.get('_imgID')
        if gid not in portrait_evidence:
            if not image_id or c.get('_s3ImgID'): raise ValueError('Native local portrait source unestablished: '+gid)
            reference=local_pack_reference('portraits/portrait_'+image_id,args.resources)
            if reference is None: raise ValueError('Native portrait pack member unestablished: '+gid)
            path,pack=reference
            if pack['packManifestSha256']!=PINS['packManifest'] or pack['tocSha256']!=PORTRAIT_TOC_PINS.get(pack['pack']): raise ValueError('Native portrait manifest drift')
            with Image.open(path) as image:
                buf=io.BytesIO();image.save(buf,'WEBP',lossless=True,exact=True,method=6);content=buf.getvalue()
                width,height=image.size
            digest=hashlib.sha256(content).hexdigest();assets[digest]=content
            portrait_evidence[gid]=dict(character=gid,imageId=image_id,url='/game-quests/unplaced-art/'+digest+'.webp',
                sha256=digest,width=width,height=height,sourceSha256=sha(path),nativePack=pack,bcgSha256=PINS['bcg'])
        identity['portraitUrl']=portrait_evidence[gid]['url'];identities[tier]=identity
        identity_evidence[tier]=dict(blueprint=tier,character=gid,blueprintsSha256=PINS['blueprints'],bcgSha256=PINS['bcg'],
            schemaSha256=PINS['schema'],nameField='BCGCharacterData._friendlyNameLoc.en',imageField='BCGCharacterData._imgID')
    by_quest=defaultdict(list)
    for row in rows: by_quest[row['qid']].append(row)
    index=dict(version=1,coverage='unplaced-definitions',quests={},byGameId={})
    by_game=defaultdict(lambda: defaultdict(list));outputs={};global_capture=None
    for qid, selected in sorted(by_quest.items()):
        a=audit[qid];q=summaries[qid]
        if (q['mapId'],q['containerSetId'])!=(a['mapId'],a['setId']): raise ValueError('Saved catalog identity drift')
        if len(selected)!=a['ambushDefinitionRows'] or [r['ordinal'] for r in selected]!=list(range(len(selected))): raise ValueError('Native row order changed')
        source=Path(a['rawSource']);check(source,a['rawSourceSha256']);inputs['definitions/'+source.name]=a['rawSourceSha256']
        if source.name=='runtime-supply.json':
            if global_capture is None: global_capture=read(source)
            raw=global_capture
        else: raw=read(source)
        native_q=at_pointer(raw,a['rawPointer']+'/QuestSummarys/'+qid) if a['rawPointer'] else raw['quest']
        native_container=at_pointer(raw,a['rawPointer'])['setId'] if a['rawPointer'] else raw['container']['setId']
        if (native_q['qid'],native_q['mapId'],native_q['setId'],native_container)!=(qid,q['mapId'],q['summarySetId'],q['containerSetId']): raise ValueError('Native quest identity drift')
        if len(native_q['ambushEnemies'])!=len(selected): raise ValueError('Native ambush array length drift')
        projected=[]
        for row in selected:
            if row['sourceSha256']!=a['rawSourceSha256']: raise ValueError('Audited row source mismatch')
            native=at_pointer(raw,row['sourcePointer']);projected.append(saved_row(row,native))
            exact=identities[row['blueprint']]
            if exact['gameId']!=row['gameId'] or exact['rarity']!=row['rarity'] or [identities[t]['gameId'] for t in row['candidateBlueprints']]!=row['candidateGameIds']: raise ValueError('Audited identity drift')
            for gid in dict.fromkeys([exact['gameId']]+[identities[t]['gameId'] for t in row['candidateBlueprints']]):
                by_game[gid][qid].append(row['ordinal'])
        binding=dict(questId=qid,mapId=q['mapId'],containerSetId=q['containerSetId'],summarySetId=q['summarySetId'],catalogSourceHash=q['sourceHash'],definitionSourceHash=a['rawSourceSha256'])
        relative='quests/'+qid+'.json'
        source_file=source.relative_to(REPO).as_posix() if source.is_relative_to(REPO) else 'game-only/'+source.relative_to(args.evidence).as_posix()
        doc=dict(version=1,**binding,sourceFile=source_file,
            sourcePointer=(a['rawPointer']+'/QuestSummarys/'+qid if a['rawPointer'] else '/quest')+'/ambushEnemies',rows=projected)
        write(args.output/relative,doc);digest=sha(args.output/relative);outputs[relative]=digest
        index['quests'][qid]=dict(**binding,rowCount=len(projected),shardSha256=digest)
    index['byGameId']={gid:[dict(questId=qid,sourceIndices=indices) for qid,indices in sorted(refs.items())] for gid,refs in sorted(by_game.items())}
    write(args.output/'index.json',index);write(args.output/'identities.json',identities)
    loaders='\n'.join('  '+json.dumps(qid)+': () => import("./quests/'+qid+'.json"),' for qid in sorted(by_quest))
    (args.output/'loaders.js').write_text('// Generated offline. Selected unplaced-definition shard only.\nexport const unplacedDefenderLoaders = {\n'+loaders+'\n};\n',encoding='utf-8')
    (args.output/'loaders.d.ts').write_text('import type { UnplacedQuestRecord } from "../../../domain/game-quests/unplaced-defenders";\nexport declare const unplacedDefenderLoaders: Readonly<Record<string, () => Promise<{ default: UnplacedQuestRecord }>>>;\n',encoding='utf-8')
    args.assets.mkdir(parents=True,exist_ok=True)
    for digest,content in assets.items():
        path=args.assets/(digest+'.webp')
        if path.exists() and path.read_bytes()!=content: raise ValueError('Content-addressed asset mismatch')
        path.write_bytes(content)
    for name in ['index.json','identities.json','loaders.js','loaders.d.ts']:outputs[name]=sha(args.output/name)
    manifest=dict(version=1,id='saved-unplaced-defenders-20261110-v1',coverage='unplaced-definitions',
        generatorSha256=sha(Path(__file__)),packResolverSha256=PINS['packResolver'],bcgDecoderSha256=PINS['bcgDecoder'],
        researchManifestSha256=PINS['researchManifest'],researchFiles={n:research_manifest[n]['sha256'] for n in ['coverage-audit.json','unplaced-public-definitions.json','input-hashes.json','source-proof.json']},
        inputs=inputs,blueprintsSha256=PINS['blueprints'],bcgSha256=PINS['bcg'],schemaSha256=PINS['schema'],
        identityEvidence=identity_evidence,portraitEvidence=portrait_evidence,outputs=outputs,
        assets={digest+'.webp':digest for digest in sorted(assets)},pillowVersion=pillow_version,
        totals=dict(quests=len(by_quest),sourceRows=len(rows),primaryGameIds=len({r['gameId'] for r in rows}),
            allGameIds=len(by_game),blueprints=len(identities),portraitBindings=len(portrait_evidence),portraitAssets=len(assets)),
        semantics='Native ambush preview definitions only; no coordinates, path assignments, occurrence guarantees or probabilities. Duplicates and source order preserved. No joins to placed encounters.')
    write(args.output/'manifest.json',manifest)
    print(json.dumps(manifest['totals']))

def parser():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--evidence',type=Path,default=EVIDENCE)
    p.add_argument('--schema',type=Path,default=Path('C:/Code/CereBro/temp/crystals/schema.json'))
    p.add_argument('--resources',type=Path,default=RESOURCES)
    p.add_argument('--output',type=Path,default=REPO/'src/data/game-quests/unplaced-defenders')
    p.add_argument('--assets',type=Path,default=REPO/'web/public/game-quests/unplaced-art')
    return p

if __name__=='__main__': build(parser().parse_args())
