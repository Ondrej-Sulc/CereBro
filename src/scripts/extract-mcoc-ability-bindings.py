"""Extract the game's four display arguments, without text/champion heuristics.

Reads named protobuf schema plus immutable raw component fields. The legacy
champions.json placeholder_sources are comparison inputs, never trusted bindings.
"""
import argparse
import hashlib
import json
import pathlib
import re
import sys
from collections import Counter


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify_schema(schema):
    expected = {
        'BCGDataBuffer': {1: 'stat_modifiers', 18: 'curves', 20: 'stat_modifier_formulas', 21: 'parent_child_mods'},
        'BCGStatModifier': {7: 'DisplayFormulaId', 12: 'AppearanceID', 13: 'Chance', 14: 'Modifier',
                            15: 'Duration', 18: 'GrowthTarget', 19: 'GrowthCurve', 22: 'GrowthConst', 24: 'Stackable'},
        'StatModFormulaData': {1: 'id', 2: 'vara', 3: 'varb', 4: 'varc', 5: 'formulaType'},
        'BCGCurve': {1: 'ID', 2: 'a', 3: 'b', 4: 'c', 5: 'exp'},
    }
    for kind, fields in expected.items():
        actual = {f['tag']: f['name'] for f in schema['types'][kind]['fields']}
        if any(actual.get(tag) != name for tag, name in fields.items()):
            raise ValueError('Named protobuf schema differs: ' + kind)


def raw_field(row, tag, kind):
    values = row.get('raw_fields', {}).get(str(tag), {}).get(kind, [])
    if len(values) != 1:
        raise ValueError(f'Missing/ambiguous raw field {tag}')
    value = values[0]
    if kind == 'ints':
        # int32 protobuf negatives are sign-extended varints in the raw dump.
        value = value & 0xffffffff
        if value >= 0x80000000: value -= 0x100000000
    return value


def optional_string(row, tag):
    return raw_field(row, tag, 'strings') if str(tag) in row.get('raw_fields', {}) else ''


def build_sources(row, indices, formulas, curves):
    """Only explicit 0..3 formatter slots; no scoring, English or ID overrides."""
    values = [raw_field(row, tag, kind) for tag, kind in [(13, 'floats'), (14, 'floats'), (15, 'floats'), (24, 'ints')]]
    formula_id = optional_string(row, 7)
    formula = formulas.get(formula_id) if formula_id else {'id': '', 'type': 'identity', 'a': 1, 'b': 0, 'c': 0}
    if 1 in indices and (not formula or formula['type'] not in
        ('identity', 'mod_x_vara', 'mod_x_attk', 'mod_x_hp', 'standard', 'standard_critdam')):
        raise ValueError('Unsupported explicit display formula: ' + formula_id)
    if formula_id.startswith(('opp.', 'opponent.')):
        raise ValueError('Opponent-dependent display formula')
    growth_target = optional_string(row, 18)
    growth_id = optional_string(row, 19)
    sources = {}
    for index in indices:
        if index not in (0, 1, 2, 3):
            raise ValueError('Unknown display slot: ' + str(index))
        binding = {'version': 1, 'slot': index, 'value': values[index]}
        if index == 1:
            binding['formula'] = formula
        if growth_target == ['chance', 'modifier', 'duration', None][index]:
            coefficient = raw_field(row, 22, 'floats') if '22' in row['raw_fields'] else 0
            growth = {'coefficient': coefficient}
            if growth_id and growth_id != 'none':
                if growth_id not in curves:
                    raise ValueError('Missing growth curve: ' + growth_id)
                growth['curve'] = curves[growth_id]
            binding['growth'] = growth
        sources[str(index)] = {
            'kind': 'abilityParam', 'componentId': row['ability_id'], 'buffType': row['buff_type'],
            # Old aliases remain for existing curve chart tooling. gameBinding
            # uses named fields and bypasses every legacy resolution heuristic.
            'paramName': ['chance', 'modifier', 'duration', 'maxStacks'][index],
            'field': ['base_val', 'chance', 'duration', 'f24'][index], 'rawValue': values[index],
            'curveId': growth_id if 'growth' in binding else 'none',
            'baseVal': values[0], 'chance': values[1], 'duration': values[2], 'f24': values[3],
            'gameBinding': binding, 'display': {'multiplier': 100 if index == 0 else 1, 'precision': 0 if index == 3 else 2},
        }
    return sources


def extract(descriptions, debug, formulas, curves, live_rows=None):
    entries, held = [], []
    by_hud = {}
    for rows in debug['abilities'].values():
        for row in rows:
            by_hud.setdefault(row['hud_id'], {})[row['ability_id']] = row
    for game_id, champion in descriptions.items():
        active_ids = set()
        def include(identifier):
            if identifier in active_ids: return
            active_ids.add(identifier)
            for child in debug.get('panels', {}).get(identifier, []):
                include(child['component_id'])
        for tier in champion.get('tiers', {}).values():
            for rank in tier.get('ranks', []):
                for identifier in rank.get('base_ability_ids', []) + rank.get('sig_ability_ids', []):
                    include(identifier)
        signatures = champion.get('sig_abilities') or ([champion['sig_ability']] if champion.get('sig_ability') else [])
        for collection, items in [('base', champion.get('base_abilities', [])), ('signature', signatures)]:
            for index, item in enumerate(items):
                raw = item.get('description', '').strip()
                indices = sorted(set(int(i) for i in re.findall(r'\{(\d+)\}', raw)))
                if not indices:
                    continue
                source = item.get('source') or {}
                component, hud = source.get('component_id', ''), source.get('hud_id', '')
                group = item.get('group') or 'base'
                if not re.fullmatch(r'[a-z][a-z0-9_-]*', group, re.I): group = 'base'
                source_id = f'{group}:{index + 1}' if collection == 'base' else 'signature' if index == 0 else f'signature:{index + 1}'
                identity = {'gameId': game_id, 'sourceId': source_id, 'componentId': component, 'hudId': hud, 'raw': raw}
                # A HUD may represent several different mechanic components. Do
                # not silently take the first one or infer from paragraph prose.
                matches = [a for a in debug['abilities'].get(component, [])
                           if a['ability_id'] == component and a['hud_id'] == hud]
                if not matches and component == hud:
                    matches = list(by_hud.get(hud, {}).values())
                    active_matches = [a for a in matches if a['ability_id'] in active_ids]
                    if active_matches: matches = active_matches
                if not matches:
                    held.append({**identity, 'reason': 'missing-or-ambiguous-exact-component', 'matches': len(matches)})
                    continue
                try:
                    alternatives = []
                    for row in matches:
                        if live_rows is not None:
                            live = live_rows.get(row['ability_id'], [])
                            relevant = ['7', '12', '13', '14', '15', '18', '19', '22', '24']
                            if len(live) != 1 or any(row['raw_fields'].get(k) != live[0]['raw_fields'].get(k) for k in relevant):
                                raise ValueError('raw-debug-versus-bcg-drift')
                            row = live[0]
                        alternatives.append(build_sources(row, indices, formulas, curves))
                    # Multiple components are safe only when every displayed
                    # argument agrees, including its exact formula and growth.
                    signatures = {json.dumps({i: s['gameBinding'] for i, s in a.items()}, sort_keys=True) for a in alternatives}
                    if len(signatures) != 1:
                        raise ValueError('different-display-arguments-on-shared-hud')
                    sources = alternatives[0]
                except ValueError as error:
                    held.append({**identity, 'reason': str(error)})
                    continue
                entries.append({**identity, 'bindingComponentIds': sorted(a['ability_id'] for a in matches), 'sources': sources})
    return entries, held


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--scripts-dir', type=pathlib.Path, default=pathlib.Path('C:/Games/Marvel Contest of Champions/default/game/Scripts'))
    parser.add_argument('--schema', type=pathlib.Path, required=True)
    parser.add_argument('--bcg', type=pathlib.Path)
    parser.add_argument('--out', type=pathlib.Path, required=True)
    parser.add_argument('--champions-out', type=pathlib.Path, help='Optional regenerated champions.json for the admin upload; original export is never overwritten.')
    args = parser.parse_args()
    schema = json.loads(args.schema.read_text(encoding='utf-8'))
    verify_schema(schema)
    sys.path.insert(0, str(args.scripts_dir))
    import parse_bcg as p
    bcg = args.bcg or pathlib.Path(p.BCG_BIN)
    formulas, curves, live_rows = {}, {}, {}
    for tag, msg in p.iter_top_level(bcg.read_bytes()):
        if tag not in (1, 18, 20): continue
        fields = p.decode_msg(msg, max_depth=1)
        name = p.get_str(fields, 1)
        if tag == 1:
            live_rows.setdefault(name, []).append(dict(ability_id=name, hud_id=p.get_str(fields, 12),
                buff_type=p.get_str(fields, 2), raw_fields=p._raw_field_values(fields)))
        elif tag == 20:
            formulas[name] = dict(id=name, type=p.get_str(fields, 5), a=p.get_float(fields, 2), b=p.get_float(fields, 3), c=p.get_float(fields, 4))
        else:
            curves[name] = dict(id=name, a=p.get_float(fields, 2), b=p.get_float(fields, 3), c=p.get_float(fields, 4), exponent=p.get_float(fields, 5))
    descriptions_path, debug_path = args.scripts_dir/'champions.json', args.scripts_dir/'ability_display_debug.json'
    descriptions = json.loads(descriptions_path.read_text(encoding='utf-8'))
    entries, held = extract(descriptions,
                            json.loads(debug_path.read_text(encoding='utf-8')), formulas, curves, live_rows)
    output = {'schemaVersion': 1, 'contract': 'GameUtils.GetFormattedLocalizedBuff/v1',
              'provenance': {name: sha(path) for name, path in [('schema', args.schema), ('bcg', bcg), ('descriptions', descriptions_path), ('debug', debug_path)]},
              'formulas': formulas, 'entries': entries, 'held': held}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(output, ensure_ascii=False), encoding='utf-8')
    if args.champions_out:
        if args.champions_out.resolve() == descriptions_path.resolve():
            raise ValueError('Regenerated output must not overwrite the original export.')
        by_key = {(e['gameId'], e['sourceId']): e for e in entries}
        for game_id, champion in descriptions.items():
            signatures = champion.get('sig_abilities') or ([champion['sig_ability']] if champion.get('sig_ability') else [])
            for collection, items in [('base', champion.get('base_abilities', [])), ('signature', signatures)]:
                for index, item in enumerate(items):
                    group = item.get('group') or 'base'
                    source_id = f'{group}:{index + 1}' if collection == 'base' else 'signature' if index == 0 else f'signature:{index + 1}'
                    entry = by_key.get((game_id, source_id))
                    if entry: item['source']['placeholder_sources'] = entry['sources']
        args.champions_out.parent.mkdir(parents=True, exist_ok=True)
        args.champions_out.write_text(json.dumps(descriptions, ensure_ascii=False), encoding='utf-8')
    print(json.dumps({'entries': len(entries), 'held': len(held), 'reasons': dict(Counter(e['reason'] for e in held)), 'out': str(args.out)}))


if __name__ == '__main__': main()
