# Local artwork extraction handoff — 2026-11-10

The offline extraction/index foundation is implemented and the complete local
run has finished. All 5,304 eligible source files were processed; extraction and
alias reconciliation have no pending sources. No commits, pushes, PRs, deployment,
game client control, process-memory inspection, network requests or publication.
The separate Quest/Tower checkout was not modified.

Implementation is in the tool-prepared `t3/artwork-extraction-catalog` checkout,
directory `scripts/game-artwork/`. The checkout basename is
`t3-acf30dc5-b047858702909c42`; the full path is returned in the task response.
Tool-created task/thread linkage:
<t3-thread://v2/b5d11ff5-3b2f-4765-b98d-35572d334145/thread:delegated-task:command%3Amcp%3A72ac23cd-aac0-476d-9431-6edea22ef312%3Adelegate-task%3Aa2c2c4c2-6a5a-4079-8e74-6e77b0f07cc0>

## Artifacts and counts

Library: `C:/Code/CereBro/temp/game-artwork-library/`.

| Item | Count / size |
| --- | ---: |
| Unity bundles | 603 |
| Other shipped Unity resource/scene files | 13 |
| Stream sidecars, hashed in place | 3 / 37,069,488 bytes |
| Loose native images | 3,281 / 346,866,929 bytes |
| Public TOCs | 799 |
| Public manifests | 605 |
| All eligible sources | 5,304 / 7,330,110,598 bytes |
| Unique artwork assets | **10,049** |
| Unique loose assets | 3,183 |
| Unique texture assets | 5,602 |
| Unique sprite assets | 1,264 |
| Decoded loose source objects | 3,279 |
| Decoded Texture2D source objects | 6,390 |
| Decoded Sprite source objects | 2,358 |
| Atlas metadata objects | 13 |
| Retained source aliases / evidence rows | **18,114** |
| Content-addressed original/decoded blobs | **9,882 / 7,028,937,624 bytes** |
| Small PNG thumbnails, maximum 128 px | 9,863 / 211,216,085 bytes |
| Unreferenced originals / temporary files | **0 / 0** |

The native ODR cache is empty. The retained public `game-only/sources`
directory contains two definition binaries (52,039,587 bytes), with no image or
Unity payloads; there are no additional artwork payloads in its checked
continuation/expansion source subdirectories. StreamingAssets/EOS contains eight
configuration JSON files and no artwork; these were not read. Logs, configuration,
private HTTP caches and account/session data were excluded.

Use `summary.json` for the final machine-readable counts, physical storage and
free-space measurement. The reserve is 20 GiB, enforced before every artwork
write with an additional 64 MiB metadata margin. Initial free space was 64.05
GiB; the lowest recorded completion/progress measurement was approximately
56.91 GiB. No reserve stop was needed, and the remaining-work lists are empty.

Important paths inside the library:

* `catalog.sqlite`: schema v1, source hashes, objects, atlas provenance, aliases,
  FTS5 and name/path/type/dimension/source/category indexes.
* `originals/<prefix>/<byte-sha>.<ext>`: untouched loose originals and native
  texture/sprite PNGs. Bundles and stream sidecars were not copied.
* `previews/<prefix>/<pixel-sha>.png`: thumbnails without upscaling.
* `preview.html`: self-contained selector of 96 representative samples, using
  embedded thumbnails, source/kind filters, dimensions and source details.
* `contact-sheet.png`, `preview-selection.json`: the same sample and its IDs.
* `inventory.json`, `checkpoint.json`, `alias-checkpoint.json`, `summary.json`,
  `runtime.json`, `extraction-contract.json`, `verification.json`.

## Coverage and explicit limits

All locally decodable Texture2D and Sprite objects were exported. Sprite crops
retain native rects, packing rotations/flips, alpha, trim offsets and atlas
chains. Texture masters and sprite crops have distinct semantic asset IDs,
while identical encoded bytes share physical blobs. Every original loose
encoding is retained even when its pixels deduplicate with another encoding.
Original sizes and transparency were preserved; no upscaling, recoloring,
shader compositing or repainting was performed.

Explicit non-exports remain searchable in the catalog:

* Two malformed loose originals: `fightlanding_alliance_wars.jpg` and
  `GachaChasePrize_256x256_kang.png`. Their exact original bytes are retained;
  their objects and TOC references are marked undecodable.
* Nineteen zero-size Font Texture/SDF placeholders have no installed pixels.
* Twenty-nine Cubemap and two RenderTexture objects are outside the requested
  Texture2D/Sprite extraction scope. No audio, mesh/model or video was exported.
* One ambiguous exact TOC binding, `ui/images/iconalliance_compressed`, retains
  all candidates rather than choosing one. Its underlying locally available
  artwork is extracted. Three atlas references resolve as metadata, 3,283 image
  references resolve, and the two malformed references resolve as undecodable.
* Top texture mip only; lower mip variants and material/renderer composition
  are not rendered. Tight polygon crops use the installed UnityPy helper.
* Cached files with no retained exact public name mapping remain anonymous
  native hash aliases. Categories come from lexical source paths; no champion,
  quest or effect identity was inferred from appearance. No remote references
  were expanded or downloaded.

The 511 initial cross-bundle sprite reference failures were resolved with exact
UnityFS CAB directory indexing. Duplicate native container keys and references
to objects in other bundles are retained by `reconcile-aliases`. All 616 source
markers match their source byte hashes; reconciliation errors: zero.

## Validation

`verification.json` reports `ok: true`, with no failures:

* All 9,882 blob byte hashes/lengths and 10,049 image pixel hashes, dimensions,
  alpha ranges and thumbnail bounds.
* All 5,304 source byte hashes and all 3,281 original loose byte identities,
  including the two unreadable originals.
* All 18,114 alias/FTS rows, 616 source reconciliation markers and 2,358 sprite
  provenance chains; SQLite integrity and foreign keys.
* Forty-eight native Texture2D re-decodes and encoded-image byte hashes.
* Thirty-two independently reconstructed rectangular sprite crops, including
  alpha, rotation and vertical origin; sixteen tight polygon sprites separately
  reproduced through UnityPy. Tight polygon masking is not independently
  reimplemented, and the report explicitly records that limitation.

Eleven portable tests pass via:

```powershell
python -m unittest discover -s scripts/game-artwork -p 'test_*.py' -v
```

Fixtures cover resumability, changed sources/TOCs, content deduplication with
all original encodings/aliases, disk-reserve checkpoints, corrupt-source
isolation, exact joins, real PPtr API behavior, duplicate container keys,
UnityFS directory indexing, artifact tampering, standalone previews, every
packing rotation and split alpha. They do not need the game installation.

Native-size visual inspection included the 40×40 `star` sprite, a 256×256 alpha
effect texture, the 512×1024 Castellan atlas and a 256×256 loose portrait.
The contact sheet was inspected; the HTML selector rendered at 728 px with no
console errors. It embeds actual small images and performs no `file://` fetches.

## Entry points for the next agent

`README.md` has the commands and complete extraction/storage contract.
`artwork.py` provides inventory, extract, reconcile-aliases, summary, search and
explicit error retry. `catalog.py` is a standalone read-only schema/reader:
`Catalog.search`, `Catalog.asset`, `Catalog.resolve_pointer`.
`verify.py` performs the independent audit; `preview.py` rebuilds the compact
review artifacts. Installed versions are pinned in `requirements.txt` and
recorded with source hashes in the library's `runtime.json`.

Keep this bulk library outside Git and `web/public`. A future asset finder can
query the catalog; a later publication layer can select a bounded subset by
catalog IDs and exact metadata evidence. No application page or route was added.
