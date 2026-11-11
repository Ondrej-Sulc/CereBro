"""Project saved public Tower captures, offline; never accesses the game or DB."""
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GAME_SHA = "01f46bb2e36c2160a8df939bbb080bcf2ee89ca15427692a10334efc90fd4abb"
LAYOUT_SHA = "9c948d4c0f965cdac354d7cffff112c1f1797c076648dc182d6a30eb63f0bdaf"
READER_V1_SHA = "e243f3af1bad5e9243f0bf080fef5f0b1b64023909f433e402a3592d62c03b22"
PUBLIC_TOWERS = frozenset("class_skill class_mutant class_tech class_cosmic class_mystic class_science".split())


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()).hexdigest()


def exact(value, fields):
    if not isinstance(value, dict) or set(value) != set(fields.split()):
        raise ValueError("Unexpected public Tower record shape")
    return value


def rewards(items):
    return [exact(item, "Type Data Quantity MinQuantity MaxQuantity Action Header Footer") for item in items or []]


def buffs(items):
    return [exact(item, "id localizedName localizedDesc localizedShortFormat glyphIcon scope value displayValue valueStr valueType quantity") for item in items or []]


def defender(value):
    if value is None:
        return None
    exact(value, "mBlueprint mUserHero")
    blueprint = exact(value["mBlueprint"], "Blueprint Character Rarity _imgID _heroClass")
    build = value["mUserHero"]
    if build is not None:
        exact(build, "Blueprint Rank Level SigLvl AscensionTier")
        if build["Blueprint"] != blueprint["Blueprint"]:
            raise ValueError("Tower defender blueprint/build identity disagreement")
    return {"blueprint": blueprint["Blueprint"], "gameId": blueprint["Character"],
            "stars": blueprint["Rarity"], "classId": blueprint["_heroClass"],
            "nativeImageId": blueprint["_imgID"], "build": build}


def project(observations):
    blocks, floor_rows, tower_names, sources = {}, {}, {}, []

    def merge(target, key, value, source):
        body_hash = digest(value)
        if key not in target:
            target[key] = {**value, "contentSha256": body_hash, "sourceObservationSha256s": []}
        if target[key]["contentSha256"] != body_hash:
            raise ValueError("Conflicting observed Tower definition; retain/version the sources explicitly")
        if source not in target[key]["sourceObservationSha256s"]:
            target[key]["sourceObservationSha256s"].append(source)

    for source_hash, capture in observations:
        if (capture.get("format") != "cerebro.public-tower-definitions.v1"
                or capture.get("gameAssemblySha256") != GAME_SHA or capture.get("layoutSha256") != LAYOUT_SHA
                or capture.get("readerSha256") != READER_V1_SHA):
            raise ValueError("Unapproved Tower capture provenance")
        sources.append({"sha256": source_hash, "capturedAt": capture["capturedAt"],
                        "readerSha256": capture["readerSha256"], "blocks": len(capture["blocks"]),
                        "floors": len(capture["floors"])})
        for tower in capture["towers"]:
            if tower["Id"] not in PUBLIC_TOWERS or tower["Category"]["name"] != "Class":
                raise ValueError("Unapproved Tower identity")
            name = tower_names.setdefault(tower["Id"], tower["FriendlyName"])
            if name != tower["FriendlyName"]:
                raise ValueError("Conflicting native Tower name")
        for block in capture["blocks"]:
            exact(block, "Id TowerId NumFloors TimeLimit Hash TopBuffs Buffs EntryCost Rewards RatingRewards HeroRestrictionsList")
            if block["TowerId"] not in tower_names:
                raise ValueError("Tower block lacks its captured identity")
            key = (block["TowerId"], block["Id"])
            row = {"towerId": key[0], "blockNumber": key[1], "nativeHash": block["Hash"],
                   "declaredFloorCount": block["NumFloors"], "timeLimit": block["TimeLimit"],
                   "topBuffs": buffs(block["TopBuffs"]), "buffs": buffs(block["Buffs"]),
                   "entryCost": rewards(block["EntryCost"]), "rewards": rewards(block["Rewards"]),
                   "ratingRewards": rewards(block["RatingRewards"]), "heroRestrictions": block["HeroRestrictionsList"]}
            merge(blocks, key, row, source_hash)
        for floor in capture["floors"]:
            exact(floor, "TowerId BlockId FloorNumber BossData AIDifficultyId Hash TotalLocalBuffCount TopBuffs Buffs Rewards")
            key = (floor["TowerId"], floor["BlockId"], floor["FloorNumber"])
            if key[:2] not in blocks or not 1 <= key[2] <= blocks[key[:2]]["declaredFloorCount"]:
                raise ValueError("Tower floor lacks an exact captured parent/index")
            row = {"towerId": key[0], "blockNumber": key[1], "floorNumber": key[2],
                   "nativeHash": floor["Hash"], "defender": defender(floor["BossData"]),
                   "aiDifficultyId": floor["AIDifficultyId"], "totalLocalBuffCount": floor["TotalLocalBuffCount"],
                   "topBuffs": buffs(floor["TopBuffs"]), "buffs": buffs(floor["Buffs"]), "rewards": rewards(floor["Rewards"])}
            merge(floor_rows, key, row, source_hash)
    result = []
    for key, block in sorted(blocks.items()):
        floors = [row for floor_key, row in sorted(floor_rows.items()) if floor_key[:2] == key]
        complete = [row["floorNumber"] for row in floors] == list(range(1, block["declaredFloorCount"] + 1))
        result.append({**block, "towerName": tower_names[key[0]], "floors": floors,
                       "coverage": {"capturedFloors": len(floors), "allDeclaredFloorsCaptured": complete}})
    return {"version": 1, "id": "public-class-tower-blocks-20261110", "gameAssemblySha256": GAME_SHA,
            "layoutSha256": LAYOUT_SHA, "sources": sorted(sources, key=lambda x: x["capturedAt"]), "blocks": result,
            "coverage": {"capturedTowers": len({key[0] for key in blocks}), "capturedBlocks": len(blocks),
                         "capturedFloors": len(floor_rows), "completeTowerCoverage": False,
                         "currentAccessOrRewardEligibilityEstablished": False}}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, default=ROOT / "temp/quest-explorer-review/towers-20261110")
    parser.add_argument("--out", type=Path, default=ROOT / "src/data/game-quests/tower-blocks.json")
    args = parser.parse_args()
    paths = sorted(args.source_dir.glob("capture-00[123]-*.json"))
    if len(paths) != 3:
        raise ValueError("The three frozen Skill Tower source observations are required")
    observations = [(hashlib.sha256(path.read_bytes()).hexdigest(), json.loads(path.read_text(encoding="utf-8"))) for path in paths]
    document = project(observations)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(document, ensure_ascii=False, allow_nan=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(document["coverage"]))
