"""Offline Act 10 display projection from captured public definitions and BCG.

The map snapshots remain immutable. No process, UI, network or database access.
"""
import argparse
import hashlib
import json
import math
import re
import struct
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
FIXTURES = REPO / 'src/tests/game-quests/fixtures'
CAPTURE_SHA = 'c2c7e45ce3cfe4014b358313dda07f2596b1013d176f3facf2f29626d503c7cf'
FORMAT_SHA = '737fa2aad3d0cd096fd76dab3f32083ba45ff270f7292807e26c82c21642787f'
BCG_SHA = 'ea95b7299aba4fd4ef4accbc6c251ba73cfd186c41ac58369134907d327cbf6a'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False,
                                    separators=(',', ':'), allow_nan=False).encode()).hexdigest()


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def f32(value):
    return struct.unpack('<f', struct.pack('<f', value))[0]


def clean(text):
    return re.sub(r'\[k=[^\]]*\]|\[/k\]|\[(?:[a-f\d]{6,8}|-)\]', '', text, flags=re.I).replace('\\r\\n', '\n').replace('\\n', '\n').replace('\\r', '\n').strip()


def localized_number(value):
    require(math.isfinite(value), 'Nonfinite native display value')
    # GameLocalizationUtils: integer formatting below the native fractional
    # threshold; otherwise en-US N (two decimal places).
    fraction = math.fmod(abs(value), 1)
    return format(round(value), ',.0f') if fraction < f32(.001) else format(value, ',.2f')


def render_definition(raw, components, appearances, formulas, amount):
    require(type(amount) is int and amount == 1, 'Unobserved application quantity')
    require(raw['localizedName'] and raw['localizedDesc'], 'Missing native text')
    component = appearance = None
    if raw['buffType'] == 'bcg':
        # QuestBuffData formats the absolute native value directly, without
        # localized thousands separators or multiplication by buffAmount.
        arguments = [format(abs(raw['value']), '.7g')]
    else:
        require(raw['buffType'] == 'statMods' and raw['valueStr'], 'Unsupported native modifier type')
        component = components.get(raw['valueStr'][0])
        require(component and component['ID'] == raw['valueStr'][0], 'Missing exact first component')
        appearance = appearances.get(component['AppearanceID'])
        require(appearance and appearance['ID'] == component['AppearanceID'], 'Missing exact appearance')
        value = component['Modifier']
        formula_id = component.get('DisplayFormulaId')
        if formula_id:
            formula = formulas.get(formula_id)
            require(formula and formula['id'] == formula_id and formula['formulaType'] == 'mod_x_vara'
                    and not formula['reqAttrData'], 'Unsupported display formula')
            value = f32(value * formula['vara'])
        chance = f32(f32(round(f32(f32(f32(component['Chance'] * 100) * 100) * amount))) * f32(.01))
        duration = f32(f32(round(f32(f32(component['Duration'] * amount) * 100))) * f32(.01))
        arguments = [localized_number(chance), localized_number(f32(abs(value) * amount)),
                     localized_number(duration), localized_number(component['Stackable'])]
    def replace(match):
        index = int(match[1])
        require(index < len(arguments), 'Unbound native template argument')
        return arguments[index]
    description = re.sub(r'\{(\d+)\}', replace, raw['localizedDesc'])
    require(not re.search(r'\{[^}]*\}', description), 'Unsupported native template format')
    return clean(raw['localizedName']), clean(description), component, appearance


def build(capture_path=FIXTURES/'act10-modifiers-capture.json', format_path=FIXTURES/'act10-modifier-format.json'):
    require(sha(capture_path) == CAPTURE_SHA and sha(format_path) == FORMAT_SHA, 'Public source input drift')
    capture, proof = read(capture_path), read(format_path)
    require(capture['contract'] == 'cerebro.act10-public-modifier-definitions/v2'
            and capture['handleClosed'] and not capture['missingIds'], 'Incomplete native capture')
    require(proof['captureSha256'] == CAPTURE_SHA and proof['bcgSource']['sha256'] == BCG_SHA, 'Source context drift')
    require(sha(REPO/'src/data/game-quests/act10.json') == proof['mapsSha256'], 'Assignment index drift')
    require(len(capture['requestedIds']) == len(set(capture['requestedIds'])) == 149, 'Definition scope drift')
    definitions = {}
    for row in capture['definitions']:
        raw = row['raw']
        require(row['id'] == raw['id'] and digest(raw) == row['definitionHash'], 'Full native definition drift')
        require(set(raw) == set(capture['fields']) and row['id'] not in definitions, 'Definition field/identity drift')
        name, description, component, appearance = render_definition(raw, proof['components'], proof['appearances'], proof['formulas'], 1)
        icon = proof['icons'].get(appearance['IconTexture']) if appearance else None
        if icon:
            require(icon['src'].startswith('/node-modifiers/') and '..' not in icon['src'], 'Unsafe native icon path')
            require(sha(REPO/'web/public'/icon['src'].lstrip('/')) == icon['sha256'], 'Native icon asset drift')
        definitions[row['id']] = dict(name=name, description=description, rawDescription=raw['localizedDesc'],
            amount=1, definitionHash=row['definitionHash'], firstComponentHash=digest(component) if component else None,
            appearanceHash=digest(appearance) if appearance else None, iconKey=icon['key'] if icon else None)
    require(set(definitions) == set(capture['requestedIds']), 'Partial definition scope')
    # Independent previously observed native text is a differential regression,
    # not a source of numeric substitutions for the new observation.
    for sample in proof['nativeComparisonCases']:
        require(definitions[sample['id']]['definitionHash'] == sample['definitionHash'], 'Native comparison version drift')
        require(definitions[sample['id']]['description'] == clean(sample['description']), 'Native formatter disagreement')
        require(sha(REPO/sample['detailFile']) == sample['detailSha256'], 'Native comparison source drift')
    maps = {}; count = icons = 0
    for quest_id, source in proof['mapSources'].items():
        path = REPO/'src/data/game-quests/act10-maps'/(quest_id+'.json')
        require(sha(path) == source['publicMapSha256'], 'Saved map drift')
        saved = read(path)
        require(saved['mapId'] == source['mapId'] and saved['sourceHash'] == source['sourceHash'], 'Map source identity drift')
        applications = {}
        for tile in saved['tiles']:
            for application in tile['applications']:
                require(application['effectId'] in definitions and application['amount'] == 1, 'Unobserved modifier/quantity')
                require(application['parameters']['definitionCoverage'] == 'unresolved-native-definition-version', 'Original definition state drift')
                applications[application['id']] = {key:application[key] for key in ['effectId','amount','target','sourceCoordinate','sourceType','remainActive','linkedTargets']}
                applications[application['id']]['tileCoordinate'] = tile['coordinate']
                count += 1; icons += definitions[application['effectId']]['iconKey'] is not None
        maps[quest_id] = dict(mapId=source['mapId'], sourceHash=source['sourceHash'], applications=applications)
    require(len(maps) == 16 and count == 271, 'Application scope drift')
    return dict(version=1, capturedAt=capture['capturedAt'], captureSha256=CAPTURE_SHA, formatProofSha256=FORMAT_SHA,
        componentBcgSha256=BCG_SHA, definitionCount=len(definitions), applicationCount=count, verifiedIcons=icons,
        definitions=definitions, maps=maps,
        policy='New native definition observation joined through proven GetBuffDetails semantics. Exact saved-map/application context and quantity gates. Original snapshots stay unchanged; no claim that these definitions were captured with the older maps.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=REPO/'src/data/game-quests/act10-modifiers.json')
    args = parser.parse_args(); result = build()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':'), allow_nan=False)+'\n', encoding='utf-8', newline='\n')
    print(json.dumps({key:result[key] for key in ['definitionCount','applicationCount','verifiedIcons','capturedAt']}))
