"""Versioned offline node projection from accepted, actually assigned quest data.

Never edits frozen v1 artifacts, sibling files, game data or a database. Raw map
inputs are pinned build inputs; runtime outputs contain no quest route graphs.
"""
import argparse
import copy
import hashlib
import json
from pathlib import Path

from extract_mcoc_node_modifiers import digest_json, pinned, pointer
from extract_mcoc_node_artwork import icon_binding
from project_mcoc_node_uses import clean, placement, quest_label
from mcoc_protobuf import Decoder, fields

FROZEN = {'catalog.json': 'c18f0f5944785d93f2a92b27e850a723e67fd446127847e3e232580786f2e741',
          'icon-bindings.json': 'a996435f39557d7354db11fcaa5e8ffd5a1e1d0505a6ede59eeaed0dd6e1b741',
          'artwork.json': '53acecac867ebfda70c21e0b0ba7086232317f284c0548569496974a7473317e'}
LISTS = ('attackerBuffs', 'defenderBuffs', 'sourceAllBuffs', 'sourceAttackerBuffs', 'sourceDefenderBuffs', 'sourceGlobalBuffs', 'sourceLinkBuffs', 'sourceLocalBuffs', 'sourceTrapBuffs')


def load(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def file_hash(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))+'\n', encoding='utf-8')


def prepare(root, quest, original, output):
    """Freeze the existing public scope and exact saved inputs, not live state."""
    baseline = load(root/'src/data/game-node-modifiers/catalog.json')
    progressed_path = quest/'src/data/game-quests/progressed.json'
    progressed, permanent = load(progressed_path), load(quest/'src/data/game-quests/permanent.json')
    public = set(progressed['publicQuestIds'])
    evidence = []
    for name in ['catalog', 'permanent', 'progressed']:
        p = quest/f'src/data/game-quests/{name}.json'
        evidence.append(dict(root='quest', path=p.relative_to(quest).as_posix(), sha256=file_hash(p)))
    for key, expected in FROZEN.items():
        pinned(root/'src/data/game-node-modifiers'/key, expected)
    catalog_paths = [('original', 'continuation/runtime-supply.json', baseline['profile']['inputs'][0]['sha256']),
                     ('quest', 'temp/quest-explorer-review/permanent-20261109/final-catalog.json', permanent['sourceHashes']['final-catalog.json']),
                     ('quest', 'temp/quest-explorer-review/progressed-20261109/initial-catalog.json', progressed['sourceHashes']['initial-catalog.json'])]
    roots = dict(quest=quest, original=original)
    hierarchy = []
    for authority, path, expected in catalog_paths:
        pinned(roots[authority]/path, expected)
        hierarchy.append(dict(root=authority, path=path, sha256=expected))
    maps = []
    for name, supplement in [('permanent', permanent), ('progressed', progressed)]:
        base = f'temp/quest-explorer-review/{name}-20261109'
        for qid, meta in sorted(supplement['maps'].items()):
            if qid not in public: raise ValueError('Non-public map in accepted supplement')
            path = f'{base}/maps/{qid}.json'; pinned(quest/path, meta['sourceHash'])
            maps.append(dict(root='quest', path=path, sha256=meta['sourceHash'], pointer='/map', summaryPointer='/quest', questId=qid, scope='permanent'))
    # The original public maps are selected by the accepted public ID set.
    old_manifest = load(original/'expansion/manifest.json')
    occupied = {m['questId'] for m in maps}
    for artifact in old_manifest['artifacts']:
        relative = artifact['file'].replace('\\', '/')
        if not relative.startswith('maps/') or not relative.endswith('.json'): continue
        path = 'expansion/'+relative; document = json.loads(pinned(original/path, artifact['sha256']))
        qid = document['quest']['qid']
        if qid in public and qid not in occupied:
            maps.append(dict(root='original', path=path, sha256=artifact['sha256'], pointer='/map', summaryPointer='/quest', questId=qid, scope='permanent')); occupied.add(qid)
    # Original multi-map capture: also supplies the native Story 1/5 maps.
    runtime = load(original/'continuation/runtime-supply.json')
    for si, container in enumerate(runtime['pveSets']):
        for qid in (container.get('QuestMaps') or {}):
            if qid in public and qid not in occupied:
                maps.append(dict(root='original', path='continuation/runtime-supply.json', sha256=file_hash(original/'continuation/runtime-supply.json'), pointer=f'/pveSets/{si}/QuestMaps/{qid}', summaryPointer=f'/pveSets/{si}/QuestSummarys/{qid}', questId=qid, scope='permanent')); occupied.add(qid)
    if len(maps) != 218: raise ValueError(f'Expected accepted 218 layouts; found {len(maps)}')
    # Retain all original five-map definitions/URLs as an explicitly historical
    # scope. Do not silently remove monthly/Daily evidence from the v1 explorer.
    identities = {(m['sha256'], m['pointer']) for m in maps}
    for source in baseline['profile']['inputs']:
        doc = json.loads(pinned(original/source['path'], source['sha256']))
        for mp in source['pointers']:
            sp = '/quest' if mp == '/map' else mp.replace('/QuestMaps/', '/QuestSummarys/')
            qid = pointer(doc, sp)['qid']
            if (source['sha256'], mp) not in identities:
                maps.append(dict(root='original', path=source['path'], sha256=source['sha256'], pointer=mp, summaryPointer=sp, questId=qid, scope='original-sample')); identities.add((source['sha256'], mp))
    profile = dict(contract='cerebro.node-modifier-expansion-inputs/v2', frozen=FROZEN, publicScopeCount=len(public),
        evidence=evidence, hierarchy=hierarchy, maps=sorted(maps, key=lambda x: (x['questId'], x['sha256'], x['pointer'])),
        bcgSha256=baseline['profile']['bcgSha256'], schemaSha256=baseline['profile']['schemaSha256'],
        gameAssemblySha256=baseline['profile']['gameAssemblySha256'], gameVersion=baseline['profile']['gameVersion'])
    write(output, profile)
    print(json.dumps(dict(maps=len(maps), permanentMaps=sum(m['scope']=='permanent' for m in maps), publicScope=len(public))))


def definition_version(raw, components, bcg_hash):
    ids = (raw.get('buffStatMods') or raw.get('valueStr') or []) if raw.get('buffType') in ('statMods', 'statModsWithAuth') else []
    if not isinstance(ids, list) or not all(isinstance(i, str) for i in ids): raise ValueError('Invalid native component identity')
    linked = [dict(id=i, hash=digest_json(components[i]), raw=components[i]) for i in ids if i in components]
    missing = [i for i in ids if i not in components]
    revision = digest_json(dict(raw=raw, components=linked, missingComponentIds=missing, sourceBcgSha256=bcg_hash))
    return dict(hash=revision, sourceBcgSha256=bcg_hash, definitionHash=digest_json(raw), raw=raw, componentIds=ids, components=linked, missingComponentIds=missing, applications={})


def display_text(value):
    import re
    if not isinstance(value, str): return ''
    text = re.sub(r'\[(?:[\da-fA-F]{6,8}|-|/?b|/?i|k=glossary/[a-zA-Z0-9_/-]+|/k)\]', '', value).strip()
    return '' if re.search(r'\{\d+\}', text) else text


def build(root, quest_root, original_root, profile_path, bcg, schema, output):
    if output.resolve() == (root/'src/data/game-node-modifiers').resolve() or output.resolve().is_relative_to(quest_root.resolve()) or output.resolve().is_relative_to(original_root.resolve()):
        raise ValueError('Output must be a separate versioned folder in the node checkout')
    if (output/'source-profile.json').resolve() == profile_path.resolve():
        raise ValueError('Reproduce to a separate output folder; do not rewrite the input ledger')
    profile = load(profile_path); roots = dict(quest=quest_root, original=original_root)
    for name, expected in profile['frozen'].items(): pinned(root/'src/data/game-node-modifiers'/name, expected)
    for row in profile['evidence']: pinned(roots[row['root']]/row['path'], row['sha256'])
    hierarchy = {str(i): json.loads(pinned(roots[r['root']]/r['path'], r['sha256'])) for i,r in enumerate(profile['hierarchy'])}
    decoder = Decoder(json.loads(pinned(schema, profile['schemaSha256'])))
    tables = {1: ('BCGStatModifier', 'ID'), 2: ('BCGStatModifierAppearance', 'ID'), 3: ('BCGBlueprintBase', 'Blueprint'), 4: ('BCGCharacterData', 'Character')}
    data = {i: {} for i in tables}
    for tag, wire, value, _ in fields(pinned(bcg, profile['bcgSha256'])):
        if tag not in tables: continue
        kind, field = tables[tag]; row = decoder.message(value, kind); identity = row[field]
        if identity in data[tag]: raise ValueError(f'Duplicate native {kind}')
        data[tag][identity] = row
    if decoder.unknown: raise ValueError('Unknown named BCG schema')
    names = {key: clean((row.get('_friendlyNameLoc') or {}).get('en')) or None for key,row in data[4].items()}
    baseline = load(root/'src/data/game-node-modifiers/catalog.json')
    old_art = load(root/'src/data/game-node-modifiers/artwork.json')
    registry = load(root/'src/data/game-node-modifiers/icon-bindings.json')
    known_keys = {(row['effectId'], row['versionHash']): row['iconKey'] for row in registry['bindings']}
    glyph_keys = {row['glyph']: known_keys[(row['effectId'], row['versionHash'])] for row in old_art['icons'] if row['status']=='verified'}
    definitions, version_cache, quests, uses, source_inputs, source_only = {}, {}, {}, {}, [], {}
    assignment_ids, assignment_icons = set(), set()
    issues = dict(missingBuffIdentities=0, sourceFlagVsAssignedListDifferences=0, iconBindings={})
    input_cache = {}
    for mi, source in enumerate(profile['maps']):
        source_id = 'map-'+source['sha256'][:20]+'-'+hashlib.sha256(source['pointer'].encode()).hexdigest()[:8]
        input_key = (source['root'], source['path'])
        # Only the original shared capture is retained between maps.
        if input_key in input_cache: doc = input_cache[input_key]
        else:
            doc = json.loads(pinned(roots[source['root']]/source['path'], source['sha256']))
            if source['pointer'] != '/map': input_cache[input_key] = doc
        if doc.get('gameAssemblySha256') != profile['gameAssemblySha256']: raise ValueError('Map game build drift')
        summary = pointer(doc, source['summaryPointer']); map_data = pointer(doc, source['pointer'])
        if summary['qid'] != source['questId']: raise ValueError('Map/quest identity drift')
        source_inputs.append(dict(id=source_id, path=source['root']+':'+source['path'], sha256=source['sha256'], capturedAt=doc['capturedAt'], pointers=[source['pointer']]))
        qkey = digest_json(dict(qid=summary['qid'], mapId=summary['mapId'], sourceSha256=source['sha256']))
        label = quest_label(summary, hierarchy)
        # Difficulty labels come from the exact captured containing-set key.
        container = doc.get('container') or (pointer(doc, source['pointer'].split('/QuestMaps/')[0]) if '/QuestMaps/' in source['pointer'] else {})
        difficulty = (container.get('difficulties') or {}).get(summary.get('difficultyId')) or {}
        for field in ['friendlyName', 'label', 'name']:
            if clean(difficulty.get(field)): label['difficulty'] = clean(difficulty[field]); break
        quests[qkey] = dict(key=qkey, questId=summary['qid'], mapId=summary['mapId'], sourceId=source_id, sourceSha256=source['sha256'], containerSetId=container.get('setId'), containerSetName=container.get('setName'),
            mapPointer=source['pointer'], summaryPointer=source['summaryPointer'], scope=source['scope'], **label)
        tiles = {(t['x'],t['y']):t for t in map_data['walkableTiles']}
        placed = {coord: placement(tile, summary, data[3], names) for coord,tile in tiles.items()}
        for ti, tile in enumerate(map_data['walkableTiles']):
            for field in LISTS:
                for ai, app in enumerate(tile.get(field) or []):
                    raw = app.get('buff') or {}; effect = raw.get('id')
                    if not effect: issues['missingBuffIdentities'] += 1; continue
                    raw_hash = digest_json(raw)
                    if raw_hash not in version_cache: version_cache[raw_hash] = definition_version(raw, data[1], profile['bcgSha256'])
                    proto = version_cache[raw_hash]
                    definition = definitions.setdefault(effect, dict(id=effect, versions={}))
                    version = definition['versions'].setdefault(proto['hash'], dict(proto, applications={}))
                    context = {k:v for k,v in app.items() if k not in ('buff','sourceCoordinate')}; ahash = digest_json(context)
                    path = f'{source["pointer"]}/walkableTiles/{ti}/{field}/{ai}'
                    application = version['applications'].setdefault(ahash, dict(hash=ahash, text=app.get('buffDescription'), raw=context,
                        evidence=dict(sourceId=source_id,pointer=path,coordinate=app.get('sourceCoordinate')), observations=0))
                    application['observations'] += 1
                    origin = app.get('sourceCoordinate'); ns = app.get('nodeSource') or {}
                    role = (ns.get('type') or {}).get('name','Unknown'); side = 'attacker' if ns.get('attk') is True else 'defender' if ns.get('attk') is False else 'unknown'
                    base_id = digest_json(dict(questKey=qkey,effectId=effect,versionHash=version['hash'],applicationHash=ahash,sourceCoordinate=origin))
                    target = 'attacker' if field=='attackerBuffs' else 'defender' if field=='defenderBuffs' else None
                    uid = digest_json(dict(sourceContext=base_id,assignmentSide=target)) if target else base_id
                    target_uses = uses if target else source_only
                    use = target_uses.setdefault(uid,dict(id=uid,sourceContextId=base_id,questKey=qkey,effectId=effect,versionHash=version['hash'],applicationHash=ahash,
                        sourceCoordinate=origin,role=role,side=side,sourceNode=placed.get((origin['x'],origin['y'])) if origin else None,
                        affectedNodes={},sourcePointers=set(),assignments={}))
                    if field not in ('attackerBuffs','defenderBuffs'): use['sourcePointers'].add(path); continue
                    # Assigned-list membership and the source configuration flag
                    # are separate evidence. Keep both; never flatten one into the other.
                    use['sourceConfiguredSide'] = side
                    use['side'] = target
                    if side != target: issues['sourceFlagVsAssignedListDifferences'] += 1
                    assignment = digest_json(dict(useId=uid,target=target,x=tile['x'],y=tile['y']))
                    assignment_ids.add(assignment)
                    use['assignments'].setdefault(assignment,dict(id=assignment,target=target,x=tile['x'],y=tile['y'],pointers=[]))['pointers'].append(path)
                    node = placed[(tile['x'],tile['y'])]
                    if node['defenders']:
                        key = (tile['x'],tile['y']); entry = use['affectedNodes'].setdefault(key,dict(node,pointers=[])); entry['pointers'].append(path)
        if (mi+1)%25==0: print(f'Processed {mi+1}/{len(profile["maps"])} saved maps',flush=True)
    assigned_sources = set()
    for use in uses.values():
        assigned_sources.add(use['sourceContextId'])
        if use['sourceContextId'] in source_only: use['sourcePointers'].update(source_only[use['sourceContextId']]['sourcePointers'])
    uses.update({key:value for key,value in source_only.items() if key not in assigned_sources})
    # Validate every exact v1 version survived; baseline bytes are never changed.
    for definition in baseline['definitions']:
        for version in definition['versions']:
            if version['hash'] not in definitions.get(definition['id'],{}).get('versions',{}): raise ValueError('Original v1 version missing from expansion')
    game_catalog_hash = digest_json(dict(profile=profile,versions={key:sorted(value['versions']) for key,value in sorted(definitions.items())}))
    catalog_profile = dict(id='accepted-node-assignments-20261109-v2',gameVersion=profile['gameVersion'],bcgSha256=profile['bcgSha256'],schemaSha256=profile['schemaSha256'],
        gameAssemblySha256=profile['gameAssemblySha256'],coverage='218 permanent layouts plus original historical samples; recorded assignments, not active combat state',inputs=source_inputs,evidence=[])
    for use in uses.values():
        use['affectedNodes'] = sorted(use['affectedNodes'].values(),key=lambda n:(n['nodeNumber'] or 0,n['x'],n['y']))
        use['sourcePointers'] = sorted(use['sourcePointers']); use['assignments'] = sorted(use['assignments'].values(),key=lambda n:n['id'])
    by_effect = {}
    for use in uses.values(): by_effect.setdefault(use['effectId'],[]).append(use)
    summaries, loaders, all_portrait_ids = [], [], set()
    output.mkdir(parents=True,exist_ok=True)
    for effect in sorted(definitions):
        definition = definitions[effect]; definition['versions'] = [definition['versions'][k] for k in sorted(definition['versions'])]
        vkeys=[]; app_status={}
        for version in definition['versions']:
            version['applications'] = [version['applications'][k] for k in sorted(version['applications'])]
            keys=set()
            for application in version['applications']:
                try: art = icon_binding(dict(version,applications=[application]),data[2])
                except ValueError: art = dict(status='captured-glyph-drift')
                key = glyph_keys.get(art.get('glyph')) if art['status']=='verified' else None
                application['nativeIconKey'] = key
                status = 'verified-existing-shape' if key else art['status'] if art['status']!='verified' else 'shape-not-exported'
                app_status[application['hash']]=status; issues['iconBindings'][status]=issues['iconBindings'].get(status,0)+1
                if key: keys.add(key)
            version['nativeIconKey'] = known_keys.get((effect,version['hash'])) or (next(iter(keys)) if len(keys)==1 else None)
            vkeys.append(version['nativeIconKey'])
        effect_uses=sorted(by_effect.get(effect,[]),key=lambda u:u['id']); qkeys={u['questKey'] for u in effect_uses}
        for use in effect_uses:
            version=next(v for v in definition['versions'] if v['hash']==use['versionHash'])
            app=next(a for a in version['applications'] if a['hash']==use['applicationHash'])
            if app.get('nativeIconKey'): assignment_icons.update(a['id'] for a in use['assignments'])
            for node in ([use['sourceNode']] if use['sourceNode'] else [])+use['affectedNodes']:
                all_portrait_ids.update(d['gameId'] for d in node['defenders'] if d['gameId'])
        texts=sorted({display_text(a['text']) for v in definition['versions'] for a in v['applications']} - {''})
        titles=sorted({display_text(v['raw'].get('localizedName')) for v in definition['versions']} - {''})
        summary=dict(id=effect,name=titles[0] if titles else 'Name not recorded',names=titles,text=texts[0] if texts else 'Resolved wording was not recorded.',texts=texts,
            versionHashes=[v['hash'] for v in definition['versions']],sources=sorted({u['role'] for u in effect_uses}),targets=sorted({u['side'] for u in effect_uses}),
            assignmentContexts=[dict(source=source,target=target) for source,target in sorted({(u['role'],u['side']) for u in effect_uses})],
            missing=any(v['missingComponentIds'] for v in definition['versions']),questCount=len(qkeys),assignmentCount=sum(len(u['assignments']) for u in effect_uses),
            iconKey=vkeys[0] if vkeys and all(k==vkeys[0] for k in vkeys) else None)
        projection=dict(schemaVersion=2,contract='cerebro.node-modifier-uses/v2',modifierCatalogHash=game_catalog_hash,contentHash='',
            quests=[quests[k] for k in sorted(qkeys)],uses=effect_uses)
        projection['contentHash']=digest_json({k:v for k,v in projection.items() if k!='contentHash'})
        detail=dict(contract='cerebro.node-modifier-detail/v2',catalogHash=game_catalog_hash,definition=definition,projection=projection)
        filename=hashlib.sha256(effect.encode()).hexdigest()+'.json'; write(output/'details'/filename,detail)
        summary['detailSha256']=file_hash(output/'details'/filename); summaries.append(summary)
        loaders.append(f'  {json.dumps(effect)}: () => import("./details/{filename}"),')
    stats=dict(permanentVariants=profile['publicScopeCount'],permanentLayouts=sum(s['scope']=='permanent' for s in profile['maps']),
        retainedHistoricalLayouts=sum(s['scope']=='original-sample' for s in profile['maps']),distinctBuffIds=len(definitions),
        fullVersions=sum(len(d['versions']) for d in definitions.values()),distinctApplications=sum(len(v['applications']) for d in definitions.values() for v in d['versions']),
        recordedTileAssignments=len(assignment_ids),verifiedApplicationIconAssignments=len(assignment_icons),sourceContexts=len(uses),questLayouts=len(quests),issues=issues)
    index=dict(contract='cerebro.node-modifier-index/v2',exporterSha256=file_hash(Path(__file__)),catalogHash=game_catalog_hash,profile=catalog_profile,profileHash=digest_json(profile),stats=stats,records=summaries)
    write(output/'index.json',index);write(output/'source-profile.json',profile);write(output/'portrait-ids.json',sorted(all_portrait_ids))
    (output/'detail-loaders.js').write_text('// Generated server-only lazy detail shards.\nconst loaders = {\n'+'\n'.join(loaders)+'\n};\nexport async function loadExpandedModifier(id) { return Object.hasOwn(loaders,id) ? (await loaders[id]()).default : undefined; }\n',encoding='utf-8')
    (output/'detail-loaders.d.ts').write_text('import type { ExpandedModifierDetail } from "../../../domain/node-modifiers/expansion"\nexport declare function loadExpandedModifier(id: string): Promise<ExpandedModifierDetail | undefined>\n',encoding='utf-8')
    print(json.dumps(stats),flush=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('mode',choices=['prepare','build'])
    for name in ['root','quest-root','original-root','profile','bcg','schema','output']: parser.add_argument('--'+name,type=Path)
    args=parser.parse_args();root=args.root or Path(__file__).resolve().parents[1]
    if args.mode=='prepare': prepare(root,args.quest_root,args.original_root,args.output)
    else: build(root,args.quest_root,args.original_root,args.profile,args.bcg,args.schema,args.output)
