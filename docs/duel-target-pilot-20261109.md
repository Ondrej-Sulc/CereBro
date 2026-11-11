# Duel target pilot: 18 additional existing targets

The bounded normal-client pilot completed **18 exact-name searches, 16 complete
public UID/defender-build observations and two exact-name misses** on 9 November
2026. Eight of the 16 observed champions differ from the saved catalog; eight match.
All 15 captured exact-candidate search profiles match the corresponding selected
duel-preview UID, name and seven core defender fields. This is useful evidence for
a cheaper search-first verification path. Actual bulk results and server throughput
remain unproved.

This continues the [static contract investigation](duel-target-discovery-investigation.md)
and [original two-target implementation](duel-target-verification-workflow.md).
The original Large Larry and hufersil receipts/checkpoint were hash-checked and
preserved byte-for-byte. They are not counted in this pilot's timing or 18 searches.

## Acquisition and limits

Root granted the existing PID 18252 client slot from `13:29:36.626212Z` until
`14:44:36.626212Z`. Actual acquisition ran **13:30:16.859487–13:49:36.756705 UTC**:
**1,159,897 ms (19m19.897s)** including navigation, source hashing, tool overhead
and the initial search-reader routing correction. Summed target intervals were
1,035,912 ms; neither number measures server latency.

Exactly 18 existing public Duel names were submitted once each. There were 16
pre-duel confirmation opens and 16 cancellations, zero Continue actions and zero
duel starts. Every visible preview retained 5/5 duel credits. Home was restored
before release. The lease was revoked (`grantedByRoot=false`) and root independently
confirmed release. No owned native/browser window or dev server was created.

There are **16 successful preview reads and 17 successful search-summary reads**.
Their read portions sum to **230.615 ms + 264.487 ms = 495.102 ms**; these measure
already resident named fields and exclude loading/navigation/hash/tool time.
One initial search reader failed with `AssertionError: Expected one existing public
search state`; one additional bounded inspection read UI-routing names only.
The failed read and routing inspection closed their handles and produced no profile
receipt. The legacy summary field `residentCaptureAttempts=16` counts preview
captures only; it is not the total reader invocation count. Total reader invocations
were 35: 33 successful field captures, one failed route lookup and one route inspection.

There were zero ambiguous, incomplete, unavailable or throttled target outcomes.
The two misses are **missing in the returned exact-name candidate set**, not proof
of deletion, rename or absence from the game. Network requests were not instrumented:
18 UI search submissions and 16 preview opens are known; their internal request
counts, cache hits, server latency and profiles/second are unknown.

All observations are **client-memory evidence**, not raw server receipts. The
preview reader follows `DuelConfirmationPopup._profile` to the reviewed public
UID/name and checks that the first `_topHeroes` pointer equals `_topChampion`.
It reads that hero's `mUserHero` and exact blueprint Character/Rarity fields.
No duel was activated, so the server-activated fight defender remains unobserved.

Each capture uses 0x410 query/read access, a 1,024-read / 65,536-byte / two-second
ceiling, at most 1,024 bytes per read and 256 UTF-16 characters per string. Binary,
layout, helper and reader hashes are pinned. All 33 successful receipts report
closed handles. No game method invocation, injection, process write, credential,
session/header export, raw dictionary or unrelated profile/relationship export occurred.

## Results

All source rows remain ACTIVE. Original attribution and free-text rank are preserved;
the observed UID is a **candidate association requiring review**, including unchanged
champions. Historical UID continuity is unproved for every legacy name-only row.
`L/S/A` means level/signature/ascension. All observed blueprints below have explicit
7-star BCG rarity; exact blueprint IDs are the displayed gameId plus `_t7`, validated
against the catalog rather than inferred from that suffix.

| Existing target / candidate public UID | Preserved gameId / rank / source | Observed gameId / build (L/S/A) | Review result |
| --- | --- | --- | --- |
| Custom Hotel / 547051904 | blade / 7* R1 / MCOCHUB | spiderman_morales / 7★ R2 L1 S200 A0 | Different champion/build |
| Axio95 / unresolved | cyclops_90s / 7* R3 / MCOCHUB | — | No exact-name match |
| IronxDan / 29959691 | deadpool / 7* R4 / MCOCHUB | deadpool / 7★ R4 L55 S134 A0 | Same saved champion/star/rank |
| Negativo 3 / 488564890 | elsabloodstone / 7* R3 / MCOCHUB | elsabloodstone / 7★ R3 L45 S110 A0 | Same saved champion/star/rank |
| MGSTUBS / 14178950 | gladiator / 7* R4 / MCOCHUB | misterknight / 7★ R5 L65 S200 A2 | Different champion/build |
| Ilovekip / 134073302 | groot_king_deathless / 7* R4 / MCOCHUB | dust / 7★ R5 L65 S200 A2 | Different champion/build |
| Janimal125 / 477011316 | ironman_movie / 7* R3 / MCOCHUB | ironman_movie / 7★ R3 L45 S160 A0 | Same saved champion/star/rank |
| IamKrob / 592979198 | ironheart / 7* R4 / MCOCHUB | rhino / 7★ R5 L65 S200 A2 | Different champion/build |
| TechWave / 118615082 | isophyne / 7* R1 / MCOCHUB | isophyne / 7★ R1 L25 S0 A0 | Same saved champion/star/rank |
| deadHide / 549022573 | longshot / 7* R3 / MCOCHUB | longshot / 7★ R3 L45 S112 A0 | Same saved champion/star/rank |
| Cat Murdock / 9284511 | medusa / 7* R5 / MCOCHUB | medusa / 7★ R5 L65 S200 A0 | Same saved champion/star/rank |
| Dong / unresolved | mistyknight / 7* R1 / MCOCHUB | — | No exact-name match |
| Fenico / 110779642 | negasonicteenagewarhead / 7* R4 / MCOCHUB | doctorbong / 7★ R5 L65 S200 A2 | Different champion/build |
| Titan54570 / 69643022 | deadpool_platinum / 7⭐ / COCPIT | deadpool_platinum / 7★ R4 L55 S200 A0 | Same champion; old rank unknown |
| JPF10 / 25850575 | shocker / 7* R3 / MCOCHUB | blacktarantula / 7★ R5 L65 S200 A0 | Different champion/build |
| Custom Golf / 547051215 | venomtheduck / 7* R1 / MCOCHUB | spiderman_morales / 7★ R2 L1 S200 A0 | Different champion/build |
| Chino1989 / 399340180 | werewolfbynight / 7* R3 / MCOCHUB | baronzemo / 7★ R5 L65 S200 A2 | Different champion/build |
| Masked_Legend / 274498882 | spiderman_2099 / 7⭐ / COCPIT | spiderman_2099 / 7★ R5 L65 S200 A0 | Same champion; old rank unknown |

Eight rank differences accompany the eight champion differences. There are zero
known star differences. Six same-champion rows match their saved star and rank;
Titan54570 and Masked_Legend had only `7⭐` saved, so their previous rank is unknown.
The result is 16 current complete core builds, not 16 historically verified identities.

## Search evidence and discovery

The corrected named route is `WindowManager.windowStacks → WindowInfo.window
(SocialHub) → _stateHelper (WindowStateHelper) → _stateStack → WindowStateEntry.State
(FriendsSearchState)`. `FriendsSearchState._lastSearch` binds the exact query;
`UserListState._profiles` supplies resident result counts and exact public identity.
The visible search grid's `DynamicGrid._itemCache → FriendItem._userProfile` contains
the exact candidate's typed modern profile. Names are checked before any candidate
UID/build export. Only the reviewed exact target's core hero is projected.
The `_profiles` list index is not a screen row index: the UI can sort differently,
as observed for Negativo 3, IamKrob and JPF10. Selection used the visible exact name.

There are 17 summary receipts: 15 unique exact candidates with complete builds and
two without an exact match. **15/15** candidate UID/name/blueprint/gameId/stars/rank/
level/signature/ascension sets equal their later selected previews. Custom Hotel
has preview evidence and an operator-observed result count, but no successful
search-summary receipt; it is excluded from the 15 pairs. Root independently checked
the same receipt pairs in
`C:/Code/CereBro/temp/parallel-reference-20261109/duel-pilot-parent-evidence-review.json`.

The search portrait is not a dependable defender identity: Ilovekip's custom icon
and Janimal125's Old Man Logan icon differed visibly from their Dust and Iron Man
(Infinity War) previews. Typed hero binding, not the portrait, established the builds.

Resident counts ranged **4–9** under the static client's requested maximum of ten.
No query reached ten; this does not establish the true server cap or uncapped
coverage. “Custom Golf” and “Custom Hotel” visibly returned other “Custom …” names;
“Axio95” returned eight nonexact candidates. Thus full-name queries are not exact-only,
and strict substring/prefix/normalization/ordering semantics remain unknown. No
additional discovery strings, random names or UID enumeration were submitted.
The cohort deliberately spans saved champions and ASCII names; its change/miss
fractions are not estimates of the whole catalog or game population.

Supported discovery should begin with source-backed target names or explicitly
reviewed seeds, dedupe returned stable UIDs and retain query/time/source receipts.
Treat any requested-cap result as saturated, split only after prefix semantics
are supported, and keep a finite discovery budget separate from verification.
This pilot does not authorize harvesting the other visible result rows. A future
sanctioned result adapter must retain provenance and explicit coverage unknowns.

## Implemented scalable next step

`src/domain/duel-search-observation.ts` validates the actual saved search format,
exact query/UID binding, source time, closed/read-bounded capture, and exact BCG
join. It preserves absent core values as unknown, ambiguous identities as separate
candidates and search evidence as `client-memory-search-profile`. Its comparison
helper checks observed core fields against an independent preview without claiming
server proof or whole-combat-state equality.

`verify-duel-targets.ts` now supports explicit `format: "client-search"`. It imports
only one reviewed exact name per search observation and rejects UID-bulk requests
or relabeling as saved server evidence. Actual **17 search receipts** replay into a
separate checkpoint with 15 candidate UIDs and 17 review-only proposals. Empty exact
sets retain the source receipt instead of losing provenance. Reimport is byte-identical.
The original preview checkpoint still has 18 attempts and 16 candidate UIDs, also
byte-identical on replay. Neither pipeline changes any Duel row/status/credit.

The next concrete integration is an **operator-assisted search-first review queue**:

1. Import a finite source/status-preserving public Duel snapshot and existing reviewed
   identity links. Reuse a source-timestamped successful observation while fresh;
   dedupe by reviewed UID, otherwise keep exact-name work explicit.
2. Through the supported normal UI, capture only the exact reviewed search candidate.
   After the 15/15 equivalence evidence, a complete typed search profile can supply
   review evidence without opening an additional profile/confirmation for every row.
   Label it search-profile evidence. Preview missing/incomplete/mismatched cases and
   a fixed spot-check sample; retain the two receipt kinds independently.
3. Show proposed UID links, defender/build deltas, source hashes and times to an
   administrator. Match existing `Champion.gameId` exactly; preserve original source,
   rank, author and moderation status. Do not attach a UID merely because a name or
   champion agrees. Root must review identity links before using them as canonical IDs.
4. Apply the already implemented fingerprint/delta/checkpoint logic to reviewed
   identities. Keep concurrency one, finite attempts, source-wide throttle pause,
   exponential retry floor/Retry-After and resume. Do not grow concurrency based on
   the subsecond resident projection time. Temporary failures preserve the last success;
   no automatic delete, archive, reactivation or saved-target update exists.

This removes repeated preview work; **the improvement has not been timed in a
search-only UI run**. It does not supply a standalone authenticated transport or
make verification of thousands fast by itself. The larger gain would be a supported
direct UID/bulk transport: the static client contract supports that operation, but
normal public Search has no reviewed-UID-list input. Native callers are tied to
friend/alliance/leaderboard/recipient flows; none was used to expose unrelated
rosters or force a two-UID batch. No legitimate precise-two-UID normal UI path was
established, and no bulk call was attempted.

The smallest transport-specific empirical input is therefore one **already saved
or legitimately produced normal-client bulk result for exactly the two known UIDs
258292717 and 252695458**, with source time and requested/returned/missing IDs.
Compare its explicit core fields against singles. Until that exists, bulk completeness,
batch cap, retry behavior and server throughput remain unknown; two singles cannot
substitute. No additional game interaction is needed for this delivered increment.

## Source identities

- Installed binary SHA-256:
  `01f46bb2e36c2160a8df939bbb080bcf2ee89ca15427692a10334efc90fd4abb`.
- Current public BCG source:
  `C:/Users/ossul/AppData/LocalLow/Kabam/Champions/bcg/out/v1/0C75671AC12E11F3AB1663F52BA7AAC8C093C638.bin`,
  SHA-256 `b54879955b972b9993891df4bea54c339627c05a64ad4a3a7b15f30ae23b0fd7`.
- Exact 3,821-row Blueprint/Character/Rarity projection SHA-256:
  `b45ab339f9a7389a9caa4e30c27c9048a0cbc28d1e5fe8d86f3041310535d195`;
  named protobuf schema SHA-256
  `9cc5236aef043cf7e5655458e790ed1f0897f67398e37af3020bca74511e97c4`.
- Preview named layout SHA-256:
  `07edbb886c27621dce97c66cfc9c8c270e93666f5b142ea074d778d591237e9f`;
  separate search routing layout
  `42d5cef7edbe923473467f646593b59044241e6c2243805cd72a5c122fd1b7b5`.
- Read-only helper SHA-256:
  `edd46c2014f0e35bf819e992411dface976195fb7ec70eb3181bc08cc063ddac`;
  preview reader `228985508f071fed182aae79eb21e3119e22e5dc153eb43b7a8fa95d264474b3`;
  successful search reader
  `a6b4138688ccc3e881f7f9f3627b2c594d52c8bd4f6d4cfe95897440e5845229`.

## Reproduction and checks

Exact durable files delivered across the duel increments (all in this worktree):

```text
docs/duel-target-discovery-investigation.md
docs/duel-target-verification-workflow.md
docs/duel-target-pilot-20261109.md
src/domain/duel-target-verification.ts
src/domain/duel-target-verification.fixtures.ts
src/domain/duel-target-verification.test.ts
src/domain/duel-target-job.ts
src/domain/duel-target-job.test.ts
src/domain/duel-pilot-report.ts
src/domain/duel-pilot-report.test.ts
src/domain/duel-search-observation.ts
src/domain/duel-search-observation.test.ts
src/scripts/benchmark-duel-target-verification.ts
src/scripts/verify-duel-targets.ts
src/scripts/summarize-duel-pilot.ts
```

Run these file-only commands from this worktree. They require the existing ignored
receipts; none reads the game, queries the database or requests a server profile.

```powershell
python -X utf8 temp/duel-target-investigation/pilot-18/finalize_pilot.py
./node_modules/.bin/tsx.cmd src/scripts/summarize-duel-pilot.ts temp/duel-target-investigation/pilot-18/summary-input.json temp/duel-target-investigation/pilot-18/blueprints.json temp/duel-target-investigation/pilot-18/results.json
./node_modules/.bin/tsx.cmd src/scripts/verify-duel-targets.ts --spec temp/duel-target-investigation/pilot-18/job-spec.json --blueprints temp/duel-target-investigation/pilot-18/blueprints.json --bundle temp/duel-target-investigation/pilot-18/evidence-bundle.json --checkpoint temp/duel-target-investigation/pilot-18/checkpoint.json --report temp/duel-target-investigation/pilot-18/review-proposals.json
python -X utf8 temp/duel-target-investigation/pilot-18/prepare_search_replay.py
./node_modules/.bin/tsx.cmd src/scripts/verify-duel-targets.ts --spec temp/duel-target-investigation/pilot-18/search-job-spec.json --blueprints temp/duel-target-investigation/pilot-18/blueprints.json --bundle temp/duel-target-investigation/pilot-18/search-evidence-bundle.json --checkpoint temp/duel-target-investigation/pilot-18/search-checkpoint.json --report temp/duel-target-investigation/pilot-18/search-review-proposals.json
& temp/duel-target-investigation/checks.ps1
```

New suites for root CI registration (no shared CI edit):

- `src/domain/duel-target-verification.test.ts` — 14 tests.
- `src/domain/duel-target-job.test.ts` — 14 tests.
- `src/domain/duel-pilot-report.test.ts` — five tests.
- `src/domain/duel-search-observation.test.ts` — six tests, using invented identities
  and sanitized client-observation shapes, never represented as saved server fixtures.

Together with the unchanged importer/public-projection suites, **53 focused tests
pass**. Strict scoped TypeScript and scoped ESLint cover all 12 durable TypeScript
files; no full web typecheck/build runs. Exact commands are in the ignored
`checks.ps1`, with output at `pilot-18/final-checks.log`. Existing lint environment
warnings about React detection, browser mapping and pages location are retained.
The existing checkout dependency junctions were reused; no installation/manifests changed.

The ignored `pilot-18/` directory contains the original `targets.json`, root lease,
append-only `events.jsonl`, all `*-preview.json` and `*-search.json` receipts, reader/
layout/gate sources, current catalog provenance, summary/replay specs, both
checkpoints and proposal sets, acquisition audit and minimal `preview.html` results
chart/table. There are no app/UI changes, local web URLs, running servers, owned
tabs, migrations, database writes, commits, pushes, PRs, deployment or public messages.
The observed native UI screens were inspected directly; the report chart is data
presentation and makes no app visual-quality claim. Root owns review and release.

The results chart was inspected at 728 px and 390 px with no console errors.
Its exact rendered exports are `pilot-18/pilot-results-desktop.png` and
`pilot-18/pilot-results-mobile.png`; these show the evidence table, not game screens.
`pilot-18/inspected-pngs.html` uses absolute image paths with no outer frame, side
padding or viewport-height sizing. The native game screens were inspected during
the permitted navigation; no private Home screenshot is included in the handoff.
