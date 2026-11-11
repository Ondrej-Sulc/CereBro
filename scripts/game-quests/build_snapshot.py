"""Offline allowlisted public projection. Never opens the game or writes source artifacts."""
import argparse
import hashlib
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]

def read(path):
    return json.loads(path.read_text(encoding="utf-8"))

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def xy(value):
    values = [value["x"], value["y"]] if isinstance(value, dict) else value
    assert len(values) == 2 and all(float(v).is_integer() for v in values)
    return list(map(int, values))

def build(source, champions_path, out):
    inputs = {}
    def source_read(relative):
        path = source / relative
        inputs[relative] = sha(path)
        return read(path)
    index = source_read("expansion/quest-index.json")
    validation = source_read("expansion/map-validation.json")
    expected = source_read("expansion/placed-encounters.json")
    source_manifest = source_read("expansion/manifest.json")
    for evidence in ("source-manifest.json", "quest-field-binding-evidence.json", "detail-load-evidence.json", "continuation/semantics-evidence.json"):
        source_read(evidence)
    base = source_read("continuation/runtime-supply.json")
    assert not base["issues"]
    bp = {b["Blueprint"]: b for b in source_read("current-blueprints.json")}
    champs = {c["gameId"]: {k: c[k] for k in ("id", "slug", "name")} for c in read(champions_path) if c.get("gameId")}
    # Decode only public character labels from the same retained BCG as the blueprints.
    sys.path.insert(0, str(REPO / "scripts"))
    from mcoc_protobuf import Decoder, fields
    schema_path = champions_path.parent / "schema.json"
    bcg_path = source / "sources/bcg-E95E28EECECC04D6A358C8FD8089D01305D0FB73.bin"
    assert sha(bcg_path) == next(c["sha256"] for c in source_manifest["publicCaches"] if "bcg" in c["path"])
    dec = Decoder(read(schema_path))
    contract = {f["tag"]: f["name"] for f in dec.schema["BCGCharacterData"]["fields"]}
    assert contract[1] == "Character" and contract[2] == "_friendlyNameLoc"
    labels = {}
    for n, _, value, _ in fields(bcg_path.read_bytes()):
        if n == 4:
            c = dec.message(value, "BCGCharacterData")
            labels[c["Character"]] = c.get("_friendlyNameLoc", {}).get("en") or c["Character"]
    assert not dec.unknown
    checked = {v["qid"]: v for v in validation["maps"]}
    definitions = {qid: (q, s["QuestMaps"][qid], "continuation/runtime-supply.json", base["capturedAt"])
                   for s in base["pveSets"] for qid, q in (s["QuestSummarys"] or {}).items() if qid in (s["QuestMaps"] or {})}
    for path in sorted((source / "expansion/maps").glob("*.json")):
        rel = path.relative_to(source).as_posix()
        data = source_read(rel)
        assert not data["issues"]
        definitions[data["quest"]["qid"]] = (data["quest"], data["map"], rel, data["capturedAt"])
    def identity(tier):
        b = bp[tier]
        game_id = b["Character"]
        assert 1 <= b["Rarity"] <= 7
        return dict(tierId=tier, gameId=game_id, rarity=b["Rarity"], name=labels.get(game_id, game_id), champion=champs.get(game_id))
    def application(a, target, coordinate, i):
        b = a["buff"]
        s = a["nodeSource"]
        return dict(id=f'{coordinate[0]},{coordinate[1]}:{target}:{i}', effectId=b["id"], target=target,
                    name=b["localizedName"], description=a["buffDescription"], rawDescription=b["localizedDesc"],
                    amount=a["buffAmount"], extra=a["isExtra"], sourceCoordinate=xy(a["sourceCoordinate"]),
                    sourceType=s["type"]["name"], remainActive=s["remainActive"], linkedTargets=[xy(v) for v in s["bt"] or []],
                    parameters={k: b[k] for k in ("value", "displayValue", "valueStr", "quantity", "buffType", "buffStatMods", "valueType")})
    catalog, lookup, outputs = [], [], {}
    def write(relative, data):
        path = out / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        outputs[relative] = sha(path)
    for row in index["quests"]:
        qid = row["qid"]
        summary = dict(id=qid, name=row["questName"], category=row["category"],
                       containerSetId=row["containerSetId"], containerSetName=row["containerSetName"],
                       summarySetId=row["summarySetId"], summarySetName=row["summarySetName"], mapId=row["mapId"],
                       actIndex=row["actIndex"], chapterIndex=row["chapterIndex"], questIndex=row["questIndex"],
                       hierarchy=row["hierarchy"], hierarchyBinding=row["hierarchyBinding"],
                       difficultyId=row["difficultyId"], difficulty=row["difficulty"],
                       setDifficulty=row["setDifficulty"], minProgressionRank=row["minProgressionRank"],
                       maxProgressionRank=row["maxProgressionRank"], scalingCurve=row["scalingCurve"],
                       coverage="full-map" if qid in definitions else "summary-only",
                       walkableNodes=row["walkableNodes"], authoredPaths=row["authoredPaths"], placedEncounters=row["placedEncounters"],
                       sourceHash=row["detailedCaptureSha256"] or inputs["continuation/runtime-supply.json"])
        catalog.append(summary)
        if qid not in definitions:
            continue
        q, m, source_file, at = definitions[qid]
        assert inputs[source_file] == checked[qid]["sourceSha256"] == summary["sourceHash"]
        tiles, encounters = [], []
        paths = [dict(index=i, coordinates=[xy(p) for p in path["tiles"]]) for i, path in enumerate(m["paths"])]
        for t in m["walkableTiles"]:
            coordinate = xy(t)
            keys = list(dict.fromkeys(([t["bossId"]] if t["bossId"] else []) + [e["bossId"] for e in t["tileEntities"] or [] if e["bossId"]]))
            tiles.append(dict(coordinate=coordinate, nodeNumber=t["nodeNumber"], start=t["start"], final=t["final"],
                              hidden=t["hidden"], links=[xy(v) for v in t["links"] or []],
                              portals=[dict(target=xy(p["target"]), label=p["label"], randomChance=p["randomChance"], tags=p["tags"]) for p in t["portalTargets"] or []],
                              randomPortal=t["IsRandomPortal"], barrier=t["barrier"],
                              applications=[application(a, target, coordinate, i) for target in ("attacker", "defender") for i, a in enumerate(t[target + "Buffs"] or [])]))
            for key in keys:
                boss = q["bosses"][key]
                e = dict(id=f'{qid}:{coordinate[0]},{coordinate[1]}:{key}', coordinate=coordinate,
                         bossKey=key, **identity(boss["blueprint"]), rank=boss["rank"], level=boss["level"],
                         signature=boss["sigLvl"], ascension=boss["ascensionTier"], final=t["final"],
                         candidates=[identity(tier) for tier in boss["potentialCharacters"] or []],
                         pathIndices=[p["index"] for p in paths if coordinate in p["coordinates"]])
                encounters.append(e)
                lookup.append(dict(questId=qid, mapId=q["mapId"], sourceHash=summary["sourceHash"],
                                   encounterId=e["id"], coordinate=coordinate, gameId=e["gameId"], name=e["name"],
                                   rarity=e["rarity"], final=e["final"], pathIndices=e["pathIndices"]))
        # These are exact quest-scoped reward definitions, independent of placements.
        fixed = []
        crystals = []
        for scope in ("firstCompletionRewards", "masteryCompletionRewards", "potentialCompletionRewards"):
            for reward in q[scope] or []:
                if reward["Type"] == "hero":
                    fixed.append(dict(scope=scope, quantity=reward["Quantity"], **identity(reward["Data"])))
                elif reward["Type"] == "gs":
                    crystals.append(dict(scope=scope, token=reward["Data"], quantity=reward["Quantity"]))
        assert len(encounters) == checked[qid]["placedEncounters"]
        saved = {(tuple(e["coordinate"]), e["bossTableKey"], e["tierId"], e["championGameId"], e["rarity"]) for e in expected if e["qid"] == qid}
        assert saved == {(tuple(e["coordinate"]), e["bossKey"], e["tierId"], e["gameId"], e["rarity"]) for e in encounters}
        write(f'maps/{qid}.json', dict(version=1, questId=qid, mapId=q["mapId"], sourceHash=summary["sourceHash"],
              capturedAt=at, sourceFile=source_file, gridDimension=m["gridDimension"], adaptive=q["scaleBosses"],
              tiles=tiles, paths=paths, encounters=encounters, rewards=dict(fixedChampions=fixed, possibleCrystals=crystals)))
    write("catalog.json", catalog)
    write("encounters.json", lookup)
    loaders = '\n'.join(f'  {json.dumps(qid)}: () => import("./maps/{qid}.json"),' for qid in sorted(definitions))
    (out / "map-loaders.ts").write_text('// Generated by scripts/game-quests/build_snapshot.py. Server-side only.\nexport const mapLoaders = {\n' + loaders + '\n};\n', encoding="utf-8")
    outputs["map-loaders.ts"] = sha(out / "map-loaders.ts")
    write("manifest.json", dict(version=1, id="game-quests-2026-11-05-v1", gameVersion="59.1.0 / CL 1456141",
          gameAssemblySha256=base["gameAssemblySha256"], inputs=inputs,
          identityEvidence=dict(file="champions.json", sha256=sha(champions_path)),
          labelEvidence=dict(file=bcg_path.name, sha256=sha(bcg_path), schemaSha256=sha(schema_path), policy="Exact current BCG Character._friendlyNameLoc.en; labels only, never identity aliases"),
          evidence=[
              dict(binding="QuestsManager.DB -> QuestDB.AvailableSets -> QuestSet.QuestSummarys/QuestMaps", file="detail-load-evidence.json"),
              dict(binding="QuestBoss.character/blueprint -> BCGBlueprintBase.Blueprint -> Character and Rarity -> Champion.gameId", file="quest-field-binding-evidence.json"),
              dict(binding="QuestMapTile.AddBuffToTile assigns attackerBuffs/defenderBuffs; GetActiveDefenderBuffs further filters runtime state", file="continuation/semantics-evidence.json")],
          outputs=outputs.copy(), totals=validation["totals"],
          policy="Allowlisted game-origin public definitions only; no account, progression, team, inventory or session fields"))
    print(f'Wrote {len(catalog)} summaries, {len(definitions)} maps, {len(lookup)} placements to {out}')

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-root", type=Path, required=True)
    parser.add_argument("--champions", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=REPO / "src/data/game-quests")
    args = parser.parse_args()
    build(args.source_root, args.champions, args.output)
