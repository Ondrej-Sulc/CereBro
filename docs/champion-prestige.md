# Champion prestige projection

## Formula and rounding contract

`web/src/lib/mcoc-prestige.ts` is the shared projection boundary. It resolves a
champion's **base, ascension-free** prestige for the selected rarity, rank and
signature, then applies seven-star ascension once:

```text
seven-star display prestige = round10(basePrestige(sig) × 1.08^ascensionLevel)
other rarities              = round10(basePrestige(sig))
round10(x)                  = Math.round(x / 10) × 10 for positive x, else 0
```

Signature 0, 1 and maximum signature use their stored endpoints. Intermediate
signatures use the existing rarity curve and round the interpolated base to an
integer **before** ascension. Signature bounds, rank lookup and fallback behavior
are unchanged. Rank endpoints describe the standard maximum champion level at
that rank; this API does not project arbitrary champion levels.

There is no rounding between ascension steps. Do not multiply the **displayed**
A1 value to obtain A2. Keep the base endpoint/curve and apply the whole power,
then round to tens once. The gameplay reference below rules out intermediate
rounding to tens. It does not distinguish integer rounding at each step from
one final rounding; final-only rounding retains the established application
contract, rather than claiming universal server integer parity. For example,
the synthetic base 11,030 produces 12,870 with final-only rounding versus
12,860 with intermediate integer rounding. This is a contract test, not another
observed game build.

## Gameplay reproduction and cause

On 7 November 2026 the user supplied the in-game Prestige modal showing
**Infamous Iron Man, seven stars, A2, 39,730**, and separately confirmed **rank 4,
signature 200**. Exact identity: `ironman_infamous`, not `doctordoom`. Champion
level is not visible; the comparison uses standard rank/max-level semantics.

The archived July 16 capture has R4 maximum level 55 and base signature
endpoints 25,360 (sig0), 25,940 (sig1), and **34,060 (sig200)**. The minimized
numeric fixture and source hashes/row references are in
`src/tests/fixtures/champion-prestige-ascension.json`. It contains no account
identifiers or screenshot copy. Only the sig200 A2 value is the independently
observed ascended fixture; A0/A1 projections are labeled accordingly.

```text
R4 sig200 A0 endpoint:                           34,060
A1 projection, unchanged: round10(34,060 × 1.08)  36,780
Old A2 additive projection:                      39,510
Fixed A2: round10(34,060 × 1.08²)                 39,730  (observed)
Rounding A1 to tens before the second multiplier:39,720  (wrong)
```

The confirmed cause is stale additive calibration in
`ascensionPrestigeMultiplierForRarity`: `1 + level * 0.08`. A1 cannot distinguish
additive from compounded scaling, while A2 can. The prior tests used synthetic
endpoints and explicitly expected additive results, so they passed despite the
game mismatch. New regression coverage uses the confirmed gameplay value at
direct, curve, indexed, roster aggregate, global-list and actual detail/prototype
render seams.

Kabam (Osaurus) Rex's [Ascension Stat Scaling Bug Fix — Now Live](https://forums.playcontestofchampions.com/en/discussion/418740/ascension-stat-scaling-bug-fix-now-live)
states that A2 bonuses compound on A1 and specifically reports an approximate
half-percent A2 **Prestige** increase. The post says the change was planned for
the September build, went live earlier, and was retained. An exact publication
day and integer rounding algorithm were not exposed by the fetched article.

History is distinct from the current report: commit
`fb4498ed40a2457d7942bc6e65bd242ff4859594` (7 May 2026, “Fix 7-star ascension
prestige scaling”) deliberately replaced `Math.pow(1.08, level)` with additive
scaling. Current acquisition/eligibility work retained that prestige policy;
there is no demonstrated recent reversion of a compound fix. The later publisher
correction supports game-rule drift as the explanation for stale calibration.
See [the independent history audit](prestige-ascension-history-audit.md).

## Base values, observations and normalization

- `calculateMcocPrestige` and `expandMcocPrestigeCurve` return ascension-free
  values. The curve API `/api/profile/champion-prestige` deliberately returns
  base curves. `projectMcocPrestigeFromCurve` applies ascension exactly once to
  the selected base point. Repeated projections do not mutate endpoints/curves.
- `ChampionStats.prestige`, `ChampionPrestige` endpoints and projector fallback
  prestige retain their existing **base** meaning. This correction changes no
  saved values and requires no dataset regeneration or migration.
- There is no observed-A1/A2-to-base prestige normalization API in the inspected
  import/projection chain. The exporter passes captured `heroRating` integers;
  its normalization adjusts **signature labels**, not ascension. AD captures
  have no explicit ascension dimension. Do not infer inverse normalization from
  the name “normalized” or feed an observed ascended rating into a base endpoint.
- A rounded observed A1/A2 rating cannot recover an exact base by division.
  For example, 39,730 / 1.08² is approximately 34,062.07, not the recorded 34,060.
  Preserve observations as observations, and use independently captured base
  endpoints for projection. No inverse conversion, observed-value rewrite or
  second growth application is introduced by this fix.
- `normalizeRosterAscensionState` normalizes **owned levels**, preserving a
  positive observed integer and mapping the legacy boolean to A1/A0. It neither
  normalizes prestige nor erases owned levels beyond a newer catalog cap.
  Recorded account/profile prestige and relic components remain separate from
  champion build projections.

## Eligibility and combat boundaries

The multiplier's historical owned-read guard remains 0–5. It does not grant
eligibility for new builds: exact champion/star rules control those choices and
writes. Current seven-star catalog scope has 113 positive paths: 112 max A2 and
reviewed Carina max A1. Empty/unknown paths and excluded boss variants do not
gain levels from unbound global tuning tiers. Lower-star prestige growth remains
unchanged. Global targets clamp to exact caps while owned observations remain
readable.

Combat uses the separate `applyAscensionToStatValue` and exact recorded tier
modifiers. The subsequent [combat follow-up](champion-combat-ascension.md) derives
independent Health/Attack multipliers by compounding the incremental bonuses,
then retains one final **integer** rounding. CR/Might remain additive. This is
separate from prestige's fixed 8% calibration and nearest-ten display rule.
Raw dataset values, caps and the deliberately empty generic seven-star combat
fallback remain unchanged. The publisher correction establishes the combat
scaling policy; exact intermediate server rounding is still unproven.

## Consumer trace and corrected bypasses

The common correction reaches Champion Details/build controls, the development
prototype, roster edit previews, indexed roster insights, rank/signature
simulations, Top30 averages and the global prestige list/calculator. The finder
base map explicitly requests A0. Server roster projections load the same
indexed projector; normal account/alliance averages consume recorded account
totals. No manual account totals are rewritten by this local change.

Two display bypasses were separate from the A1-correct/A2-low formula bug and
were also corrected, with failing regressions at their actual calling seams:

- `web/src/app/player/[id]/page.tsx` Top Champions previously selected the last
  raw endpoint below the owned signature. It now uses the shared projector with
  the normalized owned level, including legacy boolean-only A1 observations.
- `web/src/app/profile/roster/roster-view.tsx` intentionally fetches an A0 curve.
  `prestige-chart-modal.tsx` now projects a fresh display array for the selected
  recommendation using `applyAscensionToPrestige`. The API/cache and input array
  remain base values, including across repeated renders. The regression follows
  the real curve API response through the real modal/chart to the external chart
  library's data boundary.

An additional editor mismatch was reproduced with `isAscended=true` and numeric
level 0: its control showed A1 while its fetched prestige preview used A0.
`edit-champion-modal.tsx` now uses `normalizeRosterAscensionState` for projection
as it already did for its controls and save behavior. Unchanged legacy fields
remain omitted from unrelated save requests. No stored observation is rewritten.

## Deterministic checks

```powershell
pnpm exec vitest run web/src/lib/prestige-ascension-regression.test.ts web/src/lib/mcoc-prestige.test.ts web/src/lib/global-prestige-list.test.ts web/src/lib/roster-recommendation-service.test.ts web/src/lib/roster-recommendation-service-adapter.test.ts 'web/src/app/champions/[slug]/champion-ascension-interaction.test.tsx' 'web/src/app/player/[id]/page.prestige.test.tsx' web/src/app/profile/roster/components/modals/prestige-chart-modal.test.tsx web/src/app/profile/roster/components/modals/ascension-controls.test.tsx --maxWorkers=1
```

The new suites are included in CI's existing explicit “Verify game-backed
ascension rules and roster updates” command, preserving its prior coverage.
The fixture checks the gameplay reference, base-input immutability, selected
signature/rank isolation, final rounding boundaries, mixed-roster averages,
legacy owned state, exact caps and lower-star invariance. No live account,
database or browser session is required.

Validation on 7 November 2026: the full existing ascension/roster CI command with
the added suites passed **161 tests in 22 files**, single worker. Scoped web
TypeScript (including the affected consumers, tests and NextAuth declarations)
passed with `--noEmit --incremental false`. Scoped ESLint passed with zero errors;
eight warnings on unchanged existing lines remain. `git diff --check` passed for
the touched tracked files. The scoped configuration, exact suite list, successful
JSON report and test log are retained in ignored `temp/prestige-ascension-fix/`.
No full web build or live/database operation was used.
