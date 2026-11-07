"""Add exact selector registry artwork to an existing local reward manifest."""
from __future__ import annotations

import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path

from extract_mcoc_crystal_artwork import download, export_image, safe_reference


def bindings_for(catalog, opening_sha256):
    if catalog['version'] != 1 or catalog['source']['captureMethod'] != 'read-only-game-definition-registry':
        raise ValueError('Unreviewed selector catalog')
    if catalog['source']['openingCatalogSha256'] != opening_sha256:
        raise ValueError('Selector opening snapshot mismatch')
    ids = set()
    bindings = []
    for selector in catalog['selectors']:
        if selector['id'] in ids:
            raise ValueError('Duplicate selector identity')
        ids.add(selector['id'])
        icon = selector.get('icon')
        if icon is None:
            continue
        # This incremental exporter intentionally supports only verified CDN refs.
        if icon['source'] != 'cdn':
            raise ValueError('Selector resource artwork requires a resource extractor')
        bindings.append({'type': 'sra', 'data': selector['id'], 'role': 'full', 'source': 'cdn',
            'reference': safe_reference(icon['reference']), 'registry': 'selectable-reward',
            'registryId': selector['id'], 'tintApplied': False})
    return bindings


def extract(args):
    bundle = json.loads(args.base_manifest.read_text(encoding='utf-8'))
    catalog_bytes = args.catalog.read_bytes()
    catalog = json.loads(catalog_bytes)
    bindings = bindings_for(catalog, bundle['source']['openingCatalogSha256'])
    by_reference = {}
    for binding in bindings:
        by_reference.setdefault(binding['reference'], []).append(binding)

    def resolve(pair):
        reference, bindings = pair
        try:
            image = export_image(download(reference, args.download_cache), args.assets / 'full')
            return ([{**binding, 'origin': 'game-cdn', **image} for binding in bindings], [])
        except Exception as error:
            reason = f'HTTP-{error.code}' if hasattr(error, 'code') else 'unreadable-game-artwork'
            return ([], [{**binding, 'reason': reason} for binding in bindings])

    identities = {row['id'] for row in catalog['selectors']}
    assets = [row for row in bundle['assets'] if not (row['type'] == 'sra' and row['data'] in identities)]
    missing = [row for row in bundle['missing'] if not (row['type'] == 'sra' and row['data'] in identities)]
    with ThreadPoolExecutor(max_workers=4) as executor:
        for resolved, failures in executor.map(resolve, sorted(by_reference.items())):
            assets.extend(resolved); missing.extend(failures)
    for row in catalog['selectors']:
        if row['icon'] is None:
            missing.append({'type': 'sra', 'data': row['id'], 'role': 'full', 'reason': 'no-verified-artwork-reference'})
    bundle['source']['selectableRewards'] = {'catalogSha256': hashlib.sha256(catalog_bytes).hexdigest(),
        **{key: catalog['source'][key] for key in ['observedAt', 'gameAssemblySha256', 'metadataSha256']}}
    order = lambda row: (row['type'], row['data'], row['role'])
    bundle['assets'] = sorted(assets, key=order); bundle['missing'] = sorted(missing, key=order)
    bundle['coverage'] = {'bindings': len(assets) + len(missing), 'resolved': len(assets), 'missing': len(missing),
        'resolvedByType': dict(sorted(Counter(row['type'] for row in assets).items()))}
    return bundle


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['catalog', 'base-manifest', 'assets', 'download-cache', 'manifest']:
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    result = extract(args)
    args.manifest.parent.mkdir(parents=True, exist_ok=True)
    args.manifest.write_text(json.dumps(result, ensure_ascii=False) + '\n', encoding='utf-8')
    print(json.dumps(result['coverage']))
