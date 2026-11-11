# Offline game artwork library

This is an extraction/index foundation, with a small local review selector. It
does not add an application route, publish assets or make network requests.

Requires Python 3.10+, Pillow and UnityPy (tested with Pillow 12.2.0 and UnityPy
1.25.0). The catalog reader in `catalog.py` only needs Python's standard library.
One process decodes one source at a time; no server, client or background pool.

## Reproduce

Run in a PowerShell terminal from the repository. Set `$nativeImages` to the
exact native `asset_cache/files` directory already identified by the canonical
`scripts/extract_mcoc_crystal_artwork.py` resolver. Do not pass a broad user,
AppData, game profile, HTTP cache or account directory. `$nativeOdr` is the exact
game `odr` asset directory if present (empty in the recorded run).

```powershell
$library = 'C:/Code/CereBro/temp/game-artwork-library'
$installed = 'C:/Games/Marvel Contest of Champions/default/game/Champions_Data'
$sources = @('--root', "installed=$installed", '--root', "image-cache=$nativeImages", '--root', "odr=$nativeOdr")
python scripts/game-artwork/artwork.py inventory @sources --output $library
python -u scripts/game-artwork/artwork.py extract @sources --output $library
python scripts/game-artwork/artwork.py reconcile-aliases @sources --output $library
python scripts/game-artwork/artwork.py summary --output $library
python scripts/game-artwork/artwork.py search --output $library --query 'buff' --kind sprite
python scripts/game-artwork/verify.py @sources --output $library --unity-samples 48
python scripts/game-artwork/preview.py --output $library --limit 96
python -m unittest discover -s scripts/game-artwork -p 'test_*.py' -v
```

Inventory is required before extraction. Use `--limit 20` for a bounded smoke
run. Re-run `extract` to resume pending/interrupted sources; finished sources
are skipped. Re-run `inventory` after source files change. Changed files are
reprocessed; old source objects/aliases are replaced in one transaction. Content
blobs remain available, with no automatic deletion or garbage collection.
`retry-errors` explicitly requeues source errors and sources with object errors;
then run `extract` again. Unsupported formats stay visible rather than retrying
forever. Files that disappear become `absent`; current search excludes their
stale aliases. Read the `remaining` list in `checkpoint.json` for exact paths,
bytes, statuses and source errors. Detailed object failures remain in SQLite.
Run `reconcile-aliases` after extraction or retries. This resumable metadata-only
pass preserves duplicate native AssetBundle container keys and aliases whose
target objects live in other CABs. `alias-checkpoint.json` reports exact sources
remaining in that pass; per-source markers bind it to the extracted byte hash.
A changed object catalog invalidates those markers, so newly available targets
also repair aliases in unchanged referring bundles.

Root labels must be unique, nonprivate names. The CLI stores labels and relative
paths, never absolute input directories. Supply roots again when resuming or
verifying; no account path is persisted in the catalog. Explicitly reviewed
public roots are the trust boundary: directory-name exclusions do not make a
broad private root safe. Logs, config, profiles, account/session data and HTTP
caches are excluded, as are Plugins/il2cpp and non-artwork JSON/audio/video.
Only TOC JSON is parsed. No runtime/process inspection, requests, login, URL
generation, downloads, upload or publication code exists in this pipeline.

## Storage and checkpoint contract

`--reserve-gib` defaults to 20 and cannot be lower. Every image/preview write
checks free space plus the full pending payload and a 64 MiB metadata margin.
Sources run in individual SQLite transactions (`WAL`, `synchronous=FULL`), with
atomic JSON checkpoints every 20 sources and at stop/completion. Files are
written through a flushed/fsynced temporary sibling then `os.replace`. A reserve
stop rolls back the current source and marks it interrupted; the database is
authoritative if a crash interrupts JSON checkpoint writing. Only one writer
should operate on a library. Other applications can consume space independently;
the pipeline cannot reserve space from them.

No bundles or stream sidecars are copied. They are hashed in place. Loose
originals are copied once per SHA-256; native texture/crop PNGs deduplicate by
their encoded byte SHA-256. The database deduplicates semantic assets by
`(kind, RGBA pixel hash)`. Each original loose encoding is retained separately
in blobs and `objects.provenance.originalBlobSha256`, even if two encodings have
the same pixels. Transparent RGB bytes are included in the pixel hash.

Files written before an interrupted transaction can be orphaned temporarily;
the same deterministic paths are reused on resume. No unrelated files are
deleted. Temporary files, retained older content and SQLite files are counted
separately from referenced blob bytes when reporting disk usage.

## Extraction and identity

* Loose PNG/JPEG/WebP and other Pillow-decodable formats retain original bytes,
  image format, native dimensions and alpha. Unknown extensions inside the
  approved asset roots get a small signature check, including UnityFS/images.
* `Texture2D` exports the native top mip as a lossless RGBA PNG. Original encoded
  texture data, raw Unity object bytes and containing source bytes have separate
  hashes. Mip count, source format/color space and stream path/offset/size remain
  in provenance. No gamma correction, tinting, repainting or upscaling occurs.
* `Sprite` uses UnityPy's native sprite helper: exact atlas render-data key,
  texture rect, packing rotation/flips, split alpha, tight mesh mask and Unity
  origin conversion. This is the trimmed native crop, without scaling or adding
  transparent margins. Original `m_Rect`, trim offset, texture/alpha pointers,
  atlas pointer/name/tags and packing settings retain the reconstruction chain.
* `SpriteAtlas` remains a metadata object with packed-sprite pointers and render
  data. Its texture is exported independently; its sprites remain separate
  semantic assets even when a full-image sprite equals its master texture.
  Native packed names, variant/tag/GUID fields, UV/trim offsets, downscale
  multipliers and secondary texture pointers are retained as metadata too.
* Container paths and TOC logical paths are joined by exact normalized full
  path (case/separator normalization only). Missing/ambiguous paths are recorded
  in `references_catalog`. No basename or appearance guessing. Cached image
  hashes without retained exact name evidence remain anonymous source aliases.
* Cross-bundle CAB references resolve through exact UnityFS directory headers
  read from the inventoried public bundles. Only a referenced dependency is
  loaded; dependency objects are not misattributed to the referring bundle.
  Duplicate CAB names are accepted only when the full source byte hashes agree.
  `meta` keys `cab-directory:<source-id>` preserve directory names and compressed
  directory byte hashes. Missing targets remain explicit object/reference errors.

IDs are SHA-256 of canonical JSON identity tuples: source `(root label,relative
path)`, object `(source ID,serialized filename,pathID)`, asset `(kind,pixel hash)`
and alias `(object ID,path,evidence)`. Unity pathIDs are strings, avoiding JS
integer precision loss. Every physical source/object retains its alias and
provenance even if pixels/encoded output deduplicate. `pixel_sha256` includes
native dimensions, the RGBA marker and exact pixels; `blob_sha256` hashes bytes.

Lexical categories (`portrait`, `reward`, `background`, `effect`, `ui`,
`unclassified`) come only from source path tokens. They do not assert champion,
quest, effect or reward identity. Exact public metadata identity tags and remote
URL indexing are intentionally optional future layers; this run performs no
remote reference expansion or downloads.

Out of scope: mesh/model, sound/video, Cubemap/arrays/RenderTexture, animation
playback, texture mip variants and renderer/material/shader compositing. These
Unity image types are recorded as unsupported rather than quietly counted as
exported. Embedded non-2D Unity object type counts are retained in `meta` under
`types:<source-id>`, without dumping their payloads. A corrupt or undecodable
source/object is recorded and other sources continue.

## Catalog and review artifacts

`catalog.sqlite` (schema version 1, DDL in `catalog.py`) contains `sources`,
`objects`, `assets`, `blobs`, `aliases`, `references_catalog`, `meta`, and an FTS5
index maintained by alias insert/delete triggers. B-tree indexes cover source,
name/path/category/type and dimensions. The `Catalog.search()` API accepts
literal word/prefix queries, kind/category and minimum width/height filters;
`Catalog.asset(id)` returns all source objects and aliases, and
`Catalog.resolve_pointer(serialized_file,path_id)` joins an exact atlas/texture
pointer to every physical source object and its source hash. It is read-only and
parameterizes values. Source relative paths are evidence, not web URLs.

`originals/<sha-prefix>/<byte-sha>.<ext>` holds content-addressed originals and
native decoded PNGs; `previews/<prefix>/<pixel-sha>.png` holds thumbnails bounded
to 128 px, without upscaling. `inventory.json`, `checkpoint.json` and
`verification.json` record counts, remaining work and checks. `preview.html`
embeds a bounded representative sample with name/kind/category filters, native
dimensions and source details. It uses data-image thumbnails, no `file://`
fetching, remote scripts, service, or production finder. `contact-sheet.png` and
`preview-selection.json` retain the same sample for inspection.

Verification independently checks every referenced blob byte hash/length,
every asset pixel hash/dimensions/alpha, thumbnail size, all hashed sources,
original-byte preservation, alias/FTS coverage and all sprite chain fields.
Deterministic bounded samples re-decode Unity textures and sprites. Rectangular
sprite/alpha/rotation composition is independently implemented in `verify.py`;
tight polygon samples reproduce UnityPy's helper and are labeled accordingly.
Portable fixtures cover malformed-source isolation, source changes, dedup,
original encodings, native transparency, exact TOC joins, resume/reserve stops,
real PPtr API behavior, UnityFS directory indexing, artifact tampering, standalone
preview generation and all packing rotations/split alpha.

Keep the library outside source control and `web/public`. A later selected
publication layer can use catalog IDs and evidence to choose a bounded subset.

The completed run is documented in `HANDOFF.md`. Its external library includes
`summary.json` and `runtime.json` with final coverage/storage counts, installed
decoder versions and extractor source hashes. No absolute account-cache root is
persisted in these artifacts.
