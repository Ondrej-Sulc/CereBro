"""Offline, source-bound public quest gate and path reward definitions.

No process, network, database, session, or game-reader imports. Existing public
maps are inputs only. Runtime collection/claim/eligibility fields are never read.
"""
import argparse
import hashlib
import json
import re
import sys
from collections import Counter
from pathlib import Path

from build_boss_display import DIRECTORIES, documents, source_path

REPO = Path(__file__).resolve().parents[2]
DEFAULT_SUPPLEMENT = Path('C:/Users/ossul/.t3/worktrees/CereBro/t3-f919ccfc/temp/quest-explorer-review')
REWARD_FIELDS = {'Type': 'type', 'Data': 'data', 'Quantity': 'quantity',
                 'MinQuantity': 'minQuantity', 'MaxQuantity': 'maxQuantity',
                 'Id': 'id', 'DisplayName': 'displayName'}
KINDS = {'hasChampion': 'champion', 'hasClass': 'class', 'hasRarity': 'rarity',
         'hasClassAndRarity': 'class-and-rarity', 'hasTags': 'tags',
         'redeemer': 'resource', 'switch': 'switch'}
STARS = {'common': 1, 'uncommon': 2, 'rare': 3, 'epic': 4,
         'legendary': 5, 't6': 6, 't7': 7}
OPERATORS = {'eq': 'Exactly', 'gt': 'More than', 'gte': 'At least',
             'lt': 'Fewer than', 'lte': 'At most'}
NATIVE_PINS = {
    'TeamData.txt': '8c4987b8b60dfad2e58d459e4768bd44ed2b30d2780d304d17a2f291e72274b1',
    'BCGManager.txt': '90c9b70da99c108cab02b41a436182b793b31b9e323f721f35f9b6e76756cdfc',
    'QuestSummary.txt': 'a78e3dfd566e7b5d3c3bb894f2cc776f4ebb917417178eff488cb7a0caac87e5',
    'PathBasedReward.txt': '2f3bae3d3ba7211bb8d69757db0547d342a1468a93f158651affe6223153bce0',
    'GameBCGUtils.txt': '793ce6eff3d4f1a32cc6f1672bd2871e41476f577e48d526512f1c97cb35679d',
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def read(path):
    return json.loads(path.read_bytes())


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n').encode('utf-8')


def coordinate(value):
    xy = [value['x'], value['y']] if isinstance(value, dict) else value
    require(len(xy) == 2 and all(type(v) in (int, float) and v == int(v) for v in xy), 'Invalid coordinate')
    return list(map(int, xy))


def reward(value, index, wire=False):
    # Explicit field projection is the privacy boundary; never copy the object.
    fields = {k[0].lower() + k[1:] if wire else k: v for k, v in REWARD_FIELDS.items()}
    result = {'sourceIndex': index}
    for original, projected in fields.items():
        if original in value:
            require(type(value[original]) in (str, int, float), 'Non-scalar static reward field')
            result[projected] = value[original]
    if wire:
        for original, projected in (('t', 'type'), ('n', 'data'), ('q', 'quantity'),
                                    ('min', 'minQuantity'), ('max', 'maxQuantity')):
            if original in value:
                require(type(value[original]) in (str, int, float), 'Non-scalar wire reward field')
                require(projected not in result or result[projected] == value[original], 'Conflicting wire reward fields')
                result[projected] = value[original]
    require(all(k in result for k in ('type', 'data', 'quantity')), 'Missing reward identity/quantity')
    return result


def canonical_barrier(value, wire):
    if not wire:
        return value
    return dict(barrierType=value.get('barrierType', ''), champions=value.get('champion') or [],
                barrierClass=value.get('class', ''), BarrierRarity=value.get('rarity', ''),
                ChampionCount=value.get('championCount', 1), CountOperator=value.get('countOperator', ''),
                Tags=value.get('tags') or [], Cost=value.get('cost') or [])


def gate_definition(barrier_id, native, labels, source, wire=False):
    b = canonical_barrier(native, wire)
    native_type = b.get('barrierType', '')
    kind = KINDS.get(native_type, 'unknown')
    champions = list(b.get('champions') or [])
    class_id, rarity = b.get('barrierClass', ''), b.get('BarrierRarity', '')
    count, operator = b.get('ChampionCount', 1), b.get('CountOperator', '')
    require(type(count) is int and count >= 0, 'Malformed champion count')
    require(operator in ('', *OPERATORS), 'Unknown count operator')
    constraints = dict(nativeType=native_type, champions=champions, count=count,
                       countOperator=operator)
    if class_id:
        constraints['class'] = class_id
    if rarity:
        constraints['rarity'] = rarity
    names = sorted({labels['blueprints'][v] for v in champions if v in labels['blueprints']})
    class_name = labels['classes'].get(class_id)
    star = STARS.get(rarity)
    subject, resolved = '', kind != 'unknown'
    if kind == 'champion':
        resolved = bool(champions) and all(v in labels['blueprints'] for v in champions)
        constraints['championLogic'] = 'any'
        subject = ' or '.join(names) if resolved else 'Specified champion'
        line = subject + ' required'
    elif kind in ('class', 'rarity', 'class-and-rarity'):
        resolved = (kind == 'rarity' or bool(class_name)) and (kind == 'class' or bool(star))
        subject = ' '.join(v for v in (f'{star}★' if star else '', class_name or '') if v) + ' champions'
        line = f'{OPERATORS[operator]} {count} {subject}' if operator else subject
    elif kind == 'tags':
        tags = list(b.get('Tags') or [])
        constraints.update(tags=tags, tagLogic='any-group-all-terms')
        groups = []
        for group in tags:
            terms = []
            for term in group.strip().lower().split(':'):
                negated = term.startswith('!')
                token = term[1:] if negated else term
                name = labels['tags'].get(token) or labels['classes'].get(token) or labels.get('characters', {}).get(token)
                resolved = resolved and bool(name)
                terms.append(('not ' if negated else '') + (name or 'specified tag'))
            groups.append(' and '.join(terms))
        subject = ' or '.join(f'({v})' if ' and ' in v and len(groups) > 1 else v for v in groups)
        line = f'{OPERATORS[operator]} {count} champions: {subject}' if operator else f'Champions: {subject}'
        resolved = resolved and bool(tags)
    elif kind == 'resource':
        constraints['costs'] = [reward(v, i, wire) for i, v in enumerate(b.get('Cost') or [])]
        items = [f"{v['quantity']} {labels.get('items', {}).get((v['type'], v['data']), 'required items')}"
                 for v in constraints['costs']]
        line = 'Requires ' + ' and '.join(items) if items else 'Required resources'
    elif kind == 'switch':
        line = 'Activate the associated switch'
    else:
        line = 'Gate requirements not captured'
    label = line if resolved else 'Gate requirements not captured'
    return dict(barrierId=barrier_id, kind=kind, label=label,
                requirements=[line] if resolved else [], resolved=resolved,
                constraints=constraints, source=source)


def project(public, quest, capture_source, labels, wire=False):
    require((quest['qid'], quest['mapId']) == (public['questId'], public['mapId']), 'Quest/map identity mismatch')
    tiles = {tuple(t['coordinate']) for t in public['tiles']}
    require(len(tiles) == len(public['tiles']), 'Duplicate public tile coordinate')
    paths = public['paths']
    def indices(c):
        return [p['index'] for p in paths if c in p['coordinates']]
    table_key = 'barrierTable' if wire else 'barriers'
    definitions = {}
    for key, value in (quest.get(table_key) or {}).items():
        source = dict(capture_source, pointer=capture_source['pointer'] + '/' + table_key + '/' + key)
        definitions[key] = gate_definition(key, value, labels, source, wire)
    gates, placed = [], set()
    for tile in public['tiles']:
        key = tile.get('barrier')
        if not key:
            continue
        placed.add(key)
        definition = definitions.get(key, dict(barrierId=key, kind='unknown', label='Gate requirements not captured',
                                                requirements=[], resolved=False))
        c = coordinate(tile['coordinate'])
        gates.append(dict(definition, id=f"{public['questId']}:gate:{c[0]},{c[1]}:{key}",
                          coordinate=c, pathIndices=indices(c)))
    unplaced = [definitions[k] for k in sorted(definitions) if k not in placed]
    rewards = []
    # Wire Act10 detail does not include pathBasedRewardsList; absence is unknown.
    has_rewards = 'pathBasedRewardsList' in quest
    for i, placement in enumerate(quest.get('pathBasedRewardsList') or []):
        c = coordinate(placement)
        require(tuple(c) in tiles, f"Reward coordinate absent from published map: {public['questId']} {c}")
        rewards.append(dict(id=f"{public['questId']}:path-reward:{i}", coordinate=c, pathIndices=indices(c),
                            rewards=[reward(v, j, wire) for j, v in enumerate(placement.get('items') or [])],
                            source=dict(capture_source, pointer=capture_source['pointer'] + f'/pathBasedRewardsList/{i}')))
    unresolved = sum(not g['resolved'] for g in gates)
    return dict(questId=public['questId'], mapId=public['mapId'], sourceHash=public['sourceHash'],
                gates=gates, unplacedGateDefinitions=unplaced, pathRewards=rewards,
                coverage=dict(gates=('none' if not gates else 'complete' if not unresolved else 'uncaptured' if unresolved == len(gates) else 'partial'),
                              pathRewards='captured' if has_rewards else 'uncaptured', unresolvedGateCount=unresolved))


def validate_source_tiles(public, source_map, wire):
    source_tiles = ([t for row in source_map['grid'] for t in row if t and t.get('walkable')]
                    if wire else source_map['walkableTiles'])
    native = {tuple(coordinate(t)): t for t in source_tiles}
    require(len(native) == len(source_tiles), 'Duplicate source tile coordinate')
    require(set(native) == {tuple(t['coordinate']) for t in public['tiles']}, 'Public/source tile coordinates differ')
    for tile in public['tiles']:
        require((native[tuple(tile['coordinate'])].get('barrier') or '') == (tile.get('barrier') or ''),
                'Public/source barrier position differs')
    return Counter(tuple(sorted(e)) for t in source_tiles for e in (t.get('tileEntities') or []))


def load_labels(original_root, schema_path):
    sys.path.insert(0, str(REPO / 'scripts'))
    from mcoc_protobuf import Decoder, fields
    bcg = original_root / 'sources/bcg-E95E28EECECC04D6A358C8FD8089D01305D0FB73.bin'
    decoder = Decoder(read(schema_path))
    characters, classes, tags = {}, {}, {}
    for tag, _, value, _ in fields(bcg.read_bytes()):
        if tag == 4:
            row = decoder.message(value, 'BCGCharacterData')
            name = row.get('_friendlyNameLoc', {}).get('en')
            if name:
                characters[row['Character']] = name
        elif tag == 9:
            row = decoder.message(value, 'BCGHeroClass')
            classes[row['ClassID']] = row['_classNameLoc']['en']
        elif tag == 17:
            row = decoder.message(value, 'BCGHeroTag')
            tags[row['ID'].lower()] = row['_nameLoc']['en']
        elif tag == 11:
            row = decoder.message(value, 'BCGUniverse')
            if row.get('_friendlyNameLoc', {}).get('en'):
                tags[row['ID'].lower()] = row['_friendlyNameLoc']['en']
    store_path = original_root.parents[1] / 'crystal-openings/gamestore-5AFEBC8CC99BE2C1546DB91EF7B1F6360DFD7154.bin'
    require(sha(store_path) == '1b56c68c34813a40647a559f4e3b130cd26f080d2ffd063c9db417ac97603c55', 'Frozen GameStore drift')
    store = decoder.message(store_path.read_bytes(), 'EB.Sparx.GameStoreDataBuffer')
    items = {}
    for group in store.get('items', {}).values():
        for item in group.get('gameStoreItems') or []:
            if item.get('Name') and item.get('Title'):
                key = ('inv', item['Name'])
                require(key not in items or items[key] == item['Title'], 'Conflicting native item title')
                items[key] = item['Title']
    require(not decoder.unknown, 'Unknown frozen BCG fields')
    blueprints = {b['Blueprint']: characters[b['Character']] for b in read(original_root / 'current-blueprints.json')
                  if b['Character'] in characters}
    return dict(blueprints=blueprints, classes=classes, tags=tags, characters=characters, items=items), {
        'schema.json': sha(schema_path), bcg.name: sha(bcg), store_path.name: sha(store_path),
        'current-blueprints.json': sha(original_root / 'current-blueprints.json')}


def build(public_root, original_root, supplement_root, schema_path):
    labels, hashes = load_labels(original_root, schema_path)
    baseline = read(public_root / 'manifest.json')
    require(hashes['schema.json'] == baseline['labelEvidence']['schemaSha256'], 'Published label schema drift')
    require(hashes[baseline['labelEvidence']['file']] == baseline['labelEvidence']['sha256'], 'Published label BCG drift')
    require(hashes['current-blueprints.json'] == baseline['inputs']['current-blueprints.json'], 'Published blueprint drift')
    # The runtime replaces the earlier permanent public-ID list with this merged catalog.
    public_ids = set(read(public_root / 'progressed.json')['publicQuestIds'])
    hashes['progressed.json'] = sha(public_root / 'progressed.json')
    catalog = read(public_root / 'catalog.json') + read(public_root / 'progressed-catalog.json')
    catalog_ids = {q['id'] for q in catalog if q['id'] in public_ids}
    maps, counts, proof = {}, Counter(), []
    semantics = original_root / 'continuation/semantics-evidence.json'
    semantics_hash = sha(semantics)
    require(semantics_hash == baseline['inputs']['continuation/semantics-evidence.json'], 'Saved semantics pin drift')
    # The named native source proof is immutable and independently hash checked.
    for row in read(semantics):
        require(sha(Path(row['source'])) == row['sha256'], 'Native semantics source drift')
    hashes['continuation/semantics-evidence.json'] = semantics_hash
    native_root = Path('D:/CodexArtifacts/Cpp2IL-2026-11-03/IsilDump/Marvel.Runtime')
    for name, digest in NATIVE_PINS.items():
        require(sha(native_root / name) == digest, 'Native gate/reward semantics source drift')
        hashes['native/' + name] = digest
    runtime_cache = {}
    summary_path = original_root / 'runtime-home-validated.json'
    require(sha(summary_path) == 'ebe5e7f2d5fbc759dbeb08d30ca174c7941c13ae4e2c81f545fb0b97c7694aa3', 'Frozen summary reward source drift')
    summary = read(summary_path)
    summary_rewards = {qid: (q, i) for i, group in enumerate(summary['pveSets'])
                       for qid, q in (group.get('QuestSummarys') or {}).items() if q.get('pathBasedRewardsList')}
    entity_shapes = Counter()
    for directory in DIRECTORIES:
        loader = public_root / {'maps': 'map-loaders.ts', 'permanent-maps': 'permanent-map-loaders.ts',
                                'progressed-maps': 'progressed-map-loaders.js', 'act10-maps': 'act10-map-loaders.js'}[directory]
        loader_ids = set(re.findall(r'"([^"]+)":\s*\(\)\s*=>', loader.read_text()))
        for path in sorted((public_root / directory).glob('*.json')):
            if path.stem not in catalog_ids or path.stem not in loader_ids:
                continue
            public = read(path)
            require(public['questId'] == path.stem, 'Public filename identity drift')
            source = source_path(public, directory, original_root, supplement_root)
            require(source.is_file(), f'Frozen source missing: {source}')
            relative = public['sourceFile']
            if source.name == 'runtime-supply.json':
                if source not in runtime_cache:
                    runtime_cache[source] = (read(source), sha(source))
                raw, digest = runtime_cache[source]
            else:
                data = source.read_bytes(); digest = hashlib.sha256(data).hexdigest(); raw = json.loads(data)
            require(digest == public['sourceHash'], f'Frozen map source hash mismatch: {path.name}')
            require(not raw.get('issues'), 'Source capture issues')
            quest, source_map = documents(public, raw, directory == 'act10-maps')
            entity_shapes.update(validate_source_tiles(public, source_map, directory == 'act10-maps'))
            pointer = '/data' if directory == 'act10-maps' else '/quest'
            if 'pveSets' in raw:
                index = next(i for i, s in enumerate(raw['pveSets']) if public['questId'] in (s.get('QuestMaps') or {}))
                pointer = f"/pveSets/{index}/QuestSummarys/{public['questId']}"
            capture = dict(file=relative, sha256=digest, pointer=pointer, capturedAt=raw['capturedAt'])
            projected = project(public, quest, capture, labels, directory == 'act10-maps')
            if projected['coverage']['pathRewards'] == 'uncaptured' and public['questId'] in summary_rewards:
                reward_quest, summary_index = summary_rewards[public['questId']]
                fallback_source = dict(file='runtime-home-validated.json', sha256=sha(summary_path),
                                       pointer=f"/pveSets/{summary_index}/QuestSummarys/{public['questId']}", capturedAt=summary['capturedAt'])
                fallback = project(public, reward_quest, fallback_source, labels)
                projected['pathRewards'] = fallback['pathRewards']
                projected['coverage']['pathRewards'] = fallback['coverage']['pathRewards']
                hashes['runtime-home-validated.json'] = fallback_source['sha256']
            projected['publicMapSha256'] = sha(path)
            require(public['questId'] not in maps, 'Duplicate published quest map')
            maps[public['questId']] = projected
            hashes[relative] = digest
            counts['maps'] += 1
            for key in ('gates', 'unplacedGateDefinitions', 'pathRewards'):
                counts[key] += len(projected[key])
            counts['rewardItems'] += sum(len(p['rewards']) for p in projected['pathRewards'])
            counts['unresolvedGates'] += projected['coverage']['unresolvedGateCount']
            counts['mapsWithoutPathRewardCapture'] += projected['coverage']['pathRewards'] == 'uncaptured'
            proof.append(dict(questId=public['questId'], publicFile=f'{directory}/{path.name}',
                              publicMapSha256=projected['publicMapSha256'], sourceFile=str(source.resolve()),
                              sourceSha256=digest, pointer=pointer))
    result = dict(version=1, maps=dict(sorted(maps.items())), sourceHashes=dict(sorted(hashes.items())),
                  semanticsSource=dict(file='continuation/semantics-evidence.json', sha256=semantics_hash),
                  counts=dict(counts), limits=[
                      'Public static definitions only; no completion, collection, claim, access, inventory, or eligibility state.',
                      'Unplaced gate definitions have no captured tile reference; coordinates and paths are not inferred.',
                      'A missing pathBasedRewardsList is uncaptured, not evidence that the quest has no path rewards.',
                      'Authored path indices are exact coordinate membership, not an independent guarantee of reward availability.'])
    return result, dict(version=1, exporterSha256=sha(Path(__file__)), counts=dict(counts), sources=proof,
                        labelSources=hashes, nativeSemanticsSources={str(native_root / n): h for n, h in NATIVE_PINS.items()},
                        tileEntityShapes=[dict(fields=list(k), count=v) for k, v in sorted(entity_shapes.items())],
                        fieldSemantics={
                            'hasChampion': 'QuestSummary.IsBarrierOpen: any listed blueprint is sufficient; variants are alternatives.',
                            'hasClassAndRarity': 'ContainsClassAndRarityCount counts champions satisfying class AND exact star rarity.',
                            'hasTags': 'ContainsTagsCount uses ValidateHeroTags: array entries OR; colon terms AND; ! negates a term.',
                            'count': 'HasRequiredChampionCount compares ChampionCount with observed matching champions using eq/gt/gte/lt/lte.',
                            'pathRewards': 'QuestSummary constructor parses pathBasedRewardsList separately from collectedPathBasedRewardsList; UpdateProgression updates the latter.',
                            'tileEntities': 'QuestMapTileEntity schema has only bossId/allBuffs; no reward or barrier coordinate field.',
                        }, examples={
                            'mausoleumSevenStar': result['maps'].get('me_mausoleum_ch01_q02'),
                            'act10TagGate': (result['maps'].get('epilogue_ch01_q01') or {}).get('gates', []),
                            'classAndStar': [g for g in (result['maps'].get('a06_ch02_q01') or {}).get('unplacedGateDefinitions', [])
                                             if g['kind'] in ('class-and-rarity', 'rarity')],
                        }, gaps={
                            'uncapturedPathRewardQuestIds': [qid for qid, m in result['maps'].items() if m['coverage']['pathRewards'] == 'uncaptured'],
                            'unplacedGateDefinitionCount': sum(len(m['unplacedGateDefinitions']) for m in result['maps'].values()),
                            'unresolvedUnplacedGateDefinitionCount': sum(not g['resolved'] for m in result['maps'].values() for g in m['unplacedGateDefinitions']),
                            'chests': 'Native chest tables bind assets, not guaranteed Type/Data/Quantity contents; no chest contents are invented.',
                            'acquisition': 'No process, session, network, DB or new game acquisition used.',
                        }, unplacedGateQuests=[qid for qid, m in result['maps'].items() if m['unplacedGateDefinitions']])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--public-root', type=Path, default=REPO / 'src/data/game-quests')
    parser.add_argument('--original-root', type=Path, default=REPO / 'temp/quest-data-investigation/game-only')
    parser.add_argument('--supplement-root', type=Path, default=DEFAULT_SUPPLEMENT)
    parser.add_argument('--schema', type=Path, default=REPO / 'temp/crystals/schema.json')
    parser.add_argument('--output', type=Path, default=REPO / 'src/data/game-quests/map-features.json')
    parser.add_argument('--audit', type=Path, default=REPO / 'temp/quest-map-features-20261118/expanded-source-audit.json')
    parser.add_argument('--verify', action='store_true')
    args = parser.parse_args()
    result, audit = build(args.public_root, args.original_root, args.supplement_root, args.schema)
    for path, value in ((args.output, result), (args.audit, audit)):
        data = encoded(value)
        if args.verify:
            require(path.read_bytes() == data, f'Generated artifact drift: {path}')
        else:
            path.parent.mkdir(parents=True, exist_ok=True); path.write_bytes(data)
    print(json.dumps(dict(verified=args.verify, sha256=sha(args.output), counts=result['counts'])))


if __name__ == '__main__':
    main()
