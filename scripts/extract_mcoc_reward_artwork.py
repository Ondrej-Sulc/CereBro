"""Extract exact reward artwork bindings and pixel-preserving assets from game definitions.

No guessed IDs, synthesized icons, account data or nested reward expansion.
"""
from __future__ import annotations

import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import io
import json
import math
from pathlib import Path
from PIL import Image

from extract_mcoc_crystal_artwork import CDN_BASE, cache_file, download, export_image, resource_index, safe_reference
from extract_mcoc_crystal_rules import validate_contracts
from mcoc_protobuf import Decoder, fields

# Exact default GetTexture branches in CustomRedeemerMappings.ResourceRedeemerMapping.
RESOURCE_ART = {'sc': 'resources/resource_currency_soft', 'hc': 'resources/resource_currency_hard',
    'ap': 'resources/resource_ap', 'ave': 'resources/resource_ave', 'der': 'resources/resource_der',
    'xp': 'resources/resource_xp', 'pvp-cur': 'resources/resource_energy_cur',
    'pve-energy': 'resources/resource_energy_pve'}
REVIEWED_METADATA = {'Marvel.Runtime.dll': 'd1b1085922513073b9dcd656aa08ee70e01a7aef1433aa35876fdfba463278b5',
    'Fuse.Runtime.dll': 'c7296f9c50334d3f12ece5ae2e7c9566d6965cc355c9eecad8af8acfe561a24b'}
INVENTORY_SHADER = 'EBG/UI/OverlayColored'
REVIEWED_OVERLAY_SHADER = '60d753e9a57e49ea3c53f436c9061571fc1ac90ffc8e69c83af1f4afd3e22d5e'
REVIEWED_MATERIAL_BINDINGS = '7d6c8c80868340a3c215545b7e1ac8f675ed3bde4f94e9b91a49889d363e93a3'


def inventory_shader_provenance(resources, palette_source):
    """Pin the shipped shader whose DXBC pixel operation was reviewed (see docs)."""
    import UnityPy
    digest = hashlib.sha256(resources.read_bytes()).hexdigest()
    if digest != palette_source['sha256']: raise ValueError('Inventory shader/palette resources mismatch')
    matches = []
    for obj in UnityPy.load(str(resources)).objects:
        if obj.type.name == 'Shader' and obj.read().m_ParsedForm.m_Name == INVENTORY_SHADER:
            matches.append(obj)
    if len(matches) != 1: raise ValueError('Expected one exact inventory overlay shader')
    obj = matches[0]; object_hash = hashlib.sha256(obj.get_raw_data()).hexdigest()
    if object_hash != REVIEWED_OVERLAY_SHADER: raise ValueError('Inventory overlay shader requires review')
    return {'name': INVENTORY_SHADER, 'fileName': resources.name, 'sha256': digest,
            'pathId': obj.path_id, 'objectSha256': object_hash}


def resolve_inventory_tint(item, hero_classes, colors):
    # Reviewed neutral champion-consumable branch only. Other inventory artwork
    # keeps its existing pixels until its own renderer has been reviewed.
    if (item.get('image', {}).get('en') not in {'inventory/Awaken', 'inventory/SkillUp'} or
        item.get('ImageS3') or not item.get('UseOnHero') or item.get('SigState') not in {'a', 'd'}):
        return {}
    if hero_classes is None: raise ValueError('Inventory rendering requires exact BCG hero classes')
    by_id = {}
    for row in hero_classes:
        if row['ClassID'] in by_id: raise ValueError('Duplicate BCG hero class')
        by_id[row['ClassID']] = row
    # GetClassFromTags scans (HTags + "," + Name), trimmed/lowercased comma
    # groups and then colon tokens, returning the first exact BCG class match.
    for group in (item.get('HTags', '') + ',' + item['Name']).split(','):
        for token in group.strip().lower().split(':'):
            if token not in by_id: continue
            if by_id[token].get('_defaultColour'): raise ValueError('Explicit BCG class color requires review')
            key = 'class_' + token
            if key not in colors: raise ValueError('Missing exact inventory class color: ' + key)
            return {'classId': token, 'renderTint': {'source': 'color-dictionary', 'key': key,
                    'rgba': colors[key], 'blendMode': 'overlay'}}
    return {}  # No recognized class: game uses white + BlendColored (unchanged).


def resolve_material_tint(evo, colors):
    # GameBCGUtils.GetEvoBlueprintColor: named BlueprintType flags, then
    # BCGEvoBlueprintBase.TintColor (explicit RGB or GetHeroClassColor).
    kind=evo.get('_evoType','none')
    class_tinted={'blueprint','evolve','events','relic','relic_enhance','relic_blueprint'}
    if kind not in class_tinted|{'none','enhance','relic_event'}:raise ValueError('Unreviewed blueprint rendering kind')
    explicit=evo.get('_tintColor')
    if kind in class_tinted and explicit:
        if len(explicit) not in (6,8):raise ValueError('Unreviewed explicit material tint')
        rgba=[int(explicit[i:i+2],16)/255 for i in range(0,len(explicit),2)]
        if len(rgba)==3:rgba.append(1)
        return {'source':'blueprint','rgba':rgba,'blendMode':'overlay'}
    key='class_'+evo.get('_class','none') if kind in class_tinted else 'class_iso_generic'
    if key not in colors:raise ValueError('Missing exact material color: '+key)
    return {'source':'color-dictionary','key':key,'rgba':colors[key],'blendMode':'overlay'}


def material_shader_provenance(resources, palette_source, shader=None, native_root=None):
    """Validate the reviewed catalyst portrait and reward-type shader bindings."""
    proof_path = Path(__file__).resolve().parents[1]/'src/data/game-reward-artwork/material-shader-proof.json'
    proof_bytes = proof_path.read_bytes()
    if hashlib.sha256(proof_bytes).hexdigest() != REVIEWED_MATERIAL_BINDINGS:
        raise ValueError('Material shader binding proof requires review')
    proof = json.loads(proof_bytes)
    native_root = native_root or Path('D:/CodexArtifacts/Cpp2IL-2026-11-03/IsilDump/Marvel.Runtime')
    for name, expected in proof['nativeMethods'].items():
        if hashlib.sha256((native_root/name).read_bytes()).hexdigest() != expected:
            raise ValueError('Native material shader method drift')
    for relative, expected in proof['assetBindings'].items():
        if hashlib.sha256((resources.parent/relative).read_bytes()).hexdigest() != expected:
            raise ValueError('Native material portrait binding drift')
    shader = shader or inventory_shader_provenance(resources, palette_source)
    if shader['objectSha256'] != proof['shaderObjectSha256'] or shader['sha256'] != proof['resourceSha256']:
        raise ValueError('Material shader object mismatch')
    return {**shader, 'bindingProofSha256': REVIEWED_MATERIAL_BINDINGS}


def tint_image(payload, rgba, blend_mode='multiply'):
    if len(rgba)!=4 or any(not math.isfinite(v) or not 0<=v<=1 for v in rgba):raise ValueError('Invalid material tint')
    if blend_mode not in {'multiply', 'overlay'}: raise ValueError('Unreviewed reward blend mode')
    with Image.open(io.BytesIO(payload)) as source:image=source.convert('RGBA')
    def channel(pixel, index):
        tint = rgba[index]
        if blend_mode == 'multiply' or index == 3:
            return min(255, math.floor(pixel*tint+0.5))
        value = pixel / 255
        # Exact OverlayColored DXBC: low texture channels multiply by 2;
        # high channels screen by 2. Alpha always multiplies independently.
        value = 2*value*tint if value <= 0.5 else 1-2*(1-value)*(1-tint)
        return min(255, max(0, math.floor(255*value+0.5)))
    channels=[band.point([channel(pixel,index) for pixel in range(256)]) for index,band in enumerate(image.split())]
    encoded=io.BytesIO();Image.merge('RGBA',channels).save(encoded,format='PNG')
    return encoded.getvalue()


def build_bindings(openings, gacha, evos, store_items, colors=None, additional_inventory=(), hero_classes=None):
    needed = sorted({(row['type'], row['data']) for container in openings.get('categories', []) + openings.get('bonusRewards', [])
                     for row in container['rewards'] if row['type'] not in ('hero', 'hcos')} | {('inv', item_id) for item_id in additional_inventory})
    inventory, evo_by_id, token_boxes = {}, {}, {}
    for item in store_items:
        if item.get('Name'): inventory.setdefault(item['Name'], []).append(item)
    for item in evos:
        if item['EvoBlueprint'] in evo_by_id: raise ValueError('Duplicate EvoBlueprint')
        evo_by_id[item['EvoBlueprint']] = item
    for group in gacha.get('groups', []):
        for box in group.get('Set', {}).get('Boxes', []):
            if box.get('Token'): token_boxes.setdefault(box['Token'], []).append(box)
    bindings, missing = [], []
    for typ, data in needed:
        role = 'fragment' if typ in ('gf', 'ebpf') else 'full'
        base = {'type': typ, 'data': data, 'role': role}
        choices, annotations = set(), {}
        registry = {'inv': 'gamestore', 'ebp': 'evo', 'ebpf': 'evo', 'gs': 'crystal-token', 'gf': 'crystal-token', 'res': 'resource-dispatch'}.get(typ)
        if typ == 'inv':
            renderings = set()
            for row in inventory.get(data, []):
                reference = row.get('image', {}).get('en')
                if reference:
                    choices.add(('cdn' if row.get('ImageS3') else 'resource', safe_reference(reference)))
                    rendering = resolve_inventory_tint(row, hero_classes, colors) if colors is not None else {}
                    renderings.add(json.dumps(rendering, sort_keys=True))
            if len(renderings) > 1:
                missing.append({**base, 'reason': 'ambiguous-registry-artwork'}); continue
            if renderings: annotations.update(json.loads(next(iter(renderings))))
        elif typ in ('ebp', 'ebpf'):
            row = evo_by_id.get(data, {})
            reference = row.get('_imgID')
            if reference:
                # BCGEvoBlueprintBase.TexturePath + exact fragment helper suffix.
                source = 'cdn' if row.get('_s3ImgID') else 'resource'
                reference = reference if source == 'cdn' else 'portraits/' + reference
                choices.add((source, safe_reference(reference + ('_fragment' if role == 'fragment' else ''))))
                if row.get('_tintColor'): annotations['tintColor'] = row['_tintColor']
                if row.get('_class'): annotations['classId'] = row['_class']
                if colors is not None:annotations['renderTint']=resolve_material_tint(row,colors)
        elif typ in ('gs', 'gf'):
            member, flag = ('_tokenImage', 'TokenImageOnCDN') if typ == 'gs' else ('_fragmentImage', 'FragmentImageOnCDN')
            for row in token_boxes.get(data, []):
                reference = row.get(member, {}).get('en')
                if reference: choices.add(('cdn' if row.get(flag) else 'resource', safe_reference(reference)))
        elif typ == 'res' and data in RESOURCE_ART:
            choices.add(('resource', RESOURCE_ART[data]))
        if len(choices) == 1:
            source, reference = next(iter(choices))
            bindings.append({**base, 'registry': registry, 'registryId': data, 'source': source, 'reference': reference,
                             'tintApplied': 'renderTint' in annotations, **annotations})
        else:
            missing.append({**base, 'reason': 'ambiguous-registry-artwork' if len(choices) > 1 else 'no-verified-artwork-reference'})
    return {'bindings': bindings, 'missing': missing}


def extract(args):
    opening_bytes = args.catalog.read_bytes(); openings = json.loads(opening_bytes)
    schema = json.loads(args.schema.read_text(encoding='utf8'))
    metadata = {Path(row['path'].replace('\\', '/')).name: row['sha256'] for row in schema['sources']}
    if metadata != REVIEWED_METADATA: raise ValueError('Reward artwork dispatch requires review for changed game metadata')
    validate_contracts(schema)
    source_files, raw = [], {}
    for kind, path in [('gacha', args.gacha), ('bcg', args.bcg), ('gameStore', args.gamestore)]:
        payload = path.read_bytes(); digest = hashlib.sha256(payload).hexdigest(); raw[kind] = payload
        expected = openings['source']['gachaSha256'] if kind == 'gacha' else next(row['sha256'] for row in openings['source']['displayMetadata'] if row['kind'] == kind)
        if digest != expected: raise ValueError(f'Artwork registry snapshot mismatch: {kind}')
        source_files.append({'kind': kind, 'fileName': path.name, 'sha256': digest, 'bytes': len(payload)})
    decoder = Decoder(schema); gacha = decoder.message(raw['gacha'], 'EB.Sparx.GachaDataBuffer')
    store = decoder.message(raw['gameStore'], 'EB.Sparx.GameStoreDataBuffer')
    evos = [decoder.message(value, 'BCGEvoBlueprintBase') for tag, wire, value, _ in fields(raw['bcg']) if tag == 5 and wire == 2]
    hero_classes = [decoder.message(value, 'BCGHeroClass') for tag, wire, value, _ in fields(raw['bcg']) if tag == 9 and wire == 2]
    if decoder.unknown: raise ValueError('Unknown reward artwork registry fields')
    palette_bytes=args.palette.read_bytes();palette=json.loads(palette_bytes)
    if palette.get('version')!=1 or palette['source']['metadataSha256']!=REVIEWED_METADATA['Marvel.Runtime.dll']:raise ValueError('Unreviewed reward palette')
    acquisition_path = getattr(args, 'acquisition_catalog', None)
    additional_inventory = [piece['itemId'] for method in json.loads(acquisition_path.read_text(encoding='utf8'))['methods'] for piece in method.get('pieces', [])] if acquisition_path else []
    plan = build_bindings(openings, gacha, evos, [item for group in store.get('items', {}).values() for item in group.get('gameStoreItems', [])],palette['colors'],additional_inventory,hero_classes)
    shader = inventory_shader_provenance(args.resources.parent.parent/'resources.assets', palette['source'])
    material_shader = material_shader_provenance(args.resources.parent.parent/'resources.assets', palette['source'], shader)
    game_metadata = args.game_metadata.read_bytes()
    if CDN_BASE.encode() not in game_metadata: raise ValueError('Unverified game artwork CDN')
    existing_bytes = args.crystal_artwork.read_bytes(); existing = json.loads(existing_bytes)
    reused_by_ref = {}
    for image in existing['assets']:
        if image['role'] == 'primary': reused_by_ref.setdefault((image['source'], image['reference']), []).append(image)
    local = resource_index(args.resources)
    by_reference = {}
    for binding in plan['bindings']: by_reference.setdefault((binding['source'], binding['reference']), []).append(binding)

    def resolve(pair):
        (source, reference), bindings = pair
        reusable = reused_by_ref.get((source, reference), [])
        if reusable and len({image['sha256'] for image in reusable}) == 1 and not any(binding['tintApplied'] for binding in bindings):
            image = reusable[0]
            return [{**binding, 'origin': 'published-crystal', 'reuseUrl': image['url'],
                **{key: image[key] for key in ['sha256', 'inputSha256', 'width', 'height']}} for binding in bindings], []
        path = cache_file(args.cache, reference) if source == 'cdn' else local.get(str(Path(reference).with_suffix('')).replace('\\', '/').lower())
        try:
            if path and path.is_file(): payload, origin = path.read_bytes(), 'game-cache' if source == 'cdn' else 'game-resource'
            elif source == 'cdn' and args.download_missing: payload, origin = download(reference, args.download_cache), 'game-cdn'
            else: return [], [{**binding, 'reason': 'not-in-local-game-files'} for binding in bindings]
            # Same physical pixels may serve multiple exact reward identities.
            images = {}
            for binding in bindings:
                role = binding['role'];tint=binding.get('renderTint');key=(role,json.dumps(tint,sort_keys=True))
                if key not in images:
                    rendered=tint_image(payload,tint['rgba'],tint.get('blendMode','multiply')) if tint else payload
                    images[key]=export_image(rendered,args.assets/role)
                    images[key]['inputSha256']=hashlib.sha256(payload).hexdigest()
            return [{**binding, 'origin': origin, **images[(binding['role'],json.dumps(binding.get('renderTint'),sort_keys=True))]} for binding in bindings], []
        except Exception as error:
            # Only a safe class/status is published, never local paths or response bodies.
            reason = f'HTTP-{error.code}' if hasattr(error, 'code') else 'unreadable-game-artwork'
            return [], [{**binding, 'reason': reason} for binding in bindings]
    assets, missing = [], plan['missing'][:]
    with ThreadPoolExecutor(max_workers=6) as executor:
        jobs = [executor.submit(resolve, pair) for pair in sorted(by_reference.items())]
        for index, job in enumerate(as_completed(jobs), 1):
            resolved, failures = job.result(); assets.extend(resolved); missing.extend(failures)
            if index % 50 == 0: print(f'Reward references {index}/{len(jobs)}; resolved bindings {len(assets)}', flush=True)
    order = lambda row: (row['type'], row['data'], row['role'])
    return {'version': 1, 'source': {'observedAt': openings['source']['observedAt'], 'gachaSha256': openings['source']['gachaSha256'],
        'openingCatalogSha256': hashlib.sha256(opening_bytes).hexdigest(), 'registries': source_files,
        'metadata': openings['source']['metadata'], 'gameMetadataSha256': hashlib.sha256(game_metadata).hexdigest(),
        'colorDictionary':{key:value for key,value in palette['source'].items() if key!='metadataSha256'}|{'paletteSha256':hashlib.sha256(palette_bytes).hexdigest()},
        'inventoryShader': shader, 'materialShader': material_shader,
        'cdnBaseUrl': CDN_BASE, 'reusedCrystalManifestSha256': hashlib.sha256(existing_bytes).hexdigest()},
        'assets': sorted(assets, key=order), 'missing': sorted(missing, key=order),
        'coverage': {'bindings': len(assets) + len(missing), 'resolved': len(assets), 'missing': len(missing),
                     'resolvedByType': dict(sorted(Counter(row['type'] for row in assets).items()))}}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for option in ['catalog', 'gacha', 'bcg', 'gamestore', 'schema', 'palette', 'resources', 'cache', 'game-metadata', 'crystal-artwork', 'manifest', 'assets', 'download-cache']:
        parser.add_argument('--' + option, type=Path, required=True)
    parser.add_argument('--download-missing', action='store_true')
    parser.add_argument('--acquisition-catalog', type=Path, help='Include exact collection-piece inventory IDs alongside crystal rewards')
    args = parser.parse_args(); result = extract(args)
    args.manifest.parent.mkdir(parents=True, exist_ok=True)
    args.manifest.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':'))+'\n', encoding='utf8')
    print(json.dumps(result['coverage'], indent=2))
