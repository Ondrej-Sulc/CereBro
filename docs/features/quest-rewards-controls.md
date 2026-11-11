# Quest rewards and map controls

The public explorer now reads independent Quest, Chapter and Act reward observations. `rewards.json` contains 234 quest owners and 74 parent owners (23 Acts and 51 Chapters), with 3,531 native reward/outcome rows. It adds a sidecar; the original catalogs, map snapshots, artwork and source hashes are unchanged. Catalog scope remains 234 permanent variants / 218 captured layouts.

## Reward identity and sources

`build_rewards.py` allowlists Type, Data, Quantity, MinQuantity, MaxQuantity, Action, Header and Footer from each native first-completion, mastery/exploration and potential-completion array. It keeps scope, source index, exact containing set, Act/Chapter membership, map/catalog identity, capture date, source SHA and JSON pointer. Owner keys include the containing set, kind, Act, Chapter/quest and source SHA. Special Act IDs such as `act1` repeat and are never global reward identities. Parent rewards are not multiplied across quests or merged into quest rewards.

The accepted November 5 `runtime-november.json` already contains parent rewards omitted by the later slim catalog. Its SHA is `fc84deb4880021ddb92d77305dc3ff11248e67cccfb1148681ae76af90ebb78d`. Refreshed quest rewards use their exact retained map observations and immutable capture ledgers. The separate November 9 public-parent observation has SHA `496aab35a0ce29e4eae50f8a329c7febaa158dad4b674fe160294c5c5e43dfd7`, captured at `2026-11-09T21:01:37.377943+00:00`. It supplies 10 Acts + 13 Chapters from ten exact Special sets. Parent membership was independently checked against the frozen progressed catalog. All 23 missing parent observations are now recorded; sampled empty scopes are observed empty, not missing data or a universal no-reward claim.

The new parent observation contains ten nonempty rows: four Act-first, two Act-mastery, two Chapter-first and two Chapter-mastery. Six Crucible `inv/unknown_rewards` rows are native placeholders. The product says **Reward details not specified** without a promised item, quantity or availability claim. The remaining rows are exact title/profile-badge/shard references. Root performed the one bounded public-only capture with actual user readiness and a new PID-specific lease. The finally-closed reader SHA remains `724bb3a0b5ed3cf8c75dd4b31e5ce7699d962fa54113bbb75e1e40a450b14ac9`; no further game access is required. Raw receipts remain ignored research artifacts.

Names and images reuse canonical crystal, reward artwork, selector and exact native BCG/GameStore/localization readers. Direct champion rewards use blueprint → exact Character/gameId identities and batched public portraits. Crystal shards are quantities of shards, not crystals or guaranteed champion contents. Native ranges remain ranges; quantities are never summed across completion and exploration. Offer/event and other unclassified native outcomes are retained separately from item grants. Unsupported exact tokens receive a neutral type label and technical token disclosure, with no guessed link or name. The saved resource-name support is incomplete (Gold is established; other resources retain exact artwork when supported). Cosmetic definitions absent from the retained title/badge catalogs remain generic; a token resembling a champion name is not a portrait binding.

Act selection shows Act rewards; Chapter selection shows Chapter rewards and a link to Act rewards. Quest detail shows its own rewards with links to the exact parent contexts. Empty sections stay hidden. Summary-only quests can show their recorded rewards without fabricating a layout. Potential-completion outcomes are explicitly conditional.

## Public hierarchy and controls

Single-chapter Special wrappers are bypassed when they offer no chapter choice. Abyss and Labyrinth now open directly to boss-led quest cards; the native `1 Stars` metadata remains source evidence. Their verified Act posters remain the collection/header artwork. Story and meaningful multi-chapter Special choices preserve the reviewed chapter-card design. Special collection posters match the Story Act artwork height, with full titles/counts and two columns on narrow phones.

Maps show human defender names, Start, Portal, Finish and Junction. Empty tiles use Map location. The tile-by-tile route-position selector and arrows are removed; recorded-route selection and the encounter list remain. Numeric node coordinates and coordinate-bearing application IDs are absent from visible text, SVG titles, tooltips, accessible labels and expanded public application/source details. Internal joins, source bytes and reproduction/deep-link URLs retain the exact coordinates. Map/application links and Back navigation remain source-bound.

Wheel/trackpad zoom is scoped to the map, anchored under the pointer and clamped; normal page scrolling remains outside it. Pan is applied after React commits the resized SVG so phone scroll bounds cannot clamp against the previous geometry. Refs preserve rapid wheel deltas and each repeated next/previous input before React commits the preceding selection. Names works at fit zoom; Fit resets pan; overview click, center selection, expansion, drag, pointer cancellation, keyboard panning, route/position selection and two-finger pinch are supported. Drag does not select a defender. Real browser review records scale, SVG geometry, pan, selection, URL/Back state and actual CDP touch results, rather than relying on clicks not throwing.

Recorded routes remain the exact native `QuestMap` payload `pathData` → `QuestMapPath.path` → `GetVector2List` / `GetTile` sequences. No DFS or defender-sequence deduplication occurs. Their count does not claim required exploration runs. A future branch/placement exploration model must handle shared portions without inventing progress or a run total.

## Exact modifier icons

The approved three source-only inputs stay pinned by `quest-icon-source-inputs.json`; the 27 shared registry/renderer/SVG files remain byte-identical. No sibling WIP runtime imports, `/nodes` links or schema dependencies are added. `audit_application_icons.py` matches complete serialized Buff hash, recomputed component-inclusive version, retained BCG SHA, native application glyph and immutable SVG SHA/key. Each new binding records raw definition hash, glyph and source JSON pointer beside its exact map/source/application identity.

The expanded ledger proves 40,839 of 198,708 assignments across 169 refreshed maps. Another 157,869 lack the complete definition/version in the frozen 39-definition reference set and stay unbound; this is a source-coverage gap, not absence of native art. Combined with the unchanged original 10,879 / 14,012 ledger, 51,718 / 212,720 applications bind across 218 public maps. Only a nullable finite `iconKey` reaches the client. Quest-owned application disclosures preserve usable detail/deep links; a future released node route can consume exact effect/version identity separately.

## Validation and remaining scope

`test_reward_projection.py` checks every exported row and all 171 source hashes/pointers against the retained native arrays. `test_application_icon_projection.py` reproduces all 402 Crucible Chapter 2 Quest 2 bindings and rejects definition, component, BCG and glyph drift. `test_capture_public_rewards.py` tests lease/preflight rejection before any handle. Reward tests cover independent scopes, repeated Special Act IDs, empty observations, native placeholders and non-item outcomes. Navigation tests cover centered pointer anchoring/clamping and human labels; the UI suite checks rapid stepper input, rapid wheel accumulation and absence of public coordinate identities. Existing full graph/path/placement, source allowlist, portrait and seven-route planner bridge checks remain applicable.

Offline reproduction (compare bytes with production outputs):

```powershell
python -X utf8 scripts/game-quests/build_rewards.py --output temp/quest-explorer-review/rewards-controls-20261109/reproduced/rewards.json
python -X utf8 scripts/game-quests/audit_application_icons.py --output temp/quest-explorer-review/rewards-controls-20261109/reproduced/application-icons-expanded.json
python -m unittest discover -s scripts/game-quests -p 'test_*.py'
pnpm exec vitest run --config scripts/game-quests/vitest.config.mts
pnpm exec tsc -p scripts/game-quests/tsconfig.json --noEmit
pnpm --dir web exec eslint src/app/quests src/components/game-quests src/components/nodes/NodeModifierIcon.tsx src/lib/game-quests
```

No locked Act 10 retrieval, fuller Abyss opponent inventory, Tower floor activation, game access, planner persistence or progress simulation is added. The 16 Act 10 layouts, non-final Abyss defenders and exact Tower memberships remain unestablished. Parent rewards are saved observations with separate dates, not current account eligibility. Parent/root retains release responsibility.
