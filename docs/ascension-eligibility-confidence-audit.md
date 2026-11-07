# Ascension eligibility confidence audit

Audited 7 November 2026. This is a read-only evidence audit of the local working tree, not a catalog refresh or a statement about deployment. No production rules, UI, raw catalogs or account state were changed.

## Assessment

**High confidence in the recorded champion/star paths within the catalog's stated collectible, non-event scope. Insufficient evidence to call those paths currently obtainable or executable for a particular player.** The finder correctly uses blueprint paths rather than token-source membership. Its source view is much narrower than its eligibility filter.

The exact seven-star result is **112 identities with a defined path, 81 with a recorded champion-specific crystal source, and 31 without one**. All 112 paths end at A2 in this snapshot. All 1,078 source bindings belong to those 81 identities at seven stars; none contradict the recorded applicability. These figures establish the intersection of two dated datasets, not completeness or live availability.

At lower stars, the apparent gaps are expected: the 318 four-star, 320 five-star and 336 six-star paths use shared dust and `res/sc`. The source helper deliberately excludes generic dust/class-token rewards. Thus every one of those paths has zero champion-specific source rows. A missing personal token source is not a problem for a path that does not require personal tokens.

There is also a **separate coverage issue**: collectible seven-star Carina (`carina_white_t7`) has an explicit A1 path in the raw extraction and a matching recorded quest-material reward, but is excluded because `IsEventCharacter=true`. That exclusion follows the current contract, but it prevents this projection from being described as an exhaustive list of all playable champions. Details and a proposed narrowly scoped follow-up are below.

## Trace from definitions to the finder

| Stage | Verified behavior | Consequence |
| --- | --- | --- |
| Named protobuf schema and `scripts/extract_mcoc_ascension.py` | `BCGDataBuffer.heroes_blueprints` joins exact `Blueprint`, `Character`, `Rarity`; `AscensionTiers` tag 37 must match the ordered `EligibleAscensionTiers` tag 38. Unknown tier IDs, duplicate IDs, order disagreement, missing concrete costs and conflicting modifiers fail extraction. | English names, global rarity caps and token-name guesses do not grant eligibility. |
| Public projection | Requires `userCollection && !isEventCharacter`; rejects duplicate `(gameId, rarity)`; retains only referenced tuning and required resources. | NPCs and legacy/event variants cannot extend the player's cap. Special playable event champions can be excluded too. |
| `src/domain/champion-ascension.ts` | Strict schema, coverage, identity, step count/order, referenced tier/resource and modifier validation; indexes exact game ID/star and blueprint ID; returns copies. | A known empty rule is `{maxLevel:0, steps:[]}`; an absent rule is `null`. Neither grants an upgrade. |
| `src/data/game-ascension/index.ts` | Reuses that validated index. `ascendableRarities` is exactly positive maxima; `recordedRarities` includes known empty paths. | Missing metadata remains distinct from explicit no-tier metadata. |
| `web/src/lib/data/crystals.ts:loadCrystalFinder` | Unions membership, public champion records, source-only identities and **all** eligibility identities by exact game ID. Eligibility arrays come only from the canonical summary. | An eligible champion without rewards remains selectable; a reward-only future identity does not gain a path. |
| `src/domain/champion-ascension-eligibility.ts` and `crystal-champion-finder.tsx` | Both server search and current client draft use `hasRecordedAscensionPath(summary, exactStar)`. Omitted star means any recorded eligible star. Explicit/unique legacy identities are retained outside the filter with recovery text. | All stars is an OR across paths, not a claim about seven stars or every star. Typed search cannot reintroduce an unsupported picker choice. |
| `web/src/lib/data/champion-crystal-ascension.ts` | Exact champion/star/category/reward-bound bonuses or exact direct champion tokens with cost/usage-tag applicability. Preserves bonus identity, conditions and quantities. | Ordinary champion pool membership, generic dust/class tokens, nested bundles and unresolved selectors do not create source rows. |

The public catalog's `blueprints`, `tiers`, `resources` and `coverage` were compared directly with `build_public_catalog()` applied to the full local extraction: exact equality. The archived and newer-cache normalized projections also match exactly in these four sections. That comparison does not establish current server state.

Identity controls include separate `blade`/`blade_stellar`, `starlord_stellar`/`starlord_kittypryde`, `maestro_trophy`/`maestro_overseer`, and `storm`/`storm_realm`. The non-collectible `magik_legacy_t7` has one tier; the collectible `magik_t7` has two. The reader uses the latter, never the longer or shorter path from another variant. The 18 unbound `_def` tuning tiers, including `7s_t1_def` through `7s_t15_def`, grant no additional player levels.

## Exact counts and definitions

The audit universe is the **374 distinct game IDs** in the canonical eligibility summary union the source helper's identities. All 81 source identities are already in that summary. This universe is intentionally independent of the mutable database-backed public champion list. Counts do not purport to count every champion a future server may introduce.

| Stars | Recorded blueprint | Defined positive path | Positive path with personal source | Positive path without personal source | Recorded empty path | Missing metadata in this universe |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 23 | 0 | 0 | 0 | 23 | 351 |
| 2 | 346 | 0 | 0 | 0 | 346 | 28 |
| 3 | 318 | 0 | 0 | 0 | 318 | 56 |
| 4 | 318 | 318 | 0 | 318 | 0 | 56 |
| 5 | 320 | 320 | 0 | 320 | 0 | 54 |
| 6 | 336 | 336 | 0 | 336 | 0 | 38 |
| 7 | 279 | 112 | 81 | 31 | 167 | 95 |

There are 1,940 recorded blueprint/star pairs, including 1,086 positive paths: 974 lower-star paths and 112 seven-star paths. Source gaps total 1,005 **pairs**; they are not 1,005 distinct champions. All stars contains 337 eligible identities, 81 with a source at some star and 256 without one. Of those 337, 225 have only lower-star eligibility; 112 also have seven-star eligibility. The remaining 37 identities in the 374-ID universe have no positive path at any recorded star.

These are independent axes:

- **Defined eligible path:** positive exact collectible/non-event blueprint path in the 3 November snapshot.
- **Has recorded champion-specific source:** at least one exact helper binding at that same star in the 5 November opening snapshot.
- **No recorded source:** the positive-path set minus that intersection; it means a gap in this helper's scope.
- **Unknown metadata:** no indexed blueprint at that star; different from a recorded empty path.
- **Live/account status unverified:** applies to every pair above, including pairs with sources. The audit does not independently verify current stock, source activation, inventory, account unlock or server acceptance.

## All 31 seven-star source gaps

Every row below has a collectible, non-event `<gameId>_t7` blueprint with ordered `7s_t1`, `7s_t2`, maximum A2 and concrete personal/class token costs. The exact helper returns zero rows at seven stars and with stars omitted. Thirty have resolved, enabled token *definitions*. Medusa's personal-token display metadata is unresolved. Neither state establishes acquisition availability.

| Game ID | Recorded identity |
| --- | --- |
| `americachavez` | America Chavez |
| `arnimzola` | Arnim Zola |
| `blade` | Blade |
| `blade_stellar` | Blade (Stellar-Forged) |
| `cable` | Cable |
| `captainamerica_movie` | Captain America (Infinity War) |
| `captainmarvel_movie` | Captain Marvel (movie identity; source name is Captain Marvel) |
| `deadpool` | Deadpool |
| `doctordoom` | Doctor Doom |
| `elsabloodstone` | Elsa Bloodstone |
| `green_goblin_stellar` | Green Goblin (Stellar-Forged) |
| `humantorch_victorious` | Human Torch (Victorious) |
| `iceman` | Iceman |
| `invisiblewoman_victorious` | Invisible Woman (Victorious) |
| `ironman_movie` | Iron Man (Infinity War) |
| `leader` | The Leader |
| `maestro_trophy` | Maestro |
| `magik` | Magik |
| `magneto_marvelnow` | Magneto (House of X) |
| `medusa` | Medusa |
| `mrfantastic_victorious` | Mister Fantastic (Victorious) |
| `mysterio` | Mysterio |
| `scarletwitch_current` | Scarlet Witch |
| `scream` | Scream |
| `shuri` | Shuri |
| `spiderham` | Spider-Ham |
| `starlord_stellar` | Star-Lord (Stellar-Forged) |
| `storm` | Storm |
| `thing_victorious` | Thing (Victorious) |
| `thor_ragnarok` | Thor (Ragnarok) |
| `wong` | Wong |

Representative checks resolve the concern beyond merely assuming incomplete sources:

- **Medusa:** exact `medusa_t7` costs consume `ascension_token_champion_medusa`; unresolved display metadata does not invalidate those costs. The official offer is dated November 20, independently of the path snapshot. No absence of an earlier route is inferred.
- **Doctor Doom, the four Victorious variants and nine weekly Realm identities:** all 14 exact IDs are gaps above. November event conditions extend beyond this crystal helper; the announcement does not verify simultaneous or personal access.
- **Green Goblin (Stellar-Forged):** the October official release notes describe earning his Ascension through a dedicated Tower. A zero personal crystal result is consistent with a separately announced event route.
- **Maestro:** `maestro_trophy_t7` has the concrete `ascension_token_champion_maestro_trophy` path and resolved exact `t7:maestro_trophy` usage metadata. It is not Overseer or an NPC. No live route is asserted from the item definition alone; detailed acquisition validation belongs to the alternate-source audit.
- **Magik, Arnim Zola, America Chavez and the other gaps:** the path and zero-source classification are verified; token/bundle names alone are not substituted for actual selector contents or a live offer. Broad route research is intentionally outside this report.

Deathless champions are **not** in the 31 seven-star gaps: `guillotine_nameless`, `groot_king_deathless`, `vision_deathless`, `shehulk_deathless`, and `thanos_deathless_trophy` each have a known empty seven-star path and a positive six-star dust path. Their special champion acquisition methods do not grant seven-star ascension. Likewise `kang`, `thanos`, `deadpool_gold`, `deadpool_platinum`, `wolverine_weaponx`, and `phoenix_dark` have recorded empty seven-star paths; do not promote them from All stars or from trophy status. Conversely original `deadpool` and `maestro_trophy` really are in the positive seven-star gap set.

The completed [alternate acquisition audit](ascension-acquisition-source-audit.md) independently reproduces **112/81/31** and documents published or scheduled mechanisms for **26** gaps. That is a research disposition, **not 26 complete or currently obtainable routes**. Its five insufficiently verified cases are `arnimzola`, `scarletwitch_current`, `cable`, `deadpool`, and `scream`; the first two have static token/bundle evidence only. That report owns the detailed official route citations, conditions and unresolved contracts. Its result does not remove any of these 31 IDs from this narrower crystal-source gap set.

## Three useful reproductions

| Query | Actual result | Interpretation |
| --- | --- | --- |
| `gwenom`, 7 | `gwenom_t7`, max A2; **one** exact source: `vfh_gwenom_broken_justice_crystal` | Category `7star_gwenom_hcos_cluster_drops_cosmic`, reward index 0, bonus `gwenom_cluster_drops_cosmic`, `autoAscend=true`, one Gwenom token and one cosmic token. No live-sale inference. |
| `hulk`, 7 | `hulk_t7`, max 0, empty steps; no source | Explicit no-path metadata, not unknown. Excluded from the seven-star Ascension picker; explicit navigation retains the identity with recovery text. |
| `hulk`, 6 | `hulk_t6`, max A1; no source | Costs are 900,000 `res/sc` and 200 `primordial_dust_t2`; no personal token is required. Included at six stars and All stars. |

Hulk's complete positive summary is `[6,5,4]`. Thus `/crystals/champions?champion=hulk&reward=ascension` correctly includes him while `/crystals/champions?champion=hulk&rarity=7&reward=ascension` has no recorded path. The current finder already says “recorded ascension path ... at any star level” and distinguishes empty paths from unknown metadata. Its generic empty-source advice still makes lower-star dust ascension sound like a missing personal reward. That is a presentation mismatch, not evidence of a bad seven-star rule.

## Separate gates and future definitions

The reviewed client methods establish more than a static list, but less than live server authorization:

1. `BCGManager.GetMaxAscensionTierForRarity(blueprint)` reads the list at blueprint offset `0x100` (`AscensionTiers`). It returns its count for a nonempty list and **-1 for null/empty**. CereBro normalizes no path to max 0; this preserves the positive-path predicate. The earlier investigation's shorthand “returns the count” omitted this sentinel detail.
2. `BCGUserHero.GetMaxAscensionTier` looks up the exact owned blueprint and calls that method. `HasNextAscension` compares owned `AscensionTier` with that maximum; `HasAscensionData` tests maximum > 0. `HeroData` delegates to these methods. No extra champion-specific enable flag was found in this reviewed chain.
3. `GameBCGUtils.IsAscensionTabUnlocked()` reads two separate Boolean tuning properties. Address-bearing metadata resolves offset `0x6C0` to **`Tuning.AscensionTabUnlocked`**, and `0x3B0` to **`Tuning.KillAscension`**. The examined method requires the former and the inverse of the latter. `AscensionUpgradePanel.GetUpgradeButtonsConfig` also checks remaining steps and `GameResourceUtils.IsAffordable`.
4. Neither actual tuning value, account progression evaluation nor inventory is in the public eligibility artifact. The selected `Ascension` and `BCGBlueprintBase` contracts contain no ascension minimum-rank/progression field. This does **not** prove that a particular rank or progression title is never required elsewhere. Current server-side acceptance and any additional server gate remain unverified; no server override is invented.
5. Global future tuning is demonstrably present without eligible blueprint bindings. More significantly, Medusa already has A1/A2 blueprint data before the independently announced November 20 token offer. A positive recorded path must not silently become “available now.” Higher announced levels also cannot extend this snapshot's A2 maximum.

### Official evidence and its time boundaries

All sources below were inspected on 7 November 2026. Forum recap authors who are community members were used only as discovery leads. The November recap is separately published by Kabam on its own news site, with author metadata **The MCoC Team**, and explicitly credits Ackbar67; it is not being mislabeled as a staff-authored forum post.

| Direct primary source | Author/date | Supported claim and boundary |
| --- | --- | --- |
| [Everything About 7 Star Ascension, So Far](https://forums.playcontestofchampions.com/en/discussion/411731/everything-about-7-star-ascension-so-far) | Kabam (Osaurus) Rex; 24 February 2026 (date surfaced by the forum's quoted-post attribution; main fetched body omits its date) | Historical launch plan: selected seven-star pools, automatic first cluster A1, champion-specific box materials, later additions and two initial levels. Its original 11-level roadmap does not establish current caps or availability. |
| [Missing Ascension Tokens](https://help.kabamsupport.com/hc/en-us/articles/54596500602011-Missing-Ascension-Tokens) | Kabam Support; updated 16 September 2026, 21:16 | First A1 consumes a champion token automatically. Ordinary seven-star Hero/Titan crystals do not award ascension tokens. This explains a perceived missing token without granting every champion an upgrade. |
| [V59.0 Release Notes](https://playcontestofchampions.com/news/v59-0-release-notes/) | Kabam official news; 2 October 2026 | Green Goblin (Stellar-Forged) has a dedicated Ascension/Awakening Tower; seven-star Carina is a player reward. Historical event description, not verification of today's availability. |
| [November 2nd Livestream Summary](https://playcontestofchampions.com/news/november-2nd-livestream-summary/) | The MCoC Team; 2 November 2026, 13:00 UTC; credits Ackbar67 | Describes weekly Realm ascensions, Doom/Victorious shop prerequisites, and a November 20 Medusa token offer. Exact current weekly identity and personal access remain unverified. Its higher-level promises do not rewrite the older path snapshot. |

The November article's rendered shell omitted its body in the web reader. Its actual same-origin content endpoint was read directly: `https://playcontestofchampions.com/wp-json/kabam/v1/slugpost?lang=en&slug=november-2nd-livestream-summary`. The saved JSON records the official author, permalink, timestamp and rendered content. Other blocked endpoints were not treated as evidence. No price, probability, token exchange recipe or selector allocation is inferred here.

## Event-character coverage issue: Carina

**Historical audit scope:** the reproduction and 112/81/31 figures below describe
the original collectible non-event projection. The authorized implementation
follow-up now admits only exact collectible `carina_white_t7`; see the
[implementation and provenance record](champion-ascension-investigation.md#reviewed-playable-event-follow-up-7-november-2026).
Its enlarged scope contains 113 positive seven-star paths (112 A2 plus Carina A1).
This does not invalidate or retroactively broaden the audit's original counts.

Repro against the unchanged data:

```ts
getChampionAscension("carina_white", 7) // null
getChampionAscensionEligibility("carina_white")
// { ascendableRarities: [], recordedRarities: [] }
```

The full extraction contains **one** `userCollection && isEventCharacter` row: `carina_white_t7`, character `carina_white`, rarity 7, eligible tier `7s_t1`, maximum 1, with one `ascension_token_champion_carina_white` and one cosmic token as concrete costs. The six-star Carina row is non-collectible and event-marked. Official October release notes confirm playable seven-star Carina.

Following the alternate audit's lead, this audit independently verified the unchanged game-only quest capture (`2026-11-05T06:49:32.001200+00:00`): **`epilogue_ch04_q04.masteryCompletionRewards` contains exactly 1 `inv/ascension_token_champion_carina_white` and 1 `inv/ascension_token_class_cosmic`**. Both minimum/maximum quantities are also 1. These tuples match the raw seven-star A1 costs exactly. The full quest and its summary repeat the same reward definition; they are not two grants. It is an explicit **mastery** reward, not an inferred first-completion reward. This establishes a recorded non-crystal source as well as a path for this excluded special identity. Current quest access, personal completion and server acceptance remain unverified.

This is a confirmed exclusion of a playable collectible identity's recorded path, not a false positive in the 112-path set. Both the public extractor and domain reader enforce the exclusion, so changing only the UI cannot restore the rule. The 112/81/31 counts are correct for the **existing** contract and deliberately exclude Carina. If an independently reviewed player-event exception were adopted, this raw snapshot would add one seven-star A1 path; do not add every event/NPC row or promote Magik legacy/tuning definitions.

Minimal proposed follow-up, unapplied: retain the current default scope and review an explicit, provenance-backed classification for playable event blueprints (initial candidate `carina_white_t7`) against the intended product scope and its separate access conditions. Apply any approved classification consistently at extraction and validation/indexing. A regression must show that this exact player row survives with max 1 and its exact mastery source, `carina_white_t6` and boss/event variants remain excluded, `magik_t7` stays max 2, and unbound tuning never changes caps. Until then, label the eligibility scope and preserve saved owned ascension observations as existing roster policy requires. Do not broaden eligibility merely because another reward registry contains a token.

## Concrete UI/data recommendations

1. Keep **Recorded ascension path** and the exact stars/date as the primary wording. Reserve **Available now** for independently dated source/activation evidence, and **Can ascend** for evaluated player gates and materials. Keep eligibility, source evidence and live/account state as separate fields.
2. Make All stars explicit: “Recorded paths: 4★, 5★, 6★” for Hulk. A seven-star-focused shortcut may be useful, but must not change the meaning of All stars or infer seven-star eligibility from another rarity.
3. At 4–6★, show the recorded dust/resource path and a shared-material link. Suggested empty copy: “This path uses shared Primordial Dust. Champion-specific rewards are not required.” At 7★ use “No champion-specific crystal source recorded. Event, quest, store or other routes may exist.”
4. Qualify the section heading as **Recorded crystal bonuses and champion tokens**. Normal champion acquisition links are useful context but do not establish ascension routes. Never attach a generic champion-method row as an ascension reward without exact reward evidence.
5. Track source gaps by champion **and star**, with original game IDs, source kind, conditions, dates and live-status evidence. Keep unbound tiers, unresolved display metadata, and event-classification exceptions explicit. A dated official future offer can be recorded as announced/upcoming without claiming a currently obtainable route.
6. Review the Carina scope exception separately. No speculative production or raw-catalog patch was made during this audit or while the roster agent was active.

## Reproduction and verification

Ignored local audit files are under `temp/ascension-confidence-audit/`: `analyze.ts`, `sets.json`, `controls.ts`, `metadata.py`, `metadata.json`, `verify-scope.py`, `scope-verification.json`, and the captured official November content. `sets.json` contains exact eligible/source/gap/empty/unknown ID arrays for every star, all-star sets, all 31 gap rules' token metadata, and input hashes. It contains no account information. It is a local analysis result, not a shipped dataset.

```powershell
pnpm exec tsx --tsconfig web/tsconfig.json temp/ascension-confidence-audit/analyze.ts
pnpm exec tsx --tsconfig web/tsconfig.json temp/ascension-confidence-audit/controls.ts
python temp/ascension-confidence-audit/verify-scope.py
pnpm exec vitest run src/domain/champion-ascension.test.ts src/data/game-ascension/index.test.ts web/src/lib/data/champion-crystal-ascension.test.ts web/src/lib/data/champion-crystal-ascension-bindings.test.ts web/src/lib/data/crystal-finder-eligibility.test.ts --maxWorkers=1
pnpm exec vitest run web/src/app/crystals/crystal-tools.test.tsx --maxWorkers=1
python -m unittest discover -s scripts -p test_extract_mcoc_ascension.py
```

The deterministic script passed exhaustive rule/summary/predicate agreement for all 374 IDs at all seven stars, partition arithmetic, identity uniqueness, the five Deathless controls, Carina exclusion, the three requested controls, and pinned 112/81/31 and 1,078 totals. The scope script passed raw/public projection parity, newer/archived projection parity, the single collectible-event exception, and exact Carina quest/cost agreement. The focused APIs and finder interaction passed **42 tests in six suites**; the extractor passed **10 tests**. No build/deployment or live game operation was needed.

For durable reproduction if ignored files are unavailable, save the following beside other temporary scripts and execute with `tsx --tsconfig web/tsconfig.json`. It emits the exact per-star sets directly from the same APIs; import paths below assume the same two-level temporary directory as above.

```ts
import assert from "node:assert/strict"
import { getChampionAscension, listChampionAscensionEligibility } from "../../src/data/game-ascension"
import { getChampionCrystalAscensionChampions, getChampionCrystalAscensionSources } from "../../web/src/lib/data/champion-crystal-ascension"
const rows = listChampionAscensionEligibility()
const universe = [...new Set([...rows.map(r => r.gameId),
  ...getChampionCrystalAscensionChampions().map(r => r.gameId)])].sort()
for (let star = 1; star <= 7; star++) {
  const recorded = universe.filter(id => getChampionAscension(id, star) !== null)
  const eligible = recorded.filter(id => getChampionAscension(id, star)!.maxLevel > 0)
  const withSource = eligible.filter(id => getChampionCrystalAscensionSources(id, star).crystals.length > 0)
  const gaps = eligible.filter(id => !withSource.includes(id))
  const empty = recorded.filter(id => !eligible.includes(id))
  const unknown = universe.filter(id => !recorded.includes(id))
  assert.equal(eligible.length, withSource.length + gaps.length)
  assert.equal(universe.length, eligible.length + empty.length + unknown.length)
  if (star === 7) assert.deepEqual([eligible.length, withSource.length, gaps.length], [112, 81, 31])
  console.log(JSON.stringify({ star, eligible, withSource, gaps, empty, unknown }))
}
```

## Provenance

Eligibility observation: `2026-11-03T09:10:42+00:00`; extraction capture: `2026-11-05T14:33:24.288624+00:00`. Opening observation/capture: `2026-11-05T14:05:24+00:00`. Read/extraction time does not refresh an observation. The newer-cache ascension projection equality is a comparison with the 5 November cache, not with a live game on 7 November.

| Evidence | SHA-256 |
| --- | --- |
| Shipped eligibility `src/data/game-ascension/catalog.json` | `f232915a9150bb68c61f15940fc1e8c6be909eee179091799428c1c60e9a47de` |
| Shipped openings `src/data/game-crystal-openings/catalog.json` | `add1cde9e1e0662d88561c96b4e96178744af5e0cd3ff32cb2d73b1b5d06a8ea` |
| Archived decompressed BCG source | `9e95551a68cfeeebf395f49b0bff676c5a2406ba7c30795c228cc48bd89ede61` |
| Archived compressed BCG file | `8dff910e22d5e46aaa7d1896e7b0524fdbc069757ee529bdeff61c2d1c302245` |
| Newer-cache BCG source, matching ascension projection | `b821489b5451d1d6ee0927f39a80d964f6c1d3aaf13bd76531e5f77d93deba8e` |
| Opening Gacha source | `c4873c0f509665e6f32a18be3c57d8c91887c1122e7a9b8b3e3423805922de3e` |
| GameStore metadata source | `1b56c68c34813a40647a559f4e3b130cd26f080d2ffd063c9db417ac97603c55` |
| Game-only quest capture `runtime-home-validated.json`, 5 November 2026 | `ebe5e7f2d5fbc759dbeb08d30ca174c7941c13ae4e2c81f545fb0b97c7694aa3` |
| Eligibility named schema | `9cc5236aef043cf7e5655458e790ed1f0897f67398e37af3020bca74511e97c4` |
| Opening named schema | `d70400fc03fdf0d47a5ef7a0b687986420d3933f8eedc116d1c0e88dc7e05109` |
| Marvel.Runtime address-bearing metadata | `d1b1085922513073b9dcd656aa08ee70e01a7aef1433aa35876fdfba463278b5` |
| Fuse.Runtime metadata | `c7296f9c50334d3f12ece5ae2e7c9566d6965cc355c9eecad8af8acfe561a24b` |
| Reviewed `BCGManager.txt` | `90c9b70da99c108cab02b41a436182b793b31b9e323f721f35f9b6e76756cdfc` |
| Reviewed `BCGUserHero.txt` | `d046aa1572be221b61cea67af0452b53875fe169fa0d1e52b0e16b6eafb564d3` |
| Reviewed `GameBCGUtils.txt` | `793ce6eff3d4f1a32cc6f1672bd2871e41476f577e48d526512f1c97cb35679d` |
| Reviewed `AscensionUpgradePanel.txt` | `ea4196fce27cea171c386ab5b02c7e47e555ee85f51eef935cc00414feaa77d8` |
| Reviewed `HeroData.txt` | `9f00ec7855a51680f85b8b21f570daa4a06cb1005fd197545c21450a2bb64aee` |
| Saved official November JSON, normalized serialization | `50ef943e4987ba2c36dd3ae27cbe5949bfd86cacd8b4a82ca4538a34b42de093` |

Raw client methods and machine-specific paths are not copied into this public report. Full local input/code hashes are additionally recorded in `sets.json`.

## Exact set appendix

The 31-ID table above is the complete seven-star gap set `G7`. The following is the complete 81-ID recorded-source set `S7`; the seven-star positive-path set is the disjoint union `S7 ∪ G7` (112). IDs are source identities, including variants, rather than English-name approximations.

```text
abomination_immortal, adamwarlock, agathaharkness, arcade, attuma, baronzemo, beast, bishop,
blackpanther_cw, blackpanther_realm, blacktarantula, bluemarvel, captainamerica_samwilson, colossus,
colossus_aoa, corvusglaive, danimoonstar, destroyer, doctorbong, domino, dragonman, drstrange, dust,
emmafrost, gentle, ghostrider, ghostrider_reyes, gorr, guillotine_2099, gwenom, highevolutionary,
hitmonkey, hobgoblin_philurich, howardmech, hyperion, ironman, ironman_infamous, jjj_spiderslayer,
kindred, knull, korg, ladydeathstrike, lizard, madelynepryor, manthing, mbaku, mephisto, misterknight,
misternegative, mojo, moondragon, mrfantastic, nova, omegasentinel, patriot, peniparker, phylavell,
pixie, purgatory, rhino, rubythursday, sandman, sasquatch, sersi, shatterstar, spiderman,
spiderman_black, spiderman_noir, spiderman_pavitr, spiderpunk, spiral, spot, starlord_kittypryde,
storm_realm, terrax, toad, venomtheduck, vision_timely, warlock, wave, whitetiger
```

Let `B` be the following complete 225-ID set of identities whose positive paths are exclusively lower-star paths:

```text
abomination, absorbingman, aegon, agentvenom, airwalker, angela, annihilus, antivenom, antman,
antman_future, apocalypse, archangel, bastion, betaraybill, blackbolt, blackcat, blackpanther,
blackwidow, blackwidow_movie, blackwidow_timely, brothervoodoo, bullseye, captainamerica,
captainamerica_ww2, captainbritain, captainmarvel, carnage, cassandranova, cassielang, champion,
cheeilth, civilwarrior, colossus_unstoppable, countnefaria, crossbones, cullobsidian, cyclops,
cyclops_90s, daredevil, daredevil_netflix, darkhawk, dazzler, deadpool_gold, deadpool_platinum,
deadpool_xforce, diablo, doc_ock, dormammu, dracula, drax, drstrange_realm, ebonymaw, electro, elektra,
enchantress, falcon, falcon_joaquintorres, frankencastle, galan, gambit, gamora, ghost,
ghostrider_cosmic, gladiator, green_goblin, groot, groot_king, groot_king_deathless, guardian,
guillotine, guillotine_nameless, gwenpool, havok, hawkeye, heimdall, hela, hercules, hood, hulk,
hulk_immortal, hulk_ragnarok, hulk_red, hulkbuster_movie, hulkling, humantorch, ikaris, imperiosa,
invisiblewoman, ironfist, ironfist_white, ironheart, ironman_silvercenturion, ironman_superior,
ironpatriot, isophyne, jackolantern, jeangrey_current, jessicajones_current, joefixit, jubilee,
juggernaut, kang, karlmordo, karnak, karolinadean, katebishop, killmonger, kingpin, kittypryde, kraven,
kushala, loki, longshot, lukecage, lumatrix, maestro_overseer, magneto, maker, mangog, mantis, masacre,
mistersinister, mistyknight, modok, moleman, moonknight, morbius, morningstar, msmarvel, msmarvel_kamala,
namor, nebula, negasonicteenagewarhead, nickfury, nicominoru, nightcrawler, nightthrasher, nimrod,
northstar, odin, okoye, omegared, onslaught, phoenix, phoenix_dark, photon, professorx, prowler,
proximamidnight, psychoman, psylocke, punisher, punisher_2099, quake, quicksilver, red_goblin,
redguardian, redskull, rintrah, rocket, rogue, ronan, ronin, sabretooth, sauron, scarletwitch, scorpion,
sentinel, sentry, serpent, shangchi, shathra, shehulk, shehulk_deathless, shocker, silk, silversable,
silversamurai, silversurfer, skrull_super, solvarch, spidergwen, spiderman_2099, spiderman_morales,
spiderman_movie, spiderman_stealth, spiderman_supreme, spiderwoman, squirrelgirl, starlord, stryfe,
sunspot, symbiotesupreme, taskmaster, thanos, thanos_deathless_trophy, thing, thor, thor_janefoster,
tigra, titania, ultron, ultron_prime, valkyrie, venom, venompool, vision, vision_deathless, vision_movie,
vivvision, void, vox, vulture_movie, warmachine, wasp, werewolfbynight, wiccan, wintersoldier, wolverine,
wolverine_oldman, wolverine_weaponx, x23, yelenabelova, yellowjacket, yondu
```

Define `L = B ∪ S7 ∪ G7` (337 distinct IDs). This is also the union of the lower-star positive-path sets; every recorded seven-star-eligible identity has at least one lower-star path. The exact lower-star gap sets can be specified without repeating hundreds of IDs:

- **4★:** positive-path set = gap set = `L` minus the following 19 IDs (318 remain):

```text
blade_stellar, deadpool_platinum, green_goblin_stellar, groot_king_deathless, guillotine_nameless,
humantorch_victorious, imperiosa, invisiblewoman_victorious, lumatrix, maestro_trophy,
mrfantastic_victorious, phoenix_dark, shehulk_deathless, solvarch, starlord_stellar,
thanos_deathless_trophy, thing_victorious, vision_deathless, wolverine_weaponx
```

- **5★:** positive-path set = gap set = `L` minus the following 17 IDs (320 remain):

```text
blade_stellar, green_goblin_stellar, groot_king_deathless, guillotine_nameless, humantorch_victorious,
imperiosa, invisiblewoman_victorious, lumatrix, maestro_trophy, mrfantastic_victorious, phoenix_dark,
shehulk_deathless, solvarch, starlord_stellar, thanos_deathless_trophy, thing_victorious,
vision_deathless
```

- **6★:** positive-path set = gap set = `L` minus the following one ID (336 remain):

```text
quake
```

For 1–3★, both eligible and gap sets are empty. The exact All-stars no-source set is `B ∪ G7` (256). These set expressions describe definition coverage and this helper's source coverage only. The executable reproduction emits the corresponding explicit arrays, together with every known-empty and missing-metadata set.
