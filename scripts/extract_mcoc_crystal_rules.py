"""Extract recorded crystal guarantees, box rules and conditional bonuses from a local cache.

This is a source-ID projection, not a drop-rate estimator. The static catalog has
no probability table. It never contacts the game or expands nested rewards.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter
from datetime import datetime
from pathlib import Path

from export_mcoc_proto_schema import export_schema
from mcoc_protobuf import Decoder

REWARD_TYPES = frozenset({'hero', 'hcos', 'res', 'ebpf', 'gf', 'ebp', 'bp', 'inv', 'relic2', 'gs', 'sra', 'evta', 'oact', 'nothing', 'utitle', 'profilebadge'})


def identity(value, label):
    if not isinstance(value, str) or not value:
        raise ValueError(f'Missing {label}')
    return value


def unique(rows, label):
    result = {}
    for row in rows:
        name = identity(row.get('Name'), f'{label} identity')
        if name in result:
            raise ValueError(f'Duplicate {label}: {name}')
        result[name] = row
    return result


def integer(value, label, minimum=0):
    if type(value) is not int or value < minimum:
        raise ValueError(f'Invalid {label}: {value}')
    return value


def text(row, member):
    value = row.get(member, {}).get('en', '')
    if not isinstance(value, str):
        raise ValueError(f'Invalid English {member}')
    return value


def reward(item, index=None):
    if item.get('Type') not in REWARD_TYPES:
        raise ValueError(f'Unreviewed reward type: {item.get("Type")}')
    if not isinstance(item.get('Data', ''), str):
        raise ValueError('Invalid reward Data')
    result = dict(type=item['Type'], data=item.get('Data', ''))
    if index is not None:
        result = dict(sourceIndex=index, **result)
    for member, target in [('Quantity', 'quantity'), ('MinQuantity', 'minQuantity'), ('MaxQuantity', 'maxQuantity')]:
        if member in item:
            result[target] = integer(item[member], member)
    if 'Balance' in item:
        if type(item['Balance']) is not int:
            raise ValueError('Invalid reward Balance')
        result['balance'] = item['Balance']
    for member, target in [('Action', 'action'), ('Header', 'header'), ('Footer', 'footer')]:
        if member in item:
            if not isinstance(item[member], str):
                raise ValueError(f'Invalid reward {member}')
            result[target] = item[member]
    context = item.get('ContextProto', {})
    if not isinstance(context, dict) or any(not isinstance(k, str) or not isinstance(v, str) for k, v in context.items()):
        raise ValueError('Invalid reward context')
    if context:
        result['context'] = dict(sorted(context.items()))
    if 'minQuantity' in result and 'maxQuantity' in result and result['minQuantity'] > result['maxQuantity']:
        result['quantityRangeStatus'] = 'reversed_in_source'
    return result


def build_rules(gacha):
    if set(gacha) - {'categories', 'groups', 'tabs', 'pityTemplates', 'pityGroups', 'bonusRewards'}:
        raise ValueError('Unreviewed static gacha top-level fields')
    categories = unique(gacha.get('categories', []), 'category')
    templates = unique(gacha.get('pityTemplates', []), 'pity template')
    groups = unique(gacha.get('pityGroups', []), 'pity group')
    bonuses = unique(gacha.get('bonusRewards', []), 'bonus reward')
    normalized_groups = [dict(id=name, payoutLimit=integer(group.get('PayoutLimit'), 'pity payout limit', 1),
                              descriptionTemplate=text(group, '_description'), shortDescriptionTemplate=text(group, '_shortDescription'),
                              pityTags=[identity(tag, 'pity tag') for tag in group.get('PityTags', [])])
                         for name, group in sorted(groups.items())]
    normalized_templates = []
    for name, template in sorted(templates.items()):
        group_ids = template.get('PityGroups', [])
        if any(group_id not in groups for group_id in group_ids):
            raise ValueError(f'Unknown pity group: {name}')
        normalized_templates.append(dict(id=name, groupIds=group_ids))
    normalized_bonuses = []
    for name, bonus in sorted(bonuses.items()):
        normalized_bonuses.append(dict(id=name, displayName=text(bonus, '_displayName'),
                                      autoAscend=bool(bonus.get('AutoAscend', False)),
                                      rewards=[reward(item) for item in bonus.get('Redeemers', [])]))
    category_rules, item_types, contexts = [], Counter(), Counter()
    for name, category in sorted(categories.items()):
        non_hero, bindings = [], []
        for index, item in enumerate(category.get('Items', [])):
            normalized = reward(item, index)
            item_types[normalized['type']] += 1
            contexts.update(normalized.get('context', {}).keys())
            if normalized['type'] not in ('hero', 'hcos'):
                non_hero.append(normalized)
            bonus_id = normalized.get('context', {}).get('bonusReward')
            if bonus_id:
                if bonus_id not in bonuses:
                    raise ValueError(f'Unknown bonus reward: {bonus_id}')
                bindings.append(dict(reward=normalized, bonusRewardId=bonus_id))
        if non_hero or bindings:
            category_rules.append(dict(id=name, nonChampionRewards=non_hero, bonusBindings=bindings))
    crystals = []
    for group in gacha.get('groups', []):
        crystal_set = group.get('Set', {})
        for box in crystal_set.get('Boxes', []):
            name = identity(box.get('Name'), 'crystal identity')
            category_ids = box.get('_possiblePrizeCategories', [])
            if any(category_id not in categories for category_id in category_ids):
                raise ValueError(f'Unknown prize category: {name}')
            result = dict(id=name, name=text(box, '_displayName') or name,
                          sourceGroup=group.get('Name', ''), sourceSet=crystal_set.get('Name', ''),
                          categoryIds=category_ids, hideOddsInfo=bool(box.get('HideOddsInfo', False)))
            template_id = box.get('PityTemplate')
            if template_id:
                if template_id not in templates:
                    raise ValueError(f'Unknown pity template: {template_id}')
                result['pityTemplateId'] = template_id
            if box.get('SelectableEnabled'):
                draw = integer(box.get('SelectableSpinCount'), 'selection draw', 1)
                pick = integer(box.get('SelectablePickCount'), 'selection pick', 1)
                if pick > draw:
                    raise ValueError(f'Invalid selection: {name}')
                result['selection'] = dict(draw=draw, pick=pick)
            if box.get('IsBoxGacha'):
                result['boxRules'] = dict(openLimit=integer(box.get('BoxGachaOpenLimit'), 'box open limit', 1),
                                          allowManualReset=bool(box.get('BoxGachaAllowManualReset', False)),
                                          manualResetItem=box.get('BoxGachaManualResetItem', ''))
            spend = {}
            for member, target in [('SoftCurrency', 'softCurrency'), ('HardCurrency', 'hardCurrency'), ('Tokens', 'tokens')]:
                if member in box:
                    spend[target] = {key[0].lower()+key[1:]: integer(value, f'{member}.{key}') for key, value in box[member].items()}
            if spend:
                result['recordedSpend'] = spend
            crystals.append(result)
    if len({row['id'] for row in crystals}) != len(crystals):
        raise ValueError('Duplicate crystal identity')
    return dict(numericOddsStatus='not_in_static_catalog', crystals=sorted(crystals, key=lambda row: row['id']),
                pityTemplates=normalized_templates, pityGroups=normalized_groups, bonusRewards=normalized_bonuses,
                categoryRules=category_rules, coverage=dict(definitions=len(crystals),
                  definitionsWithPity=sum('pityTemplateId' in row for row in crystals),
                  boxDefinitions=sum('boxRules' in row for row in crystals), hiddenOddsDefinitions=sum(row['hideOddsInfo'] for row in crystals),
                  pityTemplates=len(templates), pityGroups=len(groups), bonusRewards=len(bonuses),
                  autoAscendBonusDefinitions=sum(row['autoAscend'] for row in normalized_bonuses),
                  conditionalBonusBindings=sum(len(row['bonusBindings']) for row in category_rules),
                  nonChampionRewardEntries=sum(len(row['nonChampionRewards']) for row in category_rules),
                  reversedQuantityRanges=sum(item.get('quantityRangeStatus') == 'reversed_in_source' for row in category_rules for item in row['nonChampionRewards']),
                  bonusRewardItemTypes=dict(sorted(Counter(item['type'] for bonus in normalized_bonuses for item in bonus['rewards']).items())),
                  rewardItemTypes=dict(sorted(item_types.items())), contextKeys=dict(sorted(contexts.items()))))


def validate_contracts(schema):
    expected = {
        'EB.Sparx.GachaDataBuffer': {1: 'categories', 2: 'groups', 3: 'tabs', 4: 'pityTemplates', 5: 'pityGroups', 6: 'bonusRewards'},
        'EB.Sparx.GachaCategory': {1: 'Name', 2: 'Items', 3: 'DisplayRarityIndex'},
        'EB.Sparx.GachaBox': {28: 'Name', 42: '_possiblePrizeCategories', 57: 'IsBoxGacha', 58: 'BoxGachaOpenLimit', 59: 'PityTemplate', 67: 'HideOddsInfo', 73: 'BoxGachaAllowManualReset', 74: 'BoxGachaManualResetItem'},
        'EB.Sparx.RedeemerItem': {5: 'Type', 6: 'Data', 10: 'ContextProto'},
        'EB.Sparx.PityTemplate': {1: 'Name', 2: 'PityGroups'},
        'EB.Sparx.PityGroup': {1: 'Name', 2: 'PayoutLimit', 3: '_description', 4: '_shortDescription', 5: 'PityTags'},
        'EB.Sparx.BonusReward': {1: 'Name', 11: 'Redeemers', 12: 'AutoAscend'},
    }
    for kind, required in expected.items():
        actual = {field['tag']: field['name'] for field in schema['types'][kind]['fields']}
        if any(actual.get(tag) != name for tag, name in required.items()):
            raise ValueError(f'Changed protobuf contract: {kind}')
        if kind in ('EB.Sparx.GachaDataBuffer', 'EB.Sparx.GachaCategory') and actual != required:
            raise ValueError(f'Unreviewed probability-bearing contract change: {kind}')


def extract(gacha_path, schema, observed_at):
    observed = datetime.fromisoformat(observed_at.replace('Z', '+00:00'))
    if observed.tzinfo is None:
        raise ValueError('--observed-at must include a timezone')
    validate_contracts(schema)
    raw = gacha_path.read_bytes()
    decoder = Decoder(schema)
    data = decoder.message(raw, 'EB.Sparx.GachaDataBuffer')
    if decoder.unknown:
        raise ValueError(f'Unknown protobuf members: {decoder.unknown[:5]}')
    return dict(version=1, source=dict(observedAt=observed.isoformat(), gachaSha256=hashlib.sha256(raw).hexdigest(),
                metadata=[dict(assembly=Path(row['path']).name, sha256=row['sha256']) for row in schema['sources']]), **build_rules(data))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--gacha', type=Path, required=True)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument('--metadata', type=Path, help='Current Cpp2IL dummy DLL directory')
    source.add_argument('--schema', type=Path, help='Previously exported current protobuf schema')
    parser.add_argument('--observed-at', required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    schema = export_schema(args.metadata) if args.metadata else json.loads(args.schema.read_text(encoding='utf8'))
    result = extract(args.gacha, schema, args.observed_at)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':'))+'\n', encoding='utf8')
    print(json.dumps(result['coverage'], indent=2))
