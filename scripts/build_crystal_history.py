"""Record hash-pinned crystal observations, without inventing release dates.

The Nov3 champion catalog and Nov5 all-reward catalog share only a limited
definition projection. New prices, odds, quantities and item rewards must not
be reported as historical changes when the older schema never exported them.
"""
import argparse
import copy
from datetime import datetime
import hashlib
import json
from pathlib import Path
import re

PROJECTION = "champion-catalog-common-v1"


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()


def indexed(rows, label):
    result = {}
    for row in rows:
        key = row.get("id")
        if not isinstance(key, str) or not key or key in result: raise ValueError(f"Invalid/duplicate {label}: {key}")
        result[key] = row
    return result


def snapshot(document, input_sha256=None):
    source = document["source"]
    observed = datetime.fromisoformat(source["observedAt"].replace("Z", "+00:00"))
    if observed.utcoffset() is None: raise ValueError("Observation requires timezone")
    if not re.fullmatch(r"[a-f0-9]{64}", source["gachaSha256"]): raise ValueError("Invalid gacha source hash")
    legacy = "pools" in document
    categories = indexed(document["pools"] if legacy else document["categories"], "category")
    projections = {}
    for cid, crystal in indexed(document["crystals"], "crystal").items():
        rewards = []
        for category_id in sorted(set(crystal["categoryIds"])):
            if category_id not in categories: raise ValueError(f"Unknown category: {category_id}")
            category = categories[category_id]
            if legacy:
                heroes = set(category["heroTierIds"])
                cosmetics = set()
                for item in category.get("heroCosmeticRewards", []):
                    if item["cosmeticId"] != "first_edition" or item["sourceData"] != f"{item['tierId']}|first_edition" or item["tierId"] not in heroes:
                        raise ValueError("Unverified legacy cosmetic binding")
                    cosmetics.add(item["sourceData"])
            else:
                heroes, cosmetics = set(), set()
                for item in category["rewards"]:
                    if item["type"] == "hero":
                        if "|" in item["data"]: raise ValueError("Unverified hero identity")
                        heroes.add(item["data"])
                    elif item["type"] == "hcos":
                        parts = item["data"].split("|")
                        if len(parts) != 2 or not parts[0] or parts[1] != "first_edition": raise ValueError("Unverified cosmetic binding")
                        heroes.add(parts[0]); cosmetics.add(item["data"])
            rewards.append({"categoryId": category_id, "heroTierIds": sorted(heroes), "firstEditionBindings": sorted(cosmetics)})
        projections[cid] = {"name": crystal["name"], "sourceGroup": crystal["group"] if legacy else crystal["sourceGroup"],
                            "sourceSet": crystal["set"] if legacy else crystal["sourceSet"],
                            "categoryIds": sorted(set(crystal["categoryIds"])), "directChampionRewards": rewards}
    manifest = [{"sourceId": cid, "projectionSha256": digest(value)} for cid, value in sorted(projections.items())]
    observation = {"observedAt": source["observedAt"], "gachaSha256": source["gachaSha256"], "inputSha256": input_sha256 or digest(document),
                   "projectionSha256": digest(manifest), "definitionCount": len(projections), "inputFormat": "champion-catalog-v1" if legacy else "all-rewards-v1"}
    return observation, projections


def build_history(previous, current, previous_history=None, previous_input_sha256=None, current_input_sha256=None):
    before, previous_rows = snapshot(previous, previous_input_sha256)
    after, current_rows = snapshot(current, current_input_sha256)
    if datetime.fromisoformat(after["observedAt"].replace("Z", "+00:00")) <= datetime.fromisoformat(before["observedAt"].replace("Z", "+00:00")):
        raise ValueError("Current observation must be later than previous observation")
    if previous_history:
        result = copy.deepcopy(previous_history)
        latest = result["observations"][-1]
        if result["version"] != 1 or result["projection"] != PROJECTION or any(latest[key] != before[key] for key in ["observedAt", "gachaSha256", "projectionSha256", "definitionCount"]):
            raise ValueError("Previous snapshot does not extend the retained history chain")
    else:
        result = {"version": 1, "projection": PROJECTION, "observations": [before], "baselineSourceIds": sorted(previous_rows), "transitions": []}
    changed = []
    for cid in sorted(previous_rows.keys() & current_rows.keys()):
        fields = sorted(key for key in previous_rows[cid] if previous_rows[cid][key] != current_rows[cid][key])
        if fields: changed.append({"sourceId": cid, "fields": fields, "previousProjectionSha256": digest(previous_rows[cid]), "projectionSha256": digest(current_rows[cid])})
    result["transitions"].append({"from": len(result["observations"])-1, "to": len(result["observations"]), "addedSourceIds": sorted(current_rows.keys()-previous_rows.keys()),
                                   "removedSourceIds": sorted(previous_rows.keys()-current_rows.keys()), "changed": changed})
    result["observations"].append(after)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--previous", type=Path, required=True)
    parser.add_argument("--current", type=Path, required=True)
    parser.add_argument("--previous-history", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    previous_bytes, current_bytes = args.previous.read_bytes(), args.current.read_bytes()
    prior = json.loads(args.previous_history.read_text(encoding="utf8")) if args.previous_history else None
    result = build_history(json.loads(previous_bytes), json.loads(current_bytes), prior, hashlib.sha256(previous_bytes).hexdigest(), hashlib.sha256(current_bytes).hexdigest())
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":"))+"\n", encoding="utf8")
    latest = result["transitions"][-1]
    print(json.dumps({"observations": len(result["observations"]), "previousDefinitions": result["observations"][-2]["definitionCount"], "currentDefinitions": result["observations"][-1]["definitionCount"],
                      "added": len(latest["addedSourceIds"]), "removed": len(latest["removedSourceIds"]), "changed": len(latest["changed"]), "addedSourceIds": latest["addedSourceIds"]}, indent=2))


if __name__ == "__main__": main()
