"""Export original chest PNGs from frozen quest definitions and installed static packs.

Entirely offline: no game, process, account, session, database or network access.
The native LoadChestSprite method supplies the exact chests/{asset} resource key.
Original PNG bytes are retained without rendering, cropping or recoloring.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path
import re

from PIL import Image

from build_source_art import local_pack_reference

REPO = Path(__file__).resolve().parents[2]
NATIVE_ROOT = Path("D:/CodexArtifacts/Cpp2IL-2026-11-03/IsilDump")
NATIVE_SOURCES = {
    "Marvel.Runtime/QuestChestEntity.txt": "0d0bd91838ca6c7ea9eb0f07f9384918526a45f7f7a2791fd22d665324e21a5b",
    "Kabam.OldAssetRuntime/EB/FileSystem/PackDriver.txt": "8348d69de6df2ee6ff59c809181b03a1ec7b2731ce8286493a2c585a82c7b8cf",
}
FROZEN_SOURCES_SHA256 = "956339b02c84c2c98b3d6951c010a230c741f18e0ddf82435db4ff21fe30d75d"


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)


def escaped(value):
    return value.replace("~", "~0").replace("/", "~1")


def resolve_reference(asset):
    if not isinstance(asset, str) or not re.fullmatch(r"object_chest_[a-z0-9_]+", asset):
        raise ValueError("Unsupported exact native chest asset token")
    return "chests/" + asset


def collect_definitions(sources):
    """Read only the pinned source pointer's authored chest dictionary."""
    quests, bindings = {}, {}
    grouped = {}
    for row in sources:
        grouped.setdefault(row["sourceFile"], []).append(row)
    for filename, rows in sorted(grouped.items()):
        raw = Path(filename).read_bytes()
        source_sha = digest(raw)
        if any(row["sourceSha256"] != source_sha for row in rows):
            raise ValueError("Frozen chest source hash drift: " + filename)
        document = json.loads(raw)
        for row in sorted(rows, key=lambda item: item["questId"]):
            quest = document
            for component in row["pointer"].strip("/").split("/"):
                key = component.replace("~1", "/").replace("~0", "~")
                quest = quest[int(key)] if isinstance(quest, list) else quest[key]
            quest_id = row["questId"]
            if quest_id in quests or quest.get("qid") != quest_id:
                raise ValueError("Ambiguous frozen quest identity: " + quest_id)
            chests = quest.get("chests") or {}
            if not isinstance(chests, dict):
                raise ValueError("Unexpected native chest dictionary: " + quest_id)
            # Machine-specific input locations stay in the ignored source audit.
            quests[quest_id] = {"sourceSha256": source_sha, "pointer": row["pointer"], "chests": chests}
            for chest_id, asset in sorted(chests.items()):
                resolve_reference(asset)
                bindings.setdefault(asset, []).append({
                    "questId": quest_id, "chestId": chest_id, "sourceSha256": source_sha,
                    "pointer": row["pointer"] + "/chests/" + escaped(chest_id),
                })
    return quests, bindings


def png_info(raw):
    if len(raw) > 8 * 1024 * 1024 or not raw.startswith(b"\x89PNG\r\n\x1a\n"):
        raise ValueError("Expected bounded native PNG bytes")
    with Image.open(io.BytesIO(raw)) as image:
        if image.format != "PNG" or image.n_frames != 1 or not 1 <= image.width <= 4096 or not 1 <= image.height <= 4096:
            raise ValueError("Unsupported native chest PNG")
        rgba = image.convert("RGBA")
        return {"sha256": digest(raw), "rgbaSha256": digest(rgba.tobytes()),
                "width": image.width, "height": image.height, "byteLength": len(raw)}


def build(args):
    audit = json.loads(args.audit.read_bytes())
    sources = sorted(audit["sources"], key=lambda row: row["questId"])
    sources_sha = digest(canonical(sources).encode("utf-8"))
    if len(sources) != 234 or sources_sha != FROZEN_SOURCES_SHA256:
        raise ValueError("Frozen 234-map chest source set changed")
    for relative, expected in NATIVE_SOURCES.items():
        if digest((args.native_root / relative).read_bytes()) != expected:
            raise ValueError("Native chest loader source changed: " + relative)
    quests, bindings = collect_definitions(sources)
    assets, unresolved, payloads = {}, [], {}
    for asset, definitions in sorted(bindings.items()):
        reference = resolve_reference(asset)
        native = local_pack_reference(reference, args.resources)
        if native is None:
            unresolved.append({"asset": asset, "reference": reference, "reason": "Exact native pack PNG unavailable or ambiguous"})
            continue
        path, provenance = native
        raw = path.read_bytes()
        info = png_info(raw)
        image_url = "/game-quests/chest-art/" + info["sha256"] + ".png"
        assets[asset] = {"imageUrl": image_url, "reference": reference, **info,
                         "origin": "exact-native-pack-file", "nativePack": provenance,
                         "definitionBindings": sorted(definitions, key=lambda row: (row["questId"], row["chestId"]))}
        payloads[info["sha256"] + ".png"] = raw
    result = {
        "version": 1,
        "policy": "Exact frozen QuestSummary.chests asset -> QuestChestEntity.LoadChestSprite 'chests/' + asset -> exact native pack file. Original complete PNG bytes; no aliases, guesses, rendering, crops or recoloring.",
        "source": {"frozenSourcesSha256": sources_sha, "mapCount": len(sources),
                   "exporterSha256": digest(Path(__file__).read_bytes()),
                   "packResolverSha256": digest((Path(__file__).parent / "build_source_art.py").read_bytes()),
                   "nativeSources": NATIVE_SOURCES,
                   "loaderMethod": "QuestChestEntity.LoadChestSprite(System.String assetName)",
                   "loaderBinding": "String.Concat('chests/', assetName) -> TexturePoolManager.LoadTexture",
                   "packBinding": "PackDriver.Exists FindOptions=3: exact path, ignore extension, ordinal-ignore-case"},
        "quests": quests, "assets": assets, "unresolved": unresolved,
    }
    encoded = (canonical(result) + "\n").encode("utf-8")
    if args.check:
        if args.output.read_bytes() != encoded:
            raise ValueError("Chest artwork manifest drift")
        for name, raw in payloads.items():
            if (args.assets / name).read_bytes() != raw:
                raise ValueError("Original chest artwork bytes changed: " + name)
    else:
        args.assets.mkdir(parents=True, exist_ok=True)
        for name, raw in payloads.items():
            destination = args.assets / name
            if destination.exists() and destination.read_bytes() != raw:
                raise ValueError("Immutable chest artwork collision: " + name)
            if not destination.exists():
                destination.write_bytes(raw)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_bytes(encoded)
    print(f"{'Verified' if args.check else 'Exported'} {len(assets)} exact native chest PNG bindings across {len(quests)} frozen maps; unresolved {len(unresolved)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--audit", type=Path, default=REPO / "temp/quest-map-features-20261118/expanded-source-audit.json")
    parser.add_argument("--native-root", type=Path, default=NATIVE_ROOT)
    parser.add_argument("--resources", type=Path, default=Path("C:/Games/Marvel Contest of Champions/default/game/Champions_Data/Resources/Data"))
    parser.add_argument("--output", type=Path, default=REPO / "src/data/game-quests/chest-artwork.json")
    parser.add_argument("--assets", type=Path, default=REPO / "web/public/game-quests/chest-art")
    parser.add_argument("--check", action="store_true", help="Reproduce and verify without writing anything")
    build(parser.parse_args())
