# Elder Web of Corruption drop-rate total review

Reviewed 7 November 2026 against the running page
`/crystals/elder_web_of_corruption_saga_crystal?returnTo=%2Fcrystals%3Freward%3Dascension`.

The defect was presentation: a complete source prize group was split across two
places. Its ordinary champion categories moved into the star-filter buttons;
its Ascended Champion and shard categories remained in Rewards & drop rates.
The latter looked like a complete disclosure but totaled only **72.97%**.
The star buttons contained the other **27.03%**. No source rows or rates were lost.

## Exact category math and evidence

One unnamed group, source index 0, `isFeatured: false`, contains these four rows
in this order. Python `Decimal` arithmetic on both the original JSON values and
the imported percentage strings gives **100.00%**. The displayed values have the
same decimal precision, so rounding does not account for the perceived shortfall.

| Original source label | Captured value | Before | After |
| --- | ---: | --- | --- |
| 7-Star Ascended Champion | 4.05% | Rewards & drop rates | Rewards & drop rates |
| 7-Star Hero | 9.01% | Star filter | Rewards & drop rates |
| 6-Star Hero | 18.02% | Star filter | Rewards & drop rates |
| 7-Star Hero Crystal Shards | 68.92% | Rewards & drop rates | Rewards & drop rates |

There are no prefixes, additional source groups, featured subgroups or numeric
guarantees in this exact response. These are category rates, not individual
champion rates. The recorded static opening binds four possible-reward categories:
1 shard entry with an exact amount of 1,000, 39 six-star champion entries,
30 ordinary seven-star entries and 8 seven-star entries with automatic-ascension
bonus bindings. The two seven-star blueprint sets are disjoint in this snapshot.
The 4.05% category is separately disclosed; the 9.01% label must not be presented
as the chance of *every* seven-star outcome. No division across their champion
counts, rate multiplication, remainder assignment or renormalization is justified.

The eight ascension bindings each grant the recorded champion token and matching
class token on their qualifying champion outcome. They are additional rewards
conditioned on that outcome, with no separately disclosed probabilities to add
to this total. The static opening has no pity binding or finite-box rules.
Its internal `minItems=maxItems=1` is not used to infer probability structure.

The genuine saved API response was observed at
`2026-11-05T15:44:25.766785+00:00`, HTTP 200, 209 bytes:

- Capture: ignored `temp/crystal-odds-investigation/bulk-live/responses/fac35a6ada983f1cff8db573ab9313684314faf9a7a5bafe1055f015174992b9.json`.
- Response SHA-256: `9991879962a422a267543426d03efaf722d9d52171f78e319bd6c97704d0679a`.
- Static gacha SHA-256: `c4873c0f509665e6f32a18be3c57d8c91887c1122e7a9b8b3e3423805922de3e`.

The saved response hash matches its manifest, normalized capture and public
sidecar. Re-running `sanitize_odds_response` and `normalize_odds` in memory gives
identical imported groups, row order, labels and percentage strings. The static
archive was independently hashed and matches the opening and odds sidecars.
`loadCrystalPageRewards` selects this exact opening and calls
`getCrystalOdds(id, opening.source.gachaSha256)`; a family or another edition
does not provide its rates. `returnTo`, champion search, stars and class filters
do not enter that lookup.

## Reusable fix and controls

`buildCrystalRewardPresentation` now moves only **whole champion-only source
groups** beside the pool. Mixed groups keep all their original rows together in
Rewards & drop rates. The original evidence remains immutable, and source
group/row keys remain unique. No component layout, artwork or import schema
change was necessary. Complete ordinary champion-only groups still support
star-filter annotations; ambiguous bindings retain their existing fallback.

The saved-source audit additionally checked these controls:

- `7_star_hero_shard_crystal`: one 100% champion category; compact guarantee retained.
- `cfh_v33_shard_crystal`: 8.9% + 44.8% + 46.3% = 100.0%; complete champion-only star annotations retained.
- `paragon_crystal_v2`: six categories in one 100.00% group, including two exact Nexus crystal drops; now shown together.
- `superior_banquet_crystal_dec24`: Prize 1 totals 100.00%; separate Gold and ISO Prize 2/3 categories are each 100%. Those independent groups are not one 300% distribution.
- `superior_banquet_crystal_dec25`: five separately named prize groups each total 100%; repeated shard prizes retain their own amounts.
- `greater_banquet_crystal_dec25`: four separately named groups each total 100%; the mixed first prize is no longer split.
- `pfh_lady_deathstrike_cyberpathy_crystal`: Featured Prizes total 14.79%, All Prizes total 100%. The featured champion rows are a named subset of the all-prize rarity categories, not an extra independent 14.79% prize. Both original groups, names and flags remain intact; neither is renormalized.
- `elder_web_of_corruption_box`: its distinct 13-row group totals 100.00%; it was a control only, never a replacement for the saga opening's evidence.

The ignored reproducibility script
`python temp/crystal-rate-total-review/audit_sources.py` validates saved raw
response hashes and exact normalized groups for the target and eight controls and writes only
its own `source-audit.json`. It makes no network request.

## Validation and limits

The new exact-crystal and mixed-group regressions were run against the old
implementation first: seven assertions failed on the real split (only keys
`0:0` and `0:3` were in the rewards section, or a source group appeared in both
projections). Tests use the real catalog and presentation pipeline, with database
and Next.js boundaries mocked for deterministic component tests.

Browser review confirmed all four original labels/rates together at desktop and
390-pixel phone width, with no horizontal overflow in the reward list. Selecting
7 stars, Science and Lizard left all four rates unchanged and retained the
Ascension browse return link. The browser review used an owned Preview tab,
returned to the exact original URL and closed that tab afterwards. No duplicate
DOM IDs were found; the component regression also checks for duplicate React keys.

Validation run sequentially:

- 111 passing tests across 12 files: the existing CI rate-presentation command,
  plus `crystal-pages.test.tsx` and `crystal-filters.test.tsx`, with `--maxWorkers=1`.
- 53 passing tests across six surrounding files: odds/opening domains, opening
  catalog reader, crystal data loader, opening pages and unified routes, also
  with `--maxWorkers=1`. Total: 164 passing Vitest cases across 18 files.
- `python -m unittest discover -s scripts -p test_collect_mcoc_crystal_odds.py`:
  10 passing collector/publisher tests.
- `pnpm --dir web exec tsc --noEmit --incremental false`: passed.
- Scoped ESLint on the presentation helper and three changed test files:
  no errors; nine existing warnings in Next.js image/link mocks.
- Saved raw/normalized/sidecar audit for nine exact openings: passed, including
  source hashes, labels, row/group identity, prefixes and exact decimal totals.

The new regressions extend suites already listed in `.github/workflows/ci.yml`;
no CI suites or commands were replaced.

These are the existing November 5 disclosures, not a fresh game capture or a
claim about current store stock, individual champion weights or the underlying
sampling algorithm. The existing raw evidence, manifests and catalogs were not
rewritten. No crystal was bought or opened, and no commit, PR or deployment was made.
