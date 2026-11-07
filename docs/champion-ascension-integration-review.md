# Ascension acquisition final integration review

Reviewed 7 November 2026 in the shared working tree. Existing unrelated edits
and untracked implementations were preserved. No commit, PR, deployment,
database mutation, cloud publication, new game capture or subagent was used.

## Outcome and review changes

The source-to-UI integration passes the consolidated checks below. One concrete
consumer regression was reproduced and fixed: the development-only champion
prototype still relied on the generic seven-star combat-stat fallback. After
Carina's inclusion, that intentionally conservative fallback is empty, so the
prototype's A1/A2 selections left Attack/Health unchanged. Its old A0–A5 buttons
also exceeded the recorded paths.

The prototype now consumes its already-supplied exact champion/star rules for
effects, clamping and selectable levels. Regressions in the existing
`champion-ascension-interaction.test.tsx` reproduce the failure before the fix
and verify Adam Warlock A2 (11,600 Health / 1,160 Attack from 10,000 / 1,000)
and Carina A1 (10,800 / 1,080), with their distinct caps. No generic fallback,
canonical cap, NPC classification or prestige calibration was broadened.
The main champion page already supplies exact rules. Owned roster normalization,
historical levels and prestige projection do not consume this generic combat
fallback; their existing regressions passed.

Files edited by this review:

- `.github/workflows/ci.yml`: six suite registrations in two existing steps.
- `web/src/app/champions/[slug]/prototype/[concept]/prototype-client.tsx`:
  exact-rule stat projection and build controls.
- `web/src/app/champions/[slug]/champion-ascension-interaction.test.tsx`:
  two regression cases in an existing suite.
- This handoff. Other implementation files were reviewed, not rewritten.

## Integration trace and boundaries

Canonical paths come from `src/data/game-ascension/catalog.json`, validated by
`src/domain/champion-ascension.ts` and the shared reviewed-event classification
registry. Only exact collectible `carina_white_t7` survives that exception:
max A1, one champion token plus one Cosmic token. Six-star Carina is unknown;
NPCs, legacy Magik and unbound tuning remain excluded. The artifact has 1,941
blueprints, 122 resources and 113 positive seven-star paths. The original audit's
112/81/31 result remains historical under its original non-event scope.

`src/data/champion-ascension-acquisition/{catalog.json,index.ts}` and
`src/domain/champion-ascension-acquisition{,-types}.ts` validate the reviewed
evidence independently of eligibility. The 26 audited mechanism dispositions,
two definition-only cases and separately guarded Carina mastery source remain
distinct. Carina's quest summary is not counted as another grant. All 22 static
store bindings retain exact reward identities, quantities, gates and limits;
the earlier independent capture comparison is reused as evidence.

`web/src/lib/data/champion-ascension-acquisition.ts` adds exact display names and
published artwork to the selected champion's projection. Clients use its types
companion. Missing names/art remain null with text/icon fallbacks. No full
ascension acquisition or crystal catalog enters the champion-page client.

Finder `loadCrystalFinder` supplies this projection only for a selected champion
in Ascension focus. Its eligibility options use canonical per-star arrays;
routes and token rewards never grant eligibility. The existing selected-star
`/api/champions/[slug]/ascension-sources` endpoint resolves the slug to gameId,
retains the crystal DTO and adds the separate `acquisition` payload. The champion
page still requests it lazily from How to obtain. Both destinations use
`web/src/components/champion-ascension-acquisition.tsx`.

The review and passing suites verify these contracts:

- Unsupported seven-star Hulk, eligible six-star Hulk and All-stars 6/5/4 paths
  remain distinct. Carina works in Finder without a database champion row.
- Arnim Zola and Sigil Witch definitions do not count as methods. Cable,
  original Deadpool and Scream retain neutral missing-source copy. Zero/one/many
  method and crystal-binding counts remain separate from upgrade costs.
- Historical, upcoming, inside-window and undated evidence stay distinct.
  Medusa's November 20 offer is upcoming at the November 7 reference; its A3
  announcement does not extend the canonical A2 cap. Reclamation has no invented
  weekly order/payout. Magik's published prices and static contents, and Chavez's
  differing evidence versions, remain separate offers.
- Lower dust/gold recipes come from exact paths. Their generic
  `/crystals?reward=ascension` link is intentional: browse search does not match
  exact reward IDs. It does not promise a named champion token.
- Crystal star/category/reward/bonus identities, conditional quantities,
  acquisition versus pieces versus ascension, return links, lazy fetch/retry,
  stale-response handling, Clear and keyboard selection retain coverage.
  Crystal keys preserve complete bindings; method IDs, per-star keys and
  `useId` headings remain distinct. All-stars paths wrap, and method/offer
  details remain collapsed until opened.

## CI registration and validation

The existing **Verify game-backed ascension rules and roster updates** step adds:

- `src/domain/champion-ascension-classification.test.ts`
- `web/src/lib/data/carina-ascension-eligibility.test.ts`

The existing **Verify champion acquisition sources and presentation** step adds:

- `src/data/champion-ascension-acquisition/index.test.ts`
- `src/domain/champion-ascension-acquisition.test.ts`
- `web/src/lib/data/champion-ascension-acquisition.test.ts`
- `web/src/components/champion-ascension-acquisition.test.tsx`

Each appears exactly once. Removing just these six arguments recovers the exact
pre-review workflow text, preserving all prior seven-suite/three-suite additions,
other CI coverage, quoted bracketed paths and `--maxWorkers=1`. No job was added.

Final local results:

- **446 tests passed in 61 files**, zero failures/skips: the deduplicated explicit
  suites in the ascension/roster, crystal extraction/browsing and acquisition CI
  commands, plus `src/domain/crystal-ascension-rewards.test.ts` and
  `web/src/lib/crystal-ascension-bonuses.test.ts`. Command:
  `pnpm exec vitest run <the 61 paths> --maxWorkers=1 --testTimeout=15000 --reporter=json --outputFile=temp/ascension-final-integration/results.json`.
  The exact argument manifest, runnable PowerShell command and JSON result are
  preserved in ignored `temp/ascension-final-integration/{suites.json,run-tests.ps1,results.json}`.
  The local timeout accommodates cold catalog loading; CI timeout settings were
  preserved. A missing-portrait-metadata warning is an exercised fallback.
- Focused TypeScript passed, exit 0 with no diagnostics:
  `pnpm exec tsc -p temp/ascension-final-integration/tsconfig.json --noEmit`.
  This extends the web config and includes the changed prototype, interaction
  suite, Next declarations and their transitive imports; Node heap capped at 3GB.
- Scoped ESLint passed, exit 0, zero errors/warnings in the two changed web
  files: from `web`, `pnpm exec eslint 'src/app/champions/[slug]/prototype/[concept]/prototype-client.tsx' 'src/app/champions/[slug]/champion-ascension-interaction.test.tsx'`.
  It emitted only the existing baseline-browser-mapping data-age notice.
- **14 Python tests passed**: `python -m unittest discover -s scripts -p test_extract_mcoc_ascension.py`.
  This includes deterministic offline projection/provenance checks; no game
  capture or catalog regeneration was performed by this review.

The canonical-fix agent's full web TypeScript process 43944 finished exit 0 with
no diagnostics. That pass covers the shared integration before the final small
UI label/count edits; subsequent component tests/lint cover those edits. This
review's material prototype change receives the fresh scoped check above.
The final data agent's root/core TypeScript pass is also reused. No duplicate
full-web check/build was launched against the memory-heavy shared Next process;
the earlier UI 3GB OOM is not treated as a passing typecheck. This review does
not claim a fresh full-monorepo typecheck or build.

## Provenance and remaining limits

Eligibility retains November 3 observation and its original BCG hash; crystal
rewards retain November 5 observation. Carina's exact source remains
`epilogue_ch04_q04.masteryCompletionRewards`, captured November 5 at
06:49:32.001200 UTC, SHA-256
`ebe5e7f2d5fbc759dbeb08d30ca174c7941c13ae4e2c81f545fb0b97c7694aa3`.
November 7 is evidence review, not a new stock observation. API responses may
cache for 300 seconds with 3,600 seconds stale-while-revalidate; champion metadata
has its existing cache. Published periods, static limits and enabled definitions
do not establish current stock, account access, affordability or server acceptance.

No browser checks were repeated by this review. The UI agent previously observed
Magik in Finder and How to obtain on desktop/mobile, keyboard disclosure,
official links/material art, Medusa upcoming, Blade's unknown week and Hulk's
All-stars dust paths. Those prior observations are documented in
[the UI handoff](champion-ascension-acquisition-ui.md), including slow hydration
that recovered and closed review tabs. They are not new observations here or
causal evidence of a new performance regression. Earlier Adam Warlock champion
multi-source visual coverage and signed-out roster visual limits remain as
recorded in the prior discovery/integration audits.

No required implementation work remains after the validation results above.
Future source refreshes still need exact objective/week/offer contracts and live
availability evidence before upgrading the documented uncertainty states.
