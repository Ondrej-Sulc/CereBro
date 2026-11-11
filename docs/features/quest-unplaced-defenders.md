# Saved unplaced defender previews

This supplement publishes the saved native `QuestSummary.ambushEnemies` definitions separately from placed map encounters. The offline audit proves 461 array rows across 138 permanent quests. It does not establish their coordinates, encounter frequency, path assignments or a complete hidden map.

## Root integration contract

The server quest page now loads this optional section after loading the exact map version, then renders it separately after quest rewards. An anchor near the page header links to the section. The hook is:

```tsx
import { loadUnplacedQuestDefenders } from "@cerebro/core/data/game-quests/unplaced-defenders";
import { QuestUnplacedDefenders } from "@/components/game-quests/quest-unplaced-defenders";

const unplaced = await loadUnplacedQuestDefenders({ ...q, mapSourceHash: map?.sourceHash });
// Render as a separate section after the placed map, never as map encounters.
{unplaced && <QuestUnplacedDefenders data={unplaced} />}
```

`loadUnplacedQuestDefenders` accepts the existing quest's `id`, `mapId`, `containerSetId`, `summarySetId` and `sourceHash`. It returns `undefined` on an absent or mismatched saved identity. The containing set and native summary set remain distinct (for example, Story's containing set differs from Act 4's summary set). A literal lazy import loads only that quest's source rows. The DTO contains `questId`, `rowCount`, grouped `previews` and the explicit `placement-unknown` coverage. Each preview has an exact native identity (blueprint, Character gameId, rarity, native name and verified portrait URL), ordered candidate identities, build fields and `sourceEntryCount`. It carries no coordinates, route indices or encounter totals. Provenance and raw source pointers remain in the generated server data / manifest.

`findUnplacedDefenderReferences(gameId)` is a separate exact native Character lookup. It returns quest IDs and saved array indices, preserving duplicate occurrences. It does not query or change the placed-encounter index, and it does not alias an NPC such as `ex_thing` to playable `thing`.

When the existing quest also supplies `mapSourceHash`, the reader requires it to match the saved definition source hash. A later map refresh cannot silently combine incompatible saved preview rows. The DTO keeps server provenance out of the client payload. Portrait artwork may share native pack bytes with another Character; that is only an artwork binding, never a playable identity join.

The section shows six previews initially, supports name search over the complete selected quest, and reveals additional previews on demand. Equal native identities, builds and ordered candidates can share a display card in first-source order. A visible “N saved entries” label explains grouping; every original row and index remains in the source shard. The wording identifies these as potential unplaced preview definitions, not guaranteed fights. No probabilities are asserted.

## Source boundary and earlier wording correction

The immutable research package is `temp/quest-explorer-review/hidden-defenders-20261110/`. All 461 rows are checked against its input hashes, saved source row pointers and exact Blueprint → BCG Character joins. Native names and portraits use the existing BCG decoder and exact native pack resolver. New assets have their own content-addressed directory; no existing asset or manifest is overwritten. The generator performs no network, game process, memory, session, DB or UI operation.

The earlier wording at **`docs/features/progressed-quest-coverage.md:60`** has been corrected to:

> The saved map has only the final-boss placement. Its native summary also retains 63 unplaced ambush-definition rows; their coordinates and route assignments are unestablished.

Abyss's 63 rows and Labyrinth's 31 rows (30 distinct native row IDs) do not become missing-opponent counts. Act10's 16 narrow API shards omitted the ambush array, so this supplement does not infer an empty list for them. The supplemental collector and lease template stay disabled.

## Reproduction and checks

Run from the quest worktree:

```powershell
python -B -X utf8 scripts/game-quests/build_unplaced_defenders.py
python -B -X utf8 scripts/game-quests/build_unplaced_defenders.py --output temp/quest-explorer-review/unplaced-defenders-20261110/reproduced/data --assets temp/quest-explorer-review/unplaced-defenders-20261110/reproduced/art
python -B -X utf8 -m unittest discover -s scripts/game-quests -p test_unplaced_defenders.py
pnpm exec vitest run --config scripts/game-quests/vitest.config.mts src/tests/game-quests/unplaced-defenders.test.ts web/src/components/game-quests/quest-unplaced-defenders.test.tsx
pnpm exec tsc -p scripts/game-quests/tsconfig.unplaced.json --noEmit
node web/node_modules/eslint/bin/eslint.js --config web/eslint.config.mjs src/domain/game-quests/unplaced-defenders.ts src/data/game-quests/unplaced-defenders.ts src/data/game-quests/unplaced-defenders/loaders.js src/tests/game-quests/unplaced-defenders.test.ts
pnpm --dir web exec eslint src/components/game-quests/quest-unplaced-defenders.tsx src/components/game-quests/quest-unplaced-defenders.test.tsx
```

The generated directory `src/data/game-quests/unplaced-defenders/` contains 138 quest shards, an exact Character index, an identity table, literal lazy imports and a provenance manifest. Totals are **461 source rows, 127 blueprints, 115 primary Character IDs and 117 including candidates**. All 117 Character IDs have native English names and exact local portrait bindings. There are 96 unique WebP assets (4,469,172 bytes) in `web/public/game-quests/unplaced-art/`, at the original 256×256 size. The existing Next portrait renderer requests only displayed images at the appropriate display size.

Abyss displays 45 grouped previews from its 63 source entries; Labyrinth displays 30 from its 31. Grouping includes exact blueprint, ordered candidates, rank, level, signature, ascension and native Type, so different builds or candidate orders remain separate. The source boss ID and row ordinal are retained independently of that display grouping.

Verification passed **10 portable Python tests, 14 TypeScript/component tests, scoped TypeScript and scoped lint**. Tests exercise all 138 existing shared quest DTOs directly, source and set-version mismatches, exact NPC/candidate lookup, native order/duplicates, unchanged placed map bytes, compact pagination/search, uncertainty wording, candidate art and quest-change resets. Reproduction matches **all 143 generated data files and all 96 assets byte for byte**. `manifest.json` pins the generator, decoder, pack resolver, original research manifest, raw definition hashes, catalog hashes, Blueprint/BCG/schema joins, name fields, exact native pack entries, source image bytes and generated outputs. Seventeen portrait pack TOCs are explicitly pinned by the generator.

Implementation evidence and the owned-file inventory are under `temp/quest-explorer-review/unplaced-defenders-20261110/`; the earlier research package remains byte-identical, and its collector/template remain disabled. Existing toolchain baseline-browser/React-detection notices do not change the lint result; no dependency update was made.

Root has wired the section without changing map placements, encounter indexes or route counts. The combined production build and the 19-test reward/reader/component run pass; assembled browser evidence and the independent review are tracked under `temp/quest-explorer-review/unplaced-defenders-20261110/parent-integration/` and `independent-review/`. There are no DB, shared navigation, CI, package or commit changes. The source does not establish a complete hidden map, coordinates, probabilities, guaranteed fights, current access or account-specific combat values.

## Fresh Abyss and Labyrinth placement check — November 10

Two successful ordinary quest-detail reads explicitly selected optional positions, personal Buff references and `extraBossIds`. Both responses omitted the overlay; all 63 Abyss and 31 Labyrinth ambush rows omitted both position and personal Buff fields. Existing nonempty placements remain one and 23, respectively. The memory objects' `[0,0]` values are native constructor defaults when position is omitted; they are not recovered map locations.

The fresh source confirms Abyss's seven previously recorded global modifiers. Labyrinth's older common modifiers remain preserved; their legacy wire fields were outside this new selector, so fresh coverage is unobserved. Visibility markers on existing bosses add no placements. No personal node assignment was recovered for the 94 potential definition rows.

`checked-defender-previews.json` pins the selected response, receipt and comparison proofs. Its server helper projects only a short notice and observation time after matching quest, map, both set identities, row count and the exact displayed map source hash. The notice replaces generic uncertainty copy for these two matched maps; stale or different maps retain the generic copy. Original 461-row data, 96 portraits, layouts, routes and encounter joins remain unchanged.

The inspected native runtime chain receives an ambush's coordinates and enemy through a quest action result, then combines it with the tile's defender Buffs. An audit of all 40 named QuestsAPI methods established no further public non-gameplay placement reader. This bounds the present source evidence; it does not establish that all potential definitions spawn or how the server chooses them. No quest action, entry or encounter was triggered for this check. Full source proof and 19 offline regressions are in `temp/quest-explorer-review/hidden-placement-followup-20261110/interpretation/`.

## Representative spawn-region markers — November 11

The user subsequently approved showing a portrait at a representative point within its spawn region and highlighting its possible tiles. The quest page now loads the separate [spawn-region display layer](quest-spawn-regions.md) for the exact saved Abyss/Labyrinth map versions. It adds 62 and 23 region markers respectively without changing the fixed encounter index or this native preview catalog.

The new layer combines current game-origin region membership with explicitly labelled archived defender associations. Anchors are real member tiles selected for display; they are not asserted to be exact trigger positions. The map distinguishes dashed region portraits from fixed encounters, counts each region once per intersecting recorded route, and shows effects common to all its highlighted tiles separately from personal defender nodes.

When encounter regions are displayed, the quest page omits the duplicate defender-reference section and its shortcut link, and skips loading the reference list. The saved definitions remain in the source catalog; no portrait is invented for unassociated rows. Other quests and source-mismatched maps retain the original unplaced-preview presentation.

Regional SVG titles use one string child. A real Labyrinth server-render/hydrate regression prevents the mixed-child title from causing a recoverable hydration error or replacing the server-rendered markers.
