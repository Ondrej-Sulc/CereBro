"""Offline export of the two source-observed Event Towers, with honest partial coverage.

No client access, network, credential helpers, or collection occurs on import/run.
"""
import argparse
import datetime
import json
from pathlib import Path

from build_tower_backend import BLUEPRINT_SHA, reject_private, sha, write
from tower_backend_contract import positive_wire_integer, validate_block_membership

REPO = Path(__file__).resolve().parents[2]
SOURCE = REPO / 'temp/quest-explorer-review/event-towers-20261110/fresh-34416'
TOWERS = ('event_castellan_5', 'event_ggsfa1')
BLOCK_FIELDS = set('id rewards ratingRewards heroRestrictions floorCost numFloors topBuffs buffs towerId hash timeLimit crDeficit minCRToSkip'.split())
FLOOR_FIELDS = set('id blockId aiString mapOverride rewards topBuffs buffs towerId hash bossData'.split())
BOSS_FIELDS = set('bid rank level sig_lvl ascensionTier challenge_rating hp max_hp attack rating rating_prestige armor armor_pen crit_chance crit_rating crit_damage crit_hit_resist block_proficiency block_pen mana_gain atkg defg'.split())
NATIVE_FIELDS = set('Id FriendlyName Category NumBlocks NumFloors TowerPanelTexture TowerVisualDataId EndTime LocalizedLockedDescription DateConditions'.split())
DATE_FIELDS = set('ConditionType DateTime TimeZone Or GUID _duration _interval'.split())


def catalog_towers(catalog, source_hash, art):
    if catalog.get('format') != 'cerebro.public-event-tower-catalog.v1':
        raise ValueError('Unknown Event catalog source')
    reject_private(catalog)
    if not isinstance(catalog.get('capturedAt'), str) or not catalog['capturedAt']:
        raise ValueError('Missing native observation time')
    result = []
    for native in catalog['towers']:
        if set(native) != NATIVE_FIELDS or native['Id'] not in TOWERS or native['Category'] != 2:
            raise ValueError('Unexpected Event catalog identity/category/fields')
        if not isinstance(native['FriendlyName'], str) or not native['FriendlyName']:
            raise ValueError('Missing native Event name')
        count = positive_wire_integer(native['NumBlocks'])
        positive_wire_integer(native['NumFloors'])
        if count > 1000 or type(native['EndTime']) is not int:
            raise ValueError('Invalid native range/end time')
        dates = native['DateConditions']
        if not isinstance(dates, list) or len(dates) > 16:
            raise ValueError('Invalid native date conditions')
        for condition in dates:
            if set(condition) != DATE_FIELDS:
                raise ValueError('Unbound native date condition field')
            if any(condition[k] is not None and not isinstance(condition[k], str)
                   for k in ('ConditionType', 'DateTime', 'TimeZone', 'GUID')):
                raise ValueError('Invalid native date string')
            if type(condition['Or']) is not bool or any(type(condition[k]) is not int for k in ('_duration', '_interval')):
                raise ValueError('Invalid native date primitives')
        artwork = art.get(native['Id'])
        if artwork is not None and artwork['sourceUrl'] != native['TowerPanelTexture']:
            raise ValueError('Artwork not bound to exact native Tower URL')
        ends_at = (datetime.datetime.fromtimestamp(native['EndTime'], datetime.timezone.utc)
                   .isoformat().replace('+00:00', 'Z')) if native['EndTime'] >= 0 else None
        result.append({'id': native['Id'], 'name': native['FriendlyName'], 'section': 'event',
            'startsAt': None, 'endsAt': ends_at, 'observedAt': catalog['capturedAt'],
            'archiveStatus': 'unknown', 'availabilityStatus': 'unknown',
            'blockNumbers': list(range(1, count + 1)), 'capturedBlockNumbers': [], 'artwork': artwork,
            'dates': {'start': None, 'startStatus': 'not-established', 'endTime': native['EndTime'],
                      'nativeDateConditions': dates},
            'source': {'captureSha256': source_hash, 'capturedAt': catalog['capturedAt'],
                       **catalog['source'], 'nativeData': native, 'currentAccessEstablished': False}})
    if sorted(row['id'] for row in result) != list(TOWERS):
        raise ValueError('Missing or duplicate observed Event identities')
    return sorted(result, key=lambda row: row['id'])


def project_block(capture, source_hash, blueprints, configured):
    if capture.get('format') != 'cerebro.public-server-tower-block.v1':
        raise ValueError('Unknown public Tower source format')
    tower = capture['requestedTowerId']
    number = positive_wire_integer(capture['requestedBlockId'])
    if tower not in TOWERS or tower not in configured or number > configured[tower]:
        raise ValueError('Event block outside exact configured scope')
    blocks, floors = capture['blocks'], capture['floors']
    reject_private(blocks)
    reject_private(floors)
    if any(set(row) - BLOCK_FIELDS for row in blocks) or any(set(row) - FLOOR_FIELDS for row in floors):
        raise ValueError('Non-allowlisted public block/floor fields')
    if any(set(row.get('bossData') or {}) - BOSS_FIELDS for row in floors):
        raise ValueError('Non-allowlisted defender fields')
    count = validate_block_membership(blocks, floors, tower, number)
    projected = []
    for floor in sorted(floors, key=lambda row: positive_wire_integer(row['id'])):
        boss = floor.get('bossData') or {}
        bid = boss.get('bid')
        blueprint = blueprints.get(bid)
        if not bid or not blueprint or not blueprint.get('Character'):
            raise ValueError('Missing exact Event defender blueprint')
        enemy = {'blueprint': bid, 'gameId': blueprint['Character'], 'rarity': blueprint['Rarity'],
                 'classId': blueprint.get('_heroClass'), 'rank': boss.get('rank'), 'level': boss.get('level'),
                 'signature': boss.get('sig_lvl'), 'ascensionTier': boss.get('ascensionTier'),
                 'health': boss.get('hp'), 'maxHealth': boss.get('max_hp'), 'attack': boss.get('attack'),
                 'challengeRating': boss.get('challenge_rating')}
        projected.append({'floorNumber': positive_wire_integer(floor['id']), 'defender': enemy, 'sourceData': floor})
    return {'version': 1, 'id': f'{tower}:{number}', 'towerId': tower, 'blockNumber': number,
            'declaredFloorCount': count, 'source': {'captureSha256': source_hash,
                'responseSha256': capture['responseSha256'], 'capturedAt': capture['capturedAt'],
                'readerSha256': capture['readerSha256']},
            'blockData': blocks[0], 'floors': projected,
            'coverage': {'allDeclaredFloorsCaptured': True, 'currentAccessOrEligibilityEstablished': False}}


def build(source, output, blueprint_path):
    if sha(blueprint_path) != BLUEPRINT_SHA:
        raise ValueError('Exact blueprint source drift')
    raw_blueprints = json.loads(blueprint_path.read_text(encoding='utf-8'))
    blueprints = {row['Blueprint']: row for row in raw_blueprints}
    if len(blueprints) != len(raw_blueprints):
        raise ValueError('Duplicate blueprint identities')
    catalog_path = source / 'public-catalog.json'
    catalog = json.loads(catalog_path.read_text(encoding='utf-8'))
    art = json.loads((source / 'art-receipts.json').read_text(encoding='utf-8'))
    for identity, row in art.items():
        if identity not in TOWERS or row['url'] != f'/game-towers/events/{identity}.jpg':
            raise ValueError('Artwork outside exact Event paths')
        path = REPO / 'web/public' / row['url'].lstrip('/')
        if sha(path) != row['sha256'] or path.stat().st_size != row['bytes']:
            raise ValueError('Native artwork source drift')
    towers = catalog_towers(catalog, sha(catalog_path), art)
    configured = {row['id']: len(row['blockNumbers']) for row in towers}
    expected = {(row['id'], number) for row in towers for number in row['blockNumbers']}
    receipts_path = source / 'event-block-receipts.json'
    receipts = json.loads(receipts_path.read_text(encoding='utf-8'))
    outcome_path = source / 'collection-outcome.json'
    outcome = json.loads(outcome_path.read_text(encoding='utf-8'))
    if (outcome.get('format') != 'cerebro.event-tower-collection-outcome.v1'
            or outcome['receiptSha256'] != sha(receipts_path) or outcome['planned'] != len(expected)
            or outcome['credentialsLoggedOrSaved'] is not False):
        raise ValueError('Invalid Event acquisition evidence')
    observed = {}
    for receipt in receipts:
        key = (receipt['towerId'], positive_wire_integer(receipt['blockRequested']))
        if key not in expected:
            raise ValueError('Unobserved Event receipt identity')
        if receipt.get('saved'):
            if key in observed or receipt.get('error') or receipt.get('status') != 200:
                raise ValueError('Duplicate/invalid saved Event receipt')
            observed[key] = receipt
    if outcome['completed'] != len(observed):
        raise ValueError('Event completed count differs from receipts')
    complete = set(observed) == expected
    if outcome['outcome'] not in ('complete', 'session-unavailable') or (outcome['outcome'] == 'complete') != complete:
        raise ValueError('Event acquisition status differs from coverage')
    if not complete and (outcome.get('stopReason') != 'ID_SPARX_ERROR_SESSION'
                         or not receipts or receipts[-1].get('error') != outcome['stopReason']):
        raise ValueError('Missing exact incomplete-coverage reason')
    source_files = {path.name for path in (source / 'event-blocks').glob('*.json')}
    if source_files != {f'{tower}-{number:03}.json' for tower, number in observed}:
        raise ValueError('Unreceipted or missing Event shard')
    manifest = {}
    totals = {identity: 0 for identity in configured}
    for (tower, number), receipt in sorted(observed.items()):
        name = f'{tower}-{number:03}.json'
        path = source / 'event-blocks' / name
        if sha(path) != receipt['publicShardSha256']:
            raise ValueError('Event capture hash drift')
        raw = json.loads(path.read_text(encoding='utf-8'))
        if (raw['requestedTowerId'] != tower or positive_wire_integer(raw['requestedBlockId']) != number
                or raw['readerSha256'] != outcome['readerSha256']
                or raw['responseSha256'] != receipt['responseSha256']):
            raise ValueError('Event capture identity/receipt mismatch')
        row = project_block(raw, sha(path), blueprints, configured)
        target = output / 'blocks' / name
        write(target, row)
        manifest[row['id']] = {'towerId': tower, 'blockNumber': number, 'floors': len(row['floors']),
            'path': 'blocks/' + name, 'sha256': sha(target), 'bytes': target.stat().st_size,
            'captureSha256': sha(path)}
        totals[tower] += len(row['floors'])
    for tower in towers:
        tower['capturedBlockNumbers'] = sorted(number for identity, number in observed if identity == tower['id'])
        expected_floors = tower['source']['nativeData']['NumFloors']
        if totals[tower['id']] > expected_floors or (len(tower['capturedBlockNumbers']) == len(tower['blockNumbers'])
                                                   and totals[tower['id']] != expected_floors):
            raise ValueError('Event floor coverage differs from native catalog')
    index = {'version': 1, 'id': 'observed-event-towers-20261110', 'exporterSha256': sha(Path(__file__)),
        'sourceCatalogSha256': sha(catalog_path), 'sourceReceiptsSha256': sha(receipts_path),
        'sourceHarvestSha256': sha(outcome_path), 'blueprintsSha256': BLUEPRINT_SHA,
        'observedAt': catalog['capturedAt'], 'towers': towers, 'blocks': manifest,
        'acquisition': {'status': outcome['outcome'], 'stopReason': outcome.get('stopReason'),
                        'networkRequests': outcome['networkRequestsThisRun']},
        'coverage': {'towers': len(towers), 'blocks': len(manifest), 'floors': sum(totals.values()),
            'perTowerFloors': totals, 'configuredBlocks': len(expected),
            'configuredFloors': sum(row['source']['nativeData']['NumFloors'] for row in towers),
            'missingBlocks': [{'towerId': tower, 'blockNumber': number} for tower, number in sorted(expected - set(observed))],
            'configuredClassDefinitionsComplete': False, 'observedEventDefinitionsComplete': complete,
            'currentPlayerAccessEstablished': False, 'missingDefenderDefinitions': 0, 'unresolvedBlueprints': []},
        'notes': ['Only the two exact Event identities observed in the public catalog are included; no historical completeness claim.',
            'Configured block/floor counts are separate from captured definition counts. Missing blocks have no invented content.',
            'Native dates and observation time do not establish current availability, permanence or player eligibility.',
            'No StartTime field exists in native TowerData; exact DateConditions are retained and start is unestablished.',
            'Native enemy ascension/current HP/max HP are preserved independently of player upgrade limits when blocks are captured.',
            'No account, user-floor, authentication, automatic reward state or ID-only icon binding is published.']}
    write(output / 'manifest.json', index)
    loaders = '\n'.join(f'  {json.dumps(key)}: () => import("./{row["path"]}"),' for key, row in manifest.items())
    (output / 'index.js').write_text(
        '// Generated offline. Only exact captured Event blocks receive literal imports.\n'
        'import index from "./manifest.json";\nexport const towerEventIndex = index;\n'
        'export const towerBlockLoaders = {\n' + loaders + '\n};\n'
        'export async function loadTowerBlock(towerId, blockNumber) {\n'
        '  if (typeof towerId !== "string" || !Number.isInteger(blockNumber) || blockNumber < 1) return undefined;\n'
        '  const key = `${towerId}:${blockNumber}`;\n'
        '  if (!Object.hasOwn(towerBlockLoaders, key)) return undefined;\n'
        '  return (await towerBlockLoaders[key]()).default;\n}\n', encoding='utf-8')
    (output / 'index.d.ts').write_text(DECLARATIONS, encoding='utf-8')
    print(json.dumps(index['coverage']))


DECLARATIONS = '''import type { CapturedTowerBlock, CapturedTowerIndex } from "../../../domain/game-quests/tower-data";
export interface EventTowerArtwork {
  url: string; width: number; height: number; sourceUrl: string; sha256: string; bytes: number;
}
export interface EventTowerDateCondition {
  ConditionType: string | null; DateTime: string | null; TimeZone: string | null; Or: boolean;
  GUID: string | null; _duration: number; _interval: number;
}
export interface EventTowerCatalogEntry {
  id: string; name: string; section: 'event'; archiveStatus: 'unknown'; availabilityStatus: 'unknown';
  startsAt: string | null; endsAt: string | null; observedAt: string;
  blockNumbers: readonly number[]; capturedBlockNumbers: readonly number[]; artwork: EventTowerArtwork | null;
  dates: { start: null; startStatus: 'not-established'; endTime: number;
    nativeDateConditions: readonly EventTowerDateCondition[] };
  source: { captureSha256: string; capturedAt: string; readerSha256: string; layoutSha256: string;
    currentAccessEstablished: boolean; nativeData: { Id: string; FriendlyName: string; Category: number;
      NumBlocks: number; NumFloors: number; EndTime: number; TowerPanelTexture: string;
      TowerVisualDataId: string; LocalizedLockedDescription: string;
      DateConditions: readonly EventTowerDateCondition[] } };
}
export interface CapturedEventTowerIndex extends CapturedTowerIndex {
  sourceCatalogSha256: string; observedAt: string; towers: readonly EventTowerCatalogEntry[];
  acquisition: { status: 'complete' | 'session-unavailable'; stopReason: string | null; networkRequests: number };
  coverage: CapturedTowerIndex['coverage'] & { configuredBlocks: number; configuredFloors: number;
    observedEventDefinitionsComplete: boolean;
    missingBlocks: readonly { towerId: string; blockNumber: number }[] };
}
export declare const towerEventIndex: CapturedEventTowerIndex;
export declare const towerBlockLoaders: Readonly<Record<string, () => Promise<{ default: CapturedTowerBlock }>>>;
export declare function loadTowerBlock(towerId: string, blockNumber: number): Promise<CapturedTowerBlock | undefined>;
'''


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=SOURCE)
    parser.add_argument('--output', type=Path, default=REPO / 'src/data/game-quests/tower-events')
    parser.add_argument('--blueprints', type=Path, default=Path('C:/Code/CereBro/temp/quest-data-investigation/game-only/current-blueprints.json'))
    args = parser.parse_args()
    build(args.source, args.output, args.blueprints)
