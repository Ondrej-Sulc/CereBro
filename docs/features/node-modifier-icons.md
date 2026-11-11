# Shared native modifier icons

Curated modifiers can now have an explicit native icon choice wherever their existing cuid is displayed. `NodeModifier.iconKey` is nullable presentation metadata. It is **not** a Buff ID, definition association, combat value, allocation or quest-use claim. There is no automatic assignment by name/description, no backfill and no rewriting of curated IDs/descriptions or planning relationships. No verified production curated-to-definition mapping was available in this checkout.

## Shared contract

`src/domain/node-modifiers/native-icons.ts` exports the finite 24-choice registry, `NativeModifierIconKey`, `resolveNativeModifierIcon(unknown)`, the four-field `CuratedNodeModifier` DTO and `curatedNodeModifierSelect`. The registry module is 4,639 bytes and includes only opaque immutable keys, human-readable visual labels and the existing content-addressed SVG paths. The key includes a prefix of the asset hash; a replacement shape does not silently reuse an old key. Unknown/null keys return no art. Icon labels describe shared shapes rather than asserting that a curated record has that gameplay definition.

`web/src/components/nodes/NodeModifierIcon.tsx` uses the registry's exact local SVG as a CSS mask. It inherits `currentColor`, reserves a consistent square size, does not receive arbitrary URLs, and is always `aria-hidden` beside the existing modifier name. It has no duplicate accessible label or extra focus stop. Missing choices preserve text/quiet existing Info fallback. Highlight Stars remain separate indicators and controls.

The standalone admin picker exposes only registered choices plus **No icon**, native radio keyboard behavior and a visual search. Saving is explicit. `updateModifierIcon` retains `MANAGE_WAR_CONFIG`, validates runtime input against the registry, and performs one atomic update guarded by the existing cuid, exact name, exact description and previous icon key. It changes only `iconKey`; stale records fail with a refresh message. It invalidates the existing process's `war-nodes-` cache prefix and the relevant admin/planning routes. Other instances retain the existing cache TTL behavior. Icon editing is separate from allocation editing, including on search results: it never adds/replaces a WarNodeAllocation.

The existing reconciliation EXTRACT/DIFF/DRY-RUN files and contracts remain unchanged. A presentation choice is not a reviewed `curatedId/effectId/versionHash/curatedHash` association. Its original dry-run hashes the complete supplied curated JSON record; continue supplying the same reviewed id/name/description projection, or explicitly review any changed input hash. Do not convert an icon choice into a definition binding.

## Consumer coverage

| Surface | Reuse and data flow |
| --- | --- |
| `/nodes` browse/detail | Same reusable component; exact verified native definition/version/artwork bindings supply its key. Approved portraits and hierarchy remain intact. |
| `MultiNodeModifierCombobox` | Result names and selected chips; existing search/select/remove keyboard handlers preserved. |
| Quest `EncounterNodeList` | Collapsed badges and expanded cards; importance Star separate; Info fallback retained for unassigned/unknown keys. |
| Quest `EncounterCard` | Collapsed summary badges retain truncation/text and separate highlight Star. Expanded lists reuse `EncounterNodeList`. |
| Admin quest builder | Selected modifier/highlight chips and encounter badges; native art separate from the highlight button/state. |
| War/defense `ActiveModifiers` | Badges and popover heading use the shared icon. Triggers are native buttons so Enter/Space and focus work. Both node-editor/defense consumers retain their existing filtering. |
| Admin node manager | Allocated names, current/edit names, search results, independent Icon actions and a native picker dialog. Phone layout stacks existing panels/actions to keep text and controls usable. |
| DTOs/readers | Authenticated modifier search, admin node/quest loaders, quest detail/share readers and war-node API explicitly select id/name/description/iconKey. Existing included Prisma NodeModifier scalars in planning and bot readers also carry the nullable key after regeneration. |
| Quest transfer/import | Existing identity and transfer semantics stay unchanged. Icons are shared curated presentation choices, not inferred/copied by a transferred name or untrusted JSON. |
| Discord `/aw details` | Still text-only name/description; see gap below. |

## Exact native bridge and quest coordination

The tiny registry is projected deterministically by `scripts/project_mcoc_node_icon_registry.py` from the existing hash-verified artwork artifact. It also emits `src/data/game-node-modifiers/icon-bindings.json`: 39 exact effect/version bindings to the 24 keys. Tampered artwork is rejected before output. No original catalog, source, application, use, portrait or glyph asset bytes change.

The **server-side** `modifierVersionIconKey(effectId, versionHash, catalogHash)` in `src/data/game-node-modifiers/artwork.ts` additionally checks the artwork revision, catalog hash, finite key and exact source asset agreement. Missing identity/version/hash evidence returns undefined; names and raw Buff IDs are not icon keys. `modifierIconKey` preserves the explorer's existing whole-definition version checks.

The narrow future quest-map DTO is `{ iconKey: NativeModifierIconKey | null }`; pass it only after a verified native binding. Render with `<NodeModifierIcon iconKey={application.iconKey} />` beside the existing application wording. Keep source/affected, local/global/linked and attacker/defender metadata independent. Do not import `artwork.ts`, artwork/provenance, quest or definition JSON into client components. The observed development fixture client chunk contained none of the catalog/artwork/use-contract, exact Buff ID or local-evidence-path markers; the shared component imports only the tiny registry module.

This contract was sent read-only to the active [quest track](<t3-thread://v2/b5d11ff5-3b2f-4765-b98d-35572d334145/thread:delegated-task:command%3Amcp%3A6619ed05-3f60-4eab-a94c-f7c9d3f5ab86%3Adelegate-task%3A51adafc6-7aca-4a3a-874e-19d2bc572d3d>). No sibling source files were edited/imported. The bridge remains limited to verified definitions in the existing five-map subset; it does not claim complete quest-use or native-art coverage.

## Discord limit

The source inventory found actual modifier-name/description output only in `src/commands/aw/details.ts`; it uses a Discord V2 text section. Existing war map/assignment graphics do not render modifier lists. A CSS/SVG mask cannot render inline in Discord text, and the native font character is not a Unicode gameplay icon. No fabricated emoji, arbitrary asset URL, attachment/media redesign, message send, asset upload or emoji registration was introduced. Core identifiers are available for a future graphical renderer with an explicitly packaged asset mechanism, but **inline Discord modifier icons are not implemented** in this increment. The bot's existing text remains usable.

## Unapplied migration and release sequence

`prisma/migrations/20261109113000_node_modifier_icon_key/migration.sql` adds one nullable TEXT column only. **It has not been run against any database.** Prisma Client was generated locally for validation; no migration, seed, import, backfill or database mutation was executed. The own 3013 server was stopped/restarted to release its Windows Prisma DLL lock; no other ports/worktrees were touched.

Root release order:

1. Apply the additive migration using the normal authorized release process before deploying either web or bot code generated from this schema. New Prisma readers can select the new scalar even where the UI remains text-only.
2. Generate/build web and bot clients with the matching schema, then release them normally. Old clients remain compatible with the added nullable column.
3. Admins may explicitly choose icons later. Existing records start null; no choices were saved here. Do not assert semantic curated/game-definition mappings from these presentation choices.

## Validation and review limits

New suites for parent CI registration (CI unchanged):

- `scripts/test_project_mcoc_node_icon_registry.py` — deterministic projection and source-drift rejection.
- `src/domain/node-modifiers/native-icons.test.ts` — finite keys and explicit guarded choices.
- `web/src/app/admin/nodes/actions.icons.test.ts` — permission, rejected URLs/IDs/unknowns, atomic drift guards, clearing and reader DTO/cache propagation.
- `web/src/components/nodes/NodeModifierIcon.test.tsx` — decorative/currentColor rendering, selected chips/war badges and independent Stars.
- `web/src/components/nodes/modifier-icon-admin-flow.test.tsx` — real client components, debounce/search, native picker and explicit save with mocked server boundaries; no allocation mutation.

The affected focused suites pass 38 Vitest and 29 Python tests (67 total). Scoped TypeScript and lint pass; lint reports three existing unused-symbol warnings in quest-catalog/EncounterCard plus environment notices. No full web typecheck/build was started. The scoped config and exact commands are in `temp/node-modifier-icon-reuse/HANDOFF.md`.

Real T3 Preview captures cover desktop, 390px and 320px. The public explorer uses actual source-backed data. Protected planner/admin components use an explicitly labeled temporary fixture route and in-memory sample records; the temporary route was removed. No login, private account read or database write was used. The actual admin modal was opened without saving to its server action; a separate actual editor fixture saved only local memory. Browser checks verified same-name independent choices, unassigned fallback, native masks, removal/select behavior, keyboard-opened popovers, explicit save/status and no horizontal document overflow in measured final captures. All owned Preview tabs are closed; own3013 remains available. Some Preview operations required fresh snapshots/retries after resizing, and development HMR history included a transient hook-dependency warning while editing; clean-page checks passed. No headless fallback was used in this increment.

The authenticated full quest-builder/planner pages and persistence against a migrated database were not exercised. Their affected source/type flows and shared display components were checked, with mocked server tests for the new mutation. Root retains integrated authenticated/release validation. Fresh inspected PNGs, exact file manifest and compact self-contained/absolute-path `preview.html` variants are under `temp/node-modifier-icon-reuse/`.
