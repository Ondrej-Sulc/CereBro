"""Build the finite public reward supplement from retained, hash-bound sources.

No game/session/process access. Optional networking only fetches exact captured
public PNG URLs, without redirects, credentials, query strings or URL guessing.
Native PNG bytes are preserved, content addressed, and never overwritten.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import io
import json
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

from PIL import Image

REPO = Path(__file__).resolve().parents[2]
RESEARCH = REPO / "temp/quest-explorer-review/reward-definition-artwork-20261110"
CAPTURE = REPO / "temp/quest-explorer-review/reward-definition-reader-20261110/revision-2/public-definitions.json"
ALLOWLIST = REPO / "temp/quest-explorer-review/reward-completeness-20261110/missing-public-reward-ids.json"
URL_PROOF = CAPTURE.parent / "native-url-proof.json"
TITLE_PROOF = RESEARCH / "title-binding-proof.json"
TITLE_IMAGE = RESEARCH / "title_icon.png"
OUTPUT = REPO / "src/data/game-reward-definitions"
ASSETS = REPO / "web/public/game-rewards/definitions"
CDN = "https://kabam-marvel.shared.mcoc-cdn.net/"
MAX_BYTES = 8 * 1024 * 1024
COUNTS = {"sra": 12, "profilebadge": 9, "emote": 3, "utitle": 10}
PINS = {
    "captureSha256": "04b720d1cabb8303d9889bd8c9b9144e0b561864084a5f19761876d813b3cbfd",
    "readerSha256": "92b907c78a5aa63090b46e543b79e829318c4c0d9a870ce036e4cbac65742e5f",
    "scopeSha256": "05b9a0ffc1626a04999ba785595be140f7c9b4538fddee54ebc260f2925cf68c",
    "allowlistSha256": "2cfac5db2ba5788fc0411b3b12634a16eeeb43feeaeff38fdb5f4ee79f558b39",
    "gameAssemblySha256": "01f46bb2e36c2160a8df939bbb080bcf2ee89ca15427692a10334efc90fd4abb",
    "nativeUrlProofSha256": "a3a50022375fc00adf8a8bdee19f7aada488152e1870d5a63b3d3909edbaa012",
}
TITLE_PROOF_SHA = "1c3117e46bfb8270ac0cbcb603a528156f7fd4c68f52c54fde96a945021028c9"
TITLE_SHA = "fdd6473305eb7a98517d04e836ab7a1abcc3c4d16861f3f7b352bb72bc2879ce"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2, allow_nan=False) + "\n").encode("utf-8")


def pinned_json(path, expected, maximum=2 * 1024 * 1024):
    raw = path.read_bytes()
    if len(raw) > maximum or digest(raw) != expected:
        raise ValueError("Pinned public source drift: " + path.name)
    return json.loads(raw)


def exact_url(value):
    if not isinstance(value, str) or len(value) > 8192 or not value.startswith(CDN):
        raise ValueError("Only an exact captured public PNG URL is supported")
    uri = urlsplit(value)
    decoded = unquote(uri.path)
    if (uri.scheme != "https" or uri.netloc != "kabam-marvel.shared.mcoc-cdn.net" or uri.query or uri.fragment
            or not uri.path.endswith(".png") or any(c in decoded for c in "\\?#\x00")
            or any(ord(c) < 32 or ord(c) == 127 for c in value) or ".." in decoded.split("/")
            or any(c.isspace() for c in value)):
        raise ValueError("Unsafe public PNG URL")
    return value  # Preserve encoded path, case, and native separators exactly.


def native_combine(first, second):
    a, b = first.rstrip("\\/:") if first else "", second.lstrip("\\/:") if second else ""
    return first + "/" + second if a and b else a or b


def project(document, targets):
    """Pure projection; names are native values, including empty badge titles."""
    if document.get("format") != "cerebro.public-reward-definitions.v2":
        raise ValueError("Unsupported capture format")
    source = document["source"]
    if (source["readerSha256"] != PINS["readerSha256"] or source["scopeSha256"] != PINS["scopeSha256"]
            or source["allowlistSha256"] != PINS["allowlistSha256"]
            or source["supportPins"]["GameAssembly.dll"] != PINS["gameAssemblySha256"]
            or source["supportPins"]["native-url-proof"] != PINS["nativeUrlProofSha256"]):
        raise ValueError("Capture provenance mismatch")
    if set(document["definitions"]) != set(COUNTS) | {"res"} or document["definitions"]["res"]:
        raise ValueError("Unsupported registry or resource traversal")
    if set(targets) != set(COUNTS) | {"res"} or len(targets["res"]) != 7:
        raise ValueError("Finite target scope changed")
    rewards = []
    for kind in sorted(COUNTS):
        rows = document["definitions"][kind]
        ids = [row["id"] for row in rows]
        if len(rows) != COUNTS[kind] or len(set(ids)) != len(ids) or sorted(ids) != targets[kind]:
            raise ValueError("Missing, duplicate or unrequested public definition")
        if document["missingIds"][kind]:
            raise ValueError("Incomplete public source capture")
        for i, row in enumerate(rows):
            if not isinstance(row["name"], str) or len(row["name"]) > 8192:
                raise ValueError("Invalid native reward label")
            result = {"type": kind, "data": row["id"], "name": row["name"],
                      "sourcePointer": f"/definitions/{kind}/{i}"}
            if row.get("description"):
                if not isinstance(row["description"], str) or len(row["description"]) > 8192:
                    raise ValueError("Invalid native reward description")
                result["description"] = row["description"]
            if kind == "sra":
                field, reference = "sraIconPath", exact_url(row["sraIconPath"])
            elif kind == "utitle":
                if row["nativeRedeemerIcon"] != {"source": "resource", "reference": "misc/title_icon"}:
                    raise ValueError("Title native reward icon changed; per-title artwork is not a fallback")
                field, reference = "nativeRedeemerIcon", "misc/title_icon"
            else:
                inputs = row["nativeImageInputs"]
                if (inputs["path"] != row["imagePath"] or inputs["onS3"] != row["imageOnS3"]
                        or inputs["cdn"] != row["cdn"] or type(inputs["onS3"]) is not bool
                        or inputs["proofSha256"] != PINS["nativeUrlProofSha256"]):
                    raise ValueError("Native image inputs drift")
                native = native_combine(inputs["cdn"], inputs["path"]) if inputs["onS3"] else inputs["path"]
                if inputs["nativeImage"] != native or inputs["nativeImageKind"] != "public-cdn-url":
                    raise ValueError("Unproven image origin; never guess a host")
                field, reference = "nativeImageInputs/nativeImage", exact_url(native)
            result.update(imageField=field, imageReference=reference)
            rewards.append(result)
    return sorted(rewards, key=lambda r: (r["type"], r["data"]))


def png_info(data):
    if not data or len(data) > MAX_BYTES or not data.startswith(b"\x89PNG\r\n\x1a\n"):
        raise ValueError("Expected a bounded native PNG")
    with Image.open(io.BytesIO(data)) as image:
        if image.format != "PNG" or image.n_frames != 1 or not 1 <= image.width <= 4096 or not 1 <= image.height <= 4096:
            raise ValueError("Unsupported native image dimensions/animation")
        image.load()
        rgba = image.convert("RGBA")
        return {"width": image.width, "height": image.height, "byteLength": len(data),
                "rgbaSha256": digest(rgba.tobytes())}


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def immutable(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        if path.read_bytes() != data:
            raise ValueError("Immutable artwork collision: " + path.name)
    else:
        with path.open("xb") as stream:
            stream.write(data)


def acquire(url, retained, fetch_missing):
    url = exact_url(url)
    key = digest(url.encode("utf-8"))
    payload_path, receipt_path = retained / (key + ".png"), retained / (key + ".json")
    if payload_path.exists() or receipt_path.exists():
        receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
        data = payload_path.read_bytes()
        if receipt != {"url": url, "inputSha256": digest(data), **png_info(data)}:
            raise ValueError("Retained URL/payload receipt drift")
        return data
    if not fetch_missing:
        raise ValueError("Exact public PNG not retained; opt in with --download-missing")
    request = Request(url, headers={"User-Agent": "CereBro-public-reward-artwork/1", "Accept": "image/png"})
    with build_opener(NoRedirect).open(request, timeout=20) as response:
        if response.status != 200 or response.geturl() != url:
            raise ValueError("Public PNG response changed URL or status")
        data = response.read(MAX_BYTES + 1)
    receipt = {"url": url, "inputSha256": digest(data), **png_info(data)}
    immutable(payload_path, data)
    immutable(receipt_path, encoded(receipt))
    return data


def make_catalog(rewards, payloads, excluded, proof_hash):
    assets, rows = {}, []
    for row in rewards:
        data = payloads[row["imageReference"]]
        image_hash = digest(data)
        info = png_info(data)
        image_url = f"/game-rewards/definitions/{image_hash}.png"
        assets[image_hash] = {"imageUrl": image_url, **{k: info[k] for k in ("width", "height", "byteLength")}}
        rows.append({**row, "imageUrl": image_url, "inputSha256": image_hash})
    return {"version": 1, "source": {**PINS, "artworkProofSha256": proof_hash},
            "rewards": rows, "assets": assets, "excludedResourceIds": excluded}


def build(capture=CAPTURE, allowlist=ALLOWLIST, url_proof=URL_PROOF, title_proof=TITLE_PROOF,
          title_image=TITLE_IMAGE, retained=RESEARCH / "downloads", output=OUTPUT,
          assets=ASSETS, fetch_missing=False, check=False):
    if check and fetch_missing:
        raise ValueError("Verification never downloads or changes files")
    document = pinned_json(capture, PINS["captureSha256"])
    target_document = pinned_json(allowlist, PINS["allowlistSha256"])
    pinned_json(url_proof, PINS["nativeUrlProofSha256"])
    title = pinned_json(title_proof, TITLE_PROOF_SHA)
    title_data = title_image.read_bytes()
    if (digest(title_data) != TITLE_SHA or title["reference"] != "misc/title_icon"
            or title["binding"]["nativePath"] != "misc/title_icon.png"
            or title["binding"]["inputSha256"] != TITLE_SHA
            or title["binding"]["evidence"] != "public-toc-loose-file"):
        raise ValueError("Exact native title resource proof drift")
    rewards = project(document, target_document["targets"])
    urls = sorted({r["imageReference"] for r in rewards if r["type"] != "utitle"})
    with ThreadPoolExecutor(max_workers=4) as executor:
        data = list(executor.map(lambda url: acquire(url, retained, fetch_missing), urls))
    payloads = dict(zip(urls, data)) | {"misc/title_icon": title_data}
    proof = {"format": "cerebro.public-reward-artwork-proof.v1", "captureSha256": PINS["captureSha256"],
             "nativeUrlProofSha256": PINS["nativeUrlProofSha256"], "titleBindingProofSha256": TITLE_PROOF_SHA,
             "titleBinding": title, "nativeFields": [], "inputs": {},
             "policy": "Native PNG bytes unchanged; exact SRAIconPath, native badge/emote getter output, shared title reward icon. No filename guesses, title-definition-icon substitution or resource/account traversal."}
    for kind in sorted(COUNTS):
        for row in document["definitions"][kind]:
            names = ("id", "name", "description", "sraIconPath") if kind == "sra" else ("id", "name", "description", "nativeRedeemerIcon") if kind == "utitle" else ("id", "name", "description", "imagePath", "imageOnS3", "cdn", "nativeImageInputs")
            proof["nativeFields"].append({"type": kind, **{k: row[k] for k in names if k in row}})
    for reference in sorted(payloads):
        blob = payloads[reference]
        proof["inputs"][reference] = {"inputSha256": digest(blob), **png_info(blob),
                                      "origin": "exact-public-native-url" if reference in urls else "exact-retained-toc-library-binding"}
    proof_bytes = encoded(proof)
    catalog_bytes = encoded(make_catalog(rewards, payloads, target_document["targets"]["res"], digest(proof_bytes)))
    for blob in payloads.values():
        path = assets / (digest(blob) + ".png")
        if check:
            if not path.is_file() or path.read_bytes() != blob:
                raise ValueError("Published native image drift")
        else:
            immutable(path, blob)
    for name, blob in [("artwork-proof.json", proof_bytes), ("catalog.json", catalog_bytes)]:
        path = output / name
        if check:
            if path.read_bytes() != blob:
                raise ValueError("Non-deterministic public reward projection: " + name)
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            temporary = path.with_suffix(path.suffix + ".tmp")
            temporary.write_bytes(blob)
            temporary.replace(path)
    return {"definitions": len(rewards), "uniqueAssets": len(json.loads(catalog_bytes)["assets"]),
            "catalogSha256": digest(catalog_bytes), "artworkProofSha256": digest(proof_bytes),
            "resourcesExcluded": len(target_document["targets"]["res"]), "check": check}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    for name, default in [("capture", CAPTURE), ("allowlist", ALLOWLIST), ("url-proof", URL_PROOF),
                          ("title-proof", TITLE_PROOF), ("title-image", TITLE_IMAGE),
                          ("retained", RESEARCH / "downloads"), ("output", OUTPUT), ("assets", ASSETS)]:
        parser.add_argument("--" + name, type=Path, default=default)
    parser.add_argument("--download-missing", action="store_true")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    print(json.dumps(build(args.capture, args.allowlist, args.url_proof, args.title_proof, args.title_image,
                           args.retained, args.output, args.assets, args.download_missing, args.check)))
