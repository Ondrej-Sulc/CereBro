"""Export only the 204 pinned additional native glyph requirements.

Offline build inputs: frozen v2 proofs, named renderer/font/PPtr evidence and
installed static UI bytes. All outputs are additive; v1/v2 stay immutable.
"""
import argparse
import copy
import hashlib
import json
import subprocess
from pathlib import Path

from build_mcoc_node_expansion import FROZEN, file_hash, load, write
from extract_mcoc_node_modifiers import digest_json, pinned, pointer

BASE_INDEX_SHA = '9fc9209fbd623aa9ceb0500362cd51d2524c177279c1e2a57ee41bc7afb7a793'
NAMESPACE = 'src/data/game-node-modifiers/v3-native-icons'
REGISTRY = 'src/domain/node-modifiers/native-game-icon-registry.ts'


def selected_font(profile, bundle):
    """Revalidate the already reviewed prefab -> label -> font -> backers chain."""
    import UnityPy
    for source in profile['evidence']: pinned(Path(source['path']), source['sha256'])
    toc_source = profile['resourceToc']
    toc = json.loads(pinned(Path(toc_source['path']), toc_source['sha256']))
    for logical, asset in toc_source['bindings'].items():
        if toc['bundles']['ui']['paths'].get(logical) != asset: raise ValueError('Native UI TOC drift')
    selected = toc_source['bindings'].get(profile['fontSelector'].lower(), '')
    if selected.replace('\\', '/').lower() != profile['fontContainer']: raise ValueError('Native font/container drift')
    env = UnityPy.load(pinned(bundle, profile['bundleSha256']))
    objects = {obj.path_id: obj for obj in env.objects}
    def follow(ref):
        if ref['m_FileID'] != 0 or ref['m_PathID'] not in objects: raise ValueError('Native renderer PPtr drift')
        return objects[ref['m_PathID']].read_typetree()
    prefab = env.container[profile['prefab']].read_typetree()
    renderer = next(row for row in [follow(item['component']) for item in prefab['m_Component']] if '_buffTypeLabel' in row)
    label = follow(renderer['_buffTypeLabel']); selector = follow(label['mCustomFont'])
    if selector['_defaultFontPath'] != profile['fontSelector'] or selector.get('_replacements'): raise ValueError('Native font selection drift')
    fonts = [obj for key, obj in env.container.items() if key == profile['fontContainer'] and obj.type.name == 'Font']
    if len(fonts) != 1 or str(fonts[0].path_id) != profile['renderer']['fontPathId']: raise ValueError('Native font PPtr drift')
    tree = fonts[0].read_typetree()
    for backer in profile['fontBackers'].values():
        ref = tree[backer['field']]
        if ref['m_FileID'] != backer['fileId'] or str(ref['m_PathID']) != backer['pathId']: raise ValueError('Native material/atlas PPtr drift')
        if hashlib.sha256(objects[ref['m_PathID']].get_raw_data()).hexdigest() != backer['rawSha256']: raise ValueError('Native material/atlas bytes drift')
    font = bytes(fonts[0].read().m_FontData)
    if hashlib.sha256(font).hexdigest() != profile['fontSha256']: raise ValueError('Native font bytes drift')
    return font


def validate_output(root, path):
    path = path.resolve()
    allowed = [root/'temp', root/NAMESPACE, root/'web/public/node-modifiers/v3', root/REGISTRY]
    if not any(path == parent or path.is_relative_to(parent) for parent in allowed):
        raise ValueError('Output must stay in the new v3 namespace or node checkout temp folder')


def export(root, bundle, bcg, schema, output, assets, work, registry_out):
    root = root.resolve()
    for path in (output, assets, work, registry_out): validate_output(root, path)
    base = root/'src/data/game-node-modifiers/v2'
    source_index_path = base/'source-index.json'
    source_index = json.loads(pinned(source_index_path, BASE_INDEX_SHA))
    for group in ('artifacts', 'definitions', 'glyphAssets', 'sharedRendererSources'):
        for source in source_index[group]: pinned(root/source['path'], source['sha256'])
    for name, expected in FROZEN.items(): pinned(base.parent/name, expected)
    artwork = load(base/'artwork.json'); index = load(base/'index.json')
    pinned(bcg, artwork['bcgSha256']); pinned(schema, artwork['schemaSha256'])
    requirements = artwork['newGlyphRequirements']
    if len(requirements) != 204: raise ValueError('Finite approved glyph requirement set drift')
    work.mkdir(parents=True, exist_ok=True)
    font_path = work/'node-font.ttf'; font_path.write_bytes(selected_font(artwork['rendererProfile'], bundle))
    chars_path = work/'required-glyphs.json'; write(chars_path, [row['glyph'] for row in requirements])
    geometry_path = work/'geometry.json'
    subprocess.run(['node', str(Path(__file__).with_name('export_mcoc_node_game_glyphs.cjs')), str(font_path), artwork['rendererProfile']['fontSha256'], str(chars_path), str(assets), str(geometry_path)], check=True)
    glyphs = load(geometry_path); glyph_map = {row['glyph']: row for row in glyphs}
    if len(glyph_map) != len(requirements): raise ValueError('Incomplete/duplicate finite glyph export')
    for row in glyphs:
        if row['status'] == 'verified': pinned(assets/(row['sha256']+'.svg'), row['sha256'])
    registry = [dict(key=row['iconKey'], src=row['src']) for row in glyphs if row['status']=='verified']
    if len({row['key'] for row in registry}) != len(registry): raise ValueError('Native icon key collision')
    registry_out.parent.mkdir(parents=True, exist_ok=True)
    registry_out.write_text('// Generated finite game-only extension. Curated choices remain v1.\nexport const additionalNativeGameIcons = '+json.dumps(registry, ensure_ascii=False, indent=2)+' as const\n', encoding='utf-8')
    definitions = {(row['effectId'],row['versionHash']): row for row in artwork['definitionSources']}
    v2_art_source = dict(path='src/data/game-node-modifiers/v2/artwork.json',sha256=file_hash(base/'artwork.json'))
    new_proofs, unresolved, bindings, final_keys = [], [], {}, {}
    for ai, original in enumerate(artwork['applications']):
        proof = copy.deepcopy(original)
        proof['sourceV2Proof'] = dict(**v2_art_source,pointer=f'/applications/{ai}')
        identity = (proof['effectId'],proof['versionHash'],proof['applicationHash'])
        if proof['status'] == 'shape-not-exported':
            geometry = glyph_map[proof['glyph']]
            proof['status'] = geometry['status']
            if geometry['status'] == 'verified':
                proof.update(iconKey=geometry['iconKey'],svgPath='web/public'+geometry['src'],svgSha256=geometry['sha256'],glyphIndex=geometry['glyphIndex'],fontSha256=artwork['rendererProfile']['fontSha256'])
                key = (proof['effectId'],proof['versionHash'],proof['glyph'])
                if key not in bindings:
                    bindings[key] = {k:v for k,v in proof.items() if k not in ('applicationHash','applicationHashes','source','sourceV2Proof')}
                    bindings[key].update(fullDefinition=definitions[key[:2]], applicationHashes=[])
                bindings[key]['applicationHashes'].append(proof['applicationHash'])
            new_proofs.append(proof)
        elif proof['status'] != 'verified': unresolved.append(proof)
        final_keys[identity] = proof.get('iconKey') if proof['status']=='verified' else None
    overlay_rows, assignment_count, all_assigned = [], 0, 0
    summaries = {row['id']:row for row in index['records']}
    for row in source_index['definitions']:
        detail = load(root/row['path']); definition = detail['definition']; keys=[]
        for version in definition['versions']:
            # Recompute full source identity from the immutable raw/component data.
            version_body = {key:version[key] for key in ('raw','components','missingComponentIds','sourceBcgSha256')}
            if digest_json(version_body) != version['hash']: raise ValueError('Full native definition/version drift')
            for app in version['applications']:
                identity = (definition['id'],version['hash'],app['hash'])
                keys.append(final_keys.get(identity))
        if keys and keys[0] and all(key==keys[0] for key in keys) and keys[0] != summaries[definition['id']].get('iconKey'):
            overlay_rows.append(dict(effectId=definition['id'],versionHashes=sorted(v['hash'] for v in definition['versions']),iconKey=keys[0]))
        for use in detail['projection']['uses']:
            identity = (definition['id'],use['versionHash'],use['applicationHash'])
            count=len(use.get('assignments',[]))
            icon_key = final_keys.get(identity)
            if icon_key:
                all_assigned += count
                if icon_key.startswith('node-game-glyph-'): assignment_count += count
    glyph_art = dict(contract='cerebro.node-native-glyphs/v3',baseSourceIndexSha256=BASE_INDEX_SHA,catalogHash=index['catalogHash'],
        fontSha256=artwork['rendererProfile']['fontSha256'],rendererProfile=artwork['rendererProfile'],requirementHash=digest_json(requirements),glyphs=glyphs)
    glyph_art['contentHash']=digest_json(glyph_art)
    bound = dict(contract='cerebro.node-game-icon-bindings/v3',baseSourceIndexSha256=BASE_INDEX_SHA,catalogHash=index['catalogHash'],bcgSha256=artwork['bcgSha256'],
        glyphArtifactHash=glyph_art['contentHash'],bindings=[bindings[key] for key in sorted(bindings)])
    bound['contentHash']=digest_json(bound)
    applications = dict(contract='cerebro.node-game-icon-applications/v3',baseSourceIndexSha256=BASE_INDEX_SHA,catalogHash=index['catalogHash'],bcgSha256=artwork['bcgSha256'],
        bindingArtifactHash=bound['contentHash'],applications=new_proofs,unresolved=unresolved)
    applications['contentHash']=digest_json(applications)
    overlay = dict(contract='cerebro.node-game-icon-overlay/v3',baseSourceIndexSha256=BASE_INDEX_SHA,catalogHash=index['catalogHash'],bcgSha256=artwork['bcgSha256'],
        bindingArtifactHash=bound['contentHash'],definitions=sorted(overlay_rows,key=lambda row:row['effectId']))
    overlay['contentHash']=digest_json(overlay)
    outputs={'glyphs.json':glyph_art,'icon-bindings.json':bound,'application-proofs.json':applications,'overlay.json':overlay}
    for name, value in outputs.items(): write(output/name,value)
    source_contract=dict(contract='cerebro.node-game-icon-extension-sources/v3',baseSourceIndex=dict(path='src/data/game-node-modifiers/v2/source-index.json',sha256=BASE_INDEX_SHA),
        catalogHash=index['catalogHash'],bcgSha256=artwork['bcgSha256'],fontSha256=glyph_art['fontSha256'],
        artifacts=[dict(path=NAMESPACE+'/'+name,sha256=file_hash(output/name)) for name in outputs],
        registry=dict(path=REGISTRY,sha256=file_hash(registry_out)),
        assets=[dict(path='web/public'+row['src'],sha256=row['sha256'],iconKey=row['iconKey'],glyph=row['glyph']) for row in glyphs if row['status']=='verified'],
        exporters=[dict(path='scripts/'+path.name,sha256=file_hash(path)) for path in [Path(__file__),Path(__file__).with_name('export_mcoc_node_game_glyphs.cjs')]],
        stats=dict(requiredGlyphs=len(requirements),exportedGlyphs=len(registry),newVersionGlyphBindings=len(bindings),newApplicationBindings=sum(p['status']=='verified' for p in new_proofs),
            unresolvedFirstComponent=sum(p['status']=='unresolved-first-component' for p in unresolved),missingGlyph=sum(p['status']=='missing-glyph' for p in unresolved),
            gameDefinitionOverlays=len(overlay_rows),newTileAssignmentBindings=assignment_count,totalTileAssignmentBindings=all_assigned))
    source_contract['contentHash']=digest_json(source_contract);write(output/'source-index.json',source_contract)
    print(json.dumps(source_contract['stats']))


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    for name in ['root','bundle','bcg','schema','output','assets','work','registry-out']: parser.add_argument('--'+name,type=Path,required=True)
    args=parser.parse_args();export(args.root,args.bundle,args.bcg,args.schema,args.output,args.assets,args.work,args.registry_out)
