"""Project saved native boss-display booleans onto existing public placements only.

Offline and deterministic: no game/process/network/database imports. Existing map
sources and identities are immutable. Missing source files are explicitly unresolved;
source or placement disagreements stop the build instead of inventing evidence.
"""
import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path

REPO=Path(__file__).resolve().parents[2]
DIRECTORIES=('maps','permanent-maps','progressed-maps','act10-maps')
FLAGS=('tileIsFinalBoss','tileShouldDisplayFinalBossIcon','bossIsFinalBoss','bossMetadataFinalBoss')


def require(condition,message):
    if not condition:raise ValueError(message)


def read(path):return json.loads(path.read_bytes())
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def encoded(value):return (json.dumps(value,ensure_ascii=False,separators=(',',':'),allow_nan=False)+'\n').encode('utf-8')


def coordinate(tile):
    values=[tile.get('x'),tile.get('y')]
    require(all(type(value) in (int,float) and value==int(value) for value in values),'Invalid source coordinate')
    return tuple(map(int,values))


def wire_flag(container,key):
    if key not in container:return None
    value=container[key]
    require(type(value) is bool,'Present native flag is not boolean')
    return value


def documents(public,raw,act10):
    if 'pveSets' in raw:
        matches=[(group['QuestSummarys'][public['questId']],group['QuestMaps'][public['questId']])
                 for group in raw['pveSets'] if public['questId'] in (group.get('QuestSummarys') or {})
                 and public['questId'] in (group.get('QuestMaps') or {})]
        require(len(matches)==1,'Ambiguous saved runtime map')
        return matches[0]
    if act10:
        require(raw.get('requestedQuestId')==public['questId'],'Act10 requested identity mismatch')
        return raw['data'],raw['map']
    return raw['quest'],raw['map']


def project_flags(public,raw,raw_hash,act10=False):
    require(raw_hash==public['sourceHash'],'Raw source hash mismatch')
    quest,source_map=documents(public,raw,act10)
    require((quest['qid'],quest['mapId'])==(public['questId'],public['mapId']),'Raw quest/map identity mismatch')
    tiles=([tile for row in source_map['grid'] for tile in row if tile and tile.get('walkable')]
           if act10 else source_map['walkableTiles'])
    by_coordinate={coordinate(tile):tile for tile in tiles}
    require(len(by_coordinate)==len(tiles),'Duplicate raw tile coordinate')
    bosses=quest['bossTable'] if act10 else quest['bosses']
    result=[];ids=set()
    for encounter in public['encounters']:
        require(encounter['id'] not in ids,'Duplicate public encounter identity');ids.add(encounter['id'])
        location=tuple(encounter['coordinate']);key=encounter['bossKey']
        require(location in by_coordinate and key in bosses,'Missing exact placed tile/boss')
        tile=by_coordinate[location];boss=bosses[key]
        placed=([tile['boss']] if tile.get('boss') else [])+list(tile.get('entities') or {}) if act10 else (
            ([tile['bossId']] if tile.get('bossId') else [])+[entity['bossId'] for entity in tile.get('tileEntities') or [] if entity.get('bossId')])
        require(key in placed,'Boss table entry is not placed at the exact coordinate')
        native=dict(tileIsFinalBoss=wire_flag(tile,'isFinalBoss'),
                    tileShouldDisplayFinalBossIcon=wire_flag(tile.get('metadata') or {},'shouldDisplayFinalBossIcon'),
                    bossIsFinalBoss=wire_flag(boss,'isFinalBoss'),
                    bossMetadataFinalBoss=wire_flag(boss,'metadataFinalBoss' if act10 else 'isMetaDataFinalBoss'))
        if act10:
            # This already-published normalization is pinned by build() below.
            # Its false defaults are constructor-proven; no absent legacy field
            # is treated as negative evidence by this exporter.
            saved=public.get('nativeBossFlags',{}).get(encounter['id'])
            require(isinstance(saved,dict) and set(saved)==set(FLAGS),'Missing pinned Act10 flags')
            require(all(type(saved[field]) is bool for field in FLAGS),'Invalid normalized Act10 flags')
            for field,value in native.items():
                require(value is None or type(value) is bool,'Malformed Act10 wire flag')
                require(saved[field]==(value if value is not None else False),'Act10 normalized/wire flag mismatch')
            native={field:saved[field] for field in FLAGS}
        else:
            require(all(type(native[field]) is bool for field in FLAGS),'Captured flag missing or not boolean')
        result.append(dict(id=encounter['id'],coordinate=list(location),bossKey=key,**native))
    return dict(questId=public['questId'],mapId=public['mapId'],sourceHash=public['sourceHash'],encounters=result)


def source_path(public,directory,original_root,supplement_root):
    relative=Path(public['sourceFile'])
    require(not relative.is_absolute() and '..' not in relative.parts,'Invalid relative source path')
    prefix={'maps':('expansion','continuation'),'permanent-maps':('permanent-20261109',),
            'progressed-maps':('progressed-20261109',),'act10-maps':('act10-backend-20261110',)}[directory]
    require(relative.parts[0] in prefix,'Unexpected saved source collection')
    return (original_root if directory=='maps' else supplement_root)/relative


def build(public_root,original_root,supplement_root):
    act10_pin=read(public_root/'act10.json')['normalizerSha256']
    require(sha(Path(__file__).with_name('act10_normalizer.py'))==act10_pin,'Published Act10 normalizer pin drift')
    observations=[];unresolved=[];proof=[];counts=Counter();by_directory={};bound={}
    for directory in DIRECTORIES:
        local=Counter()
        for path in sorted((public_root/directory).glob('*.json')):
            public=read(path);local['physicalMaps']+=1;counts['physicalMaps']+=1
            source=source_path(public,directory,original_root,supplement_root)
            identity={field:public[field] for field in ('questId','mapId','sourceHash')}
            if not source.is_file():
                unresolved.append(dict(**identity,code='saved-source-unavailable'))
                local['unresolvedMaps']+=1;counts['unresolvedMaps']+=1
                continue
            raw_bytes=source.read_bytes();raw_hash=hashlib.sha256(raw_bytes).hexdigest()
            require(raw_hash==public['sourceHash'],f'Source hash mismatch for {path.name}')
            raw=json.loads(raw_bytes);del raw_bytes
            observation=project_flags(public,raw,raw_hash,act10=directory=='act10-maps')
            key=tuple(identity.values())
            if key in bound:require(bound[key]==observation,'Conflicting duplicate source tuple')
            else:observations.append(observation);bound[key]=observation
            positive=sum(any(encounter[field] for field in FLAGS) for encounter in observation['encounters'])
            additional=sum(any(row[field] for field in FLAGS) and not previous['final'] for row,previous in zip(observation['encounters'],public['encounters']))
            for target in (counts,local):
                target['verifiedMaps']+=1;target['placedEncounters']+=len(observation['encounters'])
                target['nativeFlaggedEncounters']+=positive;target['legacyFinalEncounters']+=sum(encounter['final'] for encounter in public['encounters'])
                target['additionalNativeFlaggedEncounters']+=additional
            proof.append(dict(publicFile=f'{directory}/{path.name}',publicSha256=sha(path),sourceFile=str(source.resolve()),
                              sourceSha256=raw_hash,placements=len(observation['encounters']),nativeFlaggedEncounters=positive,
                              nativeBooleanBasis='pinned-act10-normalizer-with-raw-verification' if directory=='act10-maps' else 'all-four-explicit-captured-booleans'))
        by_directory[directory]=dict(local)
    observations.sort(key=lambda row:(row['questId'],row['mapId'],row['sourceHash']))
    coverage=dict(counts,distinctQuestIds=len({row['questId'] for row in observations}),sourceTuples=len(observations),
                  unresolvedMaps=len(unresolved),byDirectory=by_directory)
    supplement=dict(version=1,maps=observations,coverage=coverage,unresolved=unresolved)
    evidence=dict(version=1,exporterSha256=sha(Path(__file__)),act10NormalizerSha256=act10_pin,
                  supplementalSha256=hashlib.sha256(encoded(supplement)).hexdigest(),coverage=coverage,sources=proof,
                  policy='Existing exact placements only; all four native booleans retained, no finish/identity/name/rarity inference.')
    return supplement,evidence


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--public-root',type=Path,default=REPO/'src/data/game-quests')
    parser.add_argument('--original-root',type=Path,default=REPO/'temp/quest-data-investigation/game-only')
    parser.add_argument('--supplement-root',type=Path,required=True)
    parser.add_argument('--output',type=Path,default=REPO/'src/data/game-quests/boss-display.json')
    parser.add_argument('--proof',type=Path,default=REPO/'temp/quest-map-bosses-20261117/boss-display-source-proof.json')
    parser.add_argument('--verify',action='store_true')
    args=parser.parse_args();supplement,proof=build(args.public_root,args.original_root,args.supplement_root)
    for path,value in ((args.output,supplement),(args.proof,proof)):
        data=encoded(value)
        if args.verify:require(path.read_bytes()==data,f'Output bytes differ: {path}')
        else:path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
    print(json.dumps(dict(verified=args.verify,sha256=proof['supplementalSha256'],coverage=supplement['coverage'])))


if __name__=='__main__':main()
