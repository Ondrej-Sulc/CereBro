"""Exact native reward labels and separately rendered item details; no game access."""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import sys

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / 'scripts'))
from mcoc_protobuf import Decoder, fields
from extract_mcoc_crystal_openings import add_display_names, localize_display_names
from extract_mcoc_reward_artwork import REVIEWED_METADATA

NATIVE = {
    'GameStoreUtils.txt': 'b1a54b54fdb524a2b4e491de9e91c22545f0e07f3a795340553041969a2aed87',
    'HeroRankItemDisplay.txt': 'de1fd0be6634b762e09c43fa23954121b2a0c7c54644371ed4ae607dd9789e3a',
    'BCGManager.txt': '90c9b70da99c108cab02b41a436182b793b31b9e323f721f35f9b6e76756cdfc',
    'GameStoreUtils_NestedType___c.txt': '9052e21e49c905cf077ff4c4e1b31ddc14cdebc6aca4e9333ff366cdd71e8673',
    'InventoryHelper_NestedType_InventoryItem.txt': '7442cc5ff84d95fb42ddbacdb1e0efb877d4844301d7eccac82511bdbbc036cf',
}


def read(path): return json.loads(path.read_text(encoding='utf-8'))
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def canonical(value): return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))


def inventory_details(item, rarities, classes):
    if not (item.get('UseOnHero') or item.get('UseOnRelic')):
        return {}
    result = {}
    # Both native helpers scan HTags + ',' + Name, then comma groups and colon
    # tokens. An underscore suffix is never a rarity or class binding.
    tokens = [token for group in (item.get('HTags', '') + ',' + item['Name']).split(',')
              for token in group.strip().lower().split(':')]
    rarity = next((rarities[t] for t in tokens if rarities.get(t, 0) > 0), None)
    class_name = next((classes[t] for t in tokens if t in classes and t != 'none'), None)
    if rarity is not None:
        result['rarity'] = rarity
    if class_name:
        result['className'] = class_name
    redeemers = item.get('Redeemers') or []
    first_type = redeemers[0].get('Type') if redeemers else None
    rank = item.get('Rank')
    if type(rank) is int and rank > 0 and first_type in ('hrup', 'hrdwn', 'rrup', 'rrdwn'):
        # HeroRankItemDisplay.GetRankInformation uses one step, independently
        # of the reward quantity and of Redeemers[0].Quantity.
        result['rankChange'] = {'from': rank, 'to': rank + (1 if first_type in ('hrup', 'rrup') else -1)}
    if item.get('SigState') == 'a':
        # GetSkillUpPoints uses Find, not the first overall redeemer. The
        # returned per-stone points are independent of reward item quantity.
        skill = next((r for r in redeemers if r.get('Type') in ('skl', 'rskl')), None)
        points = skill.get('Quantity') if skill else None
        if type(points) is int and 0 < points <= 9007199254740991:
            result['signaturePoints'] = points
    return result


def used_rewards(repo):
    used = set()
    for p in ('game-reward-artwork/manifest.json', 'game-quests/reward-artwork/manifest.json'):
        catalog = read(repo / 'src/data' / p)
        used.update((r['type'], r['data']) for r in catalog['assets'] + catalog['missing'])
    for p, key in [('rewards.json', 'owners'), ('act10.json', 'rewards')]:
        for owner in read(repo / 'src/data/game-quests' / p)[key].values():
            for rows in owner['scopes'].values():
                used.update((r['type'], r['data']) for r in rows)
    used.update(tuple(k.split(':', 1)) for k in read(repo / 'src/data/game-quests/tower-presentation/catalog.json')['rewards'])
    return sorted(used)


def build(args):
    schema = read(args.schema)
    assert {Path(s['path'].replace('\\', '/')).name: s['sha256'] for s in schema['sources']} == REVIEWED_METADATA
    for name, expected in NATIVE.items():
        assert sha(args.native / name) == expected, 'Native item-display proof changed'
    source = read(REPO / 'src/data/game-reward-artwork/manifest.json')['source']
    registries = {}
    for r in source['registries']:
        p = (args.store if r['kind'] == 'gameStore' else args.source / 'sources') / r['fileName']
        assert sha(p) == r['sha256'], 'Native registry changed'
        registries[r['kind']] = p
    decoder = Decoder(schema)
    store = decoder.message(registries['gameStore'].read_bytes(), 'EB.Sparx.GameStoreDataBuffer')
    gacha = decoder.message(registries['gacha'].read_bytes(), 'EB.Sparx.GachaDataBuffer')
    kinds = {5: 'BCGEvoBlueprintBase', 9: 'BCGHeroClass', 12: 'BCGRarityProperties'}
    bcg = {n: [] for n in kinds}
    for tag, _, value, _ in fields(registries['bcg'].read_bytes()):
        if tag in kinds:
            bcg[tag].append(decoder.message(value, kinds[tag]))
    assert not decoder.unknown, 'Unknown native display fields'
    items = [i for group in store.get('items', {}).values() for i in group.get('gameStoreItems', [])]
    inventory = {}
    for item in items:
        if item.get('Name'):
            inventory.setdefault(item['Name'], []).append(item)
    rarities = {r['ID']: r['MapValue'] for r in bcg[12]}
    classes = {r['ClassID']: r['_classNameLoc']['en'] for r in bcg[9] if r.get('_classNameLoc', {}).get('en')}
    rows = [{'type': t, 'data': n} for t, n in used_rewards(REPO) if t not in ('hero', 'hcos', 'bp')]
    holder = {'categories': [{'rewards': rows}], 'bonusRewards': [], 'crystals': [], 'coverage': {}}
    add_display_names(holder, store_items=items, evo_blueprints=bcg[5], gacha=gacha)
    localization = localize_display_names(holder, list(args.words.glob('*.json')))
    records = {}
    for row in rows:
        if not row.get('displayName'):
            continue
        metadata = {'name': row['displayName']}
        if row['type'] == 'inv':
            matches = inventory.get(row['data'], [])
            details = {canonical(inventory_details(i, rarities, classes)) for i in matches}
            assert len(details) == 1, 'Ambiguous inventory presentation'
            metadata.update(json.loads(next(iter(details))))
            metadata['definitionHashes'] = sorted({hashlib.sha256(canonical(i).encode()).hexdigest() for i in matches})
        records[canonical([row['type'], row['data']])] = metadata
    catalog = {'version': 1, 'source': {'registries': source['registries'], 'schemaSha256': sha(args.schema),
               'nativeDisplayProofs': NATIVE, 'localization': localization}, 'rewards': records}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(canonical(catalog) + '\n', encoding='utf-8')
    print(json.dumps({'labels': len(records), 'rankItems': sum('rankChange' in r for r in records.values()),
                      'signatureItems': sum('signaturePoints' in r for r in records.values())}))


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source', type=Path, default=Path('C:/Code/CereBro/temp/quest-data-investigation/game-only'))
    p.add_argument('--store', type=Path, default=Path('C:/Code/CereBro/temp/crystal-openings'))
    p.add_argument('--schema', type=Path, default=Path('C:/Code/CereBro/temp/crystals/schema.json'))
    p.add_argument('--words', type=Path, default=Path('C:/Code/CereBro/temp/crystal-openings/words'))
    p.add_argument('--native', type=Path, default=Path('D:/CodexArtifacts/Cpp2IL-2026-11-03/IsilDump/Marvel.Runtime'))
    p.add_argument('--output', type=Path, default=REPO / 'src/data/game-reward-presentation/catalog.json')
    build(p.parse_args())
