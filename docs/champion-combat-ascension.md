# Champion combat ascension projection

## Policy and evidence

The 7 November 2026 application follow-up corrects Health and Attack projections
at A2. Kabam (Osaurus) Rex's [Ascension Stat Scaling Bug Fix — Now Live](https://forums.playcontestofchampions.com/en/discussion/418740/ascension-stat-scaling-bug-fix-now-live)
explicitly establishes that the second bonus applies to A1 stats and reports a
small increase in A2 Health/Attack, alongside Prestige. The fetched article
exposes neither an exact publication day nor the integer rounding algorithm.

The pinned 3 November BCG catalog records **incremental** Attack and Health
bonuses of `0.07999999821186066` at both `7s_t1` and `7s_t2`. The exact blueprint's
ordered tier IDs bind those records to levels 1 and 2; they are not two cumulative
endpoints. The publisher's explicit second-step-on-first-step rule resolves the
composition policy. The catalog, costs, source hashes and observation date are
unchanged. No raw value is replaced with 0.0864 or a rounded nominal 0.08.

Local method evidence uses the existing hash-bound files in
`D:/CodexArtifacts/Cpp2IL-2026-11-03/IsilDump/Marvel.Runtime/` (hashes in
[the investigation](champion-ascension-investigation.md#local-method-evidence-hashes)):

- `BCGManager.GetAscensionListForHeroCurrentTier` resolves successive entries
  from the blueprint's ordered list up to the requested tier. Its maximum comes
  from that list, not the global tuning catalog.
- `HeroAttributesPanel.UpdateStats` sums Attack, Health and ChallengeRating for
  its displayed modifier summary. This supports incremental fields and additive
  CR, but its +16% summary is not proof of the corrected final combat scalar.
- `GameBCGUtils.GetAscensionTotalMightGainForCurrentTier` sums MightGain;
  `PlayerAttributes.SetAttributeData` adds that sum to `might_gain_bg_rate`.
  This is a Might/ISO-Burst tuning contribution, not Prestige or an Attack boost.

The [official launch explanation](https://forums.playcontestofchampions.com/en/discussion/411731/everything-about-7-star-ascension-so-far)
also describes CR per rank and Might/ISO-Burst separately. Its future-level
roadmap does not establish new eligible paths.

## Shared calculation and consumer trace

```text
healthMultiplier = product(1 + step.healthBonus) over completed eligible steps
attackMultiplier = product(1 + step.attackBonus) over completed eligible steps
projected health = Math.round(baseHealth × healthMultiplier)
projected attack = Math.round(baseAttack × attackMultiplier)
CR contribution = sum(step.challengeRating)
Might contribution = sum(step.mightGain)
```

`getAscensionEffects` now names the derived fields `healthMultiplier` and
`attackMultiplier`, with identity 1. Raw `AscensionStep.healthBonus` and
`attackBonus` remain incremental percentages. Each stat uses its own modifiers;
there is no universal hardcoded 1.08. CR/Might keep identity 0 and sum semantics.
The generic limits helper returns an **effective combined percentage** for
uniform recorded paths. Its generated implementation and generator agree;
seven-star fallback remains empty because Carina A1 and other A2 paths differ.

The existing game-stat exporter selects rows whose rating components equal their
base components, then assigns display ranks using recorded health/attack order.
`mcocGameStatsImportService` carries health/attack into `ChampionStats` without
another ascension factor. The archived AD/export schema has no explicit
ascension dimension; this change retains the application's base-input contract,
without inferring or reversing ascension on imported or saved observations.

The detail loader passes imported rows and exact `getChampionAscensionRules`
payloads to both clients. Detail and prototype select rarity/rank, clamp build
ascension against exact rules, and call `applyAscensionToStatValue` once for each
base health/attack. The displayed headline and the ability-text stat context use
the resulting integers. Signature calculation remains a separate Prestige path.
Detail's CR adjustment remains additive; the prototype advanced panel now also
adds the exact CR contribution to the base row, recalculating from base on each
selection so repeated A0/A1/A2 changes cannot accumulate it.

Roster cards/editors, player overview, recommendation simulations and charts
project Prestige rather than health/attack. Their existing common Prestige
projector still compounds a calibrated 8% and rounds once to tens. The curve API
continues to return base curves. No additional roster combat scalar or inverse
normalization was found. Owned historical level reads remain separate from
build/write caps; saved observations and account totals are not rewritten.

## Other stats, eligibility and rounding

- Challenge Rating: +15 at A1 and +30 total at A2, from two +15 contributions.
  Detail already applied it; prototype's advanced display now does too.
- Might Gain: raw first step `3.5999999046325684`, second step zero. Both A1 and
  A2 therefore retain the same total. No damage/Prestige multiplier is inferred
  from it; the application does not expose a Might-derived damage estimate.
- Every referenced tier has empty BuffIDs. No buff effect or formula is added.
- Armor rating/penetration, critical rating/resistance/damage rating, block
  proficiency/penetration, special damage multiplier, energy/physical resistance
  keep their imported values. The ascension contract specifies no direct bonus
  for those fields. Higher CR can affect fight interactions; that does not imply
  a percentage boost to their stored ratings. Raw health/attack rating components
  are likewise not fabricated into a new Hero Rating calculation.
- Lower-star A1 retains +30%/+20%/+22% Health/Attack for 4/5/6 stars. Its CR/Might
  contributions remain zero. Lower-star Prestige does not gain those percentages.
- Canonical scope remains 113 positive seven-star paths: 112 A2 plus reviewed
  Carina A1. Empty, unknown, boss/legacy and unbound future-tier paths gain no
  eligibility. A requested A2 Carina combat projection still stops at A1.

Combat retains one final `Math.round` to an integer, after the complete product;
there is no rounding to tens or between tiers in the application. This preserves
the established application rounding stage while correcting the verified
composition policy. It is **not proof of universal server intermediate rounding**.
Synthetic small-number tests distinguish final integer rounding from intermediate
integer rounding and Prestige rounding. There is no newly captured, fully bound
A2 health/attack observation, so exact final server-integer parity remains unproven.

## Regression evidence

`src/tests/fixtures/champion-combat-ascension.json` is an exact small projection
of archived `scratch/live-scan-2026-07-16/mcoc_game_stats.json`, SHA-256
`1744f5720e78315ec40a5fdf8d9d0e8ea44b4774b736acecf87f20a50eb3ea11`,
source row 16152, `ironman_infamous_t7`, seven stars, rank 4, level 55, sig 0.
It preserves base Health 88,679, Attack 7,903 and CR 230. Tests use the separate
captured signature endpoints for Prestige at sig 200. Ascended combat values
below are **policy projections**, not new observations from the Prestige image:

| Projection | Health | Attack | CR |
| --- | ---: | ---: | ---: |
| A0, unchanged | 88,679 | 7,903 | 230 |
| A1, unchanged | 95,773 | 8,535 | 245 |
| A2, old additive projection | 102,868 | 9,167 | 260 |
| A2, corrected compound projection | 103,435 | 9,218 | 260 |

Diagnosis reproduced the old A2 result in both rendered clients. Ranked causes
were additive effect aggregation, downstream double application, and rounding.
The shared/base-to-render regressions failed at A2 while A0/A1 passed; code tracing
found one application; compound effective multipliers resolved the failure.
A separate rendered regression caught the prototype's base-only CR at A1 before
its additive display fix. No temporary debug logging was introduced.

`web/src/lib/combat-ascension-regression.test.ts` covers the archived base row,
all 113 exact seven-star paths, independent divergent Health/Attack step modifiers,
integer rounding sentinels, Carina, lower-star boosts and unsupported paths.
`champion-ascension-interaction.test.tsx` verifies actual detail/prototype output
at A0/A1/A2, independent modifiers, rounding, unchanged ratings, exact caps and
the repeated CR selection control. Synthetic values are explicitly policy tests.
The new suite is registered alongside all prior suites in CI's existing
**Verify game-backed ascension rules and roster updates** command.

The original Prestige regression remains 34,060 A0 / 36,780 A1 / **39,730 A2**
for the supplied R4/S200 reference; its independent observed A2 anchor and
normal base-curve contract remain separate from these combat policy examples.

Verification on 7 November 2026 passed **219 tests across 25 files** with
`--maxWorkers=1`: the complete existing ascension/roster CI command plus the
ability-text and stats-panel suites. This includes the player overview, chart,
editor, base Prestige curves, classification/canonical caps and roster-write
regressions. The extractor's **14 Python tests** passed. Scoped TypeScript
(`pnpm exec tsc --noEmit -p temp/combat-ascension-fix/tsconfig.json`) passed with
incremental output disabled. The ignored JSON report and baseline/delta evidence
are under `temp/combat-ascension-fix/`. The catalog's byte hash still matches
the pre-change copy; the generated limits module matches its generator exactly.
CI comparison confirms the new suite is the only command delta and all earlier
suite paths/quoting are retained. Scoped ESLint checked all eight changed
TypeScript files with zero errors or file diagnostics; the host emitted React
detection, pages-path and baseline-metadata environment notices. No commit,
deployment, migration, data refresh,
saved-observation rewrite, account operation or fresh game capture was performed.

Changed files for this follow-up (relative to the already dirty starting tree):

- Calculation: `src/domain/champion-ascension.ts`,
  `web/src/lib/mcoc-prestige.ts`, `scripts/extract_mcoc_ascension.py`,
  `src/data/game-ascension/limits.ts`.
- Prototype CR display:
  `web/src/app/champions/[slug]/prototype/[concept]/prototype-client.tsx`.
- Tests and fixture: `src/domain/champion-ascension.test.ts`,
  `src/data/game-ascension/index.test.ts`,
  `web/src/lib/combat-ascension-regression.test.ts`,
  `web/src/app/champions/[slug]/champion-ascension-interaction.test.tsx`,
  `src/tests/fixtures/champion-combat-ascension.json`.
- Integration/documentation: `.github/workflows/ci.yml`, `CONTEXT.md`,
  `docs/champion-prestige.md`, `docs/champion-ascension-investigation.md`,
  `docs/champion-combat-ascension.md`.
