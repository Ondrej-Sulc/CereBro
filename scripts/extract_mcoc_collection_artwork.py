"""Add exact acquisition-piece inventory artwork to the shared reward sidecar.

Reads the same source-bound GameStore as the base manifest; never adds a piece
to crystal reward definitions or guesses aliases from a champion name.
"""
from __future__ import annotations

import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import re

from extract_mcoc_crystal_artwork import download, export_image
from extract_mcoc_reward_artwork import REVIEWED_METADATA, build_bindings
from mcoc_protobuf import Decoder


def project_artwork(catalog, manifest):
    digest = next(row['sha256'] for row in manifest['source']['registries'] if row['kind'] == 'gameStore')
    sources = {row['id']: row for row in catalog['sources']}
    images = {}
    for row in manifest['assets']:
        if row['type'] == 'inv' and row['role'] == 'full':
            if row['data'] in images:
                raise ValueError('Duplicate inventory artwork')
            images[row['data']] = row
    needed = set()
    for method in catalog['methods']:
        for piece in method.get('pieces', []):
            item_id = piece['itemId']
            if not any(source.get('gameData', {}).get('sha256') == digest and
                       any(item['id'] == item_id for item in source['gameData']['items'])
                       for source in [sources[id] for id in method['sourceIds']]):
                raise ValueError('Piece evidence differs from artwork GameStore')
            needed.add(item_id)
    assets = []
    for item_id in sorted(needed):
        row = images.get(item_id)
        if not row or row['registry'] != 'gamestore' or row['registryId'] != item_id:
            raise ValueError('Missing exact inventory artwork')
        if not re.fullmatch('[a-f0-9]{64}', row['sha256']) or row['url'] != 'https://storage.googleapis.com/' + manifest['source']['bucket'] + '/rewards/full/' + row['sha256'] + '.webp':
            raise ValueError('Unrelated piece artwork URL')
        assets.append({'itemId': item_id, 'artworkUrl': row['url']})
    return {'version': 1, 'gameStoreSha256': digest, 'assets': assets}


def extract(args):
    base = json.loads(args.base_manifest.read_text(encoding='utf8'))
    catalog = json.loads(args.catalog.read_text(encoding='utf8'))
    schema = json.loads(args.schema.read_text(encoding='utf8'))
    metadata = {Path(row['path'].replace('\\', '/')).name: row['sha256'] for row in schema['sources']}
    if metadata != REVIEWED_METADATA:
        raise ValueError('Unreviewed collection artwork metadata')
    payload = args.gamestore.read_bytes()
    expected = next(row['sha256'] for row in base['source']['registries'] if row['kind'] == 'gameStore')
    if hashlib.sha256(payload).hexdigest() != expected:
        raise ValueError('Collection GameStore differs from reward-artwork source')
    decoder = Decoder(schema)
    store = decoder.message(payload, 'EB.Sparx.GameStoreDataBuffer')
    if decoder.unknown:
        raise ValueError('Unknown collection GameStore fields')
    items = [item for group in store.get('items', {}).values() for item in group.get('gameStoreItems', [])]
    needed = [piece['itemId'] for method in catalog['methods'] for piece in method.get('pieces', [])]
    plan = build_bindings({'categories': [], 'bonusRewards': []}, {}, [], items, additional_inventory=needed)
    if plan['missing']:
        raise ValueError('Unresolved exact collection-piece bindings')
    references = {(binding['source'], binding['reference']) for binding in plan['bindings']}

    def render(pair):
        source, reference = pair
        if source != 'cdn':
            raise ValueError('Collection artwork needs a reviewed local-resource resolver')
        data = download(reference, args.download_cache)
        return pair, {**export_image(data, args.assets / 'full'), 'origin': 'game-cdn'}

    with ThreadPoolExecutor(max_workers=6) as executor:
        images = dict(executor.map(render, sorted(references)))
    keys = {('inv', item_id, 'full') for item_id in needed}
    key = lambda row: (row['type'], row['data'], row['role'])
    assets = [row for row in base['assets'] if key(row) not in keys]
    missing = [row for row in base['missing'] if key(row) not in keys]
    assets.extend({**binding, **images[(binding['source'], binding['reference'])]} for binding in plan['bindings'])
    result = {**base, 'assets': sorted(assets, key=key), 'missing': sorted(missing, key=key),
              'coverage': {'bindings': len(assets) + len(missing), 'resolved': len(assets), 'missing': len(missing),
                           'resolvedByType': dict(sorted(Counter(row['type'] for row in assets).items()))}}
    args.manifest.parent.mkdir(parents=True, exist_ok=True)
    args.manifest.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf8')
    print(json.dumps({'pieceBindings': len(keys), 'newReferences': len(references), **result['coverage']}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['catalog', 'gamestore', 'schema', 'base-manifest', 'assets', 'download-cache', 'manifest']:
        parser.add_argument('--' + name, type=Path, required=name == 'catalog')
    parser.add_argument('--published-manifest', type=Path, help='Project already published artwork without downloads or uploads')
    parser.add_argument('--projection', type=Path)
    args = parser.parse_args()
    if args.published_manifest:
        if not args.projection:
            parser.error('--projection is required for published artwork')
        result = project_artwork(json.loads(args.catalog.read_text(encoding='utf8')), json.loads(args.published_manifest.read_text(encoding='utf8')))
        args.projection.write_text(json.dumps(result, indent=2) + '\n', encoding='utf8')
        print(json.dumps({'projectedPieces': len(result['assets'])}))
    else:
        if any(getattr(args, name) is None for name in ['gamestore', 'schema', 'base_manifest', 'assets', 'download_cache', 'manifest']):
            parser.error('Extraction requires GameStore, schema, base manifest, assets, download cache and manifest paths')
        extract(args)
