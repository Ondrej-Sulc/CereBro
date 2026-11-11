"""Offline, deterministic projection of the configured Class Tower backend corpus."""
import argparse
import hashlib
import json
from pathlib import Path

from tower_backend_contract import positive_wire_integer, validate_block_membership

REPO = Path(__file__).resolve().parents[2]
TOWERS = ("class_cosmic", "class_mutant", "class_mystic", "class_science", "class_skill", "class_tech")
BLUEPRINT_SHA = "2059a0b12ab54b3a582a60371dbc10b9e24b966ae202e6ee8127d464effb2313"
PRIVATE_KEYS = {"stoken", "session", "uid", "userid", "accountid", "balance", "userfloors", "userdata",
                "skipdata", "auth", "authorization", "cookie", "password", "token", "currentclientattackerid"}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def reject_private(value):
    if isinstance(value, dict):
        if any(k.lower() in PRIVATE_KEYS for k in value):
            raise ValueError("Nonpublic Tower subtree")
        for child in value.values():
            reject_private(child)
    elif isinstance(value, list):
        for child in value:
            reject_private(child)


def project_block(capture, source_hash, blueprints):
    if capture.get("format") != "cerebro.public-server-tower-block.v1":
        raise ValueError("Unknown public Tower source format")
    tower, number = capture["requestedTowerId"], positive_wire_integer(capture["requestedBlockId"])
    if tower not in TOWERS or number > 147:
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


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(",", ":")) + "\n", encoding="utf-8")


def build(source, output, blueprint_path):
    if sha(blueprint_path) != BLUEPRINT_SHA:
        raise ValueError("Exact blueprint source drift")
    raw_blueprints = json.loads(blueprint_path.read_text(encoding="utf-8"))
    blueprints = {b["Blueprint"]: b for b in raw_blueprints}
    if len(blueprints) != len(raw_blueprints):
        raise ValueError("Duplicate blueprint identities")
    receipts_path = source / "class-block-receipts.json"
    receipts = json.loads(receipts_path.read_text(encoding="utf-8"))
    result = json.loads((source / "class-block-harvest-result.json").read_text(encoding="utf-8"))
    if result["completed"] != 882 or result["planned"] != 882 or not result["credentialsLoggedOrSaved"] is False:
        raise ValueError("Incomplete backend collection")
    expected = {(tower, number) for tower in TOWERS for number in range(1, 148)}
    observed = {(r["towerId"], r["blockRequested"]): r for r in receipts if r.get("saved")}
    if set(observed) != expected or len(receipts) != len(expected):
        raise ValueError("Incomplete/duplicate configured Tower receipts")
    manifest = {}
    totals = {tower: 0 for tower in TOWERS}
    unresolved = set()
    missing_defenders = 0
    for (tower, number), receipt in sorted(observed.items()):
        filename = f"{tower}-{number:03}.json"
        path = source / "class-blocks" / filename
        if sha(path) != receipt["publicShardSha256"]:
            raise ValueError("Public backend capture hash drift")
        raw = json.loads(path.read_text(encoding="utf-8"))
        if raw["readerSha256"] != result["readerSha256"] or raw["requestedTowerId"] != tower or raw["requestedBlockId"] != number:
            raise ValueError("Backend source receipt identity mismatch")
        row = project_block(raw, sha(path), blueprints)
        target = output / "blocks" / filename
        write(target, row)
        manifest[row["id"]] = {"towerId": tower, "blockNumber": number, "floors": len(row["floors"]),
            "path": f"blocks/{filename}", "sha256": sha(target), "bytes": target.stat().st_size,
            "captureSha256": sha(path)}
        totals[tower] += len(row["floors"])
        for floor in row["floors"]:
            enemy = floor["defender"]
            if not enemy:
                missing_defenders += 1
            elif enemy["gameId"] is None:
                unresolved.add(enemy["blueprint"])
    if any(count != 1606 for count in totals.values()):
        raise ValueError("Observed floor memberships do not match the captured Tower configuration")
    index = {"version": 1, "id": "configured-class-tower-backend-20261110",
             "exporterSha256": sha(Path(__file__)), "sourceReceiptsSha256": sha(receipts_path),
             "sourceHarvestSha256": sha(source / "class-block-harvest-result.json"),
             "blueprintsSha256": BLUEPRINT_SHA, "blocks": manifest,
             "coverage": {"towers": 6, "blocks": 882, "floors": sum(totals.values()),
                          "perTowerFloors": totals, "configuredClassDefinitionsComplete": True,
                          "currentPlayerAccessEstablished": False, "missingDefenderDefinitions": missing_defenders,
                          "unresolvedBlueprints": sorted(unresolved)},
             "notes": ["Recorded server definitions;not a claim that every block is currently playable.",
                       "Enemy ranks/ascension/stats are preserved independently of player upgrade limits.",
                       "No account,user-floor,session,authentication or automatic-reward state is included."]}
    write(output / "manifest.json", index)
    loaders = "\n".join(f'  {json.dumps(key)}: () => import("./{row["path"]}"),' for key, row in manifest.items())
    (output / "index.js").write_text(
        '// Generated offline.Literal lazy imports retain deployment tracing.\n'
        'import index from "./manifest.json";\nexport const towerBackendIndex = index;\n'
        'export const towerBlockLoaders = {\n' + loaders + '\n};\n'
        'export async function loadTowerBlock(towerId, blockNumber) {\n'
        '  if (!Number.isInteger(blockNumber) || blockNumber < 1 || blockNumber > 147) return undefined;\n'
        '  const key = `${towerId}:${blockNumber}`;\n'
        '  if (!Object.hasOwn(towerBlockLoaders, key)) return undefined;\n'
        '  return (await towerBlockLoaders[key]()).default;\n}\n', encoding="utf-8")
    (output / "index.d.ts").write_text(
        'import type { CapturedTowerBlock, CapturedTowerIndex } from "../../../domain/game-quests/tower-data";\n'
        'export declare const towerBackendIndex: CapturedTowerIndex;\n'
        'export declare const towerBlockLoaders: Readonly<Record<string, () => Promise<{ default: CapturedTowerBlock }>>>;\n'
        'export declare function loadTowerBlock(towerId: string, blockNumber: number): Promise<CapturedTowerBlock | undefined>;\n',
        encoding="utf-8")
    print(json.dumps(index["coverage"]))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=REPO / "temp/quest-explorer-review/towers-20261110/backend")
    parser.add_argument("--output", type=Path, default=REPO / "src/data/game-quests/tower-backend")
    parser.add_argument("--blueprints", type=Path, default=Path("C:/Code/CereBro/temp/quest-data-investigation/game-only/current-blueprints.json"))
    args = parser.parse_args()
    build(args.source, args.output, args.blueprints)
