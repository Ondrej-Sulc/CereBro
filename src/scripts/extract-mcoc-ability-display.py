"""Export exact display bindings from the local game extraction; no game files are changed."""
import argparse
import hashlib
import json
import pathlib
import re
import sys

parser = argparse.ArgumentParser()
parser.add_argument('--scripts-dir', default=r'C:\Games\Marvel Contest of Champions\default\game\Scripts')
parser.add_argument('--out', default='scratch/ability-display-metadata.json')
args = parser.parse_args()
root = pathlib.Path(args.scripts_dir)
sys.path.insert(0, str(root))
import parse_bcg

descriptions_path = root / 'champions.json'
debug_path = root / 'ability_display_debug.json'
descriptions = json.loads(descriptions_path.read_text(encoding='utf-8'))
debug = json.loads(debug_path.read_text(encoding='utf-8'))
localization = parse_bcg._load_loc_file(parse_bcg.LOC_STAT_EN)
panels = {panel: {row['component_id']: row for row in rows} for panel, rows in debug['panels'].items()}
entries = []
unmatched = []
for game_id, champion in descriptions.items():
    signatures = champion.get('sig_abilities') or ([champion['sig_ability']] if champion.get('sig_ability') else [])
    for collection, items in (('base', champion.get('base_abilities', [])), ('signature', signatures)):
        for index, item in enumerate(items):
            source = item.get('source') or {}
            panel_id, component_id, hud_id = (source.get(key, '') for key in ('panel_id', 'component_id', 'hud_id'))
            row = panels.get(panel_id, {}).get(component_id)
            # Older exports reference components/HUDs directly, without a panel.
            # Follow the same explicit identity path as parse_bcg.resolve_abilities.
            if not panel_id and component_id and hud_id:
                mapped_hud = debug.get('ability_to_hud', {}).get(component_id)
                direct_display = debug.get('displays', {}).get(hud_id)
                if direct_display and (component_id == hud_id or mapped_hud == hud_id):
                    row = {'hud_id': hud_id, 'display': direct_display,
                           'abilities': debug.get('abilities', {}).get(component_id, [])}
            if not row:
                unmatched.append({'gameId': game_id, 'componentId': component_id,
                                  'hudId': hud_id, 'reason': 'missing-display-reference'})
                continue
            display = row.get('display') if row.get('hud_id') == hud_id else row.get('component_display') if component_id == hud_id else None
            resolved = (display or {}).get('resolved') or {}
            raw = item.get('description', '').strip()
            if not raw:
                continue
            if resolved.get('attr_desc', '').strip() == raw:
                kind = 'ability'
            elif resolved.get('buff_desc', '').strip() == raw:
                kind = 'glossary'
            else:
                unmatched.append({'gameId': game_id, 'componentId': component_id, 'hudId': hud_id})
                continue
            triggers = set()
            for ability in row.get('abilities', []):
                for trigger in ability.get('raw_fields', {}).get('5', {}).get('strings', []):
                    key = 'ID_UI_STAT_ATTRIBUTE_TRIGGER_SUBTITLE_' + trigger
                    title = localization.get(key)
                    if title and '{' not in title:
                        triggers.add((key, title))
            metadata = {'kind': kind, 'panelId': panel_id, 'componentId': component_id, 'hudId': hud_id}
            if len(triggers) == 1:
                key, title = next(iter(triggers))
                metadata['section'] = {'id': key, 'title': title}
            group = item.get('group') or 'base'
            if not re.fullmatch(r'[a-z][a-z0-9_-]*', group, flags=re.I):
                group = 'base'
            source_id = f'{group}:{index + 1}' if collection == 'base' else 'signature' if index == 0 else f'signature:{index + 1}'
            entries.append({'gameId': game_id, 'sourceId': source_id, 'raw': raw, 'display': metadata})

output = {'schemaVersion': 1, 'provenance': {
    'descriptionsHash': hashlib.sha256(descriptions_path.read_bytes()).hexdigest(),
    'debugHash': hashlib.sha256(debug_path.read_bytes()).hexdigest(),
    'localizationHash': hashlib.sha256(pathlib.Path(parse_bcg.LOC_STAT_EN).read_bytes()).hexdigest(),
}, 'entries': entries, 'unmatched': unmatched}
output_path = pathlib.Path(args.out)
output_path.parent.mkdir(parents=True, exist_ok=True)
output_path.write_text(json.dumps(output, ensure_ascii=False), encoding='utf-8')
print(json.dumps({'entries': len(entries), 'unmatched': len(unmatched), 'output': str(output_path)}))
