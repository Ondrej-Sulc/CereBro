"""Offline quest-menu art audit. Reads saved definitions/code/static assets only.

Unbound cache images are review candidates, never production quest artwork.
No network, process access, profile/preferences or non-image cache payload reads.
"""
import argparse
import collections
import hashlib
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
ART_FIELDS = {
    "Act": ("image", "imageSmall", "imageLarge", "borderImageLocked", "borderImageUnlocked"),
    "Chapter": ("image",),
    "QuestSummary": ("actImage", "bgImage", "bgImageUsesCDN", "rewardImage"),
    "QuestSet": ("cdn",),
}
PREFABS = ("storyeventpanel", "chapterpanel", "selectquesttile", "eventpanel",
           "autoscalingeventpanel", "autoscalingquesttile", "consolidatedeventpanel")


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def pointer(part):
    return str(part).replace("~", "~0").replace("/", "~1")


def exact_ids(value):
    if isinstance(value, dict):
        return {k: str(v) if k == "m_PathID" else exact_ids(v) for k, v in value.items()}
    if isinstance(value, list):
        return [exact_ids(v) for v in value]
    return value


def art_observation(kind, identity, row, source, location):
    # Missing is not empty. The saved reader's allowlist omitted these fields.
    return dict(kind=kind, identity=identity, source=source, pointer=location,
                fields={field: {"present": field in row, **({"value": row[field]} if field in row else {})}
                        for field in ART_FIELDS[kind]})


def require_omitted_art_fields(observations):
    """A negative capture finding must fail closed when its premise changes."""
    present = [(r["kind"], r["identity"], field) for r in observations
               for field, value in r["fields"].items() if value["present"]]
    if present:
        raise ValueError(f"Saved art fields now exist; review exact bindings before exporting this negative finding: {present[:3]}")


def method_evidence(root, filename, method_prefix, ranges):
    path = root / (filename + ".txt")
    blocks = path.read_text(encoding="utf-8").split("Method: ")
    matches = [b for b in blocks if b.splitlines() and b.splitlines()[0].startswith(method_prefix)]
    if len(matches) != 1:
        raise ValueError(f"Expected one exact named method, found {len(matches)}: {filename} {method_prefix}")
    block = matches[0]
    lines = block.split("ISIL:", 1)[1].splitlines()
    chosen = []
    for line in lines:
        match = re.match(r"\s+(\d+) ", line)
        if match and any(a <= int(match[1]) <= b for a, b in ranges):
            chosen.append(line.strip())
    assert chosen, (filename, method_prefix)
    return dict(file=filename + ".txt", sha256=sha(path), method=block.splitlines()[0],
                instructionRanges=ranges, instructions=chosen)


def build(source, isil, resources, cache, schema_path, output):
    from PIL import Image, ImageDraw, ImageFont
    import UnityPy
    output.mkdir(parents=True, exist_ok=True)
    evidence = {}

    def source_read(relative):
        evidence[relative] = sha(source / relative)
        return read(source / relative)

    base = source_read("continuation/runtime-supply.json")
    capture_reader = source / "capture_quests.py"
    allowlist_lines = [line.strip() for line in capture_reader.read_text(encoding="utf-8").splitlines()
                       if any(line.strip().startswith("'" + name + "':") for name in ART_FIELDS)]
    prior_capture_presence = []
    for path in sorted(source.glob("runtime-*.json")):
        prior = read(path)
        records = []
        for quest_set in prior.get("pveSets", []):
            records.append(("QuestSet", quest_set))
            for act in quest_set.get("Acts", []) or []:
                records.append(("Act", act))
                records.extend(("Chapter", c) for c in act.get("Chapters", []) or [])
            records.extend(("QuestSummary", q) for q in (quest_set.get("QuestSummarys") or {}).values())
        prior_capture_presence.append(dict(file=path.name, sha256=sha(path),
            artFieldsPresent=sum(field in row for kind, row in records for field in ART_FIELDS[kind]),
            use="Supplementary field-presence check only; not a canonical definition/graph input"))
    observations, quests = [], {}
    for si, quest_set in enumerate(base["pveSets"]):
        prefix = f"/pveSets/{si}"
        observations.append(art_observation("QuestSet", quest_set["setId"], quest_set,
                                           "continuation/runtime-supply.json", prefix))
        for ai, act in enumerate(quest_set["Acts"]):
            if not act["actId"]:
                continue
            ap = prefix + f"/Acts/{ai}"
            observations.append(art_observation("Act", act["actId"], act, "continuation/runtime-supply.json", ap))
            for ci, chapter in enumerate(act["Chapters"]):
                if chapter["chapterId"]:
                    observations.append(art_observation("Chapter", chapter["chapterId"], chapter,
                                                       "continuation/runtime-supply.json", ap + f"/Chapters/{ci}"))
        for qid, quest in (quest_set["QuestSummarys"] or {}).items():
            quests[qid] = (quest, "continuation/runtime-supply.json", prefix + "/QuestSummarys/" + pointer(qid))
    expansion_observations = []
    for path in sorted((source / "expansion/maps").glob("*.json")):
        relative = path.relative_to(source).as_posix()
        data = source_read(relative)
        q = data["quest"]
        quests[q["qid"]] = (q, relative, "/quest")
        expansion_observations.append(art_observation("QuestSummary", q["qid"], q, relative, "/quest"))
    observations.extend(art_observation("QuestSummary", qid, q, file, loc)
                        for qid, (q, file, loc) in sorted(quests.items()))
    require_omitted_art_fields(observations)
    native_specs = [
        ("Marvel.Runtime/QuestSet", "System.Void AddQuestSummarys(", [(1669, 1710), (1813, 1839), (2045, 2056), (2151, 2166)]),
        ("Marvel.Runtime/QuestSummary", "System.Void .ctor(System.Collections.IDictionary", [(566, 585), (2933, 2995)]),
        ("Marvel.Runtime/QuestSelectPanelBase", "System.Void Refresh()", [(19, 60)]),
        ("Marvel.Runtime/QuestSelectPanelBase", "System.Void LoadTexture(", [(30, 43)]),
        ("Marvel.Runtime/StoryEventPanel", "Act get_actData()", [(4, 27)]),
        ("Marvel.Runtime/ChapterPanel", "System.Void RefreshDisplay()", [(168, 177)]),
        ("Marvel.Runtime/SelectQuestTile", "System.Void RefreshBossPortraits()", [(50, 112), (163, 190), (202, 226)]),
        ("Marvel.Runtime/QuestSummary", "QuestBoss GetFinalBoss()", [(25, 82)]),
        ("Marvel.Runtime/SelectQuestTile", "System.Boolean get_useGachaBossPortrait()", [(1, 2)]),
        ("Marvel.Runtime/AutoScalingQuestTile", "System.Boolean get_useGachaBossPortrait()", [(1, 2)]),
        ("Marvel.Runtime/GameBCGUtils", "System.String GetBlueprintImageAssetPath(", [(16, 69)]),
        ("Kabam.Serialization/EB/Dot", "System.String Image(", [(30, 75), (94, 120)]),
        ("Kabam.Core.RuntimeSystems/EB/Cache", "System.String GetCacheFilename(", [(13, 46)]),
        ("Kabam.Core.RuntimeSystems/EB/Cache", "System.String GetCacheFileNoCdn(", [(26, 50), (61, 107)]),
        ("Fuse.Runtime/UITextureRef", "System.Collections.Generic.List`1<System.String> get_potentialPaths()", [(29, 79), (104, 119)]),
        ("Fuse.Runtime/UITextureRef", "System.Void RefreshTexture()", [(14, 30), (64, 68), (87, 99)]),
        ("Fuse.Runtime/UITextureRef", "System.Void .cctor()", [(19, 28)]),
    ]
    native = [method_evidence(isil, *spec) for spec in native_specs]
    layouts = source_read("layouts.json")["types"]
    offsets = {name: {f["name"]: f["offset"] for f in layouts[name]["fields"]
                      if any(key in f["name"].lower() for key in ("image", "boss", "cdn"))}
               for name in ("Act", "Chapter", "QuestSummary", "QuestSet")}
    schema = read(schema_path)
    sys.path.insert(0, str(REPO / "scripts"))
    from mcoc_protobuf import fields
    bcg_path = source / "sources/bcg-E95E28EECECC04D6A358C8FD8089D01305D0FB73.bin"
    root_fields = schema["types"]["BCGDataBuffer"]["fields"]
    wire = collections.Counter(n for n, _, _, _ in fields(bcg_path.read_bytes()))
    bcg = dict(sha256=sha(bcg_path), schemaSha256=sha(schema_path),
               rootFields=[dict(name=f["name"], tag=f["tag"], records=wire[f["tag"]]) for f in root_fields],
               unknownRootTags=sorted(set(wire) - {f["tag"] for f in root_fields}))

    toc_rows, manifests = [], []
    for toc in sorted(resources.glob("*/toc.txt")):
        manifests.append(dict(file=toc.relative_to(resources).as_posix(), sha256=sha(toc)))
        for bundle in read(toc).get("bundles", {}).values():
            for logical, asset in bundle.get("paths", {}).items():
                if re.search(r"quest|chapter|story|poster|banner|event", logical, re.I):
                    toc_rows.append(dict(key=logical, asset=asset.replace("\\", "/"),
                                         bundle=bundle["file"].replace("\\", "/"), toc=toc.relative_to(resources).as_posix()))
    bundle_path = resources / "ui/ui.assetbundle"
    env = UnityPy.load(str(bundle_path))
    objects = {o.path_id: o for o in env.objects}
    trees = {}

    def tree(identity):
        if identity not in trees:
            trees[identity] = objects[identity].read_typetree()
        return trees[identity]

    def class_name(t):
        ref = t.get("m_Script", {})
        return tree(ref["m_PathID"]).get("m_ClassName") if ref.get("m_PathID") in objects else None

    prefabs, visual_defaults, atlases = [], [], {}
    for key, obj in sorted(env.container.items(), key=lambda item: (item[0], item[1].path_id)):
        if not any(key.lower().endswith("/" + name + ".prefab") for name in PREFABS):
            continue
        root = obj.read_typetree()
        for component in root.get("m_Component", []):
            cid = component["component"]["m_PathID"]
            if objects[cid].type.name != "MonoBehaviour":
                continue
            t = tree(cid)
            cls = class_name(t)
            if cls not in ("StoryEventPanel", "ChapterPanel", "SelectQuestTile", "EventPanel",
                           "AutoScalingEventPanel", "AutoScalingQuestTile", "ConsolidatedEventPanel"):
                continue
            visual_fields = {}
            for field, value in t.items():
                if not re.search(r"texture|portrait|background|sprite", field, re.I):
                    continue
                if isinstance(value, dict) and "m_PathID" in value:
                    rid = value["m_PathID"]
                    target = tree(rid) if rid in objects else {}
                    visual_fields[field] = dict(pathId=str(rid), className=class_name(target),
                        values={k: exact_ids(v) for k, v in target.items()
                                if re.search(r"path|sprite|texture|atlas|material", k, re.I)})
                    atlas_id = target.get("mAtlas", {}).get("m_PathID", 0)
                    sprite_name = target.get("_legacySpriteName")
                    if atlas_id in objects:
                        atlas = tree(atlas_id)
                        entries = {k: [entry for entry in v if isinstance(entry, dict) and entry.get("name") == sprite_name]
                                   for k, v in atlas.items() if isinstance(v, list)}
                        atlases[str(atlas_id) + ":" + str(sprite_name)] = dict(pathId=str(atlas_id),
                            className=class_name(atlas), spriteName=sprite_name,
                            externalFiles=[dict(fileId=i + 1, path=ref.path)
                                           for i, ref in enumerate(objects[atlas_id].assets_file.externals)],
                            properties={k: exact_ids(v) for k, v in atlas.items() if not isinstance(v, list)},
                            matchingEntries={k: v for k, v in entries.items() if v})
                elif isinstance(value, str):
                    visual_fields[field] = value
            prefabs.append(dict(key=key, prefabPathId=str(obj.path_id), componentPathId=str(cid),
                                className=cls, fields=visual_fields))
    # UITextureRef paths are review defaults, not definition-specific art bindings.
    for obj in env.objects:
        if obj.type.name != "MonoBehaviour":
            continue
        t = tree(obj.path_id)
        if "_baseTexturePath" in t and re.search(r"quest|chapter|story", t["_baseTexturePath"], re.I):
            visual_defaults.append(dict(componentPathId=str(obj.path_id), className=class_name(t),
                                        path=t["_baseTexturePath"],
                                        referencePath=t.get("_referenceTexturePath", "")))
    # One exact serialized placeholder can be shown as a menu fallback, never an authored poster.
    placeholder_key = "assets/ui/images/autoscale_quest_tile_champ_bg_placeholder.jpg"
    placeholder = env.container[placeholder_key]
    placeholder_image = placeholder.read().image
    placeholder_path = output / "native-menu-placeholder.png"
    placeholder_image.save(placeholder_path)
    placeholder_evidence = dict(key=placeholder_key, pathId=str(placeholder.path_id),
                                file=placeholder_path.name, sha256=sha(placeholder_path),
                                width=placeholder_image.width, height=placeholder_image.height,
                                role="Serialized native menu placeholder; not a quest-specific poster")

    # Resolve the exact external SpriteAtlas dependency, not an art-name guess.
    ui_manifest = resources / "ui/ui.assetbundle.manifest"
    atlas_relative = "main_odr/main_atlas_procedural.assetbundle"
    assert atlas_relative in ui_manifest.read_text(encoding="utf-8")
    atlas_env = UnityPy.load(str(resources / atlas_relative))
    atlas_objects = {o.path_id: o for o in atlas_env.objects}
    packed_graphics = []
    for reference in atlases.values():
        ref = reference["properties"]["_unityAtlas"]
        target = atlas_objects[int(ref["m_PathID"])]
        external = next(f["path"] for f in reference["externalFiles"] if f["fileId"] == ref["m_FileID"])
        assert target.assets_file.name == external.rsplit("/", 1)[-1]
        atlas_tree = target.read_typetree()
        sprite_name = reference["spriteName"]
        packed_ids = {p["m_PathID"] for p in atlas_tree["m_PackedSprites"]}
        matches = [atlas_objects[i] for i in packed_ids if atlas_objects[i].peek_name() == sprite_name]
        assert len(matches) == 1, sprite_name
        sprite = matches[0]
        sprite_tree = sprite.read_typetree()
        render = next(value for key, value in atlas_tree["m_RenderDataMap"] if key == sprite_tree["m_RenderDataKey"])
        texture_id = render["texture"]["m_PathID"]
        image = sprite.read().image
        png = output / ("native-ui-" + sprite_name + ".png")
        image.save(png)
        packed_graphics.append(dict(spriteName=sprite_name, wrapperPathId=reference["pathId"],
            atlasPathId=ref["m_PathID"], archive=target.assets_file.name, spritePathId=str(sprite.path_id),
            renderDataKey=sprite_tree["m_RenderDataKey"], renderData=exact_ids(render),
            texturePathId=str(texture_id), textureName=atlas_objects[texture_id].peek_name(),
            file=png.name, sha256=sha(png), width=image.width, height=image.height,
            role="Shared native UI decoration; not authored quest art"))

    cache_rows, large_rows, all_images = [], [], []
    image_count = 0
    for path in sorted(cache.iterdir()):
        if path.suffix.lower() not in (".png", ".jpg", ".jpeg") or not path.is_file():
            continue
        with Image.open(path) as image:
            image_count += 1
            w, h = image.size
        row = dict(file=path.name, sha256=sha(path), width=w, height=h,
                   binding="Unresolved: no retained quest/parent art key", productionEligible=False)
        all_images.append(row)
        if w >= 500 and 1.35 < w / h < 5:
            cache_rows.append(row)
        elif h >= 500 and w >= 256 and w / h <= 1.35:
            large_rows.append(row)
    font = ImageFont.load_default(size=14)

    def sheet(rows, filename):
        cols = 3
        canvas = Image.new("RGB", (900, ((len(rows) + cols - 1) // cols) * 175), "#0b1420")
        draw = ImageDraw.Draw(canvas)
        for i, row in enumerate(rows):
            x, y = (i % cols) * 300, (i // cols) * 175
            with Image.open(cache / row["file"]) as image:
                image = image.convert("RGBA")
                image.thumbnail((290, 138))
                canvas.paste(image, (x + (300 - image.width) // 2, y), image)
            draw.text((x + 6, y + 140), row["file"][:16], fill="white", font=font)
            draw.text((x + 6, y + 157), f"{row['width']} x {row['height']} | UNBOUND", fill="#b7c5d8", font=font)
        canvas.save(output / filename)

    sheets = []
    for start in range(0, len(cache_rows), 12):
        name = f"candidates-{start // 12 + 1:02d}.png"
        sheet(cache_rows[start:start + 12], name)
        sheets.append(dict(file=name, sha256=sha(output / name), count=len(cache_rows[start:start + 12])))
    for start in range(0, len(large_rows), 12):
        name = f"nonwide-candidates-{start // 12 + 1:02d}.png"
        sheet(large_rows[start:start + 12], name)
        sheets.append(dict(file=name, sha256=sha(output / name), count=len(large_rows[start:start + 12])))
    compact = [r for r in cache_rows if r["width"] == 600 and r["height"] == 200]
    if compact:
        sheet(compact, "wide-banner-candidates.png")
    posters = [r for r in large_rows if r["width"] == 512 and r["height"] == 1024]
    if posters:
        canvas = Image.new("RGB", (900, ((len(posters) + 4) // 5) * 310), "#0b1420")
        draw = ImageDraw.Draw(canvas)
        for i, row in enumerate(posters):
            x, y = (i % 5) * 180, (i // 5) * 310
            with Image.open(cache / row["file"]) as im:
                im = im.convert("RGBA")
                im.thumbnail((172, 270))
                canvas.paste(im, (x + (180 - im.width) // 2, y), im)
            draw.text((x + 4, y + 274), row["file"][:14], fill="white", font=font)
            draw.text((x + 4, y + 292), "512 x 1024 | UNBOUND", fill="#b7c5d8", font=font)
        canvas.save(output / "portrait-poster-candidates.png")
    summary = {kind: dict(definitions=sum(r["kind"] == kind for r in observations),
                         fieldsPresent=sum(f["present"] for r in observations if r["kind"] == kind for f in r["fields"].values()))
               for kind in ART_FIELDS}
    result = dict(version=1, exporterSha256=sha(Path(__file__)),
        gameAssemblySha256=base["gameAssemblySha256"],
        policy="Offline evidence only. Cache images and prefab defaults never imply a quest binding or current availability.",
        definitionInputs=evidence, coverage=summary, definitionObservations=observations,
        originalCaptureAllowlist=dict(file="capture_quests.py", sha256=sha(capture_reader), lines=allowlist_lines),
        priorCaptureFieldPresence=prior_capture_presence,
        additionalDetailedCapturesAudited=len(expansion_observations), nativeEvidence=native,
        namedOffsets=offsets, bcg=bcg, installedTocs=manifests, candidateTocReferences=toc_rows,
        ui=dict(bundle="ui/ui.assetbundle", sha256=sha(bundle_path), prefabs=prefabs,
                questRelatedTextureDefaults=visual_defaults, atlasReferences=list(atlases.values()), placeholder=placeholder_evidence,
                atlasBundle=dict(file=atlas_relative, sha256=sha(resources / atlas_relative),
                                 uiManifestSha256=sha(ui_manifest), graphics=packed_graphics)),
        cache=dict(imageFiles=image_count, images=all_images, wideCandidates=cache_rows,
                   largeNonwideCandidates=large_rows, sheets=sheets,
                   compactBannerCandidates=len(compact), portraitPosterCandidates=posters),
        richerArtBindings=dict(quests=0, acts=0, chapters=0, reason="Art fields absent from accepted saved definitions; cached images have no reverse quest identity index"))
    (output / "audit.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(dict(coverage=summary, prefabCount=len(prefabs), images=image_count,
                         wideCandidates=len(cache_rows), compactCandidates=len(compact), verifiedRicherBindings=0)))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-root", type=Path, required=True)
    parser.add_argument("--isil-root", type=Path, required=True)
    parser.add_argument("--resources", type=Path, required=True)
    parser.add_argument("--image-cache", type=Path, required=True)
    parser.add_argument("--schema", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    build(args.source_root, args.isil_root, args.resources, args.image_cache, args.schema, args.output)
