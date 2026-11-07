"""Extract direct champion reward pools from local game caches and current Cpp2IL metadata.

No game network requests or code execution. Carousel/featured art, shards, nested
crystals and bonus rewards never establish direct champion membership.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter
from datetime import datetime
from pathlib import Path

from export_mcoc_proto_schema import export_schema
from mcoc_protobuf import Decoder, fields

NON_CHAMPION_REWARD_TYPES = frozenset({'res', 'ebpf', 'gf', 'ebp', 'bp', 'inv', 'relic2', 'gs', 'sra', 'evta', 'oact', 'nothing'})

def unique(rows, field, label):
    result = {}
    for row in rows:
        key = row.get(field)
        if not isinstance(key, str) or not key:
            raise ValueError(f'Missing {label} identity')
        if key in result:
            raise ValueError(f'Duplicate {label}: {key}')
        result[key] = row
    return result


def champion_reward_identity(item):
    """Verified direct champion forms; promotional callers still do not grant membership."""
    if item.get('Type') == 'hero':
        return item.get('Data'), None
    if item.get('Type') in NON_CHAMPION_REWARD_TYPES:
        return None
    if item.get('Type') != 'hcos':
        raise ValueError(f'Unknown reward item type: {item.get("Type")}')
    parts = item.get('Data', '').split('|')
    if len(parts) != 2 or not parts[0] or not parts[1]:
        raise ValueError(f'Malformed hcos champion reward: {item.get("Data")}')
    # This snapshot uses hero-with-cosmetic rewards for First Edition champions.
    # Fail on a future cosmetic contract rather than silently guessing its meaning.
    if parts[1] != 'first_edition':
        raise ValueError(f'Unsupported hcos cosmetic: {parts[1]}')
    return parts[0], parts[1]


def build_catalog(gacha, blueprints, characters=None):
    categories = unique(gacha.get('categories', []), 'Name', 'category')
    blueprint_by_id = unique(blueprints, 'Blueprint', 'blueprint')
    character_by_id = unique(characters or [], 'Character', 'character')
    tiers = {}
    pools = []
    item_types = Counter()
    for category_id, category in sorted(categories.items()):
        tier_ids = set()
        cosmetic_rewards = set()
        for item in category.get('Items', []):
            item_types[item.get('Type', '')] += 1
            reward = champion_reward_identity(item)
            if reward is None:
                continue
            tier_id, cosmetic_id = reward
            blueprint = blueprint_by_id.get(tier_id)
            if not blueprint:
                raise ValueError(f'Unknown hero blueprint: {tier_id}')
            if item.get('Action', '') or any(item.get(k, 0) != 1 for k in ('Quantity', 'MinQuantity', 'MaxQuantity')):
                raise ValueError(f'Unsupported hero reward: {category_id}/{tier_id}')
            if not blueprint.get('Character') or blueprint.get('Rarity') not in range(1, 8):
                raise ValueError(f'Invalid champion/star identity: {tier_id}')
            tiers[tier_id] = dict(id=tier_id, championId=blueprint['Character'], rarity=blueprint['Rarity'])
            tier_ids.add(tier_id)
            if cosmetic_id:
                cosmetic_rewards.add((tier_id, cosmetic_id, item['Data']))
        pool = dict(id=category_id, heroTierIds=sorted(tier_ids))
        if cosmetic_rewards:
            pool['heroCosmeticRewards'] = [dict(tierId=tier_id, cosmeticId=cosmetic_id, sourceData=source_data)
                                           for tier_id, cosmetic_id, source_data in sorted(cosmetic_rewards)]
        pools.append(pool)

    crystals = []
    for group in gacha.get('groups', []):
        crystal_set = group.get('Set', {})
        for box in crystal_set.get('Boxes', []):
            category_ids = sorted(set(box.get('_possiblePrizeCategories', [])))
            for category_id in category_ids:
                if category_id not in categories:
                    raise ValueError(f'Unknown reward category: {box.get("Name")}/{category_id}')
            name = box.get('_displayName', {}).get('en', '').strip()
            if not name:
                # Keep the source definition; presentation may fall back to its ID.
                name = box.get('Name', '')
            selection = None
            if box.get('SelectableEnabled'):
                draw, pick = box.get('SelectableSpinCount', 0), box.get('SelectablePickCount', 0)
                if draw < 1 or pick < 1 or pick > draw:
                    raise ValueError(f'Invalid selection: {box.get("Name")}')
                selection = dict(draw=draw, pick=pick)
            promoted = set()
            for item in box.get('_boxFeaturedPrizes', []):
                reward = champion_reward_identity(item)
                if reward is None:
                    continue
                blueprint = blueprint_by_id.get(reward[0])
                if not blueprint or not blueprint.get('Character'):
                    raise ValueError(f'Unknown promotional hero blueprint: {item.get("Data")}')
                promoted.add(blueprint['Character'])
            crystals.append(dict(id=box.get('Name'), name=name, group=group.get('Name', ''),
                                 set=crystal_set.get('Name', ''), categoryIds=category_ids, selection=selection,
                                 promotedChampionIds=sorted(promoted),
                                 artwork=crystal_artwork(box), bannerArtwork=crystal_banner_artwork(box)))
    unique(crystals, 'id', 'crystal')
    if not crystals or not tiers:
        raise ValueError('Empty champion crystal catalog')
    hero_pools = {pool['id'] for pool in pools if pool['heroTierIds']}
    names = {tier['championId']: character_by_id.get(tier['championId'], {}).get('_friendlyNameLoc', {}).get('en', '').strip() for tier in tiers.values()}
    return dict(champions=[dict(id=identity, name=name) for identity, name in sorted(names.items()) if name], tiers=sorted(tiers.values(), key=lambda t: t['id']), pools=pools,
                crystals=sorted(crystals, key=lambda c: c['id']),
                coverage=dict(definitions=len(crystals), definitionsWithDirectHeroes=sum(bool(hero_pools.intersection(c['categoryIds'])) for c in crystals),
                              rewardItemTypes=dict(sorted(item_types.items())), directRewardsOnly=True))


def crystal_artwork(box):
    for member, flag in [('_closedImage', 'ClosedOnCDN'), ('_tokenImage', 'TokenImageOnCDN')]:
        reference = box.get(member, {}).get('en', '').strip()
        if reference:
            return dict(reference=reference, source='cdn' if box.get(flag, False) else 'resource')
    return None


def crystal_banner_artwork(box):
    reference = box.get('_backgroundImage', {}).get('en', '').strip()
    return dict(reference=reference, source='cdn' if box.get('BackgroundOnCDN', False) else 'resource') if reference else None


def digest(data):
    return hashlib.sha256(data).hexdigest()


def extract(gacha_path, bcg_path, metadata_path, observed_at):
    observed = datetime.fromisoformat(observed_at.replace('Z', '+00:00'))
    if observed.tzinfo is None:
        raise ValueError('--observed-at must include a timezone')
    schema = export_schema(metadata_path)
    # Fail closed if the named contracts no longer bind these extraction paths.
    contracts = {
        'EB.Sparx.GachaBox': {13: 'BackgroundOnCDN', 28: 'Name', 30: '_displayName', 34: '_backgroundImage', 42: '_possiblePrizeCategories', 44: '_boxFeaturedPrizes'},
        'EB.Sparx.GachaCategory': {1: 'Name', 2: 'Items'},
        'EB.Sparx.RedeemerItem': {5: 'Type', 6: 'Data'},
        'BCGBlueprintBase': {1: 'Blueprint', 2: 'Character', 14: 'Rarity'},
        'BCGDataBuffer': {3: 'heroes_blueprints', 4: 'characters'},
        'BCGCharacterData': {1: 'Character', 2: '_friendlyNameLoc'},
    }
    for kind, required in contracts.items():
        actual = {f['tag']: f['name'] for f in schema['types'][kind]['fields']}
        if any(actual.get(tag) != name for tag, name in required.items()):
            raise ValueError(f'Changed protobuf contract: {kind}')
    decoder = Decoder(schema)
    gacha_bytes, bcg_bytes = gacha_path.read_bytes(), bcg_path.read_bytes()
    gacha = decoder.message(gacha_bytes, 'EB.Sparx.GachaDataBuffer')
    blueprints, characters = [], []
    for tag, wire, value, _ in fields(bcg_bytes):
        if tag == 3 and wire == 2:
            blueprints.append(decoder.message(value, 'BCGBlueprintBase'))
        elif tag == 4 and wire == 2:
            characters.append(decoder.message(value, 'BCGCharacterData'))
    if decoder.unknown:
        raise ValueError(f'Unknown protobuf members: {decoder.unknown[:5]}')
    catalog = build_catalog(gacha, blueprints, characters)
    return dict(version=1, source=dict(observedAt=observed.isoformat(),
                gachaSha256=digest(gacha_bytes), bcgSha256=digest(bcg_bytes),
                metadata=[dict(assembly=Path(s['path']).name, sha256=s['sha256']) for s in schema['sources']]), **catalog)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--gacha', type=Path, required=True)
    parser.add_argument('--bcg', type=Path, required=True)
    parser.add_argument('--metadata', type=Path, required=True, help='Current Cpp2IL dummy DLL directory')
    parser.add_argument('--observed-at', required=True, help='Cache capture timestamp with timezone; not the import time')
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    result = extract(args.gacha, args.bcg, args.metadata, args.observed_at)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8', newline='\n')
    print(json.dumps(result['coverage']))
