# Spawn-region defender display layer

The user approved representative defender portraits within a spawn region, with its possible tiles highlighted. This layer implements that presentation independently of fixed native encounters. A marker's `anchor` is a display position, never an assertion that the fight starts on that exact tile.

## Sources and coverage

- Current game-origin geometry: the successful November 11 ordinary preview observations provide 63 Abyss regions and 25 Labyrinth regions. All region member coordinates are explicit source fields, not reconstructed grid indices.
- Defender associations: the exact archived AuntM.ai `spawnZoneMap` reference provides 62 Abyss and 23 Labyrinth associations. Their region memberships, native NPC blueprints and recorded core builds were checked against current game observations and the existing source-bound native preview catalog. The association source stays labelled `archived-reference`.
- The display includes **85 regions**. Three other native regions have no reviewed defender association and are excluded. One Abyss and eight Labyrinth native definition rows remain unmapped; Labyrinth's duplicate treasure row remains distinct in the original source. These are definition coverage counts, not guaranteed fight counts.
- Names, rarity and images come from the existing native unplaced-identity table. NPC identities are not aliased to playable champions and receive no invented champion URL or class.
- Rarity/rank/level/signature use matching native rows. Ascension retains the published native-memory observation; an omitted field in a later response is not reinterpreted as a new explicit zero.

`src/data/game-quests/spawn-regions/provenance.json` pins the native research DTO, public response/receipt chain through that DTO, historical overlay, original map files, native preview rows, identity table and every reused portrait hash. It also preserves every matching native source ordinal when one blueprint occurs more than once. A build is exported only when matching profiles agree; the generator never selects an arbitrary first different build.

The original source maps, fixed encounters, encounter indexes, unplaced rows, routes, reward records, artwork and modifier assignments are unchanged. Common tile modifiers are not relabelled as newly recovered personal enemy nodes.

## Public API

```tsx
import { loadQuestSpawnRegions } from "@cerebro/core/data/game-quests/spawn-regions";
import type { QuestSpawnRegionLayer } from "@cerebro/core/domain/game-quests/spawn-regions";

const regions: QuestSpawnRegionLayer | undefined = map
  ? await loadQuestSpawnRegions(map)
  : undefined;
```

Only the two literal quest shards are lazy-loaded. The reader requires exact quest ID, map ID and baseline `map.sourceHash`. It rejects absent/hidden/duplicate member tiles, cross-region overlap, off-region anchors, duplicate region IDs, invalid builds and unbound portrait URLs. Unknown or stale maps receive `undefined`.

The compact DTO carries:

- `questId`, `unmappedDefinitionCount` and `provenance` (`geometry: "game"`, `defenderBindings: "archived-reference"`).
- Per region: a stable `id`, representative `anchor`, complete `coordinates`, deduplicated `pathIndices`, native defender display fields, and `definitionCandidateCount`.

Paths are calculated by intersection with actual normalized route coordinates. Multiple member tiles or repeated route tiles count a region only once per route. No representative anchor is appended to `map.encounters`; no fixed encounter is manufactured. Returned arrays and defender objects are defensive copies, and provenance ledgers/source paths are not passed to the client.

## Representative anchor

The generator compresses hidden intermediate graph tiles to recover the visible graph. It then builds an undirected graph induced by the region members. A connected region uses its graph medoid (minimum total shortest-path distance), with centroid distance and coordinate ordering as deterministic tie-breaks. A disconnected region uses the actual member nearest the centroid. The centroid itself is never emitted as a synthetic coordinate. Existing fixed portrait locations are avoided whenever another region member is available.

This is stable under source array or dictionary reordering. It does not assert an observed spawn tile, probability, guaranteed encounter, quest accessibility or required run count.

## Reproduction and validation

From the quest worktree:

```powershell
python -B -X utf8 scripts/game-quests/build_spawn_region_displays.py
python -B -X utf8 scripts/game-quests/build_spawn_region_displays.py --output temp/spawn-region-data-reproduced
python -B -X utf8 -m unittest discover -s scripts/game-quests -p test_spawn_region_displays.py -v
pnpm exec vitest run --config scripts/game-quests/vitest.config.mts src/tests/game-quests/spawn-regions.test.ts
pnpm exec tsc --noEmit -p temp/spawn-region-data-tsconfig.json
node web/node_modules/eslint/bin/eslint.js --config web/eslint.config.mjs src/domain/game-quests/spawn-regions.ts src/data/game-quests/spawn-regions.ts src/tests/game-quests/spawn-regions.test.ts
```

The ignored scoped TypeScript config is a local validation helper; normal web/core integration can include the new files through existing path aliases. Parent CI registration can add `src/tests/game-quests/spawn-regions.test.ts` directly: it uses only repository records and maps. Full generator reproduction and the four Python source tests require the pinned **ignored local research corpus and receipts**; they are not portable CI checks. The two synthetic anchor tests are independently portable:

```powershell
python -B scripts/game-quests/test_spawn_region_displays.py SpawnRegionAnchorTests -v
```

Validation passes seven TypeScript tests and six Python tests, plus scoped TypeScript and lint. The TypeScript suite first failed five cases against the empty reader, then passed with populated source-bound records. Checks cover exact source/version joins, route de-duplication, drift rejection, NPC/portrait identity, copy isolation, compact client fields, graph-based midpoint behavior, fixed-portrait avoidance, ambiguous duplicate rows and byte-identical rebuilds. Responsive presentation and production build belong to the parent integration review.

The generator is offline and performs no game, process, session, network, database or release action.
