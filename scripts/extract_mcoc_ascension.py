"""Extract explicit ascension rules from local game definitions, without account data.

Blueprint eligibility and materialized costs are authoritative for this projection.
Global cost templates are retained separately and never grant a player an ascension.
"""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
import gzip
import hashlib
import json
import math
from pathlib import Path

from mcoc_protobuf import Decoder, fields


PLAYABLE_EVENT_REGISTRY = Path(__file__).resolve().parents[1] / "src/data/game-ascension/playable-event-blueprints.json"


def load_playable_event_blueprints():
    registry = json.loads(PLAYABLE_EVENT_REGISTRY.read_text(encoding="utf-8"))
    if set(registry) != {"version", "exceptions"} or registry["version"] != 1:
        raise ValueError("Invalid reviewed ascension event registry")
    result = unique(registry["exceptions"], "id", "reviewed event blueprint")
    for row in result.values():
        if set(row) != {"id", "gameId", "rarity", "userCollection", "isEventCharacter", "rationale", "evidence"}:
            raise ValueError("Invalid reviewed ascension event fields")
        identity(row["gameId"], "reviewed event character"); identity(row["rationale"], "reviewed event rationale")
        if type(row["rarity"]) is not int or not 1 <= row["rarity"] <= 7 or row["userCollection"] is not True or row["isEventCharacter"] is not True:
            raise ValueError("Invalid reviewed ascension event assertions")
        evidence = row["evidence"]
        if set(evidence) != {"auditDocument", "officialReleaseNotes", "bcgSha256"}:
            raise ValueError("Missing reviewed ascension event provenance")
        for key, value in evidence.items(): identity(value, key)
        if not evidence["officialReleaseNotes"].startswith("https://") or len(evidence["bcgSha256"]) != 64 or any(c not in "0123456789abcdef" for c in evidence["bcgSha256"]):
            raise ValueError("Invalid reviewed ascension event provenance")
    return result


def classify_ascension_blueprint(row):
    """Player identity classification only; tiers/costs must still pass validation."""
    if row["userCollection"] is not True: return "excluded"
    if row["isEventCharacter"] is False: return "collectible"
    reviewed = PLAYABLE_EVENT_BLUEPRINTS.get(row["id"])
    keys = ("id", "gameId", "rarity", "userCollection", "isEventCharacter")
    return "verified-playable-event" if reviewed and all(type(row[key]) is type(reviewed[key]) and row[key] == reviewed[key] for key in keys) else "excluded"


def identity(value, label):
    if not isinstance(value, str) or not value or value != value.strip():
        raise ValueError(f"Invalid {label}: {value!r}")
    return value


def unique(rows, field, label):
    result = {}
    for row in rows:
        key = identity(row.get(field), label)
        if key in result: raise ValueError(f"Duplicate {label}: {key}")
        result[key] = row
    return result


PLAYABLE_EVENT_BLUEPRINTS = load_playable_event_blueprints()


def cost_rows(rows):
    output = []
    for row in rows:
        if set(row) - {"Type", "Data", "Quantity"}: raise ValueError(f"Unverified cost fields: {sorted(row)}")
        if row.get("Type") not in {"inv", "res"}: raise ValueError(f"Unknown cost type: {row.get('Type')}")
        quantity = row.get("Quantity")
        if type(quantity) is not int or quantity < 1: raise ValueError(f"Invalid cost quantity: {quantity}")
        output.append({"type": row["Type"], "id": identity(row.get("Data"), "cost ID"), "quantity": quantity})
    return output


def normalize_tier(row):
    allowed = {"Tier", "Cost", "Attack", "Health", "MightGain", "ChallengeRating", "BuffIDs"}
    if set(row) - allowed: raise ValueError(f"Unknown ascension fields: {sorted(set(row) - allowed)}")
    output = {"id": identity(row.get("Tier"), "tier"), "cost": cost_rows(row.get("Cost", []))}
    for source, target in [("Attack", "attackBonus"), ("Health", "healthBonus"), ("MightGain", "mightGain")]:
        value = row.get(source, 0)
        if type(value) not in {int, float} or not math.isfinite(value): raise ValueError(f"Expected finite {source}")
        output[target] = value
    rating = row.get("ChallengeRating", 0)
    if type(rating) is not int: raise ValueError("Non-integer ChallengeRating")
    output["challengeRating"] = rating
    output["buffIds"] = [identity(value, "buff") for value in row.get("BuffIDs", [])]
    return output


def build_catalog(blueprints, characters, tiers, game_store_items):
    by_tier = unique(tiers, "Tier", "tier")
    by_champion = unique(characters, "Character", "character")
    by_blueprint = unique(blueprints, "Blueprint", "blueprint")
    normalized_tiers = [normalize_tier(row) for row in tiers]
    normalized_by_tier = {row["id"]: row for row in normalized_tiers}
    used_tiers, needed_resources = set(), set()
    output = []
    for bid, row in by_blueprint.items():
        game_id = identity(row.get("Character"), "character")
        rarity = row.get("Rarity")
        if type(rarity) is not int or not 1 <= rarity <= 7: raise ValueError(f"Unsupported rarity: {rarity} in {bid}")
        ids = row.get("AscensionTiers", [])
        for tid in ids:
            if tid not in by_tier: raise ValueError(f"Unknown tier: {tid} in {bid}")
        if len(ids) != len(set(ids)): raise ValueError(f"Duplicate eligible tier in {bid}")
        materialized = row.get("EligibleAscensionTiers", [])
        if [tier.get("Tier") for tier in materialized] != ids:
            raise ValueError(f"Eligible tier order differs from declared tier IDs: {bid}")
        steps = []
        for level, raw in enumerate(materialized, 1):
            tier = normalize_tier(raw)
            # Display and combat consumers walk global tier tuning. A future mismatch
            # needs review rather than silently choosing one conflicting modifier set.
            if any(tier[key] != normalized_by_tier[tier["id"]][key] for key in ["attackBonus", "healthBonus", "mightGain", "challengeRating", "buffIds"]):
                raise ValueError(f"Materialized/global modifier mismatch: {bid}/{tier['id']}")
            # Concrete costs must be preserved; global costs contain token placeholders.
            if not tier["cost"]: raise ValueError(f"Missing materialized cost: {bid}/{tier['id']}")
            steps.append({"level": level, "tierId": tier.pop("id"), **tier})
            used_tiers.add(steps[-1]["tierId"])
            needed_resources.update((cost["type"], cost["id"]) for cost in tier["cost"])
        character = by_champion.get(game_id, {})
        name = character.get("_friendlyNameLoc", {}).get("en") or game_id
        output.append({"id": bid, "gameId": game_id, "name": name, "rarity": rarity,
                       "heroClass": row.get("_heroClass"), "userCollection": row.get("UserCollection", False),
                       "isEventCharacter": row.get("IsEventCharacter", False),
                       "eligibleTierIds": ids, "maxRecordedLevel": len(ids), "steps": steps})
    display_by_id = {}
    for item in game_store_items:
        if ("inv", item.get("Name")) not in needed_resources: continue
        projection = {"metadataResolved": True}
        for source, target in [("Title", "name"), ("Description", "description"), ("Enabled", "definitionEnabled"), ("HTags", "usageTags"), ("Rank", "rankRestriction"), ("SigState", "signatureRestriction")]:
            if source in item: projection[target] = item[source]
        reference = item.get("image", {}).get("en")
        if reference: projection["artwork"] = {"reference": reference, "onCdn": item.get("ImageS3", False)}
        if item["Name"] in display_by_id and display_by_id[item["Name"]] != projection:
            raise ValueError(f"Conflicting item metadata: {item['Name']}")
        display_by_id[item["Name"]] = projection
    resources = [{"type": typ, "id": rid, **(display_by_id.get(rid, {"metadataResolved": False}) if typ == "inv" else {"metadataResolved": False})}
                 for typ, rid in sorted(needed_resources)]
    collectible = [row for row in output if classify_ascension_blueprint(row) != "excluded"]
    coverage = {"blueprints": len(output), "collectibleBlueprints": len(collectible), "globalTiers": len(tiers),
                "unboundGlobalTierIds": sorted(by_tier.keys() - used_tiers), "costResources": len(resources),
                "resolvedInventoryResources": sum(row["metadataResolved"] for row in resources),
                "unresolvedInventoryResourceIds": [row["id"] for row in resources if row["type"] == "inv" and not row["metadataResolved"]],
                "collectibleByRarityAndMaxRecordedLevel": dict(sorted(Counter(f"{row['rarity']}:{row['maxRecordedLevel']}" for row in collectible).items()))}
    return {"tiers": normalized_tiers, "blueprints": sorted(output, key=lambda row: row["id"]), "resources": resources, "coverage": coverage}


def read_bytes(path):
    raw = path.read_bytes()
    return gzip.decompress(raw) if path.suffix == ".gz" else raw


def build_public_catalog(catalog):
    blueprints = [row for row in catalog["blueprints"] if classify_ascension_blueprint(row) != "excluded"]
    seen = set()
    for row in blueprints:
        key = (row["gameId"], row["rarity"])
        if key in seen: raise ValueError(f"Conflicting collectible ascension rules: {key}")
        seen.add(key)
    used_tiers = {step["tierId"] for row in blueprints for step in row["steps"]}
    needed_resources = {(cost["type"], cost["id"]) for row in blueprints for step in row["steps"] for cost in step["cost"]}
    tiers = [row for row in catalog["tiers"] if row["id"] in used_tiers]
    if {row["id"] for row in tiers} != used_tiers: raise ValueError("Missing public ascension tier")
    resources = [row for row in catalog["resources"] if (row["type"], row["id"]) in needed_resources]
    if {(row["type"], row["id"]) for row in resources} != needed_resources: raise ValueError("Missing public ascension resource")
    source = catalog["source"]
    def sanitized_file(record):
        if record is None: return None
        return {"fileName": Path(record["path"].replace("\\", "/")).name,
                **{key: record[key] for key in ["sha256", "fileSha256", "bytes", "mtimeUtc"]}}
    return {"version": 1,
            "source": {"observedAt": source["observedAt"], "capturedAt": source["capturedAt"], "bcg": sanitized_file(source["bcg"]),
                       "gameStore": sanitized_file(source["gameStore"]), "metadata": [{"assembly": Path(row["path"].replace("\\", "/")).name, "sha256": row["sha256"]} for row in source["metadata"]],
                       "schemaSha256": source["schemaSha256"]},
            "tiers": tiers, "blueprints": blueprints, "resources": resources,
            "coverage": {"sourceBlueprints": len(catalog["blueprints"]), "excludedBlueprints": len(catalog["blueprints"])-len(blueprints), "blueprints": len(blueprints), "collectibleBlueprints": len(blueprints),
                         "globalTiers": len(tiers), "sourceGlobalTiers": len(catalog["tiers"]), "excludedGlobalTierIds": sorted(row["id"] for row in catalog["tiers"] if row["id"] not in used_tiers), "costResources": len(resources)}}


def limits_module(catalog):
    bounds = {str(rarity): max((row["maxRecordedLevel"] for row in catalog["blueprints"] if row["rarity"] == rarity), default=0) for rarity in range(1, 8)}
    stat_steps = {}
    for rarity in range(1, 8):
        paths = {json.dumps([{"attack": step["attackBonus"], "health": step["healthBonus"]} for step in row["steps"]], separators=(",", ":"))
                 for row in catalog["blueprints"] if row["rarity"] == rarity and row["steps"]}
        # A generic fallback is safe only when all eligible paths agree.
        stat_steps[str(rarity)] = json.loads(next(iter(paths))) if len(paths) == 1 else []
    source = {"observedAt": catalog["source"]["observedAt"], "bcgSha256": catalog["source"]["bcg"]["sha256"]}
    return ("// Generated by scripts/extract_mcoc_ascension.py --public; do not edit.\n"
            "// Generic recorded upper bounds only; champion eligibility requires its rule payload.\n"
            f"export const ASCENSION_BOUNDS_SOURCE = {json.dumps(source, separators=(',', ':'))} as const\n"
            f"const bounds: Readonly<Record<number, number>> = {json.dumps(bounds, separators=(',', ':'))}\n\n"
            f"const statSteps: Readonly<Record<number, readonly {{ attack: number; health: number }}[]>> = {json.dumps(stat_steps, separators=(',', ':'))}\n\n"
            "export function maxRecordedAscensionForRarity(rarity: number | null | undefined): number {\n"
            "  return rarity != null && Number.isInteger(rarity) ? bounds[rarity] ?? 0 : 0\n"
            "}\n\n"
            "export function recordedAscensionStatBonus(rarity: number | null | undefined, level: number, kind: 'attack' | 'health'): number {\n"
            "  if (rarity == null || !Number.isInteger(rarity) || !Number.isFinite(level) || (kind !== 'attack' && kind !== 'health')) return 0\n"
            "  const target = Math.max(0, Math.min(maxRecordedAscensionForRarity(rarity), Math.round(level)))\n"
            "  // Effective bonus from incremental combat steps; no stat rounding here.\n"
            "  return (statSteps[rarity] ?? []).slice(0, target).reduce((multiplier, step) => multiplier * (1 + step[kind]), 1) - 1\n"
            "}\n")


def source_record(path, decoded):
    return {"path": str(path.resolve()), "sha256": hashlib.sha256(decoded).hexdigest(), "fileSha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "bytes": len(decoded), "mtimeUtc": datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat()}


def extract(bcg_path, schema_path, observed_at, game_store_path=None):
    stamp = datetime.fromisoformat(observed_at.replace("Z", "+00:00"))
    if stamp.utcoffset() is None: raise ValueError("observed-at requires a time zone")
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    expected = {"BCGDataBuffer": {3: "heroes_blueprints", 4: "characters", 26: "ascension"},
                "BCGBlueprintBase": {1: "Blueprint", 2: "Character", 14: "Rarity", 37: "AscensionTiers", 38: "EligibleAscensionTiers"},
                "Ascension": {1: "Tier", 2: "Cost", 3: "Attack", 4: "Health", 5: "MightGain", 7: "ChallengeRating"}}
    for typ, members in expected.items():
        actual = {field["tag"]: field["name"] for field in schema["types"][typ]["fields"]}
        if any(actual.get(tag) != name for tag, name in members.items()): raise ValueError(f"Incompatible protobuf contract: {typ}")
    bcg = read_bytes(bcg_path); decoder = Decoder(schema)
    selected = {3: [], 4: [], 26: []}
    types = {3: "BCGBlueprintBase", 4: "BCGCharacterData", 26: "Ascension"}
    for tag, wire, value, _ in fields(bcg):
        if tag in selected:
            if wire != 2: raise ValueError(f"Non-message BCG tag {tag}")
            selected[tag].append(decoder.message(value, types[tag]))
    if not selected[3] or not selected[26]: raise ValueError("Missing blueprint or ascension definitions in BCG source")
    if decoder.unknown: raise ValueError(f"Unrecognized ascension source fields: {decoder.unknown[:10]}")
    store_items = []; store = None
    if game_store_path:
        store = read_bytes(game_store_path)
        data = decoder.message(store, "EB.Sparx.GameStoreDataBuffer")
        if decoder.unknown: raise ValueError(f"Unrecognized game-store fields: {decoder.unknown[:10]}")
        store_items = [item for group in data.get("items", {}).values() for item in group.get("gameStoreItems", [])]
    catalog = build_catalog(selected[3], selected[4], selected[26], store_items)
    return {"version": 1, "source": {"observedAt": observed_at, "capturedAt": datetime.now(timezone.utc).isoformat(),
                                     "bcg": source_record(bcg_path, bcg), "gameStore": source_record(game_store_path, store) if store is not None else None,
                                     "metadata": schema.get("sources", []), "schemaSha256": hashlib.sha256(schema_path.read_bytes()).hexdigest()}, **catalog}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    inputs = parser.add_mutually_exclusive_group(required=True)
    inputs.add_argument("--bcg", type=Path)
    inputs.add_argument("--from-extraction", type=Path, help="Project an existing full normalized extraction without reading game caches")
    parser.add_argument("--schema", type=Path, help="Named schema from export_mcoc_proto_schema.py")
    parser.add_argument("--gamestore", type=Path)
    parser.add_argument("--observed-at", help="Definition observation/capture time, separate from cache file mtime")
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--public", action="store_true", help="Write a collectible-only public catalog with sanitized provenance")
    parser.add_argument("--limits-out", type=Path, help="Also write a tiny client-safe TypeScript rarity bounds module (requires --public)")
    parser.add_argument("--preserve-public-source", type=Path, help="Retain an existing public artifact's provenance after verifying source equality apart from extraction time (requires --from-extraction --public)")
    args = parser.parse_args()
    if args.limits_out and not args.public: parser.error("--limits-out requires --public")
    if args.from_extraction:
        if not args.public: parser.error("--from-extraction requires --public")
        if args.schema or args.observed_at or args.gamestore: parser.error("--from-extraction retains existing source provenance; do not supply fresh source arguments")
        result = json.loads(args.from_extraction.read_text(encoding="utf-8"))
    else:
        if not args.schema or not args.observed_at: parser.error("--bcg requires --schema and --observed-at")
        if args.preserve_public_source: parser.error("--preserve-public-source requires --from-extraction --public")
        result = extract(args.bcg, args.schema, args.observed_at, args.gamestore)
    if args.public: result = build_public_catalog(result)
    if args.preserve_public_source:
        original = json.loads(args.preserve_public_source.read_text(encoding="utf-8"))["source"]
        if {k: v for k, v in original.items() if k != "capturedAt"} != {k: v for k, v in result["source"].items() if k != "capturedAt"}:
            raise ValueError("Cannot preserve provenance from a different ascension source")
        result["source"] = original
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":"), allow_nan=False)+"\n", encoding="utf-8")
    if args.limits_out:
        args.limits_out.parent.mkdir(parents=True, exist_ok=True)
        args.limits_out.write_text(limits_module(result), encoding="utf-8")
    print(json.dumps(result["coverage"], indent=2))


if __name__ == "__main__": main()
