"""Freeze exact v2 definition/glyph proofs for later build-time consumers.

Reuses only the immutable reviewed SVG registry; never exports new shapes or
changes v1 artifacts, quest files, database data, or runtime shared code.
"""
import argparse
import json
from pathlib import Path

from build_mcoc_node_expansion import FROZEN, definition_version, file_hash, load, write
from extract_mcoc_node_modifiers import digest_json, pinned
from extract_mcoc_node_artwork import icon_binding
from mcoc_protobuf import Decoder, fields


def exact_proof(version, application, appearances, glyph_assets):
    # The named renderer chooses the first exact component, then AppearanceID,
    # then IconTexture. The captured glyph must agree; no title-based inference.
    result = icon_binding(dict(version, applications=[application]), appearances)
    if result['status'] == 'verified':
        asset = glyph_assets.get(result['glyph'])
        if asset:
            result.update(iconKey=asset['iconKey'], svgPath=asset['svgPath'], svgSha256=asset['svgSha256'])
        else:
            result['status'] = 'shape-not-exported'
    return result


def project(root, index_path, bcg, schema, output):
    root, index_path, output = root.resolve(), index_path.resolve(), output.resolve()
    original = root/'src/data/game-node-modifiers'
    if output.resolve() == original.resolve() or output.resolve().is_relative_to(bcg.resolve().parent):
        raise ValueError('Output must be a separate versioned evidence folder')
    for name, expected in FROZEN.items(): pinned(original/name, expected)
    index = load(index_path)
    decoder = Decoder(json.loads(pinned(schema, index['profile']['schemaSha256'])))
    appearances, components = {}, {}
    for tag, wire, data, _ in fields(pinned(bcg, index['profile']['bcgSha256'])):
        if tag not in (1, 2): continue
        kind, target = ('BCGStatModifier', components) if tag == 1 else ('BCGStatModifierAppearance', appearances)
        row = decoder.message(data, kind)
        if row['ID'] in target: raise ValueError('Duplicate native artwork source identity')
        target[row['ID']] = row
    if decoder.unknown: raise ValueError('Unknown named artwork schema')
    old_art, old_keys = load(original/'artwork.json'), load(original/'icon-bindings.json')
    keys = {(row['effectId'], row['versionHash']): row['iconKey'] for row in old_keys['bindings']}
    assets = {}
    for row in old_art['icons']:
        if row['status'] != 'verified': continue
        path = 'web/public'+row['src']
        pinned(root/path, row['sha256'])
        value = dict(iconKey=keys[(row['effectId'], row['versionHash'])], svgPath=path, svgSha256=row['sha256'])
        if row['glyph'] in assets and assets[row['glyph']] != value: raise ValueError('Ambiguous reviewed glyph shape')
        assets[row['glyph']] = value
    # The original renderer, font/PPtr/atlas evidence is independently frozen.
    for source in old_art['profile']['evidence']: pinned(Path(source['path']), source['sha256'])
    definitions, proofs, bindings, required, source_files = [], [], {}, {}, []
    for summary in index['records']:
        import hashlib
        path = index_path.parent/'details'/(hashlib.sha256(summary['id'].encode()).hexdigest()+'.json')
        detail = json.loads(pinned(path, summary['detailSha256']))
        if detail['catalogHash'] != index['catalogHash'] or detail['definition']['id'] != summary['id']:
            raise ValueError('Definition source drift')
        source = dict(path=path.relative_to(root).as_posix(), sha256=summary['detailSha256'])
        source_files.append(source)
        for vi, version in enumerate(detail['definition']['versions']):
            verified = definition_version(version['raw'], components, index['profile']['bcgSha256'])
            if version['hash'] != verified['hash']: raise ValueError('Full component-inclusive version drift')
            definitions.append(dict(effectId=summary['id'], versionHash=version['hash'], definitionHash=version['definitionHash'],
                sourceBcgSha256=version['sourceBcgSha256'], componentHashes=[dict(id=c['id'], hash=c['hash']) for c in version['components']],
                missingComponentIds=version['missingComponentIds'], source=dict(**source, pointer=f'/definition/versions/{vi}')))
            for ai, application in enumerate(version['applications']):
                proof = exact_proof(version, application, appearances, assets)
                proof.update(effectId=summary['id'], applicationHash=application['hash'],
                    source=dict(**source, pointer=f'/definition/versions/{vi}/applications/{ai}'))
                expected_key = application.get('nativeIconKey')
                if proof.get('iconKey') != expected_key: raise ValueError('Runtime/evidence icon binding drift')
                proofs.append(proof)
                if proof['status'] == 'verified':
                    key = (summary['id'], version['hash'], proof['glyph'])
                    binding = bindings.setdefault(key, {k:v for k,v in proof.items() if k not in ('applicationHash','applicationHashes','source')})
                    binding.setdefault('applicationHashes', []).append(application['hash'])
                elif proof['status'] == 'shape-not-exported':
                    glyph = proof['glyph']; row = required.setdefault(glyph, dict(glyph=glyph, codepoints=[f'U+{ord(c):04X}' for c in glyph], applications=0, versions=set(), appearanceIds=set()))
                    row['applications'] += 1; row['versions'].add((summary['id'], version['hash']))
                    if proof.get('appearanceId'): row['appearanceIds'].add(proof['appearanceId'])
    for row in required.values():
        row['versions'] = [dict(effectId=e, versionHash=v) for e,v in sorted(row['versions'])]
        row['appearanceIds'] = sorted(row['appearanceIds'])
    artwork = dict(contract='cerebro.node-modifier-artwork/v2', catalogHash=index['catalogHash'],
        bcgSha256=index['profile']['bcgSha256'], schemaSha256=index['profile']['schemaSha256'],
        immutableBaseline=FROZEN, rendererProfile=old_art['profile'], glyphAssets=assets,
        definitionSources=definitions, applications=proofs, newGlyphRequirements=[required[key] for key in sorted(required)],
        stats=dict(definitionVersions=len(definitions), applicationProofs=len(proofs), boundDefinitionGlyphs=len(bindings),
            boundApplications=sum(p['status']=='verified' for p in proofs), additionalGlyphShapes=len(required)))
    artwork['contentHash'] = digest_json(artwork)
    binding_artifact = dict(contract='cerebro.node-modifier-icon-bindings/v2', catalogHash=index['catalogHash'], artworkHash=artwork['contentHash'],
        bcgSha256=index['profile']['bcgSha256'], bindings=[bindings[key] for key in sorted(bindings)])
    binding_artifact['contentHash'] = digest_json(binding_artifact)
    write(output/'artwork.json', artwork); write(output/'icon-bindings.json', binding_artifact)
    # Relative repository paths and byte hashes are sufficient to freeze/copy
    # approved inputs later. Consumers must validate before following pointers.
    artifact_files = [(p,p) for p in [index_path,index_path.parent/'source-profile.json',index_path.parent/'portraits.json']]
    artifact_files += [(index_path.parent/name,output/name) for name in ('artwork.json','icon-bindings.json')]
    shared = ['src/domain/node-modifiers/native-icons.ts','src/domain/node-modifiers/native-icon-registry.ts','web/src/components/nodes/NodeModifierIcon.tsx']
    small = dict(contract='cerebro.node-modifier-build-sources/v2', catalogHash=index['catalogHash'],
        exporterSha256=file_hash(Path(__file__)), immutableBaseline=FROZEN,
        artifacts=[dict(path=logical.relative_to(root).as_posix(), sha256=file_hash(actual)) for logical,actual in artifact_files],
        sharedRendererSources=[dict(path=path,sha256=file_hash(root/path)) for path in shared],
        definitions=source_files, glyphAssets=[dict(path=v['svgPath'],sha256=v['svgSha256'],iconKey=v['iconKey'],glyph=k) for k,v in sorted(assets.items())])
    small['contentHash']=digest_json(small);write(output/'source-index.json',small)
    print(json.dumps(artwork['stats']))


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    for name in ['root','index','bcg','schema','output']: parser.add_argument('--'+name,type=Path,required=True)
    args=parser.parse_args();project(args.root,args.index,args.bcg,args.schema,args.output)
