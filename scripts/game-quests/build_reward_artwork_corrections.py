"""Re-export source-bound material artwork with the proven native shader, offline."""
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
from extract_mcoc_reward_artwork import build_bindings, tint_image, material_shader_provenance, REVIEWED_METADATA


def read(path): return json.loads(path.read_text(encoding='utf-8'))
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def key(row): return row['type'], row['data'], row['role']


def build(args):
    legacy = read(REPO/'src/data/game-reward-artwork/manifest.json')
    additional = read(REPO/'src/data/game-quests/reward-artwork/manifest.json')
    old = {key(r): r for m in [legacy, additional] for r in m['assets'] if r['type'] in ('ebp', 'ebpf')}
    palette = read(REPO/'src/data/game-reward-artwork/palette.json')
    schema = read(args.schema)
    assert {Path(r['path'].replace('\\', '/')).name: r['sha256'] for r in schema['sources']} == REVIEWED_METADATA, 'Native schema metadata changed'
    opening = read(REPO/'src/data/game-crystal-openings/catalog.json')
    schema_hash = hashlib.sha256(json.dumps(schema['types'], sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    assert schema_hash == opening['source']['schemaSha256'], 'Native schema field contract changed'
    expected = next(r for r in legacy['source']['registries'] if r['kind'] == 'bcg')
    bcg = args.source/'sources'/expected['fileName']
    assert sha(bcg) == expected['sha256'], 'Material definition version changed'
    decoder = Decoder(schema)
    evos = [decoder.message(v, 'BCGEvoBlueprintBase') for t, _, v, _ in fields(bcg.read_bytes()) if t == 5]
    assert not decoder.unknown
    plan = build_bindings({'categories': [{'rewards': [{'type': t, 'data': n} for t, n, _ in sorted(old)]}]}, {}, evos, [], palette['colors'])
    assert not plan['missing'], 'Previously bound material definitions are missing'
    local = resource_index(args.resources)
    shader = material_shader_provenance(args.resources.parent.parent/'resources.assets', palette['source'])

    def render(binding):
        original = old[key(binding)]
        assert (original['source'], original['reference']) == (binding['source'], binding['reference'])
        assert binding['source'] == 'resource', 'This material correction requires a separately reviewed CDN path'
        p = local.get(str(Path(binding['reference']).with_suffix('')).replace('\\', '/').lower())
        if p is None:
            raise ValueError('Native material texture is unavailable: ' + binding['reference'])
        payload = p.read_bytes()
        digest = hashlib.sha256(payload).hexdigest()
        assert digest == original['inputSha256'], 'Native material texture drift'
        tint = binding['renderTint']
        assert tint['rgba'] == original['renderTint']['rgba'], 'Native material color changed'
        assert tint['blendMode'] == 'overlay'
        result = export_image(tint_image(payload, tint['rgba'], tint['blendMode']), args.assets/binding['role'])
        return {**binding, **result, 'inputSha256': digest, 'origin': 'game-resource'}

    with ThreadPoolExecutor(max_workers=6) as pool:
        assets = sorted(pool.map(render, plan['bindings']), key=key)
    source = {k: v for k, v in legacy['source'].items() if k != 'bucket'}
    source['materialShader'] = shader
    result = {'version': 1, 'source': source, 'assets': assets, 'missing': [],
              'coverage': {'bindings': len(assets), 'resolved': len(assets), 'missing': 0,
                           'resolvedByType': dict(sorted(Counter(r['type'] for r in assets).items()))}}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':'))+'\n', encoding='utf-8')
    print(json.dumps(result['coverage']))


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source', type=Path, default=Path('C:/Code/CereBro/temp/quest-data-investigation/game-only'))
    p.add_argument('--schema', type=Path, default=Path('C:/Code/CereBro/temp/crystals/schema.json'))
    p.add_argument('--resources', type=Path, default=Path('C:/Games/Marvel Contest of Champions/default/game/Champions_Data/Resources/Data'))
    p.add_argument('--assets', type=Path, default=REPO/'web/public/game-rewards')
    p.add_argument('--output', type=Path, default=REPO/'src/data/game-reward-artwork/corrections.json')
    build(p.parse_args())
