"""Offline inventory/extraction/catalog CLI. Explicit public asset roots only."""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import gc
import hashlib
import io
import json
import os
from pathlib import Path
import re
import shutil
import sqlite3
import struct
import sys
import time

from PIL import Image
from catalog import SCHEMA, SCHEMA_VERSION, Catalog

GIB = 1024 ** 3
IMAGE_SUFFIXES = {'.png', '.jpg', '.jpeg', '.webp', '.tga', '.bmp', '.tif', '.tiff', '.dds', '.exr', '.ktx', '.ktx2', '.pvr', '.gif'}
REFERENCE_SUFFIXES = IMAGE_SUFFIXES | {'.spriteatlas'}
SIDECARS = {'.ress', '.resource'}
BLOCKED = {'logs', 'log', 'config', 'preferences', 'cookies', 'httpcache', '__pycache__', '.claude', 'sessions', 'profiles'}


def js(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))


def digest(data):
    return hashlib.sha256(data).hexdigest()


def identity(*parts):
    return digest(js(parts).encode())


def file_hash(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


class StorageReserve(Exception):
    pass


class Store:
    def __init__(self, root, reserve_gib=20):
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        self.reserve = int(reserve_gib * GIB)
        self.minimum_free = shutil.disk_usage(self.root).free

    def check(self, additional=0):
        # Extra 64 MiB margin allows SQLite to finish its transaction/checkpoint.
        free = shutil.disk_usage(self.root).free
        self.minimum_free = min(self.minimum_free, free)
        if free - additional < self.reserve + 64 * 1024 ** 2:
            raise StorageReserve('disk-reserve-reached')

    def write(self, relative, payload):
        path = self.root / relative
        if relative in {'checkpoint.json', 'verification.json'}:
            if shutil.disk_usage(self.root).free - len(payload) < self.reserve:
                raise StorageReserve('No room for checkpoint; SQLite remains authoritative')
        else:
            self.check(len(payload))
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_name(path.name + '.tmp')
        with tmp.open('wb') as f:
            f.write(payload); f.flush(); os.fsync(f.fileno())
        os.replace(tmp, path)
        return path

    def json(self, relative, value):
        return self.write(relative, (json.dumps(value, indent=2, sort_keys=True) + '\n').encode())


def connect(store):
    store.check()
    db = sqlite3.connect(store.root / 'catalog.sqlite')
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA journal_mode=WAL')
    db.execute('PRAGMA synchronous=FULL')
    db.executescript(SCHEMA)
    old = db.execute("SELECT value FROM meta WHERE key='schema_version'").fetchone()
    if old and int(old[0]) != SCHEMA_VERSION:
        raise ValueError('Unsupported catalog version')
    db.execute('INSERT OR REPLACE INTO meta VALUES(?,?)', ('schema_version', str(SCHEMA_VERSION)))
    db.commit()
    return db


def roots_from(args):
    roots = {}
    for spec in args.root:
        label, sep, value = spec.partition('=')
        if not sep or not re.fullmatch('[a-zA-Z0-9_-]+', label) or label in roots:
            raise ValueError('Use unique nonprivate labels: --root installed=C:/...')
        root = Path(value).resolve(strict=True)
        if not root.is_dir():
            raise ValueError('Source root must be a directory')
        roots[label] = root
    output = args.output.resolve()
    for root in roots.values():
        if root == output or root in output.parents or output in root.parents:
            raise ValueError('Keep output separate from source roots')
    return roots


def classify(path, rel):
    ext = path.suffix.lower()
    if ext in IMAGE_SUFFIXES:
        return 'loose-image'
    if ext in SIDECARS:
        return 'unity-stream'
    if ext in {'.assetbundle', '.bundle', '.unity3d', '.assets'} or re.fullmatch(r'level\d+', path.name):
        return 'unity'
    if path.name in {'unity default resources', 'unity_builtin_extra', 'globalgamemanagers'}:
        return 'unity'
    if path.name == 'toc.txt':
        return 'public-toc'
    if path.name in {'packs.txt', 'manifest_main.mbin'} or ext == '.manifest':
        return 'public-manifest'
    # Inspect signatures only in explicitly supplied asset roots. Unknown JSON,
    # logs/config, audio/video and definition payloads are never parsed/copied.
    if ext in {'.txt', '.json', '.config', '.info', '.log', '.mp4', '.bank', '.wav', '.dll'}:
        return 'excluded-non-artwork'
    with path.open('rb') as f:
        magic = f.read(16)
    if magic.startswith((b'UnityFS', b'UnityWeb', b'UnityRaw')):
        return 'unity'
    if magic.startswith((b'\x89PNG\r\n', b'\xff\xd8\xff', b'DDS ', b'BM', b'GIF8', b'\xabKTX')) or (magic.startswith(b'RIFF') and magic[8:12] == b'WEBP'):
        return 'loose-image'
    return 'unsupported-or-non-artwork'


def walk_public(root):
    for directory, dirs, files in os.walk(root, followlinks=False):
        dirs[:] = sorted(n for n in dirs if n.lower() not in BLOCKED and n not in {'Plugins', 'il2cpp_data', 'EOS'} and not (Path(directory) / n).is_symlink())
        for name in sorted(files):
            path = Path(directory) / name
            if not path.is_symlink():
                yield path


def inventory(args):
    roots = roots_from(args)
    store = Store(args.output, args.reserve_gib)
    db = connect(store)
    current = set()
    for label, root in sorted(roots.items()):
        for path in walk_public(root):
            rel = path.relative_to(root).as_posix()
            if any(part.lower() in BLOCKED for part in path.relative_to(root).parts):
                continue
            sid = identity(label, rel)
            current.add(sid)
            stat = path.stat()
            classification = classify(path, rel)
            old = db.execute('SELECT * FROM sources WHERE id=?', (sid,)).fetchone()
            if old and (old['bytes'], old['mtime_ns'], old['classification']) == (stat.st_size, stat.st_mtime_ns, classification):
                if old['status'] != 'absent':
                    continue
            if old:
                db.execute('DELETE FROM aliases WHERE evidence=?', ('unity-container-source:' + sid,))
                db.execute("DELETE FROM aliases WHERE evidence IN (SELECT 'toc:'||id FROM references_catalog WHERE source_id=?)", (sid,))
            status = 'pending' if classification in {'loose-image', 'unity', 'unity-stream', 'public-toc', 'public-manifest'} else 'excluded'
            # The previous content's objects become stale at extraction time;
            # preserve them until a replacement is atomically committed.
            db.execute('''INSERT INTO sources(id,root,path,classification,bytes,mtime_ns,status) VALUES(?,?,?,?,?,?,?)
                        ON CONFLICT(id) DO UPDATE SET bytes=excluded.bytes,mtime_ns=excluded.mtime_ns,
                        classification=excluded.classification,sha256=NULL,status=excluded.status,error=NULL''',
                       (sid, label, rel, classification, stat.st_size, stat.st_mtime_ns, status))
    for row in db.execute('SELECT id,root FROM sources').fetchall():
        if row['root'] in roots and row['id'] not in current:
            db.execute("UPDATE sources SET status='absent',error='source-no-longer-present' WHERE id=?", (row['id'],))
            db.execute('DELETE FROM aliases WHERE evidence=?', ('unity-container-source:' + row['id'],))
            db.execute("DELETE FROM aliases WHERE evidence IN (SELECT 'toc:'||id FROM references_catalog WHERE source_id=?)", (row['id'],))
    db.commit()
    result = summary(db, store)
    result['policy'] = 'explicit-public-asset-roots; no network; no account/session/config/log data'
    result['inventory'] = [dict(row) for row in db.execute('SELECT root,classification,count(*) files,sum(bytes) bytes FROM sources WHERE status!=\'absent\' GROUP BY root,classification ORDER BY root,classification')]
    store.json('inventory.json', result)
    print(js(result), flush=True)
    db.close()


def category(path):
    # These are lexical source groupings, never visual/entity identification.
    lower = path.lower()
    for label, tokens in [('portrait', ('portrait',)), ('reward', ('inventory/', 'resource_', 'rewards/', 'crystal')),
                          ('background', ('background', 'splash', 'loading', 'poster', 'cutscenes')),
                          ('effect', ('bufficon', 'vfx', 'effect', 'particle')), ('ui', ('assets/ui/', '/ui/', 'atlas'))]:
        if any(t in lower for t in tokens):
            return label
    return 'unclassified'


def normalize(path):
    return '/'.join(str(path).replace('\\', '/').split('//')).lower().strip('/')


def alias(db, oid, name, path, evidence):
    db.execute('INSERT OR IGNORE INTO aliases VALUES(?,?,?,?,?,?)', (identity(oid, path, evidence), oid, name, path, category(path), evidence))


def pixels_hash(image):
    return digest(js(image.size).encode() + b'\0RGBA\0' + image.convert('RGBA').tobytes())


def emit_image(db, store, image, kind, original=None, original_format=None):
    image.load()
    rgba = image.convert('RGBA')
    pixel_hash = pixels_hash(rgba)
    aid = identity(kind, pixel_hash)
    if db.execute('SELECT id FROM assets WHERE id=?', (aid,)).fetchone():
        # Different original encodings must still be retained by the caller.
        return aid
    payload = original
    fmt = original_format or 'PNG'
    if payload is None:
        buf = io.BytesIO(); rgba.save(buf, format='PNG', compress_level=4); payload = buf.getvalue()
    blob = emit_blob(db, store, payload, extension_for(fmt))
    preview = rgba.copy(); preview.thumbnail((128, 128), Image.Resampling.LANCZOS)
    buf = io.BytesIO(); preview.save(buf, format='PNG', compress_level=6)
    preview_path = 'previews/' + pixel_hash[:2] + '/' + pixel_hash + '.png'
    if not (store.root / preview_path).exists():
        store.write(preview_path, buf.getvalue())
    alpha = rgba.getchannel('A').getextrema()
    db.execute('INSERT INTO assets VALUES(?,?,?,?,?,?,?,?,?,?)',
               (aid, kind, pixel_hash, blob, rgba.width, rgba.height, fmt, *alpha, preview_path))
    return aid


def extension_for(fmt):
    return re.sub('[^a-z0-9]', '', fmt.lower()) or 'bin'


def emit_blob(db, store, payload, extension):
    h = digest(payload)
    row = db.execute('SELECT path FROM blobs WHERE sha256=?', (h,)).fetchone()
    if not row:
        path = 'originals/' + h[:2] + '/' + h + '.' + extension
        if not (store.root / path).exists():
            store.write(path, payload)
        db.execute('INSERT INTO blobs VALUES(?,?,?)', (h, path, len(payload)))
    return h


def error_text(exc):
    # Exceptions may contain an absolute user path. Redact paths wholesale.
    value = str(exc).replace('\\', '/')
    value = re.sub(r'[A-Za-z]:/[^\n\r\'\"]+', '[local-path]', value)
    value = re.sub(r'0x[0-9A-Fa-f]+', '[address]', value)
    return type(exc).__name__ + ': ' + value[:600]


def clear_source(db, sid):
    db.execute('DELETE FROM aliases WHERE evidence=?', ('unity-container-source:' + sid,))
    db.execute('DELETE FROM meta WHERE key=?', ('container-aliases:' + sid,))
    db.execute("DELETE FROM aliases WHERE evidence IN (SELECT 'toc:'||id FROM references_catalog WHERE source_id=?)", (sid,))
    db.execute('DELETE FROM aliases WHERE object_id IN (SELECT id FROM objects WHERE source_id=?)', (sid,))
    db.execute('UPDATE references_catalog SET object_id=NULL WHERE object_id IN (SELECT id FROM objects WHERE source_id=?)', (sid,))
    db.execute('DELETE FROM objects WHERE source_id=?', (sid,))
    db.execute('DELETE FROM references_catalog WHERE source_id=?', (sid,))


def insert_object(db, sid, serialized, pid, typ, name, raw_hash, aid, status, error, provenance):
    oid = identity(sid, serialized, str(pid))
    db.execute('INSERT OR REPLACE INTO objects VALUES(?,?,?,?,?,?,?,?,?,?,?)',
               (oid, sid, serialized, str(pid), typ, name, raw_hash, aid, status, error, js(provenance)))
    return oid


def loose(db, store, row, path):
    payload = path.read_bytes()
    # Every original encoding retained even when decoded pixels deduplicate.
    original = emit_blob(db, store, payload, path.suffix.lower().lstrip('.') or 'bin')
    provenance = {'originalBlobSha256': original}
    try:
        with Image.open(io.BytesIO(payload)) as image:
            fmt = image.format
            aid = emit_image(db, store, image, 'loose', payload, fmt)
            provenance.update(format=fmt, frames=getattr(image, 'n_frames', 1))
            oid = insert_object(db, row['id'], '', 'loose', 'LooseImage', path.name, digest(payload), aid, 'done', None, provenance)
    except StorageReserve:
        raise
    except Exception as exc:
        oid = insert_object(db, row['id'], '', 'loose', 'LooseImage', path.name, digest(payload), None, 'error', error_text(exc), provenance)
    alias(db, oid, path.name, row['path'], 'source-relative-path')


def pointer(ptr):
    if ptr is None:
        return None
    result = {'fileId': ptr.m_FileID, 'pathId': str(ptr.m_PathID)}
    if ptr.m_PathID:
        try:
            target = ptr.deref()
            result.update(serializedFile=Path(target.assets_file.name).name, type=target.type.name)
        except Exception as exc:
            result['missing'] = error_text(exc)
    return result


def bundle_directory(path):
    """Read UnityFS directory metadata only, without unpacking texture blocks."""
    from UnityPy.helpers import CompressionHelper
    from UnityPy.enums import CompressionFlags
    def string(f):
        data = bytearray()
        while True:
            ch = f.read(1)
            if not ch:
                raise ValueError('Truncated bundle directory')
            if ch == b'\0':
                return data.decode('utf8')
            data.extend(ch)
            if len(data) > 4096:
                raise ValueError('Oversize bundle directory string')
    with path.open('rb') as f:
        if string(f) != 'UnityFS':
            return None
        version = struct.unpack('>I', f.read(4))[0]
        player = string(f); engine = string(f)
        size, compressed, uncompressed, flags = struct.unpack('>QIII', f.read(20))
        if compressed > 16*1024**2 or uncompressed > 64*1024**2:
            raise ValueError('Oversize bundle directory metadata')
        engine_parts = tuple(int(n) for n in re.findall(r'\d+', engine)[:3])
        if version >= 7 or (version == 6 and engine_parts >= (2019,4,15)):
            f.seek((f.tell()+15)//16*16)
        if flags & 0x80:
            f.seek(-compressed, 2)
        encoded = f.read(compressed)
        decoded = CompressionHelper.DECOMPRESSION_MAP[CompressionFlags(flags & 63)](encoded, uncompressed)
    f = io.BytesIO(decoded);f.seek(16)
    blocks = struct.unpack('>I', f.read(4))[0]
    f.seek(blocks*10, 1)
    count = struct.unpack('>I', f.read(4))[0]
    names = []
    if count > 100000:
        raise ValueError('Oversize bundle directory count')
    for _ in range(count):
        f.read(20); names.append(string(f))
    return {'names': names, 'directorySha256': digest(encoded)}


def cabinet_index(db, roots):
    index = defaultdict(list)
    for row in db.execute("SELECT * FROM sources WHERE classification='unity' AND status!='absent' ORDER BY root,path").fetchall():
        if row['root'] not in roots:
            continue
        path = roots[row['root']] / row['path']
        try:
            directory = bundle_directory(path)
            if directory:
                db.execute('INSERT OR REPLACE INTO meta VALUES(?,?)', ('cab-directory:' + row['id'], js(directory)))
                for name in directory['names']:
                    index[Path(name).name.lower()].append({'sourceId': row['id'], 'root': row['root'],
                        'path': row['path'], 'directorySha256': directory['directorySha256'], 'local': path})
        except Exception as exc:
            db.execute('INSERT OR REPLACE INTO meta VALUES(?,?)', ('cab-directory-error:' + row['id'], error_text(exc)))
    db.commit()
    return index


def rect(value):
    if value is None:
        return None
    return {k: getattr(value, k) for k in ['x', 'y', 'width', 'height'] if hasattr(value, k)}


def vector(value):
    return {k:getattr(value,k) for k in ['x','y','z','w'] if hasattr(value,k)} if value is not None else None


def render_data_extras(data):
    return {'downscaleMultiplier':getattr(data,'downscaleMultiplier',None),
            'uvTransform':vector(getattr(data,'uvTransform',None)),
            'atlasRectOffset':vector(getattr(data,'atlasRectOffset',None)),
            'secondaryTextures':[{'name':getattr(t,'name',None),'texture':pointer(getattr(t,'texture',None))} for t in (getattr(data,'secondaryTextures',None) or [])]}


def atlas_provenance(data):
    return {'isVariant':data.m_IsVariant,'tag':data.m_Tag,'guid':str(data.m_Guid),
            'packedSpriteNamesToIndex':list(data.m_PackedSpriteNamesToIndex),
            'packedSprites':[pointer(p) for p in data.m_PackedSprites],
            'renderData':[{'key':str(k),'texture':pointer(v.texture),'alphaTexture':pointer(v.alphaTexture),
                'textureRect':rect(v.textureRect),'textureRectOffset':vector(v.textureRectOffset),
                'settingsRaw':v.settingsRaw,**render_data_extras(v)} for k,v in data.m_RenderDataMap]}


def sprite_provenance(sprite):
    atlas = None
    if sprite.m_SpriteAtlas:
        atlas = sprite.m_SpriteAtlas.deref_parse_as_object()
    elif sprite.m_AtlasTags:
        for obj in sprite.assets_file.objects.values():
            if obj.type.name == 'SpriteAtlas' and obj.peek_name() == sprite.m_AtlasTags[0]:
                atlas = obj.read(); break
    data = next(v for k, v in atlas.m_RenderDataMap if k == sprite.m_RenderDataKey) if atlas else sprite.m_RD
    return {**render_data_extras(data),'atlas': pointer(sprite.m_SpriteAtlas), 'atlasTags': sprite.m_AtlasTags,
            'atlasName': atlas.m_Name if atlas else None, 'renderDataKey': str(sprite.m_RenderDataKey),
            'texture': pointer(data.texture), 'alphaTexture': pointer(data.alphaTexture),
            'textureRect': rect(data.textureRect), 'textureRectOffset': rect(data.textureRectOffset),
            'originalRect': rect(sprite.m_Rect), 'settingsRaw': data.settingsRaw,
            'decode': 'UnityPy.SpriteHelper (rect, packing rotation, split alpha, tight mesh, vertical origin)'}


def unity(db, store, row, path, dependency_index=None):
    import UnityPy
    from UnityPy.export import SpriteHelper
    env = UnityPy.load(str(path))
    primary_objects = list(env.objects)
    if dependency_index:
        original_find = env.find_file
        def find_public_dependency(name, is_dependency=True):
            if env.get_cab(name):
                return env.get_cab(name)
            candidates = dependency_index.get(Path(name).name.lower(), [])
            if candidates:
                if len(candidates) > 1 and len({file_hash(c['local']) for c in candidates}) > 1:
                    raise FileNotFoundError('Ambiguous public CAB source: ' + name)
                env.load_file(str(candidates[0]['local']), is_dependency=True)
            return original_find(name, is_dependency)
        env.find_file = find_public_dependency
    # Inspect only 2D image objects and atlas metadata. Meshes/audio are neither
    # parsed nor exported. UnityPy lazily resolves stream files beside bundles.
    containers = defaultdict(list)
    entries = list(env.container.items())
    # Environment.container is a dictionary. Keep duplicate native container
    # keys pointing at different sub-assets as separate source aliases too.
    for bundle_object in primary_objects:
        if bundle_object.type.name == 'AssetBundle':
            for logical, info in bundle_object.read().m_Container:
                entries.append((logical, info.asset))
    for logical, ptr in entries:
        # PPtr.assetsfile is the origin; deref() identifies the actual target
        # serialized file, including external references.
        try:
            target = ptr.deref()
            containers[(Path(target.assets_file.name).name, str(target.path_id))].append(logical)
        except Exception:
            # Unresolved image container entries are recorded explicitly below.
            if Path(logical).suffix.lower() in IMAGE_SUFFIXES:
                rid = identity(row['id'], logical)
                db.execute('INSERT OR REPLACE INTO references_catalog VALUES(?,?,?,?,?,?,?,?)',
                           (rid, row['id'], logical, logical, None, 'missing-unity-container-target', None, 'unity-container'))
    counts = Counter(o.type.name for o in primary_objects)
    db.execute('INSERT OR REPLACE INTO meta VALUES(?,?)', ('types:' + row['id'], js(counts)))
    for obj in primary_objects:
        if obj.type.name not in {'Texture2D', 'Sprite', 'SpriteAtlas', 'Texture2DArray', 'Cubemap', 'CubemapArray', 'RenderTexture'}:
            continue
        store.check()
        typ = obj.type.name
        serialized = Path(obj.assets_file.name).name
        name = ''
        raw_hash = None; provenance = {}; aid = None; status = 'done'; error = None
        try:
            name = obj.peek_name() or ''
            raw_hash = digest(obj.get_raw_data())
            data = obj.read()
            name = data.m_Name
            if typ == 'Texture2D':
                provenance = {'textureFormat': int(data.m_TextureFormat), 'width': data.m_Width, 'height': data.m_Height,
                              'mipCount': data.m_MipCount, 'imageCount': data.m_ImageCount, 'dimension': data.m_TextureDimension,
                              'colorSpace': data.m_ColorSpace, 'stream': {'path': data.m_StreamData.path, 'offset': data.m_StreamData.offset, 'size': data.m_StreamData.size} if data.m_StreamData else None,
                              'decodedMip': 0}
                if data.m_TextureDimension != 2 or data.m_ImageCount != 1:
                    raise NotImplementedError('Only single-image 2D textures are in scope')
                if data.m_Width <= 0 or data.m_Height <= 0:
                    raise NotImplementedError('Zero-size texture placeholder has no installed image pixels')
                provenance['encodedTextureSha256'] = digest(data.get_image_data())
                aid = emit_image(db, store, data.image, 'texture')
            elif typ == 'Sprite':
                provenance = sprite_provenance(data)
                aid = emit_image(db, store, SpriteHelper.get_image_from_sprite(data), 'sprite')
            elif typ == 'SpriteAtlas':
                provenance = atlas_provenance(data)
                status = 'metadata'
            else:
                status = 'unsupported'; error = 'Only Texture2D/Sprite image extraction is in scope'
        except StorageReserve:
            raise
        except Exception as exc:
            status = 'unsupported' if isinstance(exc, NotImplementedError) else 'error'
            error = error_text(exc)
        def attach_sources(value):
            if isinstance(value, dict):
                if dependency_index and value.get('serializedFile'):
                    value['sourceCandidates'] = [{k:v for k,v in c.items() if k!='local'} for c in dependency_index.get(value['serializedFile'].lower(), [])]
                for key, item in list(value.items()):
                    if key != 'sourceCandidates': attach_sources(item)
            elif isinstance(value, list):
                for item in value: attach_sources(item)
        attach_sources(provenance)
        oid = insert_object(db, row['id'], serialized, obj.path_id, typ, name, raw_hash, aid, status, error, provenance)
        alias(db, oid, name, row['path'] + '#' + serialized + '/' + str(obj.path_id) + '/' + name, 'unity-object')
        for logical in sorted(set(containers.get((serialized, str(obj.path_id)), []))):
            alias(db, oid, name, logical, 'unity-container')
    del env
    gc.collect()


def toc(db, row, path):
    data = json.loads(path.read_text(encoding='utf-8-sig'))
    for bundle, definition in sorted(data.get('bundles', {}).items()):
        for logical, native in sorted(definition.get('paths', {}).items()):
            if Path(str(native).replace('\\', '/')).suffix.lower() not in REFERENCE_SUFFIXES:
                continue
            rid = identity(row['id'], bundle, logical, native)
            db.execute('INSERT OR REPLACE INTO references_catalog VALUES(?,?,?,?,?,?,?,?)',
                       (rid, row['id'], logical, normalize(native), bundle, 'unresolved-local-reference', None, 'public-toc-exact-path',))
    for native in sorted(data.get('files', [])):
        if Path(native).suffix.lower() in IMAGE_SUFFIXES:
            logical = data.get('pack', '') + '/' + native
            db.execute('INSERT OR REPLACE INTO references_catalog VALUES(?,?,?,?,?,?,?,?)',
                       (identity(row['id'], logical), row['id'], logical, normalize(native), None, 'unresolved-local-reference', None, 'public-toc-loose-file'))


def resolve_references(db):
    # Exact case/separator-normalized paths only, never basename matching.
    db.execute("DELETE FROM aliases WHERE evidence LIKE 'toc:%'")
    index = defaultdict(set)
    for row in db.execute("SELECT l.path,l.object_id FROM aliases l JOIN objects o ON o.id=l.object_id JOIN sources s ON s.id=o.source_id WHERE s.status IN ('done','done-with-errors') AND (l.evidence LIKE 'unity-container%' OR l.evidence='source-relative-path')"):
        index[normalize(row['path'])].add(row['object_id'])
    refs = db.execute("SELECT r.*,s.path toc_path FROM references_catalog r JOIN sources s ON s.id=r.source_id WHERE r.evidence LIKE 'public-toc-%' AND s.status IN ('done','done-with-errors')").fetchall()
    for r in refs:
        keys = [r['native_path']]
        if r['evidence'] == 'public-toc-loose-file':
            keys = [normalize(str(Path(r['toc_path']).parent / r['native_path']))]
        matches = set().union(*(index.get(k, set()) for k in keys))
        if len(matches) == 1:
            oid = next(iter(matches))
            alias(db, oid, r['logical_path'].rsplit('/', 1)[-1], r['logical_path'], 'toc:' + r['id'])
            target = db.execute('SELECT asset_id,type,status FROM objects WHERE id=?', (oid,)).fetchone()
            status = 'resolved' if target['asset_id'] else ('resolved-metadata' if target['type']=='SpriteAtlas' and target['status']=='metadata' else 'resolved-undecodable-object')
            db.execute('UPDATE references_catalog SET status=?,object_id=? WHERE id=?', (status,oid,r['id']))
        else:
            db.execute('UPDATE references_catalog SET status=?,object_id=NULL WHERE id=?', ('ambiguous-exact-path' if matches else 'missing-local-image-or-container-path', r['id']))


def reconcile_aliases(args):
    """Resumable metadata-only pass: duplicate container keys and cross-CAB aliases."""
    import UnityPy
    roots = roots_from(args); store = Store(args.output, args.reserve_gib); db = connect(store)
    sources = db.execute("SELECT * FROM sources WHERE classification='unity' AND status IN ('done','done-with-errors') ORDER BY root,path").fetchall()
    generation = identity([tuple(r) for r in db.execute('SELECT id,asset_id,status,raw_sha256 FROM objects ORDER BY id')])
    old_generation = db.execute("SELECT value FROM meta WHERE key='container-alias-generation'").fetchone()
    if not old_generation or old_generation[0] != generation:
        # A previously missing target can become available without changing the
        # referring bundle. Reconcile against the complete new object catalog.
        db.execute("DELETE FROM meta WHERE key LIKE 'container-aliases:%'")
        db.execute('INSERT OR REPLACE INTO meta VALUES(?,?)', ('container-alias-generation',generation))
        db.commit()
    processed = 0; state = 'complete'
    for source in sources:
        marker = 'container-aliases:' + source['id']
        old = db.execute('SELECT value FROM meta WHERE key=?', (marker,)).fetchone()
        if old and old[0] == source['sha256']:
            continue
        if source['root'] not in roots:
            state = 'missing-root'; continue
        try:
            store.check()
            path = roots[source['root']] / source['path']; stat = path.stat()
            if (stat.st_size, stat.st_mtime_ns) != (source['bytes'], source['mtime_ns']):
                raise ValueError('Source changed; inventory/extract before reconciling aliases')
            env = UnityPy.load(str(path))
            entries = list(env.container.items())
            for obj in env.objects:
                if obj.type.name == 'AssetBundle':
                    entries.extend((k,v.asset) for k,v in obj.read().m_Container)
                elif obj.type.name == 'SpriteAtlas':
                    db.execute('UPDATE objects SET provenance=? WHERE source_id=? AND serialized_file=? AND path_id=?',
                               (js(atlas_provenance(obj.read())),source['id'],Path(obj.assets_file.name).name,str(obj.path_id)))
            evidence = 'unity-container-source:' + source['id']
            db.execute('DELETE FROM aliases WHERE evidence=?', (evidence,))
            for logical, ptr in entries:
                if not ptr.m_PathID:
                    continue
                if ptr.m_FileID:
                    serialized = Path(ptr.assetsfile.externals[ptr.m_FileID-1].path.replace('\\','/')).name
                else:
                    serialized = Path(ptr.assetsfile.name).name
                matches = db.execute('SELECT * FROM objects WHERE serialized_file=? COLLATE NOCASE AND path_id=?', (serialized,str(ptr.m_PathID))).fetchall()
                if matches and len({m['raw_sha256'] for m in matches}) == 1:
                    for match in matches:
                        alias(db, match['id'], match['name'], logical, evidence)
                elif Path(logical).suffix.lower() in IMAGE_SUFFIXES | {'.spriteatlas'}:
                    rid = identity(source['id'],logical,serialized,str(ptr.m_PathID))
                    db.execute('INSERT OR REPLACE INTO references_catalog VALUES(?,?,?,?,?,?,?,?)',
                               (rid,source['id'],logical,serialized+'#'+str(ptr.m_PathID),None,
                                'ambiguous-exact-object' if matches else 'missing-exact-object',None,'unity-container-object'))
            db.execute('INSERT OR REPLACE INTO meta VALUES(?,?)', (marker,source['sha256']))
            db.execute('DELETE FROM meta WHERE key=?', ('container-aliases-error:'+source['id'],))
            db.commit(); processed += 1; del env;gc.collect()
        except (StorageReserve, KeyboardInterrupt):
            db.rollback();state = 'interrupted';break
        except Exception as exc:
            db.rollback()
            db.execute('INSERT OR REPLACE INTO meta VALUES(?,?)', ('container-aliases-error:'+source['id'],error_text(exc)))
            db.commit()
        if processed and processed % 20 == 0:
            print(js({'alias_sources_processed':processed,'source':source['root']+':'+source['path']}),flush=True)
    resolve_references(db);db.commit()
    result=checkpoint(db,store,state=state,alias_sources_processed=processed)
    result['alias_sources_remaining']=[dict(r) for r in db.execute("SELECT s.root,s.path FROM sources s LEFT JOIN meta m ON m.key='container-aliases:'||s.id AND m.value=s.sha256 WHERE s.classification='unity' AND s.status IN ('done','done-with-errors') AND m.key IS NULL ORDER BY s.root,s.path")]
    store.json('alias-checkpoint.json',result);db.execute('PRAGMA wal_checkpoint(TRUNCATE)');db.close()
    print(js(result),flush=True)


def summary(db, store):
    queries = {
        'sources': 'SELECT status,count(*) count,sum(bytes) bytes FROM sources GROUP BY status',
        'objects': 'SELECT type,status,count(*) count FROM objects GROUP BY type,status',
        'assets': 'SELECT kind,count(*) count,sum(width*height*4) rgba_bytes FROM assets GROUP BY kind',
        'references': 'SELECT status,count(*) count FROM references_catalog GROUP BY status',
    }
    result = {k: [dict(r) for r in db.execute(sql)] for k, sql in queries.items()}
    result.update(schema_version=SCHEMA_VERSION, free_bytes=shutil.disk_usage(store.root).free,
                  reserve_bytes=store.reserve, aliases=db.execute('SELECT count(*) FROM aliases').fetchone()[0],
                  blob_count=db.execute('SELECT count(*) FROM blobs').fetchone()[0],
                  blob_bytes=db.execute('SELECT coalesce(sum(bytes),0) FROM blobs').fetchone()[0])
    result['alias_reconciliation'] = {
        'complete_sources':db.execute("SELECT count(*) FROM sources s JOIN meta m ON m.key='container-aliases:'||s.id AND m.value=s.sha256 WHERE s.classification='unity' AND s.status IN ('done','done-with-errors')").fetchone()[0],
        'errors':db.execute("SELECT count(*) FROM meta WHERE key LIKE 'container-aliases-error:%'").fetchone()[0]}
    return result


def extract(args):
    roots = roots_from(args); store = Store(args.output, args.reserve_gib); db = connect(store)
    dependencies = cabinet_index(db, roots)
    pending = db.execute("SELECT * FROM sources WHERE status IN ('pending','interrupted') ORDER BY CASE classification WHEN 'unity-stream' THEN 0 WHEN 'public-manifest' THEN 1 WHEN 'public-toc' THEN 2 WHEN 'loose-image' THEN 3 ELSE 4 END,root,path").fetchall()
    state = 'complete'; processed = 0
    for row in pending:
        if args.limit and processed >= args.limit:
            state = 'limited'; break
        if row['root'] not in roots:
            state = 'missing-root'; continue
        path = roots[row['root']] / row['path']
        source_hash = None
        try:
            store.check()
            before = path.stat()
            if (before.st_size, before.st_mtime_ns) != (row['bytes'], row['mtime_ns']):
                raise ValueError('Source changed since inventory; inventory again')
            source_hash = file_hash(path)
            clear_source(db, row['id'])
            kind = row['classification']
            if kind == 'loose-image':
                loose(db, store, row, path)
            elif kind == 'unity':
                unity(db, store, row, path, dependencies)
            elif kind == 'public-toc':
                toc(db, row, path)
            after = path.stat()
            if (after.st_size, after.st_mtime_ns) != (before.st_size, before.st_mtime_ns):
                raise ValueError('Source changed during extraction')
            errors = db.execute("SELECT count(*) FROM objects WHERE source_id=? AND status IN ('error','unsupported')", (row['id'],)).fetchone()[0]
            db.execute('UPDATE sources SET sha256=?,status=?,error=NULL WHERE id=?', (source_hash, 'done-with-errors' if errors else 'done', row['id']))
            db.commit(); processed += 1
        except (StorageReserve, KeyboardInterrupt) as exc:
            db.rollback()
            db.execute("UPDATE sources SET status='interrupted',error=? WHERE id=?", (type(exc).__name__, row['id']))
            db.commit(); state = 'storage-reserve' if isinstance(exc, StorageReserve) else 'interrupted'; break
        except Exception as exc:
            db.rollback()
            # Persist one failure independently; all other sources still run.
            db.execute("UPDATE sources SET status='error',sha256=?,error=? WHERE id=?", (source_hash, error_text(exc), row['id']))
            db.commit(); processed += 1
        if processed % 20 == 0:
            checkpoint(db, store, state='running', processed=processed)
            print(js({'processed': processed, 'total_pending_at_start': len(pending), 'source': row['root'] + ':' + row['path'], 'free_bytes': shutil.disk_usage(store.root).free}), flush=True)
    resolve_references(db); db.commit()
    result = checkpoint(db, store, state=state, processed=processed)
    db.execute('PRAGMA wal_checkpoint(TRUNCATE)'); db.close()
    print(js(result), flush=True)


def checkpoint(db, store, **extra):
    previous = db.execute("SELECT value FROM meta WHERE key='minimum_observed_free_bytes'").fetchone()
    minimum = min(store.minimum_free, int(previous[0]) if previous else store.minimum_free)
    db.execute('INSERT OR REPLACE INTO meta VALUES(?,?)', ('minimum_observed_free_bytes', str(minimum)))
    db.commit()
    result = {**summary(db, store), **extra}
    result['minimum_observed_free_bytes'] = minimum
    result['remaining'] = [dict(r) for r in db.execute("SELECT root,path,bytes,status,error FROM sources WHERE status IN ('pending','interrupted','error','absent') ORDER BY root,path")]
    store.json('checkpoint.json', result)
    return result


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('command', choices=['inventory', 'extract', 'reconcile-aliases', 'summary', 'search', 'retry-errors'])
    p.add_argument('--root', action='append', default=[], help='Explicit public asset root LABEL=PATH; no broad user roots')
    p.add_argument('--output', type=Path, required=True)
    p.add_argument('--reserve-gib', type=float, default=20)
    p.add_argument('--limit', type=int, default=0, help='Bound sources for a smoke run; 0 means all')
    p.add_argument('--query', default='')
    p.add_argument('--kind', choices=['loose', 'texture', 'sprite'])
    p.add_argument('--category')
    p.add_argument('--source', help='Exact source root label for search')
    p.add_argument('--min-width', type=int, default=0)
    p.add_argument('--min-height', type=int, default=0)
    args = p.parse_args()
    if args.reserve_gib < 20:
        p.error('At least 20 GiB must remain free')
    if args.command in {'inventory', 'extract', 'reconcile-aliases'}:
        if not args.root:
            p.error('Explicit --root required')
        globals()[args.command.replace('-','_')](args)
    elif args.command == 'search':
        c = Catalog(args.output / 'catalog.sqlite')
        for row in c.search(args.query, kind=args.kind, category=args.category, source=args.source,
                            min_width=args.min_width, min_height=args.min_height):
            print(js(row))
        c.close()
    else:
        store = Store(args.output, args.reserve_gib); db = connect(store)
        if args.command == 'retry-errors':
            db.execute("UPDATE sources SET status='pending' WHERE status IN ('error','done-with-errors')"); db.commit()
        print(js(summary(db, store))); db.close()


if __name__ == '__main__':
    main()
