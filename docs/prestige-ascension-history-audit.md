# Seven-star prestige ascension: evidence and history audit

Audit date: 7 November 2026. Read-only investigation; this note and ignored
`temp/prestige-ascension-audit/` are the audit's only writes. Production code,
tests, CI, datasets, databases and other documentation belong to the implementation
agent. No account operations, captures, migrations, commits or deployments were
performed. References to implementation lines below describe the inspected
pre-fix working tree, with the prestige helper preserved in the ignored snapshot.

## Ranked causes and falsifiable predictions

1. **Stale additive prestige calibration — confirmed for the supplied example.**
   The inspected helper uses `1 + level * 0.08`. Additive and compound policies
   agree at A1, diverge at A2, and affect direct, curve and indexed projections
   together. Infamous Iron Man's archived R4/S200 endpoint is 34,060; the supplied
   game prestige is 39,730 at A2. Additive projection produces 39,510, while
   compound projection with final nearest-ten rounding produces 39,730. A later
   official game correction independently explains why the older policy became
   stale. There is no demonstrated recent acquisition/UI reversion.
2. **Rounding at the wrong stage — relevant secondary risk.** If a consumer first
   rounds A1 to its displayed ten and then compounds, the supplied example
   produces 39,720, missing the game observation. Retaining the endpoint through
   the full power and rounding at the end matches. Integer rounding at each step
   also produces 39,730 for this example; this anchor does not distinguish that
   model from an unrounded power. Rounded A0 anchors can likewise conceal latent
   source precision. Exact universal server integer math is not established.
3. **A consumer bypasses the common projector — independently confirmed, separate
   symptom.** The public player overview's Top Champions section selects the
   last stored endpoint below the signature, without interpolation or ascension.
   The roster insight chart also displays the fetched A0 curve directly, ignoring
   the recommendation's ascension level.
   Prediction: it can disagree at A1 as well as A2, and changing the common
   multiplier alone will not change that section. This does not explain the
   precise A1-correct/A2-low pattern across common-projector consumers.
4. **Already ascended input is scaled twice — possible contract risk, not found
   as the cause.** Prediction: feeding an A1/A2 display value into the base-curve
   API applies another multiplier and usually already breaks A1. The inspected
   importers/exporters do not inverse-normalize observed ascension; their fields
   also do not carry ascension identity. No evidence was found that the supplied
   canonical endpoint had already been ascended.

## Independent numerical reference and limits

The original user-supplied image was viewed directly:
`C:/Users/ossul/.t3/userdata/attachments/3b60eb8b-d69c-429a-9703-7885fa91867e-d4a9777a-56fa-48fe-a3bc-94d746d479b2.png`.
It is the game's Top 30 Prestige modal, and visibly shows **INFAMOUS IRON MAN,
39,730, ascension 2**. The user separately confirmed seven stars, rank 4 and
signature 200. Exact identity is **`ironman_infamous`**, not `doctordoom`.
Champion level is not visible or independently confirmed. The comparison uses
the application's established standard rank/max-level endpoint semantics; the
archived R4 endpoint's level is 55. That is source/default semantics, not an
additional fact read from the image.

`scratch/live-scan-2026-07-16/mcoc_sig_prestige.json`, generated
`2026-07-16T14:46:12.595550+00:00`, has exact seven-star `ironman_infamous`:

- R4/S1: prestige 25,940, source row `16153`.
- R4/S200: prestige **34,060**, source row **`16154`**; Health 88,679, Attack 7,903,
  healthRating 15,900 and attackRating 18,158.
- The corresponding `mcoc_game_stats.json` has R4/level55 sig-0 prestige 25,360,
  source row `16152`.

The June 7 export independently inspected in the local archive contains the same
endpoint values and source row labels; identical labels indicate shared capture
lineage, not a second independent game observation. The raw rating components
sum to 34,058 while exported prestige is 34,060, illustrating why endpoint
rounding/precision must not be invented by summing components or dividing a
display value by an assumed factor.

Candidate arithmetic using the recorded S200 endpoint:

```text
34,060 × 1.08                    = 36,784.8       → A1 display 36,780
34,060 × 1.16                    = 39,509.6       → A2 display 39,510
34,060 × 1.08²                   = 39,727.584     → A2 display 39,730
round10(36,784.8) × 1.08          = 39,722.4       → A2 display 39,720
roundInteger(36,784.8) × 1.08     = 39,727.8       → A2 display 39,730
```

Only 39,730 at A2 is the supplied game observation. A0/A1 values above are
recorded endpoints or candidate projections as labeled, not additional observed
ascension fixtures. Other screenshot cards have unknown ranks/signatures/levels
and are not fully bound regression references.

## Primary publisher corroboration

Kabam (Osaurus) Rex's [Ascension Stat Scaling Bug Fix — Now Live](https://forums.playcontestofchampions.com/en/discussion/418740/ascension-stat-scaling-bug-fix-now-live)
states that A2 bonuses were changed to compound on A1, and separately reports an
approximately half-percent increase to A2 Prestige. It says the correction was
planned for the September build, went live earlier and was retained. The fetched
article does not expose its publication date; no exact day is asserted here.
It supplies no integer or display rounding algorithm.

The publisher also discusses Attack/Health changes. Consequently the recorded
per-tier modifiers and an additive UI summary are **not proof** of the final
server combat scalar. This is a separate apparent combat parity question to
investigate independently; it does not authorize changing combat helpers,
catalog values, eligibility or caps as part of this prestige audit.

## Prestige and combat are distinct contracts

- `web/src/lib/mcoc-prestige.ts:50` rounds positive display prestige to the nearest
  ten. At inspection, `:54–58` implements the additive prestige multiplier with
  the historical owned-read cap of five; this is distinct from current build
  eligibility. `:61–67` applies it once after base calculation. `:84–109` resolves
  signature endpoints or rounds interpolated prestige to an integer first.
- `projectMcocPrestige` (`:112`) calculates the base and delegates to the display
  application; `createMcocPrestigeProjector` (`:127`) indexes rows and calls the
  same function; `projectMcocPrestigeFromCurve` (`:213`) consumes an explicitly
  ascension-free curve. `expandMcocPrestigeCurve` (`:164`) does not apply ascension.
- Combat scaling is separate at `applyAscensionToStatValue` (`:70–81`), using
  recorded `attackBonus`/`healthBonus`. `src/domain/champion-ascension.ts:59–65`
  sums tier Attack/Health/CR/Might fields; its comment explicitly excludes a
  prestige formula.
- The exact local catalog has 112 seven-star A2 paths, one reviewed seven-star
  A1 path (`carina_white_t7`), and 167 seven-star zero paths. Carina's A1-only
  path makes the generic seven-star combat fallback deliberately empty in
  `src/data/game-ascension/limits.ts:6`. Exact Magik A2 records contain two
  approximately 0.08 Attack/Health contributions, +15 CR per step, and MightGain
  only on the first. These fields do not store a prestige multiplier.
- The captured client dump
  `D:/CodexArtifacts/Cpp2IL-2026-11-03/IsilDump/Marvel.Runtime/BCGUserHero.txt:1176`
  reads `rating_prestige` from input data into offset 144. Its
  `get_PrestigeRating` (`:2011–2019`) just returns that field. The corresponding
  `BCGHeroDetails.txt:2023–2040` getter/setter reads/writes offset 40. These getters
  do not establish server prestige math.
- `HeroAttributesPanel.txt:2690,2728–2732` obtains the current ascension list and
  adds the tier Health/Attack/CR fields for the panel. This is evidence of the
  displayed modifier summary, not independent final prestige or combat parity.
  The existing domain investigation at
  `docs/champion-ascension-investigation.md:108–137` already distinguishes them.

## Normalization, import and caller audit

`src/domain/roster-ascension-state.ts:5–9` preserves a positive safe-integer owned
level, otherwise maps the legacy boolean to A1/A0. It does not change prestige
values or erase observations beyond the catalog's cap. Manual increases are
validated separately (`:16–29`); existing observations can outlive a snapshot.
Do not replace this read policy with the Carina/A2 selection caps.

The installed `Scripts/export_mcoc_sig_prestige.py:94–107` and archived versions
in `scratch/pre-game-update-2026-10-07/` and
`scratch/runtime-capture-2026-10-17/export_mcoc_sig_prestige.py.before` normalize
**signature labels**, including inferred max signature for unlabeled uplifted
rows. They pass `heroRating` to `prestige` (`:68,167`). They do not divide out
ascension. Their AD CSV schemas have no ascension field. The imported
`is_base_runtime_row` predicate compares health/attack ratings to base ratings
(`Scripts/export_mcoc_game_stats.py:134–146`); it is not an explicit A0 assertion.
This is an evidence limitation, not proof of contaminated endpoints.

`src/services/mcocSigPrestigeImportService.ts:170–217` upserts the captured
prestige integer and sig-0 baselines from exact-tier ChampionStats. No second
ascension multiplier or inverse normalization was found there. The three-entry
`scratch/champion-data-followup-2026-10-17/prestige-repair-plan.json` fixes Black
Panther **two-star sig-0** values copied from seven-star rows. It is unrelated to
the compound/additive dispute.

Relevant consumers, using inspected pre-fix line numbers:

| Consumer | Path and behavior | Regression seam |
| --- | --- | --- |
| Champion detail/build | `web/src/app/champions/[slug]/champion-details-client.tsx:58–96`; exact rules bound build selection, common prestige projector | User's A2 anchor plus A1 and rarity switch |
| Development prototype | `web/src/app/champions/[slug]/prototype/[concept]/prototype-client.tsx:133–166`; exact rule clamp, common prestige projector | Same rules/caps and A2 result as detail |
| Roster edit preview | `web/src/app/profile/roster/components/modals/edit-champion-modal.tsx:60–74`; base curve API then one projection | Fetched base curve must remain A0; no double application |
| Curve API | `web/src/app/api/profile/champion-prestige/route.ts:35–52`; expands stored endpoints without ascension | Return A0 data even when editor chooses A2 |
| Roster insight chart | `web/src/app/profile/roster/roster-view.tsx:438–441` fetches the A0 curve; `components/modals/prestige-chart-modal.tsx:70` passes it straight to the chart without using recommendation ascension | Separate A1/A2 chart parity defect; preserve the API's base-curve contract |
| Roster/aggregate/simulation | `web/src/lib/roster-prestige-insights.ts:109–156,169–179,289,320,350`; normalized owned levels, indexed projector for Top30, rank gains and sig suggestions | Public service/insights seam with real endpoint and A1/A2 mixed roster |
| Global calculator/list | `web/src/lib/global-prestige-list.ts:122–147`; exact per-champion target cap, separate owned projection | Carina target clamps to A1; owned historical level preserved |
| Unowned finder base map | `web/src/app/champions/page.tsx:291–302`; explicitly projects A0 | Keep A0 invariant |
| Public player overview | `web/src/app/player/[id]/page.tsx:388–390`; raw last endpoint below sig, bypasses interpolation and ascension | Separate defect; common helper fix alone cannot cover it |
| Recorded account prestige | `src/services/playerPrestigeService.ts:86–119`; records supplied champion component and adds relic component | Not a champion build projection; do not rewrite saved totals |

No dedicated second champion prestige calculator implementing an inverse
ascension policy was found in the searched `src/` and `web/src/` code.

## Test gaps and recommended regression seams

The inspected `mcoc-prestige.test.ts` is synthetic: A1 22,000→23,760 cannot
distinguish the two policies, while its A2 expectation 25,520 actively locks the
old additive policy. Its indexed test covers only A1. The curve test exercises A5
historical calculation, not actual new-build availability. The global-list test
at `:257–269` locks synthetic A2 30,000→34,800, and roster normalization test
`:83–89` locks 10,000→11,600. Passing these expectations is not independent game
validation. Interaction tests with null prestige/empty endpoints test eligibility
and controls but cannot establish prestige correctness.

Recommended production-owner coverage:

1. Bind the actual `ironman_infamous`, seven-star R4/S200/A2 39,730 reference to
   its captured 34,060 endpoint, screenshot provenance and user-confirmed fields.
   Exercise direct, base-curve and indexed public projections. Keep missing
   screenshot level vs standard endpoint semantics explicit in fixture notes.
2. Retain the A1 control to prevent a mistaken blanket 16.64% boost and verify
   A0 remains unchanged. Use a raw integer anchor not divisible by ten to catch
   premature base-display rounding. Label synthetic rounding sentinels as policy
   tests, not new observed game facts.
3. Exercise the curve API/editor pipeline or its public pure seam so a pre-scaled
   curve cannot silently gain ascension twice. Do not inverse-normalize observed
   display values without provenance/precision.
4. Test Top30/recommendation and global-list projections at A2 with exact target
   caps, Carina A1, zero/missing rules, and preserved owned historical observations.
   Lower-star prestige must not acquire the combat boosts of 30%/20%/22%.
5. Give the overview and insight chart separate caller regressions: neither
   presently consumes the common ascension projector, so its unit tests cannot
   catch these display discrepancies. Preserve the intentionally A0 curve API
   rather than moving scaling into the shared response and doubling edit preview.
6. Keep separate exact combat-modifier tests and the no-generic-seven-star-fallback
   invariant. Investigate final combat parity against the publisher correction as
   separate work; do not equate adding modifier fields with final prestige math.

The read-only CLI probe used actual exported public functions without DB, network,
browser, full TypeScript or duplicate test-suite runs. Before the implementation
fix, all three public projection paths agreed on additive A0/A1/A2 values.
Command: `pnpm exec tsx --tsconfig web/tsconfig.json temp/prestige-ascension-audit/probe.ts`.
Its JSON distinguishes observed application outputs from candidate-model
predictions; no synthetic value is called captured game evidence.

## Proven chronology and historical limits

- **16 March 2026 — `955551dc8dc52b8594bae6d1ddc354324ab85f99`:** introduced
  `Math.pow(1.08, ascensionLevel)` in roster recommendations. Its commit message
  explicitly describes compounded seven-star prestige. Initial display rounding
  was to an integer.
- **1 April 2026 — `79354f4638cc8dee175013e87171d194fffe4d47`:** moved the
  prestige result to nearest-ten display rounding after the whole power.
- **3 May 2026 — `278310959da347a63fc888d84cc785a24cd1d8ad`:** introduced the
  signature endpoint/rarity-curve helper, then without an ascension projector.
- **5 May 2026 — `31f3874814447fe088a886dff292b34eb0f9fa81` (#60):** centralized
  compound ascension and final nearest-ten rounding into the projection module.
- **7 May 2026 — `fb4498ed40a2457d7942bc6e65bd242ff4859594`, “Fix 7-star
  ascension prestige scaling”:** deliberately changed **compound to additive**.
  Its tests added A1/A2 examples and changed A5 expectations. This is the exact
  proven prior commit with that fix title; its title is not evidence the game
  still uses the same policy today.
- **11 May 2026 — `5801c38caa0f1450da2531242d37f2c6ea137560`:** added the indexed
  projector; it delegates to the existing common projector and retains additive
  scaling. The added indexed test only checks A1.
- **Later game correction, announced as preceding the September build:** the
  publisher explicitly changed A2 scaling to compound and included prestige in
  its explanation. Exact announcement day was not established by this audit.
- **7 November 2026 pre-fix working tree:** dirty changes separated combat effects,
  exact champion eligibility, caps and observation normalization while preserving
  the May additive prestige expression. The inspected HEAD was
  `8898fd42b8f086c4331b4375cca9de73dea199b0`. The baseline helper SHA-256 at
  `2026-11-07T12:11:25.916Z` was
  `73ae00ce08eb346ee42f83b33a4f691dca66f681bdd9b591e57409734acca7b7`.

`git log`, `git show`, `git blame` and the dirty diff establish mainline history
and the current split. They do **not** prove a more recent uncommitted compound
fix was reverted, nor do they establish every discarded edit/checkpoint. No
checkout, reset, stash, bisection or restoration was performed. The evidence
supports stale policy after an external game change; exact historical intent
behind the May correction and the user's recollection remain unproven.

Artifacts: ignored `temp/prestige-ascension-audit/probe.ts`,
`projection-observations.json`, `mcoc-prestige.observed.ts.txt`, and
`evidence-manifest.json`. This audit makes no production-fix claim.
