"""Render exact neutral rank-up gem resources with the native class overlay shader, offline."""
import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import sys

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO/'scripts'))
from mcoc_protobuf import Decoder, fields
from extract_mcoc_crystal_artwork import resource_index, export_image
from extract_mcoc_reward_artwork import build_bindings, tint_image, inventory_shader_provenance, REVIEWED_METADATA

REFERENCES = {'inventory/RankUp_Gems', 'inventory/RAnkUp_Gems'}
NATIVE = 'b1a54b54fdb524a2b4e491de9e91c22545f0e07f3a795340553041969a2aed87'
def read(p): return json.loads(p.read_text(encoding='utf-8'))
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def key(row): return row['type'], row['data'], row['role']

def build(args):
    legacy = read(REPO/'src/data/game-reward-artwork/manifest.json')
    opening = read(REPO/'src/data/game-crystal-openings/catalog.json')
    schema = read(args.schema)
    assert {Path(r['path'].replace('\\', '/')).name:r['sha256'] for r in schema['sources']} == REVIEWED_METADATA
    assert hashlib.sha256(json.dumps(schema['types'], sort_keys=True, separators=(',', ':')).encode()).hexdigest() == opening['source']['schemaSha256']
    assert sha(args.native/'GameStoreUtils.txt') == NATIVE, 'Native inventory color binding changed'
    registry = {r['kind']:r for r in legacy['source']['registries']}
    paths = {'gameStore': args.store/registry['gameStore']['fileName'], 'bcg': args.source/'sources'/registry['bcg']['fileName']}
    for kind, p in paths.items(): assert sha(p) == registry[kind]['sha256'], 'Native reward registry changed'
    decoder = Decoder(schema)
    store = decoder.message(paths['gameStore'].read_bytes(), 'EB.Sparx.GameStoreDataBuffer')
    items = [i for group in store.get('items', {}).values() for i in group.get('gameStoreItems', [])]
    classes = [decoder.message(v, 'BCGHeroClass') for tag, wire, v, _ in fields(paths['bcg'].read_bytes()) if tag == 9 and wire == 2]
    assert not decoder.unknown
    old = {key(r):r for r in legacy['assets'] if r['type'] == 'inv' and r['reference'] in REFERENCES}
    assert old
    palette = read(REPO/'src/data/game-reward-artwork/palette.json')
    plan = build_bindings({'categories':[{'rewards':[{'type':t,'data':n} for t,n,_ in sorted(old)]}]}, {}, [], items,
                          palette['colors'], hero_classes=classes)
    assert not plan['missing'] and len(plan['bindings']) == len(old)
    shader = inventory_shader_provenance(args.resources.parent.parent/'resources.assets', palette['source'])
    assert shader == legacy['source']['inventoryShader']
    resources = resource_index(args.resources)

    def render(binding):
        original = old[key(binding)]
        assert (original['reference'], original['source']) == (binding['reference'], binding['source'])
        assert binding['source'] == 'resource' and binding['role'] == 'full'
        payload = resources[binding['reference'].lower()].read_bytes()
        assert hashlib.sha256(payload).hexdigest() == original['inputSha256'], 'Native rank gem pixels changed'
        tint = binding['renderTint']
        image = export_image(tint_image(payload, tint['rgba'], tint['blendMode']), args.assets/'full')
        return {**binding, **image, 'inputSha256':original['inputSha256'], 'origin':'game-resource'}

    colored = [row for row in plan['bindings'] if row['tintApplied']]
    with ThreadPoolExecutor(max_workers=6) as pool: assets = sorted(pool.map(render, colored), key=key)
    source = {k:v for k,v in legacy['source'].items() if k != 'bucket'}
    source['inventoryShader'] = shader
    result = {'version':1, 'source':source, 'assets':assets, 'missing':[],
              'coverage':{'bindings':len(assets),'resolved':len(assets),'missing':0,'resolvedByType':dict(Counter(r['type'] for r in assets))}}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result,ensure_ascii=False,separators=(',', ':'))+'\n',encoding='utf-8')
    print(json.dumps({'correctedBindings':len(assets),'neutralControls':len(old)-len(assets),'uniqueImages':len(set(r['sha256'] for r in assets))}))

if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source',type=Path,default=REPO/'temp/quest-data-investigation/game-only')
    p.add_argument('--store',type=Path,default=REPO/'temp/crystal-openings')
    p.add_argument('--schema',type=Path,default=REPO/'temp/crystals/schema.json')
    p.add_argument('--native',type=Path,default=Path('D:/CodexArtifacts/Cpp2IL-2026-11-03/IsilDump/Marvel.Runtime'))
    p.add_argument('--resources',type=Path,default=Path('C:/Games/Marvel Contest of Champions/default/game/Champions_Data/Resources/Data'))
    p.add_argument('--assets',type=Path,default=REPO/'web/public/game-rewards')
    p.add_argument('--output',type=Path,default=REPO/'src/data/game-reward-artwork/rank-gem-corrections.json')
    build(p.parse_args())
