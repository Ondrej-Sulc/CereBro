"""Extract the native synergy font and its UI binding (requires UnityPy).

No game API calls or database writes. Follow serialized references rather than
assuming that a similarly named font is the one used by synergy tiles.
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path
import UnityPy


def extract(bundle, output, snapshot, game_scripts):
    # Reuse the game's existing typed BCG exporter; do not invent another decoder.
    sys.path.insert(0, str(game_scripts.resolve()))
    from export_mcoc_synergies import export
    catalog = json.loads(snapshot.read_text(encoding='utf8'))
    bcg = Path(catalog['metadata']['source']).read_bytes()
    source_hash = hashlib.sha256(bcg).hexdigest()
    if source_hash != catalog['metadata']['sourceSha256']:
        raise ValueError('BCG source hash differs from snapshot')
    original = {r['id']: r['texture'] for r in export(bcg, {})}
    imported = {r['id']: r['texture'] for r in catalog['synergies']}
    if original != imported or len(imported) != len(catalog['synergies']):
        raise ValueError('Snapshot icon bindings differ from original BCG field 6 / field 5')
    env = UnityPy.load(str(bundle))
    objects = {o.path_id: o for o in env.objects}

    def follow(pointer):
        if pointer['m_FileID'] != 0 or pointer['m_PathID'] not in objects:
            raise ValueError(f'Unresolved native reference: {pointer}')
        obj = objects[pointer['m_PathID']]
        return obj, obj.read_typetree()

    panels = []
    for obj in env.objects:
        if obj.type.name == 'GameObject' and obj.read().m_Name == 'SynergyBonusInfoPanelItem':
            panels.append(obj)
    if len(panels) != 1:
        raise ValueError('Expected one SynergyBonusInfoPanelItem prefab')
    components = [follow(c['component']) for c in panels[0].read_typetree()['m_Component']]
    panel_obj, panel = next(c for c in components if '_bonusTile' in c[1])
    tile_obj, tile = follow(panel['_bonusTile'])
    label_obj, label = follow(tile['_icon'])
    selector_obj, selector = follow(label['mCustomFont'])
    font_path = selector['_defaultFontPath']
    fonts = [o for o in env.objects if o.type.name == 'Font' and o.read().m_Name == font_path.split('/')[-1]]
    if len(fonts) != 1:
        raise ValueError(f'Expected one font matching {font_path}')
    font_obj = fonts[0]
    font = font_obj.read()
    data = bytes(font.m_FontData)
    output.mkdir(parents=True, exist_ok=True)
    (output / 'Marvel-Icons-Font.ttf').write_bytes(data)
    evidence = {
        'sourceSha256': source_hash,
        'snapshotSha256': hashlib.sha256(snapshot.read_bytes()).hexdigest(),
        'verifiedRecords': len(original),
        'bundle': bundle.name, 'bundleSha256': hashlib.sha256(bundle.read_bytes()).hexdigest(),
        'font': font.m_Name, 'fontSha256': hashlib.sha256(data).hexdigest(),
        'binding': [
            {'object': 'SynergyBonusInfoPanelItem', 'pathId': str(panel_obj.path_id), 'field': '_bonusTile'},
            {'object': 'SynergyBonusTile', 'pathId': str(tile_obj.path_id), 'field': '_icon'},
            {'object': 'UILabel', 'pathId': str(label_obj.path_id), 'field': 'mCustomFont'},
            {'object': 'FontLocalizer', 'pathId': str(selector_obj.path_id), 'fontPath': font_path},
            {'object': font.m_Name, 'pathId': str(font_obj.path_id)},
        ],
    }
    (output / 'font-evidence.json').write_text(json.dumps(evidence, indent=2) + '\n', encoding='utf8')
    print(json.dumps(evidence, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bundle', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--snapshot', type=Path, required=True)
    parser.add_argument('--game-scripts', type=Path, required=True)
    args = parser.parse_args()
    extract(args.bundle, args.out, args.snapshot, args.game_scripts)
