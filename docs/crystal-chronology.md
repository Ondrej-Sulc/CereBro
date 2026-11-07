# Crystal editions and recorded history

The cache supports conservative **named editions** and **normalized snapshot history**. It does not establish when a crystal was released, which client version introduced it, or whether it can be purchased today.

The separately reviewed availability sidecar adds recurring-pool and published
event-window labels without deriving obtainability from these chronology fields.
See [Crystal availability evidence](crystal-availability.md).

## Named editions

`src/domain/crystal-chronology.ts` exposes `getCrystalChronology(sourceIds)` and `compareCrystalsNewestFirst(a, b)`, where sortable entries have `{id, name, sourceIds}` and optional recorded `rarities`. Source IDs remain exact evidence; the parser does not inspect champion names or infer dates from champion release years.

- Explicit month/year tokens, such as `login_crystal_3_4_star_apr26`, `meta_dec2025_anniversary_collector_crystal`, and `nov2026_valiant_castellan_box`, yield named periods. Whitelisted year-only event editions, such as Banquet, Valentine's and Legends celebrations, preserve year-only precision.
- Several dated source aliases yield a named-period range. This describes the grouped source identities, not a release or sale window.
- `_vN` is a revision within its exact normalized source series. For example, `6fh_v49_shard_crystal` follows `6fh_v48_shard_crystal`; its revision number is not comparable with `paragon_crystal_v2` and is never an app version.
- Champion cohorts and collection ranges, including `cfh_2014_champions_provenance_crystal`, `5star_nexus_2016_2019_crystal`, and `fh_featured_2020_crystal`, do not become crystal dates. Ambiguous year-only curated celebration pools such as `7star_2025_celebration_crystal` also remain undated. Unrecognized year tokens remain unknown.

The comparator puts named periods first, newest named year/month first. Year-only precision follows exact months within the same year; this is a deterministic precision policy, not an assertion that its event happened earlier. Revision-only entries form alphabetical series groups with descending revisions inside each group. Equal editions and unknown dates prefer higher champion star ranges, then stable name/ID order. Main-pool editorial priority remains a separate UI decision.

Suggested badge tooltip: “Edition named in the recorded game definition; this is not a confirmed release date.”

## Browse order and monthly Login groups

The default `recommended` browse order ranks recorded champion star ranges
highest first (maximum star, then minimum star), with named edition order as the
tie-breaker. It does not imply release recency or present availability. Reward-only
crystals have no champion star rank and retain their relative edition order.
`sort=newest` explicitly selects named-edition chronology; `sort=name` selects
alphabetical order. Both choices survive search, filters and pagination. Main
pools retain their existing editorial order.

The original Incursion symptom came from equal 2023 labels falling back to names:
3-star names preceded 6-star names, and dated legacy pools preceded undated 7-star
pools. Higher-star recommendation fixes the latter without manufacturing dates;
star-level tie-breaking fixes the equal-edition case.

Login grouping is a browse projection, separate from verified equal-pool families.
After exact search, reward, star and availability filtering, definitions with
reviewed `login_crystal_<stars>_star_<month><year>` identities share one monthly
card. Each option links to its exact opening and keeps its own star range,
champions and rates. A single exact-ID match remains an ordinary crystal result.
Unrecognized definitions and unrelated equal display names are not grouped.

Grouping happens before pagination, so a month never splits across pages and the
client receives only the current page's small option projections. Result counts
and category counts use browse groups; the heading also shows the underlying
crystal count whenever grouping reduces it. Availability counts continue to
refer to exact crystal definitions. No source catalogs, dates or contents change.

## Evidence boundary for dates and versions

The Nov 5 all-reward export contains 2,448 crystal definitions. Every recorded `endTime` is `-1`; no definition supplies `boxVersion`. The recorded `setVersion` is the same opaque value, `8e54008038de52ea245036bea68de748`, across the three source sets. None supplies a usable introduction date or semantic game version. A cache observation date and an installed game's version also cannot date an individual crystal's release.

## Reproducible normalized snapshot history

`scripts/build_crystal_history.py` compares only the common fields retained by both catalog formats:

`name`, `sourceGroup`, `sourceSet`, deduplicated `categoryIds`, and category-bound direct champion tier IDs/verified `first_edition` bindings.

The projection is named `champion-catalog-common-v1`. Quantities, prices, numeric odds, resource rewards, conditional bonuses, pity rules, and artwork are outside this historical comparison because the older export did not retain equivalent fields. Newly exporting those fields is not evidence that the game changed them.

The generated `src/data/game-crystal-history/history.json` pins the normalized input bytes, canonical common projection, raw gacha identity, observation timestamp, and definition count for each observation:

| Observation | Definitions | Raw gacha SHA-256 |
| --- | ---: | --- |
| 2026-11-03 09:10:42 UTC | 2,437 | `087359950217387120337353cbb331eb733d9b49a2329db127634d307ae40dd6` |
| 2026-11-05 14:05:24 UTC | 2,448 | `c4873c0f509665e6f32a18be3c57d8c91887c1122e7a9b8b3e3423805922de3e` |

The resulting transition has **11 added source definitions, no removed definitions, and 12 normalized snapshot changes**. Seven changes concern the recorded Empire of Doom direct tier lists; five gold bounty boxes add category bindings. These are differences between normalized observations, not a claim that the server removed champions or changed current offers.

The original Nov 3 raw gacha file is unavailable for independent re-decoding. Its retained decoded artifact (`temp/crystals/decoded.json`, SHA-256 `bfe9a4551a7a8049941edccd2d82b392a88f0eb5ca1828c859f0d4cff3d6c211`) has exactly the same hero/hcos tier membership as all 3,284 Nov 3 normalized categories, with no missing categories or membership mismatches. This includes Gwenom in Empire of Doom at 2–6 stars. The catalog was subsequently regenerated to include verified first-edition hcos rewards. Normalization or decoder drift therefore remains a possible explanation for historical differences; hash-pinned normalized inputs make the actual comparison reproducible without overstating its meaning. The ignored decoded file is not published by this feature.

Generate the first retained transition:

```powershell
python scripts/build_crystal_history.py --previous src/data/game-crystals/catalog.json --current src/data/game-crystal-openings/catalog.json --out src/data/game-crystal-history/history.json
```

For a future refresh, retain both normalized inputs and append with `--previous-history <retained-history.json>`. The supplied previous observation must match the existing chain's latest observation, source hash, common projection hash, and definition count. This preserves the earliest recorded observation across refreshes. Re-annotating an input without changing its raw source, timestamp, or common projection does not create a new game observation.

`src/data/game-crystal-history/index.ts` exports `getCrystalHistory(sourceIds)`, `crystalHistoryObservations`, and `crystalHistoryChangeScope`. Known aliases return their earliest `firstRecordedAt`, latest `lastRecordedAt`, optional latest `lastChangedRecordedAt`, and per-source records. Unknown IDs return `null`. `presentInLatest` means present in the latest retained normalized cache; it does not mean on sale. Reappearing IDs retain their original first observation.

The domain reader rejects malformed provenance, duplicate identities, missing transitions, contradictory transitions, unsupported changed fields, broken known projection chains, and inconsistent definition counts. Display labels should say **“First recorded”** and **“Normalized snapshot change”**, never “Released” or “Updated in game.”

Validation:

```powershell
python -m unittest discover -s scripts -p test_build_crystal_history.py
pnpm exec vitest run src/domain/crystal-chronology.test.ts src/domain/crystal-history.test.ts src/data/game-crystal-history/index.test.ts --maxWorkers=1
```
