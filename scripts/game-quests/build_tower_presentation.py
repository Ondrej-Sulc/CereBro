"""Offline, compact Tower presentation. Never reads the game or uses a network.

Names/formatting are independent of icon evidence. Source inventories and proof
hashes live outside primary display copy. No sibling runtime code is imported.
"""
import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path
from build_application_icons import REPO, read, sha, digest
from build_native_icons_v2 import BCG, SCHEMA, NODE_ROOT, require, version
from build_native_icons_v3 import load_context

EVIDENCE = Path('C:/Code/CereBro/temp/quest-data-investigation/game-only')
BCG_SHA = 'b821489b5451d1d6ee0927f39a80d964f6c1d3aaf13bd76531e5f77d93deba8e'
SCHEMA_SHA = '9cc5236aef043cf7e5655458e790ed1f0897f67398e37af3020bca74511e97c4'
BP_SHA = '2059a0b12ab54b3a582a60371dbc10b9e24b966ae202e6ee8127d464effb2313'
NATIVE = REPO/'temp/quest-explorer-review/challenge-towers-20261110/buffs'
NATIVE_SHA = '61984108ac4f4d0f9fc17bd150d510c9f616755da47707f5e64c0faf709c81cb'
VERSIONS_SHA = '2668c1d1c03f0f7a5f1cec06366d9ed3f701e37cfff7a72971ad6cc34ff6b77e'
FORMATTER = Path('D:/CodexArtifacts/Cpp2IL-2026-11-03/IsilDump/Marvel.Runtime')
FORMAT_PINS = {'GameUtils.txt':'ffe57f22130dc1bf441b300a99b9a1fe4c11bc087c82511b7aa40075a6192f8d',
    'QuestBuffData.txt':'b932f0319cc590a48e25dcc4170c3a585ef0b96828ab2143ed8cbb63affbec58',
    'BCGStatModifier.txt':'86f8a3b008c35d622dc137293aa4939c86d190c46224c2e34e1eb74ee17dfd41'}


def clean(value):
    if not isinstance(value, str): return None
    value = value.replace('\\r\\n', '\n').replace('\\n', '\n').replace('\r\n', '\n')
    value = re.sub(r'\[k=[^\]]+\]|\[/k\]|\[(?:[a-fA-F0-9]{6,8}|-)\]', '', value)
    return value.strip() or None


def source_inventory(repo=REPO):
    blocks, pins, ids, rewards, quantities = [], {}, set(), set(), defaultdict(set)
    for package in ['tower-backend', 'tower-challenges', 'tower-events']:
        root = repo/'src/data/game-quests'/package
        if not (root/'manifest.json').exists(): continue
        pins[f'{package}/manifest.json'] = sha(root/'manifest.json')
        manifest = read(root/'manifest.json')
        for key, meta in sorted(manifest['blocks'].items()):
            # Paths are manifest-owned; fail closed on escapes.
            rel = Path(meta['path'])
            require(not rel.is_absolute() and '..' not in rel.parts, 'Unsafe block path')
            p = root/rel
            require(p.resolve().is_relative_to(root.resolve()), 'Block path escaped package')
            require(sha(p) == meta['sha256'], 'Tower source hash drift')
            d = read(p); blocks.append(d); pins[f'{package}/{rel.as_posix()}'] = sha(p)
            for s in [d['blockData']] + [f['sourceData'] for f in d['floors']]:
                for k in ['buffs', 'topBuffs']:
                    for r in s.get(k, []) or []:
                        ids.add(r['n']); quantities[r['n']].add(r.get('q'))
                for k in ['rewards', 'ratingRewards', 'floorCost']:
                    rewards.update((r['t'], r['n']) for r in s.get(k, []) or [])
    return blocks, pins, ids, rewards, quantities


def modifier_rows(used, quantities, context, node_root=NODE_ROOT):
    base = context['base']; candidates = defaultdict(list)
    # ID-selected node definitions supply separately sourced display text only.
    # Icon transfer also requires an observed complete Tower definition/version.
    for v in base['versions'].values():
        if v['raw']['id'] in used: candidates[v['raw']['id']].append(v)
    details = {}
    for row in base['index']['definitions']:
        p = node_root/row['path']; d = read(p)
        for v in d['definition']['versions']:
            if d['definition']['id'] in used:
                details[v['definitionHash']] = v
    rows = {}; proof_rows = {}
    for identity in sorted(used):
        versions = candidates[identity]
        if len(versions) != 1: continue
        v = versions[0]; raw = v['raw']; detail = details[v['definitionHash']]
        descriptions = {}
        for q in sorted(quantities[identity], key=str):
            texts = {clean(a['raw'].get('buffDescription')) for a in detail['applications'] if a['raw'].get('buffAmount') == q}
            texts.discard(None)
            if len(texts) == 1: descriptions[str(q)] = texts.pop()
        proofs = [p for p in base['proofs'] if p['definitionHash'] == v['definitionHash']]
        # Prefer the frozen original finite renderer key, then its native extension.
        if not proofs: proofs = [p for p in context['proofs'] if p['definitionHash'] == v['definitionHash']]
        rows[identity] = dict(name=clean(raw['localizedName']), descriptions=descriptions,
            rawDescription=clean(raw['localizedDesc']), iconKey=None, nativeScope=raw.get('scope'))
        proof_rows[identity] = dict(definitionHash=v['definitionHash'], versionHash=v['hash'],
            components=[dict(id=c['id'], hash=c['hash']) for c in v['components']],
            missingComponentIds=v['missingComponentIds'], iconProofs=proofs,
            descriptionApplicationHashes=sorted(a['hash'] for a in detail['applications'] if a['raw'].get('buffAmount') in quantities[identity]),
            iconStatus='Unbound: node proof has no observed complete Tower definition/version match')
    return rows, proof_rows


def observed_icon_key(proofs, observed):
    """A node asset alone cannot bind a Tower application by its modifier ID."""
    if not observed or observed.get('missingComponentIds'):
        return None
    exact = [p for p in proofs
        if p['definitionHash'] == observed['definitionHash']
        and p['versionHash'] == observed['hash']
        and not p.get('missingComponentIds')]
    keys = {p['iconKey'] for p in exact}
    return next(iter(keys)) if len(keys) == 1 else None


def observed_description(raw, full_version, quantity):
    """Bounded native formatting, never a value inferred from a node ID/name.

    QuestBuffData's bcg branch SafeStringFormats abs(Buff.value) at slot 0.
    Its statMods branch selects valueStr[0]; GetFormattedLocalizedBuff slot 2
    formats BCGStatModifier.Duration at quantity 1. Only integral Duration and
    this exact placeholder subset are admitted here; other templates stay null.
    """
    if quantity != raw['quantity']: return None
    text = clean(raw['localizedDesc'])
    if not text: return None
    slots = set(re.findall(r'\{\d+\}', text))
    if not slots: return text
    if raw['buffType']=='bcg' and slots=={'{0}'}:
        return text.replace('{0}', format(abs(raw['value']), 'g'))
    if raw['buffType'] in ('statMods','statModsWithAuth') and slots=={'{2}'} and quantity==1:
        first = next((c for c in full_version['components'] if raw['valueStr'] and c['id']==raw['valueStr'][0]),None)
        duration = first['raw'].get('Duration') if first else None
        if isinstance(duration,(int,float)) and duration==int(duration):
            return text.replace('{2}', str(int(duration)))
    return None


def add_observed_definitions(rows, proofs, quantities, context):
    require(sha(NATIVE/'public-observed-native-buffs.json')==NATIVE_SHA, 'Observed native definition drift')
    require(sha(NATIVE/'public-buff-versions.json')==VERSIONS_SHA, 'Observed native version drift')
    native=read(NATIVE/'public-observed-native-buffs.json'); versions=read(NATIVE/'public-buff-versions.json')
    retained_path=NATIVE/'retained-observed-buffs.json'
    require(sha(retained_path)=='1fcde916dfbb80ab35b9f424c365a452f5b137756bba63174aad888a1d892467','Retained text receipt drift')
    native_byid={d['id']:d for d in native['definitions']}
    for partial in read(retained_path)['definitions']:
        if partial['id'] not in native_byid:continue
        full=native_byid[partial['id']]['raw']
        require(all(full[k]==value for k,value in partial['raw'].items()), 'Retained source text/version conflict')
    require(native['bcgSha256']==versions['bcg']['sha256']==BCG_SHA and native['schemaSha256']==versions['schema']['sha256']==SCHEMA_SHA, 'Observed BCG/schema drift')
    for name,expected in FORMAT_PINS.items():require(sha(FORMATTER/name)==expected, 'Native formatter drift')
    byid={d['id']:d for d in versions['definitions']}
    for i,d in enumerate(native['definitions']):
        identity=d['id'];raw=d['raw'];v=byid[identity]
        computed=version(raw,context['base']['components'],BCG_SHA)
        require(raw==v['raw'] and digest(raw)==d['definitionHash']==v['definitionHash']==computed['definitionHash'], 'Observed complete raw definition drift')
        require(v['hash']==computed['hash'] and v['components']==computed['components'] and v['missingComponentIds']==computed['missingComponentIds'], 'Observed native component/version drift')
        require(digest(d['publicSourceDefinition'])==d['publicSourceDefinitionHash'], 'Observed native public context drift')
        if identity in rows:
            require(proofs[identity]['definitionHash']==computed['definitionHash'], 'Observed version conflicts with frozen definition')
            require(proofs[identity]['versionHash']==computed['hash'], 'Observed Tower component version conflicts with frozen definition')
            rows[identity]['iconKey'] = observed_icon_key(proofs[identity]['iconProofs'], computed)
            proofs[identity]['definitionSource'] = dict(path=str((NATIVE/'public-observed-native-buffs.json').relative_to(REPO)).replace('\\','/'),sha256=NATIVE_SHA,pointer=f'/definitions/{i}')
            proofs[identity]['iconStatus'] = 'Observed complete Tower definition/version matches native glyph proof' if rows[identity]['iconKey'] else 'Unbound: observed Tower definition has no matching native glyph proof'
            continue
        if identity not in quantities:continue
        descriptions={str(q):text for q in quantities[identity] if (text:=observed_description(raw,v,q)) is not None}
        rows[identity]=dict(name=clean(raw['localizedName']),descriptions=descriptions,rawDescription=clean(raw['localizedDesc']),iconKey=None,nativeScope=raw['scope'])
        proofs[identity]=dict(definitionHash=computed['definitionHash'],versionHash=computed['hash'],
            components=[dict(id=c['id'],hash=c['hash']) for c in computed['components']],missingComponentIds=computed['missingComponentIds'],iconProofs=[],
            definitionSource=dict(path=str((NATIVE/'public-observed-native-buffs.json').relative_to(REPO)).replace('\\','/'),sha256=NATIVE_SHA,pointer=f'/definitions/{i}'),
            formatting=dict(kind='bounded-native-formatter',sourceQuantity=raw['quantity'],nativeMethods=FORMAT_PINS),
            iconStatus='No transferred icon: native Tower glyph/asset binding unproved')
    return dict(observedDefinitionsSha256=NATIVE_SHA,observedVersionsSha256=VERSIONS_SHA,retainedTextReceiptsSha256=sha(retained_path),nativeFormatterSources=FORMAT_PINS)


def build(args):
    require(sha(BCG) == BCG_SHA and sha(SCHEMA) == SCHEMA_SHA, 'BCG/schema drift')
    bp_path = EVIDENCE/'current-blueprints.json'; require(sha(bp_path) == BP_SHA, 'Blueprint drift')
    blocks, pins, used, reward_ids, quantities = source_inventory()
    context = load_context(args.node_root)
    modifiers, modifier_proofs = modifier_rows(used, quantities, context, args.node_root)
    observed_sources = add_observed_definitions(modifiers, modifier_proofs, quantities, context)
    sys.path.insert(0, str(REPO/'scripts'))
    from mcoc_protobuf import Decoder, fields
    from extract_mcoc_crystal_openings import add_display_names, localize_display_names
    decoder = Decoder(read(SCHEMA)); tables = {4: [], 5: []}
    for tag, wire, value, _ in fields(BCG.read_bytes()):
        if tag in tables: tables[tag].append(decoder.message(value, {4:'BCGCharacterData',5:'BCGEvoBlueprintBase'}[tag]))
    require(not decoder.unknown, 'Unknown character/evolution schema')
    characters = {c['Character']: c for c in tables[4]}; blueprints = {b['Blueprint']: b for b in read(bp_path)}
    # Canonical exact reward label enrichment, with the same pinned sources as quests.
    store_path = Path('C:/Code/CereBro/temp/crystal-openings/gamestore-5AFEBC8CC99BE2C1546DB91EF7B1F6360DFD7154.bin')
    reward_source = read(REPO/'src/data/game-quests/rewards.json')['displayInputs']
    require(sha(store_path) == reward_source['gameStoreSha256'], 'GameStore drift')
    store = decoder.message(store_path.read_bytes(), 'EB.Sparx.GameStoreDataBuffer')
    require(not decoder.unknown, 'Unknown GameStore schema')
    rows = [dict(type=t, data=n) for t,n in sorted(reward_ids)]
    holder = dict(categories=[dict(rewards=rows)], bonusRewards=[], crystals=[], coverage={})
    # Canonical opening catalog already holds exact localized token labels.
    openings_path = REPO/'src/data/game-crystal-openings/catalog.json'; opening = read(openings_path)
    add_display_names(holder, list(blueprints.values()), tables[4], [r for g in store.get('items',{}).values() for r in g.get('gameStoreItems',[])], tables[5])
    words = Path('C:/Code/CereBro/temp/crystal-openings/words')
    word_paths = [words/r['fileName'] for r in reward_source['localization']]
    for r,p in zip(reward_source['localization'], word_paths): require(sha(p)==r['sha256'], 'Localization drift')
    localize_display_names(holder, word_paths)
    canonical_names = defaultdict(set)
    for c in opening['categories']:
        for r in c['rewards']:
            if r.get('displayName'): canonical_names[(r['type'],r['data'])].add(r['displayName'])
    for r in rows:
        names = canonical_names[(r['type'],r['data'])]
        if not r.get('displayName') and len(names)==1: r['displayName']=next(iter(names))
        # Fragment sources retain their exact base name and their separate type.
        if r['type']=='ebpf' and r.get('displayName'): r['displayName'] += ' fragments'
    identities = {r['gameId'] for r in rows if r.get('gameId')}
    identities.update(f['defender']['gameId'] for b in blocks for f in b['floors'] if f['defender'] and f['defender']['gameId'])
    champions = {}
    for gid in sorted(identities):
        c = characters.get(gid)
        if c: champions[gid] = dict(name=clean(c.get('_friendlyNameLoc',{}).get('en')), imageId=c.get('_imgID'), s3ImageId=c.get('_s3ImgID'))
    result = dict(contract='cerebro.tower-presentation/v1', bcgSha256=BCG_SHA,
        schemaSha256=SCHEMA_SHA, blueprintsSha256=BP_SHA, sourceCorpusSha256=digest(pins),
        modifiers=modifiers, champions=champions,
        rewards={f"{r['type']}:{r['data']}":{k:v for k,v in r.items() if k not in ('type','data')} for r in rows},
        coverage=dict(blocks=len(blocks), floors=sum(len(b['floors']) for b in blocks), modifierIds=len(used),
            resolvedModifierIds=len(modifiers), unresolvedModifierIds=sorted(used-modifiers.keys()), rewardIdentities=len(rows)))
    evidence = dict(contract='cerebro.tower-presentation-sources/v1', exporterSha256=sha(Path(__file__)),
        sourceFiles=pins, nativeSourceIndexSha256=sha(args.node_root/'src/data/game-node-modifiers/v3-native-icons/source-index.json'),
        blueprintSha256=BP_SHA, bcgSha256=BCG_SHA, schemaSha256=SCHEMA_SHA,
        rewardInputs=reward_source, openingCatalogSha256=sha(openings_path), modifierProofs=modifier_proofs, observedNativeSources=observed_sources,
        policy='Exact native definitions at frozen BCG with recomputed components/version; source-formatted quantity descriptions independent of verified finite icons. No curated association, guessed champion alias, or player stat clamp.')
    args.output.mkdir(parents=True,exist_ok=True)
    for name, data in [('catalog.json',result),('sources.json',evidence)]:
        (args.output/name).write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    print(result['coverage'], flush=True)


if __name__ == '__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--node-root',type=Path,default=NODE_ROOT)
    p.add_argument('--output',type=Path,default=REPO/'src/data/game-quests/tower-presentation')
    build(p.parse_args())
