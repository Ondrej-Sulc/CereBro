"""Export all static crystal rewards from a verified local cache, without account data.

Possible-prize categories, presentation prizes, conditional bonuses and pity
bindings stay separate. This never fetches odds or expands opaque item rewards.
"""
from __future__ import annotations

import argparse
from datetime import datetime
import hashlib
import json
from pathlib import Path

from export_mcoc_proto_schema import export_schema
from extract_mcoc_crystal_rules import build_rules, integer, reward, unique, validate_contracts
from mcoc_protobuf import Decoder, fields


def build_openings(gacha):
    # The current source has no tab definitions. Review their relationship to
    # group boxes before exporting a future source containing them.
    if gacha.get('tabs'):
        raise ValueError('Unreviewed tab definitions')
    rules = build_rules(gacha)
    by_id = {row['id']: row for row in rules['crystals']}
    categories = []
    for cid, raw in sorted(unique(gacha.get('categories', []), 'category').items()):
        row = {'id': cid, 'rewards': [reward(item, index) for index, item in enumerate(raw.get('Items', []))]}
        if 'DisplayRarityIndex' in raw:
            row['displayRarityIndex'] = integer(raw['DisplayRarityIndex'], 'display rarity index')
        categories.append(row)
    by_category = {row['id']: row for row in categories}
    for group in gacha.get('groups', []):
        source_set = group.get('Set', {})
        for raw in source_set.get('Boxes', []):
            row = by_id[raw['Name']]
            metadata = {}
            for member, target in [('Version', 'setVersion'), ('Index', 'setIndex'), ('Group', 'setGroup')]:
                if member in source_set: metadata[target] = source_set[member]
            for member, target in [('Version', 'boxVersion'), ('EndTime', 'endTime'), ('FreeTime', 'freeTime'),
                    ('MinItems', 'minItems'), ('MaxItems', 'maxItems'), ('Multiplier', 'multiplier'), ('PickSet', 'pickSet'),
                    ('Token', 'token'), ('_group', 'boxGroup'), ('Tab', 'tab')]:
                if member in raw: metadata[target] = raw[member]
            row['sourceMetadata'] = metadata
            presentation = {}
            for member, target in [('_boxFeaturedPrizes', 'featuredRewards'), ('_carouselFeaturedPrizes', 'carouselRewards')]:
                if member in raw: presentation[target] = [reward(item, index) for index, item in enumerate(raw[member])]
            if '_carouselFeaturedPrizesCategories' in raw:
                ids = raw['_carouselFeaturedPrizesCategories']
                if any(cid not in by_category for cid in ids):
                    raise ValueError(f'Unknown carousel prize category: {row["id"]}')
                presentation['carouselCategoryIds'] = ids
            if 'PossiblePrizes' in source_set:
                presentation['setPossibleRewards'] = [reward(item, index) for index, item in enumerate(source_set['PossiblePrizes'])]
            if presentation: row['presentation'] = presentation
    # Stable entry identities apply to bonus rewards too; never deduplicate them.
    for row in rules['bonusRewards']:
        row['rewards'] = [dict(sourceIndex=index, **item) for index, item in enumerate(row['rewards'])]
    return dict(numericOddsStatus=rules['numericOddsStatus'], crystals=rules['crystals'], categories=categories,
                bonusRewards=rules['bonusRewards'], pityTemplates=rules['pityTemplates'], pityGroups=rules['pityGroups'],
                coverage={**rules['coverage'], 'categories': len(categories),
                    'rewardEntries': sum(len(row['rewards']) for row in categories),
                    'definitionsWithoutDirectChampions': sum(not any(item['type'] in ('hero', 'hcos')
                        for cid in row['categoryIds'] for item in by_category[cid]['rewards']) for row in rules['crystals']),
                    'definitionsWithoutPrizeCategories': sum(not row['categoryIds'] for row in rules['crystals'])})


def add_display_names(catalog, blueprints=(), characters=(), store_items=(), evo_blueprints=(), gacha=None):
    """Exact registry joins only. A missing title remains an unresolved source ID."""
    names = {}
    for item in store_items:
        if not item.get('Name') or not item.get('Title'): continue
        key = ('inv', item['Name'])
        if key in names and names[key] != item['Title']: raise ValueError(f'Conflicting inventory display title: {item["Name"]}')
        names[key] = item['Title']
    character_names = {row['Character']: row.get('_friendlyNameLoc', {}).get('en') for row in characters}
    champion_by_id = {row['Blueprint']: row for row in blueprints}
    evo_names = {row['EvoBlueprint']: row.get('_friendlyNameLoc', {}).get('en') for row in evo_blueprints}
    token_names, token_boxes = {}, {}
    for group in (gacha or {}).get('groups', []):
        for box in group.get('Set', {}).get('Boxes', []):
            token = box.get('Token')
            if not token: continue
            token_boxes.setdefault(token, []).append(box['Name'])
            display = box.get('_displayName', {}).get('en')
            fragment = box.get('_fragmentName', {}).get('en') or display
            for typ, value in [('gs', display), ('gf', fragment)]:
                if value: token_names.setdefault((typ, token), set()).add(value)
    # The runtime can find multiple boxes for one token; only export a label when
    # every named match agrees. A token is not automatically a crystal source ID.
    names.update({key: next(iter(values)) for key, values in token_names.items() if len(values) == 1})
    all_items = [item for category in catalog['categories'] for item in category['rewards']]
    all_items += [item for bonus in catalog['bonusRewards'] for item in bonus['rewards']]
    all_items += [item for crystal in catalog['crystals'] for key, rows in crystal.get('presentation', {}).items()
                  if key in ('featuredRewards', 'carouselRewards', 'setPossibleRewards') for item in rows]
    for item in all_items:
        if item['type'] in ('hero', 'hcos', 'bp'):
            bid = item['data']
            if item['type'] == 'hcos':
                parts = bid.split('|')
                # Same reviewed first-edition format as extract_mcoc_crystals.py.
                bid = parts[0] if len(parts) == 2 and parts[1] == 'first_edition' else None
            blueprint = champion_by_id.get(bid, {})
            game_id = blueprint.get('Character')
            label = character_names.get(game_id)
            if game_id: item['gameId'] = game_id
            if 'Rarity' in blueprint:
                rarity = integer(blueprint['Rarity'], 'hero rarity', 1)
                if rarity > 7: raise ValueError('Unreviewed champion rarity')
                item['rarity'] = rarity
        elif item['type'] in ('ebp', 'ebpf'):
            # ebpf's runtime label additionally formats localized fragment/alloy
            # text. The raw source-friendly base name remains correctly typed.
            label = evo_names.get(item['data'])
        else:
            label = names.get((item['type'], item['data']))
        if label:
            if not isinstance(label, str): raise ValueError('Non-string reward display name')
            item['displayName'] = label
        if item['type'] in ('gs', 'gf') and len(token_boxes.get(item['data'], [])) == 1:
            item['nestedCrystalId'] = token_boxes[item['data']][0]
    catalog['coverage']['rewardEntriesWithDisplayNames'] = sum('displayName' in item for category in catalog['categories'] for item in category['rewards'])


def localize_display_names(catalog, words_files):
    translations, sources = {}, {}
    for path in sorted(words_files):
        raw = path.read_bytes(); content = json.loads(raw)
        if content.get('meta', {}).get('language') != 'en': continue
        if content.get('meta', {}).get('format') != 'sparx': raise ValueError('Unreviewed words format')
        sources[path.name] = {'kind': 'localization', 'fileName': path.name, 'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw)}
        for row in content.get('strings', []):
            if not isinstance(row.get('k'), str) or not isinstance(row.get('v'), str): raise ValueError('Invalid English word entry')
            translations.setdefault(row['k'], {}).setdefault(row['v'], set()).add(path.name)
    all_items = [item for category in catalog['categories'] for item in category['rewards']]
    all_items += [item for bonus in catalog['bonusRewards'] for item in bonus['rewards']]
    all_items += [item for crystal in catalog['crystals'] for key, rows in crystal.get('presentation', {}).items()
                  if key in ('featuredRewards', 'carouselRewards', 'setPossibleRewards') for item in rows]
    used = set()
    for item in all_items:
        label = item.get('displayName')
        matches = translations.get(label, {})
        if len(matches) == 1:
            value, files = next(iter(matches.items()))
            item['displayName'] = value; used.update(files)
        elif label and label.startswith('ID_'):
            del item['displayName']
    catalog['coverage']['rewardEntriesWithDisplayNames'] = sum('displayName' in item for category in catalog['categories'] for item in category['rewards'])
    return [sources[name] for name in sorted(used)]


def extract(gacha_path, schema, observed_at, captured_at, expected_sha256=None, bcg_path=None, gamestore_path=None, words_path=None):
    observed = datetime.fromisoformat(observed_at.replace('Z', '+00:00'))
    captured = datetime.fromisoformat(captured_at.replace('Z', '+00:00'))
    if observed.tzinfo is None or captured.tzinfo is None:
        raise ValueError('Observation and capture timestamps must include a timezone')
    if captured < observed: raise ValueError('Capture cannot precede observation')
    validate_contracts(schema)
    required = {
        'EB.Sparx.RedeemerItem': {1: 'Balance', 2: 'MaxQuantity', 3: 'MinQuantity', 4: 'Quantity', 5: 'Type',
            6: 'Data', 7: 'Action', 8: 'Header', 9: 'Footer', 10: 'ContextProto'},
        'EB.Sparx.GachaSet': {1: 'Index', 2: 'Name', 3: 'Group', 4: 'Version', 5: 'AttractImages', 6: 'PossiblePrizes', 7: 'Boxes'},
    }
    for kind, expected in required.items():
        if {field['tag']: field['name'] for field in schema['types'][kind]['fields']} != expected:
            raise ValueError(f'Unreviewed all-reward protobuf contract: {kind}')
    box_contract = {field['tag']: field['name'] for field in schema['types']['EB.Sparx.GachaBox']['fields']}
    if any(box_contract.get(tag) != member for tag, member in {2: 'EndTime', 4: 'Multiplier', 8: 'MinItems', 9: 'MaxItems',
            21: '_group', 22: 'PickSet', 23: 'Version', 24: 'Token', 43: '_carouselFeaturedPrizesCategories',
            44: '_boxFeaturedPrizes', 45: '_carouselFeaturedPrizes'}.items()):
        raise ValueError('Changed all-reward box metadata protobuf contract')
    raw = gacha_path.read_bytes()
    sha = hashlib.sha256(raw).hexdigest()
    if expected_sha256 and expected_sha256 != sha: raise ValueError('Source gacha hash differs from expected snapshot')
    decoder = Decoder(schema)
    data = decoder.message(raw, 'EB.Sparx.GachaDataBuffer')
    if decoder.unknown: raise ValueError(f'Unknown protobuf members: {decoder.unknown[:5]}')
    schema_sha = hashlib.sha256(json.dumps(schema['types'], sort_keys=True, separators=(',', ':')).encode('utf8')).hexdigest()
    source = {'observedAt': observed.isoformat(), 'capturedAt': captured.isoformat(), 'gachaSha256': sha,
        'gacha': {'fileName': gacha_path.name, 'sha256': sha, 'bytes': len(raw)},
        'schemaSha256': schema_sha,
        'metadata': [{'assembly': Path(row['path'].replace('\\', '/')).name, 'sha256': row['sha256']} for row in schema['sources']]}
    result = {'version': 1, 'source': source, **build_openings(data)}
    display_sources, blueprints, characters, store_items, evo_blueprints = [], [], [], [], []
    if bcg_path or gamestore_path:
        reviewed = {'Marvel.Runtime.dll': 'd1b1085922513073b9dcd656aa08ee70e01a7aef1433aa35876fdfba463278b5',
                    'Fuse.Runtime.dll': 'c7296f9c50334d3f12ece5ae2e7c9566d6965cc355c9eecad8af8acfe561a24b'}
        actual = {row['assembly']: row['sha256'] for row in source['metadata']}
        if any(actual.get(name) != sha for name, sha in reviewed.items()):
            raise ValueError('Reward display dispatcher mappings require review for changed game metadata')
    for kind, path in [('bcg', bcg_path), ('gameStore', gamestore_path)]:
        if path is None: continue
        payload = path.read_bytes()
        display_sources.append({'kind': kind, 'fileName': path.name, 'sha256': hashlib.sha256(payload).hexdigest(), 'bytes': len(payload)})
        display_decoder = Decoder(schema)
        if kind == 'bcg':
            for tag, wire, value, _ in fields(payload):
                if tag in (3, 4, 5):
                    if wire != 2: raise ValueError('Invalid BCG display metadata message')
                    row = display_decoder.message(value, {3: 'BCGBlueprintBase', 4: 'BCGCharacterData', 5: 'BCGEvoBlueprintBase'}[tag])
                    {3: blueprints, 4: characters, 5: evo_blueprints}[tag].append(row)
        else:
            store = display_decoder.message(payload, 'EB.Sparx.GameStoreDataBuffer')
            store_items = [item for group in store.get('items', {}).values() for item in group.get('gameStoreItems', [])]
        if display_decoder.unknown: raise ValueError(f'Unknown display metadata members: {display_decoder.unknown[:5]}')
    if display_sources: source['displayMetadata'] = display_sources
    add_display_names(result, blueprints, characters, store_items, evo_blueprints, data)
    if words_path:
        words_files = list(words_path.glob('*.json')) if words_path.is_dir() else [words_path]
        if not words_files: raise ValueError('No captured English word files')
        source.setdefault('displayMetadata', []).extend(localize_display_names(result, words_files))
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--gacha', type=Path, required=True)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument('--metadata', type=Path)
    source.add_argument('--schema', type=Path)
    parser.add_argument('--observed-at', required=True)
    parser.add_argument('--captured-at', required=True)
    parser.add_argument('--expected-gacha-sha256')
    parser.add_argument('--bcg', type=Path, help='Optional exact blueprint/character display-name registry')
    parser.add_argument('--gamestore', type=Path, help='Optional exact inventory-item display-name registry')
    parser.add_argument('--words', type=Path, help='Optional captured Sparx English localization file or directory')
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    schema = export_schema(args.metadata) if args.metadata else json.loads(args.schema.read_text(encoding='utf8'))
    result = extract(args.gacha, schema, args.observed_at, args.captured_at, args.expected_gacha_sha256, args.bcg, args.gamestore, args.words)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':'))+'\n', encoding='utf8', newline='\n')
    print(json.dumps(result['coverage'], indent=2))
