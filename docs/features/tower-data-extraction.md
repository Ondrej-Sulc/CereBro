# Public Tower data extraction

**Latest:** the higher-block backend approach now captures all configured Class
Tower blocks and floors. See [the backend extraction](tower-backend-extraction.md).
The stopped/preparation stages below are retained as acquisition history; the
user subsequently authorized normal automatic advancement and collection resumed.

The current explorer has six verified permanent Class Tower identities and native
artwork. Its previous two November 9 observations contain no loaded block/floor definitions.
Those empty registries do not establish empty Towers, and the reported Tower-wide
numbers are not published as verified per-Tower coverage.

## Loading path and observed automatic advancement

Offline native code tracing establishes a useful next step:

- `TowerUtils.OpenTowerScreen(TowerData)` constructs a Tower screen provider and
  opens the normal screen after the normal access checks.
- `TowerScreenDataProvider.InitializeData` calls `TowerManager.GetBlockData`.
- `TowerAPI.GetBlockData` requests `/getBlock` with the Tower ID, block ID and
  prior content hash. This is separate from `ActivateMatch`.
- `TowerManager.OnUpdateBlockData` constructs public blocks and floors, indexes
  floors by `(TowerId, BlockId, FloorNumber)` and links each floor into its
  parent's native array.
- `TowerScreenDataProvider.GoToFight` separately calls `ActivateMatch`.

**Correction after the November 10 live observation:** a separate match-activation
method does not make opening a Tower passive. Opening the previously unvisited
Mutant Tower displayed automatic advancement/rewards and reported progression to
block 63. The `/getBlock` callback calls both `OnUpdateBlockData` and
`OnUpdateUserData`, and parses `skipData.blockId` and `skipData.rewards`.
The earlier inference that normal Tower entry was a read-only preview was wrong.
No further game inputs or reads occurred after that observation; the modal was
not acknowledged and the lease was revoked. No fight or team/loadout change was
performed. The actual server-side reward/account delta was not measured.

The reader itself never calls these methods or reproduces their requests. Further
entry into unvisited Towers must not be treated as passive data retrieval.
Current access, automatic skipping and reward eligibility remain account-dependent;
no claims about them are projected into the public dataset.

The method bodies, original source paths and hashes are retained in the ignored
`temp/quest-explorer-review/towers-20261110/native-code-evidence.json` and
`auto-advance-code-evidence.json` packages. `unexpected-auto-advance.json` records
the stop and exact last action.
Named metadata comes from the same pinned Cpp2IL assemblies as the quest corpus.
The new narrow layout hash is
`9c948d4c0f965cdac354d7cffff112c1f1797c076648dc182d6a30eb63f0bdaf`.
Existing quest source/layout files were not modified.

## Prepared reader

`scripts/game-quests/capture_public_towers.py` is opt-in. Its preflight validates
the binary support, named layout and metadata hashes without importing the
process-memory helper. A live capture additionally requires a new root-issued,
time-limited lease with an exact PID, reader/scope hashes and an actual current
Tower-selection readiness confirmation. Old quest/duel/reward leases do not work.

The initial scope is the six already established `class_*` Tower IDs. It exports:

- Public Tower identity, category and menu-art keys.
- Exact block identity/hash, stated floor count and time limit, restrictions,
  entry costs, ordinary rewards and rating rewards.
- Exact native floor number and parent/array membership, defender identity and
  recorded rank/level/signature/ascension, AI ID, modifiers and floor rewards.
- Public modifier names, descriptions, values and captured glyphs. An observed
  glyph does not establish a curated-node association or an exact definition
  version; no automatic icon/location reconciliation is added by this reader.

Defender fields are reached only from a public floor's `BossData`. Account IDs,
owned rosters, user-floor progress, current attackers, lineups, active matches,
rankings and raw object dictionaries are excluded. Unknown/null values stay
unknown. Reward items do not include account balances or claim state.

The reader checks dictionary versions and exact Tower/block/floor joins. A floor
must point to the captured parent block and occupy its exact native array slot.
It caps reads at 100,000 calls and 16 MiB, limits strings and checks lease
revocation while reading. It always closes its read handle before creating an
append-only output file, including on failures. Missing floors remain missing
observations rather than empty floors or complete coverage.

Preflight, entirely offline:

```powershell
python -X utf8 scripts/game-quests/capture_public_towers.py --support-root C:/Code/CereBro/temp/quest-data-investigation/game-only --layout temp/quest-explorer-review/towers-20261110/layouts.json --preflight
python -m unittest discover -s scripts/game-quests -p test_public_towers.py -v
```

The eleven portable reader tests cover field boundaries, readiness/PID/expiry/hash gating,
duplicate identities, mutated registries, exact parent/array joins and closing
handles before output creation on success/failure. The preflight itself requires
the pinned local research corpus; it is not a portable CI test.

## Captured result and offline projection

Three successful append-only observations preserve **Skill Tower blocks 63 and
64, with 12 and 8 floors respectively**. Each floor has an exact defender
blueprint/build, native block-array membership, native hash and recorded reward
list. Block time limits, modifiers, entry costs, ordinary rewards and rating
rewards are preserved independently. Both captured blocks contain every declared
floor; this does not establish complete coverage of the Tower. No Mutant block 1
capture succeeded, and no unobserved floor is invented.

`scripts/game-quests/build_tower_blocks.py` deterministically produces
`src/data/game-quests/tower-blocks.json` from those three frozen public captures.
Repeated identical definitions merge their independent source-observation hashes;
conflicting definitions are rejected for explicit version review. Only exact
public fields are projected. Aggregate reported Tower counts, private progress,
current attackers and account reward state are excluded.

The public artifact is ready for later Tower UI integration; current Tower pages
have not been changed by this extraction. Challenge/Archive Towers remain
unobserved by this reader. No additional live navigation is planned under the
original no-progression-change scope. All data processing after the unexpected
advancement is offline.
