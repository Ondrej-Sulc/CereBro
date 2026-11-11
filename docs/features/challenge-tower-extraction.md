# Observed Challenge Tower data

The 2026-11-10 native public catalog contains one Challenge-category Tower:
`challenge_saga`, named **SAGA SHOWCASE TOWER**, with six configured blocks and
44 floor defenders. All six blocks are captured: their floor counts are
10, 6, 6, 10, 6 and 6. Every defender joins an exact pinned blueprint.

`src/data/game-quests/tower-challenges/index` exports `towerChallengeIndex`,
containing the Tower catalog and block index, and
`loadTowerBlock(towerId, blockNumber): Promise<CapturedTowerBlock | undefined>`.
The loader uses literal lazy imports and rejects unknown identities/ranges.
Blocks implement the existing `CapturedTowerBlock` contract. Public source
definitions, separate rewards/costs, modifiers, restrictions, native enemy builds,
recorded health and maximum health are retained. Some Saga records have `hp: 1`
and a larger `max_hp`; these distinct native fields are preserved verbatim.

## Archive and availability semantics

The native Archive provider requests the Challenge category through
`TowerManager.GetTowerData`, which filters validity and expiry. It groups the
result by account eligibility/completion; those account groups were not read.
The source catalog contains no additional Challenge Tower identity beyond Saga.
This describes this observed catalog, not an all-time historical archive.

The DTO uses `section: 'challenge'` and `archiveStatus: 'unknown'`. Category,
`EndTime: -1`, successful definition retrieval and a complete configured block
range do not establish permanence, current availability or player eligibility.
The native locked-description text is retained as a public definition, not an
evaluation of this account. Two Event-category identities were observed among
public catalog keys and excluded from this Challenge scope. Six Class identities
and their existing corpus remain frozen.

The Saga and Archives card images are exact source bytes under
`web/public/game-towers/challenges/`, both 326 by 659 pixels. Their original CDN
URLs, hashes and dimensions appear in the manifest. Archive card art does not
establish a separate Tower identity or historical membership.

## Acquisition and privacy

The ignored source package is
`temp/quest-explorer-review/challenge-towers-20261110/`. It contains the catalog,
six sanitized backend shards, receipts, source-bound metadata/native Archive
traces, artwork receipts and verification/handoff reports.

Root delegated exclusive scoped acquisition. Actual prior user confirmation at
Tower selection and explicit **Allow normal Tower auto-advancement** authorization
persisted; no new readiness message was invented. The original process was PID
2156, with the same pinned GameAssembly and helper/metadata hashes. Fresh native
UI inspection found no targetable original game window. Root explicitly allowed
the bounded typed public catalog read without a window after bootstrap and hash
checks. A normal supported recovery attempt opened a separate failed-login
client, which was closed using its normal Quit control. No login was automated.

The authenticated collector requested only the observed `challenge_saga` blocks
1 through 6 through the proven first-party `POST /tower/getBlock`, at no more
than two request starts per second. All six identities matched on the first
attempt. The existing transport context remained in collector RAM, read handles
closed before HTTP, and credentials were never logged or saved. Private response
subtrees were discarded. No production proxy, game-method invocation, process
write, fight, roster/loadout change, manual reward claim or purchase was used.
Intended acquisitions used finite scoped leases and closed/revoked in `finally`.

An initial verification command incorrectly used unittest pattern `*tower*.py`.
It imported the existing `capture_tower_membership.py` and unintentionally read
public Tower block/floor identity/count/hash fields without a new persisted
per-reader lease. Its existing-output assertion prevented any export overwrite;
its `finally` closed the handle. It made no HTTP request, read no account or
credential fields, and wrote no process memory. This incident is recorded in the
ignored handoff. Use only the safe test pattern below; imports of the new
exporter/test modules perform no collection.

## Additional presentation evidence

The finite presentation request contains 18 Class IDs plus 82 observed Challenge
IDs, 98 distinct modifiers. No requested definition was found in the original
client's `BuffsDB.globalBuffs`. A separate narrowly bounded read from six exact,
previously observed public Class block Buff roots captured five canonical native
definitions, including both Tower rules. Their localization templates, native
values/quantities, glyph fields and complete canonical raw hashes are retained.
An offline join to the pinned BCG establishes component/version receipts,
including 3 components for `towers_rule_dmg` and 13 for
`towers_rule_timer_1m`. This evidence establishes no new icon binding. Original
source dictionaries were null where native data supplied none; missing template
formatting is not guessed.

`avx_hp_pct250` and Challenge runtime modifier definitions remain unavailable
from these scoped roots. Presentation may resolve other IDs from its independently
frozen sources. The optional public resource labels/art for `tower_energy`,
`tower_challenge_energy`, `xp` and score IDs `twr`, `tco`, `tmu`, `tmy`, `tsc`,
`tsk`, `tte` remain gaps. No balance, rating value or account-status traversal
was performed to resolve them. Generic presentation fallbacks remain truthful.

## Offline reproduction and checks

Run from the dependent quest worktree. Export reproduction requires the retained
public source package and pinned blueprint file; portable tests require neither
a running client nor local game resources.

```powershell
python -X utf8 scripts/game-quests/build_challenge_towers.py
python -X utf8 scripts/game-quests/build_challenge_towers.py --output temp/quest-explorer-review/challenge-towers-20261110/reproduced
python -m unittest discover -s scripts/game-quests -p 'test_*tower*.py'
pnpm exec tsc -p scripts/game-quests/tsconfig.json --noEmit
.\web\node_modules\.bin\eslint.cmd --config web/eslint.config.mjs src/data/game-quests/tower-challenges/index.js src/data/game-quests/tower-challenges/index.d.ts
```

Seven new portable Challenge checks cover catalog identities/ranges, unknown
status, privacy, missing/duplicate/cross-parent floors, exact blueprint identity,
enemy ascension and all published block hashes/floor memberships. All 33 Tower
Python tests and scoped TypeScript pass. The nine generated data/loader files
reproduce byte-for-byte. All 44 published source/blueprint joins were checked.
The new CI suite is `scripts/game-quests/test_challenge_towers.py`; CI registration
belongs to root preparation. UI integration/review and presentation are separate
owners. No commit, push, PR, deployment or database change is part of this work.
