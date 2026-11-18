"""Project four exact, unchanged native portal sprite exports for decorative use.

Entirely offline. Reads only the retained public artwork index/blobs and installed
static Unity resources. The read-only SQLite index is not an application database.
No game process, account, session, network, image editing or ring rasterization.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path
import sqlite3

from PIL import Image

REPO = Path(__file__).resolve().parents[2]
QUEST_BUNDLE = "Resources/Data/quest_odr/quest.assetbundle"
QUEST_SHA256 = "9cd3dc64c5fc5677dc8ba01d285fbd7e554a483aa9a3c8a31cb8465dcbe2ff85"
SPECS = {
    "entranceHalf": {
        "name": "Portal_Entrance_Ring_Half", "width": 170, "height": 340,
        "sha256": "0ff9acb158b053c92cf8c8deb3278d3b50d05a6f5235a5ffabae54771528d1a7",
        "sourcePath": QUEST_BUNDLE, "sourceSha256": QUEST_SHA256,
        "pack": "quest_odr", "bundle": "quest",
        "orientation": {"canvas": "left-half", "pivot": [170, 170], "fullSize": [340, 340]},
    },
    "summoningQuarter": {
        "name": "Portal_Summoning_Ring_Quarter", "width": 114, "height": 114,
        "sha256": "3e83937e74e058e52d88aa52ecc1bb5c5139a31fb75e36028a9e21ccc9314790",
        "sourcePath": QUEST_BUNDLE, "sourceSha256": QUEST_SHA256,
        "pack": "quest_odr", "bundle": "quest",
        "orientation": {"canvas": "upper-right-quarter", "pivot": [0, 114], "fullSize": [228, 228]},
    },
    "exitQuarter": {
        "name": "Portal_ExitRing_White_Quarter", "width": 114, "height": 114,
        "sha256": "b0b621790a4f19d6dc17a306ae893e697edab2b16807e94abc5e97fd5b64e17b",
        "sourcePath": QUEST_BUNDLE, "sourceSha256": QUEST_SHA256,
        "pack": "quest_odr", "bundle": "quest",
        "orientation": {"canvas": "upper-right-quarter", "pivot": [0, 114], "fullSize": [228, 228]},
    },
    "small": {
        "name": "PortalSmall", "width": 96, "height": 96,
        "sha256": "bb72453ae263261aefcddc69332db0688c28ff4667d39ed8581aa56b4166156a",
        "sourcePath": "Resources/Data/main_odr/main_atlas_procedural.assetbundle",
        "sourceSha256": "40e9fb53bbb9a9baef449b626fddd6992b7d987850731c4cc198b59b3bdccac7",
        "pack": "main_odr", "bundle": "main_atlas_procedural",
        "orientation": {"canvas": "full-ring", "pivot": [48, 48], "fullSize": [96, 96]},
    },
}


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def canonical(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False) + "\n").encode("utf-8")


def png_info(raw):
    """Inspect without changing the native PNG or its transparent RGB channels."""
    if len(raw) > 1024 * 1024 or not raw.startswith(b"\x89PNG\r\n\x1a\n"):
        raise ValueError("Expected bounded native portal PNG bytes")
    with Image.open(io.BytesIO(raw)) as image:
        if image.format != "PNG" or image.mode != "RGBA" or image.n_frames != 1:
            raise ValueError("Expected single-frame native RGBA PNG")
        if not 1 <= image.width <= 512 or not 1 <= image.height <= 512:
            raise ValueError("Unexpected portal PNG dimensions")
        alpha = image.getchannel("A")
        return {"sha256": digest(raw), "rgbaSha256": digest(image.tobytes()),
                "pixelSha256": digest(json.dumps(list(image.size), separators=(",", ":")).encode() + b"\0RGBA\0" + image.tobytes()),
                "width": image.width, "height": image.height, "byteLength": len(raw),
                "alphaBounds": list(alpha.getbbox()) if alpha.getbbox() else None,
                "alphaRange": list(alpha.getextrema())}


def select_exact_sprite(rows, spec):
    """Select an exact typed source; no basename, alias, case or appearance guesses."""
    candidates = [row for row in rows if row["name"] == spec["name"] and row["type"] == "Sprite"
                  and row["root"] == "installed" and row["sourcePath"] == spec["sourcePath"]]
    if len(candidates) != 1:
        raise ValueError("Ambiguous or unavailable exact Sprite: " + spec["name"])
    selected = candidates[0]
    if (selected["width"], selected["height"]) != (spec["width"], spec["height"]):
        raise ValueError("Exact Sprite dimensions drift: " + spec["name"])
    if selected["blobSha256"] != spec["sha256"]:
        raise ValueError("Exact Sprite PNG hash drift: " + spec["name"])
    for row in rows:
        if row["name"] == spec["name"] and (row["blobSha256"] != selected["blobSha256"] or
                                             row["pixelSha256"] != selected["pixelSha256"]):
            raise ValueError("Conflicting exact-name artwork: " + spec["name"])
    return selected


def catalog_rows(db, name):
    rows = db.execute("""SELECT o.id objectId,o.name,o.type,o.path_id pathId,
        o.serialized_file serializedFile,o.raw_sha256 rawObjectSha256,o.provenance,
        s.id sourceId,s.root,s.path sourcePath,s.sha256 sourceSha256,
        a.id assetId,a.kind,a.width,a.height,a.pixel_sha256 pixelSha256,
        b.path blobPath,b.sha256 blobSha256,b.bytes byteLength
        FROM objects o JOIN sources s ON s.id=o.source_id JOIN assets a ON a.id=o.asset_id
        JOIN blobs b ON b.sha256=a.blob_sha256
        WHERE o.name=? COLLATE BINARY AND s.status IN ('done','done-with-errors')
        ORDER BY s.root,s.path,o.type,o.id""", (name,)).fetchall()
    result = []
    for row in rows:
        item = dict(row)
        item["provenance"] = json.loads(item["provenance"])
        result.append(item)
    return result


def native_pack(spec, installed):
    resources = installed / "Resources/Data"
    raw = (resources / "packs.txt").read_bytes()
    pack = json.loads(raw)["packs"][spec["pack"]]
    toc_relative = Path(pack["path"]) / "toc.txt"
    toc_raw = (resources / toc_relative).read_bytes()
    toc = json.loads(toc_raw)
    bundle = toc["bundles"][spec["bundle"]]
    bundle_file = bundle["file"].replace("\\", "/")
    if toc["pack"] != spec["pack"] or "Resources/Data/" + bundle_file != spec["sourcePath"]:
        raise ValueError("Exact native pack/bundle binding drift")
    path = installed / spec["sourcePath"]
    source_raw = path.read_bytes()
    if digest(source_raw) != spec["sourceSha256"] or len(source_raw) != bundle["size"]:
        raise ValueError("Pinned original native bundle changed: " + spec["sourcePath"])
    return {"pack": spec["pack"], "bundle": spec["bundle"], "bundleFile": bundle_file,
            "bundleSha256": spec["sourceSha256"], "byteLength": len(source_raw),
            "packManifestSha256": digest(raw), "tocPath": "Resources/Data/" + toc_relative.as_posix(),
            "tocSha256": digest(toc_raw)}


def decode_exact_sprite(selected, installed, environments):
    """Re-decode the selected original Sprite, comparing raw objects and all RGBA bytes."""
    import UnityPy

    source = selected["sourcePath"]
    if source not in environments:
        environments[source] = UnityPy.load(str(installed / source))
    env = environments[source]
    matches = [obj for obj in env.objects if str(obj.path_id) == selected["pathId"]
               and obj.assets_file.name == selected["serializedFile"] and obj.type.name == "Sprite"]
    if len(matches) != 1:
        raise ValueError("Exact native Sprite pointer unavailable")
    obj = matches[0]
    raw_sha = digest(obj.get_raw_data())
    sprite = obj.read()
    if sprite.m_Name != selected["name"] or raw_sha != selected["rawObjectSha256"]:
        raise ValueError("Exact native Sprite object drift")
    image = sprite.image.convert("RGBA")
    return {"rawObjectSha256": raw_sha, "rgbaSha256": digest(image.tobytes()),
            "width": image.width, "height": image.height,
            "operation": "UnityPy Sprite decode; original rect, alpha, packing and origin. Compared every RGBA byte to retained PNG."}


def write_projection(manifest, proof, payloads, output, proof_output, assets, *, check):
    encoded, proof_encoded = canonical(manifest), canonical(proof)
    if check:
        if output.read_bytes() != encoded:
            raise ValueError("Portal artwork manifest drift")
        if proof_output.read_bytes() != proof_encoded:
            raise ValueError("Portal artwork proof drift")
        for name, raw in payloads.items():
            if (assets / name).read_bytes() != raw:
                raise ValueError("Original portal artwork bytes changed: " + name)
        return
    # Validate every immutable destination before writing any projection file.
    for name, raw in payloads.items():
        destination = assets / name
        if destination.exists() and destination.read_bytes() != raw:
            raise ValueError("Immutable portal artwork collision: " + name)
    assets.mkdir(parents=True, exist_ok=True)
    for name, raw in payloads.items():
        destination = assets / name
        if not destination.exists():
            destination.write_bytes(raw)
    output.parent.mkdir(parents=True, exist_ok=True)
    proof_output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(encoded)
    proof_output.write_bytes(proof_encoded)


def build(args):
    db = sqlite3.connect((args.library / "catalog.sqlite").resolve().as_uri() + "?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    try:
        if db.execute("SELECT value FROM meta WHERE key='schema_version'").fetchone()[0] != "1":
            raise ValueError("Unsupported retained artwork catalog")
        verification_raw = (args.library / "verification.json").read_bytes()
        if json.loads(verification_raw).get("ok") is not True:
            raise ValueError("Retained artwork library is not verified")
        manifest, assets, payloads, environments = {}, {}, {}, {}
        for key, spec in sorted(SPECS.items()):
            rows = catalog_rows(db, spec["name"])
            selected = select_exact_sprite(rows, spec)
            if selected["sourceSha256"] != spec["sourceSha256"]:
                raise ValueError("Pinned catalog source hash drift")
            pack = native_pack(spec, args.installed)
            blob_path = (args.library / selected["blobPath"]).resolve()
            if not blob_path.is_relative_to((args.library / "originals").resolve()):
                raise ValueError("Retained original path escaped artwork library")
            raw = blob_path.read_bytes()
            info = png_info(raw)
            if any(info[field] != selected["blobSha256" if field == "sha256" else field]
                   for field in ("sha256", "pixelSha256", "width", "height", "byteLength")):
                raise ValueError("Retained exact Sprite PNG drift: " + spec["name"])
            decoded = decode_exact_sprite(selected, args.installed, environments)
            if any(info[field] != decoded[field] for field in ("rgbaSha256", "width", "height")):
                raise ValueError("Original native Sprite pixels differ from retained PNG")
            url = "/game-quests/portal-art/" + info["sha256"] + ".png"
            manifest[key] = {"url": url, **{field: info[field] for field in ("width", "height", "sha256")}}
            assets[key] = {"selectedObject": selected, "exactNameMatches": rows, "nativePack": pack,
                           "nativeDecode": decoded, "output": info, "orientation": spec["orientation"]}
            payloads[info["sha256"] + ".png"] = raw
        proof = {"version": 1,
                 "usage": "Decorative quest-map markers; asset names do not establish native arrival/departure roles.",
                 "policy": "Finite exact-name typed Sprite selection, pinned installed pack/bundle hashes, retained lossless native RGBA PNG bytes. No recoloring, resizing, cropping, repainting, full-ring rasterization or filename-based role inference.",
                 "libraryVerificationSha256": digest(verification_raw), "assets": assets}
        write_projection(manifest, proof, payloads, args.output, args.proof, args.assets, check=args.check)
        print(f"{'Verified' if args.check else 'Exported'} {len(manifest)} exact original portal RGBA PNGs ({sum(len(raw) for raw in payloads.values())} bytes)")
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--library", type=Path, default=REPO / "temp/game-artwork-library")
    parser.add_argument("--installed", type=Path, default=Path("C:/Games/Marvel Contest of Champions/default/game/Champions_Data"))
    parser.add_argument("--output", type=Path, default=REPO / "src/data/game-quests/portal-artwork.json")
    parser.add_argument("--proof", type=Path, default=REPO / "src/data/game-quests/portal-artwork-proof.json")
    parser.add_argument("--assets", type=Path, default=REPO / "web/public/game-quests/portal-art")
    parser.add_argument("--check", action="store_true", help="Reproduce and verify without writing anything")
    build(parser.parse_args())
