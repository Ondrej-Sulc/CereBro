# Duel target discovery and periodic verification

**Latest continuation completed 9 November 2026:** the additional 18-target
[live pilot](duel-target-pilot-20261109.md) produced 16 complete client previews,
eight changed champions and two exact-name misses. All 15 paired typed search
profiles match their selected previews. Search-only evidence now has its own
resumable review importer; 53 focused tests pass. Bulk/server throughput remain
unproved. The original two observations and source/status records are preserved.

**Earlier continuation:** two existing public targets were
observed through the already-open normal client and a bounded external read-only
named-field reader. Both current preview defenders differ from their saved Duel
champion/rank text. There are now a runnable importer, input-bound checkpoint,
UID/name dedupe, fingerprints, bounded retry/resume planning and review-only proposals.
See [current evidence and reproduction](duel-target-verification-workflow.md).
The earlier importer dependency gap is fixed by a checkout-only `src/node_modules`
junction; all 42 focused/helper/importer/public-projection tests now pass.

The sections below retain the **initial offline phase** and its historical limits;
the continuation supersedes its zero-live-observation and missing-dependency status.

Investigated 9 November 2026 in the prepared research checkout, based on deployed
`a90cb03ce2235b05113d4153bd31818d5a1acfaa`. This increment is entirely offline.

**Finding:** the saved client supports name search, individual profile reads by
Int64 game UID, and bulk profile reads by UID. Therefore resolving identity once
can remove repeated name searches from periodic verification. The modern profile's
first `top.h` hero is demonstrably the client-selected duel defender, independently
of the custom avatar. This proves the profile → confirmation → outgoing duel request
binding. **It does not prove what a current server would return, that bulk/search
responses always include complete builds, or the server-activated defender.** No
duel was activated and no game/server request was performed.

## Evidence and reproducibility

Primary sources are the installed game bytes, named Cpp2IL metadata and saved native
disassembly/ISIL, rather than community descriptions of “main champion.” The earlier
game-only investigation identifies this matching binary as 59.1.0 / CL 1456141. The
files below were rehashed directly during this investigation:

| Source | SHA-256 |
| --- | --- |
| `C:/Games/Marvel Contest of Champions/default/game/GameAssembly.dll` | `01f46bb2e36c2160a8df939bbb080bcf2ee89ca15427692a10334efc90fd4abb` |
| `D:/CodexArtifacts/Cpp2IL-2026-11-03-addresses/Marvel.Runtime.dll` | `d1b1085922513073b9dcd656aa08ee70e01a7aef1433aa35876fdfba463278b5` |
| Adjacent `Fuse.Runtime.dll` | `c7296f9c50334d3f12ece5ae2e7c9566d6965cc355c9eecad8af8acfe561a24b` |
| Public BCG `C:/Users/ossul/AppData/LocalLow/Kabam/Champions/bcg/out/v1/E95E28EECECC04D6A358C8FD8089D01305D0FB73.bin` | `b821489b5451d1d6ee0927f39a80d964f6c1d3aaf13bd76531e5f77d93deba8e` |
| Saved named schema `C:/Code/CereBro/temp/crystals/schema.json` | `9cc5236aef043cf7e5655458e790ed1f0897f67398e37af3020bca74511e97c4` |

The allowlisted BCG was read as a static protobuf file. Named contracts bind
`BCGDataBuffer` tag 3 `heroes_blueprints`, and `BCGBlueprintBase` tags 1 `Blueprint`,
2 `Character`, 14 `Rarity`. Direct decoding establishes
`storm_rar → Character=storm, Rarity=3`. No suffix inference is used. Existing
`scripts/extract_mcoc_crystals.py`, `scripts/mcoc_protobuf.py` and
`scripts/export_mcoc_proto_schema.py` establish the repository's extraction pattern.

All probe scripts/results are under this checkout's already ignored
`temp/duel-target-investigation/`. `source-manifest.json` pins the sources and
111 named method ranges read from the installed PE, with RVA/length/native-byte
hashes. `code-evidence.json` retains exact method signatures, original source lines,
ISIL and per-source hashes. `layouts.json` records named fields/offsets.
`blueprint-proof.json` records the direct protobuf join. No new process capture,
private profile cache, credentials, login or account/session material was read.

The ISIL source root in the following citations is
`D:/CodexArtifacts/Cpp2IL-2026-11-03/IsilDump/`. Line numbers refer to its original
`.txt` files, not the shortened evidence copies. ISIL instruction numbers below are
local to the named method. Cpp2IL is a client-code reconstruction; no server
implementation was established from this evidence.

## 1. Search, profile and duel contracts

### Search and profile reads

These are relative paths constructed by the game client, **not a documented public
API or an implementation of an external authenticated reader**. Host selection,
authentication/signing, access policy and current permitted request rates remain
outside the offline proof. All three profile methods use the endpoint virtual slot
`+552`, also called by named `MatchAPI.Post`; `MatchAPI.Get` uses `+536`. Thus these
are **POST requests with read behavior**, despite the names `GetProfile` and
`GetProfilesBulk`. The profile API constructor sets `api=1`.

| Client method / path | Request data proved in client | Parsed service result | Limits and unknowns |
| --- | --- | --- | --- |
| `EB.Sparx.UserProfileAPI.FindProfiles(name, maxResults, callback)` / `/userprofile/find` | `api=1`, unchanged `name`; `maxResults` added only when >0 | Manager callback reads `users` array and constructs abbreviated profiles | `FriendsSearchState.Search` requests **10**. This is a requested UI limit, not a proven server hard cap. |
| `GetProfile(Int64 uid, callback, allowConcurrent=false)` / `/userprofile/` | `api=1`, `uid` as Int64 decimal string; `allowConcurrent` sets a request flag, not request data | Manager callback parses the returned dictionary itself as one full profile | No collection/pagination here. A transport success without a valid profile UID becomes client error `notFound`. |
| `GetProfilesBulk(ArrayList uids, callback)` → `GetProfilesBulk(IList uids, IList onlineStatusOnlyUids, callback)` / `/userprofile/bulk` | `api=1`, `uids`; conditional `onlineStatusOnlyUids` behind the manager flag | Manager callback reads `users` array, parses abbreviated profiles and indexes by Int64 UID | Client bulk batching exists. No maximum UID count, server cap, ordering guarantee or per-ID missing/error semantics established. |

Exact identities:

- `Fuse.Runtime/EB/Sparx/UserProfileAPI.txt:42`, `GetProfile`, RVA `0xE3B820`;
  `:196`, bulk convenience overload, RVA `0xE3B950`; `:266`, bulk overload,
  RVA `0xE3B9E0`; `:532`, `FindProfiles`, RVA `0xE3B6C0`.
- `Fuse.Runtime/EB/Sparx/UserProfileManager_NestedType___c__DisplayClass49_0.txt`,
  `<FindProfiles>b__0`: reads `users`; `__DisplayClass46_0.txt`,
  `<GetProfilesBulk>b__0`: reads `users`; both pass `abbrivated=true` to `ParseData`.
- `Fuse.Runtime/EB/Sparx/UserProfileManager_NestedType___c__DisplayClass45_0.txt`,
  `<GetProfile>b__1`, ISIL 21–66: parses the result directly with
  `abbrivated=false`; returns `notFound` when its UID fails validation.
- `Marvel.Runtime/FriendsSearchState.txt`, `Search(EB.Action onComplete)`, ISIL
  69–102: avoids empty and unchanged searches, forwards the input and requests 10.
  `OnSearchInputUpdated`, ISIL 83–117, gates controls by the manager's
  `name_min_search_len` field (offset 52). Its current configured value is unknown;
  CereBro's suggestion modal minimum of 3 is not game protocol evidence.
- `Fuse.Runtime/EB/Sparx/MatchAPI.txt:104` `Get`, `:186` `Post`: identify endpoint
  virtual slots; `UserProfileAPI` uses the POST slot.

No cursor, offset, page, `hasMore` or total field is sent/consumed in these traced
search methods. This is absence of pagination in this client path, not proof of
every capability the server might have. Arbitrary strings returning matches is the
user's observation. The client does not establish prefix versus substring versus
token matching, wildcard escaping, case/accent normalization, whitespace behavior,
minimum server length, sort stability, exact-name precedence or result completeness.
No `%`, `*`, Unicode-range or numeric-ID enumeration strategy is presumed supported.

### Returned identity and champion/build fields

`Fuse.Runtime/EB/Sparx/UserProfile.txt:62`, `ParseData`, reads exact `uid` and `name`,
plus `gamestats`. It separately reads `current_avatar.foreground/background/...`.
UID is wrapped as `EB.Sparx.Id`; profile APIs and bulk dictionaries use Int64.
Store it as a decimal string in JSON/TypeScript: JS numbers can silently round it.
UID stability across a rename is the intended client identity model; cross-realm
uniqueness, account merging and permanent lifetime guarantees are not independently
established. Keep a source/backend namespace alongside it.

The modern game `UserProfile` constructor retrieves JSON stat `top`, then `h`:

| Modern `top.h[]` key | Explicit binding in `UserProfile` constructor | Verification use |
| --- | --- | --- |
| `b` | `HeroData` blueprint ID (`bid`) | Exact join to BCG `Blueprint → Character, Rarity` |
| `r` / `l` / `sl` | `rank` / `level` / `sig_lvl` | Record only explicit values; no missing-field defaults |
| `at` | `ascensionTier` | Ascension; **`a` is not ascension** |
| `a` / `h` | `attack` / `max_hp` | Profile display observations, not independently established final combat stats |
| `rat` / `rhp` | `rating_attack` / `rating_hp` | Preserve source distinction; no inferred prestige sorting |
| `ratb` / `rhpb` | `rating_attack_base` / `rating_hp_base` | Base rating observations |
| `sp` | `special_attacks` | Not a star count |
| `sfa` / `sfd` | `stat_atk` / `stat_def` | Stat-focus attack/defense strings |
| `c` | cosmetic | Cosmetic separate from base champion identity |
| `rl` | relic override created through `Relics2Manager` | No claim the small helper fully projects relic/combat state |
| `pce` | `ptve_cooldown_expiry` | Not defender identity or freshness |

`time_last` is last login, **not source observation time**. Client-created
`_createTime` is also distinct from a server update timestamp. No reliable server
profile-modified timestamp, ETag or conditional delta token has been proved.

### Defender binding: what is proved

1. `Marvel.Runtime/UserProfile.txt:699`, `.ctor(EB.Sparx.UserProfile)`, RVA
   `0x3661150`, ISIL 442–818, reads `GetJSONStat("top") → h`, constructs each
   `HeroData` in list order and binds the fields above. ISIL 845–879 selects index
   zero and stores `_topChampion` at offset 112. No highest-prestige recomputation
   is performed on this path. `get_TopChampion`, `:291`, RVA `0x5A1A90`, directly
   reads offset 112.
2. `Marvel.Runtime/DuelConfirmationPopup.txt:331`, `SetupWindow`, ISIL 335–344,
   gives that profile's offset-112 `HeroData` to `HeroPlaqueWidget.UpdateDisplay`.
   `:1960`, `OnContinueClicked`, ISIL 11–27, reads the **same offset 112** and
   calls `GameDuelUtils.EnterDuelMode(profile, hero, false, returnState)`.
3. `Marvel.Runtime/GameDuelUtils.txt:1073`, `EnterDuelMode`, stores that profile and
   hero in `DuelMode.Config` at offsets 16/24. `Marvel.Runtime/DuelMode.txt`,
   `InitDuel(TeamData, GameStorePricing)`, copies its selected hero's blueprint and
   `BCGUserHero` build into named `DuelRequestMatchData` fields. Those named fields
   have offsets 24 (`opponentUid`), 32 (`opponentHeroBid`), 40/44/48
   (`opponentRank/Level/SigLvl`), 96 (`opponentAscensionTier`).
4. `Marvel.Runtime/DuelRequestMatchData.txt:3`, `addToRequest`, RVA `0x3356CF0`,
   writes `ouid`, `obid`, `r`, `l`, `sl`, `at`; also `ubid` (own attacking
   blueprint), `sa`, `osa`, `osd`, `c`, pricing IDs and `pvp_ver`. `GameDuelUtils`
   chooses `duel_fight` or `practice_fight`; `MatchAPI.ActivateMatch` constructs
   `/matches/activate-match/{matchType}` with POST. **This activates gameplay and
   is excluded from read-only verification.**

There is a material legacy fallback: if the top hero list is missing/empty,
`UserProfile` can call `HeroData.CreateForDisplay(ush, 1, 1, ...)`. That provides
display defaults, not evidence of a player's rank/level/signature. The helper
marks this `legacy-ush` with no verified defender/build. A custom avatar, prestige
number, favourite team, UI rank text or inferred blueprint suffix is never a substitute.

`DuelMatchData` parses `matchId`, `ouid` and rewards; it is not evidence of a
separate server-returned defender blueprint/build contract. No current server
response or saved real duel activation proves whether the server accepts, replaces
or refreshes the submitted build, or adds combat modifiers. The strongest honest
label available now is **source-bound client duel-preview observation**.

## 2. Existing CereBro targets and stable-ID verification

Current `prisma/schema.prisma:290` `Duel` stores `playerName`, free-text `rank`,
`championId`, source/status, submitter and created/updated times. Its unique key is
`(championId, playerName)`. There is no game player UID, canonical blueprint/star,
source capture timestamp or verification receipt. `updatedAt` is an application
edit/import time; it must not be relabeled “last game verified.”

`src/services/duelImportService.ts` fuzzy-matches community champion names, dedupes
input by lowercase name+champion, marks that source's ACTIVE rows OUTDATED, and
upserts incoming rows by champion+original name. It skips source-matching archived
rows; an upsert can replace a row's source. That behavior is suitable for its current
reviewed source refresh contract, but is unsuitable for partial game verification.
Do not feed probe results through it or overwrite community attribution. No importer
behavior changed here.

`src/commands/champion/duelUserHandlers.ts` records user suggestions and outdated
reports with their existing moderation/notification flow. The public projection
`web/src/app/champions/[slug]/duel-targets.ts` retains active/outdated grouping and
external source credits. Admin actions use `requireBotAdmin("MANAGE_CHAMPIONS")`.
No auth, account identity, permissions, status, source credit or saved observation
was changed by this increment.

Resolve each legacy name once, review identity ambiguity, then attach the returned
source-namespaced UID. Periodic reads can dedupe many rows/sources/champions sharing
one UID into one profile request. The client exposes bulk reads, so **bulk by UID
is supported by this client contract**, rather than an invented optimization.
However, search and bulk callbacks parse abbreviated profiles. Until one saved
sample proves that their modern `top.h` build is complete, plan a single-profile
fallback for incomplete IDs. Do not use the online-status-only lane to verify a
defender. Match bulk results by returned UID, never array position. A missing UID
is an omitted/missing observation, not evidence the account was deleted.

## 3. Discovery without random-name scanning

Start with existing exact names and review queues, especially champions/star builds
with few recent targets or known changes. Reuse source-backed names already submitted
or in authorized public sources. Do not enumerate raw UID ranges. Prioritize a
known UID's refresh over discovering another duplicate name.

Prefix refinement is useful **only after an empirical check establishes actual
prefix matching** and allowed minimum length. For a saturated query, subdivide
using observed name characters and dedupe all results by source+UID. A requested
10 results yielding 10 is a saturation warning. Fewer than 10 proves no completeness
when the server's cap/filtering/order are unknown. Record overlapping queries,
unique IDs gained, new useful champion/star builds, response hashes and saturation.
Stop low-yield branches and enforce a total query/response/elapsed-time budget.

If matching is substring-based, extending a string on either side creates overlapping
samples rather than an exhaustive prefix tree. Keep exact query bytes and observed
normalization; budget targeted substrings from existing names, not Cartesian
products of an assumed alphabet. Names with spaces, punctuation, diacritics and
non-Latin characters prevent an ASCII-only strategy from claiming full coverage.
Search ranking or truncation may hide players even within a refined branch.

Use a bounded experimental matrix of known consenting/public profiles: one exact
name, one known prefix, one known interior substring and a case variant. Establish
semantics and restrictions first; do not run that matrix automatically here. Only
support observed query forms. Neither a large dictionary nor a saturated-tree walk
can establish “all players” without a documented complete enumeration mechanism.
Report coverage as **distinct observed UIDs / useful reviewed targets / saturated
queries within this budget**, never a percentage of an unknown population.

## 4. Bounded operations, caching, retries and response states

The following numbers are proposed local guardrails, not measured server limits:
initially concurrency **1**, no automatic increase; at most one new read every
**2 seconds**, a **10-request / 20-UID / 60-second** pilot budget, then stop for
review. Count retries and per-ID fallbacks against both budgets. Bulk size starts
at **2 known UIDs** for the empirical proof; the offline benchmark's size 10 is
only a CPU scheduling parameter. Root must establish an approved supported reader
and allowed rate before enabling any transport. Client `allowConcurrent` is not
permission for broad concurrency.

For a future authorized reader:

- Keep a shared per-backend queue and global limiter, not one limiter per worker.
  Bound in-flight requests, bytes, batch size, deadline and total requests. Do not
  evade an access restriction by switching accounts, endpoints or IPs.
- Honor an explicit server retry delay; never retry earlier. On throttling pause
  the whole queue. On timeout/5xx use exponential delay with full jitter, proposed
  base 2 seconds and at most 2 retries; stop at the job deadline. If Retry-After
  exceeds the job budget, checkpoint and defer instead of shortening it.
  Stop on authorization/access failures. Decode errors quarantine the response
  and stop that contract version. Do not retry non-idempotent match activation.
- Reuse successful source-namespaced profile observations with source capture
  times; freshness is a policy by champion demand, last change and uncertainty.
  Proposed routine TTL 7 days, shorter for frequently changing/useful targets.
  Do not turn cached reads into new verification dates. A forced-refresh flag in
  the client is not proof of server cache bypass. No ETag/delta API is established.
- Compute a normalized defender fingerprint including blueprint, exact star,
  rank/level/signature/ascension and known focus/cosmetic fields; diff observations
  locally. Preserve raw source hashes separately. An unchanged fingerprint is
  unchanged observed fields, not proof the whole combat state is unchanged.
- Persist an atomic offline checkpoint bound to input hash, contract/parser version,
  catalog hash and job ID, with successful IDs, pending IDs, attempts and next-eligible
  times. Resume only the same job and immutable input. Missing/throttled IDs must
  remain pending or receive an explicit deferred observation; do not mark the batch
  complete simply because its request completed. Deduplicate repeated receipts.

| Observation | Meaning and action |
| --- | --- |
| Same UID, changed exact name | Rename proposal; retain old name as historical alias and preserve all source rows |
| Name-only result, even one exact match | Candidate identity requiring review; name reuse is possible |
| Multiple same-name results or conflicting duplicate UID rows | Ambiguous; retain each candidate/receipt; do not pick by champion or popularity |
| Same UID, different exact champion/star | Defender-change proposal; retain prior observation and submitter/source/status |
| Missing build/star mapping or legacy `ush` | Incomplete/unsupported evidence; no verified build defaults |
| Successful direct read yields invalid/missing UID (`notFound` client behavior) | Not-found observation for that lookup; not proof of deletion |
| UID omitted from successful bulk result or empty search result | Missing in this response/query; may be truncation, filtering or partial data |
| Explicit documented permanent account-deleted response | A future distinct deleted observation; **no such response contract is established here** |
| Transport failure, throttling, maintenance, auth failure | Unavailable/deferred, retaining error class and next retry; preserve last successful observation |

A parser issue must not be transformed into a clean authoritative “missing” result.
No outcome automatically archives/deletes or marks an existing row outdated. Even
repeated not-found observations need review and an established permanent-response
contract before changing catalog status.

## 5. Practical phases and exact proposed schema/API changes

### Implemented now

`src/domain/duel-target-verification.ts` is a transport-free parser and identity
reconciler. It accepts the already decoded service result `{users:[...]}` from
search/bulk, retains only allowlisted identity/defender fields and a source receipt,
uses exact BCG identity joins, and never fills missing builds from client defaults.
For a saved **single-profile service result**, an adapter can wrap that returned
dictionary in `users`; the helper does not guess an outer HTTP envelope. Only an
object-valued `gamestats.top.h` is supported. Encoded/changed stat shapes are unknown.
No actual saved player-response fixture was available in the allowlisted evidence.

The fixture explicitly uses invented player name/UID and a reconstructed modern
contract, with a real static `storm_rar → storm / 3★` join. Its rank/level/signature
values are illustrative saved PvE values, **not a real player's duel observation**.
Its evidence kind is `static-contract-fixture` and capture time is null. Tests
cover first-hero binding, avatar separation, `a` versus `at`, missing fields, bad
IDs, invalid receipt/stat shapes, ambiguity, renames/name reuse, champion/star drift,
temporary failures, stable-ID dedupe, freshness and resume inputs. All proposals
require review; there is no database mutation or deletion output.

The harness optionally accepts sanitized saved service results and an exact blueprint
map. A saved-input receipt hashes that supplied file and requires a capture time;
the operator is responsible for a truthful capture time and source-bound catalog.
Parser failures remain visible in `issues`. Do not apply proposals with parser
issues. Proposals intentionally say `same-defender`, not `live-verified`.

### Next integration phases

1. Obtain the tiny sanctioned saved-response proof described below. Establish
   source completeness and the approved transport before any scheduler exists.
2. Export a reviewed read-only Duel snapshot (outside this increment), with its
   source/status/submitter and application revision; resolve legacy names to reviewed
   IDs offline. Produce `unresolved`, `ambiguous`, `renamed`, `same-defender`,
   `defender-changed`, `build-incomplete` and `unavailable` proposal queues.
3. Add append-only observation storage and reviewed identity links. Retain existing
   Duel rows and community credits; compare-and-swap application revision and input
   hash before accepting an explicit reviewed delta. Treat archived targets and
   old source imports according to existing moderation, without reactivation.
4. Add bounded pilot verification for already reviewed IDs, then periodic work with
   checkpoints, backoff and coverage metrics. Discovery remains a separate budget.
   Expand only after real response completeness/latency/throttling evidence exists.

Proposed additive Prisma/application contract, **not applied and no migration**:

| Entity / exact proposed fields | Keys/invariants |
| --- | --- |
| `GameDuelIdentity { id, sourceNamespace, gamePlayerId:String, currentName:String, createdAt, updatedAt }` | Unique `(sourceNamespace, gamePlayerId)`; name not unique. Distinct from CereBro `Player`, Discord `BotUser`, login or roster ownership. |
| `DuelIdentityLink { duelId:Int, identityId, reviewedByBotUserId, reviewedAt, evidenceObservationId }` | One current reviewed identity per Duel; preserve link history as audit events. No automatic fuzzy/name-only link. |
| `DuelProfileObservation { id, identityId?, jobId, outcome, requestedPlayerId?, queryText?, observedName?, blueprintId?, championGameId?, stars:Int?, rank:Int?, level:Int?, signature:Int?, ascensionTier:Int?, statFocusAttack?, statFocusDefense?, cosmetic?, binding, sourceNamespace, sourceCapturedAt:DateTime?, importedAt:DateTime, responseSha256, catalogSha256, contractVersion, parserVersion, evidenceKind, errorClass?, retryAt? }` | Append-only. Explicit unknowns/nulls. Unique receipt key scoped by source/capture/request/hash; repeated identical content at a later capture remains a new observation. Restrict raw/query retention and access. |
| `DuelVerificationJob { id, inputSha256, catalogSha256, contractVersion, parserVersion, mode, budgetsJson, checkpointJson, startedAt, finishedAt? }` | `mode=DRY_RUN` by default. Checkpoint successful IDs plus pending/attempt state. Store no secrets. |
| `DuelVerificationReview { id, jobId, duelId, observationId, expectedDuelUpdatedAt, proposedChangeJson, reviewedByBotUserId?, reviewedAt?, appliedAt? }` | Preserve old values and statuses. Enforce existing MANAGE_CHAMPIONS authorization; transactionally reject stale input. No generic bulk delete. |

`championGameId` must join existing `Champion.gameId` exactly; `stars` is explicit
BCG rarity. Keep a full source blueprint identity even when champion mapping is
missing. Free-text legacy `Duel.rank` remains intact. No new game source enum or
replacement of `Duel.source` is required: game observations have their own source
namespace and coexist with community/manual sources. Maintain all existing author
and source receipts.

Proposed server-action/application APIs, not game endpoints and not implemented:

```ts
planDuelVerification({ duelIds, expectedSnapshotHash, namespace, budgets, freshnessPolicy })
// -> { jobId, unresolvedNames, uniquePlayerIds, plannedBatches, dryRun: true }
importSavedDuelProfileEvidence({ jobId, receiptManifest, sanitizedServiceResults })
// -> { observations, parserIssues, reviewProposals }; no Duel mutation
reviewDuelVerification({ jobId, proposalIds, decisions, expectedSnapshotHash })
// -> reviewed immutable delta; existing requireBotAdmin("MANAGE_CHAMPIONS")
applyReviewedDuelVerification({ reviewId, expectedDuelRevisions })
// future explicit administrative action; transactional, no automatic deletion
```

No transport endpoint, API credential flow, background queue, status transition or
schema change is shipped in this increment.

## Offline benchmark and checks

Run from this checkout (the prepared environment reuses the existing local dependency
tree; no package/lockfile edits or installs were made):

```powershell
./node_modules/.bin/vitest.cmd run src/domain/duel-target-verification.test.ts --maxWorkers=1
./node_modules/.bin/tsc.cmd --noEmit --strict --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext src/domain/duel-target-verification.ts src/domain/duel-target-verification.fixtures.ts src/domain/duel-target-verification.test.ts src/scripts/benchmark-duel-target-verification.ts
./node_modules/.bin/tsx.cmd src/scripts/benchmark-duel-target-verification.ts --iterations 100
& C:/Code/CereBro/web/node_modules/.bin/eslint.cmd -c C:/Code/CereBro/web/eslint.config.mjs src/domain/duel-target-verification.ts src/domain/duel-target-verification.fixtures.ts src/domain/duel-target-verification.test.ts src/scripts/benchmark-duel-target-verification.ts
git diff --check
```

New CI suite for parent registration:
**`src/domain/duel-target-verification.test.ts`** (14 focused tests). Shared CI was
not edited. Strict scoped TypeScript and scoped ESLint pass. ESLint emits existing
environment warnings about React detection, stale browser mapping and the web
pages directory while linting root source files. No full build/web typecheck ran.

The optional preservation check
`vitest run src/domain/duel-target-verification.test.ts src/services/duelImportService.test.ts 'web/src/app/champions/[slug]/duel-targets.test.ts' --maxWorkers=1`
passes 22 tests in the new/helper and existing public-projection suites; the
unchanged importer suite cannot collect because this prepared dependency tree lacks
`csv-parse/sync`. Its import is already present on base; no manifest or shared
dependency tree was changed to work around it.

The recorded 100-iteration, five-sample run in `offline-report.json` took median
**2.08 ms for 100 parses of one reconstructed profile**, and **298.22 ms for 100
local plans over 5,000 synthetic rows / 2,500 distinct IDs**. The latter produced
250 local batches of size 10. Parsing here measures validation/projection of an
already decoded in-memory object; it excludes JSON decoding, file I/O and hashing.
These are CPU measurements under sibling workload,
not live responses, server batches, latency, request-rate capacity or an estimate
of how fast thousands of real players can be verified. Server requests performed:
**0**. Server profiles/second and maximum batch size: **UNKNOWN**.

To run a saved-input dry run later, provide sanitized public service-result data
and reviewed target/blueprint arrays, without authentication or unrelated account
fields. `--captured-at` must include timezone. Output is restricted to this
checkout's ignored evidence directory:

```powershell
./node_modules/.bin/tsx.cmd src/scripts/benchmark-duel-target-verification.ts --input temp/duel-target-investigation/service-result.json --targets temp/duel-target-investigation/targets.json --blueprints temp/duel-target-investigation/blueprints.json --captured-at 2026-11-09T00:00:00Z --out temp/duel-target-investigation/saved-dry-run.json --iterations 100
```

Blueprint rows are `{blueprintId, championGameId, stars}`. Target rows are
`{duelId, playerName, playerId: string|null, championGameId, stars?, lastObservedAt?}`.
Source response hashes, parser issues and review-only proposals appear in the output.

Static evidence regeneration in this worktree:

```powershell
python -X utf8 temp/duel-target-investigation/inspect_sources.py
python -X utf8 temp/duel-target-investigation/prepare_layouts.py
python -X utf8 temp/duel-target-investigation/export_layouts.py
python -X utf8 temp/duel-target-investigation/finalize_evidence.py
```

## Smallest next empirical check and delivery limits

Prefer a sanitized **already saved** normal-client service result from one known
target, including source capture time, returned UID/name and `gamestats.top.h[0]`,
alongside its normal profile/duel confirmation observation. Required input is the
exact existing target name and its returned stable UID. This confirms whether the
traced fields are actually present today without random discovery. A custom-avatar
case would independently exercise the avatar separation already proved statically.

The next optimization-specific check is one legitimate `GetProfilesBulk` result
for **two known UIDs**, compared with their single-profile results at known times:
does each include `b,r,l,sl,at`, which IDs are omitted, and what source timestamps
are available? Do not infer deleted-account behavior from a nonexistent-ID probe.
Current server search semantics need only the bounded known-name matrix above,
after permission/support is established. No test here requires credentials, login,
a new game session, arbitrary-name scans, injection or process-memory collection.
If no already saved result or sanctioned reader exists, keep the offline tooling
and mark transport/throughput unverified. Static relative paths alone do not
establish an authorized standalone API capability.

Server-activated defender proof would require a suitable **existing saved** duel
capture or separately authorized gameplay evidence. Do not activate a duel merely
to strengthen this report. The prior quest work's main-account concern remains
applicable; this increment has not involved that account at all.

There are no app/UI edits, local web URLs, running dev servers, owned browser tabs,
desktop/mobile captures or inspected PNGs for this research-only increment. No UI
quality claim is made. Ignored `temp/duel-target-investigation/preview.html` is a
minimal parent handoff page linking the actual report/artifacts, with no outer
frame, side padding or viewport sizing; it contains no synthetic screenshot.
No database writes, migration, commit, push, PR, deployment, announcement or existing
port changes were performed. Root owns integration, review and release.
