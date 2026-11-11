"""Deterministic offline projection of exact observed public Challenge Tower sources."""
import argparse
import hashlib
import json
import re
from pathlib import Path
from build_tower_backend import BLUEPRINT_SHA, reject_private, sha, write
from tower_backend_contract import positive_wire_integer, validate_block_membership

REPO = Path(__file__).resolve().parents[2]
SOURCE = REPO / 'temp/quest-explorer-review/challenge-towers-20261110'


def catalog_towers(catalog, source_hash, art):
    if catalog.get('format') != 'cerebro.public-challenge-tower-catalog.v1':
        raise ValueError('Unknown Challenge catalog source')
    result = []
    seen = set()
    for native in catalog['towers']:
        reject_private(native)
        tower_id = native['Id']
        if (not isinstance(tower_id, str) or not re.fullmatch(r'[a-z0-9_]+', tower_id)
                or tower_id in seen or native['Category'] != 1):
            raise ValueError('Invalid/duplicate Challenge identity')
        seen.add(tower_id)
        count = positive_wire_integer(native['NumBlocks'])
        positive_wire_integer(native['NumFloors'])
        if count > 1000: raise ValueError('Challenge block range budget')
        result.append({'id': tower_id, 'name': native['FriendlyName'], 'section': 'challenge',
            'archiveStatus': 'unknown', 'blockNumbers': list(range(1, count+1)),
            'artwork': art.get(tower_id), 'source': {'captureSha256': source_hash,
                'capturedAt': catalog['capturedAt'], **catalog['source'], 'nativeData': native,
                'currentAccessEstablished': False}})
    return sorted(result, key=lambda row: row['id'])


def project_block(capture, source_hash, blueprints, configured):
    if capture.get("format") != "cerebro.public-server-tower-block.v1":
        raise ValueError("Unknown public Tower source format")
    tower, number = capture["requestedTowerId"], positive_wire_integer(capture["requestedBlockId"])
    if tower not in configured or number > configured[tower]:
        raise ValueError("Tower block outside configured scope")
    blocks, floors = capture["blocks"], capture["floors"]
    reject_private(blocks)
    reject_private(floors)
    count = validate_block_membership(blocks, floors, tower, number)
    projected = []
    for floor in sorted(floors, key=lambda f: positive_wire_integer(f["id"])):
        boss = floor.get("bossData") or {}
        bid = boss.get("bid")
        blueprint = blueprints.get(bid)
        enemy = None if not bid else {
            "blueprint": bid, "gameId": blueprint["Character"] if blueprint else None,
            "rarity": blueprint["Rarity"] if blueprint else None,
            "classId": blueprint.get("_heroClass") if blueprint else None,
            "rank": boss.get("rank"), "level": boss.get("level"), "signature": boss.get("sig_lvl"),
            "ascensionTier": boss.get("ascensionTier"), "health": boss.get("hp"), "maxHealth": boss.get("max_hp"),
            "attack": boss.get("attack"), "challengeRating": boss.get("challenge_rating"),
        }
        projected.append({"floorNumber": positive_wire_integer(floor["id"]), "defender": enemy, "sourceData": floor})
    return {"version": 1, "id": f"{tower}:{number}", "towerId": tower, "blockNumber": number,
            "declaredFloorCount": count, "source": {"captureSha256": source_hash,
                "responseSha256": capture["responseSha256"], "capturedAt": capture["capturedAt"],
                "readerSha256": capture["readerSha256"]},
            "blockData": blocks[0], "floors": projected,
            "coverage": {"allDeclaredFloorsCaptured": True, "currentAccessOrEligibilityEstablished": False}}


def build(source, output, blueprint_path):
    if sha(blueprint_path) != BLUEPRINT_SHA:
        raise ValueError('Exact blueprint source drift')
    raw_blueprints = json.loads(blueprint_path.read_text(encoding='utf-8'))
    blueprints = {row['Blueprint']: row for row in raw_blueprints}
    if len(blueprints) != len(raw_blueprints): raise ValueError('Duplicate blueprint identities')
    catalog_path = source / 'public-catalog.json'
    catalog = json.loads(catalog_path.read_text(encoding='utf-8'))
    art = json.loads((source/'art-receipts.json').read_text())
    for row in art.values():
        path = REPO / 'web/public' / row['url'].lstrip('/')
        if sha(path) != row['sha256']: raise ValueError('Native artwork source drift')
    towers = catalog_towers(catalog, sha(catalog_path), art)
    configured = {row['id']: len(row['blockNumbers']) for row in towers}
    expected = {(row['id'], number) for row in towers for number in row['blockNumbers']}
    receipts_path = source/'challenge-block-receipts.json'
    receipts = json.loads(receipts_path.read_text())
    harvest_path = source/'challenge-block-harvest-result.json'
    harvest = json.loads(harvest_path.read_text())
    observed = {(row['towerId'], row['blockRequested']): row for row in receipts if row.get('saved')}
    if (set(observed) != expected or len(receipts) != len(expected) or harvest['completed'] != len(expected)
            or harvest['planned'] != len(expected) or harvest['credentialsLoggedOrSaved'] is not False):
        raise ValueError('Incomplete/duplicate Challenge collection')
    manifest = {}; totals = {tower: 0 for tower in configured}; missing = 0; unresolved = set()
    for (tower, number), receipt in sorted(observed.items()):
        name = f'{tower}-{number:03}.json'
        path = source/'challenge-blocks'/name
        if sha(path) != receipt['publicShardSha256']: raise ValueError('Capture hash drift')
        raw = json.loads(path.read_text(encoding='utf-8'))
        if (raw['requestedTowerId'] != tower or raw['requestedBlockId'] != number
                or raw['readerSha256'] != harvest['readerSha256']
                or raw['responseSha256'] != receipt['responseSha256']):
            raise ValueError('Capture identity/receipt mismatch')
        row = project_block(raw, sha(path), blueprints, configured)
        target = output/'blocks'/name
        write(target, row)
        manifest[row['id']] = {'towerId': tower, 'blockNumber': number, 'floors': len(row['floors']),
            'path': 'blocks/'+name, 'sha256': sha(target), 'bytes': target.stat().st_size, 'captureSha256': sha(path)}
        totals[tower] += len(row['floors'])
        for floor in row['floors']:
            if floor['defender'] is None: missing += 1
            elif floor['defender']['gameId'] is None: unresolved.add(floor['defender']['blueprint'])
    for tower in towers:
        if totals[tower['id']] != tower['source']['nativeData']['NumFloors']:
            raise ValueError('Tower floor total differs from native catalog')
    if missing or unresolved: raise ValueError('Unresolved Challenge defender source')
    index = {'version': 1, 'id': 'observed-challenge-towers-20261110', 'exporterSha256': sha(Path(__file__)),
        'sourceCatalogSha256': sha(catalog_path), 'sourceReceiptsSha256': sha(receipts_path),
        'sourceHarvestSha256': sha(harvest_path), 'blueprintsSha256': BLUEPRINT_SHA,
        'towers': towers, 'blocks': manifest,
        'archive': {'artwork': art.get('archives'), 'additionalObservedTowerIds': [],
            'membership': 'The native Archive provider reads the Challenge category, including Saga; it groups by account eligibility/completion. Those account groups were not read.',
            'sourceEvidenceSha256': sha(source/'native-archive-evidence.json'),
            'historicalCatalogComplete': False},
        'coverage': {'towers': len(towers), 'blocks': len(manifest), 'floors': sum(totals.values()),
            'perTowerFloors': totals, 'configuredClassDefinitionsComplete': False,
            'observedChallengeDefinitionsComplete': True, 'currentPlayerAccessEstablished': False,
            'missingDefenderDefinitions': missing, 'unresolvedBlueprints': sorted(unresolved)},
        'notes': ['Complete for the exact Challenge definitions resident in this client snapshot; not an all-time archive.',
            'Only challenge_saga is observed in Challenge category; no additional archive-specific Tower identity was observed.',
            'Category and EndTime do not prove permanence, current availability or player eligibility.',
            'Native enemy ascension/stats and public rewards are preserved; account and automatic-reward state are excluded.']}
    write(output/'manifest.json', index)
    loaders = '\n'.join(f'  {json.dumps(key)}: () => import("./{row["path"]}"),' for key, row in manifest.items())
    (output/'index.js').write_text(
        '// Generated offline. Exact public sources only.\nimport index from "./manifest.json";\n'
        'export const towerChallengeIndex = index;\nexport const towerBlockLoaders = {\n'+loaders+'\n};\n'
        'export async function loadTowerBlock(towerId, blockNumber) {\n'
        '  if (!Number.isInteger(blockNumber) || blockNumber < 1) return undefined;\n'
        '  const key = `${towerId}:${blockNumber}`;\n'
        '  if (!Object.hasOwn(towerBlockLoaders, key)) return undefined;\n'
        '  return (await towerBlockLoaders[key]()).default;\n}\n', encoding='utf-8')
    (output/'index.d.ts').write_text('''import type { CapturedTowerBlock, CapturedTowerIndex } from "../../../domain/game-quests/tower-data";
export interface ChallengeTowerArtwork {
  url: string; width: number; height: number; sourceUrl: string; sha256: string; bytes: number;
}
export interface ChallengeTowerCatalogEntry {
  id: string; name: string; section: 'challenge'; archiveStatus: 'active' | 'archived' | 'unknown';
  blockNumbers: readonly number[]; artwork: ChallengeTowerArtwork | null;
  source: { captureSha256: string; capturedAt: string; readerSha256: string; layoutSha256: string;
    currentAccessEstablished: boolean; nativeData: { Id: string; FriendlyName: string; Category: number;
      NumBlocks: number; NumFloors: number; EndTime: number; TowerPanelTexture: string;
      TowerVisualDataId: string; LocalizedLockedDescription: string } };
}
export interface CapturedChallengeTowerIndex extends CapturedTowerIndex {
  sourceCatalogSha256: string; towers: readonly ChallengeTowerCatalogEntry[];
  archive: { artwork: ChallengeTowerArtwork | null; additionalObservedTowerIds: readonly string[];
    membership: string; sourceEvidenceSha256: string; historicalCatalogComplete: boolean };
}
export declare const towerChallengeIndex: CapturedChallengeTowerIndex;
export declare const towerBlockLoaders: Readonly<Record<string, () => Promise<{ default: CapturedTowerBlock }>>>;
export declare function loadTowerBlock(towerId: string, blockNumber: number): Promise<CapturedTowerBlock | undefined>;
''', encoding='utf-8')
    print(json.dumps(index['coverage']))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=SOURCE)
    parser.add_argument('--output', type=Path, default=REPO/'src/data/game-quests/tower-challenges')
    parser.add_argument('--blueprints', type=Path, default=Path('C:/Code/CereBro/temp/quest-data-investigation/game-only/current-blueprints.json'))
    args = parser.parse_args()
    build(args.source, args.output, args.blueprints)

