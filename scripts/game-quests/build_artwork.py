"""Export only saved, exactly bound game quest-theme textures. No network/game process access."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import UnityPy

REPO = Path(__file__).resolve().parents[2]
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def read(path): return json.loads(path.read_text(encoding="utf-8"))

def build(source, resources, output, assets):
    base_path = source / "continuation/runtime-supply.json"
    base = read(base_path)
    quests = {qid: (q, base_path) for s in base["pveSets"] for qid, q in (s["QuestSummarys"] or {}).items()}
    for path in sorted((source / "expansion/maps").glob("*.json")):
        d = read(path); quests[d["quest"]["qid"]] = (d["quest"], path)
    wanted = {q["theme"] for q, _ in quests.values()}
    refs = {}
    for toc in resources.glob("*/toc.txt"):
        for bundle in read(toc).get("bundles", {}).values():
            for logical, asset in bundle.get("paths", {}).items():
                for theme in wanted:
                    if logical.lower().endswith("/prefabs/" + theme.lower()):
                        assert theme not in refs, theme
                        refs[theme] = (toc, resources / bundle["file"].replace("\\", "/"), asset.replace("\\", "/").lower())
    textures, themes, environments = {}, {}, {}
    for theme in sorted(wanted):
        if theme not in refs: continue
        toc, bundle, prefab_key = refs[theme]
        if not bundle.exists(): continue
        env = environments.setdefault(str(bundle), UnityPy.load(str(bundle))) if str(bundle) not in environments else environments[str(bundle)]
        objects = {o.path_id: o for o in env.objects}
        prefab = env.container[prefab_key]
        tree = prefab.read_typetree()
        assert tree["m_Name"] == theme
        components = [objects[c["component"]["m_PathID"]] for c in tree["m_Component"]]
        bindings = [(c, c.read_typetree()) for c in components if c.type.name == "MonoBehaviour"]
        bindings = [(c, t) for c, t in bindings if "questboardBg" in t]
        assert len(bindings) == 1
        component, component_tree = bindings[0]
        material_ref = component_tree["questboardBg"]
        if material_ref["m_FileID"] != 0: continue
        material = objects[material_ref["m_PathID"]]
        material_tree = material.read_typetree()
        main = dict(material_tree["m_SavedProperties"]["m_TexEnvs"])["_MainTex"]["m_Texture"]
        if main["m_FileID"] != 0: continue
        texture = objects[main["m_PathID"]]
        assert texture.type.name == "Texture2D"
        image = texture.read().image
        stream = io.BytesIO(); image.save(stream, format="WEBP", lossless=True, exact=True, method=6)
        raw = stream.getvalue(); digest = hashlib.sha256(raw).hexdigest()
        assets.mkdir(parents=True, exist_ok=True); (assets / (digest + ".webp")).write_bytes(raw)
        textures[digest] = dict(url="/game-quests/artwork/" + digest + ".webp", sha256=digest, width=image.width, height=image.height)
        themes[theme] = dict(image=digest, bundle=bundle.name, bundleSha256=sha(bundle), tocSha256=sha(toc),
            prefab=prefab_key, prefabPathId=str(prefab.path_id), componentPathId=str(component.path_id),
            field="questboardBg", material=material_tree["m_Name"], materialPathId=str(material.path_id),
            textureField="_MainTex", texture=texture.peek_name(), texturePathId=str(texture.path_id))
    bindings = {qid: dict(theme=q["theme"], sourceHash=sha(path), sourceFile=path.relative_to(source).as_posix()) for qid, (q, path) in quests.items()}
    result = dict(version=1, policy="Exact saved QuestSummary.theme -> named prefab -> questboardBg material -> _MainTex. Native pixels, lossless export; no CDN guesses or champion substitutions.",
        themes=themes, textures=textures, quests=bindings, missingThemes=sorted(wanted - set(themes)))
    output.parent.mkdir(parents=True, exist_ok=True); output.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Bound {len(themes)} themes / {len(textures)} native textures; {len(bindings)} quests; missing {result['missingThemes']}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-root", required=True, type=Path)
    parser.add_argument("--resources", required=True, type=Path)
    parser.add_argument("--output", type=Path, default=REPO / "src/data/game-quests/artwork.json")
    parser.add_argument("--assets", type=Path, default=REPO / "web/public/game-quests/artwork")
    a = parser.parse_args(); build(a.source_root, a.resources, a.output, a.assets)
