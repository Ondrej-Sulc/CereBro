"""Deterministic, offline spawn-region display layer; never rewrites native encounters.

Native region geometry is combined with explicitly attributed historical defender
associations, following the user's approved representative-marker presentation.
"""
import argparse
from collections import deque
import hashlib
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
RESEARCH=ROOT/'temp/quest-explorer-review/hidden-placement-rethink-20261111'
DEST=ROOT/'src/data/game-quests/spawn-regions'
PINS={
 'native-regions/current-native-regions.json':'0133779556c0ef7624f34785b4c8f5a49831f52a3989cfbb8941f88195510646',
 'retained/region-evidence.json':'b4971d3c4c50ecaaf7756e0f5cf98abc263d2c67dde8494696da6f22f1d80c35',
 'retained/historical-overlay.json':'055ecafd503701f87c91d7a4ed7180133264dbe7aab4061775bb73d657952789',
}
PUBLISHED_PINS={
 'src/data/game-quests/unplaced-defenders/identities.json':'299159fb2a8e3e45c940ee39079221a0342dd62e393d4695493885bb18bd01c1',
 'src/data/game-quests/unplaced-defenders/quests/realm3.json':'4f38805b8e7e0776fc18e9bfeecb0ef7d3a46ca4e1f9b7c08039a419f8dbe0f8',
 'src/data/game-quests/unplaced-defenders/quests/eq_labyrinth.json':'53268e3d21cef8695ed1aeaa34b9583756930160a4cf76de086ad575f91f36ad',
 'src/data/game-quests/progressed-maps/realm3.json':'67b27f2e12b3b2e659412be4b9c3541234e79a594a4d2ce157ac0ba6de1aba49',
 'src/data/game-quests/progressed-maps/eq_labyrinth.json':'d23863eed2dd3254d0ceb5ae5e12c1d8dacdb9e8d7b362736950751d20b5d774',
}
ASSETS={'realm3':'c85868f4f67c2e80a86a8f06ce54ca37b46fa8a3','eq_labyrinth':'70d1453d8d3526c6888cbf08848cd6a01ba3e908'}

def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def read(path):return json.loads(Path(path).read_text(encoding='utf-8-sig'))
def encode(value):return (json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False)+'\n').encode('utf-8')

def verify_sources():
    for name,pin in PINS.items():assert sha(RESEARCH/name)==pin, 'Research source drift'
    for name,pin in PUBLISHED_PINS.items():assert sha(ROOT/name)==pin, 'Published source drift'
    native=read(RESEARCH/'native-regions/current-native-regions.json')
    for source in native['nativeSources']:
        path=(RESEARCH/source['path']).resolve()
        assert path.is_relative_to(RESEARCH.resolve()) and sha(path)==source['sha256'], 'Native receipt drift'
    return {'native':native,'historical':read(RESEARCH/'retained/region-evidence.json'),
            'overlay':read(RESEARCH/'retained/historical-overlay.json'),
            'identities':read(ROOT/'src/data/game-quests/unplaced-defenders/identities.json'),
            'maps':{q:read(ROOT/f'src/data/game-quests/progressed-maps/{q}.json') for q in ASSETS},
            'unplaced':{q:read(ROOT/f'src/data/game-quests/unplaced-defenders/quests/{q}.json') for q in ASSETS}}

def visible_links(map_data):
    """Compress only hidden intermediate tiles, preserving visible graph edges."""
    tiles={tuple(t['coordinate']):t for t in map_data['tiles']}
    result={p:[] for p,t in tiles.items() if not t['hidden']}
    for point in result:
        queue=deque(tuple(p) for p in tiles[point]['links']);seen=set()
        while queue:
            other=queue.popleft()
            if other in seen:continue
            seen.add(other)
            assert other in tiles
            if not tiles[other]['hidden']:
                if other!=point:result[point].append(other)
            else:queue.extend(tuple(p) for p in tiles[other]['links'])
        result[point]=sorted(set(result[point]))
    return result

def choose_anchor(points,links,fixed):
    """Graph medoid on members, or nearest actual member to their centroid.

    Ties use centroid distance then lexical coordinate, independent of input order.
    An existing fixed portrait is avoided whenever another member is available.
    """
    points=sorted(set(points));assert points
    members=set(points);graph={p:set() for p in points}
    for point in points:
        for other in links.get(point,[]):
            if other in members:graph[point].add(other);graph[other].add(point)
    eligible=[p for p in points if p not in fixed] or points
    sums={}
    for point in eligible:
        distances={point:0};queue=deque([point])
        while queue:
            current=queue.popleft()
            for other in graph[current]:
                if other not in distances:distances[other]=distances[current]+1;queue.append(other)
        if len(distances)==len(points):sums[point]=sum(distances.values())
    n=len(points);sx=sum(p[0] for p in points);sy=sum(p[1] for p in points)
    centroid=lambda p:(p[0]*n-sx)**2+(p[1]*n-sy)**2
    if len(sums)==len(eligible):chosen=min(eligible,key=lambda p:(sums[p],centroid(p),p))
    else:chosen=min(eligible,key=lambda p:(centroid(p),p))
    return list(chosen)

def project_quest(qid,sources):
    current=next(q for q in sources['native']['quests'] if q['questId']==qid)
    historical=next(q for q in sources['historical']['quests'] if q['questId']==qid)
    normalized=sources['maps'][qid];baseline=sources['unplaced'][qid]
    assert current['questId']==current['mapId']==normalized['questId']==normalized['mapId']==qid
    assert normalized['sourceHash']==baseline['definitionSourceHash']
    assert current['summarySetId']==baseline['summarySetId']
    native_rows=current['ambushDefinitions'];old_rows=baseline['rows']
    assert len(native_rows)==len(old_rows)
    for ordinal,(observed,old) in enumerate(zip(native_rows,old_rows)):
        now=observed['definition']
        assert observed['sourceOrdinal']==old['sourceIndex']==ordinal
        assert (now['id'],now['character'],now['characters'],now['rank'],now['level'],now['sig_lvl'])==(
            old['bossId'],old['tierId'],old['candidateTierIds'],old['rank'],old['level'],old['signature'])
    zones={z['regionId']:[(p['x'],p['y']) for p in z['members']] for z in current['regions']}
    assert len(zones)==len(current['regions'])
    tiles={tuple(t['coordinate']):t for t in normalized['tiles']}
    all_points=set()
    for points in zones.values():
        assert len(points)==len(set(points)) and not all_points.intersection(points)
        assert all(p in tiles and not tiles[p]['hidden'] for p in points)
        all_points.update(points)
    overlay=sources['overlay'][ASSETS[qid]]['spawnZoneMap']
    links=visible_links(normalized);fixed={tuple(e['coordinate']) for e in normalized['encounters']}
    covered=set();regions=[];bindings={}
    for region_id,binding in sorted(overlay.items()):
        blueprint=binding['enemy'];points=sorted(zones[region_id])
        old_region=next(r for r in historical['regions'] if r['regionId']==region_id)
        assert old_region['historicalBlueprint']==blueprint
        assert set(points)=={(p['x'],p['y']) for p in old_region['coordinates']}
        matches=[r for r in native_rows if r['definition']['character']==blueprint]
        assert matches, 'No exact primary native blueprint'
        assert all(r['definition']['characters']==[blueprint] for r in matches), 'Unreviewed alternative defender pool'
        profiles={(r['definition']['rank'],r['definition']['level'],r['definition']['sig_lvl'],old_rows[r['sourceOrdinal']]['ascension']) for r in matches}
        assert len(profiles)==1, 'Ambiguous recorded builds'
        rank,level,signature,ascension=next(iter(profiles))
        assert all((r['rank'],r['level'],r['signatureLevel'])==(rank,level,signature) for r in old_region['nativeDefinitionMatches'])
        identity=sources['identities'][blueprint];url=identity['portraitUrl']
        assert url and url.startswith('/game-quests/unplaced-art/')
        portrait=ROOT/'web/public'/url.lstrip('/')
        assert portrait.is_file() and sha(portrait)==portrait.stem
        identifier=qid+':'+region_id
        regions.append({'id':identifier,'anchor':choose_anchor(points,links,fixed),'coordinates':[list(p) for p in points],
            'defender':{'tierId':blueprint,'gameId':identity['gameId'],'name':identity['name'],'rarity':identity['rarity'],
                'imageUrl':url,'rank':rank,'level':level,'signature':signature,'ascensionTier':ascension},
            'definitionCandidateCount':len(matches)})
        ordinals=[r['sourceOrdinal'] for r in matches];covered.update(ordinals)
        bindings[identifier]={'regionId':region_id,'definitionOrdinals':ordinals,'blueprint':blueprint,'portraitSha256':portrait.stem}
    record={'version':1,'questId':qid,'mapId':qid,'mapSourceHash':normalized['sourceHash'],
        'unmappedDefinitionCount':len(native_rows)-len(covered),'regions':regions,
        'provenance':{'geometry':'game','defenderBindings':'archived-reference'}}
    proof={'nativeRegionGeometry':'game','defenderAssociations':'archived-reference',
        'nativeRegionCount':len(zones),'displayedRegionCount':len(regions),'unlabelledNativeRegionIds':sorted(set(zones)-set(overlay)),
        'regionBindings':bindings,'historicalDetailAssetId':ASSETS[qid],
        'historicalDetailUrl':historical['historicalDetailUrl'],
        'historicalSourceTimestamp':historical['historicalSourceTimestamp'],
        'nativeObservedAt':current['source']['observedAt'],
        'baselineMapCapturedAt':normalized['capturedAt'],
        'baselineAscensionSource':'published native-memory preview row; not inferred from missing fresh fields',
        'representativeAnchorPolicy':'member-tile graph medoid, centroid-member fallback when disconnected; avoids fixed portraits when possible'}
    return record,proof

def build(output=DEST):
    sources=verify_sources();output=Path(output);output.mkdir(parents=True,exist_ok=True)
    index={'version':1,'quests':{}}
    proof={'version':1,'generatorSha256':sha(__file__),'researchSourcePins':PINS,'publishedSourcePins':PUBLISHED_PINS,
        'userPresentationDecision':'Display a representative midpoint portrait and highlight possible region tiles; no exact native encounter claim.',
        'overlaySource':{k:sources['historical']['overlaySource'][k] for k in ('url','module','sha256')},'quests':{}}
    for qid in ASSETS:
        record,details=project_quest(qid,sources);data=encode(record)
        (output/f'{qid}.json').write_bytes(data)
        index['quests'][qid]={'mapId':qid,'mapSourceHash':record['mapSourceHash'],'regionCount':len(record['regions']),
            'unmappedDefinitionCount':record['unmappedDefinitionCount'],'recordSha256':hashlib.sha256(data).hexdigest()}
        proof['quests'][qid]=details
    (output/'index.json').write_bytes(encode(index));(output/'provenance.json').write_bytes(encode(proof))
    return index

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',type=Path,default=DEST)
    result=build(parser.parse_args().output)
    print(json.dumps({'quests':len(result['quests']),'displayRegions':sum(q['regionCount'] for q in result['quests'].values())}))
