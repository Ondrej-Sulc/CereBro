"""Export finite path-reward presentation from frozen native definitions.

No client, account, session, or process access. Only the exact source-proved
Deathless stone and temporal shard references may be fetched from the public CDN.
Published PNG bytes are preserved and content addressed; --check is offline.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path
import sys
from urllib.parse import unquote, urlsplit
from urllib.error import HTTPError
from urllib.request import HTTPRedirectHandler, Request, build_opener

from PIL import Image

from build_reward_presentation import NATIVE, inventory_details
from build_source_art import local_pack_reference

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from extract_mcoc_reward_artwork import REVIEWED_METADATA, REVIEWED_MATERIAL_BINDINGS, resolve_material_tint
from extract_mcoc_crystal_artwork import cache_file
from mcoc_protobuf import Decoder, fields

REPO = Path(__file__).resolve().parents[2]
CDN = "https://kabam-marvel.shared.mcoc-cdn.net/"
TARGETS = frozenset({("inv", "deathless_signature_stone_t6"), ("inv", "deathless_signature_stone_t7"),
                     ("inv", "carina_corrupted_essence_story_key"), ("gf", "5_star_relic_shard_crystal"),
                     ("gs", "t6_class_cat_frag_crystal_5p"), ("ebp", "spc_carina"),
                     ("inv", "chronoserpent_epilogue_key")})
PUBLIC_REFERENCES = frozenset({
    "gamestore/28113b466d5f/icon_Base_Deathless_Sign_Stones_da9ff9fd0019.png",
    "gamestore/28113b1f5033/icon_Base_Deathless_Sign_Stones_da9ff9fd0014.png",
    "gamestore/da455ce73206/Key%20Item_CarinaWhite_e13aa660fe1a.png",
})
MAX_BYTES = 8 * 1024 * 1024


def digest(data):
    return hashlib.sha256(data).hexdigest()


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)


def read(path):
    return json.loads(path.read_bytes())


def localized(value, translations):
    if not value:
        return None
    choices = translations.get(value, {})
    if len(choices) == 1:
        return next(iter(choices))
    return None if value.startswith("ID_") else value


def project_inventory(tokens, definitions, rarities, translations):
    """Join exact [type,data] identities; native tags/redeemers supply details."""
    records = {}
    for kind, identity in sorted(tokens):
        if kind != "inv":
            continue
        matches = [(pointer, item) for pointer, item in definitions if item.get("Name") == identity]
        choices = {}
        for pointer, item in matches:
            name = localized(item.get("Title"), translations)
            if not name:
                continue
            metadata = {"name": name, **inventory_details(item, rarities, {})}
            description = localized(item.get("Description"), translations)
            if description:
                metadata["description"] = description
            reference = item.get("image", {}).get("en")
            if reference:
                metadata["imageReference"] = reference
                metadata["imageS3"] = item.get("ImageS3", False)
            choices[canonical(metadata)] = metadata
        if len(choices) > 1:
            raise ValueError("Ambiguous exact inventory definition: " + identity)
        if not choices:
            continue
        metadata = next(iter(choices.values()))
        metadata["source"] = {
            "definitionPointers": sorted(pointer for pointer, _ in matches),
            "definitionSha256s": sorted({digest(canonical(item).encode("utf-8")) for _, item in matches}),
            "nameField": "Title", "descriptionField": "Description", "imageField": "image/en",
            "detailFields": ["UseOnHero", "UseOnRelic", "HTags", "Name", "SigState", "Redeemers"],
        }
        records[json.dumps([kind, identity], separators=(",", ":"))] = metadata
    return records


def project_crystals(tokens, definitions, translations):
    """Join the exact Gacha Token; shard and whole-crystal roles stay separate."""
    records = {}
    for kind, identity in sorted(tokens):
        if kind not in {"gs", "gf"}:
            continue
        matches = [(pointer, box) for pointer, box in definitions if box.get("Token") == identity]
        choices = {}
        name_field = "_fragmentName" if kind == "gf" else "_displayName"
        image_field = "_fragmentImage" if kind == "gf" else "_tokenImage"
        transport_field = "FragmentImageOnCDN" if kind == "gf" else "TokenImageOnCDN"
        for _, box in matches:
            name = localized((box.get(name_field) or box.get("_displayName", {})).get("en"), translations)
            reference = box.get(image_field, {}).get("en")
            if name and reference:
                row = {"name": name, "imageReference": reference, "imageS3": box.get(transport_field, False)}
                choices[canonical(row)] = row
        if len(choices) > 1:
            raise ValueError("Ambiguous exact crystal token: " + identity)
        if not choices:
            continue
        row = next(iter(choices.values()))
        row["source"] = {"definitionPointers": sorted(pointer for pointer, _ in matches),
                         "definitionSha256s": sorted({digest(canonical(box).encode("utf-8")) for _, box in matches}),
                         "nameField": name_field + "/en", "imageField": image_field + "/en",
                         "transportField": transport_field, "joinField": "Token"}
        records[json.dumps([kind, identity], separators=(",", ":"))] = row
    return records


def project_materials(tokens, definitions, translations):
    records = {}
    for kind, identity in sorted(tokens):
        if kind != "ebp":
            continue
        matches = [(pointer, item) for pointer, item in definitions if item.get("EvoBlueprint") == identity]
        choices = {}
        for _, item in matches:
            name = localized(item.get("_friendlyNameLoc", {}).get("en"), translations)
            if not name:
                continue
            row = {"name": name}
            description = localized(item.get("_descriptionLoc", {}).get("en"), translations)
            if description:
                row["description"] = description
            if item.get("_imgID"):
                image_s3 = item.get("_s3ImgID", False)
                row.update(imageReference=item["_imgID"] if image_s3 else "portraits/" + item["_imgID"], imageS3=image_s3)
            choices[canonical(row)] = row
        if len(choices) > 1:
            raise ValueError("Ambiguous exact material definition: " + identity)
        if not choices:
            continue
        row = next(iter(choices.values()))
        row["source"] = {"definitionPointers": sorted(pointer for pointer, _ in matches),
                         "definitionSha256s": sorted({digest(canonical(item).encode("utf-8")) for _, item in matches}),
                         "nameField": "_friendlyNameLoc/en", "descriptionField": "_descriptionLoc/en",
                         "imageField": "_imgID", "transportField": "_s3ImgID", "joinField": "EvoBlueprint"}
        records[json.dumps([kind, identity], separators=(",", ":"))] = row
    return records


def png_info(data):
    if not data or len(data) > MAX_BYTES or not data.startswith(b"\x89PNG\r\n\x1a\n"):
        raise ValueError("Expected a bounded native PNG")
    with Image.open(io.BytesIO(data)) as image:
        if image.format != "PNG" or image.n_frames != 1 or not 1 <= image.width <= 4096 or not 1 <= image.height <= 4096:
            raise ValueError("Unsupported native PNG dimensions/animation")
        image.load()
        return {"width": image.width, "height": image.height, "byteLength": len(data),
                "rgbaSha256": digest(image.convert("RGBA").tobytes())}


def exact_reference(reference):
    if not isinstance(reference, str) or not reference or len(reference) > 8192:
        raise ValueError("Invalid native image reference")
    uri = urlsplit(reference)
    decoded = unquote(reference)
    if (uri.scheme or uri.netloc or uri.query or uri.fragment or reference.startswith("/")
            or ".." in decoded.split("/") or any(c in decoded for c in "\\?#\x00")
            or any(ord(c) < 32 or ord(c) == 127 for c in decoded) or any(c.isspace() for c in reference)):
        raise ValueError("Unsafe native PNG reference")
    return reference


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def acquire_image(reference, image_s3, resources, assets, *, receipt=None, retained_payload=None,
                  download_missing=False, cache=None):
    reference = exact_reference(reference)
    if type(image_s3) is not bool:
        raise ValueError("Invalid native image transport flag")
    identity = {"reference": reference, "ImageS3": image_s3}
    if image_s3:
        identity["sourceUrl"] = CDN + reference
    if receipt is not None:
        if any(receipt.get(key) != value for key, value in identity.items()):
            raise ValueError("Retained image identity drift")
        file = receipt.get("file", "")
        if file != receipt.get("sha256", "") + ".png":
            raise ValueError("Retained image path drift")
        data = (assets / file).read_bytes()
        if digest(data) != receipt["sha256"] or any(receipt.get(k) != v for k, v in png_info(data).items()):
            raise ValueError("Retained native artwork drift")
        return data, receipt
    cached = cache_file(cache, reference) if cache and image_s3 else None
    native = None
    if resources and not (cached and cached.is_file()):
        native = local_pack_reference(str(Path(reference).with_suffix("")).replace("\\", "/"), resources)
    if cached and cached.is_file():
        data = cached.read_bytes()
        provenance = {"origin": "exact-native-uri-path-cache", "cacheKey": cached.name,
                      "cacheBinding": "SHA1('/' + exact native image.en), uppercase hex + source extension"}
    elif native:
        data = native[0].read_bytes()
        provenance = {"origin": "exact-native-pack-file", "nativePack": native[1]}
    elif retained_payload is not None:
        data = retained_payload
        provenance = {"origin": "retained-exact-reference"}
    elif download_missing and image_s3 and reference in PUBLIC_REFERENCES:
        url = identity["sourceUrl"]
        request = Request(url, headers={"User-Agent": "CereBro-path-reward-artwork/1", "Accept": "image/png"})
        with build_opener(NoRedirect).open(request, timeout=20) as response:
            if response.status != 200 or response.geturl() != url:
                raise ValueError("Public artwork changed URL or status")
            data = response.read(MAX_BYTES + 1)
        provenance = {"origin": "exact-public-native-url"}
    else:
        raise ValueError("Exact native PNG unavailable locally: " + reference)
    info = png_info(data)
    sha = digest(data)
    record = {**identity, **provenance, **info, "sha256": sha, "file": sha + ".png"}
    assets.mkdir(parents=True, exist_ok=True)
    destination = assets / record["file"]
    if destination.exists() and destination.read_bytes() != data:
        raise ValueError("Immutable artwork collision")
    if not destination.exists():
        destination.write_bytes(data)
    return data, record


def build(args):
    if args.check and args.download_missing:
        raise ValueError("Verification never downloads or changes files")
    features = read(args.features)
    tokens = {(reward["type"], reward["data"]) for feature in features["maps"].values()
              for placement in feature.get("pathRewards", []) for reward in placement["rewards"]}
    selected = tokens & TARGETS
    if selected != TARGETS:
        raise ValueError("Requested supplement tokens are not source-bound path rewards")
    manifest_path = REPO / "src/data/game-reward-artwork/manifest.json"
    registry_source = read(manifest_path)["source"]
    schema = read(args.schema)
    if {Path(row["path"].replace("\\", "/")).name: row["sha256"] for row in schema["sources"]} != REVIEWED_METADATA:
        raise ValueError("Native protobuf metadata changed")
    hashes = {"features": digest(args.features.read_bytes()), "schema": digest(args.schema.read_bytes()),
              "exporter": digest(Path(__file__).read_bytes())}
    for helper in ("build_reward_presentation.py", "build_source_art.py", "../extract_mcoc_crystal_artwork.py", "../extract_mcoc_reward_artwork.py", "../mcoc_protobuf.py"):
        hashes["helper/" + Path(helper).name] = digest((Path(__file__).parent / helper).read_bytes())
    for name, expected in NATIVE.items():
        actual = digest((args.native / name).read_bytes())
        if actual != expected:
            raise ValueError("Native display proof changed: " + name)
        hashes[name] = actual
    registries = {}
    for registry in registry_source["registries"]:
        path = (args.store if registry["kind"] == "gameStore" else args.source / "sources") / registry["fileName"]
        raw = path.read_bytes()
        if digest(raw) != registry["sha256"]:
            raise ValueError("Frozen native registry changed: " + registry["kind"])
        hashes[registry["kind"]] = registry["sha256"]
        registries[registry["kind"]] = (raw, registry)
    decoder = Decoder(schema)
    store = decoder.message(registries["gameStore"][0], "EB.Sparx.GameStoreDataBuffer")
    gacha = decoder.message(registries["gacha"][0], "EB.Sparx.GachaDataBuffer")
    rarities, materials = [], []
    for tag, wire, value, _ in fields(registries["bcg"][0]):
        if tag == 12 and wire == 2:
            rarities.append(decoder.message(value, "BCGRarityProperties"))
        elif tag == 5 and wire == 2:
            materials.append((f"/BCGEvoBlueprintBase/{len(materials)}", decoder.message(value, "BCGEvoBlueprintBase")))
    if decoder.unknown:
        raise ValueError("Unknown native display fields")
    definitions = [(f"/items/{category}/gameStoreItems/{index}", item) for category, group in store.get("items", {}).items()
                   for index, item in enumerate(group.get("gameStoreItems", []))]
    translations = {}
    for path in sorted(args.words.glob("*.json")):
        document = read(path)
        if document.get("meta", {}).get("language") != "en":
            continue
        if document.get("meta", {}).get("format") != "sparx":
            raise ValueError("Unreviewed localization format")
        hashes["words/" + path.name] = digest(path.read_bytes())
        for row in document.get("strings", []):
            translations.setdefault(row["k"], {}).setdefault(row["v"], set()).add(path.name)
    rewards = project_inventory(selected, definitions, {row["ID"]: row["MapValue"] for row in rarities}, translations)
    crystal_definitions = [(f"/groups/{group_index}/Set/Boxes/{box_index}", box)
                           for group_index, group in enumerate(gacha.get("groups", []))
                           for box_index, box in enumerate(group.get("Set", {}).get("Boxes", []))]
    rewards.update(project_crystals(selected, crystal_definitions, translations))
    rewards.update(project_materials(selected, materials, translations))
    if len(rewards) != len(selected):
        raise ValueError("Incomplete exact path reward definitions")
    previous = read(args.output) if args.output.exists() else {}
    for key, row in rewards.items():
        kind, identity = json.loads(key)
        reference, image_s3 = row.pop("imageReference"), row.pop("imageS3")
        receipt = previous.get("rewards", {}).get(key, {}).get("source", {}).get("artwork")
        if args.check and receipt is None:
            raise ValueError("Offline verification requires retained artwork receipts")
        if receipt and receipt.get("state") == "unavailable":
            if receipt.get("reference") != reference or receipt.get("ImageS3") != image_s3:
                raise ValueError("Unavailable native artwork identity drift")
            artwork = receipt
        else:
            try:
                _, artwork = acquire_image(reference, image_s3, args.resources, args.assets,
                                           receipt=receipt, download_missing=args.download_missing, cache=args.cache)
            except HTTPError as error:
                if error.code not in {403, 404}:
                    raise
                artwork = {"state": "unavailable", "reference": reference, "ImageS3": image_s3,
                           "sourceUrl": CDN + reference, "reason": f"HTTP-{error.code}"}
        if "file" in artwork:
            row["imageUrl"] = "/game-quests/path-reward-art/" + artwork["file"]
        registry_kind = "gameStore" if kind == "inv" else "bcg" if kind == "ebp" else "gacha"
        row["source"].update(registry=registries[registry_kind][1], artwork=artwork)
        if kind == "ebp":
            palette_path = REPO / "src/data/game-reward-artwork/palette.json"
            proof_path = REPO / "src/data/game-reward-artwork/material-shader-proof.json"
            palette = read(palette_path)
            if digest(proof_path.read_bytes()) != REVIEWED_MATERIAL_BINDINGS:
                raise ValueError("Reviewed native material renderer proof changed")
            hashes["palette"] = digest(palette_path.read_bytes())
            hashes["materialShaderProof"] = REVIEWED_MATERIAL_BINDINGS
            item = next(item for _, item in materials if item.get("EvoBlueprint") == identity)
            row["source"]["nativeRendering"] = {"renderTint": resolve_material_tint(item, palette["colors"]),
                                                 "bindingProofSha256": REVIEWED_MATERIAL_BINDINGS,
                                                 "applied": False, "export": "Original native PNG bytes preserved"}
    result = {"version": 1, "rewards": rewards, "sourceHashes": hashes,
              "scope": "Exact source-bound path reward supplement; existing reward catalogs retain other tokens"}
    encoded = (canonical(result) + "\n").encode("utf-8")
    if args.check:
        if args.output.read_bytes() != encoded:
            raise ValueError("Path reward presentation projection drift")
    else:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_bytes(encoded)
    return {"rewards": len(rewards), "assets": len({row["imageUrl"] for row in rewards.values() if "imageUrl" in row}),
            "sha256": digest(encoded), "check": args.check}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    for name, default in [
        ("features", REPO / "src/data/game-quests/map-features.json"),
        ("source", REPO / "temp/quest-data-investigation/game-only"),
        ("store", REPO / "temp/crystal-openings"), ("schema", REPO / "temp/crystals/schema.json"),
        ("words", REPO / "temp/crystal-openings/words"),
        ("native", Path("D:/CodexArtifacts/Cpp2IL-2026-11-03/IsilDump/Marvel.Runtime")),
        ("resources", Path("C:/Games/Marvel Contest of Champions/default/game/Champions_Data/Resources/Data")),
        ("cache", Path("C:/Users/ossul/AppData/LocalLow/Kabam/Champions/asset_cache/files")),
        ("output", REPO / "src/data/game-quests/path-reward-presentation.json"),
        ("assets", REPO / "web/public/game-quests/path-reward-art"),
    ]:
        parser.add_argument("--" + name, type=Path, default=default)
    parser.add_argument("--download-missing", action="store_true")
    parser.add_argument("--check", action="store_true")
    print(json.dumps(build(parser.parse_args())))
