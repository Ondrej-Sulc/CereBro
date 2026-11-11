# Artwork discovery projection v1

The finder adds **server-only metadata** over the frozen extraction catalog.
It does not edit SQLite, copy images, inspect the game, call a network service,
classify image appearance, or publish artwork. The current catalog is pinned to
SHA-256 `205db640ce69f268f7bfd93dcb574b0fe018980727d163e5ae09fbf38dd68f02`.

## Rebuild and storage

`tools/build_discovery.py` uses only Python's standard library. It opens the
explicit catalog in SQLite read-only mode and reads these repository inputs:

* `src/data/game-crystals/catalog.json` and `artwork.json`
* `src/data/game-reward-artwork/manifest.json`
* `src/data/game-crystal-openings/catalog.json`
* `src/data/game-ascension/catalog.json`
* `src/domain/reward-display.ts` (only its literal canonical resource-name map)

Optional, explicitly supplied offline snapshots provide CereBro champion display
names and audit context for the effect glossary and quest registry. No live database,
game directory or process is opened. Input filenames are logical labels; absolute
account paths are not persisted. Every input, including the builder itself, has an
exact SHA-256 in the generated JSON. Ordering and bytes are deterministic; there is
no clock timestamp. The generated file is metadata, about 8 MB, kept outside the
frozen SQLite and `web/public`. It contains names/references, not image payloads or
object provenance JSON. Never import it into a client component.

```powershell
python web/src/lib/game-artwork/tools/build_discovery.py `
  --repo . --catalog "$env:GAME_ARTWORK_LIBRARY_ROOT/catalog.sqlite" `
  --output web/src/lib/game-artwork/generated/discovery-v1.json `
  --champion-snapshot $championSnapshot --effects $effectSnapshot `
  --quest-snapshot $questSnapshot
```

The optional paths refer to existing offline exports, not live captures. Omit
those switches when unavailable; the registry-native champion names still work.
For this reviewed artifact their exact hashes are retained under
`canonical-champions-snapshot`, `canonical-effects-snapshot`, and
`canonical-quest-snapshot` in `inputs`.

The server reads the sidecar once at adapter startup, validates version/counts
and the **actual catalog byte hash**, prepares normalized search fields, and
keeps eight bounded result sets for stable pagination. It does not enumerate
directories or read registries in requests. Sidecars are capped at 32 MiB before
reading; catalogs larger than 256 MiB use the native fallback. The database and
file endpoints retain native read-only SQLite and the existing stream protections.

Default sidecar location is `src/lib/game-artwork/generated/discovery-v1.json`
relative to the web process (the repository-root CLI also recognizes the fixed
`web/src/...` location). **`GAME_ARTWORK_SEARCH_INDEX`** can specify an absolute
trusted server path instead. A deployment must ship this metadata file or provision
it at that explicit path; dynamic filesystem tracing is not assumed to do so.
Restart workers after changing either immutable snapshot. Missing/mismatched/broken
metadata falls back to the original native-alias SQL reader, exposes
`discovery.status=unavailable`, and returns a friendly 503 for enriched family or
evidence filters. Reset returns to native browsing. No wrong-catalog joins are used.

## Evidence and coverage

Counts describe **distinct asset IDs**, never alias rows. All 10,049 assets remain
in the projection. Families overlap; they are browse aids, not exclusive identities.
Current reviewed coverage is 414 registry-linked assets, 583 assets with native
champion ID links, and 218 previously anonymous hash-named assets with registry
lookup. Unclassified coverage is explicit: **3,269 assets** after the final family
refinement. A match can have several tags and several recorded uses.

* **Registry use**: an artwork manifest's encoded **input** SHA-256 equals a
  retained original blob hash, or its complete resource reference equals an exact
  catalog resource/TOC logical reference. Published WebP hashes are not substituted
  for native input bytes. Crystal display names join by exact `(source,reference)`
  to crystal definitions. Item names join by exact `(type,data)` to reward records;
  similar blueprint identifiers are not equated. Names and artwork bindings retain
  separate source labels in the inspector.
* **Native ID**: an entire `portrait_<gameId>.png` or
  `GachaChasePrize_256x256_<gameId>.png` name equals a canonical champion ID. The
  matched filename and canonical-name snapshot are retained as evidence. Character
  bundle membership does not turn its effects/model textures into champion portraits.
* **Usage hint**: conservative native name/path rules group portraits, crystals,
  rewards, currencies, catalysts/ISO, combat/node UI, Quest/Tower art, backgrounds,
  UI components and textures/VFX. The inspector exposes each rule. A containing
  `gacha` directory alone does not classify a prize portrait as a crystal. A
  champion's `BoxGloveAndTower` model texture is not Quest/Tower UI.
* **Native alias**: a query matched a native filename, logical path, source alias
  or catalog ID; that is not an identity assertion.

Tinted/overlay registry outputs often share the same untinted native base. These
remain multiple **artwork-use** links with an explicit base-artwork note; the
finder does not recolor the original or claim that it is the published class tint.
Fragment/full artwork roles are preserved, with full icons ahead of fragments or
banners on otherwise equivalent searches. Detail returns at most 64 identity/use
links with the full count, and the original 200-alias cap remains.

The audited canonical effect glossary has 463 entries but no native raster
reference/hash. The separate inspected node registry uses font glyphs for entries
such as Armor Up. No glyph-to-PNG or effect-name-to-texture guess was added. The
audited quest projection has ten sets but no poster/image reference fields.
Quest/Tower family membership therefore remains native usage evidence, not exact
quest identity. These are coverage limits; a Bleed registry-only query correctly
returns no claimed PNG identity.

## Search, ranking and DTO

The original `q`, kind/source/path-category/dimension and page filters remain.
Add `family=portraits|crystals|items|currencies|catalysts|combat|quests|backgrounds|interface|materials|unclassified`
and `evidence=registry|native-id|hint`. Evidence `hint` includes only assets with no
registry/native-ID link. All filters combine at asset level; source and path category
must coexist in an active source-alias location. Query terms can match evidence
across the same asset. Page size and count bounds are unchanged.

Normalization folds accents/case, camelCase, punctuation, underscores and spaces.
`Dr.` is normalized to `Doctor`. Canonical champion name initials (3–5 words) are
search aliases, e.g. `OML` for the exact Old Man Logan ID; no alias creates a new
identity. Recorded tier/basic/class catalyst labels supply `T5BC`/`T5CC`-style
abbreviations. ISO-8, ISO_8 and packed iso8 use the same token. Encoded hashes are separated
before camel-case splitting and require at least eight hexadecimal characters
to match a hash prefix; ordinary short queries do not search hash fragments.
Exact native game IDs have their own high-weight field. Short aliases remain token prefixes: `T5BC` does not match inside
`DXT5|BC3`. Longer compact phrases recover spaced/packed native names. Empty
punctuation is an empty result, not an operator or an implicit all-assets query.

Exact friendly labels rank first, then registry/native-ID phrase/prefix matches,
native names, and low-ranked source-path matches. Full artwork roles get a small
tie-breaking boost. Family labels are **not** injected into query text: searching
Tower within Quest/Tower does not return every unrelated quest asset. Default browse
ranking favors identified art, then useful native UI, with tiny images below their
peers. Display name and ID provide stable tie breakers. Eight search-result sets
are cached per process; keys include every filtering field but exclude pagination.

`ArtworkCard` adds `displayName`, `families`, and `match:{label,basis}`. The selected
query's matched registry/native-ID label is visible on the card and inspector.
`ArtworkDetail` adds `identities`, `identityCount`, and `hints`. Identity fields are
`{id,label,domain,basis,reference,source,labelSource,role,note}`.
`ArtworkSearch` adds `families:[{id,label,count}]` and
`discovery:{status,coverage:{total,registry,nativeId,anonymousRegistry,unclassified}}`.
Metadata outside the requested page/detail is not sent to clients.

The family rail is scrollable on phones and keeps the current family visible;
the result heading names it. Advanced filters and coverage stay collapsed. Family,
query, evidence, pagination and selected asset are URL state. Reset/Back retain
the existing focus/recovery behavior. Native-size preview, backgrounds, zoom,
original downloads and file serving are preserved.

## Verification

```powershell
pnpm exec vitest run web/src/lib/game-artwork/storage.test.ts web/src/lib/game-artwork/discovery.test.ts --maxWorkers=1
```

The retrieval tests exercise the real frozen projection, including literal Doctor
Doom, anonymous Grandmaster Nexus, Tier 5 Basic Catalyst and Old Man Logan IDs;
shared/tinted uses, no false Bleed mapping, Tower-vs-model separation, gacha prize
separation, every ID across 105 pages, input hashes, stale sidecars and cache-key
isolation. The 19 parent file/SQLite/stream regressions remain byte-identical.
Local measured cold searches, warm paging, startup, browser evidence, preservation
hashes and rebuild comparison are in `temp/game-artwork-page/discovery/`.

The final local Node 24.4 adapter probe initialized in 871 ms. Initial full-catalog
sorting took 86.49 ms; Doctor Doom 73.34 ms, anonymous Grandmaster Nexus 27.26 ms,
and T5BC 20.89 ms. Cached median calls were 0.06-0.21 ms in that probe (seven calls
per case, excluding HTTP/render time). Startup increased heap used by 70.0 MiB and
RSS by 183.1 MiB without forcing garbage collection; final process RSS was 303.4
MiB including the TS runner and SQLite. This is a per-worker in-memory projection,
not a claim about multiworker production load. Provision memory and storage
separately before deployment. The UI-component rule excludes Signature Ability
Crystal artwork from Effects & node UI; this is covered by a literal asset-ID
regression alongside the gacha-prize and Tower-model exclusions.
