# Game artwork finder

The enhanced finder uses a deterministic server-only discovery projection for
friendly lookup, ranked results and overlapping browse families. See
[DISCOVERY.md](./DISCOVERY.md) for its exact evidence/DTO/build contract and
deployment sidecar prerequisite. The native FTS search described below remains
the fallback when this optional projection is missing or mismatched. File serving,
including the independently reviewed PNG-under-`.bin` handling, is preserved.

Public/local page: `/assets`. Navigation integration is intentionally left for
the coordinating change. No login is needed. The existing application shell
continues to render its usual account controls.

## Storage and runtime

Set **server-only** `GAME_ARTWORK_LIBRARY_ROOT` to an absolute, trusted directory
containing the completed extractor's schema-v1 `catalog.sqlite`, `originals/`
and `previews/`. This is an explicit local filesystem adapter, not a folder
discovery service. Keep this directory outside Git, Next assets and `web/public`.
No client configuration, absolute source directories or SQLite/provenance JSON
are bundled. Search results contain catalog metadata; aliases are loaded only
when inspecting an asset. Source paths are relative provenance, never file URLs.

The adapter requires **Node >=22.13 with `node:sqlite` available**, tested on
Node **24.4.0**. `node:sqlite` is experimental in that runtime. It is resolved
lazily with `process.getBuiltinModule`, using structural TypeScript types because
the web project currently has Node 20 declarations. Routes use Next's **Node**
runtime, not Edge. The existing `web.Dockerfile` uses Node 20: its runtime must
be upgraded before configuring this adapter there. No package/runtime/CI files
were changed by this feature. An unconfigured or unsupported server returns a
friendly 503 state. A deployment needs separately provisioned storage (and an
appropriate storage/provider adapter for a non-filesystem host); this change
does **not** make the dataset available in production.

The dataset is an immutable, trusted server snapshot while the finder runs.
Provision it read-only to the app and restart workers after replacing it.
One database connection per process is opened with `readOnly:true` and
`query_only=ON`; no migration, catalog write, scan, extraction or Python process
runs in requests. Cache is bounded to 64 MiB plus a 64 MiB mapped window per
connection. SQL values are parameterized. The local complete dataset is 54 MiB
of catalog metadata and 7.3 GB of artwork outside the checkout.

## API / DTO contract

All endpoints are read-only GETs; image routes also support HEAD.

* `/api/game-artwork?q=&kind=&source=&category=&minWidth=&maxWidth=&minHeight=&maxHeight=&page=&pageSize=`
  returns `ArtworkSearch`: `{items,total,libraryTotal,page,pageSize,sources,categories}`.
  Cards are `{id,kind,name,width,height,format,transparent,aliasCount}`. Types in
  `contract.ts` are the authoritative DTOs. `aliasCount` on a filtered card counts
  matching aliases; detail counts every active alias.
* `/api/game-artwork/[id]` returns `ArtworkDetail`: card fields plus
  `{bytes,pixelSha256,blobSha256,aliases}`. Alias fields are
  `{name,path,category,evidence,source,sourcePath,sourceSha256,objectId}`.
  Detail is capped at 200 aliases, with the total retained for disclosure.
* `/api/game-artwork/[id]/preview` streams a native extractor thumbnail.
* `/api/game-artwork/[id]/original[?download=1]` streams the representative
  catalog blob: original loose encoding or native decoded PNG for Unity art.
  Other original encodings retained by the extractor are not alternate downloads
  in this first slice.

Search uses up to 24 literal Unicode word-prefix tokens, ANDed within a single
native alias. FTS operators/punctuation are not executable syntax. Query length
is at most 160 characters. Kind, source and lexical category combine with native
minimum/maximum width/height. Dimension limits are 0–32768 (maxima start at 1).
Default page size is 48, capped at 96; pages are clamped to the last existing
page (1 for an empty result). The UI canonicalizes an excessive page URL.
Unknown/duplicate query keys and malformed filters return 400. Unknown well-formed
source/category filters yield an empty result. Queries group by asset ID, so
aliases match without duplicating cards. Readable native names and images at
least 32×32 sort ahead of anonymous/tiny entries, with ID as stable tie breaker.
Absent/stale source aliases are excluded.

File endpoints accept a 64-character lowercase catalog ID and a fixed variant;
no client file path is accepted. Catalog paths must match content-addressed
raster names in `originals/` or `previews/`. `realpath` containment rejects
directory-junction/symlink escapes. A retained `.bin` original is served only when
the catalog declares PNG and its eight-byte PNG signature agrees; MIME and the
safe download filename use PNG while original bytes remain unchanged. The trusted root must not be writable by
untrusted concurrent actors. Files are checked with the opened handle and streamed
in 64 KiB chunks with a byte-counted 64 KiB Web-stream queue; cancellation awaits
the underlying file close before returning capacity. Originals are capped at 64 MiB, previews at 8 MiB, with at most
32 active streams per worker. No SVG/HTML is served. Original byte length must
agree with the catalog. Missing, invalid or escaped files return clean 404 JSON.
MIME, nosniff and ID-based safe download filenames are set. Original ETags use
the encoded byte SHA-256; preview ETags use pixel hash plus file size/mtime.
Conditional GET/HEAD supports strong/weak validators and `*`; cache is public
for one hour with revalidation, without claiming immutable failure responses.
Range requests are not implemented; these bounded images return full 200 bodies.

## Interaction

Search submits explicitly (Enter or Search/Apply). Advanced filters collapse;
active filter count remains visible. `/assets?...&asset=[id]` recovers an inspector
on reload, even when that asset is outside the current results. Radix modal
focus trapping and Escape are used. Closing an opened card goes Back to its
result URL and restores card focus; closing a recovered link removes only
`asset` and focuses search. Reset clears filters/page, collapses advanced controls
and focuses search. Browser Back restores search inputs, result pages and selection.
The image inspector provides no-upscale fit, 100% native and 200% zoom; large
images scroll within the preview. Checkerboard/light/dark backgrounds and image
retry are independent of the source disclosure. Lexical categories never assert
verified champion/quest/effect identity.

## Checks

From the repository root, with dependencies installed and Node 24.4:

```powershell
pnpm exec vitest run web/src/lib/game-artwork/storage.test.ts --maxWorkers=1
pnpm --dir web exec eslint src/app/assets src/app/api/game-artwork src/lib/game-artwork src/components/game-artwork
pnpm exec tsc -p web/tsconfig.json --noEmit --incremental false
```

Tests create small disposable SQLite fixtures outside the real dataset. They
exercise alias deduplication and stale-source exclusion, combined filters,
pagination, input/FTS injection boundaries, unknown IDs, missing/corrupt metadata,
traversal and real directory-junction escapes, read-only enforcement, exact
stream bytes, safe disposition, MIME, HEAD, 304, oversized files, slow-stream
capacity/cancellation recovery and sanitized unavailable errors.
Browser evidence and the full-catalog page-union audit are in the ignored
`temp/game-artwork-page/` directory of the implementation checkout. No production
deployment or physical-device touch validation was performed.
