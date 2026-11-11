# Configured Class Tower backend data

CereBro now has a frozen public snapshot of **all 147 configured blocks in each
of the six Class Towers: 882 blocks and 9,636 floor defenders**. Every Tower has
1,606 verified floor memberships. Blocks 100 and 147 were retrieved without
opening them in the game. Challenge, Saga and Event Towers are outside this
dataset.

## Retrieval

The native client uses the same authenticated `POST /tower/getBlock` request with
`api: 1`, `towerId`, `blockId` and a content `hash`. An uncached block uses the
native default hash `"0"`. Native metadata declares 147 blocks and 1,606 floors
per Class Tower. There is no unlocked-block check in that client request method;
successful server responses for blocks 100 and 147 establish actual higher-block
retrieval, rather than relying on that absence alone.

An unauthenticated control returned `ID_SPARX_ERROR_SESSION`. A bounded collector
then reused the legitimate running client's existing transport context in memory
and matched the client's request signing/serialization. No credential values
were written to files, logs, command arguments or production code. Read handles
closed before HTTP collection. The collector invoked no game methods and made no
process writes. Its only request route was the observed first-party
`/tower/getBlock`; it never called match activation, reset, prefight, lineup or
reward-claim endpoints.

The user explicitly allowed normal Tower auto-advancement and rewards after the
initial Mutant observation. This API must still not be described as universally
passive: responses can contain `skipData` and `userFloors`. These private/account
subtrees were discarded, and the public snapshot does not record reward claim or
progress state. No fight or team/loadout change was performed. The client was
left at normal Tower selection after collection.

## Collection and identity validation

The collection was bounded to the six recorded `class_*` IDs and block IDs
1–147, with serial request starts limited to two per second, a hard request
budget, short root leases and no automatic retries on server errors. Public
shards and hash receipts are append-only/checkpointed. After 441 captures, an
unexpected first Science response failed the requested-definition check. A
separate Science 1 identity check succeeded; the unchanged collector resumed
from its verified checkpoint. The unexpected response was never filed as the
wrong block.

Native floor IDs arrive as numeric strings. The validation contract follows
native integer semantics without lossy coercion, preserves original wire values
and requires an exact, unique 1…N floor sequence and matching Tower/block parents.
Every requested block identity, declared floor count, source hash and defender
blueprint is checked. Missing, duplicate, redirected or cross-parent definitions
cannot silently become complete coverage.

The local research package is
`temp/quest-explorer-review/towers-20261110/backend/`. It retains sanitized probe
receipts, 882 public source shards, checkpoint receipts and the collection result.
The authenticated collector remains an ignored research tool, not a production
game proxy. It requires a fresh scoped operator lease and live context; do not
run it automatically in web/bot processes or CI.

## Public artifacts

- `src/data/game-quests/tower-backend/manifest.json` indexes all source-bound blocks.
- `blocks/*.json` preserves block/floor modifiers, restrictions, costs, separate
  reward lists and recorded enemy stats, with exact public source data.
- `index.js` / `index.d.ts` provide literal lazy block imports and a bounded
  `loadTowerBlock(towerId, blockNumber)` API. No arbitrary file path is imported.
- `src/domain/game-quests/tower-data.ts` defines the public read contract.
- `scripts/game-quests/build_tower_backend.py` rebuilds the package entirely offline.

The blueprint source is pinned at
`2059a0b12ab54b3a582a60371dbc10b9e24b966ae202e6ee8127d464effb2313`.
All 9,636 defenders resolve through exact blueprint records. Names/portraits are
not guessed from ID suffixes. The original 20 normal-client floor observations
remain as independent controls; blueprint, rank, level, signature and ascension
match the corresponding backend definitions for all 20.

Enemy ascension can exceed normal player-build limits. These native values and
recorded health/attack remain enemy data; they do not establish player upgrade
eligibility or get clamped through player-stat projection rules. A fully captured
configured block range does not imply that every block is currently playable.
Access conditions and current account eligibility are not modeled. Raw modifier
IDs/glyphs do not create automatic curated-node associations or icon proofs.

The original `tower-blocks.json` is the small normal-client control snapshot;
new Tower browsing should consume `tower-backend` for the complete configured
Class block corpus. Existing Tower pages are not yet wired to it.

## Reproduction and checks

```powershell
python -X utf8 scripts/game-quests/build_tower_backend.py
python -X utf8 scripts/game-quests/build_tower_backend.py --output temp/quest-explorer-review/towers-20261110/backend/reproduced
python -m unittest discover -s scripts/game-quests -p 'test_*tower*.py'
pnpm exec vitest run --config scripts/game-quests/vitest.config.mts src/tests/game-quests/tower-backend.test.ts src/tests/game-quests/tower-blocks.test.ts
pnpm exec tsc -p scripts/game-quests/tsconfig.json --noEmit
```

The offline exporter needs the pinned local source package and blueprint corpus.
Portable Python tests use synthetic fixtures; Vitest uses the checked-in public
snapshot. Global validation checks all 882 artifact hashes and all 9,636 source
joins. Production UI integration, current-main/CI reconciliation and the full
web build remain separate preparation work. No deployment or database migration
is part of this data extraction.
