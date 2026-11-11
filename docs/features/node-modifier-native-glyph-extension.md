# Additional native game modifier glyphs

This additive increment exports the finite **204** glyph requirements already recorded in the approved v2 node evidence. All 204 have distinct nonempty source-font geometry and now have content-addressed SVGs. No original artifact, v2 detail/proof/index, baseline SVG, shared renderer, curated picker or database record is rewritten.

## Source and identity

The immutable build input is `src/data/game-node-modifiers/v2/source-index.json`, SHA-256 `9fc9209fbd623aa9ceb0500362cd51d2524c177279c1e2a57ee41bc7afb7a793`. The exporter validates every referenced artifact/detail/SVG/shared-source hash, plus the original three artifacts. It reads only `newGlyphRequirements` from the frozen v2 artwork proof; it does not search other effect pools or collect new game data.

The already reviewed native selection is revalidated: `PreFightBuffInfoItem` prefab → `_buffTypeLabel` → `mCustomFont` FontLocalizer → exact `UI/Fonts/Marvel-Icons-Font` resource/container and font PPtr. The resource TOC, named renderer evidence, UI bundle, font material/texture backer PPtrs and raw hashes are checked before extracting the font. This uses the selected font's native atlas/material backers; it does not substitute generic node-type sprites, glossary art, CDN images or a similarly named font.

The exact font SHA-256 is `8a8784655a64d06a8c51b1ea20a14ed605bf6f81ef4556ff8412aa0ca0016b61`. Each codepoint selects its native cmap glyph index and outline. Export preserves that outline, using the same font-unit scale with a 40-unit padded bounding frame and three-decimal SVG path precision. Glyph index, units-per-em, advance width, outline hash, bounds, frame and SVG byte hash are retained. There is no substitute artwork or inferred gameplay label. Missing cmap entries, empty outlines or invalid bounds have explicit statuses; none occurs in this finite 204-glyph set. The complete font is not published.

## Additive files and coverage

| Item | Count |
| --- | ---: |
| New native SVGs / registry entries | 204 |
| New exact full-version/glyph bindings | 1,089 |
| New observed application bindings | 3,894 |
| Additional recorded tile-assignment bindings | 62,712 |
| Combined known tile-assignment bindings in this node projection | 212,842 / 212,852 |
| Game definitions with a verified display icon after overlay | 1,685 / 1,688 |
| Unresolved first-component applications / missing glyph | 4 / 1 |
| Curated picker choices / verified curated semantic associations | 24 / 0 |

The five unresolved applications belong to three exact definitions: `pve_ragthor_sb3`, `pve_wllsclsng_1` (three applications) and `pve_scrg_autoblock`. They remain unbound, covering ten recorded tile assignments. A captured glyph alone cannot replace the missing first-component identity. These counts describe the existing node projection, not the quest owner's independently normalized application totals, live availability, active state or encounter coverage.

New proof files are under `src/data/game-node-modifiers/v3-native-icons/`:

- `glyphs.json`: all 204 exact geometry/font/frame/asset records and the pinned renderer profile.
- `icon-bindings.json`: exact Buff ID, component-inclusive version, BCG hash, first component/appearance/glyph, immutable SVG/key and full-definition source/hash/pointer. All observed application hashes remain attached.
- `application-proofs.json`: 3,894 newly bound applications with exact pointers into the frozen v2 proof, plus all four unresolved first-component cases and the missing-glyph case unchanged.
- `overlay.json`: small server-side definition/version-to-presentation projection. A definition gets one display icon only when every captured application/version agrees on that verified key.
- `source-index.json`: the relative path/hash entry point, SHA-256 `72947e3803b19069ade45728333e9cd92ecbdbd66d4cec91d3f1ccd89b61eb9f`. It pins the approved v2 source index, all four new proof/overlay files, the finite generated registry, both exporters and every new SVG.

New SVGs live under `web/public/node-modifiers/v3/icons/`. The finite generated registry is `src/domain/node-modifiers/native-game-icon-registry.ts` (34,192 bytes). Full artwork/application provenance stays in server/build inputs; the reusable renderer imports only finite keys and asset URLs. The source index is 52,703 bytes, the four proofs plus index total 7,698,996 bytes, and all 204 SVGs total 1,137,469 bytes.

The original three artifact hashes, all 27 approved shared files, all v2 exports/assets, schema, curated association ledger and curated picker/admin action contracts are checked against the pre-increment snapshot: **2,028 files unchanged**. The existing nullable `iconKey` migration remains unapplied. No new schema/persistence change is needed.

## Runtime and parent-owned quest integration

`native-game-icons.ts` exports `resolveNativeGameModifierIcon(unknown)` and the finite `NativeGameModifierIconKey` type. It resolves the original 24 keys plus the new 204 game-only keys; unknown values and arbitrary URLs return no icon. `GameNodeModifierIcon` accepts `{iconKey?: string|null, size?: number, className?: string}`. Its CSS mask uses `currentColor` and consistent dimensions. It is decorative (`aria-hidden`) beside an existing modifier name and adds no duplicate screen-reader label or focus target. SVGs use `currentColor`; consumers should use the supplied mask renderer or inline geometry rather than assuming an external `<img>` inherits text color.

The existing `NodeModifierIcon`, curated registry, picker, validators and persisted choices remain exactly as approved. New game-only keys are rejected by the existing curated edit validator. Icon presentation never asserts a curated/native semantic association.

The explorer's server reader applies `overlay.json` to an in-memory copy of the approved v2 summaries. It requires the approved base source index, catalog/BCG identity, exact Buff ID, complete version set and a registered new key. Stale, duplicate, partial-version or unknown bindings retain the existing fallback. The original index/detail bytes, destination IDs, prose, parameters, placements, provenance and source counts are unchanged. Public game catalog cards and native definition headings consume the additive renderer. Curated catalog records retain their independent stable identities and existing quiet fallback.

Quest source files are untouched. Root can later freeze/copy this v3 source index and its referenced files as reviewed **build-time** inputs. For each quest application:

1. Validate byte hashes from the v3 index and its pinned v2 index.
2. Recompute the complete Buff/component/missing-component/BCG version using the existing sorted JSON contract; require its exact version hash and source BCG.
3. Require the exact captured glyph as well as Buff ID/version. Follow the full-definition and application proof pointers; do not join on a title or glyph alone.
4. Require one matching verified binding and an immutable registered SVG/key. Otherwise retain an unbound result.

No quest runtime dependency on this worktree, uncommitted sibling modules or whole proof JSON is introduced. Root owns the later occurrence join and its coverage count.

## Reproduce and validate

Run from the node checkout with existing offline source dependencies. The exporter permits only the new v3 namespace or this checkout's ignored `temp/` outputs and refuses old namespaces. Source files and installed resources are read-only.

```powershell
python -X utf8 scripts/export_mcoc_node_icon_extension.py --root C:/Users/ossul/.t3/worktrees/CereBro/t3-42693f98 --bundle 'C:/Games/Marvel Contest of Champions/default/game/Champions_Data/Resources/Data/ui/ui.assetbundle' --bcg C:/Code/CereBro/temp/quest-data-investigation/game-only/sources/bcg-E95E28EECECC04D6A358C8FD8089D01305D0FB73.bin --schema C:/Code/CereBro/temp/crystals/schema.json --output temp/node-native-glyphs-v3-20261109/reproduced --assets temp/node-native-glyphs-v3-20261109/reproduced-assets --work temp/node-native-glyphs-v3-20261109/reproduce-work --registry-out temp/node-native-glyphs-v3-20261109/reproduced-registry.ts
pnpm exec vitest run src/domain/node-modifiers/native-game-icons.test.ts web/src/components/nodes/GameNodeModifierIcon.test.tsx web/src/lib/expanded-node-modifiers.icons.test.ts web/src/app/nodes/node-views.test.tsx web/src/app/nodes/public-catalog-view.test.tsx web/src/app/nodes/node-filter-form.test.tsx --maxWorkers=1
python -X utf8 -m unittest discover -s scripts -p 'test_export_mcoc_node_icon_extension.py'
pnpm exec tsc --noEmit -p temp/node-native-glyphs-v3-20261109/tsconfig.json
```

All five artifacts, 204 SVGs and registry reproduce byte-for-byte. Twenty affected Vitest tests and four Python tests pass, with scoped TypeScript/lint and exporter syntax checks. Tests cover finite registration, all geometry frames/assets, exact version/glyph/source chain, source drift/unknown rejection, output protection, unchanged definition values, accessibility and the unchanged curated choice boundary.

All six actual atlas pages were inspected in Preview, covering all 204 glyphs. Real public browser captures at 320/390/1280px show representative new icons on catalog/detail pages and the missing-glyph fallback. The browser fetched all 204 registered SVGs and checked their SHA-256 bytes. Search retains one aligned focus contour and keyboard select focus; GET Submit/Clear/Back preserve the submitted filters. Preview selector timeouts were retried successfully with fresh snapshot references; no browser fallback or game access was needed. Owned tabs are closed; own port 3013 remains available. A temporary static atlas document used on that port was removed after capture.

New suites for root CI registration: `src/domain/node-modifiers/native-game-icons.test.ts`, `web/src/components/nodes/GameNodeModifierIcon.test.tsx`, `web/src/lib/expanded-node-modifiers.icons.test.ts`, `scripts/test_export_mcoc_node_icon_extension.py`.

Exact source/asset hashes, inspected PNGs, browser observations, the complete interactive native atlas, compact screenshot preview and parent handoff are in `temp/node-native-glyphs-v3-20261109/`. No database writes, migrations, game/server calls, commits, pushes, PRs, deployment, global navigation, CI/package edits or sibling edits occurred.
