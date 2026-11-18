"""Build finite gate presentation bindings from already frozen offline sources."""
import argparse
import hashlib
import json
from pathlib import Path

from build_map_features import REPO, encoded, load_labels, read, require, sha


def build(public_root, original_root, schema_path):
    features = read(public_root / 'map-features.json')
    baseline = read(public_root / 'manifest.json')
    labels, hashes = load_labels(original_root, schema_path)
    require(hashes['schema.json'] == baseline['labelEvidence']['schemaSha256'], 'Published label schema drift')
    require(hashes[baseline['labelEvidence']['file']] == baseline['labelEvidence']['sha256'], 'Published label BCG drift')
    require(hashes['current-blueprints.json'] == baseline['inputs']['current-blueprints.json'], 'Published blueprint drift')
    gates = [gate for layer in features['maps'].values() for gate in layer['gates']]
    blueprint_ids = {blueprint for gate in gates for blueprint in gate.get('constraints', {}).get('champions', [])}
    terms = {term.lstrip('!').lower() for gate in gates for group in gate.get('constraints', {}).get('tags', []) for term in group.split(':')}
    blueprints = {}
    for index, row in enumerate(read(original_root / 'current-blueprints.json')):
        if row['Blueprint'] not in blueprint_ids:
            continue
        require(row['Blueprint'] not in blueprints, 'Ambiguous exact gate blueprint')
        require(row['Character'] in labels['characters'], 'Missing gate character label')
        blueprints[row['Blueprint']] = dict(gameId=row['Character'], name=labels['characters'][row['Character']], sourcePointer=f'/{index}')
    require(set(blueprints) == blueprint_ids, 'Unresolved gate blueprint')
    tag_names = {term: labels['tags'].get(term) or labels['classes'].get(term) or labels['characters'].get(term) for term in sorted(terms)}
    require(all(tag_names.values()), 'Unresolved gate tag label')
    # A legacy BCG string has a replacement character for Æ. Use a published exact
    # Character identity's intact name, retaining the precise map/pointer evidence.
    label_evidence = {}
    for term, name in tag_names.items():
        if '\ufffd' not in name:
            continue
        for path in sorted((public_root / 'maps').glob('*.json')):
            identities = read(path).get('encounters', [])
            matches = [(index, identity) for index, identity in enumerate(identities)
                       if identity['gameId'] == term and '\ufffd' not in identity['name']]
            if matches:
                index, identity = matches[0]
                tag_names[term] = identity['name']
                label_evidence[term] = dict(file=path.relative_to(public_root).as_posix(), sha256=sha(path), pointer=f'/encounters/{index}/name', gameId=term)
                break
        require('\ufffd' not in tag_names[term], 'Corrupt unresolved gate character label')
    resources = {}
    for gate in gates:
        for cost in gate.get('constraints', {}).get('costs', []):
            key = (cost['type'], cost['data'])
            require(key in labels['items'], 'Unresolved gate cost label')
            resources[json.dumps(key, separators=(',', ':'))] = labels['items'][key]
    return dict(version=1, source=dict(bcgSha256=hashes[baseline['labelEvidence']['file']], schemaSha256=hashes['schema.json'],
                blueprintsFile='current-blueprints.json', blueprintsSha256=hashes['current-blueprints.json'],
                mapFeaturesSha256=sha(public_root / 'map-features.json'), gameStoreSha256=hashes['gamestore-5AFEBC8CC99BE2C1546DB91EF7B1F6360DFD7154.bin']),
                blueprints=dict(sorted(blueprints.items())), tagNames=tag_names, tagLabelEvidence=label_evidence, resourceNames=dict(sorted(resources.items())))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--public-root', type=Path, default=REPO / 'src/data/game-quests')
    parser.add_argument('--original-root', type=Path, default=REPO / 'temp/quest-data-investigation/game-only')
    parser.add_argument('--schema', type=Path, default=REPO / 'temp/crystals/schema.json')
    parser.add_argument('--output', type=Path, default=REPO / 'src/data/game-quests/gate-presentation.json')
    parser.add_argument('--verify', action='store_true')
    args = parser.parse_args()
    result = build(args.public_root, args.original_root, args.schema)
    data = encoded(result)
    if args.verify:
        require(args.output.read_bytes() == data, 'Generated gate presentation drift')
    else:
        args.output.write_bytes(data)
    print(json.dumps(dict(verified=args.verify, sha256=hashlib.sha256(data).hexdigest(), blueprints=len(result['blueprints']), tagTerms=len(result['tagNames']))))


if __name__ == '__main__':
    main()
