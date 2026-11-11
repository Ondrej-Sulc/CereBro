"""Deterministic public quest menu art projection from the narrow source capture.

Only captured absolute public /quests/ image URLs may be fetched. No URL guessing.
Original quest/map/terrain projection files are never written.
"""
import argparse
from functools import lru_cache
import hashlib
import io
import json
from pathlib import Path
from urllib.parse import urlsplit, unquote
from urllib.request import Request, build_opener, HTTPRedirectHandler

REPO = Path(__file__).resolve().parents[2]
HOST = "kabam-marvel.shared.mcoc-cdn.net"


def sha_bytes(value):
    return hashlib.sha256(value).hexdigest()


def pointer(value):
    return str(value).replace("~", "~0").replace("/", "~1")


def owner_key(kind, container, identity):
    return json.dumps([kind, container, identity], separators=(",", ":"))


def state(value):
    return "missing" if value is None else "empty" if value == "" else "authored"


def public_url(value):
    uri = urlsplit(value)
    decoded = unquote(uri.path)
    return (uri.scheme == "https" and uri.hostname == HOST and uri.netloc == HOST
            and decoded.startswith("/quests/") and ".." not in decoded and "\\" not in decoded and "\0" not in decoded
            and not uri.query and not uri.fragment and Path(uri.path).suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"})


def project(document, catalog):
    if document["format"] != "cerebro.public-quest-art.v1" or document["gameAssemblySha256"] != "01f46bb2e36c2160a8df939bbb080bcf2ee89ca15427692a10334efc90fd4abb":
        raise ValueError("Unsupported public artwork source")
    refs, owners, current, memberships = {}, {}, {}, {}

    def reference(kind, container, identity, field, value, loc):
        key = owner_key(kind, container, identity) + ":" + field
        refs[key] = dict(ownerKind=kind, containerSetId=container, ownerId=identity, field=field,
                         sourcePointer=loc + "/" + field, value=value, state=state(value), asset=None)
        return key

    for si, source_set in enumerate(document["pveSets"]):
        container = source_set["setId"]
        prefix = f"/pveSets/{si}"
        for ai, act in enumerate(source_set["Acts"] or []):
            if not act["actId"]:
                continue
            aid, ap = act["actId"], prefix + f"/Acts/{ai}"
            key = owner_key("act", container, aid)
            owners[key] = dict(kind="act", containerSetId=container, id=aid, name=act["friendlyName"],
                sourcePointer=ap, images={field: reference("act", container, aid, field, act[field], ap)
                                          for field in ("image", "imageSmall", "imageLarge")})
            for ci, chapter in enumerate(act["Chapters"] or []):
                if not chapter["chapterId"]:
                    continue
                cid, cp = chapter["chapterId"], ap + f"/Chapters/{ci}"
                ck = owner_key("chapter", container, cid)
                owners[ck] = dict(kind="chapter", containerSetId=container, id=cid, actId=aid,
                    name=chapter["friendlyName"], sourcePointer=cp,
                    images={"image": reference("chapter", container, cid, "image", chapter["image"], cp)})
                for q in chapter["Quests"] or []:
                    if q and q["qid"]:
                        memberships.setdefault((container, q["qid"]), set()).add((aid, cid))
        for dictionary_key, q in (source_set["QuestSummarys"] or {}).items():
            if dictionary_key != q["qid"] or q["qid"] in current:
                raise ValueError("Ambiguous source quest identity")
            current[q["qid"]] = (source_set, q, prefix + "/QuestSummarys/" + pointer(dictionary_key))

    quests, excluded = {}, {}
    for original in catalog:
        qid = original["id"]
        if qid not in current:
            excluded[qid] = "not resident in art capture"
            continue
        source_set, q, loc = current[qid]
        identity = {"mapId": "mapId", "summarySetId": "setId", "actIndex": "actIndex", "chapterIndex": "chapterIndex",
                    "questIndex": "questIndex", "difficultyId": "difficultyId"}
        mismatch = [old for old, new in identity.items() if original[old] != q[new]]
        if original["containerSetId"] != source_set["setId"] or original["category"] != q["category"]["name"]:
            mismatch.append("container/category")
        expected = {(h["actId"], h["chapterId"]) for h in original["hierarchy"]}
        if expected != memberships.get((source_set["setId"], qid), set()):
            mismatch.append("correlated hierarchy")
        if mismatch:
            excluded[qid] = "source identity drift: " + ", ".join(mismatch)
            continue
        container = source_set["setId"]
        quests[qid] = dict(catalogSourceHash=original["sourceHash"], mapId=q["mapId"], containerSetId=container,
            sourcePointer=loc, parents=[dict(act=owner_key("act", container, a), chapter=owner_key("chapter", container, c)) for a, c in sorted(expected)],
            actImage=reference("quest", container, qid, "actImage", q["actImage"], loc),
            # These remain separate roles; generic backgrounds and reward art never become posters.
            bgImage=reference("quest", container, qid, "bgImage", q["bgImage"], loc),
            rewardImage=reference("quest", container, qid, "rewardImage", q["rewardImage"], loc))
        if q["bgImage"] == "quests/autoscale_quest_tile_champ_bg_placeholder_61c900e93209.jpg":
            refs[quests[qid]["bgImage"]]["state"] = "default"
    return dict(owners=owners, references=refs, quests=quests, excluded=excluded)


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


@lru_cache(maxsize=4)
def native_pack_index(resources):
    packs_path = resources / 'packs.txt'
    packs = json.loads(packs_path.read_text(encoding='utf-8'))
    manifest_hash = sha_bytes(packs_path.read_bytes())
    index = {}
    for pack, entry in packs['packs'].items():
        toc = resources / entry['path'] / 'toc.txt'
        if not toc.exists(): continue
        raw = toc.read_bytes(); data = json.loads(raw)
        for path in data.get('files', []):
            file = resources / entry['path'] / path
            if not file.resolve().is_relative_to(resources.resolve()): raise ValueError('Native pack path escaped resource root')
            key = Path(path).with_suffix('').as_posix().lower()
            index.setdefault(key, []).append((file, dict(pack=pack,path=path,field='files',
                packManifestSha256=manifest_hash,tocSha256=sha_bytes(raw),
                binding='PackDriver.Exists FindOptions=3: exact path, ignore extension, ordinal-ignore-case')))
    return index


def local_pack_reference(key, resources):
    """PackDriver.Exists(options=3) compares exact case-insensitive paths without extensions."""
    if resources is None or key.startswith(('http:', 'https:', 'file:')) or '..' in key:
        return None
    matches = [(p,e) for p,e in native_pack_index(resources).get(key.lower(),[]) if p.is_file()]
    return matches[0] if len(matches)==1 else None


def build(capture, catalog_path, image_cache, fetched, fetch_missing, output, assets_dir, resources=None):
    from PIL import Image, __version__ as pillow_version
    raw, catalog_bytes = capture.read_bytes(), catalog_path.read_bytes()
    document, catalog = json.loads(raw), json.loads(catalog_bytes)
    result = project(document, catalog)
    assets, resolutions = {}, {}
    ledger_path = fetched / "asset-sources.json"
    ledger = json.loads(ledger_path.read_text(encoding="utf-8")) if ledger_path.exists() else {}
    for key in sorted({r["value"] for r in result["references"].values()
                       if r["state"] == "authored" and r["field"] in {"image", "imageSmall", "imageLarge", "actImage"}}):
        uri = urlsplit(key)
        local = local_pack_reference(key, resources) if not public_url(key) else None
        if not public_url(key) and not local:
            resolutions[key] = dict(state="unresolved-resource", reason="Local native asset key requires exact loader/resource binding")
            continue
        name = hashlib.sha1(uri.path.encode("utf-8")).hexdigest().upper() + Path(uri.path).suffix
        cached = image_cache / name
        retained = fetched / (sha_bytes(key.encode()) + Path(uri.path).suffix)
        if local:
            data, origin = local[0].read_bytes(), 'exact-native-pack-file'
        elif key in ledger:
            data, origin = retained.read_bytes(), ledger[key]["origin"]
            if sha_bytes(data) != ledger[key]["sha256"]:
                raise ValueError("Retained public art bytes changed")
        elif cached.exists():
            data, origin = cached.read_bytes(), "existing-native-uri-path-cache"
        elif retained.exists():
            data, origin = retained.read_bytes(), "exact-public-art-url"
        elif fetch_missing:
            request = Request(key, headers={"User-Agent": "CereBro-public-art-export/1", "Accept": "image/*"})
            try:
                with build_opener(NoRedirect).open(request, timeout=20) as response:
                    data = response.read(8 * 1024 * 1024 + 1)
                if len(data) > 8 * 1024 * 1024:
                    raise ValueError("Public image size limit exceeded")
                with Image.open(io.BytesIO(data)) as image:
                    if image.format not in {"JPEG", "PNG", "WEBP"}:
                        raise ValueError("Unsupported public image byte format")
                    image.verify()
                fetched.mkdir(parents=True, exist_ok=True)
                retained.write_bytes(data)
                origin = "exact-public-art-url"
            except Exception as error:
                resolutions[key] = dict(state="unavailable", reason=type(error).__name__)
                continue
        else:
            resolutions[key] = dict(state="unavailable", reason="Exact URL not cached; no fetch requested")
            continue
        if len(data) > 8 * 1024 * 1024:
            raise ValueError("Public image size limit exceeded")
        with Image.open(io.BytesIO(data)) as image:
            if image.format not in {"JPEG", "PNG", "WEBP"}:
                raise ValueError("Unsupported public image byte format")
            if image.width * image.height > 16_000_000:
                raise ValueError("Public artwork dimensions exceeded")
            image.verify()
        fetched.mkdir(parents=True, exist_ok=True)
        retained.write_bytes(data)
        ledger[key] = dict(origin=origin, sha256=sha_bytes(data), file=retained.name, uriPath=uri.path, cacheKey=name)
        if local: ledger[key]['nativePack'] = local[1]
        with Image.open(io.BytesIO(data)) as image:
            if image.width * image.height > 16_000_000:
                raise ValueError("Public artwork dimensions exceeded")
            image.load()
            buffer = io.BytesIO()
            image.save(buffer, format="WEBP", lossless=True, exact=True, method=6)
            exported = buffer.getvalue()
            digest = sha_bytes(exported)
            assets_dir.mkdir(parents=True, exist_ok=True)
            (assets_dir / (digest + ".webp")).write_bytes(exported)
            assets[digest] = dict(url="/game-quests/menu-art/" + digest + ".webp", sha256=digest,
                                  sourceSha256=sha_bytes(data), width=image.width, height=image.height)
        resolutions[key] = dict(state="resolved", asset=digest, origin=origin, cacheKey=name,
                                uriPath=uri.path, sourceSha256=sha_bytes(data))
        if local: resolutions[key]['nativePack'] = local[1]
    for ref in result["references"].values():
        resolution = resolutions.get(ref["value"])
        if resolution:
            ref["asset"] = resolution.get("asset")
            if not ref["asset"]:
                ref["state"] = resolution["state"]
    ledger_path.write_text(json.dumps(ledger, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n", encoding="utf-8")
    result.update(version=2, id="public-quest-menu-art-20261109-v2", captureSha256=sha_bytes(raw),
        assetSourcesSha256=sha_bytes(ledger_path.read_bytes()),
        capturedAt=document["capturedAt"], catalogSha256=sha_bytes(catalog_bytes),
        gameAssemblySha256=document["gameAssemblySha256"], captureReaderSha256=document["readerSha256"],
        layoutSha256=document["layoutSha256"], exporterSha256=sha_bytes(Path(__file__).read_bytes()),
        resolution="Native resolved image strings; original localization/CDN flags are not synthesized",
        encoding=dict(library="Pillow", version=pillow_version, format="WEBP", lossless=True, exact=True, method=6),
        policy="Only exact captured art roles and source-hash-bound correlated parents; no opponent portraits, reward art substitution, live availability or terrain reassignment",
        assets=assets, resolutions=resolutions)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(json.dumps(dict(boundQuestIdentities=len(result["quests"]), excluded=result["excluded"], assets=len(assets),
                          resolvedKeys=sum(r["state"] == "resolved" for r in resolutions.values()), unresolvedKeys={k:v["state"] for k,v in resolutions.items() if v["state"] != "resolved"})))


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--capture", type=Path, required=True)
    p.add_argument("--image-cache", type=Path, required=True)
    p.add_argument("--fetched", type=Path, required=True)
    p.add_argument("--fetch-missing", action="store_true")
    p.add_argument("--catalog", type=Path, default=REPO / "src/data/game-quests/catalog.json")
    p.add_argument("--resources", type=Path, help="Installed native Data root for exact loose-pack keys")
    p.add_argument("--output", type=Path, default=REPO / "src/data/game-quests/menu-art.json")
    p.add_argument("--assets", type=Path, default=REPO / "web/public/game-quests/menu-art")
    args = p.parse_args()
    build(args.capture, args.catalog, args.image_cache, args.fetched, args.fetch_missing, args.output, args.assets, args.resources)
