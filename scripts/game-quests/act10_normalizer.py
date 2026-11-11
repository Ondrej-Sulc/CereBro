"""Pure public-wire normalization. No game reader, process, HTTP or live imports."""
import copy
import hashlib
import json

IDS = (
    'epilogue_ch01_q01','epilogue_ch01_q02','epilogue_ch01_q03','epilogue_ch01_q04',
    'epilogue_ch02_q01','epilogue_ch02_q02','epilogue_ch02_q03','epilogue_ch02_q04',
    'epilogue_ch03_q01','epilogue_ch03_q02','epilogue_ch03_q03','epilogue_ch03_q04',
    'epilogue_ch04_q01','epilogue_ch04_q02','epilogue_ch04_q03','epilogue_ch04_q04',
)
SET_ID = '690e3b48bca662fe207d0887'


def require(condition, message):
    if not condition: raise ValueError(message)


def digest(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode()).hexdigest()


def xy(value):
    require(type(value) is dict and all(type(value.get(k)) is int for k in ('x','y')), 'Invalid native coordinate')
    return [value['x'],value['y']]


def text(value):
    if value is None: return ''
    if isinstance(value,str): return value
    require(type(value) is dict and isinstance(value.get('en',''),str),'Unsupported localized text')
    return value.get('en','')


def reward_rows(rows):
    require(isinstance(rows,list),'Reward array required')
    result=[]
    for i,r in enumerate(rows):
        typ=r.get('t',r.get('type')); identity=r.get('n',r.get('data'));quantity=r.get('q',r.get('quantity',0))
        require(isinstance(typ,str) and isinstance(identity,str) and type(quantity) is int,'Invalid reward identity/quantity')
        row=dict(sourceIndex=i,type=typ,data=identity,quantity=quantity)
        for aliases,name in [(('min',),'minQuantity'),(('max',),'maxQuantity'),(('a','action'),'action'),(('h',),'header'),(('f',),'footer')]:
            value=next((r[k] for k in aliases if k in r),None)
            if value is not None: row[name]=value
        result.append(row)
    return result


def normalize(doc, identity, source_hash, source_file, catalog):
    """Supported shapes are native-proven and actual-corpus checked; no fills."""
    q,m=doc['data'],doc['map'];qid=doc['requestedQuestId']
    require(not any(m.get(k) for k in ('rotatingGlobalBuff','buffPool','attackTactics')),'Unsupported map modifier inputs')
    require(qid in IDS and q['qid']==qid==q['mapId']==catalog['mapId'] and q['setId']==catalog['summarySetId']==SET_ID,'Act10 identity mismatch')
    require([q[k] for k in ('act','chapter','quest')]==[catalog[k] for k in ('actIndex','chapterIndex','questIndex')],'Act10 hierarchy mismatch')
    dimension=m['gridDimension'];grid=m['grid']
    require(type(dimension) is int and len(grid)==dimension and all(len(row)==dimension for row in grid),'Invalid grid dimensions')
    paths=[dict(index=i,coordinates=[xy(p) for p in row['path']]) for i,row in enumerate(m['pathData'])]
    require(paths and all(p['coordinates'] for p in paths),'Empty authored path')
    tiles=[];encounters=[];used=set();assignment_count=0;native_flags={}
    for ix,row in enumerate(grid):
        for iy,t in enumerate(row):
            if not t or not t.get('walkable'):continue
            c=xy(t);require(c==[ix,iy],'Native grid/coordinate mismatch')
            applications=[]
            # Current finite corpus has only typed Local groups. Refuse new
            # propagation/selection forms instead of dropping their assignments.
            require(not t.get('ab') and not t.get('db'),'Unimplemented legacy application input')
            require(not any(e.get('all_buffs') for e in (t.get('entities') or {}).values()),'Unimplemented entity modifiers')
            for gi,group in enumerate(t.get('all_buffs') or []):
                require(group.get('typ')=='local' and not group.get('bt') and not group.get('buffsp'),'Unsupported modifier source/propagation')
                require(type(group.get('attk',False)) is bool and type(group.get('remainActive',False)) is bool,'Invalid modifier flags')
                target='attacker' if group.get('attk',False) else 'defender'
                for bi,b in enumerate(group['buffs']):
                    require(b.get('t')=='buff' and isinstance(b.get('n'),str) and type(b.get('q')) is int,'Invalid modifier application')
                    i=sum(a['target']==target for a in applications)
                    applications.append(dict(id=f'{c[0]},{c[1]}:{target}:{i}',effectId=b['n'],target=target,
                        name='Modifier details unavailable',description=None,rawDescription='',amount=b['q'],extra=False,
                        sourceCoordinate=c,sourceType='Local',remainActive=group.get('remainActive',False),linkedTargets=[],iconKey=None,
                        parameters=dict(definitionCoverage='unresolved-native-definition-version',nativeRedeemer=copy.deepcopy(b),
                            nativeGroup=gi,nativeIndex=bi,sourcePointer=f'/map/grid/{ix}/{iy}/all_buffs/{gi}/buffs/{bi}')))
            assignment_count+=len(applications)
            tile=dict(coordinate=c,nodeNumber=t.get('nodeNumber',-1),start=t.get('start',False),final=t.get('final',False),
                hidden=t.get('hidden',False),links=[xy(v) for v in t.get('links') or []],
                portals=[dict(target=xy(v),label=text(v.get('label')),randomChance=v.get('chance',0),tags=v.get('tags') or []) for v in t.get('pt') or []],
                randomPortal=t.get('rp',False),barrier=t.get('barrier',''),applications=applications)
            tiles.append(tile)
            keys=list(dict.fromkeys(([t['boss']] if t.get('boss') else [])+list(t.get('entities') or {})))
            for key in keys:
                require(key in q['bossTable'],'Unresolved boss placement')
                b=q['bossTable'][key];used.add(key)
                require(not b.get('buffs'),'Unsupported boss modifier input')
                require(type(b['rank']) is int and type(b['level']) is int and type(b.get('sig_lvl',0)) is int and type(b.get('ascensionTier',0)) is int,'Invalid native build')
                encounter=dict(id=f'{qid}:{c[0]},{c[1]}:{key}',coordinate=c,bossKey=key,**identity(b['character']),
                    rank=b['rank'],level=b['level'],signature=b.get('sig_lvl',0),ascension=b.get('ascensionTier',0),final=tile['final'],
                    candidates=[identity(bp) for bp in b.get('characters') or []],
                    pathIndices=[p['index'] for p in paths if c in p['coordinates']])
                encounters.append(encounter)
                native_flags[encounter['id']]=dict(tileIsFinalBoss=t.get('isFinalBoss',False),
                    tileShouldDisplayFinalBossIcon=(t.get('metadata') or {}).get('shouldDisplayFinalBossIcon',False),
                    bossIsFinalBoss=b.get('isFinalBoss',False),bossMetadataFinalBoss=b.get('metadataFinalBoss',False))
    scopes={name:reward_rows((q.get('completionRewards') or {}).get(key) or []) for key,name in [
        ('_firstItemAwards','firstCompletionRewards'),('_masteryItemAwards','masteryCompletionRewards'),
        ('_potentialItemAwards','potentialCompletionRewards'),('_firstItemAwardsMax','firstCompletionMaximumRewards'),
        ('_replayItemAwards','replayRewards'),('allianceBossItems','allianceBossRewards')]}
    fixed=[];crystals=[]
    for scope,rows in scopes.items():
        for r in rows:
            if r['type']=='hero':fixed.append(dict(scope=scope,quantity=r['quantity'],**identity(r['data'])))
            elif r['type']=='gs':crystals.append(dict(scope=scope,quantity=r['quantity'],token=r['data']))
    result=dict(version=1,questId=qid,mapId=q['mapId'],sourceHash=source_hash,sourceFile=source_file,capturedAt=doc['capturedAt'],
        gridDimension=dimension,adaptive=q.get('scaleBosses',False),tiles=tiles,paths=paths,encounters=encounters,
        rewards=dict(fixedChampions=fixed,possibleCrystals=crystals),
        modifierCoverage=dict(applications=assignment_count,resolvedDefinitions=0,verifiedIcons=0),
        nativeBossFlags=native_flags,
        provenance=dict(origin='first-party-public-map-preview',responseSha256=doc['responseSha256'],
            readerSha256=doc['readerSha256'],contractSha256=doc['contractSha256'],eligibility='unknown',scalingExtrasExcluded=True))
    validate_graph(result)
    return result,scopes,sorted(set(q['bossTable'])-used)


def validate_graph(m):
    keys={tuple(t['coordinate']) for t in m['tiles']};require(len(keys)==len(m['tiles']),'Duplicate tile')
    edges=set()
    for t in m['tiles']:
        require(all(0<=v<m['gridDimension'] for v in t['coordinate']),'Coordinate bounds')
        for target in t['links']+[p['target'] for p in t['portals']]:
            require(tuple(target) in keys,'Missing edge target');edges.add((tuple(t['coordinate']),tuple(target)))
        for a in t['applications']:
            require(tuple(a['sourceCoordinate']) in keys,'Missing modifier source')
    for p in m['paths']:
        require(all(tuple(c) in keys for c in p['coordinates']),'Missing path tile')
        require(all((tuple(a),tuple(b)) in edges for a,b in zip(p['coordinates'],p['coordinates'][1:])),'Invalid native path step')
    ids=[e['id'] for e in m['encounters']];require(len(ids)==len(set(ids)),'Duplicate placement')
