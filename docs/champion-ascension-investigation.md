# Champion ascension investigation

The game definitions contain enough structured information to add a verified ascension information panel now: explicit eligibility per champion blueprint/star level, materialized token/dust costs, per-step Attack/Health and Challenge Rating increases, and inventory-item names/artwork references. This should remain a recorded-definition view. Account unlocks, owned materials, current offers and future announced ascension levels are separate concerns.

## Deliverables and reproduction

- `scripts/extract_mcoc_ascension.py`: reusable, read-only local-cache extractor. Accepts raw or gzip BCG, named protobuf schema, optional GameStore definitions, explicit observation time and an output path. `--public` writes a collectible-only catalog with sanitized provenance; `--limits-out` generates a tiny client-safe limits/stat-fallback module. It does not execute game code, read account data, connect to the game, or mutate the existing crystal catalog.
- `scripts/test_extract_mcoc_ascension.py`: covers concrete costs, unbound tuning tiers, source variants, exact resource metadata/fallbacks, unknown tier/order rejection, conflicting modifier sets, invalid costs, nonfinite modifiers, duplicate identities, public export sanitization, reviewed playable events and deterministic offline re-projection.
- `src/domain/champion-ascension.ts`: validated shared rule reader and pure level/effects helpers, with tests at the public API boundary.
- `src/data/game-ascension/catalog.json` and `index.ts`: sanitized application dataset and server/bot lookup API. Contains 1,941 player blueprints (1,940 collectible non-event rows plus the exact reviewed Carina event row), five referenced global tiers and 122 required resources. The source identity/hash is preserved, while local machine paths and excluded NPC/tuning rows are removed.
- `src/data/game-ascension/limits.ts`: generated, client-safe rarity bounds and uniform Attack/Health fallback paths; imports no catalog JSON. Full champion rules remain necessary to establish eligibility.
- Ignored normalized artifact: `temp/ascension-investigation/catalog.json` (about 1.32 MB). Raw decoder probes and a fresh-current-source comparison remain in that ignored directory; game binaries and decompiled bodies are not copied into the repository.

```powershell
python -m unittest discover -s scripts -p test_extract_mcoc_ascension.py
python scripts/extract_mcoc_ascension.py --bcg D:/CodexArtifacts/mcoc-relic-data-2026-11-03/sources/bcg.bin.gz --schema temp/crystals/schema.json --gamestore C:/Users/ossul/AppData/LocalLow/Kabam/Champions/gamestore/out/v1/5AFEBC8CC99BE2C1546DB91EF7B1F6360DFD7154.bin --observed-at 2026-11-03T09:10:42+00:00 --out temp/ascension-investigation/catalog.json
python scripts/extract_mcoc_ascension.py --bcg D:/CodexArtifacts/mcoc-relic-data-2026-11-03/sources/bcg.bin.gz --schema temp/crystals/schema.json --gamestore C:/Users/ossul/AppData/LocalLow/Kabam/Champions/gamestore/out/v1/5AFEBC8CC99BE2C1546DB91EF7B1F6360DFD7154.bin --observed-at 2026-11-03T09:10:42+00:00 --public --limits-out src/data/game-ascension/limits.ts --out src/data/game-ascension/catalog.json
pnpm exec vitest run src/domain/champion-ascension.test.ts src/data/game-ascension/index.test.ts --maxWorkers=1
```

The schema is produced by the existing `export_mcoc_proto_schema.py` from named current Cpp2IL dummy DLLs; it is not a guessed wire layout. Extraction rejects unknown members in decoded source contracts, unexpected required member bindings, unknown referenced tiers, missing materialized costs, mismatched tier order, conflicting materialized/global modifiers, unverified cost fields/types and conflicting display definitions.

## Provenance and snapshot boundaries

The rules artifact deliberately uses the archived **3 November BCG source already pinned by the crystal catalog**, rather than silently relabeling the refreshed local cache. Observation time is `2026-11-03T09:10:42+00:00`; the artifact independently records when it was read/extracted. Cache file modification times are retained as filesystem metadata, not substituted for observation time.

| Evidence | SHA-256 |
| --- | --- |
| Decompressed archived BCG, `D:/CodexArtifacts/mcoc-relic-data-2026-11-03/sources/bcg.bin.gz` | `9e95551a68cfeeebf395f49b0bff676c5a2406ba7c30795c228cc48bd89ede61` |
| Compressed archived BCG file | `8dff910e22d5e46aaa7d1896e7b0524fdbc069757ee529bdeff61c2d1c302245` |
| Current BCG cache, `C:/Users/ossul/AppData/LocalLow/Kabam/Champions/bcg/out/v1/E95E28EECECC04D6A358C8FD8089D01305D0FB73.bin` | `b821489b5451d1d6ee0927f39a80d964f6c1d3aaf13bd76531e5f77d93deba8e` |
| Current GameStore cache, adjacent `gamestore/out/v1/5AFEBC8CC99BE2C1546DB91EF7B1F6360DFD7154.bin` | `1b56c68c34813a40647a559f4e3b130cd26f080d2ffd063c9db417ac97603c55` |
| `Marvel.Runtime.dll` metadata | `d1b1085922513073b9dcd656aa08ee70e01a7aef1433aa35876fdfba463278b5` |
| `Fuse.Runtime.dll` metadata | `c7296f9c50334d3f12ece5ae2e7c9566d6965cc355c9eecad8af8acfe561a24b` |
| Named schema JSON | `9cc5236aef043cf7e5655458e790ed1f0897f67398e37af3020bca74511e97c4` |

The current BCG is 33,858,953 bytes (cache mtime `2026-11-05T06:47:56.344293+00:00`), compared with 33,858,737 archived bytes (archive mtime `2026-11-03T09:11:20.624202+00:00`). Both decode 3,821 blueprints. Fresh independent extraction of both sources produces identical normalized blueprints, tiers, resource metadata and coverage; the ignored `temp/ascension-investigation/source-comparison.json` records this check. This is a verified equivalence of the ascension projection, not a claim that the whole BCG or other catalogs are unchanged. GameStore display metadata comes from its separately recorded newer source (mtime `2026-11-05T08:08:36.498916+00:00`). Its `Enabled` field is stored as `definitionEnabled`; it does not prove a token is in a live shop or currently obtainable.

The application dataset now retains hashes/basenames rather than ignored research artifacts' absolute machine paths. Its observation time is the archived BCG observation; GameStore metadata keeps its separate file modification/read provenance. Re-exporting the data must not relabel resource descriptions or source flags as current sale status.

## Exact contracts and joins

1. `BCGDataBuffer.heroes_blueprints`, tag 3 → `BCGBlueprintBase.Blueprint` and exact `Character`/`Rarity`.
2. `BCGDataBuffer.characters`, tag 4 → English friendly names by exact `Character`.
3. `BCGDataBuffer.ascension`, tag 26 → global `Ascension.Tier` records.
4. `BCGBlueprintBase.AscensionTiers`, tag 37 → ordered tier IDs applicable to that exact blueprint.
5. `BCGBlueprintBase.EligibleAscensionTiers`, tag 38 → the same ordered steps with **materialized resource IDs**. These costs must be used: global tier costs contain generic placeholders such as `ascension_token_champion`, whereas an Adam Warlock blueprint explicitly requires `ascension_token_champion_adamwarlock` and `ascension_token_class_cosmic`.
6. `Ascension` tags 1–7 hold `Tier`, `Cost`, `Attack`, `Health`, `MightGain`, `BuffIDs`, `ChallengeRating`. Cost items preserve exact `RedeemerItem.Type`, `Data`, `Quantity`.
7. For `inv` costs, `GameStoreDataBuffer.items → GameStoreItemList.gameStoreItems → GameStoreItem.Name` joins inventory display metadata exactly. English titles/descriptions, image references, CDN flag and usage restrictions are retained when present. `res/sc` remains an exact resource identity; its English label is not invented by the extractor.

No champion name parsing, class-name inference or suffix-based tier eligibility is used. Source class IDs are retained (`chemical`, `trained`, `tech`, etc.); the materialized class-token ID is the actual join.

`BCGManager.GetMaxAscensionTierForRarity(blueprint)` returns the count of that blueprint's tier list. `BCGUserHero.HasNextAscension` compares the owned current level with that maximum. `GetEligibleAscensionDataForTier` uses the concrete per-blueprint list; `GetNextAscensionTierDataForHero` and `GetAscensionListForHeroCurrentTier` resolve ordered IDs into global tuning. This establishes why global definitions alone cannot unlock extra levels.

## Original non-event coverage and representative costs

The artifact retains all 3,821 blueprint variants with `userCollection` and `isEventCharacter` flags. A read-only application projection can choose collectible, non-event definitions and join its public champion table by game ID. Do not collapse same-character/star NPC/event/legacy variants merely because their labels match.

| Collectible non-event source blueprints | Count | Recorded maximum level |
| --- | ---: | ---: |
| 1★ | 23 | 0 |
| 2★ | 346 | 0 |
| 3★ | 318 | 0 |
| 4★ | 318 | 1 |
| 5★ | 320 | 1 |
| 6★ | 336 | 1 |
| 7★ with no tiers | 167 | 0 |
| 7★ explicitly eligible | 112 | 2 |

There are 1,940 collectible non-event blueprint rows and no duplicate `(gameId, rarity)` in that projection. The prior 340-public-champion preview fixture joins 1,904 of them; that fixture is not used to restrict the extractor.

The global catalog contains 23 tiers. Eighteen `_def` tiers, including `7s_t1_def` through `7s_t15_def`, are not referenced by any blueprint eligibility list in this snapshot. They remain separately visible as unbound tuning definitions and never increase the recorded player cap. Two other seven-star variants (`carina_white_t7`, event-marked; `magik_legacy_t7`, not collection-marked) have one explicit tier and were excluded from this original non-event projection. The reviewed follow-up below admits only the collectible seven-star Carina row; Magik legacy remains excluded.

### Reviewed playable-event follow-up, 7 November 2026

The original 112 positive seven-star paths above remain correct for their non-event scope. The canonical projection now also includes **`carina_white_t7`**, exact `gameId=carina_white`, rarity 7, `userCollection=true`, `isEventCharacter=true`. [V59.0 Release Notes](https://playcontestofchampions.com/news/v59-0-release-notes/) establish player-reward seven-star Carina, independently of token existence. The existing full extraction provides her ordered `7s_t1` path, max A1, and concrete costs: one `inv/ascension_token_champion_carina_white` and one `inv/ascension_token_class_cosmic`. No recipe is synthesized from the quest reward.

`src/data/game-ascension/playable-event-blueprints.json` records that exact identity, flag assertions, rationale, official reference, audit reference and BCG evidence hash. Both Python extraction/coverage and TypeScript validation/indexing use it. The exported `classifyAscensionBlueprint(AscensionBlueprintIdentity)` contract returns `collectible`, `verified-playable-event` or `excluded`; it classifies identity only. The normal strict tier/order/cost/resource/modifier checks still apply. Unknown event rows, boss variants, every non-collectible Carina rarity and `magik_legacy_t7` remain excluded. Player `magik_t7` stays A2. Neither a source reward nor a global tuning tier establishes eligibility.

The deterministic regeneration uses only the verified existing full extraction, SHA-256 `8c79a1adb701a50f2cb0637b8a5d4d733529ef9f8c61dc0fab9f03b937e3b733`. Before the fix its blueprint/tier/resource/coverage projections matched the original public artifact exactly. The two exports originally recorded different `capturedAt` extraction times (`14:03:52.841252` and `14:33:24.288624` UTC on November 5); all other sanitized provenance agrees. The offline command verifies that agreement and retains the public artifact's **entire original source object**, including November 3 observation and original capture time. It does not read a game cache or refresh definitions:

```powershell
python scripts/extract_mcoc_ascension.py --from-extraction temp/ascension-investigation/catalog.json --preserve-public-source src/data/game-ascension/catalog.json --public --limits-out src/data/game-ascension/limits.ts --out src/data/game-ascension/catalog.json
```

The public data delta is exactly one blueprint plus its resolved Carina-token resource; every existing blueprint/resource and all five tiers are unchanged. Coverage becomes 1,941 player rows, 1,880 excluded rows and 122 resources. Seven-star coverage is 280 recorded paths: **113 positive (112 A2, one A1) and 167 empty**. There are 375 identities, 338 with a positive path at some star, and 1,087 positive blueprint/star pairs; lower-star counts are unchanged. The crystal source boundary still has 81 identities/1,078 bindings, so the enlarged seven-star scope has 32 crystal-source gaps. The separate exact quest route is not a crystal binding.

The generated rarity maximum remains A2. Because Carina's A1-only path and the other positive A2 paths have different lengths, the conservative generator emits an empty **generic seven-star stat fallback**. Exact champion rules now compose effective Health/Attack multipliers (Carina A1 approximately 1.08; player Magik A2 approximately 1.1664), with additive +15/+30 CR. The original additive combat projection was corrected in the [combat follow-up](champion-combat-ascension.md); raw tier values and owned-roster policy are unchanged. No generic preview receives another champion's second step.

The unchanged November 5 quest capture (`ebe5e7f2d5fbc759dbeb08d30ca174c7941c13ae4e2c81f545fb0b97c7694aa3`) independently records one mastery grant at `epilogue_ch04_q04.masteryCompletionRewards` matching those exact two costs. Quest/summary duplication is one reward definition. Account access, completion, inventory, feature unlocks and live server acceptance remain unverified.

Regression coverage includes the existing extractor/domain/data suites and new `src/domain/champion-ascension-classification.test.ts` and `web/src/lib/data/carina-ascension-eligibility.test.ts`. Include these two suites in CI's explicit ascension/finder commands; this follow-up does not edit the workflow. The finder test uses an empty mocked champion database and the real loader/eligibility readers: Carina remains selectable at seven stars/All stars and excluded at six stars, with no UI exception. Python tests also cover offline round-trip, deterministic bytes and rejection of mismatched preserved provenance. The focused verification passed **14 Python tests and 34 Vitest tests across eight suites**; root TypeScript, full web TypeScript (`--noEmit --incremental false`, owned process 43944, exit 0) and scoped ESLint passed. The exact local full-extraction/public diff and quest/cost comparison are recorded in ignored `temp/carina-coverage-fix/verified-diff.json`.

| Step | Concrete cost pattern | Recorded per-step changes |
| --- | --- | --- |
| 4★ A0 → A1 | 100,000 `res/sc` + 50 T1 Primordial Dust | +30% Attack, +30% Health |
| 5★ A0 → A1 | 500,000 `res/sc` + 100 T1 Primordial Dust | +20% Attack, +20% Health |
| 6★ A0 → A1 | 900,000 `res/sc` + 200 T2 Primordial Dust | +22% Attack, +22% Health |
| Eligible 7★ A0 → A1 | 1 exact champion token + 1 exact class token | +8% Attack, +8% Health, +15 CR, `MightGain` 3.6 |
| Eligible 7★ A1 → A2 | 100,000 `res/sc` + 500 T2 Primordial Dust + 10 exact class tokens + 2 exact champion tokens | +8% Attack, +8% Health, +15 CR, no additional `MightGain` |

These rows describe incremental costs. Reaching A2 from A0 therefore uses 3 champion tokens and 11 class tokens, plus A2 dust/resource costs. Store the steps rather than replacing them with a single guessed cost formula. All source float values are preserved; display percentages can round to whole numbers.

The data includes 124 cost resources: 123 inventory IDs and `res/sc`. Current GameStore definitions resolve 120 of those inventory IDs. Missing metadata stays explicit for `ascension_token_champion_medusa`, `ascension_token_champion_tuning_normal` and `ascension_token_class_superior`; the latter two appear in non-player tuning variants. English inventory names and actual artwork references are available for T1/T2 dust and the six normal class tokens, as well as most champion tokens. The broader store contains 135 token/dust definitions, including definitions not currently consumed by recorded eligibility; those must not be interpreted as eligibility on their own.

## Modifier semantics and limits of the evidence

`HeroAttributesPanel.UpdateStats` gets the completed ordered ascension list and **adds** `Health`, `Attack` and `ChallengeRating` across its entries. The `Ascension` getters establish their memory offsets; the panel sums +44, +40 and +64 respectively. This establishes an additive panel summary, not the final combat multiplier. The publisher's subsequent correction explicitly establishes compounding A2 Attack/Health on A1. The [combat follow-up](champion-combat-ascension.md) therefore derives an effective multiplier from raw incremental steps, while preserving the panel's independently supported additive CR semantics. Prestige uses its separate calibrated projector.

`GameBCGUtils.GetAscensionTotalMightGainForCurrentTier` sums `MightGain`. `PlayerAttributes.SetAttributeData` adds that result to `might_gain_bg_rate`. The 3.6 value is an ISO-Burst/Might-related tuning contribution, not prestige. All current ascension records have empty `BuffIDs`.

No minimum-rank field exists in the selected ascension contracts. The examined upgrade UI config checks a remaining ascension step, global feature/tab unlock and affordability; no minimum rank is established by that check. Account/progression gates live in separate tuning and were not extracted. A panel can state the recorded path and costs without claiming that the current player can execute it. Blueprint eligibility does not establish store availability, quest reward availability or player inventory.

The [staff-authored ascension launch article](https://forums.playcontestofchampions.com/en/discussion/411731/everything-about-7-star-ascension-so-far) explains cluster drops containing a champion and A1 materials, automatic first-pull consumption into A1, and a Super-Duper box that removes drawn champions until all six are obtained. It also describes CR and Might/ISO-Burst effects. Its eleven-level roadmap and launch timing are historical context; they cannot substitute for snapshot-specific eligible tiers. Current crystal bonus definitions are being investigated separately, preserving exact bonus-reward associations rather than assuming every champion pull grants tokens.

## Implemented shared API and consumer contract

`src/data/game-ascension/index.ts` is for server/bot consumers. Clients should receive the chosen champion's small rule array from that server boundary, rather than importing the complete dataset.

- `getChampionAscension(gameId, rarity)` returns `{ gameId, rarity, blueprintId, maxLevel, steps, observedAt }` or `null`. A known, explicitly non-ascendable blueprint returns a rule with `maxLevel: 0` and empty steps; a missing champion/star returns `null`. These states are not interchangeable.
- `getChampionAscensionRules(gameId)` returns recorded rules in descending rarity order. `getChampionAscensionByBlueprintId(id)` resolves an exact collectible source blueprint, never a global tuning-tier ID.
- `getChampionAscensionEligibility(gameId)` returns the compact champion attribute `{ ascendableRarities, recordedRarities }` in descending star order. Positive per-blueprint maxima establish the first array; known empty paths still appear in the second. Missing stars remain unknown. `listChampionAscensionEligibility()` adds each exact `gameId` and source `name` for bulk server projections, including champions without rewards. Both reuse the validated collectible index and return defensive copies. The type and `hasRecordedAscensionPath(eligibility, rarity?)` predicate live in the client-safe `domain/champion-ascension-eligibility.ts`; no dataset import is required on clients.
- `getAscensionResource(type, id)` returns exact resource display metadata or `null`. An unresolved source resource retains `metadataResolved: false`; this does not grant permission to invent its name/artwork.
- `ascensionCatalogSource` exposes sanitized observation/hash provenance.
- `clampRecordedAscensionLevel(rules, level)` and `getAscensionEffects(rules, level)` are pure helpers in `src/domain/champion-ascension.ts`. They bound finite rounded levels to that rule's maximum. Effects expose effective `attackMultiplier`/`healthMultiplier` (products of `1 +` the corresponding raw incremental bonuses) and additive `challengeRating`/`mightGain`. Unknown rules produce identity multipliers and zero additive contributions. They perform no stat rounding or prestige calculation.
- `maxRecordedAscensionForRarity(rarity)` and `recordedAscensionStatBonus(rarity, level, kind)` are available directly from the tiny `limits.ts`. The latter derives the effective combined percentage only for uniform eligible Attack/Health paths; conflicting paths yield zero generic fallback. Its generator and emitted helper use the same compounding policy, preserving raw values. These functions describe a bounded generic preview, not eligibility for an arbitrary champion.

The reader validates source hash/time shapes, row coverage, unique identities, ordered step references, resource references and materialized/global modifier agreement. Duplicate collectible `(gameId, rarity)` paths fail rather than choosing a legacy/NPC variant. Callers receive isolated rule/resource objects so mutation cannot poison the cached catalog.

Regression examples: Adam Warlock (`adamwarlock`) has 6★ A1 and 7★ A2 rules; Hulk (`hulk`) has 6★ A1 but an explicit 7★ maximum of zero; Gwenom (`gwenom`) has a verified 7★ A2 path. Eleven TypeScript tests cover fixture contracts and these real application-data boundaries.

## Consumer integration guidance

1. Use the implemented shared reader keyed by exact game ID, rarity and source blueprint. Keep raw global tiers separate from the collectible projection and expose unknown/conflicting variants explicitly.
2. On champion pages, show **Recorded ascension** next to build/stat controls: available recorded levels, per-step and cumulative costs, health/attack bonus and CR. Unsupported or absent records need distinct copy. Preserve the source observation date.
3. Render exact token/dust names where resolved and an ID fallback where unresolved. Actual artwork references can enter the existing content-hashed GCS asset pipeline; do not synthesize token artwork from champion portraits or hotlink inconsistent hosts.
4. The original audit found a rarity-global seven-star A0–A5 cap and a linear 8% factor reused for stats/prestige. Eligibility/stat consumers need the implemented champion-specific paths, lower-rarity paths and separate CR/Might semantics. Prestige remains a separate calibrated policy: `BCGUserHero` reads `rating_prestige` from its server/dictionary data, and `get_PrestigeRating` returns that stored value. No client-side ascension-to-prestige formula was established by this investigation. Do not treat the new Attack/Health or Might data as prestige proof, or let an information panel validate an unsupported selected build implicitly.
5. Reuse the exact resource IDs for later inventory/planning. A requirements view can distinguish incremental step cost from total-to-target cost. Crystal cluster rewards and quest completion/path rewards can link to these IDs, preserving possible vs guaranteed reward semantics and observation context.

## Local method evidence hashes

The following named method sources remain under `D:/CodexArtifacts/Cpp2IL-2026-11-03/IsilDump/Marvel.Runtime/` and are referenced here without copying their bodies into the repo.

| File | SHA-256 |
| --- | --- |
| `Ascension.txt` | `ffaaa74e1c24a844995e12562b939ef55be4d5971b82f7314c94dadf49771f7e` |
| `BCGManager.txt` | `90c9b70da99c108cab02b41a436182b793b31b9e323f721f35f9b6e76756cdfc` |
| `BCGUserHero.txt` | `d046aa1572be221b61cea67af0452b53875fe169fa0d1e52b0e16b6eafb564d3` |
| `HeroAttributesPanel.txt` | `f0c36d48cc29cd2fecae6c41c3b563405cb449a412faeb685d8aed44295c8fc0` |
| `PlayerAttributes.txt` | `9cfc41ff51a88da441efaa9b1060990e26fc3801e31f7d82b974acddbf6d9138` |
| `GameBCGUtils.txt` | `793ce6eff3d4f1a32cc6f1672bd2871e41476f577e48d526512f1c97cb35679d` |
| `AscensionUpgradePanel.txt` | `ea4196fce27cea171c386ab5b02c7e47e555ee85f51eef935cc00414feaa77d8` |
