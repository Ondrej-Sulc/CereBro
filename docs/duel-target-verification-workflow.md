# Duel verification: observed evidence and resumable dry runs

The [completed additional 18-target pilot](duel-target-pilot-20261109.md) adds 16
full previews, two exact-name misses and 15/15 search-profile/preview core-field
matches. It documents the real result table, 19m20s UI wall time, separate 495.102 ms
resident reads, explicit search-only importer and 53-test verification. The original
two-target evidence and checkpoint below remain unchanged; their counts are historical.

Continuation on 9 November 2026 from the
[offline contract investigation](duel-target-discovery-investigation.md). All source
and code changes remain in the prepared duel worktree. No production write or
authenticated scanner is implemented.

## Two actual public observations

A database-enforced read-only transaction selected exactly two existing ACTIVE
Duel rows, joining only their public champion gameId and retaining source/status/
rank text. No Player, BotUser, account, relationship or alliance data was queried.
The already-open game was navigated through normal Search and pre-duel confirmation.
Exactly two existing target names were submitted, with no random strings or UID
enumeration. Both previews were cancelled; **CONTINUE was never pressed**. The game
was returned to its original quest-selection screen. No launch, login, account
switch, injection, game-method call, process write, match activation or progression
action occurred. No owned browser/game window was created.

| Exact target / public UID | Original CereBro row (preserved) | Observed client duel-preview defender |
| --- | --- | --- |
| `Large Larry` / `258292717` | Duel `704`, `antman_future`, `7* R4`, MCOCHUB, ACTIVE | `highevolutionary_t7` → `highevolutionary`, **7★ / rank 5 / level 65 / sig 200 / ascension 2** |
| `hufersil` / `252695458` | Duel `734`, `betaraybill`, `7* R4`, MCOCHUB, ACTIVE | `spiderpunk_t7` → `spiderpunk`, **7★ / rank 5 / level 65 / sig 200 / ascension 1** |

Capture times: `2026-11-09T10:10:21.017589+00:00` and
`2026-11-09T10:11:39.484328+00:00`, respectively. The original rows have no game UID;
these identities remain **review proposals**, not automatically attached identities.
Both proposals separately flag champion drift and retain the full original
source/status/rank text. No status transition, archival, deletion or source overwrite
has occurred.

The first normal search (`Large Larry`) displayed eight result rows, including the
exact target and other names. The second (`hufersil`) displayed one. This proves
neither complete exact-match search nor arbitrary substring/prefix semantics. It
does show that submitting a full target name need not return only exact matches.
The current UI says names must have at least three characters. Server cap, ordering,
pagination, normalization, rate limits and population coverage remain unproved.

### Receipt kind and bounds

These are **`client-memory-duel-preview` receipts**, not saved raw server service
results. They read the one reviewed preview's named `_profile`, `_sparxData` UID/name,
`_topChampion`, first top-hero pointer, `mUserHero` build and exact blueprint
Character/Rarity fields. In both observations the first `_topHeroes` pointer equaled
the exact `_topChampion` used by the visible duel preview. Class names and identity
were checked before reading the build. There was no profile-cache dump, friend/
alliance-roster export, raw profile dictionary, account/session/header export or
whole-memory capture. Only UI-routing pointer containers were traversed to locate
the visible confirmation; all unrelated object contents were excluded.

The external reader used **0x410** process access (query information + VM read),
bounded to 1,024 reads, 65,536 total bytes, 1,024 bytes/read, two seconds of reads,
and 256 UTF-16 characters per named string. Named object/type/layout checks fail
closed. Binary, named-layout, helper and reader SHA-256 gates were checked before
capture. Process/module snapshot handles and each profile-read handle close in
`finally` paths. Both successful receipts report `handleClosed=true`:

- Large Larry: **251 reads / 6,968 bytes / 21.333 ms** in the read portion.
- hufersil: **251 reads / 6,920 bytes / 11.072 ms** in the read portion.

These times exclude navigation, server loading, source hashing and tool overhead.
They measure external reads of already resident client fields, **not server latency
or profiles/second**. Two initial local reader runs stopped before profile fields
because the UI-routing dictionary had 20 entries against a provisional 16-entry
gate. That routing-only bound was reviewed and set to 32 while retaining the
65,536-byte/read/time ceilings. This was a local layout gate, not an access or
throttling failure; its handles also closed. No access denial was bypassed.

### Exact current catalog join

The installed binary still hashes to
`01f46bb2e36c2160a8df939bbb080bcf2ee89ca15427692a10334efc90fd4abb`.
The public BCG cache refreshed when the chosen account's normal client loaded:

```text
C:/Users/ossul/AppData/LocalLow/Kabam/Champions/bcg/out/v1/0C75671AC12E11F3AB1663F52BA7AAC8C093C638.bin
SHA-256 b54879955b972b9993891df4bea54c339627c05a64ad4a3a7b15f30ae23b0fd7
```

Its named protobuf blueprints independently establish the two exact blueprint →
Character → explicit Rarity joins above, agreeing with the typed client fields.
No star suffix or champion-name inference was used. The earlier BCG filename in
the initial report is historical and is no longer present in that cache.

The live reader's pinned named layout is
`edae015657b738a0ce4958e163fd5191f3e452a362122f407b5bbc9800bb2eae`,
the read-only helper is
`edd46c2014f0e35bf819e992411dface976195fb7ec70eb3181bc08cc063ddac`,
and the exact reader is
`16c1a125eb2912b21d260c7c6350df8b5978107e9c2b9780458705767b9849b9`.
`reader-gates.json` additionally records native verification of
`WindowManager.get_Instance` at RVA `0xD5A300`, its type-info reference
`0x60F36C8`, static-fields `+0xB8` and instance `+8`. The metadata binds
`WindowManager.windowStacks` → `WindowInfo.window` → `DuelConfirmationPopup._profile`,
then the profile/hero fields identified in the original investigation.

Coverage is **two public preview profiles with complete core blueprint/star/rank/
level/signature/ascension fields**. Focus, cosmetic, relic and final combat-stat
completeness were not collected/proved. There are **zero raw server receipts** and
**zero actual normal-client bulk receipts**. The static bulk contract remains useful,
but bulk completeness and scaled server throughput remain **UNKNOWN**. An activated
server defender remains unobserved because no duel was activated.

## Implemented workflow

`src/domain/duel-target-verification.ts` now has separate adapters:

- `parseSingleProfile`: wraps the direct single-profile service dictionary; it
  does not guess an HTTP envelope.
- `parseClientDuelPreview`: accepts the bounded reader format with an explicit
  client-memory receipt, capture time, first-hero binding, closed 0x410 reader and
  exact source-catalog join. It rejects a server/fixture receipt used in its place.
  This creates an allowlisted projection from named fields; it does not claim the
  original payload contained raw `gamestats.top` wire keys.

`src/domain/duel-target-job.ts` provides pure, server-side local job functions:

1. `createDuelVerificationJob` binds source namespace, planned time, exact public
   target snapshot (including source/status/rank text), catalog projection hash,
   contract/parser versions and finite budgets into a job ID.
2. `nextDuelRead` deduplicates known UIDs, keeps exact-name work separate, and returns
   a **description only**. Name reads are single; only known UIDs can form batches.
   There is no network dispatcher or concurrency growth. The planner enforces finite
   request/attempt/batch budgets, exponential retry floors, a source-wide throttle
   pause and explicit Retry-After timestamps. Authorization/unsupported-contract
   outcomes stop the job. A real transport would still need its own authorized
   access, elapsed-time limit and jitter; no live transport policy is claimed here.
3. `importDuelEvidence` imports one already saved, sanitized evidence result. A
   single client observation cannot establish a bulk response. Unrequested IDs,
   lossy identities, oversized requests, future capture times, out-of-order/early
   retries and wrong receipt kinds are rejected. Parser issues quarantine an attempt
   rather than becoming a clean “missing” response. Omitted IDs in a valid bulk
   receipt stay missing/retryable; duplicate/conflicting IDs remain ambiguous.
4. `exportDuelCheckpoint` / `importDuelCheckpoint` validate strict JSON shape and
   bind state to the expected input. The checksum detects corruption/drift; it is
   **not an authorization signature**. Source content/capture/request identity
   dedupes reimported successful receipts. No attempt budget is spent twice.
5. `duelReviewProposals` retains original catalog values, candidate identities,
   observed fingerprints, capture/import times and last successful observations.
   It never exposes an apply/delete/status-write operation. Name-only matches
   remain `identity-review` even when their champion drift is evident. Missing,
   not-found, unavailable, throttled, unsupported and pending states stay explicit;
   none establishes a deleted account. A later failure preserves the prior successful
   observation in the checkpoint/review output.

Fingerprints bind blueprint/gameId/stars/rank/level/signature/ascension and known
focus/cosmetic fields; names and timestamps are separate. Optional
`lastObservedAt` / `lastObservedFingerprint` plus `freshnessMaxAgeMs` allow source-time
freshness skipping and cross-job delta comparison. Every association of a duplicate
UID must be fresh before skipping it, future times are never fresh, and time is
reevaluated on resume. Supply only reviewed source-observation values here, never
application `updatedAt`. Keep earlier checkpoints/receipts when starting a new
periodic job. Fingerprint equality is equality of observed fields, not the whole
combat state.

`src/scripts/verify-duel-targets.ts` is the runnable importer. It hashes each supplied
file, checks the exact catalog projection hash and atomically writes a checkpoint
after each imported result. Output stays under this checkout's ignored
`temp/duel-target-investigation/`, and cannot overwrite an input file. It requires
explicit `single-profile`, `bulk-profile` or `client-preview` source format. Client
receipts derive capture time from the captured payload; server receipts require an
explicit source capture time. Raw client captures cannot become saved server receipts.

No DB client, game API, account authentication or live scanner is imported by the
durable workflow. The actual two-target checkpoint contains two successful evidence
imports, two distinct public UIDs and two `identity-review` proposals with
`championChanged=true`. A repeat run left checkpoint bytes identical and the attempt
count at two. Acquisition can be complete while both review decisions remain pending.

## Reproduce the actual dry run offline

Run in `C:/Users/ossul/.t3/worktrees/CereBro/t3-fb968324`:

```powershell
./node_modules/.bin/tsx.cmd src/scripts/verify-duel-targets.ts --spec temp/duel-target-investigation/live-dry-run-spec.json --blueprints temp/duel-target-investigation/observed-blueprints.json --bundle temp/duel-target-investigation/live-evidence-bundle.json --checkpoint temp/duel-target-investigation/live-checkpoint.json --report temp/duel-target-investigation/live-review-proposals.json
```

This reuses files only; it performs no database/game read or request. Repeat the same
command to exercise resume/idempotence. Do not rerun `prepare_live_dry_run.cjs` first:
its new planned time intentionally creates a different input binding.

Job spec fields are `namespace`, `plannedAt`, `catalogSha256`, `contractVersion`,
`parserVersion`, `budgets {maxRequests,maxBatchSize,maxAttemptsPerIdentity,backoffMs}`,
and `targets [{duelId,playerName,playerId,championGameId,source,status,rankText,stars?,
lastObservedAt?,lastObservedFingerprint?}]`, with optional `freshnessMaxAgeMs`.
Only reviewed identities should populate `playerId`; keep it null for candidate
name resolution. Evidence bundle entries contain a reviewed `request {kind,values}`,
`result`, optional `file`, `format`, `source`, `capturedAt`, `recordedAt`, `retryAt`.
Files are relative to the bundle. Blueprint rows are
`{blueprintId,championGameId,stars}`; their exact file hash must match the job.

The two-target spec sets a two-import budget, batch size one and one attempt per
identity. These are local pilot bounds, not server capacity measurements. Core
client fields require exact joins; absent fields remain null. Raw captures remain
in ignored artifacts. Regression tests use invented
identities and sanitized/reconstructed contract shapes, not an alleged live server fixture.

## Checks and local measurements

New suites for later parent CI registration:

- `src/domain/duel-target-verification.test.ts` — 14 tests.
- `src/domain/duel-target-job.test.ts` — 14 tests.

Combined with the unchanged importer/public projection suites, **42 tests pass**:

```powershell
./node_modules/.bin/vitest.cmd run src/domain/duel-target-job.test.ts src/domain/duel-target-verification.test.ts src/services/duelImportService.test.ts 'web/src/app/champions/[slug]/duel-targets.test.ts' --maxWorkers=1
./node_modules/.bin/tsc.cmd --noEmit --strict --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext src/domain/duel-target-verification.ts src/domain/duel-target-verification.fixtures.ts src/domain/duel-target-verification.test.ts src/domain/duel-target-job.ts src/domain/duel-target-job.test.ts src/scripts/verify-duel-targets.ts src/scripts/benchmark-duel-target-verification.ts
& C:/Code/CereBro/web/node_modules/.bin/eslint.cmd -c C:/Code/CereBro/web/eslint.config.mjs src/domain/duel-target-verification.ts src/domain/duel-target-verification.fixtures.ts src/domain/duel-target-verification.test.ts src/domain/duel-target-job.ts src/domain/duel-target-job.test.ts src/scripts/verify-duel-targets.ts src/scripts/benchmark-duel-target-verification.ts
./node_modules/.bin/tsx.cmd src/scripts/benchmark-duel-target-verification.ts --iterations 100 --out temp/duel-target-investigation/offline-report-v2.json
```

Strict scoped TypeScript and scoped lint pass. Lint retains the existing environment
warnings about React detection/browser metadata/pages location. No full web
typecheck/build ran. The importer dependency gap was resolved solely by adding this
checkout's missing `src/node_modules` junction to existing
`C:/Code/CereBro/src/node_modules`; no dependency installation, manifest, lockfile or
shared dependency edits were needed.

The version-two benchmark additionally exercises the bounded job scheduler over
5,000 synthetic rows / 2,500 distinct IDs, separately from local profile projection
and simple batch planning. Its five samples and median milliseconds are preserved
in `offline-report-v2.json`. These are in-memory CPU measurements, excluding JSON I/O,
source hashing, navigation and server work. No profiles/second claim is supported.

## Artifact inventory and integration handoff

Ignored `temp/duel-target-investigation/` contains:

- `two-public-targets.json`: read-only public catalog snapshot.
- `large-larry-client-preview.json`, `hufersil-client-preview.json`: actual allowlisted
  named-field observations, source times, gates and closed-handle/read counters.
- `reader-gates.json`, `layouts.json`, `capture_public_duel_preview.py`,
  `prepare_reader_gates.py`: narrow reader and pinned native/layout/helper proof.
- `current-bcg-source.json`, `observed-blueprints.json`: current static source hash
  and exact joins for the observed champions.
- `live-dry-run-spec.json`, `live-evidence-bundle.json`, `live-checkpoint.json`,
  `live-review-proposals.json`: runnable input, atomic resume state and review output.
- `offline-report-v2.json`: local-only measurements, with server throughput null.

Durable files in this worktree (including the initial increment) are exactly:

```text
docs/duel-target-discovery-investigation.md
docs/duel-target-verification-workflow.md
src/domain/duel-target-verification.ts
src/domain/duel-target-verification.fixtures.ts
src/domain/duel-target-verification.test.ts
src/domain/duel-target-job.ts
src/domain/duel-target-job.test.ts
src/scripts/benchmark-duel-target-verification.ts
src/scripts/verify-duel-targets.ts
```

Next integration step: root reviews the two candidate UID links and the changed
defenders against preserved source rows. Any future database identity/observation
storage must remain additive and keep MCOCHUB attribution and moderation status.
No apply action or schema migration is included here. An authenticated bulk reader
still requires a sanctioned transport and an **actual normal-client bulk result**
for the two now-known UIDs; two individual client captures cannot supply that proof.
Without that result, leave bulk completeness/rates unverified and use this saved-
evidence pipeline. No further client interaction is needed for this increment.

No web UI/server/preview, screenshot artifact, commit, PR, push, migration, database
write, deployment, Discord message or existing-port change was performed. The actual
native previews were inspected through the computer-use skill; no synthetic image
was created. Root owns review and release.
