# Public quest explorer

The current public explorer contains **234 permanent Story/Special variants and 218 captured layouts**: all 168 captured Story quests in Acts 1–9 and all 50 Special variants. Sixteen Act 10 summaries remain without layouts. Saved-layout coverage does not promise complete defender inventories: the Abyss preview establishes only its final-boss placement. All 234 public variants have verified native menu artwork; compact chapter cards preserve native image order with a consistent bounded crop, quest cards show explicit boss previews, and six permanent Class Towers have their native art. See [progressed-quest-coverage.md](progressed-quest-coverage.md) for current coverage, exact remaining gaps and reproduction. [permanent-quest-explorer.md](permanent-quest-explorer.md) documents the preceding supplement and approved shared dependencies. The original 274-variant/51-map archive remains unchanged; its two transient maps are excluded from public discovery. Earlier counts below describe that original archive.

This increment adds public read-only `/quests`, `/quests/[id]` and `/quests/encounters?gameId=<exact-game-id>`. It has no game connection, endpoint collector, import action, database writes or planner persistence. One read-only, cached champion query per distinct gameId batch supplies existing public portraits and classes through the existing artwork/class helpers. NPC/legacy identities never use name joins. Exact native BCG-to-pack portraits support boss previews; unresolved artwork retains a neutral fallback. Champion Overview links to the opponent lookup through a small isolated component; How to obtain is untouched.

The current reward/control iteration adds independent Quest, Chapter and Act scopes, exact item quantities/artwork, source-bound modifier icons and measured wheel/touch navigation. Single-choice Special wrappers are bypassed and Special posters match Story Act proportions. See [quest-rewards-controls.md](quest-rewards-controls.md) for the current contracts, source identities, icon coverage, regression checks and limits. Earlier implementation notes below remain historical where superseded.

The subsequent [native icon v2 integration](quest-native-icons-v2.md) adds 98,280 exact assignment bindings from frozen build-only proofs, bringing current icon coverage to 149,998 / 212,720. The previous ledgers remain immutable; unsupported native shapes stay text-only.

## Snapshot and evidence

`src/data/game-quests/` contains an allowlisted, versioned projection of the accepted **game-only** November 5, 2026 captures (59.1.0 / CL 1456141). There are 274 exact quest variants, 51 complete maps, 223 summaries, 286 authored paths, 1,083 placements and 9,186 coordinates. This is capture coverage, not a live availability/release catalog. All 48 captured Story quests in Acts 1–4 have maps; Fair Play, November Crossed Wires and Weekly Supply Run are the other three.

`manifest.json` pins input/source-evidence hashes, the GameAssembly hash, the existing public CereBro identity snapshot, the exact current BCG used for labels, every output JSON and the generated loader. Inputs use logical relative evidence names, without machine/account paths. Each map carries its capture time, source file name, source SHA-256, exact quest/map identity and coverage. Empty native map hashes and shared set hashes are not used as versions.

The exporter joins tile `bossId` and entity `bossId` references to the **boss dictionary key**, then the named `blueprint` to current `BCGBlueprintBase.Blueprint`, then its explicit `Character` and `Rarity`. Only exact `Character == Champion.gameId` joins produce champion links. Character labels come directly from current BCG `BCGCharacterData._friendlyNameLoc.en`, including MAESTRO and legacy labels. Unknown IDs remain exact unknowns; no name/suffix join is used. Unplaced boss rows do not enter the encounter index. Multiple tile/entity references to the same coordinate and boss key are one placement. Shared placements appear once per map and retain all containing path indices.

The source inputs are the accepted artifacts at `C:/Code/CereBro/temp/quest-data-investigation/game-only/`, including `expansion/quest-index.json`, `expansion/map-validation.json`, `expansion/placed-encounters.json`, the 47 expansion captures, baseline `continuation/runtime-supply.json`, current blueprints and retained BCG bytes. The exporter also pins `source-manifest.json`, `quest-field-binding-evidence.json`, `detail-load-evidence.json` and `continuation/semantics-evidence.json`. It never runs the original capture scripts. Named evidence establishes:

- `QuestsManager.DB → QuestDB.AvailableSets → QuestSet.QuestSummarys/QuestMaps` and normal preview detail loading.
- `QuestBoss.character/blueprint → BCGBlueprintBase.Blueprint → Character/Rarity → Champion.gameId`.
- `QuestMap.paths[].tiles` is ordered route data; coordinate sorting is not traversal order.
- `QuestMapTile.AddBuffToTile` assigns attacker/defender applications, while `GetActiveDefenderBuffs` further filters runtime active state. This browser displays assignments, not simulated active effects.

No raw captures are committed. The allowlist excludes account identities, progression, owned teams/inventory, active quests and session data. Public quest/container definition IDs, character IDs and crystal item tokens remain as source identities. Native build observations are not final HP/Attack/PI. Adaptive content has a source-specific notice before the map and a label beside captured builds. General provenance is in one disclosure.

## Reproduce and check

From this worktree, with the existing saved artifacts:

```powershell
python -X utf8 scripts/game-quests/build_snapshot.py --source-root C:/Code/CereBro/temp/quest-data-investigation/game-only --champions C:/Code/CereBro/temp/crystals/champions.json
python -X utf8 scripts/game-quests/build_artwork.py --source-root C:/Code/CereBro/temp/quest-data-investigation/game-only --resources "C:/Games/Marvel Contest of Champions/default/game/Champions_Data/Resources/Data"
pnpm exec vitest run --config scripts/game-quests/vitest.config.mts
pnpm exec tsc -p scripts/game-quests/tsconfig.json --noEmit
pnpm --dir web exec eslint src/app/quests src/components/game-quests src/lib/game-quests "src/app/champions/[slug]/champion-details-client.tsx"
```

The exporter also accepts `--output <review-directory>` for byte comparison without changing the tracked projection. It requires the schema beside the saved `champions.json`; its hash is pinned. A separate run reproduced all 55 projection files byte-for-byte. No source artifact is modified.

New CI suites, intentionally **not registered** in shared CI:

- `src/tests/game-quests/catalog.test.ts`
- `src/tests/game-quests/snapshot.test.ts`
- `src/tests/game-quests/planner-bridge.test.ts`
- `src/tests/game-quests/presentation.test.ts`
- `src/tests/game-quests/champions.test.ts`
- `src/tests/game-quests/artwork.test.ts`
- `src/tests/game-quests/menu-art.test.ts`
- `src/tests/game-quests/board.test.ts`
- `web/src/components/game-quests/quest-map-explorer.test.tsx`
- `web/src/components/game-quests/quest-chapter-panorama.test.tsx`
- `src/tests/game-quests/permanent.test.ts`
- `src/tests/game-quests/application-icons.test.ts`
- `src/tests/game-quests/progressed.test.ts`

The scoped Vitest config supplies `@cerebro/core` and web `@` aliases. Use its command above when registering, or add those aliases to the parent runner. The scoped TypeScript project includes only this feature, its data, tests and the pure planner helper used by the bridge check. It does not run a full web typecheck/build. Supplement Python suites are `scripts/game-quests/test_capture_source_art.py` and `scripts/game-quests/test_source_art_projection.py`; the historical audit suite is `scripts/game-quests/test_menu_art_audit.py`. Run these eight checks with `python -m unittest discover -s scripts/game-quests -p 'test_*art*.py'`.

## Delivery and map interaction

Browse/search/category/coverage/difficulty filters and pagination render on the server. The landing page offers verified Story acts; selecting an act offers its authored chapters. Selecting a chapter, searching or filtering renders up to 18 exact variants per GET page as compact rows. Native act/chapter labels stay independent from numeric indices. Variants share a display row only when their name, raw indices and complete authored membership agree; every original quest identity, difficulty and coverage retains a separate link. Act/chapter filters match the same hierarchy member, never an ID suffix. IDs move to secondary data details. Summary-only details show no invented layout or opponents. `map-loaders.ts` has explicit dynamic imports so Next can trace/package every projection while loading only the selected map on a detail request. Client components import domain functions/types, never the catalog/encounter reader. The champion entry point contains only a URL and an exact gameId; opening the lookup performs the server-side index query. There are no all-map browser fetches or raw capture assets.

The SVG uses actual coordinate endpoints for ordinary and portal edges. Cyan follows the selected authored route; dashed violet arrows show portal direction. Every placed defender has an always-rendered exact public portrait or neutral NPC marker, class ring, rarity badge and shared-path badge; final defenders have a gold boss treatment. Names appear on selection/focus/hover or with the Names control when space permits. Label placement avoids portraits and other labels without changing coordinates. Map nodes, captured starts/finals, ordered coordinate selector, next/previous steps, outgoing destination buttons, route fight order and all-placement toggle expose the physical graph. Zoom runs from the whole-map fit scale to 250%; desktop starts fitted, phones start with readable portraits and center the selected defender. Fit, center, optional overview navigator, mouse drag, touch scrolling and arrow-key panning support exploration. The overview starts closed so it does not obscure defenders. The encounter list and native coordinate selector provide keyboard navigation. Deep links preserve exact source path index and coordinate, e.g. `/quests/a05_ch01_q01?path=0&node=10%2C21`.

Node details preserve game effect ID, assigned target, source type/coordinate, quantity, persistence marker, linked target coordinates, resolved/raw text and parameter/reference data. React escapes text; display formatting only removes game markup. No sibling node-definition module or nonexistent node/glossary destination is imported/linked.

Quest-scoped direct champion rewards and `gs` crystal opening references render separately from opponents. The current view groups actual reward rows by Completion, 100% exploration and Potential rewards, hiding empty scopes. Item kind, quantity and direct-champion rarity remain attached. A server projection resolves `gs` data by **exact unique `sourceMetadata.token`** in the canonical opening reader, not by name or assumed opening ID. For example `quest_crystal` resolves to the existing `/crystals/quest_crystal_improvedspin`; `class_cat_crystal` resolves to Tier 4 Class Catalyst Crystal; `mythic_shard_crystal` resolves to Mythic Crystal. Canonical reward artwork is preferred, with the exact opening's crystal artwork as a supported fallback. Unknown or ambiguous tokens have a neutral Crystal reward presentation and no link. All exact tokens and native scopes remain in the single Data & reward details disclosure. A crystal reference does not guarantee a named champion. First/mastery/potential scope labels remain attached. This is not a full reward browser: act/chapter rewards, materials, positioned path rewards, selectors, nested rewards and possible crystal membership are not expanded. Gates, energy/portal costs, adaptive final stats and conditional source removal are not inferred.

## Modifier occurrence contract for the node track

Use `effectOccurrences(map, exactGameEffectId)` from `src/domain/game-quests/index.ts` after `loadQuestMap(questId)`. The exact lookup returns **assigned applications**, including applications on non-encounter coordinates, with:

```ts
{
  effectId, questId, mapId, sourceHash,
  applicationId, // `${questId}:${sourceHash}:${tileX},${tileY}:${target}:${ordinal}`
  coordinate, nodeNumber, pathIndices, encounterIds,
  target, sourceCoordinate, sourceType, remainActive, linkedTargets,
  amount, extra, name, description, rawDescription, parameters
}
```

Source path indices are zero-based; “Path 1” in the UI means source index 0. `applicationId` is a source-hash-bound destination assignment identity, not a reusable effect definition ID. Ordinals preserve collection order and never merge applications with equal names/text. `parameters.valueStr` retains exact modifier references, alongside original values/types/stat-modifier fields. The node track can join its exact effect definitions against `effectId`; source/application parameters and conditional state must remain distinct. This increment supplies a per-map pure projection, not a second node catalog or a global eager map index.

## Smallest exact planner bridge

The existing `web/src/lib/quest-planning-route-progress.ts` accepts encounters `{id, sequence, routePathId}` and route sections `{id, parentPathId, paths:[{id}]}`. Its `createInitialQuestRouteChoices`, `projectQuestRouteProgress` and `orderQuestEncounterIdsByRoute` handle the existing planning model. `quest-planning-projection.ts` adds player/objective/selection semantics; those are outside the public source catalog.

The prior saved offline `continuation/planner-preview.json` factors Surrender, Fair Play and Weekly Supply Run into common encounters and nested choices. The allowlisted test fixture `src/tests/game-quests/fixtures/planner-bridge.json` pins that preview's hash and retains only route structure, placement references and expected choices. The bridge suite runs the **real current helper**, then compares all seven projected fight sequences to this catalog's independent ordered coordinate routes. Shared Falcon/Kang/Kingpin remain single placements. It also checks the editor's order round-trip.

The smallest future bridge is an explicitly reviewed mapping `(questId, mapId, sourceHash, sourcePathIndex) → (persisted QuestPlan.id, verified routeChoices, placement-to-QuestEncounter.id mapping)`. For each mapped choice, require helper output to equal the complete source encounter sequence; keep the physical coordinate/portal map as separate evidence. Reconcile every exact defender identity and conditional node application before offering import or calling a saved plan compatible. Ordinary raw maximum zero is the documented five-slot fallback for the three proven samples, not planner Unlimited Swaps. Player slot unlocks remain separate. Arbitrary graph factoring, cross-joins and the other 48 maps are not certified for planner import by the seven-route fixture.

There is no verified persisted QuestPlan identity in these saved artifacts. `/planning/quests` requires authentication and stores unrelated user/editor plans. This browser offers no guessed planner deep link and performs no planner database lookup, import or persistence. It is useful independently while that product integration remains undecided.

## Local review

Dev server: `http://localhost:3011/quests`. Representative URLs:

- Simple: `/quests/p01_ch01_q01?node=4,15`
- Branch/shared boss: `/quests/a04_ch04_q01?path=0&node=24,16`
- Portals: `/quests/a05_ch01_q01?path=2&node=14,26`
- Assigned applications: `/quests/a05_ch01_q01?path=0&node=10,21`
- Unresolved NPC: `/quests/a04_ch04_q06?node=24,1`
- Summary: `/quests/epilogue_ch01_q01`
- Exact legacy lookup: `/quests/encounters?gameId=punisher_legacy`
- Excluded archival adaptive URL: `/quests/pve_nov2026_1_prg4?node=25,22`

For the current visual iteration, Preview snapshots failed twice with `Preview snapshot failed: Preview automation snapshot timed out after 15000ms.` Those errors were quoted before switching to headless Chromium. No native browser/game window was opened. `scripts/game-quests/capture_review.cjs` captures the running app at 1440px, 768px and 320–390px, checks document overflow and image loading (including SVG portraits), GET drill-down/search/history/pagination, portal destinations, zoom, route selection, keyboard selection/panning, mouse drag, neutral NPC identity and exact reward destinations. It closes its context/browser. Set `PLAYWRIGHT_MODULE` to the existing Playwright installation when it is not directly resolvable. No package installation is required. Owned Preview tabs are closed. The port-3011 server is deliberately retained for parent review.

PNG captures, `review.json`, exact `changed-files.txt` and a minimal absolute-image `preview.html` are in this worktree's ignored `temp/quest-explorer-review/`. They are real app captures. The parent owns final review, CI registration, release actions and any future planner/sibling adapters.

## Product refinement review - November 9

The follow-up preserves every map projection and its hashes. It adds verified act/chapter drill-down and compact variants, batched exact public champion portrait/class presentation, and exact canonical token-based reward presentation. IDs, snapshot mechanics, general reward eligibility and unsupported parser coverage live in data details; meaningful NPC unknowns, missing maps and adaptive source conditions remain visible. Champion Overview remains an opponent-navigation entry point outside acquisition.

The follow-up uses the existing port 3011 server. Preview first captured catalog pages; frame-wait evaluations then failed twice with `Preview automation evaluate timed out after 15000ms.` The errors were quoted before the permitted headless fallback. Headless Chromium supplies actual viewport PNGs for catalog, chapters, mixed variants, map/portal navigation, portraits, unresolved NPCs, rewards and summary-only pages. These are saved under `temp/quest-explorer-review/refinement/`; no new game/source capture was performed. The selector uses readable labels and bounded viewport images, not scaled full-page captures. The updated `capture_review.cjs` reproduces the viewport captures and affected GET/history/map/reward checks. Contexts and browsers are closed after the run.

## Visual iteration and exact artwork - November 9

The current catalog replaces flat cards with artwork-backed Story act/chapter drill-down, scope breadcrumbs and compact illustrated quest/variant rows. Map terrain and all defender portraits are visible immediately; the selected route, portal direction, shared placements and final defenders have distinct treatments. No source coordinate, route, placement, reward, modifier assignment or planner fixture was rewritten.

`scripts/game-quests/build_artwork.py` reads only the already saved quest captures and installed static game resources. For each exact saved `QuestSummary.theme`, it follows the local TOC's named prefab, verifies the prefab's `m_Name`, follows its `questboardBg` material reference and that material's `_MainTex` reference. External/unresolved references are skipped rather than guessed. The result covers all 274 variants through 22 themes and 10 unique native 1024px terrain textures. These are lossless WebP exports with no resizing, recoloring or generated imagery (about 6.96 MB total). Browser artwork uses Next Image for catalog thumbnails and loads only the selected map terrain for the board.

The separate versioned `artwork.json` pins quest capture hashes, bundle/TOC hashes, exact prefab/component/material/texture path IDs and exported image hashes. Native 64-bit path IDs stay strings. The reader fails closed if its quest source hash differs from the catalog. The manifest contains public definition references only, with no account/session fields or machine paths. A second export reproduced the manifest and all 10 textures byte-for-byte; all 55 original snapshot outputs also reproduced byte-for-byte. The exporter requires the existing UnityPy and Pillow installation; the website has no UnityPy runtime dependency.

These assets are **quest terrains**. They remain behind maps and provide a labeled catalog fallback when native menu art is unresolved. The subsequent source-art supplement adds separately verified Act/Chapter artwork to catalog cards, rows and page headers; it never changes this terrain manifest. Some native themes intentionally share a texture, so repeated terrain is truthful. One quiet disclosure explains the distinction. Terrain is decorative and does not establish any obstacle, gate, active effect or path geometry.

The current focused run comprises 9 suites / 23 tests plus eight Python checks. The board suite validates every saved placement and directed/portal edge plus collision-free label boxes; terrain tests check all 274 exact bindings and exported bytes. Menu-art tests reject source/hierarchy/role drift, verify all exported image hashes and preserve missing/default/empty fallback behavior. Existing full-graph/application joins, source hash allowlisting, canonical rewards, exact champion identity and all seven planner bridge routes remain checked. Scoped TypeScript and web lint are separate from siblings' checks; no full build/typecheck was run.

Fresh real viewport PNGs, their routes/widths/loaded-image metrics, browser interaction results, `changed-files.txt`, `verification.txt` and a compact single-image selector are under `temp/quest-explorer-review/visual-v3/`. The selector uses readable labels and absolute PNG references; its inline CSS/JavaScript needs no app runtime. It defaults to one 1000px-tall desktop viewport rendered within the available width, with a bounded phone preview. It does not scale a full page into an unreadable collage. Visual inspection includes the catalog, chapters, quest/event variants, simple/tablet and dense/320px maps, portal desktop/phone, shared boss, neutral NPC and reward/summary views.


## Native modifier icon adapter seam

The occurrence projection stays independent from the node track. The approved shared 27-file icon subset is now integrated through a quest-owned server adapter that adds only `{iconKey: string | null}` after full raw definition/version/BCG/application-glyph binding. Version/catalog/source-input hashes stay in the server-only ledger. Application ID, map/source hash, origin and affected placements remain unchanged. Unknown keys mean no artwork. Quest-owned details and source-bound links work independently of a future released node route. See [permanent-quest-explorer.md](permanent-quest-explorer.md) for the exact dependencies; no node explorer/admin/schema files or sibling runtime data imports are used.
# Native icon follow-up

The additive [native icon v3 contract](quest-native-icons-v3.md) extends the frozen ledgers to212,710/212,720 exact applications with204 additional native shapes. Graphs/rewards/artwork stay unchanged; ten source gaps remain unbound.

## Map viewport controls — November 11

The map starts in Fit map mode on every screen size after its viewport has measurable dimensions. Fit mode follows viewport changes, including entering or leaving full screen. Manual zoom is preserved until Fit map is selected again or the viewport's minimum fit grows beyond that zoom. Initial selection no longer forces a cropped phone zoom or automatic pan.

Full screen requests the browser's native Fullscreen API and follows `fullscreenchange`, including browser-managed exits. Escape also exits when delivered to the page. Unsupported or rejected requests use a full-window dialog with trapped keyboard focus, Escape exit and restoration of page scrolling/focus. The route picker and current selection remain available inside either full-screen view.

The crosshair is labelled Focus: it zooms to a readable view and centers the selected defender, encounter-region marker or map location within map bounds, after the resized SVG commits. Overview is a labelled toggle for the working minimap. Toolbar targets are at least 44px high, including the visible phone Fit map and Full screen actions. The controls change presentation only; source coordinates, graphs, definitions and encounter identities remain unchanged.
