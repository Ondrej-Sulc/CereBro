"""Export source-bound game crystal artwork as transparent, lossless WebP assets."""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import quote, unquote, urlsplit
from urllib.request import urlopen

from PIL import Image

CDN_BASE = 'https://kabam-marvel.shared.mcoc-cdn.net/'
MAX_BYTES = 8_000_000


def safe_reference(reference):
    decoded = unquote(reference)
    parsed = urlsplit(decoded)
    if not reference or parsed.scheme or parsed.netloc or parsed.query or parsed.fragment or '\\' in decoded or '..' in decoded.split('/'):
        raise ValueError('Unsafe artwork reference')
    return reference.lstrip('/')


def cache_file(cache, reference):
    reference = safe_reference(reference)
    key = hashlib.sha1(('/' + reference).encode('utf-8')).hexdigest().upper()
    return cache / (key + Path(reference).suffix)


def resource_index(root):
    index = {}
    for path in sorted(root.rglob('*')):
        if not path.is_file() or path.suffix.lower() not in ('.png', '.jpg', '.jpeg'):
            continue
        logical = '/'.join(path.relative_to(root).parts[1:])
        key = str(Path(logical).with_suffix('')).replace('\\', '/').lower()
        previous = index.get(key)
        if previous and previous.read_bytes() != path.read_bytes():
            raise ValueError(f'Ambiguous resource: {key}')
        index[key] = path
    return index


def export_image(data, output):
    if len(data) > MAX_BYTES:
        raise ValueError('Artwork exceeds size limit')
    with Image.open(io.BytesIO(data)) as source:
        if source.width > 4096 or source.height > 4096 or source.width < 1 or source.height < 1:
            raise ValueError('Unsupported artwork dimensions')
        image = source.convert('RGBA')
    encoded = io.BytesIO()
    image.save(encoded, format='WEBP', lossless=True, exact=True, method=6)
    webp = encoded.getvalue()
    digest = hashlib.sha256(webp).hexdigest()
    output.mkdir(parents=True, exist_ok=True)
    destination = output / (digest + '.webp')
    if not destination.exists():
        destination.write_bytes(webp)
    return dict(file=output.name + '/' + destination.name, sha256=digest,
                inputSha256=hashlib.sha256(data).hexdigest(), width=image.width, height=image.height)


def download(reference, download_cache):
    destination = download_cache / (hashlib.sha256(reference.encode()).hexdigest() + '.bin')
    if destination.exists():
        return destination.read_bytes()
    for attempt in range(3):
        try:
            with urlopen(CDN_BASE + quote(safe_reference(reference), safe='/%'), timeout=20) as response:
                if urlsplit(response.url).hostname != urlsplit(CDN_BASE).hostname:
                    raise ValueError('Unexpected CDN redirect')
                data = response.read(MAX_BYTES + 1)
            if len(data) > MAX_BYTES:
                raise ValueError('Artwork exceeds size limit')
            download_cache.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(data)
            return data
        except HTTPError as failure:
            if failure.code < 500 or attempt == 2:
                raise
        except (TimeoutError, OSError):
            if attempt == 2:
                raise
        time.sleep(attempt + 1)


def extract(catalog, resources, cache, output, metadata, download_cache, download_missing):
    metadata_bytes = metadata.read_bytes()
    if CDN_BASE.encode() not in metadata_bytes:
        raise ValueError('Artwork CDN is not present in the supplied game metadata')
    local = resource_index(resources)
    refs = {(role, c[member]['source'], safe_reference(c[member]['reference']))
            for c in catalog['crystals'] for role, member in [('primary', 'artwork'), ('banner', 'bannerArtwork')] if c.get(member)}
    cdn_refs = {reference for role, source, reference in refs if source == 'cdn'}
    resource_refs = {reference for role, source, reference in refs if source == 'resource'}

    def resolve(item):
        role, source, reference = item
        result = dict(role=role, source=source, reference=reference)
        resource_path = local.get(str(Path(reference).with_suffix('')).replace('\\', '/').lower() if Path(reference).suffix else reference.lower())
        path = cache_file(cache, reference) if source == 'cdn' else resource_path
        local_origin = 'game-cache' if source == 'cdn' else 'game-resource'
        if (not path or not path.exists()) and reference in resource_refs and resource_path:
            # Reuse an independently resource-bound, exact logical reference when
            # a legacy definition has the opposite transport flag.
            path, local_origin = resource_path, 'game-resource'
        try:
            if path and path.exists():
                data, origin = path.read_bytes(), local_origin
            elif download_missing and (source == 'cdn' or reference in cdn_refs):
                # One legacy definition has a false CDN flag for an otherwise exact,
                # independently CDN-bound reference. No filename/family inference.
                data, origin = download(reference, download_cache), 'game-cdn'
            else:
                return None, dict(**result, reason='not-in-local-game-files')
            return dict(**result, origin=origin, **export_image(data, output / role)), None
        except HTTPError as failure:
            return None, dict(**result, reason=f'HTTP-{failure.code}')
        except (OSError, ValueError):
            return None, dict(**result, reason='unreadable-image')

    assets, missing = [], []
    with ThreadPoolExecutor(max_workers=6) as executor:
        jobs = [executor.submit(resolve, item) for item in sorted(refs)]
        for index, job in enumerate(as_completed(jobs), 1):
            asset, failure = job.result()
            if asset:
                assets.append(asset)
            if failure:
                missing.append(failure)
            if index % 50 == 0:
                print(f'Artwork {index}/{len(refs)}: {len(assets)} resolved, {len(missing)} missing', flush=True)
    return dict(version=3, source=dict(gachaSha256=catalog['source']['gachaSha256'], cdnBaseUrl=CDN_BASE,
                gameMetadataSha256=hashlib.sha256(metadata_bytes).hexdigest()),
                assets=sorted(assets, key=lambda a: (a['role'], a['source'], a['reference'])),
                missing=sorted(missing, key=lambda a: (a['role'], a['source'], a['reference'])))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--catalog', type=Path, required=True)
    parser.add_argument('--resources', type=Path, required=True, help='Game Champions_Data/Resources/Data directory')
    parser.add_argument('--cache', type=Path, required=True, help='Game asset_cache/files directory')
    parser.add_argument('--game-metadata', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=Path('temp/crystals/artwork-assets'))
    parser.add_argument('--manifest', type=Path, default=Path('temp/crystals/artwork-local.json'))
    parser.add_argument('--download-cache', type=Path, default=Path('temp/crystals/artwork-downloads'))
    parser.add_argument('--download-missing', action='store_true', help='Fetch exact references from the verified public game CDN')
    args = parser.parse_args()
    catalog = json.loads(args.catalog.read_text(encoding='utf-8'))
    result = extract(catalog, args.resources, args.cache, args.output, args.game_metadata, args.download_cache, args.download_missing)
    args.manifest.parent.mkdir(parents=True, exist_ok=True)
    args.manifest.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(json.dumps(dict(assets=len(result['assets']), missing=len(result['missing']), files=len({a['file'] for a in result['assets']}))))
