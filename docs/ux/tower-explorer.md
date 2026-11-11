# Tower explorer

The Tower explorer lives under Quest explorer at `/quests/towers`. Native Tower artwork leads the catalog; a compact introduction, collection filter and search keep discovery close to the first screen. Six Class Towers and the Saga Showcase Tower come directly from the shared presentation adapter.

## Navigation

- `/quests/towers?q=Mutant&section=class` preserves the catalog search and collection.
- `/quests/towers/class_mutant` opens the first recorded block.
- `/quests/towers/class_mutant?block=100` opens the exact selected block. The single native block selector covers every recorded block, including 147. Previous and next links use the same URL shape.
- `#floor-20` opens a floor anchor. The floor selector includes each defender's full name. A rewards shortcut and bottom return-to-block link keep long blocks navigable.
- Catalog links carry a bounded `from` parameter so Change Tower recovers the filtered catalog. Browser Back recovers earlier block selections.
- Unknown Tower IDs use the route's not-found behavior. Unrecorded block numbers show a recovery message and the recorded-block selector.

## Reading a block

Block-wide restrictions, node count and entry-cost presence appear before defenders. One disclosure opens all block node descriptions; verified duplicate names get an effect preview. Unresolved modifiers have distinct ordinal labels, never guessed names or icons. Each modifier's exact ID, observed quantity and source scope remain under a separate definition disclosure.

The floor list preserves native order with a visible portrait, full defender name, numeric rarity, rank, level, ascension and enemy statistics. Tablet/desktop rows align the main stats beside the defender. Phone cards retain readable names and stats, with 44px minimum reward/stat disclosure heights. Floor-specific nodes stay behind one floor disclosure; the global Read all floor nodes button opens every floor's node group and description together.

Maximum health comes from `defender.maxHealth`. Raw `health` can represent a backend current-health value of one and is available only under source details. Enemy rank and ascension never go through player-build caps or recalculation.

Floor rewards, block rewards, rating rewards and entry costs are separate presentations. Unknown resource/rating identities have explicit unavailable labels and closed disclosures containing each original quantity as a separate record. Unknown quantities are never added together and rating thresholds are not invented. Canonical reward art and links come from the adapter.

## Source and accessibility boundaries

`@/lib/game-towers` owns catalog/block loading and all portrait, modifier and reward resolution. UI components contain no duplicate game adapter and make no game requests. Source receipts, IDs, raw native fields, availability limits and account-state caveats live under closed source disclosures.

The native Challenge Tower Archives groups Towers by account state; this is not evidence of historical archive classification. The catalog does not fabricate an archived collection or show a status filter when all source statuses are unknown. Archive semantics are explained in the collection disclosure.

Links, inputs, selects, buttons and summaries have visible keyboard focus. Native selectors support keyboard and touch. Layouts fit 320px through 1920px without horizontal page scrolling. Motion is limited to brief hover feedback and is disabled for reduced-motion preferences. Image failures keep a deliberate fallback; an early failed image is checked on mount, and a new image source can recover from a previous failure.

## Verification

The seven focused UI tests are `web/src/components/game-towers/tower-ui.test.tsx`. They verify high enemy ascension/full HP, bulk floor-node opening, direct block-147 navigation with filter recovery, honest Challenge discovery, distinct unidentified modifiers, separate unknown reward quantities, and image failure/recovery.

Browser evidence and executable inspection scripts are in `temp/quest-explorer-review/tower-ui-20261110/`. The final run scrolls entire blocks and waits for painted images before full-page captures. It covers 320, 390, 768, 1280 and 1920px; Class blocks 1/100/147; Saga blocks 1/6; keyboard block changes, touch floor selection, Back/filter recovery, long node lists, separate reward disclosures and image failures. The parent performs the final independent browser review and production build.
