# Champion quest lookup

`/quests/encounters?gameId=...` is a public Story/Special opponent lookup. Existing links from champion pages remain compatible. A cached public navigation projection supplies the champion picker and header: exact game ID, name, slug, class and portrait fields only. It does not load champion kits, combat stats, rosters or account data.

The page uses compact quest results with direct encounter links, numeric Story references, named Special collections, rarity and final-boss badges. Users can switch champion, filter by quest/collection text, Story/Special, rarity or bosses, and page through twelve quest groups at a time. Filters are URL-bound; changing champion resets them. Filter forms remount when their state changes so reset/Back navigation does not retain dirty controls.

The new `loadQuestOpponentMatches` display reader leaves `findChampionEncounters` and all frozen encounter data unchanged. Fixed results require exact character, quest, map and current map-source hash agreement. Duplicate index references count once; distinct placements retain separate links. A final boss comes only from a native placed final-boss flag, not a summary preview or reward.

The two established Abyss/Labyrinth region records are checked for an exact native character ID before loading candidate geometry. Matching regions then pass the existing source-bound region projector. Region results remain a separate kind with a region link and approximate-location wording. They are never appended to fixed encounters, and native NPC IDs are never aliased to playable champions. Geometry is loaded only for exact region candidates, not every matching fixed quest.

Unplaced previews and Tower floors are outside this lookup. No current account availability or exhaustive live opponent inventory is claimed. Native NPC header art requires the existing exact Character/BCG binding or an already-validated region portrait. No playable profile link is invented for an NPC.

Tests: `src/tests/game-quests/opponent-lookup.test.ts`, `opponent-champions.test.ts`, and `web/src/components/game-quests/quest-opponent-results.test.tsx`. The existing quest Vitest configuration discovers them in CI. They cover exact Absorbing Man results, region separation, source mismatch, numeric ordering, deduplication, combined filters, pagination, public database projection/cache, links, recovery, multiple matches and final-boss roles.
