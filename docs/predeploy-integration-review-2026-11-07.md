# Predeployment integration review — 7 November 2026

Read-only review of the shared dirty working tree. No production code, tests,
catalogs, workflow, assets or other documentation were edited. This document and
ignored `temp/predeploy-integration-review/` outputs are this review's only writes.

## Readiness verdict

**No P0/P1 release blocker found in the reviewed integration paths. One confirmed
P2 source-correctness defect should be corrected before release:** an undated
Blade objective is asserted to be a past event without evidence that it ended.
One P3 provenance-label defect can be fixed alongside it. This is not an
unconditional deployment approval: full typecheck/build/CI execution belongs to
the separate validation reviewer and is not claimed here.

## Confirmed findings

### 1. P2 — Blade's undated objective is presented as ended

- **Location:** `src/data/champion-ascension-acquisition/catalog.json:1079`;
  `src/domain/champion-ascension-acquisition.ts:72`;
  `web/src/components/champion-ascension-acquisition.tsx:17` and `:32`.
- **Cause:** `blade-stellar-necropolis` uses `availability: "historical"` with
  `window: null`. Its own `missingEvidence` at catalog line 1085 explicitly says
  the deadline and current activity status are not captured. The reader maps an
  undated historical record to `periodStatus: "past"`; the renderer labels it
  **Past event** in both Finder and How to obtain.
- **Proof:** at reference `2026-11-07T12:00:00Z`, the real reader returns
  `historical/past`, and server-rendering the real shared acquisition component
  emits `Past event`. The targeted probe also confirms that the specific missing
  deadline/status evidence is absent from the rendered source details.
  `probe-evidence.json` records the complete minimized result.
- **Evidence limit:** the [official May 29th livestream summary, published June 1](https://playcontestofchampions.com/news/may-29th-livestream-summary/)
  confirms the Necropolis Red Goblin objective and says it was already live.
  The preserved primary-source response is
  `temp/ascension-source-audit/post-95822.json`; the existing audit at
  `docs/ascension-acquisition-source-audit.md:78` likewise establishes historical
  confirmation, not an end. This review does **not** assert current availability,
  an account's claimability, or that the objective is definitely permanent.
- **Impact/reproduction:** visit
  `/crystals/champions?champion=blade_stellar&rarity=7&reward=ascension`, or the
  seven-star Blade (Stellar-Forged) How to obtain panel. The challenge card tells
  the player the source is past even though the evidence cannot establish that.
  This is a source-fact error, not merely missing live-stock coverage.
- **Smallest repair:** classify this record neutrally, e.g. activity-dependent
  with no dated period, retaining that it was reported live in June and that its
  end/current activity is unverified. Keep actually dated past sales historical.
  Add an actual reader/shared-renderer regression for an old announcement with
  no evidenced deadline; do not merely change a snapshot to expect another label.

### 2. P3 — Comparison labels November 5 contents as captured November 3

- **Location:** `web/src/lib/data/crystals.ts:196`;
  `web/src/app/crystals/crystal-comparison.tsx:41`;
  `web/src/app/crystals/crystal-shared.tsx:12`.
- **Cause:** comparison correctly gets champion membership from
  `loadCrystalDetails`, which uses the November 5 exact-opening contents, but
  returns the older `crystalCatalogSource.observedAt` as the comparison date.
  `SourceNote` presents that date as **Contents captured**.
- **Proof/reproduction:** compare
  `/crystals/compare?left=6star_empire_of_doom_saga_crystal&right=6_star_hero_shard_crystal&rarity=6`.
  The probe confirms that the first side contains the same 41 champions as its
  November 5 detail projection, while comparison advertises
  `2026-11-03T09:10:42+00:00`. The actual detail observation is
  `2026-11-05T14:05:24+00:00`.
- **Impact:** incorrect attribution of the comparison's contents; the compared
  membership/count itself is correct. This does not block deployment on its own.
- **Smallest repair:** carry each resolved side's content observation through
  its summary. Use the shared observation when they agree, or show separate
  dates when they differ. Do not blindly relabel fallback older contents.

## Reviewed behavior and verification

Read `CLAUDE.md`, `CONTEXT.md` and the supplied prestige, combat, acquisition,
seven-star integration, crystal and all-reward domain docs. No applicable
`AGENTS.md` was found in the repository inventory. Inspected current production
code, relevant tracked diff and untracked implementation, rather than relying on
the previous validation summaries alone.

- Traced Finder draft/committed identity, seven-star focus normalization,
  clear/reset and history handling; positive-path versus unsupported/source-gap
  behavior; selected artwork/profile binding; contextual fragment jumps and
  disclosure focus; exact host return URL and session scroll saving/consumption.
  Inspected cancellation, remount keys, late-response guards and retry in the
  champion host. No additional confirmed state/identity defect was established.
- Traced Standard primary selection after star filtering, Nexus/Epoch/shard
  alternative links, selection-only fallback, sibling link semantics, heading
  slots and CSS touch targets. Read the current semantic tests and existing
  final verification artifacts. Opened the saved final
  `temp/finder-polish/desktop.png`, `long320.png` and `sourceOnly320.png`:
  selected identity is readable, portrait count/fallback matches its state, and
  the depicted narrow layouts have no visible horizontal clipping. These are
  saved captures, not a new browser run or proof of the current runtime layout.
- Traced exact-opening rewards/artwork/selector bindings, unresolved nested
  rewards, conditional bonuses, quantity options and prize-group projections.
  A fresh targeted probe retained all groups/rows in Standard (1/1), Nexus (1/1),
  Greater Banquet December 2025 (4/29) and Superior Banquet December 2025 (5/27).
  Epoch has no captured groups/rows and remains 0/0; no rates were invented.
  Filters retain the recorded values rather than normalizing probabilities.
- Traced the central prestige/combat helpers and actual detail/prototype,
  chart/editor, player overview and roster/global projection consumers. The
  fresh numeric probe gives `ironman_infamous`, 7-star R4 sig200 A2 = **39,730**
  from base 34,060. Exact tier bonuses compose to separate Health/Attack
  multipliers of `1.166399996137619`; the integer sample Attack is 14,399 from
  base 12,345. CR is +30 and Might equals A1's recorded contribution. Carina
  remains A1; lower-star normal discovery stays isolated. Base versus observed
  fixture facts, A0 curve semantics, exact caps and preserved owned observations
  remain distinct in inspected code. No doubled growth or unbound future-tier
  calculation was found.
- Inspected shared logger/request-context initialization: the logger and
  AsyncLocalStorage are process-global singletons; exception listeners have a
  global initialization guard. No limit was raised. This is code evidence only,
  not a measured production memory/leak assessment.
- A small static runtime import closure from ten feature client roots visited
  106 local modules. It found no full game catalog JSON and no temp/scratch or
  `.before` imports. The only data JSON reached was the small reviewed playable
  event exception map and existing stat-icon map. It is not a webpack bundle
  analysis; external packages and dynamic import expressions are excluded.
  Inspected links are internal validated return destinations or source URLs
  constrained to reviewed HTTPS hosts; text is rendered through React. No real
  new HTML/href injection path was identified in this scope.

Fresh validation was **5 passing characterization/proof tests in one audit-only
suite**, one worker. They exercise the two findings, the deliberately independent
archived boundary, exact opening/rate retention and calculation/discovery guards.
The final run is in `repro-results.json`; the minimized values are in
`probe-evidence.json`. This is intentionally not a broad regression-suite claim.
Initial audit harness attempts needed React/Next resolution aliases and complete
prestige endpoint fixtures; those were probe setup errors, corrected only in
ignored outputs. Production files were unchanged.

```powershell
pnpm exec vitest run temp/predeploy-integration-review/repro.test.tsx --config temp/predeploy-integration-review/vitest.config.mts --maxWorkers=1 --reporter=json --outputFile=temp/predeploy-integration-review/repro-results.json
python temp/predeploy-integration-review/client-import-scan.py
```

## Coverage gaps and optional polish — not confirmed release blockers

- **Keyboard/scroll:** previous real-browser key delivery was intermittent and
  the picker reopened once after Enter. Actual crystal-detail return-scroll
  restoration was not conclusively established. Current component tests cover
  the semantic seams, but this review made no fresh browser/Preview session and
  does not reclassify either live gap as a reproduced product defect.
- **Archived boundary:** the intentionally preserved November 3 acquisition
  evidence differs from November 5 detail contents in seven Empire of Doom
  definitions (Gwenom removed). The targeted probe demonstrates that an older
  six-star acquisition entry can lead to a newer detail without Gwenom. The
  independently dated behavior is documented in `docs/champion-crystals.md:56`
  and `docs/crystal-all-reward-catalog.md:74`; no catalog rewrite is recommended
  as part of this assessment. Optional inline archival context would make that
  transition clearer than the collapsed dates alone. Unlike finding 2, those
  host dates correctly describe their respective evidence.
- **Heading polish:** Finder's category headings and default compact card
  headings are both h3 (`crystal-champion-finder.tsx:126-127`). Passing h4 to the
  cards would better express their relationship. Finder's Ascension h2 also
  retains h4 subsections from the champion host. Accessible section names remain
  bound; this is optional hierarchy cleanup, not a functional deploy blocker.
- **Toolchain/production:** no full typecheck, production build, hosted CI,
  production benchmark, live game capture, live inventory/access verification,
  deployment or production-data operation was performed by this reviewer.
  The production/toolchain sibling owns those checks and its own report. Earlier
  205/47, 219/14 and 639 test evidence remains historical and is not represented
  as a fresh final combined run. CI inspection shows the compact semantic suite
  once and the prior prestige/combat/source registrations retained; execution is
  left to the validation owner. Shared dev-server resource pressure is an
  environment constraint, not demonstrated production leakage.

Source hashes for the principal reviewed boundaries and final probe are recorded
in `temp/predeploy-integration-review/snapshot-manifest.json`. No source fix,
commit, PR or release operation was made. Findings were sent to the running
validation sibling; an attempted early parent steer reported no running parent
turn, so the parent receives this review at completion.

## Primary-agent follow-up repairs

The two confirmed findings above were repaired after the read-only review.
Blade's undated objective is now activity-dependent, with no invented end date
or claim of current availability. Its announcement and missing evidence remain
preserved. Dated historical sales retain their past status.

Comparison summaries now carry each resolved content capture date. A shared
date is shown only when the known captures agree; different captures are listed
separately inside the existing single data disclosure. Missing pools do not
acquire an invented capture date.

Regressions reproduced both original defects before the repairs. The four
affected existing suites passed **82 tests**, including the real reader/shared
Blade renderer, exact-opening comparison provenance, and mixed-date rendering.
Scoped ESLint passed with zero errors and five existing fixture warnings;
tracked-file whitespace checks passed. These suites already have CI registrations. Full production validation remains
owned by the separate validation report; this addendum does not claim a build
or deployment.
