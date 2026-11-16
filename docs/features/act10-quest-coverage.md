# Act 10 public map coverage

The November 10 public preview observation adds all 16 Act 10 layouts to the existing permanent quest explorer. Runtime checks now establish **234 public variants / 234 layouts**: 184 Story and 50 Special. The increment contains 249 walkable tiles, 254 directed links, 13 portal targets, 37 ordered native route records and 32 placed defenders. Recorded routes do not establish an exploration run count.

`act10_normalizer.py` is a pure offline projection. `build_act10.py` accepts exactly the frozen 16 quest IDs, verifies the successful run and every public shard against its receipt, and emits 16 map shards, literal loaders and an additive `act10.json` sidecar. The original catalogs, previous map shards, Tower blocks, reward/art/icon ledgers and public assets remain unchanged. Existing chapter cards and map controls consume the new layouts through the existing runtime interfaces.

## Native contract and identity

Source run: `temp/quest-explorer-review/act10-backend-20261110/revision-2/runs/3fa58d9e0e664f85bfc1b05d4c772f64`. ROOT acquired these selected public fields using the native read-only quest-detail request; all game leases were subsequently revoked. Integration performs no client access. Each normalized map retains the selected source shard SHA, full response SHA, capture date, reader and contract SHA, exact quest/map identity and source file pointer. The observation spans `2026-11-10T18:11:27.381065+00:00` to `2026-11-10T18:13:04.616267+00:00`; it does not establish current account eligibility or unlock gameplay.

The pinned native constructors are `QuestMap`, `QuestMapTile`, `QuestMapPath`, `QuestBoss` and `QuestTypedBuffData`, with `QuestBuffData` target accessors and the native map buff setup/application methods. Exact static source hashes and method line anchors are recorded in `integration/native-normalization-proof.json` and in `act10.json`. The source manifest also pins the existing detailed field-layout/request proof. No native methods are invoked.

| Wire field | Normalized meaning |
| --- | --- |
| `data.qid`, `mapId`, `setId`, hierarchy | Exact catalog/map/set/Act/chapter/quest gates |
| `map.grid[x][y]` | Native x-major walkable tiles; coordinates remain internal |
| `links`, `pt` | Directed edges and exact portal targets, labels, chances and tags |
| `pathData[].path` | Original ordered route coordinates, without route synthesis |
| Tile `boss` and `entities` keys | Exact deduplicated placed boss-table identities |
| Boss `character` / `characters` | Exact Blueprint → Character/Rarity → playable `gameId` joins and alternatives |
| Boss rank/level/signature/ascension | Native values without player caps or final combat calculations |
| Tile `final` | Existing finish flag; four independent native final-boss/metadata flags remain in `nativeBossFlags` |
| `all_buffs` | Every authored local assignment, exact redeemable ID/quantity, native default flags and JSON pointer |
| `completionRewards` | Six independent source arrays and exact type/data/quantity/source-index identities |

All 32 placements resolve exact blueprints: 21 playable placements and 11 NPC occurrences across nine native characters. The frozen BCG SHA is `b821489b5451d1d6ee0927f39a80d964f6c1d3aaf13bd76531e5f77d93deba8e`; blueprints SHA is `2059a0b12ab54b3a582a60371dbc10b9e24b966ae202e6ee8127d464effb2313`. Names use the matching native English character definition. All nine NPCs reuse existing portraits with the same exact Character, BCG and image content hash. No inferred playable identity or new artwork binding is added. Eight unplaced boss-table entries remain separately recorded; they do not become placements or search encounters. Existing frozen chapter boss-preview cards remain available.

## Coverage limits

All **271 modifier applications / 149 IDs** are retained. Complete native modifier definitions and versions were absent from the original acquisition, so the immutable map shards retain unresolved definition coverage, null descriptions and null icons. The later, independently dated projection below resolves their display data. Matching an ID alone cannot transfer a historical name, description or icon. Unsupported propagation, legacy/entity/boss modifiers or map-wide modifier inputs still cause normalization to stop rather than disappear into an empty list. Runtime scaling extras are excluded.

## Recovered modifier descriptions (November 16)

The approved finite public-definition capture recovered all **149 exact IDs**, with no missing definitions, at `2026-11-16T14:47:10.335988+00:00`. The native `BuffsDB.GetBuffDetails` method establishes global-before-user lookup priority. The first global-only read returned no requested definitions; the separately approved amendment read only the listed public definition fields for those same IDs in the fallback table. Active buffs, ownership, progression, inventory, expiry/usage fields, raw source objects, credentials and unrelated record values were excluded. Both read handles were closed and their individual read authorities revoked. No gameplay or game methods were invoked.

`act10-modifiers.json` adds names and fully formatted descriptions for **all 271 assignments** without rewriting any map shard, route, defender, build or reward. The server projection requires the exact quest/map/source hash, application ID, native redeemer, quantity, target, coordinate, scope and persistence context. Changed identities or contexts stay unresolved; existing independent definitions are preserved. The original map capture date is unchanged. “About this map” separately dates the modifier-description observation.

The portable input fixtures retain only the approved public fields and selected display inputs from the public BCG cache produced during normal client startup. The captured definition SHA is `c2c7e45ce3cfe4014b358313dda07f2596b1013d176f3facf2f29626d503c7cf`; the component BCG SHA is `ea95b7299aba4fd4ef4accbc6c251ba73cfd186c41ac58369134907d327cbf6a`. This is a separate observation from the older map snapshots, not a claim about their historical definition versions.

The formatter follows the pinned `QuestBuffData`, `GameUtils.GetFormattedLocalizedBuff`, BCG display-formula and localization methods. It uses the exact first component, appearance and formula; chance, magnitude, duration and stack-count arguments are independently checked against **73 existing native descriptions with identical raw definitions**. All 73 agree, and no unresolved numeric placeholders remain in the 149 descriptions. Unknown components, formulas and template arguments stop the build.

The current first-component appearances establish **208 native icon assignments**. Thirteen additional outlines are exported from the already verified native font with exact cmap, glyph, bounds and content hashes; the earlier icon registries and assets remain unchanged. The 63 generic BCG attack/health assignments retain readable text and an unbound icon: their attribute-based glyph input was outside this capture, so no icon is inferred from the name or ID. The full raw definition/component catalogs are not shipped to the browser.

```powershell
python -X utf8 -B scripts/game-quests/build_act10_modifiers.py
python -X utf8 -B -m unittest discover -s scripts/game-quests -p test_act10_modifiers.py -v
pnpm exec vitest run --config scripts/game-quests/vitest.config.mts src/tests/game-quests/act10-modifiers.test.ts src/tests/game-quests/act10.test.ts web/src/components/game-quests/quest-act10-modifiers.test.tsx
```

Quest rewards use the fresh map observation, while Act/Chapter rewards retain their prior independent dates and identities. The native `QuestSummary` constructor establishes first, maximum-first, mastery, potential and alliance arrays; `RedeemerItem` establishes the compact `t`/`n`/`q` aliases. `_replayItemAwards` is preserved as its own observed wire array; this static snapshot does not establish a native replay property or a guaranteed reward. Maximum-first/replay/event/stat outcomes are never summed into completion or exploration grants. The existing presentation keeps non-item outcomes separate. No account progress, eligibility, final combat stats or current availability is inferred.

## Verification and reproduction

The portable Python suite uses three selected real wire fixtures and all 16 published map/hash/graph records. When the ignored immutable source run exists, it additionally checks every map's exact source path, link, portal, placement/build, native boss flags, modifier and all six reward arrays. It imports no live reader. The new runtime suite checks all 16 maps, 234/234 coverage, exact source hashes, NPC joins, unplaced boss exclusion and the six routes sharing the final Chronoserpent placement.

```powershell
python -X utf8 -B -m unittest discover -s scripts/game-quests -p test_act10_normalizer.py -v
pnpm exec vitest run --config scripts/game-quests/vitest.config.mts src/tests/game-quests/act10.test.ts src/tests/game-quests/catalog.test.ts src/tests/game-quests/permanent.test.ts src/tests/game-quests/progressed.test.ts
pnpm exec tsc -p scripts/game-quests/tsconfig.json --noEmit
python -X utf8 -B scripts/game-quests/build_act10.py --output temp/quest-explorer-review/act10-backend-20261110/integration/reproduced-final
```

All 19 generated files reproduce byte-for-byte. The scoped TypeScript and ESLint checks pass. Existing full-corpus tests now have a 120-second timeout for their actual all-map validations. Browser QA on the existing port 3011 server covers desktop, 390 and 320 px, the longest and branch maps, every native boss map, readable names and portraits, chapter cards and rewards. Actual wheel zoom, pointer pan, Fit, route/defender selection, location/application deep links, Back and portal navigation pass. PNGs were inspected; no visible coordinates or page overflow were found.

The ignored `integration/HANDOFF.md` and its frozen/changed/source manifests contain exact hashes and browser evidence. ROOT owns the independent review and production build. No commit, release, database change or further game access is included.
