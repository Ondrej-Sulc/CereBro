"""Read only public selector definitions referenced by the crystal opening catalog.

Uses the already running game's Available registry. Never reads Active user sets,
inventory, qualification results, credentials, or invokes game methods/API calls.
Offsets are restricted to the reviewed binary and named field-layout contract.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from urllib.parse import unquote

GAME_SHA256 = '01f46bb2e36c2160a8df939bbb080bcf2ee89ca15427692a10334efc90fd4abb'
METADATA_SHA256 = 'c7296f9c50334d3f12ece5ae2e7c9566d6965cc355c9eecad8af8acfe561a24b'
CDN = 'https://kabam-marvel.shared.mcoc-cdn.net/'
CONTRACT = {
    'EB.Sparx.Hub': {'<SelectableRewardsManager>k__BackingField': 712},
    'EB.Sparx.SelectableRewardsManager': {'_state': 128},
    'EB.Sparx.SelectableRewardsState': {'<Available>k__BackingField': 16},
    'EB.Sparx.SelectableRewardSet': {'<SRId>k__BackingField': 16, '<Name>k__BackingField': 24,
        '<ActivateRedeemerTooltip>k__BackingField': 48, '<SRAIconPath>k__BackingField': 96},
}


def validate_layout(layout):
    if {row['sha256'] for row in layout['sources']} != {METADATA_SHA256}:
        raise ValueError('Unreviewed selector metadata')
    for name, fields in CONTRACT.items():
        actual = {field['name']: field['offset'] for field in layout['types'][name]['fields'] if not field['static']}
        if any(actual.get(name) != offset for name, offset in fields.items()):
            raise ValueError('Selector field layout changed')


def icon_reference(path):
    if not path:
        return None
    source, reference = ('cdn', path[len(CDN):]) if path.startswith(CDN) else ('resource', path)
    decoded = unquote(reference)
    if any(c in decoded for c in ':\\?#') or '..' in decoded.split('/') or decoded.startswith('/'):
        raise ValueError('Unreviewed selector artwork path')
    return {'source': source, 'reference': reference}


def capture(catalog_path, layout):
    validate_layout(layout)
    from mcoc_read_memory import Memory, find_game
    catalog_bytes = catalog_path.read_bytes()
    catalog = json.loads(catalog_bytes)
    targets = {row['data'] for category in catalog['categories'] + catalog.get('bonusRewards', [])
               for row in category['rewards'] if row['type'] == 'sra'}
    pid, module = find_game()
    if hashlib.sha256(Path(module['path']).read_bytes()).hexdigest() != GAME_SHA256:
        raise ValueError('Unreviewed game binary; refusing fixed-offset reads')
    memory = Memory(pid)
    try:
        # Named Hub.get_Instance disassembly: typeinfo RVA -> static fields -> Instance.
        klass = memory.ptr(module['base'] + 0x6182ec8)
        hub = memory.ptr(memory.ptr(klass + 184) + 8)
        if memory.klass_name(hub) != 'SparxHub':
            raise ValueError('Unexpected Hub instance')
        manager = memory.ptr(hub + 712)
        if memory.klass_name(manager) != 'SelectableRewardsManager':
            raise ValueError('Unexpected selector manager')
        state = memory.ptr(manager + 128)
        if memory.klass_name(state) != 'SelectableRewardsState':
            raise ValueError('Unexpected selector state')
        selectors = []
        # Only Available definitions (+16); Active user sets (+24) are never read.
        for key, pointer in memory.dict_ptrs(memory.ptr(state + 16)):
            selector_id = memory.string(key)
            if selector_id not in targets:
                continue
            if memory.klass_name(pointer) != 'SelectableRewardSet' or memory.string(memory.ptr(pointer + 16)) != selector_id:
                raise ValueError('Selector identity mismatch')
            name = memory.string(memory.ptr(pointer + 24))
            if not name:
                continue
            selectors.append({'id': selector_id, 'name': name,
                'description': memory.string(memory.ptr(pointer + 48)) or '',
                'icon': icon_reference(memory.string(memory.ptr(pointer + 96)))})
    finally:
        memory.close()
    return {'version': 1, 'source': {'observedAt': datetime.now(timezone.utc).isoformat(),
        'captureMethod': 'read-only-game-definition-registry', 'gameAssemblySha256': GAME_SHA256,
        'metadataSha256': METADATA_SHA256, 'openingCatalogSha256': hashlib.sha256(catalog_bytes).hexdigest()},
        'selectors': sorted(selectors, key=lambda row: row['id']),
        'missingIds': sorted(targets - {row['id'] for row in selectors})}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--catalog', type=Path, default=Path('src/data/game-crystal-openings/catalog.json'))
    parser.add_argument('--layout', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    result = capture(args.catalog, json.loads(args.layout.read_text(encoding='utf-8')))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
    print(json.dumps({'resolved': len(result['selectors']), 'missing': len(result['missingIds'])}))
