# Tower presentation adapter

`web/src/lib/game-towers/index.ts` is the server presentation entry point. It
exports `getTowerCatalog()`, `getTowerBlockView(towerId, blockNumber)`,
`towerRewardScope(scope)`, and the four Tower view interfaces. It consumes the
literal lazy loaders in `tower-backend` and `tower-challenges`; invalid IDs,
noninteger block numbers, and uncaptured blocks return `null` before a portrait
query. The catalog uses observed membership, native names and native artwork.
Archive status is retained from the source and is not inferred from account
completion, locking, missing membership, or an indefinite end time.

Floor rewards, block rewards, rating rewards, and entry costs are separate arrays.
Their `QuestRewardView.scope` is already friendly Tower text. Consumers must
render it directly or use `towerRewardScope`; `questRewardScope` describes quest
completion and is unsuitable here. Keys contain the Tower, block, source array,
floor when applicable, and source index. The adapter directly uses public crystal,
selector, reward-artwork and resource-name helpers; it constructs no `QuestMap`
or quest reward owner. Native `t/n/q` values remain in the captured block data.

Portrait lookup is one cached batch of exact defender/reward game IDs per block.
Only playable website champion rows create champion links and portraits. Native
names come from exact blueprint-to-Character joins in the pinned BCG. Existing
NPC/legacy portrait evidence is reused only for the exact Character and matching
BCG. Missing identities stay distinct, with no suffix, prefix or name aliasing.
The adapter preserves all native enemy numbers, including ascension above player
caps. `defender.health` is recorded current HP; `maxHealth` and the explicit
`fullHealth` presentation field are full enemy HP. Consumers showing full enemy
health must use `fullHealth` or `maxHealth`.

Modifier names and quantity-specific descriptions are independent of icon
resolution. The offline generator verifies the complete raw definition, referenced
BCG components, missing-component list and version hash against frozen node source
indexes. It reuses captured descriptions only at the exact native quantity. The
finite icon key additionally requires an independently observed complete Tower
definition and component version matching the native glyph/renderer/asset proof.
Uniqueness of an ID in the frozen node corpus is insufficient. The independent
integration audit removed 52 such icon transfers; only `avx_hp_pct400` and
`avx_hp_pct2000` have matching observed Tower definitions and retain icons. Other
node-sourced names and exact-quantity text retain their separate provenance.
No icon or curated association is assigned by name, ID, or glyph alone. Unknown
definitions and quantities retain source data and nullable presentation. Native
rich-text color/link markers are removed and escaped newlines become actual
newlines. Block and floor rules remain separate from ordinary modifiers. Native
conditions and persistence have separate nullable fields and are not inferred
from a reused quest application context.

Five additional native Tower definitions have independent observed public
receipts. Their complete raw/component versions are recomputed against the same
BCG; retained earlier partial text receipts are checked for agreement. These
receipts supply three newly resolved definitions: +200% attack and the two Class
Tower rules. Their icons remain unbound. The power rule uses its exact text; the
timer formats the first native BCG component's integral `Duration` into slot 2,
as established by pinned `QuestBuffData`, `GameUtils` and `BCGStatModifier` static
method evidence. The `bcg` branch formats the absolute native `value` into slot 0.
This bounded formatter admits only proven placeholder shapes at the observed
quantity; it leaves other templates unresolved. Evidence hashes belong to the
separate source ledger. No native game method is invoked.

`src/data/game-quests/tower-presentation/catalog.json` is the compact public
presentation subset. `sources.json` retains source block hashes and selected
version/icon/description receipts separately for evidence disclosure. Neither
file is a runtime import from a sibling worktree. The offline generator reads
frozen sibling proof inputs, verifies pinned shared assets and writes no shared
node registry, renderer, SVG, source catalog or existing Tower block.

Run from the repository root:

```powershell
python -X utf8 scripts/game-quests/build_tower_presentation.py
python -m unittest discover -s scripts/game-quests -p test_tower_presentation.py
pnpm exec vitest run --config web/src/lib/game-towers/vitest.config.mts
pnpm exec tsc -p temp/quest-explorer-review/tower-presentation-20261110/tsconfig.json --noEmit
pnpm --dir web exec eslint src/lib/game-towers
```

The persistent Vitest config runs both adapter and Tower UI suites, including
jsdom and JSX support; no ignored temporary alias config is required. These
suites need no database or game connection. They test the exact batch
query through a stub, all published defender/reward joins, low/high/invalid blocks,
Saga current HP 1 versus maximum HP 94,110, enemy ascension, unknown blueprints,
quantity and scope separation, crystal links, material/shard types and readable
unknowns. Portable generator tests use synthetic source inventories, including
manifest escapes and hash drift. Browser/responsive verification belongs to the
UI owner. No new CI configuration, package, schema, database, navigation, commit,
deployment, or game access is part of this adapter.

The current snapshot contains 900 blocks and 9,743 floors: all six configured Class
Towers, the observed six-block Saga Showcase Tower, and both observed Event Towers
(Doom: ten blocks / 61 floors; Stellar-Forged Green Goblin: two blocks / two floors).
It resolves 222 reward identities and 69 of 125 modifier definitions. The
remaining 56 native definitions are explicitly listed in catalog coverage and
render as recorded modifiers; no missing identity is fabricated. The Class
gap is `avx_hp_pct250`; 41 gaps originate in Challenge definitions and 14 more
were introduced by the Event corpus. Source-only
resource/rating labels without canonical titles remain generic pending exact
metadata. This does not affect their quantities, separate scopes or source data.

Event entries preserve the recorded end date and observation time separately
from unknown current account availability. Configured block counts and captured
memberships are distinct. Every one of the 63 captured Event enemies has current
HP 1; its full HP is the separately captured `maxHealth`, and the reader preserves
both. The Event source excludes additional block-level access/growth fields;
complete floor membership is not a full combat simulation or eligibility claim.
