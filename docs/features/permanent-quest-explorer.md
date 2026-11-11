# Permanent quest explorer supplement

Historical first supplement. The progressed-account capture and integrated current totals are documented in [progressed-quest-coverage.md](progressed-quest-coverage.md). Original source bytes, projections and source hashes below remain unchanged; the later append-only supplement supersedes its coverage gaps.

The public explorer now focuses on permanent Story and Special quests, with a distinct permanent Towers section. The original 274-variant/51-map November 5 archive remains byte-identical. Its public subset is 211 variants (184 Story +27 Special);17 new normally previewed Special maps expand public coverage from 49 to 66 maps. There are 145 public summary-only variants, 304 authored paths, 9,711 walkable coordinates and 1,204 placed encounters. The broader archive now has 68 maps including its two excluded transient maps. These are recorded coverage, not universal/current account availability.

## Source collection and boundaries

The user explicitly authorized normal Fight/Story/Special/Towers menu navigation and bounded external read-only public-definition capture. They manually opened their chosen account; no launch, login, account switch, unlock, quest start, match, team edit, reward claim or process write was performed. `capture_permanent.py` reuses the exact hash-gated original reader/layout. Each invocation is bounded to 2 million reads / 64 MiB and closes its read handle in `finally`. `capture_public_support.py` and `capture_tower_membership.py` use separately exported named metadata, with binary/source hashes verified before opening a handle. No private account, roster, progression, rankings, credentials or session objects are exported. The game was returned to Home and its exclusive slot explicitly released to root; all subsequent implementation is offline.

Ignored evidence is under `temp/quest-explorer-review/permanent-20261109/`; `capture-manifest.json` pins 23 source files including final/special catalogs, Tower support/membership, named metadata and 17 maps. Readers are in `scripts/game-quests/`; source captures stay ignored. Named metadata export reads the existing Cpp2IL metadata binaries and invokes no game methods. GameAssembly SHA remains `01f46bb2e36c2160a8df939bbb080bcf2ee89ca15427692a10334efc90fd4abb`.

Only three Special collections were visible and resident: Deathless Mausoleum (`mausoleum`), Road to the Labyrinth (`road_to_labyrinth`), Realm of Legends (`danger_room`). Exact native category is retained; it is not a permanence classifier. Mausoleum is `StoryEvent`, whereas Road/Realm are `Event`. The explicit reviewed set membership/lifecycle decision includes all three and the captured Story set, excluding monthly November, Daily/Supply Strike and Tutorial from the public explorer. The public allowlist binds frozen quest IDs, exact map/container/summary-set identities and original source hashes. Direct excluded URLs render a truthful scope explanation; search, counts, category navigation, map loading and champion encounter lookup use the same allowlist. Archival bytes remain available to offline integrity/planner tests.

New maps: `eq_legends_e`, `me_mausoleum_ch01_q01`, `me_mausoleum_ch01_q02`, `roadtolabyrinth_ch1_quest_1` through `_6`, Chapter 2 `_1` through `_6`, Chapter3 `_1` and `_2`. Road Chapter 3 Round 3 onward and Chapter 4 were visibly locked; no attempt was made to unlock or bypass them. Ten Road maps remain summaries.

The other requested permanent Special collections were absent from resident definitions on this chosen account: Shooting Stars, Grandmaster's Gauntlet, Epoch of Pain, Wheel of Fate, Eternity of Pain Acceptance, Abyss, Labyrinth, Revenge of Legends and Crucible. Their absence does not establish nonexistence or universal unavailability. User-supplied screenshots establish these as coverage targets, not enough definition/map/boss identity to fabricate catalog records. No game interaction remains necessary for this supplement; further collection requires a separately coordinated accessible client state.

## Legacy native artwork: resolved

All seven previously unresolved keys now resolve exactly. `EB.FileSystem.Manager.GetUrlIfNotExists` passes non-HTTP keys to native filesystem search with FindOptions3; search order was captured as pack -> odr -> zip -> file. `PackDriver.Exists` strips extensions when bit2 is set and compares names with the bit1 case-insensitive flag. Installed `packs.txt` registers `ui_fightlanding_quest`; its `toc.txt` **files[]** explicitly lists `quests/a1.jpg`, `a2.jpg`, `a3.jpg`, `story_a1c1.jpg`, `story_a2c1.jpg`, `story_a3c1.jpg`, `story_a3c2.jpg`. The earlier audit inspected bundle references and missed this loose-file branch; its negative result is superseded.

`build_source_art.py --resources <Data>` resolves only exact extension-independent manifest members, rejects ambiguous/escaping/similar keys, and records pack/TOC/source/export hashes. No filename similarity or guessed CDN path is used. There are 68 native menu-art assets and zero unresolved keys; all 211 public permanent variants have supported menu art. The prior 61 remote-native exports remain unchanged. Map terrain manifests/assets remain unchanged.

Story chapter selection now uses compact artwork-led cards in explicit captured chapter-index order. Source images remain untouched; the UI uses a consistent bounded crop at `center top`, eight-pixel gutters, overlaid chapter titles/actions and a compact horizontal composition for a single chapter. All four choices fit a 1024px desktop; two choices fit a phone viewport with a scrolling rail and native keyboard links. Parent artwork stays identified as parent artwork.

## Boss previews and exact identities

The supplement retains explicit `QuestSummary.finalBosses` objects independently of maps. Its 348 preview rows across 211 variants are **not** encounters or rewards. Cards support multiple recorded bosses. Source/identity drift disables the preview. Playable portraits/class cues use one deduplicated exact gameId batch and existing public artwork helpers. Thirty native NPC/legacy portrait files follow exact Blueprint -> Character -> BCG`_imgID` -> native `portraits/portrait_<id>` pack membership; remote/unresolved image roles remain neutral. The same source/BCG-bound native portraits now appear on map placements and the selected-defender view. Native portraits never establish a playable identity, class or champion detail link. Boss-preview rows are excluded from champion occurrence lookup; only map-referenced placements enter it.

The17 new maps preserve every coordinate, directed link/portal, ordered route, boss-dictionary placement reference, shared fight and application. Unplaced boss-table rows stay excluded. Some new assignments have a valid source coordinate but null native `nodeSource`; they retain `Unspecified` source type and unknown persistence, rather than guessed local/global/linked behavior. Final combat values, gates, energy and active-state removal remain uncalculated. A uniform presentation pitch separates closely spaced new portraits; all reviewed original maps retain pitch 22 and unchanged topology.

## Permanent Towers

Six exact Class Tower identities and their native `TowerPanelTexture` URLs are projected into `/quests/towers` and `/quests/towers/[id]`. A dated Event Tower is excluded. Exact captured public URLs resolve through the existing native URI-path cache or a credential-free exact public download into ignored retained artifacts; no URL enumeration occurs. Artwork stays native size and aspect.

Native Tower records report identical block/floor numbers across the six Class rows. Both named resident `BlocksData` and `FloorsData` dictionaries were empty during this capture, so per-Tower counts, floor membership, bosses and layouts are deliberately not published. No global/shared registry is multiplied across Towers. Challenge Tower archives and rank/access state are not inferred. The section presents actual class identities/art and clearly identifies missing floor coverage.

## Native modifier integration and detail navigation

Root approved the exact 27-file shared foundation in `C:/Code/CereBro/temp/parallel-reference-20261109/quest-shared-node-icon-subset.json`: `src/domain/node-modifiers/native-icon-registry.ts`, `native-icons.ts`, `web/src/components/nodes/NodeModifierIcon.tsx` and 24 content-addressed SVGs. They are copied byte-identically and require no Prisma/schema migration. No node explorer/admin/action module or full sibling artifact is copied/imported at runtime.

The three source-only offline inputs are pinned by root in `quest-icon-source-inputs.json`: sibling `src/data/game-node-modifiers/catalog.json`, `icon-bindings.json`, `artwork.json`. `build_application_icons.py` verifies their exact file/contract hashes, complete raw definition hash, recomputed component-inclusive version hash, same BCG source, captured application glyph, registry key and exact SVG hash. It emits a quest-owned source-map/application ledger. Runtime server projection adds only nullable `iconKey` to the selected map applications. Definition/version/catalog hashes remain in the server-only ledger. No client catalog/provenance JSON or name-based binding is added. 10,879 of 14,012 assignments in 49 original public maps bind; refreshed maps without the reviewed BCG-version evidence remain unbound. Drift is never loosened for coverage.

`QuestApplicationDetails` reuses the decorative shared icon beside original application text. Its native details disclosure retains source/target/amount/persistence and parameters separately. Links bind quest, selected coordinate, path, application ID and source hash, opening that exact assignment. Stale source hashes show a version warning. No dead `/nodes` destination is introduced. Later navigation may use an independently released exact definition/version route adapter.

## Reproduction and checks

```powershell
python -X utf8 scripts/game-quests/build_permanent.py --source temp/quest-explorer-review/permanent-20261109
python -X utf8 scripts/game-quests/build_application_icons.py
python -X utf8 scripts/game-quests/build_source_art.py --capture temp/quest-explorer-review/authored-art/source-art-20261109.json --image-cache C:/Users/ossul/AppData/LocalLow/Kabam/Champions/asset_cache/files --fetched temp/quest-explorer-review/authored-art/fetched --resources 'C:/Games/Marvel Contest of Champions/default/game/Champions_Data/Resources/Data'
python -m unittest discover -s scripts/game-quests -p 'test_*.py'
pnpm exec vitest run --config scripts/game-quests/vitest.config.mts
pnpm exec tsc -p scripts/game-quests/tsconfig.json --noEmit
pnpm --dir web exec eslint src/app/quests src/components/game-quests src/components/nodes/NodeModifierIcon.tsx src/lib/game-quests
```

`build_permanent` accepts separate `--output/--assets`; `build_source_art` does likewise; `build_application_icons --output` supports independent byte reproduction. Retained Tower/source artwork avoids further downloads. The original 55 snapshot files and terrain exports remain unchanged. No full web build/typecheck or shared CI edit is performed.

New suites for later parent registration: `src/tests/game-quests/permanent.test.ts`, `application-icons.test.ts`, `scripts/game-quests/test_permanent_projection.py`. Existing graph/layout, exact champion/reward, snapshot and seven-route planner guarantees remain checked; the archival Daily fixture is tested through its saved loader rather than reintroduced publicly.

Actual desktop/phone QA uses Preview first. Two current Act 6 snapshot attempts failed with `Preview snapshot failed: Preview automation snapshot timed out after 15000ms.` Both errors were quoted before headless fallback; the owned tab was closed. Fresh actual app captures, inspected PNGs, browser checks, exact files and a compact absolute-image `preview.html` are in `temp/quest-explorer-review/permanent-20261109/`. Own port 3011 remains available. Parent owns integrated review/release; no commits, pushes, PRs, migrations, database writes, shared navigation or CI edits are made.

Current review package: `temp/quest-explorer-review/permanent-20261109/preview.html`, with viewport PNGs and browser assertions under `review/`, exact pending paths and hashes, native loader/source evidence and byte comparison results. Public coverage gaps are 135 Story maps and 10 Road maps; nine requested Special collections were absent from resident definitions. One summary (`a08_ch04_q06`) has no explicit final-boss preview in this capture. Tower floor membership is unrecorded. These are observation limits, never inferred absence or access state. The public policy lists four exact containing-set IDs; native categories do not decide permanence.
