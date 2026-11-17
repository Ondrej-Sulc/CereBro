"""Build the finite native NPC/legacy catalog from pinned offline public definitions.

No database connection, game process, account reader or network is used. New
records have no asserted release date, obtainability, or fabricated combat kit.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import hashlib
import io
import json
from pathlib import Path
import re
import sys

REPO = Path(__file__).resolve().parents[2]
RESEARCH = REPO / "temp/npc-champions-20261117"
OUTPUT = REPO / "src/data/game-champions/native-specials.json"
ASSETS = REPO / "web/public/game-champions/native-art"
RESOURCES = Path("C:/Games/Marvel Contest of Champions/default/game/Champions_Data/Resources/Data")
BCG = REPO / "temp/quest-data-investigation/game-only/sources/bcg-E95E28EECECC04D6A358C8FD8089D01305D0FB73.bin"
CHARACTERS = REPO / "temp/ascension-investigation/BCGCharacterData.json"
BLUEPRINTS = REPO / "temp/quest-data-investigation/game-only/current-blueprints.json"
SCHEMA = REPO / "temp/crystals/schema.json"
DESCRIPTIONS = REPO / "scratch/post-game-update-2026-10-07/champions.json"
TEMPLATE_REVIEW = REPO / "scratch/pre-game-update-2026-10-07/make_collectable_base_catalog.py"
PINS = {
    "bcgSha256": "b821489b5451d1d6ee0927f39a80d964f6c1d3aaf13bd76531e5f77d93deba8e",
    "schemaSha256": "9cc5236aef043cf7e5655458e790ed1f0897f67398e37af3020bca74511e97c4",
    "charactersSha256": "2cb672481fd2222f684ae64f0494bb398f61ea5c5d6e0448b43c0fdd772a10c1",
    "blueprintsSha256": "2059a0b12ab54b3a582a60371dbc10b9e24b966ae202e6ee8127d464effb2313",
    "descriptionsSha256": "eb6d18a5d0b9c22db6d8969c0008f28ed6520b0b08f3cbc2c15e5049145f5829",
    "packManifestSha256": "0baf2b2a75789331ce0cbc7e4062bcd9867387fe0b2218f7463adc34b338740d",
    "reviewedTemplateRegistrySha256": "bf72dc4f42f7022dd579ca459ca99b4d0bccdabb501a2e7b89272f67100e3bb2",
    "betaInventorySha256": "7bff2ef15e7073ccd1e573800c90b3ceab0ee4832536dc68562ea4c3dcc625be",
    "betaAbilityEvidenceSha256": "516ba8557c89d8f00128499215141a2bc6959f4b16eeeb8eacaaac29e8a81bb0",
    "productionInventorySha256": "294d5ad05f5b9bdbbc0b7929da5dcacd4ddba536429a84c018e0982fb9d428c4",
    "productionAbilityEvidenceSha256": "e17f864da91c72acd74ae377d42e5cf09913689e03f0e59e30dff4d216d251df",
    "nativeAuditSha256": "ee1638d0ec5f46599fc0f54e2db15ed8ccf5740165c492fbce9cffd0b96a287e",
    "existingPermanentPortraitsSha256": "bc2a6691b712b8cb30086a4009396a173950f9f20538dc7aebd44f3e10899cd2",
    "existingProgressedPortraitsSha256": "c55f6f76fdb224a3db3a1d353d06cb232d7ba4cad3b4f1bf1cf9a684872bf1af",
}
CLASS = {"chemical": "SCIENCE", "mystic": "MYSTIC", "cosmic": "COSMIC", "trained": "SKILL",
         "mutant": "MUTANT", "tech": "TECH", "superior": "SUPERIOR"}
# These five exact native families were reviewed as non-roster class templates
# in the pinned historical collectable-catalog helper. Their collection flag is
# retained, not silently rewritten into evidence of player playability.
NPC_PREFIXES = ("antivenomoid_", "doombot_", "hnchpl_", "sentinelbot_", "symbioid_")
PLACEHOLDERS = {"comingsoon", "comingsoon2", "comingsoon3", "comingsoon4", "revealedsoon", "revealedsoon2"}
ROLE_HOLDS = {
    "tuning_normal": "Native label TUNING NORMAL (SHORT SPECIALS), Deadpool_Classic model, no exported abilities.",
    "striker": "Native AttributeBaseType striker, Deadpool_Classic model, no exported abilities.",
    "howardfrontend": "Native ModelID Howard_Frontend; no exported abilities.",
    "jessicajones": "Native ModelID JessicaJones_Frontend; no exported abilities.",
    "venomtheduckfrontend": "Native ModelID VenomTheDuck_Frontend; no exported abilities.",
}
REPAIRS = {798: "collector_blackorder", 799: "ares", 800: "glykhan", 801: "bahamet", 802: "cerastes",
           803: "scytalis", 807: "carina_chronoserpent", 809: "grandmaster_blackorder"}
REVIEWED = {**REPAIRS, 826: "chronoserpent"}
EXPECTED_ROWS = {798: 21, 799: 73, 800: 79, 801: 67, 802: 64, 803: 50, 807: 43, 809: 85, 826: 56}


def read(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def digest(data):
    return hashlib.sha256(data).hexdigest()


def sha(path):
    return digest(Path(path).read_bytes())


def require(condition, message):
    if not condition:
        raise ValueError(message)


def pinned(path, expected):
    require(sha(path) == expected, "Source hash drift: " + str(path))
    return read(path)


def unique(rows, key):
    result = {}
    for row in rows:
        value = row[key]
        require(isinstance(value, str) and value and value == value.strip(), "Invalid exact identity")
        require(value not in result, "Duplicate exact identity: " + value)
        result[value] = row
    return result


def project_definitions(characters, blueprints, champions, repairs=REPAIRS):
    chars = unique(characters, "Character")
    unique(blueprints, "Blueprint")
    by = defaultdict(list)
    for blueprint in blueprints:
        require(blueprint["Character"] in chars, "Missing exact Character definition")
        by[blueprint["Character"]].append(blueprint)
    existing = {row["gameId"]: row for row in champions if row.get("gameId")}
    require(len(existing) == sum(bool(row.get("gameId")) for row in champions), "Duplicate existing gameId")
    by_id = {row["id"]: row for row in champions}
    for cid, gid in repairs.items():
        require(cid in by_id and by_id[cid].get("gameId") in (None, gid), "Reviewed existing identity drift")
        require(gid not in existing or existing[gid]["id"] == cid, "Reviewed identity already belongs to another champion")
        existing[gid] = by_id[cid]
    selected = {gid for gid, rows in by.items() if not any(row.get("UserCollection", False) for row in rows)
                or gid.startswith(NPC_PREFIXES)} - ROLE_HOLDS.keys() - PLACEHOLDERS
    names = Counter(chars[gid]["_friendlyNameLoc"]["en"].casefold() for gid in selected)
    existing_names = {row["name"].casefold() for row in champions}
    slug_owners = {row["slug"]: row.get("gameId") for row in champions if row.get("slug")}
    rows = []
    for gid in sorted(selected):
        char = chars[gid]
        native_name = char["_friendlyNameLoc"]["en"]
        classes = {row.get("_heroClass") for row in by[gid]}
        require(len(classes) == 1 and next(iter(classes)) in CLASS, "Missing/conflicting native class: " + gid)
        source_class = next(iter(classes))
        old = existing.get(gid)
        if old and "class" in old:
            require(old["class"] == CLASS[source_class], "Existing native class mismatch: " + gid)
        collision = names[native_name.casefold()] > 1 or native_name.casefold() in existing_names
        name = old["name"] if old else native_name + (f" [{gid}]" if collision else "")
        slug = old["slug"] if old else "npc-" + gid.replace("_", "-")
        require(bool(slug), "Existing champion has no preserved slug")
        require(old is not None or slug not in slug_owners, "Existing slug collision: " + slug)
        slug_owners[slug] = gid
        require(all(type(row["Rarity"]) is int and 1 <= row["Rarity"] <= 7 for row in by[gid]), "Invalid native rarity")
        rows.append({"gameId": gid, "nativeName": native_name, "name": name, "slug": slug, "class": CLASS[source_class],
                     "nativeRarities": sorted({row["Rarity"] for row in by[gid]}), "isLegacy": "(LEGACY)" in native_name,
                     "sourceCategory": "reviewed-npc-template" if gid.startswith(NPC_PREFIXES) and any(b.get("UserCollection", False) for b in by[gid]) else "noncollection",
                     "sourceBlueprints": [{"id": row["Blueprint"], "rarity": row["Rarity"],
                                           "userCollection": row.get("UserCollection", False),
                                           "isEventCharacter": row.get("IsEventCharacter", False)}
                                          for row in sorted(by[gid], key=lambda row: row["Blueprint"])],
                     "releaseDate": None,
                     "existingChampion": {key: old[key] for key in ("id", "gameId", "isPlayable", "name", "slug")} if old else None,
                     "identityEvidence": None, "portrait": None})
    require(len({row["name"].casefold() for row in rows}) == len(rows), "Projected name collision")
    require(len({row["slug"] for row in rows}) == len(rows), "Projected slug collision")
    exclusions = []
    for gid, char in sorted(chars.items()):
        reason = "no-blueprint-class" if gid not in by else "source-role-review" if gid in ROLE_HOLDS else "native-placeholder" if gid in PLACEHOLDERS else None
        if reason:
            exclusions.append({"gameId": gid, "nativeName": char["_friendlyNameLoc"]["en"], "reason": reason,
                               "sourceModelId": char.get("ModelID"), "detail": ROLE_HOLDS.get(gid)})
    return rows, exclusions


def description_records(champion):
    rows = []
    def add(source_id, group, raw):
        if raw and raw.strip():
            rows.append({"sourceId": source_id, "group": group, "sortOrder": len(rows), "raw": raw.strip()})
    add("bio", "bio", champion.get("bio"))
    for index, ability in enumerate(champion.get("base_abilities", [])):
        group = ability.get("group") or "base"
        group = group if re.fullmatch(r"[a-z][a-z0-9_-]*", group, re.I) else "base"
        add(f"{group}:{index + 1}", group, ability.get("description"))
    signatures = champion.get("sig_abilities") or ([champion["sig_ability"]] if champion.get("sig_ability") else [])
    for index, ability in enumerate(signatures):
        add("signature" if index == 0 else f"signature:{index + 1}", "signature", ability.get("description"))
    for index, attack in enumerate(champion.get("special_attacks", [])):
        add(f"special:{index + 1}", "special", attack.get("description"))
    return rows


def verify_identity_evidence(descriptions, evidence, reviewed=REVIEWED):
    projected = {gid: description_records(champion) for gid, champion in descriptions.items()}
    grouped = defaultdict(list)
    for row in evidence:
        grouped[row["championId"]].append(row)
    result = {}
    for cid, gid in reviewed.items():
        rows = [{key: row[key] for key in ("sourceId", "group", "sortOrder", "raw")}
                for row in sorted(grouped[cid], key=lambda row: row["sortOrder"])]
        matches = [source_id for source_id, source_rows in projected.items() if source_rows == rows]
        require(rows and matches == [gid], "Reviewed ability identity mismatch: " + str(cid))
        result[cid] = {"rows": len(rows), "orderedRecordsSha256": digest(json.dumps(rows, ensure_ascii=False, separators=(",", ":")).encode())}
    return result


def native_portraits(resources, characters, game_ids):
    manifest = pinned(resources / "packs.txt", PINS["packManifestSha256"])
    keys = {Path("portraits/portrait_" + characters[gid]["_imgID"]).with_suffix("").as_posix().lower() for gid in game_ids}
    index = defaultdict(list)
    for pack, entry in manifest["packs"].items():
        if not pack.startswith("ui_portraits"):
            continue
        toc = resources / entry["path"] / "toc.txt"
        if not toc.is_file():
            continue
        raw = toc.read_bytes()
        for path in json.loads(raw).get("files", []):
            key = Path(path).with_suffix("").as_posix().lower()
            if key not in keys:
                continue
            file = resources / entry["path"] / path
            require(file.resolve().is_relative_to(resources.resolve()), "Native asset path escaped resource root")
            if file.is_file():
                index[key].append((file, {"pack": pack, "path": path, "packManifestSha256": PINS["packManifestSha256"],
                                         "tocSha256": digest(raw), "binding": "PackDriver.Exists FindOptions=3: exact path, ignore extension, ordinal-ignore-case"}))
    require(all(len(matches) == 1 for matches in index.values()), "Ambiguous native portrait pack membership")
    audit = pinned(RESEARCH / "native-source-audit.json", PINS["nativeAuditSha256"])
    reviewed = {row["gameId"]: row["portrait"]["native"] for row in audit["candidates"]}
    for gid in game_ids:
        key = Path("portraits/portrait_" + characters[gid]["_imgID"]).with_suffix("").as_posix().lower()
        matches = index.get(key, [])
        expected = reviewed[gid]
        require(bool(matches) == bool(expected), "Reviewed portrait availability drift: " + gid)
        if expected:
            file, proof = matches[0]
            require(sha(file) == expected["sha256"] and proof["pack"] == expected["pack"]
                    and proof["path"] == expected["logicalPath"] and proof["tocSha256"] == expected["tocSha256"],
                    "Reviewed portrait source drift: " + gid)
    return index


def export_portrait(gid, char, index, previous, assets):
    from PIL import Image
    require(not char.get("_s3ImgID", False), "Unreviewed remote portrait")
    matches = index.get(Path("portraits/portrait_" + char["_imgID"]).with_suffix("").as_posix().lower(), [])
    if not matches:
        return None
    file, proof = matches[0]
    source_sha = sha(file)
    old = previous.get(gid)
    if old:
        require(old["character"] == gid and old["imageId"] == char["_imgID"]
                and old["sourceBcgSha256"] == PINS["bcgSha256"] and old["sourceSha256"] == source_sha,
                "Existing exact native portrait drift: " + gid)
        require(sha(REPO / "web/public" / old["url"].lstrip("/")) == old["sha256"], "Existing portrait byte drift")
        url, image_sha = old["url"], old["sha256"]
    else:
        with Image.open(file) as image:
            buffer = io.BytesIO()
            image.save(buffer, "WEBP", lossless=True, exact=True, method=6)
            data = buffer.getvalue()
            with Image.open(io.BytesIO(data)) as replay:
                require(image.size == replay.size and image.convert("RGBA").tobytes() == replay.convert("RGBA").tobytes(),
                        "Native portrait pixel mismatch")
        image_sha = digest(data)
        assets.mkdir(parents=True, exist_ok=True)
        target = assets / (image_sha + ".webp")
        require(not target.exists() or target.read_bytes() == data, "Existing content-addressed asset differs")
        target.write_bytes(data)
        url = "/game-champions/native-art/" + target.name
    return {"url": url, "sha256": image_sha, "sourceSha256": source_sha, "imageId": char["_imgID"],
            "sourceBcgSha256": PINS["bcgSha256"], "nativePack": proof}


def check_public(path):
    data = read(path)
    require(data["version"] == 1 and all(data["source"][key] == value for key, value in PINS.items()), "Public source pin drift")
    rows = data["champions"]
    require(len(rows) == 306 and len({row["gameId"] for row in rows}) == len(rows), "Public finite identity coverage drift")
    require(len({row["name"].casefold() for row in rows}) == len(rows) and len({row["slug"] for row in rows}) == len(rows), "Public identity collision")
    for row in rows:
        require(row["releaseDate"] is None and "obtainable" not in row and "fullAbilities" not in row, "Unestablished native assertion")
        require(row["class"] in CLASS.values() and row["sourceBlueprints"], "Public class/blueprint evidence missing")
        if row["portrait"]:
            art = row["portrait"]
            require(art["sourceBcgSha256"] == PINS["bcgSha256"] and art["nativePack"]["packManifestSha256"] == PINS["packManifestSha256"], "Portrait source identity drift")
            require(art["url"].startswith(("/game-champions/native-art/", "/game-quests/permanent-art/", "/game-quests/progressed-art/")) and ".." not in art["url"], "Unexpected public art path")
            require(sha(REPO / "web/public" / art["url"].lstrip("/")) == art["sha256"], "Published portrait bytes differ")
    expected = {"catalogCharacters": len(rows), "existingCharacters": sum(row["existingChampion"] is not None for row in rows),
                "newCharacters": sum(row["existingChampion"] is None for row in rows), "legacyCharacters": sum(row["isLegacy"] for row in rows),
                "portraitBound": sum(row["portrait"] is not None for row in rows), "portraitUnresolved": sum(row["portrait"] is None for row in rows)}
    require(all(data["coverage"][key] == value for key, value in expected.items()), "Public coverage drift")
    require(Counter(row["reason"] for row in data["exclusions"]) == {"no-blueprint-class": 80, "source-role-review": 5, "native-placeholder": 6}, "Exclusion scope drift")
    return data


def build(args):
    chars = pinned(CHARACTERS, PINS["charactersSha256"])
    blueprints = pinned(BLUEPRINTS, PINS["blueprintsSha256"])
    descriptions = pinned(DESCRIPTIONS, PINS["descriptionsSha256"])
    require(sha(TEMPLATE_REVIEW) == PINS["reviewedTemplateRegistrySha256"], "Reviewed NPC template registry drift")
    schema = pinned(SCHEMA, PINS["schemaSha256"])
    require(sha(BCG) == PINS["bcgSha256"], "Frozen BCG drift")
    sys.path.insert(0, str(REPO / "scripts"))
    from mcoc_protobuf import Decoder, fields
    decoder = Decoder(schema)
    decoded = {3: [], 4: []}
    for tag, _, value, _ in fields(BCG.read_bytes()):
        if tag in decoded:
            decoded[tag].append(decoder.message(value, "BCGBlueprintBase" if tag == 3 else "BCGCharacterData"))
    require(not decoder.unknown and decoded[3] == blueprints and decoded[4] == chars, "Frozen extracted identity drift")
    inventories = {env: pinned(RESEARCH / f"{env}-inventory.json", PINS[f"{env}InventorySha256"]) for env in ("beta", "production")}
    proofs = {env: verify_identity_evidence(descriptions, pinned(RESEARCH / f"{env}-ability-evidence.json", PINS[f"{env}AbilityEvidenceSha256"])["rows"]) for env in inventories}
    require(proofs["beta"] == proofs["production"], "Reviewed identity differs between environments")
    require(all(proofs["beta"][cid]["rows"] == count for cid, count in EXPECTED_ROWS.items()), "Reviewed ability coverage drift")
    rows, exclusions = project_definitions(chars, blueprints, inventories["beta"]["champions"])
    other, other_exclusions = project_definitions(chars, blueprints, inventories["production"]["champions"])
    require(rows == other and exclusions == other_exclusions, "Public identity differs between environments")
    previous = {}
    for name, pin in (("permanent", "existingPermanentPortraitsSha256"), ("progressed", "existingProgressedPortraitsSha256")):
        previous.update(pinned(REPO / f"src/data/game-quests/{name}.json", PINS[pin])["nativePortraits"])
    by_id = unique(chars, "Character")
    index = native_portraits(args.resources, by_id, [row["gameId"] for row in rows])
    for row in rows:
        row["portrait"] = export_portrait(row["gameId"], by_id[row["gameId"]], index, previous, args.assets)
        if row["existingChampion"]:
            row["identityEvidence"] = proofs["beta"][row["existingChampion"]["id"]]
    source = dict(PINS)
    coverage = {"sourceCharacters": len(chars), "sourceBlueprints": len(blueprints), "noncollectionCharacters": 281,
                "reviewedNpcTemplates": 30, "catalogCharacters": len(rows), "existingCharacters": sum(row["existingChampion"] is not None for row in rows),
                "newCharacters": sum(row["existingChampion"] is None for row in rows), "legacyCharacters": sum(row["isLegacy"] for row in rows),
                "portraitBound": sum(row["portrait"] is not None for row in rows), "portraitUnresolved": sum(row["portrait"] is None for row in rows)}
    require(coverage["catalogCharacters"] == 306 and coverage["existingCharacters"] == 9 and coverage["newCharacters"] == 297, "Finite candidate scope drift")
    data = {"version": 1, "source": source, "coverage": coverage, "policy": {
        "identity": "Exact BCGBlueprintBase.Character to BCGCharacterData.Character; reviewed existing IDs require a unique complete ordered ability-text match.",
        "releaseDate": "Native source does not establish a release date. Preserve existing database dates; new records use null.",
        "rarities": "Recorded blueprint rarities are not player obtainability.",
        "existingRecords": "Preserve existing IDs, names, slugs, dates, images, descriptions and relations. Repair only reviewed gameId and incorrect playable classification.",
        "portraits": "Exact native image ID and unique pinned pack membership; unavailable images remain null.",
        "classification": "Catalog membership is NPC/legacy review scope, not evidence of a currently accessible encounter."},
        "champions": rows, "exclusions": exclusions}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    check_public(args.output)
    print(json.dumps({"catalog": str(args.output), "sha256": sha(args.output), "coverage": coverage}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify published metadata/assets offline without frozen source files")
    parser.add_argument("--resources", type=Path, default=RESOURCES)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument("--assets", type=Path, default=ASSETS)
    args = parser.parse_args()
    if args.check:
        data = check_public(args.output)
        print(json.dumps(data["coverage"]))
    else:
        build(args)
