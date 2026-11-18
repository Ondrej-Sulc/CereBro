"""Offline allowlisted quest preparation and chest placement overlay.

Reads frozen public definitions only. Never imports a game reader or acquires
process, network, database, account, collection, inventory, or session data.
"""
import argparse
import hashlib
import json
import re
from collections import Counter
from pathlib import Path

from build_boss_display import documents, source_path
from build_map_features import DEFAULT_SUPPLEMENT, REPO, STARS, coordinate, encoded, load_labels, read, require, sha

SOURCE_AUDIT_SHA256 = '56236bad5147669b209443c70247f1568585ce7910229981c81bb4ea006ed774'
NATIVE_PINS = {
    'QuestSummary.txt': 'a78e3dfd566e7b5d3c3bb894f2cc776f4ebb917417178eff488cb7a0caac87e5',
    'TeamSelectScreen.txt': 'f3710694c03e721c3e098d692d3737c9bdaad9b63ead3f6764e823cc0b5b69e6',
    'BCGManager.txt': '90c9b70da99c108cab02b41a436182b793b31b9e323f721f35f9b6e76756cdfc',
    'QuestMapTile.txt': '995d78c9e2361e4375c78a2e330a299dfa41447e94dba9071a79131c4706e6df',
    'GameQuestRestrictionUtils.txt': 'f2ba6000bfb1c4a2facb294aa45fffd14acb328233dc85346c0c64e7d02a99bd',
}
# Presentation policy, not a claim about native sentinel semantics. The exact
# exceptional source values remain in the hash-bound frozen definitions.
RATING_DISPLAY_LIMIT = 9999999


def champion_requirement(value, labels):
    require(isinstance(value, str), 'Invalid champion restriction string')
    if not value:
        return None
    # QuestSummary splits commas; ValidateHeroTags trims/lowercases each group
    # and tests every colon term, succeeding on any fully satisfied group.
    groups = [group.strip().lower().split(':') for group in value.split(',')]
    require(all(all(term for term in group) for group in groups), 'Empty champion requirement term')
    names, resolved = [], True
    for group in groups:
        terms = []
        for term in group:
            negated = term.startswith('!')
            token = term[1:] if negated else term
            name = (f'{STARS[token]}\u2605' if token in STARS else
                    labels.get('tags', {}).get(token) or labels.get('classes', {}).get(token)
                    or labels.get('characters', {}).get(token))
            resolved = resolved and bool(name)
            terms.append(('not ' if negated else '') + (name or 'specified requirement'))
        names.append(' and '.join(terms))
    label = 'Each champion: ' + ' or '.join(f'({name})' if len(group) > 1 and len(groups) > 1 else name
                                            for name, group in zip(names, groups))
    return dict(groups=groups, label=label if resolved else 'Champion requirements not captured', resolved=resolved)


def preparation(quest, source, labels):
    result = dict(source=source)
    for native, public, minimum in [('energyPerTile', 'energyPerTile', 0), ('teamSizeMin', 'minTeamSize', 1),
                                     ('teamSizeMax', 'maxTeamSize', 1), ('recommendedPartyPI', 'recommendedTeamRating', 1)]:
        value = quest.get(native)
        if value is None:
            continue
        require(type(value) is int, 'Invalid static quest preparation number')
        require(-(2**31) <= value < 2**31, 'Out-of-range native quest preparation number')
        if value < minimum or native == 'recommendedPartyPI' and value >= RATING_DISPLAY_LIMIT:
            continue
        result[public] = value
    requirement = champion_requirement(quest.get('championRestrictions', ''), labels)
    if requirement:
        result['championRequirement'] = requirement
    require(not all(k in result for k in ('minTeamSize', 'maxTeamSize'))
            or result['minTeamSize'] <= result['maxTeamSize'], 'Invalid quest team size range')
    return result


def project(public, quest, source_map, source, labels, wire=False, map_pointer='/map'):
    require((quest['qid'], quest['mapId']) == (public['questId'], public['mapId']), 'Quest details identity mismatch')
    native_tiles = ([(t, f'{map_pointer}/grid/{x}/{y}') for x, row in enumerate(source_map['grid']) for y, t in enumerate(row)
                     if t and t.get('walkable')] if wire else
                    [(t, f'{map_pointer}/walkableTiles/{i}') for i, t in enumerate(source_map['walkableTiles'])])
    coordinates = [tuple(coordinate(t)) for t, _ in native_tiles]
    require(len(set(coordinates)) == len(coordinates), 'Duplicate native chest tile coordinate')
    require(set(coordinates) == {tuple(t['coordinate']) for t in public['tiles']}, 'Quest details tile coordinates differ')
    table = quest.get('chestTable' if wire else 'chests') or {}
    require(isinstance(table, dict), 'Invalid native chest table')
    chests = []
    for tile, pointer in native_tiles:
        chest_id = tile.get('item')
        if not chest_id:
            continue
        require(isinstance(chest_id, str), 'Invalid native chest identity')
        definition = table.get(chest_id)
        asset = (definition.get('asset') if isinstance(definition, dict) else None) if wire else definition
        require(asset is None or isinstance(asset, str), 'Invalid native chest asset')
        c = coordinate(tile)
        chests.append(dict(id=f"{public['questId']}:chest:{c[0]},{c[1]}:{chest_id}", coordinate=c,
                           pathIndices=[p['index'] for p in public['paths'] if c in p['coordinates']],
                           chestId=chest_id, asset=asset or None, source=dict(source, pointer=pointer + '/item')))
    return dict(questId=public['questId'], mapId=public['mapId'], sourceHash=public['sourceHash'],
                preparation=preparation(quest, source, labels), chests=chests,
                chestCoverage='captured' if all('item' in t for t, _ in native_tiles) else 'uncaptured')


def build(public_root, original_root, supplement_root, schema_path, source_audit, native_root):
    require(sha(source_audit) == SOURCE_AUDIT_SHA256, 'Frozen quest source audit drift')
    audit = read(source_audit)
    require(len(audit['sources']) == 211, 'Frozen quest source scope drift')
    labels, hashes = load_labels(original_root, schema_path)
    baseline = read(public_root / 'manifest.json')
    published_names = ('manifest.json', 'permanent.json', 'progressed.json', 'act10.json')
    published = {name: read(public_root / name) for name in published_names}
    # Runtime permanentData spreads progressed over the preceding permanent
    # allowlist. Include exactly that public set, never directory extras.
    public_ids = set(published['progressed.json']['publicQuestIds'])
    catalogs = read(public_root / 'catalog.json') + read(public_root / 'progressed-catalog.json')
    catalog = {q['id']: q for q in catalogs if q['id'] in public_ids}
    require(len(catalog) == len(public_ids), 'Published public quest catalog mismatch')
    loader_names = {'act10-maps': 'act10-map-loaders.js', 'progressed-maps': 'progressed-map-loaders.js',
                    'permanent-maps': 'permanent-map-loaders.ts', 'maps': 'map-loaders.ts'}
    loader_ids = {directory: set(re.findall(r'"([^"]+)":\s*\(\)\s*=>', (public_root / name).read_text()))
                  for directory, name in loader_names.items()}
    rows = {row['questId']: row for row in audit['sources']}
    require(len(rows) == len(audit['sources']) and set(rows) <= public_ids, 'Frozen source audit/public scope mismatch')
    for qid in sorted(public_ids - set(rows)):
        # The 23 later permanent additions have independent frozen progressed
        # source and published-map hashes in the already shipped manifest.
        binding = published['progressed.json']['maps'].get(qid)
        require(binding is not None and qid in loader_ids['progressed-maps'], 'Missing public progressed map binding')
        require(binding['catalogSourceHash'] == catalog[qid]['sourceHash'] and binding['mapId'] == catalog[qid]['mapId'],
                'Public progressed catalog source mismatch')
        rows[qid] = dict(questId=qid, publicFile=f'progressed-maps/{qid}.json',
                         publicMapSha256=binding['publicMapSha256'], sourceSha256=binding['sourceHash'], pointer='/quest')
    require(hashes['schema.json'] == baseline['labelEvidence']['schemaSha256'], 'Quest details label schema drift')
    require(hashes[baseline['labelEvidence']['file']] == baseline['labelEvidence']['sha256'], 'Quest details label BCG drift')
    require(hashes['current-blueprints.json'] == baseline['inputs']['current-blueprints.json'], 'Quest details blueprint drift')
    for name, digest in NATIVE_PINS.items():
        require(sha(native_root / name) == digest, 'Quest details native semantics drift: ' + name)
    maps, counts, cache, omissions = {}, Counter(), {}, []
    for row in sorted(rows.values(), key=lambda row: row['questId']):
        public_path = public_root / row['publicFile']
        require(sha(public_path) == row['publicMapSha256'], 'Quest details public map hash mismatch')
        public = read(public_path)
        directory = Path(row['publicFile']).parts[0]
        require(public['questId'] in loader_ids[directory], 'Quest details map is not in its public loader')
        manifest_name = {'act10-maps': 'act10.json', 'progressed-maps': 'progressed.json', 'permanent-maps': 'permanent.json'}.get(directory)
        published_hash = (published[manifest_name]['maps'][public['questId']]['publicMapSha256'] if manifest_name else
                          baseline['outputs'][row['publicFile']])
        require(published_hash == row['publicMapSha256'], 'Quest details published manifest hash mismatch')
        path = source_path(public, directory, original_root, supplement_root)
        require(sha(path) == row['sourceSha256'] == public['sourceHash'], 'Quest details frozen source hash mismatch')
        if path not in cache:
            raw = read(path)
            if path.name == 'runtime-supply.json':
                cache[path] = raw
        else:
            raw = cache[path]
        require(not raw.get('issues'), 'Frozen quest source capture issues')
        wire = directory == 'act10-maps'
        quest, source_map = documents(public, raw, wire)
        capture = dict(file=public['sourceFile'], sha256=public['sourceHash'], pointer=row['pointer'], capturedAt=raw['capturedAt'])
        require(not Path(capture['file']).is_absolute() and '..' not in Path(capture['file']).parts, 'Invalid public quest source file')
        map_pointer = row['pointer'].replace('/QuestSummarys/', '/QuestMaps/') if 'pveSets' in raw else '/map'
        projected = project(public, quest, source_map, capture, labels, wire, map_pointer)
        projected['publicMapSha256'] = row['publicMapSha256']
        require(public['questId'] == row['questId'] and public['questId'] not in maps, 'Duplicate or foreign quest details identity')
        maps[public['questId']] = projected
        hashes[capture['file']] = capture['sha256']
        counts['maps'] += 1
        counts['chests'] += len(projected['chests'])
        counts['unresolvedChestAssets'] += sum(c['asset'] is None for c in projected['chests'])
        counts['mapsWithoutChestCapture'] += projected['chestCoverage'] == 'uncaptured'
        requirement = projected['preparation'].get('championRequirement')
        counts['championRequirements'] += requirement is not None
        counts['unresolvedChampionRequirements'] += bool(requirement and not requirement['resolved'])
        if 'recommendedPartyPI' in quest and 'recommendedTeamRating' not in projected['preparation']:
            omissions.append(dict(questId=public['questId'], field='recommendedPartyPI', reason='nonpositive-or-above-display-limit'))
    return dict(version=1, maps=dict(sorted(maps.items())), sourceHashes=dict(sorted(hashes.items())),
                sourceAuditSha256=SOURCE_AUDIT_SHA256, nativeSemanticsSources=NATIVE_PINS,
                publicManifestHashes={name: sha(public_root / name) for name in published_names}, counts=dict(counts)), omissions


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--public-root', type=Path, default=REPO / 'src/data/game-quests')
    parser.add_argument('--original-root', type=Path, default=REPO / 'temp/quest-data-investigation/game-only')
    parser.add_argument('--supplement-root', type=Path, default=DEFAULT_SUPPLEMENT)
    parser.add_argument('--schema', type=Path, default=REPO / 'temp/crystals/schema.json')
    parser.add_argument('--source-audit', type=Path, default=REPO / 'temp/quest-map-features-20261118/source-audit.json')
    parser.add_argument('--native-root', type=Path, default=Path('D:/CodexArtifacts/Cpp2IL-2026-11-03/IsilDump/Marvel.Runtime'))
    parser.add_argument('--output', type=Path, default=REPO / 'src/data/game-quests/quest-details.json')
    parser.add_argument('--verify', action='store_true')
    args = parser.parse_args()
    result, omissions = build(args.public_root, args.original_root, args.supplement_root, args.schema, args.source_audit, args.native_root)
    data = encoded(result)
    if args.verify:
        require(args.output.read_bytes() == data, 'Generated quest details drift')
    else:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_bytes(data)
    print(json.dumps(dict(verified=args.verify, sha256=hashlib.sha256(data).hexdigest(), counts=result['counts'], omittedRecommendations=omissions)))


if __name__ == '__main__':
    main()
