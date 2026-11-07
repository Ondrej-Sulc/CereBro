# Static all-reward crystal catalog

`src/data/game-crystal-openings/catalog.json` is an independent November 5, 2026 static opening snapshot. It does not replace or relabel the November 3 champion-membership snapshot in `src/data/game-crystals/catalog.json`.

The source gacha SHA-256 is `c4873c0f509665e6f32a18be3c57d8c91887c1122e7a9b8b3e3423805922de3e`. Observation and source capture were recorded at `2026-11-05T14:05:24+00:00`; these timestamps describe captured evidence, not a crystal's release date, game version or current store availability. Public provenance contains only filenames, byte counts and hashes, never local paths or account state.

## Coverage

The website exposes one complete crystal catalog at `/crystals`. It covers all 2,448 exact definitions in 2,417 base entries: existing champion-family grouping is retained, monthly Login editions are grouped for browsing, and 336 definitions without direct champions are included. Main pools is a category alongside the other eight types, rather than a separate scope. Recommended order places all eleven main pools first before paginating the rest; explicit alphabetical and newest-edition order remain global. Name/source-ID search, categories, champion stars, reward filters and sorting share URL state. Reward filters distinguish champion pools, materials/other rewards and mixed outcomes; choosing materials clears the champion star filter. Material cards show possible-reward counts/types and recorded rate/Grace indicators where available.

The old `/crystals/openings` list permanently redirects to the catalog, retaining search, sort and pagination. Legacy `scope=all` URLs remain usable; `scope=main` selects `category=main` unless an explicit category is supplied. New navigation and return URLs omit scope, and saved scroll positions normalize older scope-bearing URLs. Exact definitions live at `/crystals/[sourceId]`; old `/crystals/openings/[sourceId]` links permanently redirect to the same exact opening. Primary navigation has two destinations: Browse crystals and Find a champion. Crystal details retain the compact Compare pool action with the current pool and selected stars; existing `/crystals/compare` URLs, deep links and browse return state remain supported.

### Finding ascension rewards

`/crystals?reward=ascension` now means **7★ Ascension** discovery, overlapping
the existing three reward kinds. The prominent action uses that explicit label.
`hasCrystalSevenStarAscensionRewards` in
`src/domain/crystal-ascension-rewards.ts` accepts direct champion inventory tokens
only with exact seven-star canonical cost or resolved `t7:<champion>` usage
evidence; class tokens require resolved exact `t7:<class>` usage. It also accepts
ascension bonuses bound to an exact resolved seven-star
`hero`/`hcos` outcome, preserving the category, source reward index and bonus ID.
An automatic-ascension flag or a verified seven-star token/bundle within that bonus
establishes relevance, not a guarantee for every drop.

Six explicitly reviewed token-bearing inventory bundles also qualify: the three
Arnim Zola Tech-token/Empowered bundles, the progression-8 class-token-crystal
stash, and the progression-8/9 silver class-token-crystal bundles. Their exact
identity list is `RECORDED_SEVEN_STAR_ASCENSION_REWARD_BUNDLES`; the existing
source/title evidence regression remains in place. Dust-only bundles, Mystery
Orb lookalikes, rank-up gems, cosmetics, preview rewards and unresolved contents
do not qualify. Neither English titles nor broad name substrings establish stars
or bundle contents, and nested crystals/selectors are not expanded into sources.

Generic Primordial Dust alone, including a bonus lacking those explicit ascension
signals, no longer makes an otherwise unrelated crystal a seven-star discovery
result. This is a product scope rule: **seven-star A2 also
consumes dust**. Exact 4–6-star paths, seven-star A2 dust/gold/token costs, normal
Materials & more / Mixed rewards discovery and full detail reward quantities and
odds remain intact. The broader `hasCrystalAscensionRewards` predicate and its
lower-star/dust bundle list remain available to general reward consumers.

Matching records exact source IDs within each family and links to a qualifying
opening. Search, category and availability constraints must match that same
opening; another Standard or Nexus variant cannot supply a name, category or
availability state. The card uses the selected exact source's name, artwork,
reward summary, selection rules and edition ordering, even when its family has
an unrelated representative. Its projected variant/source IDs contain only that
selected qualifying opening. Alphabetical ordering uses the displayed name.
The filter clears champion-pool star restrictions so material-only seven-star
token sources remain included; there is no lower/all-star Ascension menu. Live
search, category, sort, pagination, reset and return links retain their behavior.
The selected-filter note explains conditional champion drops and A2's dust cost.
The independently dated opening/ascension snapshots remain November 5/November 3;
matching establishes neither current sale, odds, guaranteed ascension nor personal
eligibility, inventory or affordability.

Focused regression coverage includes the existing classifier, browse-index,
loader, filter and browse-return suites. Add the new
`web/src/lib/data/crystal-seven-star-browse.test.ts` to the final integration/CI
suite list. It uses unchanged recorded reward fixtures with a deliberately
divergent family presentation to check exact-source selection and prohibit
cross-variant category/availability matches. No workflow configuration changes
are part of this scope correction.

Seven-star browse verification on 7 November 2026 passed **100 tests in six
files**, using `--maxWorkers=1`: the classifier, browse catalog, new seven-star
browse fixture, crystal loaders, crystal filters and browse navigation suites.
Scoped TypeScript passed using the ignored
`temp/crystal-seven-star-browse-tsconfig.json`; scoped ESLint passed with zero
errors and six existing test-mock warnings. No full TypeScript run, fresh game
capture, database write or browser verification was performed for this change.

Champion crystal pages show the exact opening's source-matched drop rates above the champion pool and illustrated other possible rewards below it. Champion membership on these pages and browser card counts come from the November 5 opening snapshot. Existing editorial family mappings and champion acquisition lists retain their separately dated November 3 evidence. Exact Standard, shard and Nexus source IDs remain distinct for odds and rules even when their champion pools match. Champion name, class and star filters affect portraits only; they never filter or renormalize rates, other rewards or conditional bonuses. Legacy `variant` query values are accepted only within the displayed family. Verified nested drops link directly to their exact `/crystals/[sourceId]` page, preserving selection behavior rather than canonicalizing a Nexus drop to Standard.

Opening pages show dated, source-hash-matched live odds when recorded, independent prize groups, possible-reward categories, conditional additional rewards and recorded Grace/box rules. Unique, verified `gs`/`gf` token bindings link to nested crystals, including Superior Banquet → Jubilant. The source-bound [reward artwork sidecar](reward-artwork.md) supplies exact game art for materials, fragments, inventory items, currencies and crystals through immutable GCS objects; missing artwork has a generic fallback. Neither the website nor the collectors infer individual champion odds by dividing category rates or multiplying nested reward chains, nor join rate rows to reward cards by English label.

The rewards browser defaults to **Rarest first** and offers **Most common first** beside search. Sorting uses each displayed category's exact numeric rate independently within its existing prize group, including collapsed class/amount families; equal rates retain source order and unrated rewards stay last. Prize order, guaranteed extras and conditional ascension bonuses remain separate. Search and prize filters retain the chosen sort, expanded options and exact nested links retain their behavior, and a different crystal resets local controls. Unknown-only and single-category views omit the sort control.

| Recorded definitions | Count |
| --- | ---: |
| Exact crystal source IDs | 2,448 |
| Possible-prize category definitions | 3,386 |
| Ordered category reward entries | 40,404 |
| Non-champion category entries | 6,920 |
| Openings without direct champion entries | 336 |
| Openings without possible-prize category bindings | 3 |
| Conditional bonus bindings | 218 |
| Bonus reward definitions | 158 |
| Pity templates / groups | 134 / 378 |
| Openings with pity / finite-box rules | 97 / 51 |

Every category entry retains `sourceIndex`, exact type/data, quantity, minimum/maximum, balance, context and action/header/footer fields when present. Duplicate entries and category binding order remain intact. The one reversed source range (`ave_map5_crystal_20_0_1`, `epic_mutant`, 600–500) is retained and marked `reversed_in_source`.

`displayName` resolves 39,248 category entries using the reviewed registries below. Source hashes for auxiliary BCG, GameStore and English localization inputs are separate in `source.displayMetadata`. Unresolved resource or nested reward IDs remain visible; names are never fabricated from ID patterns. Inventory titles can be generic, such as “SIGNATURE STONE”; the exact source ID remains necessary to distinguish variants. Champion rewards and blueprints also carry exact BCG `gameId` and `rarity` annotations when resolved.

### Verified display registry joins

These mappings were verified against the captured metadata hashes and corresponding method bodies. The exporter requires the reviewed Marvel/Fuse metadata hashes before adding registry annotations; changed game metadata requires another dispatcher review.

| Reward type | Verified registration / display method | Name lookup |
| --- | --- | --- |
| `hero`, `hcos` | Existing direct champion extractor; `hcos` first-edition contract | BCG blueprint → character English friendly name |
| `bp` | Marvel `Setup` → `HeroRedeemerMapping.GetLabel` | BCG hero blueprint; preserved as a blueprint reward |
| `ebp` | Marvel `Setup` → `EvoBlueprintRedeemerMapping.GetLabel` | BCG `EvoBlueprint` → friendly base name |
| `ebpf` | Marvel `Setup` → `EvoBlueprintFragmentRedeemerMapping.GetLabel` | Same EvoBlueprint base name; remains a fragment reward |
| `inv` | Existing GameStore inventory metadata projection | Exact GameStore `Name` → `Title` |
| `gs` | Fuse `RedeemerManager` → `GachaSpinRedeemerMapping.GetLabel` → `GachaManager.GetTokenLabel` | Exact reward `Data` = box `Token`, then display name |
| `gf` | Fuse `RedeemerManager` → `GachaFragmentRedeemerMapping.GetLabel` → `GachaManager.GetFragmentLabel` | Same token join, fragment name with display-name fallback |

EvoBlueprint friendly values can themselves be localization keys. Captured Sparx `words` inputs with `meta.language=en` provide exact key/value resolution. Conflicting translations or conflicting names across boxes sharing one token remain unresolved. For example, `ebpf:rare_event` resolves to the base name “TIER 3 ALPHA CATALYST”; the `ebpf` type still identifies fragments. This does not reproduce the runtime's additional localized fragment/alloy formatting.

## Semantics and limits

- `categories` contains direct possible-prize entries. Membership does not establish a probability, independence, guaranteed bucket or sale status.
- Featured/carousel/set prizes live under `presentation` and never establish actual opening rewards.
- `conditionalBonuses` resolves each category reward's exact `context.bonusReward` link. These bonuses are conditional on that entry, not unconditional rewards for every opening.
- Pity group thresholds and exact counter tags remain separate from numeric odds and account progress.
- Nested crystals (`gs`), crystal shards (`gf`), champion blueprints (`bp`) and upgrade materials (`ebp`/`ebpf`) stay typed and unexpanded. Their `data` is not automatically treated as a crystal source ID or used to imply direct champion membership. `nestedCrystalId` is added only for `gs`/`gf` when exactly one source box has the matching `Token`. Ambiguous tokens can retain an agreed display name but never receive a guessed link. This enables Superior Banquet → Jubilant navigation without flattening nested membership or multiplying odds.
- `sourceMetadata` preserves raw opening/set tuning, including `minItems`, `maxItems`, `pickSet`, `token`, `endTime` and version fields when present. All current boxes record `minItems=maxItems=1`; this is not a reliable count of granted reward buckets. In particular, Superior Banquet 2025 has six bound categories and no direct champion entries here. Its nested Jubilant Crystal remains an opaque `gs` reward. Do not display these raw count fields as the number of items guaranteed by an opening.
- Every current `endTime` is `-1`; no box has a `Version`. Three sets share an opaque version hash, which is not a semantic game version. This export makes no chronology inference.
- The static source has no numeric probability table. Per-source odds require separately verified evidence, and two openings sharing champion membership can still have different odds, bonuses, costs, pity or opening rules.

## Public reader

Import `src/data/game-crystal-openings/index.ts` on the server. `listCrystalOpenings()` returns compact definition rows without reward arrays. `getCrystalOpening(id)` returns the exact definition plus its ordered categories, separately labeled conditional bonuses, pity bindings and source provenance. Unknown IDs return `null`. `getCrystalOpeningCategory(id)` supports bounded server projections without cloning the catalog. `assertCrystalOpeningsSourceHash(hash)` rejects cross-snapshot source equivalence claims. Never send the full artifact to a browser; project a bounded page and selected categories at the server boundary.

## Reproduction

Run the exporter against read-only captured raw binaries and the named schema generated by `scripts/export_mcoc_proto_schema.py`. Pass the recorded observation/capture times explicitly; reproduction time must not become an invented source observation. The example uses relative captured filenames; raw binaries, schema and decompiled bodies remain ignored under `temp/`.

```powershell
python scripts/extract_mcoc_crystal_openings.py `
  --gacha temp/quest-data-investigation/game-only/sources/gacha-A29758BCA3552F42481F416859DD53E4BE131265.bin `
  --schema temp/crystals/schema.json `
  --observed-at 2026-11-05T14:05:24+00:00 `
  --captured-at 2026-11-05T14:05:24+00:00 `
  --expected-gacha-sha256 c4873c0f509665e6f32a18be3c57d8c91887c1122e7a9b8b3e3423805922de3e `
  --bcg temp/quest-data-investigation/game-only/sources/bcg-E95E28EECECC04D6A358C8FD8089D01305D0FB73.bin `
  --gamestore temp/crystal-openings/gamestore-5AFEBC8CC99BE2C1546DB91EF7B1F6360DFD7154.bin `
  --words temp/crystal-openings/words `
  --out src/data/game-crystal-openings/catalog.json
```

The exporter reuses the verified crystal-rules projection, validates named protobuf contracts, rejects unknown binary fields/reward types/dangling references and currently rejects nonempty tab definitions for review rather than silently omitting them. It performs no network requests, account access, database writes or nested expansion.

Validation: `python -m unittest discover -s scripts -p test_extract_mcoc_crystal_openings.py`; `pnpm exec vitest run src/domain/crystal-openings.test.ts src/data/game-crystal-openings/index.test.ts`. Tests cover all-source counts, resource-only Superior Banquet, mixed Greater Banquet, unique/ambiguous token links, exact quantity ranges, conditional bonuses/pity, presentation separation, source mismatch, malformed bindings, exact/conflicting localization joins and public-reader mutation isolation. The catalog is deep-frozen once after validation, avoiding large clones on subsequent list/detail reads.
