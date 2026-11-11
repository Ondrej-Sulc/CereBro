# Additive native quest icon shapes v3

The quest explorer binds **212,710 of 212,720 recorded applications** across the same218 permanent saved layouts. V3 adds62,712 exact application references using204 additional native glyph shapes. It preserves all149,998 previous bindings and all graph, encounter, route, reward and artwork bytes. Four applications have an unresolved first component; six have no recorded glyph. Those ten remain text-only. No semantic or name-based fallback is used.

The read-only build input is the frozen node `v3-native-icons/source-index.json`, SHA256 `72947e3803b19069ade45728333e9cd92ecbdbd66d4cec91d3f1ccd89b61eb9f`. `scripts/game-quests/build_native_icons_v3.py` verifies all212 declared references, including the frozen v2 index `9fc9209fbd623aa9ceb0500362cd51d2524c177279c1e2a57ee41bc7afb7a793`. Paths must remain inside the approved node root; traversal, drive syntax, escaping symlinks and byte drift fail closed. The existing v2 reader independently reconstructs the full raw Buff/component/missing-component/BCG versions from retained public source bytes. V3 verifies1,089 definition/glyph bindings and3,894 observed application identities, then independently joins each current quest application by its exact raw definition, application-context hash, recorded glyph, native shape evidence and exported SVG/key. Native font/cmap/glyph/outline/frame and asset hashes must agree. An effect ID or glyph alone never establishes a binding.

The approved207 runtime files are byte-identical copies of two finite game registry/resolver modules, the decorative `GameNodeModifierIcon` component and204 content-addressed SVGs under `/node-modifiers/v3/icons/`. The resolver accepts the original24 keys plus the new204 keys. Unknown keys resolve to nothing. Masks use `currentColor`, are decorative beside text and are excluded from accessibility names. The original24-shape registry, renderer, SVGs and curated admin presentation choices are unchanged. Curated game associations remain0; there is no DB or migration dependency.

Full node detail shards, font and source catalogs remain external build inputs. The repo output contains compact proof identities and sparse map/source/application references. `withApplicationIcons` resolves these server-side and adds only a nullable finite `iconKey` to existing applications. No sibling runtime import, raw proof JSON, node catalog or font is sent to clients. Quest-owned modifier disclosures remain the detail destination.

Immutable quest baselines:

- 49-map ledger: `7e31a16f13fcd6f9ab57cf0b3097cfe6afea719f88ae2c0fa2cae345ffd58e35`.
- 169-map ledger: `98eafca53228033fe30e2c9ab13b9a3fc575c304f3eee8773e4758a35cf2db2d`.
- V2 additive ledger: `5ec667a2447e8541433dc75f2839b7971ce861d3e6c76d8923170ebab36f0861`.

The new `application-icons-v3.json` is3,383,617 bytes, SHA256 `cb5d2355e6e83540a8fe6bb399663c2632e1bca68337d91b384a27c3704a41b2`; coverage sidecar SHA256 `d95c3e7ec7f2b77d594b5cd91d562ac3702b3c928486fbaf75cf583c41239e99`. A second export reproduces both byte-for-byte. An overlap or disagreement with any previous binding fails export. Public scope stays234 variants/218 layouts; historical monthly/Daily maps stay excluded.

Actual uncertain-source review also found an existing null normalized description on the saved `pve_ragthor_sb3` application. Presentation now accepts that observed null, preserves the native name, states that the description is unavailable and keeps the icon unbound. Its raw template/source bytes are unchanged. A UI regression uses this actual application. The previous v2 review note about Realm of Legends was incorrect: its saved map has **zero tile modifier assignments**, rather than assignments awaiting a shape export. The test now explicitly checks that empty observation. The frozen v2 artifact and handoff remain unchanged.

```powershell
python -X utf8 scripts/game-quests/build_native_icons_v3.py
python -X utf8 scripts/game-quests/build_native_icons_v3.py --output temp/quest-explorer-review/native-icons-v3-20261109/reproduced/application-icons-v3.json
python -m unittest discover -s scripts/game-quests -p 'test_native_icons_v3.py'
pnpm exec vitest run --config scripts/game-quests/vitest.config.mts src/tests/game-quests/native-icons-v3.test.ts src/tests/game-quests/native-icons-v2.test.ts src/tests/game-quests/application-icons.test.ts web/src/components/game-quests/quest-native-icons.test.tsx web/src/components/game-quests/quest-map-explorer.test.tsx
pnpm exec tsc -p scripts/game-quests/tsconfig.json --noEmit
```

New suites: `scripts/game-quests/test_native_icons_v3.py`, `src/tests/game-quests/native-icons-v3.test.ts`, `web/src/components/game-quests/quest-native-icons.test.tsx`. Tests cover every218-map application join, baseline preservation, reference zero, raw/version/component/missing-component/BCG/application/glyph/SVG/index/path drift, finite unknown-key rejection and decorative rendering. The source-only package/evidence, fresh actual desktop/320/390 Preview PNGs,204 HTTP/hash checks and compact combined selector are in `temp/quest-explorer-review/native-icons-v3-20261109/`. The prior reward/control matrix remains the receipt for unchanged controls. No new game access, full web build, shared CI registration or release action is needed.
