"""Build seven source-bound public resource definitions, without game access.

Default acquisition is offline. --download-missing fetches only the four exact
captured PNG URLs. --check replays the published proof and local assets offline,
so verification needs neither a game installation nor ignored capture files.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import importlib.util
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
RESEARCH = REPO / "temp/quest-explorer-review/public-resource-artwork-20261110"
CAPTURE = REPO / "temp/quest-explorer-review/reward-resource-definition-investigation-20261110/acquisition/public-resource-metadata.json"
OUTPUT = REPO / "src/data/game-resource-definitions"
ASSETS = REPO / "web/public/game-rewards/resource-definitions"
HELPER_SHA = "cce523700195989851dc927078308006fe5267ff42de5a3457539bb82d4f3fa0"
HELPER = Path(__file__).with_name("build_reward_definition_artwork.py")
if hashlib.sha256(HELPER.read_bytes()).hexdigest() != HELPER_SHA:
    raise ValueError("Pinned public PNG helper source drift")
_spec = importlib.util.spec_from_file_location("public_resource_png_support", HELPER)
support = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(support)
digest, encoded, png_info = support.digest, support.encoded, support.png_info

IDS = ("eod2026_doomscrip", "essentia_currency", "mysterium", "sp", "sp-max", "tower_challenge_energy", "tower_energy")
PINS = {
    "captureSha256": "3eeacc019365e8a53a1048777f6b5639fd2ce155ef0aa21e2431a7546528800d",
    "readerSha256": "608f7079de57e1257eb9892ff20740a3aefd2a997328f0d935cc58342786acd0",
    "scopeSha256": "783016140a72c139df2e533779a0cebb797b7d9a6ad068d2dea42e10c2ceabc0",
    "layoutSha256": "a37071c661b5966d992241c1cc1c833695f592383135c6a9badd96e00bcc82d3",
    "nativeProofSha256": "357b936abbeb46d7e67c471e6414403ba95eee23411568a0616cd9b09aa2b996",
    "allowlistSha256": "2cfac5db2ba5788fc0411b3b12634a16eeeb43feeaeff38fdb5f4ee79f558b39",
    "idsSha256": "df53a55307cc26f023f4b5fc37b627e525f08603ee1ef4f7093f4b5a728f264e",
}
CAPTURE_DATE = "2026-11-10T21:21:22.381997+00:00"
GAME_SHA = "01f46bb2e36c2160a8df939bbb080bcf2ee89ca15427692a10334efc90fd4abb"
EXE_SHA = "4dafab2c11cdf9f0aebb74faf666f3c16c15421c8658c754afe258f23c6d4498"
ESSENTIA_PROOF_SHA = "f48fceec83227e55426aa03a638b88a2fc6aec9efe0782cfaf08bd9519b19220"
RENDER_PROOF_SHA = "c67c47613e60ad7a8f459cc051e81c7856be03ce6422b8520e577130b224fa3f"
ESSENTIA_SHA = "85de8eea25c67848a32f3b781df3da50dd561979191f09a5729cd761c7455ab3"
ESSENTIA_KEY = "iconCurrencyEssentia"
SOURCE_PINS = {"public-resource-metadata.json": PINS["captureSha256"],
               "essentia-binding-proof.json": ESSENTIA_PROOF_SHA,
               "native-rendering-proof.json": RENDER_PROOF_SHA}


def bounded_text(value):
    if (not isinstance(value, str) or len(value) > 8192
            or any(ord(c) < 32 and c not in "\t\r\n" for c in value)):
        raise ValueError("Invalid native public string")
    return value


def project(document):
    """Exact finite public projection, preserving empty fields and all seven IDs."""
    if set(document) != {"format", "capturedAt", "source", "definitions", "missingIds", "policy", "readMetrics"}:
        raise ValueError("Unexpected capture fields")
    if (document["format"] != "cerebro.public-resource-metadata.v1"
            or document["capturedAt"] != CAPTURE_DATE or document["missingIds"] != []):
        raise ValueError("Incomplete/unsupported public resource capture")
    source = document["source"]
    expected = set(PINS) - {"captureSha256"}
    if (set(source) != expected | {"executablePins", "supportPins"}
            or any(source[k] != PINS[k] for k in expected)
            or source["executablePins"] != {"Champions.exe": EXE_SHA, "GameAssembly.dll": GAME_SHA}
            or source["supportPins"].get("GameAssembly.dll") != GAME_SHA):
        raise ValueError("Public resource source provenance drift")
    definitions = document["definitions"]
    if not isinstance(definitions, list) or len(definitions) != 7:
        raise ValueError("Expected exactly seven public resources")
    rows = []
    for i, definition in enumerate(definitions):
        if set(definition) != {"id", "name", "description", "iconTexture"} or definition["id"] != IDS[i]:
            raise ValueError("Unexpected/duplicate resource ID or private field")
        rows.append({"type": "res", "data": definition["id"],
                     **{k: bounded_text(definition[k]) for k in ("name", "description", "iconTexture")},
                     "sourcePointer": f"/definitions/{i}"})
    if rows[1]["iconTexture"] != ESSENTIA_KEY or any(rows[i]["iconTexture"] for i in (3, 4)):
        raise ValueError("Exact native sprite/empty binding changed")
    for i in (0, 2, 5, 6):
        support.exact_url(rows[i]["iconTexture"])
    return rows


def source_document(receipt, expected):
    if set(receipt) != {"sha256", "utf8"} or receipt["sha256"] != expected:
        raise ValueError("Unbound public source receipt")
    raw = receipt["utf8"].encode("utf-8")
    if len(raw) > 2 * 1024 * 1024 or digest(raw) != expected:
        raise ValueError("Pinned public source drift")
    return json.loads(raw)


def validate_sources(sources):
    if set(sources) != set(SOURCE_PINS):
        raise ValueError("Unexpected public source set")
    docs = {key: source_document(sources[key], pin) for key, pin in SOURCE_PINS.items()}
    rows = project(docs["public-resource-metadata.json"])
    essence, render = docs["essentia-binding-proof.json"], docs["native-rendering-proof.json"]
    atlas = essence["nativeAtlasIndex"]
    if (essence["definition"] != {"type": "res", "id": "essentia_currency", "field": "IconTexture",
                                  "value": ESSENTIA_KEY, "captureSha256": PINS["captureSha256"]}
            or atlas["exactName"] != ESSENTIA_KEY or atlas["atlasName"] != "MainAtlas"
            or atlas["index"] != 365 or atlas["spritePointer"] != {"m_FileID": 0, "m_PathID": 1047}
            or essence["output"]["inputSha256"] != ESSENTIA_SHA
            or len(essence["matches"]) != 3
            or any(m["name"] != ESSENTIA_KEY or m["blobSha256"] != ESSENTIA_SHA for m in essence["matches"])
            or render["metadataProofSha256"] != PINS["nativeProofSha256"] or render["gameAssemblySha256"] != GAME_SHA):
        raise ValueError("Exact native Essentia atlas/getter binding drift")
    return docs, rows


def make_outputs(sources, payloads):
    docs, rows = validate_sources(sources)
    expected = {r["iconTexture"] for r in rows if r["iconTexture"]}
    if set(payloads) != expected:
        raise ValueError("Missing/unrequested public artwork input")
    assets, inputs, published = {}, {}, []
    for row in rows:
        key = row["iconTexture"]
        if not key:
            published.append({**row, "artworkStatus": "native-empty"})
            continue
        data = payloads[key]
        sha, info = digest(data), png_info(data)
        if key == ESSENTIA_KEY:
            native = docs["essentia-binding-proof.json"]["output"]
            if sha != ESSENTIA_SHA or any(info[k] != native[k] for k in ("width", "height", "rgbaSha256")):
                raise ValueError("Native lossless Essentia pixels changed")
        else:
            support.exact_url(key)
        image = f"/game-rewards/resource-definitions/{sha}.png"
        assets[sha] = {"imageUrl": image, **{k: info[k] for k in ("width", "height", "byteLength")}}
        inputs[key] = {"inputSha256": sha, **info,
                       "origin": "exact-native-MainAtlas-Sprite-binding" if key == ESSENTIA_KEY else "verbatim-captured-public-PNG-URL"}
        published.append({**row, "artworkStatus": "resolved", "imageUrl": image, "inputSha256": sha})
    proof = {"format": "cerebro.public-resource-artwork-proof.v1", "sources": sources, "inputs": inputs,
             "builderSha256": digest(Path(__file__).read_bytes()), "publicPngHelperSha256": HELPER_SHA,
             "policy": "Original public PNG bytes and lossless native Sprite pixels. Exact native names/empty strings retained; no aliases, quantities or prize filtering. Root static sp GetTexture icon takes rendering priority; captured empty sp IconTexture remains native-empty. No game/process/session access."}
    proof_bytes = encoded(proof)
    catalog = {"version": 1, "source": {**PINS, "capturedAt": CAPTURE_DATE, "artworkProofSha256": digest(proof_bytes)},
               "resources": published, "assets": assets}
    return encoded(catalog), proof_bytes


def replay(output=OUTPUT, assets=ASSETS):
    """Portable deterministic verification against source receipts and local PNGs."""
    raw = (output / "proof.json").read_bytes()
    if len(raw) > 2 * 1024 * 1024:
        raise ValueError("Unbounded public proof")
    proof = json.loads(raw)
    _, rows = validate_sources(proof["sources"])
    catalog = json.loads((output / "catalog.json").read_bytes())
    by_id = {r["data"]: r for r in catalog["resources"]}
    payloads = {}
    for row in rows:
        if row["iconTexture"]:
            sha = by_id[row["data"]]["inputSha256"]
            if not isinstance(sha, str) or len(sha) != 64 or any(c not in "0123456789abcdef" for c in sha):
                raise ValueError("Unsafe content address")
            data = (assets / (sha + ".png")).read_bytes()
            if digest(data) != sha:
                raise ValueError("Published PNG content address drift")
            payloads[row["iconTexture"]] = data
    catalog_bytes, proof_bytes = make_outputs(proof["sources"], payloads)
    if raw != proof_bytes or (output / "catalog.json").read_bytes() != catalog_bytes:
        raise ValueError("Non-deterministic public resource catalog/proof")
    return result(catalog_bytes, proof_bytes, True)


def result(catalog_bytes, proof_bytes, check):
    catalog = json.loads(catalog_bytes)
    return {"definitions": len(catalog["resources"]), "uniqueAssets": len(catalog["assets"]),
            "resolved": sum(r["artworkStatus"] == "resolved" for r in catalog["resources"]),
            "nativeEmpty": sum(r["artworkStatus"] == "native-empty" for r in catalog["resources"]),
            "catalogSha256": digest(catalog_bytes), "artworkProofSha256": digest(proof_bytes), "check": check}


def build(capture=CAPTURE, research=RESEARCH, output=OUTPUT, assets=ASSETS, fetch_missing=False):
    sources = {}
    for name, pin in SOURCE_PINS.items():
        path = capture if name == "public-resource-metadata.json" else research / name
        raw = path.read_bytes()
        sources[name] = {"sha256": pin, "utf8": raw.decode("utf-8")}
    _, rows = validate_sources(sources)
    urls = sorted(r["iconTexture"] for r in rows if r["iconTexture"].startswith("https://"))
    with ThreadPoolExecutor(max_workers=4) as executor:
        downloaded = list(executor.map(lambda url: support.acquire(url, research / "downloads", fetch_missing), urls))
    payloads = dict(zip(urls, downloaded)) | {ESSENTIA_KEY: (research / "essentia-native.png").read_bytes()}
    catalog_bytes, proof_bytes = make_outputs(sources, payloads)
    for data in payloads.values():
        support.immutable(assets / (digest(data) + ".png"), data)
    for name, data in (("proof.json", proof_bytes), ("catalog.json", catalog_bytes)):
        path = output / name
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(path.suffix + ".tmp")
        temporary.write_bytes(data)
        temporary.replace(path)
    return result(catalog_bytes, proof_bytes, False)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    for name, default in (("capture", CAPTURE), ("research", RESEARCH), ("output", OUTPUT), ("assets", ASSETS)):
        parser.add_argument("--" + name, type=Path, default=default)
    parser.add_argument("--download-missing", action="store_true")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.check and args.download_missing:
        parser.error("--check is strictly offline and does not write")
    print(json.dumps(replay(args.output, args.assets) if args.check else
                     build(args.capture, args.research, args.output, args.assets, args.download_missing)))
