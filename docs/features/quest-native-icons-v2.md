# Additive quest native icon bindings v2

The quest explorer now binds **149,998 /212,720 recorded assignments**, up from51,718. The additive v2 artifact contributes **98,280 new assignment references** across218 permanent saved layouts. It uses557 additional definition/glyph proofs from the approved596-proof node package, with the same24 immutable native SVGs. No curated association, DB/schema dependency, sibling runtime import or new asset is introduced.

`scripts/game-quests/build_native_icons_v2.py` consumes the frozen, read-only node `v2/source-index.json`, SHA256 `9fc9209fbd623aa9ceb0500362cd51d2524c177279c1e2a57ee41bc7afb7a793`. All1,720 referenced artifact/detail/renderer/SVG paths must resolve inside the specified node root and match their pinned bytes. Source-index and proof content hashes/contracts/catalog identities are checked. Referenced paths with absolute roots, traversal, drive syntax or escaping symlinks fail closed. No full node proof/catalog is copied into the quest tree.

The builder independently decodes the retained BCG with the exact schema, reconstructs complete raw definition/component-inclusive version identities for all1,688 detail versions, and verifies every component hash/missing-component list. For each current quest assignment it requires the complete raw Buff hash, exact application-context hash (excluding only `buff` and the independently scoped source coordinate as in the native v2 contract), recorded glyph, first-component→AppearanceID→IconTexture or the specifically proved captured-BCG branch, and immutable SVG SHA/key agreement. Neither ID, title nor glyph alone is a binding. Source-configured side and assigned-list side remain distinct and unchanged.

Current raw sources must match both the frozen node map profile and the quest's existing exact mapId/source SHA. The two historical monthly/Daily layouts in the node proof package are excluded by the existing exact public quest scope. Coverage stays234 variants /218 layouts, including16 summary-only Act10 variants outside map counts. No graph, route, placement, reward, encounter-discovery identity or planner bridge is rewritten.

The original49-map ledger SHA `7e31a16f13fcd6f9ab57cf0b3097cfe6afea719f88ae2c0fa2cae345ffd58e35` and169-map ledger SHA `98eafca53228033fe30e2c9ab13b9a3fc575c304f3eee8773e4758a35cf2db2d` are immutable baselines. Every overlapping v2 proof must agree with them; conflicting keys/versions fail export. Only previously unbound assignments enter `application-icons-v2.json`, using numeric references into557 compact proof metadata records. Detail shards/raw node definitions remain build-time inputs. `withApplicationIcons` merges source-scoped references server-side and sends only nullable finite `iconKey` values on existing applications. `application-icon-coverage-v2.json` supplies the small public provenance summary. The JS/`.d.ts` boundary keeps large JSON structural inference out of scoped TypeScript.

Remaining62,722 assignments are explicit evidence limits:

- **62,712** require204 exact native shapes outside the current24-shape registry.
- **4** have an unresolved native first component.
- **6** lack a usable recorded glyph.

All current raw definition versions and application contexts are covered; the remaining gap is no longer absence from the original39-version reference. No unproved fallback icon or title-based matching is used. The forthcoming separate native-shape export can be integrated through another reviewed additive artifact; this increment does not wait for it or mutate v2 inputs.

Regeneration is offline and byte deterministic:

```powershell
python -X utf8 scripts/game-quests/build_native_icons_v2.py
python -X utf8 scripts/game-quests/build_native_icons_v2.py --output temp/quest-explorer-review/native-icons-v2-20261109/reproduced/application-icons-v2.json
python -m unittest discover -s scripts/game-quests -p 'test_native_icons_v2.py'
pnpm exec vitest run --config scripts/game-quests/vitest.config.mts src/tests/game-quests/native-icons-v2.test.ts src/tests/game-quests/application-icons.test.ts web/src/components/game-quests/quest-map-explorer.test.tsx src/tests/game-quests/rewards.test.ts src/tests/game-quests/navigation.test.ts
pnpm exec tsc -p scripts/game-quests/tsconfig.json --noEmit
```

The root can supply an archived node root through `--node-root`; the source-index hash and all referenced bytes must remain identical. Output stays in the quest checkout and cannot overwrite either baseline. The production artifact SHA is `5ec667a2447e8541433dc75f2839b7971ce861d3e6c76d8923170ebab36f0861` (3,096,675 bytes); coverage sidecar SHA `d99ff494f750a6dd0c97faee49c46193647795f965a5078b84647556914fe985`.

New CI suites: `src/tests/game-quests/native-icons-v2.test.ts` and `scripts/game-quests/test_native_icons_v2.py`. They cover every additive reference against current normalized maps, source/effect/application drift, reference zero, raw/application-context/component/BCG/glyph/SVG/index/path drift and baseline preservation. Existing reward, route/control and planner checks remain applicable. No shared CI registration or full web build is performed.

Preview succeeded directly for the integration. Actual1280px,390px and320px captures show the selected defender, exact native icons beside names, working Health disclosure, and honest text-only entries. The Hood has five verified icons among seven applications; all five SVG requests returned200. No horizontal overflow or node proof/catalog resource was observed. Captures remain unmodified PNGs; no headless fallback was needed for this increment. Owned Preview tabs are closed and own3011 stays available.

The versioned follow-up package is `temp/quest-explorer-review/native-icons-v2-20261109/`; the preceding reward/control package remains unchanged at `temp/quest-explorer-review/rewards-controls-20261109/`. Exact files/hashes, reproducibility, source receipts, suite inventory and a compact combined preview accompany the handoff. No game access, release action or additional worktree is used.
