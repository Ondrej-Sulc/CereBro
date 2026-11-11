"""Add missing quest/Tower reward art from pinned native registries; no game access."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import sys

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO/'scripts'))
from extract_mcoc_crystal_artwork import download, export_image, resource_index
from extract_mcoc_reward_artwork import build_bindings, tint_image, material_shader_provenance, REVIEWED_METADATA
from mcoc_protobuf import Decoder, fields


def read(path): return json.loads(path.read_text(encoding='utf-8'))
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def signature(row): return row['source'], row['reference'], json.dumps(row.get('renderTint'), sort_keys=True)


def reward_ids(repo):
    towers = read(repo/'src/data/game-quests/tower-presentation/catalog.json')
    quests = read(repo/'src/data/game-quests/rewards.json')
    used = {tuple(k.split(':', 1)) for k in towers['rewards']}
    for owner in quests['owners'].values():
        for rows in owner['scopes'].values():
            used.update((row['type'], row['data']) for row in rows)
    for owner in read(repo/'src/data/game-quests/act10.json')['rewards'].values():
        for rows in owner['scopes'].values():
            used.update((row['type'], row['data']) for row in rows)
    return used


def build(args):
    shared_path = REPO/'src/data/game-reward-artwork/manifest.json'
    shared = read(shared_path)
    palette_path = REPO/'src/data/game-reward-artwork/palette.json'
    palette = read(palette_path)
    assert sha(args.resources.parent.parent/'resources.assets') == palette['source']['sha256'], 'Native palette resources drift'
    material_shader = material_shader_provenance(args.resources.parent.parent/'resources.assets', palette['source'])
    schema = read(args.schema)
    assert {Path(r['path'].replace('\\','/')).name:r['sha256'] for r in schema['sources']} == REVIEWED_METADATA, 'Metadata drift'
    resource_dispatch = Path('D:/CodexArtifacts/Cpp2IL-2026-11-03/IsilDump/Marvel.Runtime/CustomRedeemerMappings/ResourceRedeemerMapping.txt')
    assert sha(resource_dispatch) == '93d8f05f2b0b30420babd5b5dda9f2cb56900ae10860fcde82799d98bd152638', 'Resource artwork dispatch drift'
    paths = {'gacha':args.source_root/'sources', 'bcg':args.source_root/'sources', 'gameStore':args.store_root}
    raw = {}
    for source in shared['source']['registries']:
        p = paths[source['kind']]/source['fileName']
        assert sha(p) == source['sha256'], 'Registry drift'
        raw[source['kind']] = p.read_bytes()
    decoder = Decoder(schema)
    gacha = decoder.message(raw['gacha'], 'EB.Sparx.GachaDataBuffer')
    store = decoder.message(raw['gameStore'], 'EB.Sparx.GameStoreDataBuffer')
    evos, classes = [], []
    for tag, _, value, _ in fields(raw['bcg']):
        if tag == 5: evos.append(decoder.message(value, 'BCGEvoBlueprintBase'))
        if tag == 9: classes.append(decoder.message(value, 'BCGHeroClass'))
    assert not decoder.unknown, 'Unknown registry fields'
    existing = {(r['type'],r['data'],r['role']) for r in shared['assets']}
    used = reward_ids(REPO)
    needed = sorted((t,n) for t,n in used if t not in ('hero','hcos') and (t,n,'fragment' if t in ('gf','ebpf') else 'full') not in existing)
    opening = {'categories':[{'rewards':[{'type':t,'data':n} for t,n in needed]}]}
    items = [i for group in store.get('items',{}).values() for i in group.get('gameStoreItems',[])]
    plan = build_bindings(opening, gacha, evos, items, palette['colors'], hero_classes=classes)
    local = resource_index(args.resources)
    reuse = {}
    for row in shared['assets']:
        reuse.setdefault(signature(row), []).append(row)
    groups = {}
    for row in plan['bindings']: groups.setdefault(signature(row), []).append(row)

    def resolve(pair):
        key, bindings = pair
        known = reuse.get(key, [])
        if known and len({r['sha256'] for r in known}) == 1:
            image = known[0]
            return [{**b, **{k:image[k] for k in ('url','sha256','inputSha256','width','height')}, 'origin':'shared-reward-artwork'} for b in bindings], []
        try:
            if key[0] == 'resource':
                path = local.get(str(Path(key[1]).with_suffix('')).replace('\\','/').lower())
                if path is None: return [], [{**b,'reason':'resource-not-in-local-files'} for b in bindings]
                payload = path.read_bytes()
            else:
                payload = download(key[1], args.download_cache)
            tint = bindings[0].get('renderTint')
            rendered = tint_image(payload,tint['rgba'],tint.get('blendMode','multiply')) if tint else payload
            result = export_image(rendered, args.assets/bindings[0]['role'])
            result['inputSha256'] = hashlib.sha256(payload).hexdigest()
            url = '/game-quests/reward-artwork/' + result.pop('file')
            return [{**b,**result,'url':url,'origin':'native-resource' if key[0]=='resource' else 'native-cdn'} for b in bindings], []
        except Exception as error:
            reason = f'HTTP-{error.code}' if hasattr(error,'code') else 'unreadable-native-artwork'
            return [], [{**b,'reason':reason} for b in bindings]

    assets, missing = [], list(plan['missing'])
    args.download_cache.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=6) as pool:
        for resolved, failed in pool.map(resolve, sorted(groups.items())):
            assets.extend(resolved); missing.extend(failed)
    order = lambda r:(r['type'],r['data'],r['role'])
    manifest = {'version':1,'source':{'sharedArtworkSha256':sha(shared_path),'paletteSha256':sha(palette_path),
        'schemaSha256':sha(args.schema),'registries':shared['source']['registries'],
        'resourceDispatch':{'fileName':resource_dispatch.name,'sha256':sha(resource_dispatch),'method':'GetTexture','additionalExactBranch':{'data':'pve-energy','reference':'resources/resource_energy_pve'}},
        'questRewardsSha256':sha(REPO/'src/data/game-quests/rewards.json'),
        'act10RewardsSha256':sha(REPO/'src/data/game-quests/act10.json'),
        'materialShader':material_shader,
        'towerPresentationSha256':sha(REPO/'src/data/game-quests/tower-presentation/catalog.json')},
        'assets':sorted(assets,key=order),'missing':sorted(missing,key=order),
        'coverage':{'usedIdentities':len(used),'additionalBindings':len(assets),'unresolved':len(missing)}}
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    print(json.dumps(manifest['coverage']))


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source-root',type=Path,default=Path('C:/Code/CereBro/temp/quest-data-investigation/game-only'))
    p.add_argument('--store-root',type=Path,default=Path('C:/Code/CereBro/temp/crystal-openings'))
    p.add_argument('--schema',type=Path,default=Path('C:/Code/CereBro/temp/crystals/schema.json'))
    p.add_argument('--resources',type=Path,default=Path('C:/Games/Marvel Contest of Champions/default/game/Champions_Data/Resources/Data'))
    p.add_argument('--download-cache',type=Path,default=REPO/'temp/quest-explorer-review/reward-art-fix-20261110/downloads')
    p.add_argument('--assets',type=Path,default=REPO/'web/public/game-quests/reward-artwork')
    p.add_argument('--output',type=Path,default=REPO/'src/data/game-quests/reward-artwork/manifest.json')
    build(p.parse_args())
