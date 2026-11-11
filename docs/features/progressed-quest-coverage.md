# Progressed permanent quest coverage

The append-only November 9 supplement expands public saved-layout coverage from **211 variants / 66 layouts to 234 variants / 218 layouts**. Story has 184 captured summaries: all 168 quests in Acts 1–9 now have saved layouts; the remaining 16 summaries belong to Act 10. Special has saved-layout coverage for 50 variants across 13 explicitly reviewed permanent collections, including all 24 Road to the Labyrinth rounds. Combined coverage is 1,464 authored paths, 51,084 walkable coordinates and 5,995 placed encounters. These are captured definitions, not a promise of current account access, complete defender inventories or a universal release inventory. The existing `full-map` query/API value means a saved layout is available; its public filter label is “Layout captured”.

The new capture contributes 152 maps: 119 Story, ten Road and 23 variants from ten additional Special collections. The nine requested missing collections are present; Necropolis is also source-backed. The original 274-variant/51-map archive, first permanent supplement, old menu artwork and terrain projection are preserved. Monthly/Daily/Event Towers remain excluded consistently from navigation, search, counts, map loading and exact-gameId encounter discovery. An excluded historical direct URL explains its scope instead of presenting it as permanent content.

## Exact collection policy

Native category is not a permanence classifier. Each added container was reviewed using its exact native identity, containing hierarchy and lifecycle fields (`expiryTime=0`, `timeLimit=0`, summary `end=-1` or `0`). No suffix or name similarity creates membership. Existing reviewed Story, Mausoleum, Road and Realm container IDs remain in the preceding supplement.

| Added containing-set ID | Native set name | Variants |
| --- | --- | ---: |
| `67466eac1fbd7c1224a0f6e2` | `pain2024_finale` — The Epoch of Pain | 2 |
| `67f7ee588f9473addee407d3` | `pve_crucible` — The Crucible | 4 |
| `675c7c6bc978b7131e691e92` | `wheel_of_fate_2025` | 3 |
| `6360688121824e1b6793b43f` | `painquest_acceptance` | 2 |
| `63eea1742a4fa65b9d878d3e` | `necropolis` | 1 |
| `5c671733b473cf3cd097f5c0` | `realm3_abyss` | 1 |
| `57a90ad550ec3ffc44c4a6c3` | `labyrinth` | 1 |
| `6360344121824e1b6793b35d` | `grandmasters_gauntlet` | 2 |
| `63dd3c219de4ee20435258cb` | `pve_may2023_shootingstars` | 6 |
| `6a209bc47cb2a9f719e61a83` | `reversal_legends_final` | 1 |

Crucible retains its native `Unrestricted` category and Gauntlet/Shooting Stars their `StoryEvent` category. They are included through reviewed container IDs. Epoch's second quest retains the exact native ID `me_pain2024_fin_ques2`. Product Story numbering follows captured Acts → Chapters → Quests membership and explicit indices, never an ID suffix.

## Capture and version reconciliation

The user manually selected a progressed account and confirmed normal Special/Story selection. The previous process had exited; the new process was inspected from scratch and all binary, helper, metadata and layout hashes verified before bounded reads. The GameAssembly remains SHA-256 `01f46bb2e36c2160a8df939bbb080bcf2ee89ca15427692a10334efc90fd4abb`. No stale pointers were reused. Public definitions were loaded only through ordinary menus and quest previews. No quest/Tower entry, match, team edit, energy use, unlock, reward claim, game method invocation, injection or process write occurred. No profile, progression, credential or session fields are exported.

Ignored evidence lives at `temp/quest-explorer-review/progressed-20261109/`. `capture-manifest.json` pins the initial public-definition catalog, narrow source-art capture, finite 168-target inventory, empty Tower membership observation, 36 map receipts and 152 raw maps. The read-only readers use the original external `OpenProcess` / `ReadProcessMemory` implementation with finite two-million-read / 64MiB invocation budgets and `finally`-closed handles. The game was restored to normal Special selection and the exclusive capture slot explicitly released before offline work. No further game access is needed by this implementation.

`build_progressed.py` verifies every captured byte against the ledger, exactly one receipt per new map, finite target membership, the binary/layout/reader hashes and exact frozen quest/map/container/summary identities, hierarchy, indices and difficulty. Existing catalog identities keep their original source hashes. New summaries carry the new catalog source hash; refreshed maps and boss previews carry their own exact source hashes. Graphs, portals, ordered paths and placements use the existing normalizer. Native boss-dictionary references determine placements; unplaced table rows are never encounters.

The current 378 explicit final-boss preview rows are separate from map encounters and rewards. Blueprint → exact Character/gameId → public champion identity remains the only champion join. The retained BCG/schema/blueprint/champion snapshot hashes are pinned; a source disagreement fails projection instead of silently mixing identities. Ares and other native NPCs keep their own source labels and portraits without playable champion links or inferred classes.

Visual QA also corrected native color-markup leakage in application titles, reusing the existing plain-text game formatter while keeping the raw label in application data. A source-structural final-boss-only preview note makes the Abyss limitation visible before its map. Neither correction changes source bytes, placements or effect identities.

## Artwork and runtime delivery

The refreshed art manifest resolves 90 exact public/native keys with zero unresolved keys; all 234 public quest variants have verified menu artwork. Source Act/Chapter/QuestSummary roles, hierarchy propagation, raw-capture hashes, native pack/TOC or exact captured URI/cache chain and export hashes remain recorded. Local Acts 1–3 keys resolve through exact manifest members as established by the preceding supplement. Additional remote art uses only captured public URLs; no guessed CDN path or filename similarity is used.

For a collection or Special quest header the verified containing Act poster is preferred over its Chapter image: some Special chapter images are reward illustrations. Story chapter choices retain their own exact Chapter image and native ordering. Source originals are unchanged. Root's compact card design uses a bounded consistent crop, overlaid titles, visible actions, four choices on desktop, a two-choice phone rail and a compact single-chapter card. Map terrain remains separate and unchanged; newly added quests bind their exact native theme into the existing verified terrain chain.

Ninety-one additional NPC/legacy gameIds resolve to 88 new content-addressed WebP assets through exact retained BCG `_imgID` → local native portrait pack membership. Combined with the previous 30 bindings, there are 121 native gameId portrait bindings. A portrait does not establish a playable champion identity. Unsupported native art remains neutral.

Maps load only for the selected quest. `progressed-map-loaders.js` uses finite literal dynamic imports so Next can trace deployment files; its small `.d.ts` declares the `QuestMap` boundary without forcing TypeScript to infer the structural type of 197,859 new applications. This avoids the initial scoped compiler heap exhaustion while preserving lazy imports and full runtime/source validation. No complete map collection or raw capture is imported by client components or shipped in browse payloads.

## Modifier and planner seams

The approved 27 shared icon files remain byte-identical to root's inventory. The three approved source-only node artifacts remain offline projector inputs; no sibling runtime imports or undeployed `/nodes` links exist. Existing exact 10,879 / 14,012 assignment icon bindings across 49 original public maps remain unchanged. The later [reward/control iteration](quest-rewards-controls.md) establishes 40,839 exact icon bindings across the 169 refreshed maps (previous 17 + new 152), with complete raw definition/version/BCG/glyph/SVG proof. Another 157,869 applications remain unbound because the frozen definition reference does not include their complete version. Labels are never used to broaden that binding.

Quest-owned application details preserve assigned text, exact effect ID, contextual source/target names, route associations and source/application deep links. Exact coordinates remain internal and in URLs; public text and expanded technical disclosures use human labels. A later released node destination can consume the existing exact effect/version adapter and nullable `iconKey`; source/version/catalog evidence remains server-only. The original offline seven-route planner compatibility fixture and smallest route-to-planner contract remain unchanged. No plan import, persistence or unverified planner destination is added.

## Remaining limits

- The 16 Act 10 summaries have no full maps. Native selection displayed Act 10 locked; no bypass was attempted. They remain browseable with explicit summary coverage. Native IDs are `epilogue_*`, demonstrating why suffix inference is invalid.
- All requested nine previously absent Special collections and the ten missing Road maps are now covered. This does not prove that every permanent definition in every current client state was loaded.
- Both initial and progressed native Tower observations had empty block/floor dictionaries. Normal Tower selection exposed an `Enter Tower` control without a proven menu-only floor preview. It was not activated. Six permanent Class identities/art remain useful; per-Tower block/floor counts, opponents and completeness are withheld. Event Towers stay excluded.
- No explicit final-boss preview exists for `a08_ch04_q06` in the captured summary. Its newly saved map supplies real placements; the absent preview is not guessed.
- The Abyss (`realm3`) has 1,260 captured walkable coordinates and 20 authored routes, but its saved native boss dictionary and tile/entity references contain only `finalBossID` (Nameless Collector). The saved map has only the final-boss placement. Its native summary also retains 63 unplaced ambush-definition rows; their coordinates and route assignments are unestablished. The UI visibly identifies this final-boss-only preview. No other opponent identity, count or location is inferred. “Captured layout” does not mean a complete defender inventory.
- Combat HP/Attack/PI, active modifier removal, gates, energy and portal costs remain unestablished. Captured builds and assignment parameters are observations, not simulated combat values.

## Reproduce and verify

```powershell
python -X utf8 scripts/game-quests/build_progressed.py --source temp/quest-explorer-review/progressed-20261109
python -X utf8 scripts/game-quests/build_progressed_art.py --source temp/quest-explorer-review/progressed-20261109 --fetched temp/quest-explorer-review/progressed-20261109/fetched
python -m unittest discover -s scripts/game-quests -p 'test_*.py'
pnpm exec vitest run --config scripts/game-quests/vitest.config.mts
pnpm exec tsc -p scripts/game-quests/tsconfig.json --noEmit
pnpm --dir web exec eslint src/app/quests src/components/game-quests src/components/nodes/NodeModifierIcon.tsx src/lib/game-quests
node web/node_modules/eslint/bin/eslint.js --config web/eslint.config.mjs src/domain/game-quests src/domain/node-modifiers src/data/game-quests/*.ts src/data/game-quests/progressed-map-loaders.js src/tests/game-quests
```

Both exporters accept separate output/asset directories for byte comparison. The art command reuses retained bytes without network fetches; `--fetch-missing` is an explicit optional exact-URL fetch. Source artifacts and original projections are never overwritten. New suites for later parent registration are `src/tests/game-quests/progressed.test.ts`, `scripts/game-quests/test_progressed_projection.py` and root's `web/src/components/game-quests/quest-chapter-panorama.test.tsx`; existing catalog/permanent/menu-art suites were extended. Shared CI remains untouched.

Actual responsive Preview captures, inspected PNG inventory, deterministic comparison results, exact file/hash inventories and a compact absolute-image selector are under `temp/quest-explorer-review/progressed-20261109/`. The local read-only app remains available at `http://localhost:3011/quests`. Root owns review and release; no commit, push, PR, deployment, database/schema, shared navigation or CI change is performed.
