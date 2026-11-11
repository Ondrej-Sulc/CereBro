"""Offline, source-bound node glyphs and defender portraits; no game/DB/network IO.

Uses the QuestBuffData renderer, not glossary-name matching or generic node art.
The separate catalog/use projections are read-only inputs and stay byte-identical.
"""
import argparse
import hashlib
import io
import json
import subprocess
from pathlib import Path

from PIL import Image
from extract_mcoc_node_modifiers import digest_json, pinned
from mcoc_protobuf import Decoder, fields


def sha(data):
    return hashlib.sha256(data).hexdigest()


def icon_binding(version, appearances):
    raw = version['raw']
    row = dict(versionHash=version['hash'], glyph=None, componentId=None, appearanceId=None,
               applicationHashes=[a['hash'] for a in version['applications']])
    if raw.get('iconTexture') or raw.get('glyphIcon'):
        return dict(row, status='unreviewed-direct-icon')
    glyphs = {a['raw'].get('buffAppearance') or '' for a in version['applications']}
    if len(glyphs) != 1:
        return dict(row, status='multiple-application-glyphs')
    glyph = next(iter(glyphs))
    row['glyph'] = glyph
    if raw.get('buffType') in ('statMods', 'statModsWithAuth'):
        ids = raw.get('valueStr') or []
        component = next((c for c in version['components'] if ids and c['id'] == ids[0]), None)
        if not component:
            return dict(row, status='unresolved-first-component')
        row.update(componentId=component['id'], appearanceId=component['raw'].get('AppearanceID'))
        appearance = appearances.get(row['appearanceId'])
        if not appearance:
            return dict(row, status='unresolved-appearance')
        row['appearanceHash'] = digest_json(appearance)
        if appearance.get('IconTexture', '') != glyph:
            raise ValueError(f'Appearance drift: {version["hash"]}')
        row['kind'] = 'first-component-appearance-glyph'
    elif raw.get('buffType') == 'bcg' and glyph in ('H', 'k', '¢'):
        # Captured appearance, supported by the named native bcg branch. The
        # missing raw attr parameter is not reconstructed from the English name.
        row['kind'] = 'captured-bcg-glyph'
    else:
        return dict(row, status='unsupported-renderer-binding')
    # Font character codes are opaque: even '-' is a native dice outline.
    # Missing font outlines are held by the font export stage, not guessed here.
    return dict(row, status='verified' if len(glyph) == 1 else 'missing-glyph')


def public_bindings(rows):
    result = {}
    for row in rows:
        identity = row.get('gameId')
        if not identity:
            continue
        if identity in result:
            raise ValueError(f'Duplicate gameId: {identity}')
        result[identity] = dict(name=row.get('name'), id=row.get('id'), slug=row.get('slug'),
                                href='/champions/'+row['slug'] if row.get('slug') else None)
    return result


def extract(args):
    profile = json.loads(args.profile.read_text(encoding='utf-8'))
    inputs = [args.profile, args.catalog, args.uses, args.schema, args.bcg, args.champions, args.bundle] + [Path(s['path']) for s in profile['evidence']]
    if args.out.resolve() in {p.resolve() for p in inputs}:
        raise ValueError('Output must not overwrite an input')
    for output in [args.out, args.asset_out, args.work_dir]:
        if output.resolve().is_relative_to(args.static_root.resolve()):
            raise ValueError('Outputs must not write into the installed game resources')
    for source in profile['evidence']:
        pinned(Path(source['path']), source['sha256'])
    toc_source = profile['resourceToc']
    toc = json.loads(pinned(Path(toc_source['path']), toc_source['sha256']))
    for logical, asset in toc_source['bindings'].items():
        if toc['bundles']['ui']['paths'].get(logical) != asset:
            raise ValueError('UI resource TOC binding drift')
    font_asset = toc_source['bindings'].get(profile['fontSelector'].lower(), '')
    if font_asset.replace('\\', '/').lower() != profile['fontContainer']:
        raise ValueError('Selected font/container binding drift')
    catalog_bytes = pinned(args.catalog, profile['catalogFileSha256'])
    uses_bytes = pinned(args.uses, profile['usesFileSha256'])
    catalog, uses = json.loads(catalog_bytes), json.loads(uses_bytes)
    if uses['modifierCatalogHash'] != catalog['contentHash']:
        raise ValueError('Use/catalog projection mismatch')
    schema = json.loads(pinned(args.schema, catalog['profile']['schemaSha256']))
    expected = {'BCGDataBuffer': {2: 'stat_modifier_appearance', 4: 'characters'},
                'BCGStatModifierAppearance': {1: 'ID', 9: 'IconTexture'},
                'BCGCharacterData': {1: 'Character', 4: '_imgID', 5: '_s3ImgID'}}
    for kind, names in expected.items():
        actual = {f['tag']: f['name'] for f in schema['types'][kind]['fields']}
        if any(actual.get(k) != v for k, v in names.items()):
            raise ValueError(f'Named schema drift: {kind}: {actual}')
    decoder = Decoder(schema)
    appearances, characters = {}, {}
    for tag, wire, data, _ in fields(pinned(args.bcg, catalog['profile']['bcgSha256'])):
        if tag not in (2, 4):
            continue
        if wire != 2:
            raise ValueError('Non-message artwork row')
        kind, key, target = ('BCGStatModifierAppearance', 'ID', appearances) if tag == 2 else ('BCGCharacterData', 'Character', characters)
        row = decoder.message(data, kind)
        if not row.get(key) or row[key] in target:
            raise ValueError(f'Duplicate/missing {kind}')
        target[row[key]] = row
    if decoder.unknown:
        raise ValueError('Unknown artwork BCG fields')
    icons = [dict(effectId=d['id'], **icon_binding(v, appearances)) for d in catalog['definitions'] for v in d['versions']]
    args.work_dir.mkdir(parents=True, exist_ok=True)
    args.asset_out.mkdir(parents=True, exist_ok=True)

    # Follow serialized references from the exact prefab used by the audited
    # PreFightBuffInfoItem renderer to its localized font selection.
    import UnityPy
    bundle = pinned(args.bundle, profile['bundleSha256'])
    env = UnityPy.load(bundle)
    objects = {o.path_id: o for o in env.objects}
    def follow(ref):
        if ref['m_FileID'] != 0 or ref['m_PathID'] not in objects:
            raise ValueError('Unresolved prefab reference')
        return objects[ref['m_PathID']].read_typetree()
    prefab = env.container[profile['prefab']].read_typetree()
    components = [follow(c['component']) for c in prefab['m_Component']]
    renderer = next(c for c in components if '_buffTypeLabel' in c)
    label = follow(renderer['_buffTypeLabel'])
    selector = follow(label['mCustomFont'])
    if selector['_defaultFontPath'] != profile['fontSelector'] or selector.get('_replacements'):
        raise ValueError('Font selection drift')
    # Bind the selected resource key and object kind, not a similarly named font.
    fonts = [o for key, o in env.container.items() if key == profile['fontContainer'] and o.type.name == 'Font']
    if len(fonts) != 1:
        raise ValueError('Ambiguous shipped font')
    if str(fonts[0].path_id) != profile['renderer']['fontPathId']:
        raise ValueError('Font PPtr drift')
    tree = fonts[0].read_typetree()
    for backer in profile['fontBackers'].values():
        ref = tree[backer['field']]
        if ref['m_FileID'] != backer['fileId'] or str(ref['m_PathID']) != backer['pathId']:
            raise ValueError('Font backer PPtr drift')
        if sha(objects[ref['m_PathID']].get_raw_data()) != backer['rawSha256']:
            raise ValueError('Font backer content drift')
    font = bytes(fonts[0].read().m_FontData)
    if sha(font) != profile['fontSha256']:
        raise ValueError('Font content drift')
    font_path = args.work_dir/'node-font.ttf'
    font_path.write_bytes(font)
    glyph_input = args.work_dir/'glyph-input.json'
    glyph_input.write_text(json.dumps(sorted({i['glyph'] for i in icons if i['status'] == 'verified'}), ensure_ascii=False), encoding='utf-8')
    glyph_output = args.work_dir/'glyph-output.json'
    subprocess.run(['node', str(Path(__file__).with_name('export_mcoc_node_glyphs.cjs')), str(font_path), str(glyph_input), str(args.asset_out/'icons'), str(glyph_output)], check=True)
    glyphs = json.loads(glyph_output.read_text(encoding='utf-8'))
    for icon in icons:
        if icon['status'] == 'verified':
            icon.update(glyphs[icon['glyph']])
    public = public_bindings(json.loads(pinned(args.champions, profile['championsSha256'])))
    ids = sorted({d['gameId'] for u in uses['uses'] for p in ([u['sourceNode']] if u['sourceNode'] else [])+u['affectedNodes'] for d in p['defenders'] if d['gameId']})
    portraits = []
    for game_id in ids:
        native = characters.get(game_id)
        row = dict(gameId=game_id, public=public.get(game_id), status='unresolved-character')
        if native:
            row.update(characterHash=digest_json(native), imageId=native.get('_imgID'), remote=bool(native.get('_s3ImgID')))
            if native.get('_s3ImgID'):
                row['status'] = 'remote-portrait-not-read'
            elif native.get('_imgID'):
                ref = 'portraits/portrait_'+native['_imgID']
                matches = sorted(args.static_root.glob('ui_portraits*/'+ref+'.png'))
                hashes = {sha(p.read_bytes()) for p in matches}
                row.update(textureRef=ref, status='missing-local-portrait')
                if len(hashes) > 1:
                    raise ValueError(f'Ambiguous native portrait: {ref}')
                if matches:
                    path = matches[0]
                    image = Image.open(path).convert('RGBA')
                    output = io.BytesIO()
                    image.save(output, 'WEBP', lossless=True, exact=True, method=6)
                    data = output.getvalue(); name = sha(data)+'.webp'
                    folder = args.asset_out/'portraits'; folder.mkdir(exist_ok=True)
                    (folder/name).write_bytes(data)
                    row.update(status='verified', src='/node-modifiers/portraits/'+name, sha256=sha(data),
                               sourcePath=path.relative_to(args.static_root).as_posix(), sourceSha256=next(iter(hashes)), width=image.width, height=image.height)
        portraits.append(row)
    result = dict(schemaVersion=1, contract='cerebro.node-modifier-artwork/v1',
        modifierCatalogHash=catalog['contentHash'], modifierUsesHash=uses['contentHash'], profile=profile,
        icons=icons, portraits=portraits)
    result['contentHash'] = digest_json(result)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, ensure_ascii=False, sort_keys=True, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(dict(icons={s: sum(i['status'] == s for i in icons) for s in sorted({i['status'] for i in icons})},
        portraits={s: sum(i['status'] == s for i in portraits) for s in sorted({i['status'] for i in portraits})}, contentHash=result['contentHash'])))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['profile', 'catalog', 'uses', 'schema', 'bcg', 'champions', 'bundle', 'static-root', 'out', 'asset-out', 'work-dir']:
        parser.add_argument('--'+name, type=Path, required=True)
    extract(parser.parse_args())
