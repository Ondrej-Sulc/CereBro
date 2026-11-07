# Seven-star Ascension final integration review

Reviewed 7 November 2026 in the shared working tree. This review covers the
catalog/roster, Finder/How to obtain and crystal-browse scope corrections together.
Historical counts and browser observations in earlier audits remain historical.

## Finding and review edits

One concrete defect was reproduced: returning to a catalog with remembered
enabled eligibility and an orphaned `ascensionScope` parameter re-enabled the
filter and rewrote the link as enabled. Orphaned URL state must remain off.

- `web/src/hooks/use-ascension-eligibility-filter.ts`: orphaned scope overrides
  enabled memory and clears it; existing local pending changes retain precedence.
- `web/src/app/profile/roster/components/roster-eligibility-filter.test.tsx`:
  three regressions for remembered eligibility plus orphaned `all`, `seven-star`
  or invalid scope, including URL/hash preservation and subsequent memory restore.
  All three failed before the fix; the existing 18 cases stayed green.
- `.github/workflows/ci.yml`: exactly two suite arguments added, described below.
- This handoff. Other production implementation and source artifacts were reviewed,
  not changed by this review. Existing unrelated dirty/untracked work was preserved.

## Integrated contracts reviewed

`roster-filtering.ts`, its alliance adapter, the shared toolbar/sheet/rules,
`roster-view.tsx`, catalog/player pages and alliance callers share canonical
positive seven-star eligibility. Catalog cards require obtainable/selected seven
stars; owned entries require an actual seven-star copy. An incompatible selected
rarity yields zero results. Current Ascension levels remain independent, including
already ascended copies. No crystal/source presence supplies eligibility.
Legacy enabled generic/all/Dust URLs and memory migrate to seven stars; false,
invalid and orphaned states stay off. Tests exercise delayed Next snapshots,
streaming normalization after removal, toggle/rule/reset, Back/Forward and sharing.

The surgical `web/src/lib/data/crystals.ts` changes coexist: Finder forces
seven-star Ascension before reading sources, while browse projects the exact
qualifying opening. The page redirect, URL builder and saved-return normalization
preserve identity/search/pagination; normal lookup retains lower/all-star choices.
Unsupported seven-star Hulk remains selected with recovery, distinct from normal
six-star Hulk. Gwenom and source-gap identities remain selectable; Carina keeps
max A1 and `epilogue_ch04_q04.masteryCompletionRewards` without a database row.

`champion-ascension-sources.tsx`, the shared acquisition component and champion
navigation retain lazy loading, abort/retry/stale-response handling. Lower-star
How to obtain mounts no source section and requests no ascension endpoint; normal
acquisition and the generic selected-star API remain covered.

The browse classifier/index and loader require exact seven-star tokens, bound
seven-star bonuses or the six reviewed token bundles. Generic dust and unresolved
lookalikes do not qualify. The divergent-family regression verifies matched-opening
name, primary art, summary, selection and detail link, category/availability
intersection, search isolation and displayed-name sorting. Navigation regressions
retain that exact Nexus link and browse filters/scroll on return. Normal materials
browsing, complete detail rewards/odds and canonical lower-star data remain covered.

Exact source IDs, reward indices, quantities, conditional bindings, published art
and independently dated provenance remain intact. Seven-star A2 retains dust and
gold; discovery is not token-only. No new availability/claimability inference or
hypothetical acquisition route was added.

## Saved screenshot assessment

This reviewer actually opened the original attachment and all six supplied
browser-artifact PNGs. These are saved evidence, not fresh browser checks:

- Original `attachments/3b60eb8b-d69c-429a-9703-7885fa91867e-7cdd35d3-0d97-465e-8d8c-94d060439501.png`:
  the isolated native checkbox/helper paragraph consumed a separate block below
  active rules and disconnected eligibility from rarity.
- Catalog `browser-screenshot-localhost-mw69e3d7-9bc4dbd9.png` (desktop) and
  `browser-screenshot-localhost-mw69eptn-5f2d714e.png` (tablet): compact toggle
  stays grouped with rarity/classes; selected fill/border is distinct; active
  rule is readable. Tags/ability controls follow directly, with aligned two-column
  tablet wrapping and no obsolete checkbox/helper/progression block.
- Catalog `browser-screenshot-localhost-mw69ck0c-a7a96ed0.png` (390) and
  `browser-screenshot-localhost-mw69ls9x-dbbd9440.png` (320): toggle shares the
  sorting row, its label stays on one line, and active rules/Clear all remain
  legible without visible clipping. The mobile toggle has a generous hit area;
  source confirms `h-11` (44px). These still images do not establish touch behavior.
- Roster `browser-screenshot-localhost-mw69fx77-200e5f45.png` (desktop): Rank,
  Ascension level and eligibility are separate controls on one aligned row.
  `browser-screenshot-localhost-mw69gfgg-37adce7a.png` (mobile): eligibility sits
  below level choices inside the Roster sheet; the fixed result action remains
  visible. The floating development indicator overlaps the lower-left Clear all
  area in this saved image; it is not evidence of production filter layout overlap.

All artifact filenames above are under
`C:/Users/ossul/.t3/userdata/browser-artifacts/`; the original is under
`C:/Users/ossul/.t3/userdata/`. No visual defect requiring a new browser session was
found. Prior Finder/How to obtain browser checks remain attributed to
`champion-ascension-acquisition-ui.md`, not claimed as this reviewer's observations.

## CI registration and validation

- Existing **Verify crystal extraction and champion pool browsing** command:
  adds `web/src/app/crystals/champions/page.test.tsx`.
- Existing **Verify full crystal rewards, odds and chronology** command:
  adds `web/src/lib/data/crystal-seven-star-browse.test.ts`.

Each appears once. Removing just these two arguments reproduces the review-start
workflow byte-for-byte. All prior coverage, including the six source-data/Carina
suite registrations, quoted paths, worker settings and jobs is preserved.

Fresh local validation after the integration fix:

- **639 tests passed across 93 files**, zero failures/skips, one worker, 176.3s.
  The manifest deduplicates the existing ascension/roster, crystal browsing,
  acquisition, rate presentation, full rewards and availability CI commands,
  plus shared roster/alliance/rule/collection tests. Both pending suites and all
  six source-data/Carina suites are included. The expected missing-portrait
  metadata warning exercises a fallback.
- Consolidated scoped TypeScript passed, exit 0, no diagnostics:
  `pnpm exec tsc -p temp/ascension-seven-star-integration/tsconfig.json --noEmit`,
  with `NODE_OPTIONS=--max-old-space-size=3072`. Its 54 explicit files and
  transitive imports cover all three production paths and affected tests,
  including the catalog/player/alliance callers. The first temporary config
  omitted existing ambient declarations and reported auth-session type errors;
  adding `web/src/types/*.d.ts` to the check configuration resolved them without
  changing production auth code. The corrected check ran after the tests.
- Consolidated scoped ESLint passed over 48 web files, exit 0, zero errors and
  14 existing unused-field/image/alt warnings in test fixtures. Both web files
  modified by this review have zero warnings. The baseline-browser-mapping
  data-age notice is unchanged. Lint ran after TypeScript.

Exact runnable commands, suite/lint manifests, scoped config, JSON results and
logs are preserved in ignored `temp/ascension-seven-star-integration/`:
`run-tests.ps1`, `suites.json`, `results.json`, `tsconfig.json`, `tsc.log`,
`run-lint.ps1` (run from `web`), `lint-files.json`, `eslint.json` and logs.
Removing only the two new CI arguments was checked against `ci.before.yml`.

## Boundaries and limits

No commit, PR, deployment, database mutation, cloud write, game capture, product
asset, subagent or new browser session was used. No user/shared process was killed.
Saved screenshots establish the depicted layout only; they do not prove keyboard,
touch, live overflow or hydration behavior. Those interactions have focused test
coverage and separately attributed prior browser evidence. Eligibility retains
November 3 evidence and opening rewards November 5 evidence; this review adds no
fresh live-stock observation. No broad build or fresh full-web typecheck is claimed.

No required integration work or blocking finding remains.
