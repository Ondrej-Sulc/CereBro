# Crystal drop rates, guarantees and special rewards

Investigation performed on 5 November 2026. The reusable results include a static rules extractor, an evidence-checked UI importer, and a resumable collector for genuine read-only server odds responses. The first follow-up observed crystal Info panels; the subsequent explicitly authorized bulk pass reproduced the normal client's odds request through the existing local session. No crystal was bought or opened. Credentials and account state were never written into capture artifacts or application data. The original membership catalog and database were not refreshed by this investigation.

## Result

The game has an explicit odds disclosure model, but **numeric drop rates are not in the static gacha protobuf we currently extract**. The client obtains a separate odds response for a source crystal name from `/gacha/getOdds`. Consequently neither pool size, carousel frequency, a featured image, an opening's sample count nor a pity threshold supplies a defensible per-champion percentage.

The local static data does contain useful facts that CereBro currently drops: exact pity-template/group bindings, source descriptions and limits, box-gacha opening/reset metadata, conditional Cluster Drop links, their item quantities and AutoAscend flags, and possible non-champion rewards. Those facts can be preserved now, without inventing rates.

The live follow-up recovered **three complete, genuine disclosures containing 16 displayed rate rows**, covering a recurring main crystal, a featured crystal and the Alliance Crystal's trophy-champion category. Sanitized screenshot evidence, manual transcriptions and a normalized result are saved under ignored `temp/crystal-odds-investigation/live/`. These are dated, rounded category disclosures from the actual game UI, not raw `GachaOdds` JSON or inferred individual champion percentages.

The subsequent bulk pass **successfully obtained real serialized odds responses for every exact source ID** in the current 2,448-definition snapshot. **1,093 source openings returned nonempty disclosures; 1,355 returned empty disclosures. All 2,448 were attempted, with no outstanding transport, authentication or parsing failures.** This includes historical and event definitions that are absent from the visible store. Successful responses are stored verbatim only after validating the reviewed odds-only contract. An HTTP 200 response with `result:{}` is retained as `empty_disclosure`, not interpreted as zero odds, current unavailability, or a parse failure. Every collector attempt is explicit in the source-specific coverage manifest; the public sidecar preserves an entry for all 2,448 definitions.

## Sources and snapshot boundary

| Evidence | Identity | Meaning |
| --- | --- | --- |
| Application's normalized champion catalog | `src/data/game-crystals/catalog.json`, observed `2026-11-03T09:10:42+00:00`; source gacha SHA-256 `087359950217387120337353cbb331eb733d9b49a2329db127634d307ae40dd6` | Existing public membership snapshot |
| Historical decoded gacha | `temp/crystals/decoded.json` | Earlier decoded export whose counts agree with the application snapshot; the corresponding original binary was not found in this investigation, so its raw binding is not independently reverified |
| Current on-disk gacha | `C:/Users/ossul/AppData/LocalLow/Kabam/Champions/gacha/out/v1/A29758BCA3552F42481F416859DD53E4BE131265.bin`; 18,180,634 bytes; SHA-256 `c4873c0f509665e6f32a18be3c57d8c91887c1122e7a9b8b3e3423805922de3e` | Newer cache, file modified `2026-11-05T06:47:56Z`, observed `2026-11-05T14:05:24Z` |
| Current-cache archive found in quest investigation | `temp/quest-data-investigation/game-only/sources/gacha-A29758BCA3552F42481F416859DD53E4BE131265.bin` | Also hashes to `c4873c…`; it is not the missing November 3 binary |
| Protobuf schema | `temp/crystals/schema.json`, exported from `D:/CodexArtifacts/Cpp2IL-2026-11-03-addresses` | `Marvel.Runtime.dll`: `d1b1085922513073b9dcd656aa08ee70e01a7aef1433aa35876fdfba463278b5`; `Fuse.Runtime.dll`: `c7296f9c50334d3f12ece5ae2e7c9566d6965cc355c9eecad8af8acfe561a24b` |
| Client method evidence | `D:/CodexArtifacts/Cpp2IL-2026-11-03/IsilDump/Fuse.Runtime/EB/Sparx/` and `…/Marvel.Runtime/` | Read-only inspection of named methods; method bodies are not copied into the repository |

Restricted searches for gacha binaries/archives under `D:/CodexArtifacts` and the workspace's ignored sources did not locate the November 3 raw gacha file. Do not relabel current rules with the old catalog hash or silently join the two snapshots as if they were one capture. A matching-source catalog refresh or a separately labeled rules snapshot is required before application integration.

| Coverage | Historical decoded export | Current raw cache |
| --- | ---: | ---: |
| Source crystal definitions | 2,437 | 2,448 |
| Definitions with a pity-template binding | 97 | 97 |
| `IsBoxGacha` definitions | 44 | 51 |
| Definitions with `HideOddsInfo` | 2 | 2 |
| Pity templates / groups | 134 / 378 | 134 / 378 |
| Bonus-reward definitions | 158 | 158 |
| Bonus definitions with `AutoAscend` | 141 | 141 |
| Reward-item → bonus bindings | 218 | 218 |
| Non-champion category reward entries | 6,798 | 6,920 |

All template, group, category and conditional bonus references resolve in both inspected projections. Shared counts do not imply unchanged individual contents or unchanged rates.

## Where odds actually come from

The verified static `EB.Sparx.GachaDataBuffer` contract contains only fields 1–6: categories, groups, tabs, pityTemplates, pityGroups and bonusRewards. `GachaCategory` contains Name, Items and DisplayRarityIndex. There is no category weight/probability member. All 40,286 historical category items have Quantity 1; their MinQuantity/MaxQuantity are reward amount bounds, not weights. Balance is absent from those items.

Separate schema contracts exist:

| Contract | Relevant fields |
| --- | --- |
| `GachaOdds` | Odds; KindInfo |
| `GachaOdd` | Name; Kinds |
| `GachaOddKinds` | Name; IsFeatured; Kinds |
| `GachaOddKind` | Prefix; Value (double); `_Name`; KindIndex; `_KindInfo`; Type; Data; BonusReward; DisplayRarityIndex |

`GachaAPI.GetGachaOdds(name, callback)` builds a **GET** request to `/gacha/getOdds` with `name` and a generated `nonce`. The virtual endpoint slot resolves to `EndPoint.Get`; `Request.doRequest` aliases the request's data dictionary to its query dictionary for GET, so `AddData` does not imply POST. The response callback creates `GachaOdd` and passes it into `GachaManager.OnGachaOdd`. That method stores it in a name-keyed in-memory dictionary. The box-local `GachaBox.get_GachaOdd` invalidates its cached object after 3,600 seconds. Box-instance changes also invalidate manager odds. No persistent odds-file write was found in this request/callback path.

`GachaOddKind`'s JSON constructor reads `n` (name), `v` (numeric value), `p` (prefix), `s` (kind-info index), `t` (reward type), `d` (reward data), `br` (bonus reward) and `dri` (display rarity index). `GachaOddsPctGroup.Init` passes its Value to `GameLocalizationUtils.ToLocalizedPercent` with precision 2, alongside Prefix and resolved label. This establishes a display-odds contract, not a local reward-sampling algorithm. Preserve the original value, prefix, labels and grouping when a legitimate response is available; a rounded or prefixed display value must not be promoted to an exact per-champion probability.

The local `Champions/HTTPCache` directory contains no files, and `Champions/gacha` contains only the static protobuf. No numeric odds response payload was recovered from those locations. This is a statement about the inspected artifacts, not proof that a response can never be collected. The static phase used no authenticated request or account token; the live follow-up used the game's existing UI session without extracting credentials or replaying requests.

Kabam's staff explanation corroborates the boundary: the displayed rates are supplied by the back end, and the reel is cosmetic. See [Drop Rate Information in the Contest](https://forums.playcontestofchampions.com/en/discussion/55022/drop-rate-information-in-the-contest). First Appearance is also a distinct reward property; Kabam directs players to the Grace Crystal Info screen for its rate. See [First Appearance Champion Portraits](https://help.kabamsupport.com/hc/en-us/articles/44256413933339-First-Appearance-Champion-Portraits).

## Genuine live-game disclosure captures

The authenticated Windows game was already running. Using the computer-use workflow, the investigation navigated the Crystals tab, expanded crystal cards and selected their Drop Rates Info icons. Only read-only information panels were used. Full account screenshots were not saved; the retained PNGs contain only the odds tooltip and, where necessary, the active-tab labels. No credentials, account identifiers, chat, balances or owned-crystal counts are in the saved evidence.

| Exact source opening | Observation time (UTC) | Complete displayed disclosure |
| --- | --- | --- |
| `alliance_crystal` | `2026-11-05T14:26:37.886000+00:00` | 4-Star Hero **0.05%**; 3-Star Hero **4.95%**; 2-Star Hero **30.00%**; 4-Star Signature Stone **4.00%**; 3-Star Signature Stone **6.00%**; Boost **12.00%**; Lesser Boost **18.00%**; ISO-8 **25.00%** |
| `cavalier_crystal_v2` | `2026-11-05T14:32:25.925000+00:00` | 6-Star Hero **6.00%**; 5-Star Hero **30.00%**; 4-Star Hero **55.00%**; 5-Star Nexus Hero Crystal **7.50%**; 6-Star Nexus Hero Crystal **1.50%** |
| `cfh_v33_shard_crystal` | `2026-11-05T14:47:24.878000+00:00` | 6-Star Hero **8.90%**; 5-Star Hero **44.80%**; 4-Star Hero **46.30%** |

Each complete disclosure sums to 100.00% as displayed. The Alliance categories are relevant to Unstoppable Colossus acquisition, but the importer preserves the UI's rarity-category labels instead of converting them to per-champion odds. The Cavalier Nexus rewards are separate nested-crystal outcomes; they are not added to direct champion rates. The featured v33 tooltip names 24 champions, beginning with Shatterstar and ending with Vision (Age Of Ultron); dividing its rarity rates by 24 would be an unproven assumption.

The first two timestamps are the saved sanitized PNG modification times, explicitly recorded as `timestampBasis: sanitized-evidence-saved`; the original screenshot API did not provide a server response timestamp. The featured capture records `timestampBasis: snapshot-observed`. Neither timestamp claims to be the back end's rate-generation time. The normalized artifact sets `serverResponseAsOf: null`, `exactUnderlyingOddsKnown: false` and `apiPayloadCaptured: false`.

Opening identity is matched against the current raw `c4873c…` snapshot using the observed English title, description and store tab. All three triples uniquely resolve. `GachaCrystalButton.Config.GetTab` maps source `Tab=Premium` to Premium, `Tab=Shards` to Shard Crystals, `Tab=Special` to Special, and other/empty values to the ordinary Crystals tab. This matters because `cavalier_shards_v2` has the same title and description as `cavalier_crystal_v2` but belongs to Shard Crystals. The Cavalier active-tab crop proves the ordinary Crystals route. Conversely, `cfh_v33_shard_crystal` has no explicit Shards tab and was observed in ordinary Crystals despite its internal name suffix. Internal naming alone is insufficient. The importer rejects ambiguous matches rather than choosing an alias.

| Retained evidence | SHA-256 |
| --- | --- |
| `live/alliance-crystal-tooltip.png` | `5ad1833ff3e770c72a233c2eb49c0b4a78169ab8aa09c31cce223ca4de54acc6` |
| `live/cavalier-crystal-tooltip.png` | `9749b41e4a6d440fbe3b3bee39e65ecf832dabfc5d1d8acf7abe17cbe5b0fbf6` |
| `live/cavalier-crystal-tab.png` | `3d52cdc41d92f26092014127c41edc79fad713aae40c4b7b20a19e84415d6960` |
| `live/cavalier-featured-tooltip.png` | `3bf438141e9a73f65473b67e43e088ed30fa46b42116ab4fcf53667c8999c663` |

The earlier `cavalier-featured-tooltip-top.png` capture clipped the lower rows and is deliberately excluded from the complete transcription. Once the full disclosure became visible, a fresh screenshot supplied all three rows. User input was then detected, the game was re-observed and further game inputs stopped; no more crystals were opened for inspection. A clipped panel must never be silently completed by a remainder calculation.

At the initial static inspection, `Player.log` was empty; the previous log contained no `/gacha/getOdds` or `GachaOdds` matches, and the HTTP cache was empty. A later approximately 20 MB current log also contained no odds-route or session-token matches. Therefore the UI phase captured displayed disclosures only. The later bulk phase described below obtains separate serialized responses directly. No certificate installation, TLS changes, executable modifications, injection or authentication bypass was needed. The three UI panels alone do not establish complete rate coverage, box-state transitions or today's store availability.

For application integration, retain these observations as an exact-source, dated odds layer separate from the existing November 3 membership snapshot. A matching title does not establish that every alias, Nexus selection, later rotation or player state shares these rates. Only expose rates for the exact matched source, show the observation date and category labels, and leave other odds unknown. Before joining into the public catalog, either reproduce the current membership snapshot or explicitly retain the two-source provenance.

## Authorized bulk API collection

The first genuine `alliance_crystal` request returned HTTP 200 with 292 bytes and the expected `result.kinds[].k[]` model. Its eight category values matched the observed in-game tooltip. Subsequent priority requests succeeded for all requested examples: `superior_banquet_crystal_dec25` (five groups, 27 rows), `superior_banquet_crystal_dec24` (three groups, 22 rows), `greater_banquet_crystal_dec25` (four groups, 29 rows), `greater_banquet_crystal_dec24` and `greater_banquet_crystal_dec23` (three groups, 26 rows each), `jubilant_crystal_dec25` (one group, 13 rows), the three exact Titan opening IDs, and the 6-/7-star main hero shard openings.

This is emulation of real read-only requests, not mocked percentages. Synthetic response bodies are confined to tests. The collector enumerates the raw cache's 2,448 distinct `GachaBox.Name` values rather than querying family aliases or extrapolating from equal membership.

The independently inspected protocol is:

1. `LoginAPI.LoginAsync` takes the server's `stoken` and attaches it to the endpoint's default query data. `FuseBugsnag.OnSessionTokenReceived` also saves that same token through a named normal PlayerPrefs entry. The collector reads this existing session value directly and keeps it only in memory; it neither signs in nor changes accounts.
2. The production endpoint is read from bundled `resources.assets` → `endpointconfig` → `Default.Prod`. `Setup.GetConfigParams` decrypts the bundled `config` bytes using `CryptoEngines.Default` type 4 (RC4), and the resulting bytes initialize the endpoint signing key. The collector reproduces this resource decoding using the reviewed metadata's unique 32-byte default-key RVA array. No key bytes, token values or signed query strings are logged or saved.
3. `Nonce.Generate` writes a 12-byte envelope: 32-bit time, 32-bit client marker, 16-bit seed and 16-bit counter, in big-endian order, then lower-case hex. The collector uses the same envelope with a random per-process marker instead of copying a device identifier.
4. The query contains exact source `name`, `nonce`, `sver=3`, `stoken` and current `ts`. `QueryString.StringifySorted` uses sorted keys and the client's URI escaping set, including the unescaped `!'()*-._~` characters.
5. `HttpEndPoint.Sign` computes HMAC-SHA1 over `GET\n<host>\n/gacha/getOdds\n<canonical-query-without-sig>\n`. The Base64 result is the `sig` query field. Only the normal read-only odds route is used.
6. A pooled HTTPS client uses normal certificate validation and refuses redirects. It sends sequential requests with an explicit minimum interval; 429/transient errors trigger bounded retries/backoff, while authentication failure stops the run with remaining source IDs unattempted. No game process memory, patch, injection, proxy certificate or TLS exception is involved.

The initial probe exposed two implementation details before success: an assumed POST was wrong (confirmed by the endpoint virtual slot), and a generic UUID did not match the client's nonce envelope. Those failed probes produced no rate data and are not included as disclosures. The correctly reproduced GET then succeeded. A Windows reader lock later interrupted one atomic manifest rename; bounded replacement retries and preservation of the last complete manifest make resumption safe, with the pending valid observation recovered.

The accepted response envelope is `{ts?, result:{n?, kinds:[{n?, f?, k:[{n?, v, p?, s?, t?, d?, br?, dri?}]}]}}`, plus the proven empty `result:{}` form. Unknown fields are rejected without persisting their values. Group/row order, names, featured flags, numeric value lexemes, prefixes, kind-info indexes, reward Type/Data, bonus IDs and rarity indexes are preserved. No category is expanded into equally likely champions, no Nexus formulas are applied and no missing labels/rows are fabricated. Kind-info-only rows remain raw indexes until a separately proven lookup supplies their label.

`v` uses **percentage points** in the observed responses. `scripts/calibrate_mcoc_crystal_odds.py` compares unscaled raw values against the exact same source's reviewed UI rows. All **16 of 16** comparisons passed across Alliance, Cavalier and featured v33, including 0.05 → 0.05%, 4.95 → 4.95% and 30 → 30.00%. The ignored `calibration-live/ui-api-calibration.json` receipt binds every API response SHA to its UI screenshot SHA and both timestamps. The tests explicitly reject treating 0.25 as the disclosure for a UI's 25.00%.

Groups are independent disclosures, not pieces of one combined 100% distribution. For example `greater_banquet_crystal_dec23` returns PRIZE 1 (24 rows totaling 100.00%), PRIZE 2 (Gold, 100%) and PRIZE 3 (ISO-8, 100%). The superior December 2025 crystal returns five groups. The collector and UI reader preserve these boundaries and intentionally do not normalize the sum across groups.

The bulk artifacts are observations through one authenticated game session, with no player state exported. The request proves the server's disclosure for that exact opening at that time; it does not prove that stateful box/pity odds are identical for every player, that a historical definition is purchasable today, or that a disclosed category identifies one champion. A missing response is not a 0% reward chance. `empty_disclosure`, `http_not_found`, `server_error`, `schema_unreviewed`, authentication/transient failures and `unattempted` remain distinct.

The public `src/data/game-crystal-odds/catalog.json` sidecar contains only exact-source status/attempt metadata and validated odds fields. `src/domain/crystal-odds.ts` validates the source hash, totals of status counts, attempt coverage, percentages, order and required evidence. `getCrystalOdds(sourceId, expectedGachaSha)` returns null on a snapshot mismatch; it cannot silently attach current odds to November 3 membership. The current full all-reward opening catalog can use the matching November 5 hash.

### Final bulk coverage receipt

The primary sweep observed responses from `2026-11-05T15:31:10.774961+00:00` to `2026-11-05T15:59:17.674385+00:00`. Source-set equality and the raw gacha hash were independently checked after completion. All retained responses were revalidated as odds-only JSON. The ignored `bulk-live/coverage-receipt.json` records this verification.

| Final observation | Count |
| --- | ---: |
| Exact source IDs attempted / recorded | 2,448 / 2,448 |
| Nonempty disclosures | 1,093 |
| Empty disclosures | 1,355 |
| Unattempted / unresolved failures | 0 / 0 |
| Primary collector attempts, including retained parser-review retries | 2,566 |
| Disclosed groups / rows | 1,418 / 4,768 |
| Rows with server reward Type/Data | 1,040 |
| Rows with a bonus-reward ID | 92 |
| Rows without an explicit nonempty label | 5 |

The five unlabeled rows all belong to `t3_class_alloy_frag_relic_crystal_25p`. Their server response supplies empty labels and no Type/Data or kind-info index. The sidecar preserves their percentages without assigning class identities by position; presentation must identify them generically as unnamed outcomes. Other captured rows have explicit labels. Missing disclosures remain unknown, including any recorded trophy or historical source for which the server returned no odds.

The final public sidecar is 3,199,510 bytes, SHA-256 `0de0f3759cc82d2ae13a003b7e513f78f0520d88df792d3d6ebce0b2a43ebe46`, bound to gacha SHA-256 `c4873c0f509665e6f32a18be3c57d8c91887c1122e7a9b8b3e3423805922de3e`. Priority and calibration observations are retained in its attempt history under their exact source IDs; they do not create aliases or additional source definitions.

Examples relevant to rare rewards: greater Banquet Grace December 2025 PRIZE 1 discloses 5-/6-/7-star rare champion selectors at 2.01% / 0.43% / 0.04%; Jubilant December 2025 separately discloses its 7-star rare champion selector at 1%; superior Banquet Grace December 2025 separately lists Jubilant Crystal at 7.77%. Those are selector or nested-crystal outcomes. No chained probability or individual trophy-champion percentage is derived from them.

Final verification passed all 51 crystal Python tests and all six odds domain/UI tests. The latter validate the actual published snapshot, exact-hash behavior, independent group rendering and percentage-point formatting.

## Guarantees and player state

The exact static binding is:

`source GachaBox.Name → PityTemplate → PityGroups[] → PayoutLimit + description templates + PityTags[]`

`PityTemplate` is field 59 of GachaBox. PityGroup's PayoutLimit is field 2; its descriptions are fields 3/4 and tags field 5. The templates/descriptions are suitable recorded metadata. They do **not** disclose the full server trigger, replacement-selection or reset algorithm. `GachaManager.GetPityCount`/`ApplyPityUserData` read separate user counters; remaining progress is not in this static artifact. Tags can be shared, so one must not assume a separate counter per display name.

For `pfh_gwenom_en_pointe_crystal`, the source template `pfh_gwenom_hcos` binds three groups:

| Group | Recorded limit | Description's stated target |
| --- | ---: | --- |
| `pfh_gwenom_7star_featured_hero_hcos` | 150 | 7-star Gwenom |
| `pfh_gwenom_7star_plus_hcos` | 35 | A 7-star champion |
| `pfh_gwenom_6star_plus_hcos` | 5 | A 6-star or better champion |

Their exact tags end in the source spelling `fantasic4`; the extractor preserves them instead of repairing or inferring an event relationship. These are recorded rules for that definition, not live availability or a statement that a player currently has 150/35/5 openings remaining. A pity group named `empowered_grace_crystal` separately records limit 120 and a description of a level-1-ascended 7-star champion.

Box-gacha metadata needs its own view. The historical `super_duper_gamestore_box` has `IsBoxGacha=true`, OpenLimit 6, and six prize categories. Staff described its launch mechanic as excluding already acquired champions until all six were obtained, with ascension materials alongside the champion. See [Everything About 7-Star Ascension (So Far)](https://forums.playcontestofchampions.com/en/discussion/411731/everything-about-7-star-ascension-so-far). This is a concrete counterexample to treating every opening as an independent uniform roll. That launch explanation does not establish today's six-champion rotation or an individual player's remaining box contents. Current source metadata additionally has manual-reset flags/items for some other box definitions; preserve those IDs and do not infer that all boxes permit resets.

## Cluster Drops and non-champion rewards

The static join is exact and useful:

`box.categoryIds → GachaCategory.Items[index].ContextProto['bonusReward'] → BonusReward.Name → Redeemers[] + AutoAscend`

The 218 bindings occur on 196 `hero`, 11 `hcos`, 6 `inv` and 5 `sra` category items. None in this snapshot is attached to an `ebpf` or `bp` item. These are conditional associations with a reward entry, not an extra unconditional award on every crystal opening.

Example: category `super_duper_hitmonkey_2026` has a `hero` entry `hitmonkey_t7` whose context points to `super_duper_hitmonkey_2026_clusterdrop`. That bonus defines one `ascension_token_champion_hitmonkey`, one `ascension_token_class_trained` and `AutoAscend=true`. The normalization keeps these facts together. It does not promise that those tokens remain in inventory after automatic ascension consumes applicable materials; the ascension investigation supplies eligibility/cost/resource meanings.

Non-champion category entries are retained separately, including resource, inventory, blueprint/selector and nested-crystal forms. Their Type/Data identities and original entry indexes are preserved, with Quantity and MinQuantity/MaxQuantity kept distinct. Nested `bp`/`ebp`/`ebpf` data is not expanded into direct champion membership. Bonus redeemers additionally include reviewed `utitle` and `profilebadge` types.

One source anomaly is explicit: category `ave_map5_crystal_20_0_1` has `ebpf:epic_mutant` with MinQuantity 600 and MaxQuantity 500. The extractor records `quantityRangeStatus: reversed_in_source`; it neither swaps the bounds nor advertises a valid reward amount.

## Trophy champion examples and presentation

The existing November 3 application snapshot already establishes these direct membership examples; it does not establish their rates:

| Champion identity | Representative source definitions | Recorded stars |
| --- | --- | --- |
| `kang` | `greater_gifting_crystal_dec19`; `greater_banquet_crystal_dec23` | 4/5/6; 7 respectively |
| `thanos` | `greater_gifting_crystal_dec20`; `greater_banquet_crystal_dec23` | 4/5/6; 7 respectively |
| `wolverine_weaponx` | `6star_glorious_games_crystal`; `6star_glorious_games_nexus_crystal` | 6 |
| `ironfist_white` (Immortal Iron Fist) | `2_star_99sig_crystal` through higher Max Signature variants | 3 in the 2-star-named crystal; 4/5/6 in higher variants |
| `colossus_unstoppable` | `alliance_crystal` | 2/3/4 |

The Immortal Iron Fist example is why rates and reward stars must join to actual blueprint identities, not crystal-name star suffixes. A special champion in a category with many ordinary resources is not equally likely to each other list entry. The six-member `7star_loyalty_crystal` similarly establishes membership only; 1/6 is not extracted evidence of a 16.67% champion rate.

Recommended UI separates:

1. Recorded possible champions at exact stars, which CereBro already has.
2. Recorded guarantees and conditional Cluster Drops, tied to the exact source opening and labeled by snapshot.
3. Disclosed numeric rates only when a source capture or dated official publication proves the relevant box, reward tier, bonus and grouping. Missing is Unknown, not 0%.
4. Player-specific pity/remaining-box progress, which must remain absent until there is an authorized source of that state.

Keep member-pool identity separate from opening/odds identity. Standard, Nexus and Epoch may share champions while having different selection behavior; same contents never proves equal odds. A Nexus target probability such as `1-(1-p)^k` would require separately established independent draw/replacement rules and applicable per-draw p. The current sample count is insufficient.

## Reusable extraction and validation

New files:

- `scripts/extract_mcoc_crystal_rules.py`: schema-driven raw-cache extraction; validates named contracts and all category/template/group/bonus references; source-ID projection; no network access.
- `scripts/test_extract_mcoc_crystal_rules.py`: seven behavioral tests covering exact bindings, quantity ranges, repeated contexts, cosmetic bonus items, missing references, duplicate IDs and unreviewed types, invalid limits/selection, and source anomalies.
- `scripts/import_mcoc_crystal_odds.py`: no-network importer for reviewed game-UI transcriptions; checks raw-source hash, unique title/description/tab binding, timestamps, PNG content hashes and relative paths, rate precision/prefixes, completeness and displayed totals. It preserves nested Nexus outcomes and never computes individual champion odds. Image contents require manual review; PNG/hash checks establish artifact integrity, not OCR correctness. Its flat row contract intentionally covers the three observed single-group panels; grouped/conditional disclosures need an explicit contract extension before capture.
- `scripts/test_import_mcoc_crystal_odds.py`: seven synthetic-fixture tests covering exact opening binding and alias ambiguity, separate Nexus rewards, partial disclosures, bounded/rounded percentages, evidence integrity/path traversal, unexpected fields, observation timestamps and invalid totals. Synthetic percentages exist only in tests.
- `scripts/collect_mcoc_crystal_odds.py`: legitimate existing-session read-only collection, strict grouped parser, resumable all-ID coverage, isolated safe response artifacts and per-ID normalization; optional Windows dependencies are pinned in `scripts/requirements-live-crystal-odds.txt`.
- `scripts/publish_mcoc_crystal_odds.py`: validated public projection; additional priority/calibration captures can merge only when host, gacha hash and exact IDs agree, without writing to the running collection manifest.
- `scripts/calibrate_mcoc_crystal_odds.py`: actual-source API/UI scale calibration and hashed evidence receipt.
- `scripts/test_collect_mcoc_crystal_odds.py` and `scripts/test_calibrate_mcoc_crystal_odds.py`: synthetic boundary tests for grouping, exact IDs, decimal precision, unsafe fields, status coverage, resumption, rate/auth failures, safe publishing, Windows read locks and scale validation.
- `src/domain/crystal-odds.ts`, `src/domain/crystal-odds.test.ts`, and `src/data/game-crystal-odds/index.ts`: validated exact-opening application reader and hash-safe lookup.

Ignored investigation artifacts:

- `temp/crystal-odds-investigation/rules-current.json`: raw-verified current snapshot, source `c4873c…`, observed November 5. `numericOddsStatus` is `not_in_static_catalog`.
- `temp/crystal-odds-investigation/rules-legacy-decoded.json`: separately marked `legacy_decoded_json`, with its decoded JSON SHA and `rawBindingVerified:false`. It is evidence for comparison, not a publishable raw-verified sidecar.
- `temp/crystal-odds-investigation/live/transcriptions.json`: manually reviewed genuine UI rows, exact source identities and screenshot evidence references; no account/session information.
- `temp/crystal-odds-investigation/live/disclosures.json`: normalized, source-verified result containing three complete disclosures and 16 category rows. Every PNG reference is content-hashed.
- `temp/crystal-odds-investigation/bulk-live/coverage.json`, `responses/` and `normalized/`: complete source-ID coverage manifest plus only contract-validated genuine API responses and normalization. Failed/unreviewed raw bodies are not persisted.
- `temp/crystal-odds-investigation/priority-live/`: the 11 priority Banquet/Jubilant/main/Titan captures.
- `temp/crystal-odds-investigation/calibration-live/`: three exact-source API captures and their 16-row UI comparison receipt.

Reproduce the current artifact with the existing schema:

```powershell
python scripts/extract_mcoc_crystal_rules.py --gacha 'C:/Users/ossul/AppData/LocalLow/Kabam/Champions/gacha/out/v1/A29758BCA3552F42481F416859DD53E4BE131265.bin' --schema temp/crystals/schema.json --observed-at '2026-11-05T14:05:24+00:00' --out temp/crystal-odds-investigation/rules-current.json
python -m unittest discover -s scripts -p test_extract_mcoc_crystal_rules.py
```

Reproduce the genuine-disclosure artifact from its retained transcriptions and sanitized evidence:

```powershell
python scripts/import_mcoc_crystal_odds.py --captures temp/crystal-odds-investigation/live/transcriptions.json --gacha 'C:/Users/ossul/AppData/LocalLow/Kabam/Champions/gacha/out/v1/A29758BCA3552F42481F416859DD53E4BE131265.bin' --schema temp/crystals/schema.json --evidence-root temp/crystal-odds-investigation/live --out temp/crystal-odds-investigation/live/disclosures.json
python -m unittest discover -s scripts -p test_import_mcoc_crystal_odds.py
```

Expected importer summary for this exact source: `disclosures: 3`, `rows: 16`, `sourceGachaSha256: c4873c0f509665e6f32a18be3c57d8c91887c1122e7a9b8b3e3423805922de3e`. A later game-cache refresh must fail this reproduction until the source binding is reviewed; do not change the expected hash just to make it pass.

Resume legitimate bulk collection using the existing local session (no token argument or credential file):

```powershell
python -m pip install -r scripts/requirements-live-crystal-odds.txt
python scripts/collect_mcoc_crystal_odds.py --gacha 'C:/Users/ossul/AppData/LocalLow/Kabam/Champions/gacha/out/v1/A29758BCA3552F42481F416859DD53E4BE131265.bin' --schema temp/crystals/schema.json --resources 'C:/Games/Marvel Contest of Champions/default/game/Champions_Data/resources.assets' --crypto-metadata D:/CodexArtifacts/Cpp2IL-2026-11-03-addresses/Kabam.Crypto.dll --out temp/crystal-odds-investigation/bulk-live --interval 0.25
python scripts/publish_mcoc_crystal_odds.py --captures temp/crystal-odds-investigation/bulk-live --supplemental-captures temp/crystal-odds-investigation/calibration-live --supplemental-captures temp/crystal-odds-investigation/priority-live --out src/data/game-crystal-odds/catalog.json
python scripts/calibrate_mcoc_crystal_odds.py --ui temp/crystal-odds-investigation/live/disclosures.json --captures temp/crystal-odds-investigation/calibration-live --out temp/crystal-odds-investigation/calibration-live/ui-api-calibration.json
python -m unittest discover -s scripts -p test_collect_mcoc_crystal_odds.py
python -m unittest discover -s scripts -p test_calibrate_mcoc_crystal_odds.py
pnpm exec vitest run src/domain/crystal-odds.test.ts
```

`--limit` supports bounded passes. A completed source status is skipped by default; an explicit repeatable `--retry-status schema_unreviewed` (or another listed status) retries reviewed cases while preserving the attempt trail. Never run concurrent writers against the same capture directory. Separate supplemental captures can run independently and merge through the publisher.

For a fresh schema, replace `--schema` with `--metadata <current-Cpp2IL-dummy-DLL-directory>` after installing the existing game-data requirements. Use the actual observation time of a new capture; do not copy the example timestamp to a different source. Original binaries, decompiled bodies and account state remain outside git. No application-data refresh or deployment is implied by producing this artifact.
