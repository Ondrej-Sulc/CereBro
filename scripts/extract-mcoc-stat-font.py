"""Verify native stat UI/BCG bindings and extract the referenced font (UnityPy).

Inputs stay local. Only the requested vector outlines and compact evidence are
published by src/scripts/extract-mcoc-stat-icons.ts; no game/database writes.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

import UnityPy


STATS = {
    'criticalRating': 'crit_rating',
    'criticalDamageRating': 'crit_damage',
    'armorPenetration': 'armor_pen',
    'blockPenetration': 'block_pen',
    'criticalResistance': 'crit_hit_resist',
    'armorRating': 'armor',
    'blockProficiency': 'block_proficiency',
    'physicalResistance': 'resist_physical',
    'energyResistance': 'resist_magic',
    'health': 'health',
    'attack': 'attack',
}


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def varint(data, position):
    result = 0
    for shift in range(0, 70, 7):
        if position >= len(data):
            raise ValueError('Truncated protobuf varint')
        byte = data[position]
        position += 1
        result |= (byte & 127) << shift
        if byte < 128:
            return result, position
    raise ValueError('Oversized protobuf varint')


def fields(data):
    """Yield exact wire values; never interpret private-use UTF-8 as a message."""
    position = 0
    while position < len(data):
        tag, position = varint(data, position)
        number, wire = tag >> 3, tag & 7
        if not number:
            raise ValueError('Invalid protobuf field')
        if wire == 0:
            value, position = varint(data, position)
        elif wire in (1, 5):
            end = position + (8 if wire == 1 else 4)
            value, position = data[position:end], end
        elif wire == 2:
            length, position = varint(data, position)
            end = position + length
            value, position = data[position:end], end
        else:
            raise ValueError(f'Unsupported protobuf wire type {wire}')
        if position > len(data):
            raise ValueError('Truncated protobuf value')
        yield number, wire, value


def extract(bundle, bcg, isil, output):
    code_files = {name: (isil / f'{name}.txt').read_text(encoding='utf8') for name in
                  ['HeroAttributesPanel', 'HeroAttributeStatItem', 'StatFocusUtils', 'StatFocusTuning']}
    panel_code = code_files['HeroAttributesPanel']
    for key, native_id in STATS.items():
        if key not in ('health', 'attack'):
            if not re.search(rf'Move rcx, "{native_id}"\s+\S+ Call StatFocusUtils.GetIconForStat', panel_code):
                raise ValueError(f'No detail-panel icon binding for {native_id}')
            if not re.search(rf'Move rdx, "{native_id}"\s+\S+ LoadAddress rcx, [^\n]+\s+\S+ Call StatFocusUtils.GetColorForStat', panel_code):
                raise ValueError(f'No detail-panel color binding for {native_id}')
    for method, offset in [('IconTexture', 56), ('AttributeColor', 64)]:
        if not re.search(rf'get_{method}\(\).*?ISIL:\s+\S+ Move rax, \[rcx\+{offset}\]', code_files['StatFocusTuning'], re.S):
            raise ValueError(f'Unexpected StatFocusTuning.{method} layout')
    icon_code = code_files['StatFocusUtils'].split('Method: System.String GetIconForStat(', 1)[1].split('Method:', 1)[0]
    color_code = code_files['StatFocusUtils'].split('Method: UnityEngine.Color GetColorForStat(', 1)[1].split('Method:', 1)[0]
    if ('Call StatFocusUtils.TryGetStatFocusTuning' not in icon_code or 'Move rax, [rax+56]' not in icon_code
            or 'Call StatFocusUtils.TryGetStatFocusTuning' not in color_code or 'Move r8, [rax+64]' not in color_code
            or 'Call BCGManager.ParseColorSafe' not in color_code):
        raise ValueError('StatFocusUtils no longer reads the verified icon/color fields')

    # StatFocusUtils reads offsets 56/64 from TryGetStatFocusTuning. The native
    # protobuf records at top-level24 carry IconTexture5 and AttributeColor6.
    bcg_bytes = bcg.read_bytes()
    records = []
    for number, wire, raw in fields(bcg_bytes):
        if number != 24 or wire != 2:
            continue
        strings = {}
        for child, child_wire, value in fields(raw):
            if child_wire == 2:
                strings.setdefault(child, []).append(value.decode('utf8'))
        native_id = strings.get(1, [''])[0]
        if native_id not in STATS.values() or not strings.get(5, [''])[0]:
            continue
        records.append({'nativeId': native_id, 'texture': strings[5][0],
                        'color': '#' + strings[6][0], 'contexts': strings.get(3, []),
                        'nameStringId': strings.get(8, [''])[0], 'recordSha256': sha256(raw)})
    bindings = {}
    for key, native_id in STATS.items():
        matches = [record for record in records if record['nativeId'] == native_id]
        if len(matches) != 1:
            raise ValueError(f'Expected one nonempty native icon for {native_id}, got {len(matches)}')
        record = matches[0]
        if len(record['texture']) != 1 or not re.fullmatch(r'#[0-9a-fA-F]{6}', record['color']):
            raise ValueError(f'Invalid native texture/color for {native_id}')
        bindings[key] = record

    env = UnityPy.load(str(bundle))
    objects = {obj.path_id: obj for obj in env.objects}

    def follow(pointer):
        if pointer['m_FileID'] != 0 or pointer['m_PathID'] not in objects:
            raise ValueError(f'Unresolved native reference: {pointer}')
        obj = objects[pointer['m_PathID']]
        return obj, obj.read_typetree()

    panels = [obj for obj in env.objects if obj.type.name == 'GameObject'
              and obj.read().m_Name == 'HeroAttributesPanel']
    if len(panels) != 1:
        raise ValueError('Expected one HeroAttributesPanel prefab')
    components = [follow(c['component']) for c in panels[0].read_typetree()['m_Component']]
    panel_obj, panel = next(c for c in components if '_attributeStatItemPrefab' in c[1])
    prefab_obj, prefab = follow(panel['_attributeStatItemPrefab'])
    components = [follow(c['component']) for c in prefab['m_Component']]
    item_obj, item = next(c for c in components if '_statIcon' in c[1])
    label_obj, label = follow(item['_statIcon'])
    selector_obj, selector = follow(label['mCustomFont'])
    font_path = selector['_defaultFontPath']
    fonts = [obj for obj in env.objects if obj.type.name == 'Font'
             and obj.read().m_Name == font_path.split('/')[-1]]
    if len(fonts) != 1:
        raise ValueError(f'Expected one font matching {font_path}')
    font_obj = fonts[0]
    font = font_obj.read()
    font_bytes = bytes(font.m_FontData)
    evidence = {
        'schemaVersion': 1,
        'source': {'bcg': bcg.name, 'bcgSha256': sha256(bcg_bytes), 'tableField': 24,
                   'textureField': 5, 'colorField': 6,
                   'bundle': bundle.name, 'bundleSha256': sha256(bundle.read_bytes()),
                   'font': font.m_Name, 'fontSha256': sha256(font_bytes)},
        'code': {name: {'file': f'Marvel.Runtime/{name}.txt',
                        'sha256': sha256((isil / f'{name}.txt').read_bytes())}
                 for name in code_files},
        'binding': [
            {'object': 'HeroAttributesPanel', 'pathId': str(panel_obj.path_id), 'field': '_attributeStatItemPrefab'},
            {'object': 'HeroAttributeStatItem', 'pathId': str(prefab_obj.path_id), 'field': 'm_Component'},
            {'object': 'HeroAttributeStatItem', 'pathId': str(item_obj.path_id), 'field': '_statIcon'},
            {'object': 'UILabel', 'pathId': str(label_obj.path_id), 'field': 'mCustomFont'},
            {'object': 'FontLocalizer', 'pathId': str(selector_obj.path_id), 'fontPath': font_path},
            {'object': font.m_Name, 'pathId': str(font_obj.path_id)},
        ],
        'stats': bindings,
    }
    output.mkdir(parents=True, exist_ok=True)
    (output / 'Marvel-Icons-Font.ttf').write_bytes(font_bytes)
    (output / 'stat-font-evidence.json').write_text(json.dumps(evidence, indent=2) + '\n', encoding='utf8', newline='\n')
    print(json.dumps({'verified': len(bindings), 'fontSha256': evidence['source']['fontSha256']}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bundle', type=Path, required=True)
    parser.add_argument('--bcg', type=Path, required=True)
    parser.add_argument('--isil', type=Path, required=True, help='Cpp2IL IsilDump/Marvel.Runtime directory')
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    extract(args.bundle, args.bcg, args.isil, args.out)
