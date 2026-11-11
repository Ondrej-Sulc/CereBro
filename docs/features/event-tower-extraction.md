# Source-observed Event Towers

The fresh 2026-11-10 native catalog and bounded first-party block retrieval verify
all source-configured blocks for these exact Event-category identities:

| Identity | Native name | Captured/configured blocks | Floors | Native EndTime | Recorded end (UTC) |
| --- | --- | ---: | ---: | ---: | --- |
| `event_castellan_5` | DOOM TOWER | 10/10 | 61 | 1795024800 | 2026-11-18T18:00:00Z |
| `event_ggsfa1` | GREEN GOBLIN (STELLAR-FORGED) TOWER | 2/2 | 2 | 1796839200 | 2026-12-09T18:00:00Z |

All 12 blocks and 63 floors are captured within the existing public field
contract. Doom blocks 1?9 have six floors each; block 10 has seven. Each
Stellar-Forged block has one. All 63 defenders join exact hash-pinned blueprint
records. Complete configured coverage does not establish current account
eligibility, ongoing availability or all-time Event history.

## Consumer API

`src/data/game-quests/tower-events/index` exports `towerEventIndex`,
`towerBlockLoaders` and
`loadTowerBlock(id,n): Promise<CapturedTowerBlock | undefined>`.
The index extends the existing `CapturedTowerIndex` contract with the Event
catalog, acquisition outcome and configured-versus-captured coverage.

- `towers[].blockNumbers` is the configured range; `capturedBlockNumbers` now
  matches it for both entries. `blocks` contains all 12 source-bound artifacts,
  `coverage.missingBlocks` is empty and `observedEventDefinitionsComplete` is true.
- `towers[].endsAt` is an ISO UTC string or null, derived only from exact native
  `EndTime`, which remains in `source.nativeData`. Both `startsAt` values are
  null. Native `TowerData` exposes `DateConditions` and `EndTime`, with no
  `StartTime` field; both observed condition lists were empty. Screenshot
  durations are never used to reconstruct dates.
- Index and catalog-entry `observedAt` retain the fresh catalog read timestamp.
  `source.capturedAt` and field/layout/helper/source hashes remain available.
  `availabilityStatus` and `archiveStatus` remain `unknown`. Recorded end dates
  must not become stale live countdowns or account-access claims.
- Literal lazy imports serve only captured blocks. Unknown, malformed,
  out-of-range and prototype/path-like identities return `undefined`; there is
  no runtime client/network fallback. The loader ABI is unchanged from the
  earlier incomplete catalog integrated by root.

Blocks preserve separate native rewards/rating rewards, costs, hero
restrictions, top/bottom modifier applications and all allowlisted floor/enemy
fields. Current HP and maximum HP are distinct: all 63 Event records contain
`hp:1` and a larger `max_hp`. These are native source values, not projected final
combat health. Actual Event ascension is 0; synthetic regression fixtures retain
ascension 11 independently of player upgrade limits. Names/portraits are never
guessed from blueprint suffixes.

Both posters under `web/public/game-towers/events/` remain the original exact
326?659 JPEG bytes from the native `TowerPanelTexture` URLs. No artwork,
Class/Saga source, shared presentation, reward binding or UI file was changed.

## Fresh acquisition and retained history

Current append-only source package:
`temp/quest-explorer-review/event-towers-20261110/fresh-34416/`.
The parent package retains the original catalog, failed PID2156 session receipt,
revoked leases and prior generated package without alteration. The offline
exporter's default source is now the fresh package; `--source` can explicitly
reproduce the earlier incomplete snapshot without contacting a client.

The user actually said `Done` after being asked to leave the progressed account
logged in at normal Event Tower selection. Root supplied a new 30-minute grant
for PID34416 at the exact normal Champions executable. Before a read handle was
opened, exact binary/layout/helper/metadata hashes and PID were checked. Separate
new five-minute catalog and transport leases bound the grant, concrete PID,
reader/scope/layout/preflight/catalog hashes. All old leases stayed revoked.

The catalog read used 124 reads / 2,812 bytes. The transport-context read used
61 reads / 1,606 bytes, bounded to 1,000 reads / 64 KiB. Read handles closed in
`finally` before HTTP. Session/signing material remained only in collector RAM;
no values entered logs, files, command arguments or public artifacts.

Exactly 12 serial first-party `POST /tower/getBlock` requests used API 1 and
hash `"0"`, at no more than two request starts per second, for Doom1..10 and
Stellar-Forged1..2. All identities matched first time; no retries or other
endpoints were used. Both new leases are revoked and the exclusive slot is
released. There was no launch, login, client navigation, fight/entry, team edit,
purchase, reset, manual claim, injection, game-method invocation or process write.
The earlier normal Tower auto-advancement authorization remains the transport's
boundary; account/automatic reward subtrees `userFloors`/`skipData` were discarded.

## Explicit limits

Collection used the previously proven public field allowlist, rather than
saving full responses. Extra wire block fields `dateConditions`, `lockedDesc`
and `userConditions`, and additional enemy derivation fields, were excluded.
Their names are audited in `response-shape-audit.json`; their values were not
retained. Catalog dates/locked text remain exact; additional block-level access
conditions, start dates and full derivation metadata are unavailable. All
allowlisted block/floor/stat/reward/cost/modifier/restriction fields are retained
verbatim. Complete coverage refers to configured membership within this field
contract, not every wire field or account state.

There are 61 retained native modifier applications across 33 IDs. Full localized
modifier definitions were not read under this finite block grant. IDs/quantities
do not prove definition versions or icon bindings. Optional resource/score
labels/art remain source-only gaps for this owner. Root owns the separate104
reward-art binding additions and artwork library; neither was touched here.

One receipt field named `requestStartedAt` was populated after the response read;
its accurate meaning is response observation. This is documented without
rewriting the raw receipt. Rate enforcement uses the collector's monotonic
0.5-second request-start spacing. Catalog `observedAt` and each shard's
`capturedAt` are accurate observation timestamps.

## Offline reproduction and verification

```powershell
python -X utf8 -B scripts/game-quests/build_event_towers.py
python -X utf8 -B scripts/game-quests/build_event_towers.py --output temp/quest-explorer-review/event-towers-20261110/fresh-34416/reproduced
python -B -m unittest discover -s scripts/game-quests -p 'test_*event*tower*.py'
pnpm exec tsc -p temp/quest-explorer-review/event-towers-20261110/fresh-34416/tsconfig.json --noEmit
pnpm exec tsx temp/quest-explorer-review/event-towers-20261110/fresh-34416/runtime-check.ts
.\web\node_modules\.bin\eslint.cmd --config web/eslint.config.mjs src/data/game-quests/tower-events/index.js src/data/game-quests/tower-events/index.d.ts
```

Export requires the retained public source package, pinned blueprint corpus and
unchanged native artwork. Thirteen portable Python checks need no game resource,
client, session, credentials or network. Their explicit safe filename avoids
importing unguarded historical capture scripts. Never discover `*tower*.py`.

All 12 artifact hashes, all 63 floor memberships/blueprint/stat joins and exact
public source payloads are independently verified. The 15 generated files
reproduce byte-for-byte. Portable checks also cover partial-session-error
behavior, rejection of guessed/private/gapped/duplicate/cross-parent data,
native HP and high ascension. Twenty-four runtime checks load all 12 actual
blocks and reject invalid IDs/numbers with no network. Event-scoped TypeScript,
ESLint and diff checks pass. Full build, shared presentation integration and
browser QA belong to root; no CI/package/DB change, commit, push, PR, deployment
or external publication is included.
