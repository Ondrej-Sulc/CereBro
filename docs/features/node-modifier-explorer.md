# Node modifier explorer

The additive [native glyph extension](node-modifier-native-glyph-extension.md) now exports the 204 shapes listed as pending in the immutable v2 proof below. It supplies a separate game-only registry/renderer and exact binding overlay; all original/v2 artifact bytes and the 24 curated choices remain unchanged.

The verified native glyphs are also available through a tiny shared registry and reusable web component. Curated records use an explicit nullable presentation key, independently of game-definition identity; consumer coverage, the unapplied migration and release sequencing are documented in [Shared native modifier icons](node-modifier-icons.md).

The public `/nodes` explorer now browses the existing curated database catalog and a separate versioned projection of assigned game definitions. `/nodes/curated/[cuid]` preserves existing curated identities; `/nodes/[exactBuffId]` retains every original native destination. Equal names remain separate records.

## Current public catalog and v2 expansion (9 November 2026)

A repeatable-read, read-only transaction found **3,661 curated NodeModifier records** at `2026-11-09T21:08:48.741Z`. Only `id`, `name`, and `description` were counted/exported; no player, account, war, alliance, or profile tables were accessed. The public three-field export hashes to `a914b48db821de4a4ef32621227f75814d9973b67b18bd3f554d131a4f4e7d42`. It remains an ignored review artifact, not a bundled database snapshot.

The server-only reader selects exactly these three fields, caches successful reads for five minutes using the existing cache, and bounds the read at 50,000 rows. It does not request the unapplied `iconKey` column. Search/sort/source filters and 24-record pagination run on the server. A failed read displays an unavailable status; it never represents failure as a true empty catalog. Only the GET filter form needs a small client component; the catalog, artwork provenance and full source shards are not client imports. Form fields synchronize with the URL after native/Next Back navigation. Search focus uses one aligned wrapper contour; selects, links and buttons keep their own visible keyboard focus.

| Source | Observed coverage |
| --- | --- |
| Existing curated catalog | 3,661 independent records; names/descriptions/cuIDs untouched |
| Assigned native game definitions | 1,688 Buff IDs / 1,688 full versions |
| Application identities | 8,853 distinct captured application contexts; 13 definitions retain missing component IDs |
| Source contexts / exact tile assignments | 13,823 / 212,852 (not encounter or activation counts) |
| Accepted permanent scope | 234 variants, 218 captured layouts; 168 Story / 50 Special layouts |
| Retained historical sample | Two additional original monthly/Daily layouts, for old URLs and source continuity |
| Reviewed curated associations | **0**; all 3,661 curated records remain browseable and unlinked |
| Native portraits | 409 exact game IDs; 409 verified portraits, 290 exact public champion links |
| Reused native glyph coverage | 150,130 tile assignments have a verified binding to an existing exported shape |

The v2 build reads only actual per-tile attacker/defender and named source Buff lists. Arbitrary BCG gameplay effects, rewards, paths and unassigned effect pools are not promoted into node definitions. Full Buff versions, exact component order, absent components, parameters, raw applications, assignment identities, source pointers and map hashes remain in separate lazy detail shards. A complete read-only JSON evidence download is available from each native detail page; the default page has bounded quest groups and evidence previews. No whole quest catalog or graph is copied/imported at runtime.

Containing category/set, native act/chapter membership and exact summary indices supply readable location labels. The projection never parses qid suffixes or links undeployed quest routes. Defender portraits use only exact native character/image references and existing exact public gameId bindings; NPC/legacy portraits retain no invented champion link. There are no public coordinate literals. Distinct resolved wordings appear once, with grouped recorded source/placement contexts beneath them. Local/defender defaults stay quiet; linked/global/trap and attacker exceptions stay visible. The larger corpus contains **4,204 observations where the source configuration flag differs from assigned-list membership**. Both are preserved separately; the display side follows the explicit attackerBuffs/defenderBuffs list. Neither establishes whether an effect is currently active.

The 24 shared SVGs, shared registry/renderer and original `catalog.json`, `icon-bindings.json`, `artwork.json` remain byte-identical. The v2 index, source ledger, detail shards and portrait projection live under `src/data/game-node-modifiers/v2/`; additional lossless native portraits live under `web/public/node-modifiers/v2/portraits/`. Of 8,853 applications, 4,954 bind an existing exported shape, 3,894 have a source glyph whose shape has not been exported, four have an unresolved first component, and one has no glyph. Unknown shapes remain absent; generic node art is not substituted.

Curated association remains an explicit reviewed `{curatedId,effectId,versionHash,curatedHash}` contract. The public hash is sorted UTF-8 JSON of exactly `{description,id,name}` and matches that three-field offline export. Missing records, stale versions and curated text drift reject the association. The empty reviewed ledger supplies no implicit title/description matches or icons/locations. Presentation `iconKey` choice remains a separate, previously prepared admin feature. Its migration stays **unapplied**, and this public reader works against the current database without it.

### Reproduce v2 without source or database writes

The saved quest worktree is a build input only. `prepare` pins its accepted public scope, three hierarchy captures and each exact raw map source. `build` validates these and the frozen baseline, current named schema/build and retained identical BCG bytes. Reproduce into a separate directory; never overwrite the source ledger. Raw captures stay in ignored research storage.

```powershell
python scripts/build_mcoc_node_expansion.py prepare --quest-root C:/Users/ossul/.t3/worktrees/CereBro/t3-f919ccfc --original-root C:/Code/CereBro/temp/quest-data-investigation/game-only --output temp/node-explorer-v2-20261109/input-profile.json
python scripts/build_mcoc_node_expansion.py build --quest-root C:/Users/ossul/.t3/worktrees/CereBro/t3-f919ccfc --original-root C:/Code/CereBro/temp/quest-data-investigation/game-only --profile src/data/game-node-modifiers/v2/source-profile.json --bcg C:/Code/CereBro/temp/quest-data-investigation/game-only/sources/bcg-E95E28EECECC04D6A358C8FD8089D01305D0FB73.bin --schema C:/Code/CereBro/temp/crystals/schema.json --output temp/node-explorer-v2-20261109/reproduced-correlated
python scripts/diff_mcoc_node_expansion.py diff --before src/data/game-node-modifiers/v2/index.json --after temp/node-explorer-v2-20261109/reproduced-correlated/index.json --out temp/node-explorer-v2-20261109/diff.json
python scripts/diff_mcoc_node_expansion.py dry-run --index src/data/game-node-modifiers/v2/index.json --curated temp/node-explorer-v2-20261109/curated-public.json --bindings temp/node-explorer-v2-20261109/reviewed-bindings.json --out temp/node-explorer-v2-20261109/reconciliation.json
```

The v2 DIFF uses exact ID/detail-source hashes and independently flags source-ledger drift. DRY-RUN preserves all exported fields/IDs and returns `writes: []`; no apply mode exists. The full expansion (1,693 files), original v1 extraction and new portrait manifest plus 297 additional unique WebP files reproduce byte-for-byte. The original cached BCG path used in the historical commands below is now missing; use the retained hash-identical `game-only/sources/bcg-E95E28EECECC04D6A358C8FD8089D01305D0FB73.bin` instead.

### Frozen v2 icon proofs for later quest integration

`src/data/game-node-modifiers/v2/source-index.json` is the **build-time** entry point. It pins the index/source ledger/portrait/artwork/binding files, all 1,688 detail shard paths and byte hashes, all 24 immutable SVGs, and the three unchanged shared registry/renderer source files. Its SHA-256 is `9fc9209fbd623aa9ceb0500362cd51d2524c177279c1e2a57ee41bc7afb7a793`. No quest worktree imports these at runtime.

`v2/artwork.json` (SHA-256 `93d0b19d9ad0a9c7f6483d5fb4defa7104f6eccf15ee60ac5240ed20867515a1`) provides all 1,688 full-definition/component-inclusive-version source pointers, 8,853 application glyph proofs, the pinned BCG/schema and original named renderer/font/PPtr evidence. Each full version is recomputed against the exact named BCG components before export. Each proof retains exact effect/version/application IDs, first component/appearance identity and appearance hash, captured glyph, plus immutable SVG hash/path/key only when the reviewed chain resolves. Missing components and absent/unexported shapes stay explicit. No title matching occurs.

`v2/icon-bindings.json` (SHA-256 `32669973f518a03d8ed72e83f688bfdb13470f1aabd159a3caeb175d7b4bf990`) has **596 distinct exact definition-version/glyph bindings**, covering 4,954 application identities in this node projection. It binds the artwork content hash and BCG bytes. These counts are not the quest sibling's application totals. Root can later validate the source-index byte hashes, recompute the full Buff/component/BCG version hash, then require the exact version **and captured glyph** before reusing an SVG/key for another quest application. An effect ID or glyph alone cannot prove that join. Curated association remains independent.

The remaining 3,894 applications in this projection have captured native glyphs corresponding to **204 additional shapes** that are not in the approved 24-shape export. They are listed by exact codepoint, appearance IDs and full version under `newGlyphRequirements` in the v2 artwork artifact. Four applications lack a first-component binding and one lacks a glyph. No new font outline, registry key, shared component change or generic UI artwork was introduced. The quest owner's independently reported remaining applications lack a matching full version in the **original 39-version** inputs; this export does not relabel those as lacking captured glyphs or claim their new binding total. Root owns that later build-time join.

Reproduce the new proofs with `scripts/project_mcoc_node_expansion_icons.py --root <this-checkout> --index src/data/game-node-modifiers/v2/index.json --bcg <retained-bcg> --schema <named-schema> --output <separate-folder-in-this-checkout>`. Logical source paths remain canonical, so all three output files reproduce byte-for-byte in a separate output folder. This tool reads source evidence only and changes none of the original three artifacts.

The following audit, v1 contracts and earlier reviews document the immutable first increment; their five-map/39-definition counts describe that baseline, not today's mixed public catalog.

## Existing update-path audit

The deployed baseline was `a90cb03ce2235b05113d4153bd31818d5a1acfaa`. Repository searches for `NodeModifier`, `nodeModifier` and `node_modifiers` found these paths:

| Path | Existing behavior | Game-backed refresh? |
| --- | --- | --- |
| `src/scripts/import-node-modifiers.ts` | Reads sibling `node_modifiers.csv`; creates name/description rows; skips composite duplicates. | No source ID/version, game extraction or update. |
| `web/src/app/actions/quest-encounters.ts`, `bulkImportNodeModifiersFromJson` | Admin permission gate; imports title/description JSON; **finds the first case-insensitive name match** before creating/linking a modifier. | No. This name-only behavior is unsafe for game reconciliation and is not reused here. |
| `web/src/app/admin/nodes/actions.ts` | Authenticated search; permission-gated allocation add/update/copy/delete. | Allocates curated records; does not refresh their definitions. |
| `web/src/app/actions/quest-plan-transfer.ts` | Transfers existing planning identities using names and descriptions. | No native game source/version contract. |
| `src/scripts/db-sync.ts` | Generic database sync, including `nodeModifier`, keyed by `(name, description)`. | Not game extraction. |
| War/quest planners, comboboxes, bot AW detail rendering | Read existing records and planning references. | No definition refresh. |

`prisma/schema.prisma` defines `NodeModifier.id` as a cuid and `@@unique([name, description])`. `WarNodeAllocation` and `QuestEncounterNode` reference that identity. There is no game ID/version column. No automatic game-backed modifier refresh was found in the audited repository paths. The original audit was read-only repository analysis. The resumed public catalog audit above subsequently read only the three authorized public fields; no database records were changed.

## Source evidence

`src/data/game-node-modifiers/source-profile.json` pins every input by SHA-256. The bundled catalog contains this profile and its hash. Extraction checks those bytes before reading data.

- Saved `continuation/runtime-supply.json`: four explicit map pointers for November Crossed Wires, Weekly Supply Run, Fair Play and Surrender. SHA-256 `f6182a313124da16011faf9123b94dc6066418f4b7484606858d5601583ae04d`.
- Saved `expansion/maps/a04_ch04_q06.json`: Culmination `/map` only. SHA-256 `f763b0599012425c08c8a0897d535e580c4376118eb9bea1a09df08b01506dab`.
- Current cached BCG: SHA-256 `b821489b5451d1d6ee0927f39a80d964f6c1d3aaf13bd76531e5f77d93deba8e`.
- Named protobuf schema: SHA-256 `9cc5236aef043cf7e5655458e790ed1f0897f67398e37af3020bca74511e97c4`; provenance includes the exact Marvel/Fuse metadata hashes.
- Named ISIL files: `Fuse.Runtime/EB/Sparx/Buff.txt`, `Marvel.Runtime/QuestBuffData.txt`, `QuestTypedBuffData.txt` and `GameUtils.txt`, each hash-bound in the profile.

`EB.Sparx.Buff` supplies the exact `id`, localized name/template, type, scope, `value`, `displayValue`, `valueStr`, `buffStatMods`, quantity and recorded metadata. `QuestBuffData` binds a Buff to resolved `buffDescription`, amount, appearance, `nodeSource` and source coordinate. `QuestTypedBuffData` retains `type`, `buffs`, `bt`, `attk` and `remainActive` independently. The source type's recorded enum name and number are both retained. In the original five-map projection, `attk` supplied the recorded source-side flag. The v2 expansion separates it from explicit assigned-list membership; it does not infer beneficial/harmful polarity, the component's internal effect target or combat activation. A defender-assigned source may describe an effect acting on the attacker. Exact `RedeemerItem.Type=buff` / `Data` identities provide links to other definitions in the same source group, only when their destination exists in this catalog.

`QuestBuffData`'s constructor follows the Buff `valueStr` component identity into BCG and calls `GameUtils.GetFormattedLocalizedBuff`. The named BCG contract is `BCGDataBuffer.stat_modifiers` tag 1 -> `BCGStatModifier.ID`, with Chance tag 13, Modifier tag 14, Duration tag 15 and Stackable tag 24. These are not the legacy misnamed numeric fields. Raw formulas, growth fields, targets and all other decoded component members are retained. The BCG stat-modifier table is **not** a catalog of usable quest nodes.

The extractor never resolves templates itself. The UI's resolved prose comes from captured `QuestBuffData.buffDescription`; the original template and raw parameters are separate. It removes only known game text-format wrappers for display, retaining complete original strings in evidence. Exact glossary keys in that text are not linked because no existing exact glossary route was present in this baseline. No champion identity is inferred from prose.

One source component, `saga_aspctstr_effct_ps1_seq1`, is absent from the pinned BCG table. `saga_boost_aspect_of_strength` keeps that missing identity and its independently captured application text. It is not silently filled, omitted or classified as fully resolved.

## Stable definition contract

`cerebro.node-modifier-definitions/v1`:

1. **Definition identity** is the exact Buff `id` string. Name is presentation only. Same-name IDs remain distinct.
2. **Definition hash** is SHA-256 of the complete captured Buff object. Missing versus null and component order are preserved. Level suffixes stay in source text; no numeric level is guessed.
3. **Version hash** binds `{raw, components, missingComponentIds, sourceBcgSha256}`. Each exact linked component includes its ID, complete decoded fields and content hash. A changed component changes the version even when the Buff's own fields are identical. The complete BCG hash conservatively invalidates versions when referenced formulas/inheritance change without changing those raw component rows. Formula/growth evaluation and effective inheritance expansion are not implemented; raw parameters and IDs are not promoted to effective combat values. This is a computed content revision, not an invented native per-definition version.
4. **Application hash** binds every captured QuestBuffData field except the separately versioned Buff and source coordinate. It includes resolved text, amount, appearance, source kind, side, source item list, linked target coordinates, raw remainActive flag and other captured fields. Different parameterized text or source context stays distinct.
5. Equal application contexts group repeated list observations. A representative source ID, JSON pointer and source coordinate are retained, as is the observation count. These counts include overlapping aliases (`sourceAllBuffs`, `sourceLocalBuffs`, etc.); they are not encounter counts. This sample is not an occurrence index.
6. File SHA-256 hashes bind exact input bytes; `profileHash`, `definitionHash`, component hashes, version hashes, application hashes and `contentHash` bind sorted-key compact UTF-8 JSON using Python `json.dumps(..., ensure_ascii=False, separators=(',', ':'), sort_keys=True, allow_nan=False)`. Recompute contentHash from the catalog without its contentHash field. File-byte hashes and JSON-content hashes are different contracts.

Definitions are independent of quest normalization. No map graphs, placements, path indexes or quest catalog are rebuilt by this track.

## Offline EXTRACT -> DIFF -> DRY-RUN

From this checkout, with the retained local evidence available:

```powershell
python scripts/extract_mcoc_node_modifiers.py extract --profile src/data/game-node-modifiers/source-profile.json --source-root C:/Code/CereBro/temp/quest-data-investigation/game-only --bcg C:/Users/ossul/AppData/LocalLow/Kabam/Champions/bcg/out/v1/E95E28EECECC04D6A358C8FD8089D01305D0FB73.bin --schema C:/Code/CereBro/temp/crystals/schema.json --evidence-root D:/CodexArtifacts/Cpp2IL-2026-11-03/IsilDump --out temp/node-modifier-review/candidate.json
python scripts/extract_mcoc_node_modifiers.py diff --before src/data/game-node-modifiers/catalog.json --after temp/node-modifier-review/candidate.json --out temp/node-modifier-review/diff.json
python scripts/extract_mcoc_node_modifiers.py dry-run --catalog temp/node-modifier-review/candidate.json --curated <reviewed-export.json> --bindings <explicit-bindings.json> --out temp/node-modifier-review/reconciliation.json
```

For a new game version, retain new offline Buff/application captures, BCG bytes, current named schema and named method evidence. Review their identities and semantics, then create a new profile ID with exact file hashes, game build and explicit sample pointers. Unknown protobuf fields, mismatched input hashes, duplicate/missing component IDs, missing map pointers and capture/build mismatches fail extraction. Missing referenced components are held explicitly. A newly captured Buff with no `statMods` binding remains opaque; its `valueStr` is not repurposed as component IDs. Review the candidate diff before promoting the new static catalog. No automatic schedule, endpoint fetch or database importer is introduced.

All commands read input files and write one requested output artifact. Output may not overwrite any declared input. DIFF reports added/removed/changed exact IDs; source text, components, applications and provenance within definitions participate in comparison. `provenanceChanged` independently flags profile/input source drift even when definitions are identical. Duplicate definition identities fail comparison. DRY-RUN returns `writes: []` and unchanged curated input records. There is no apply mode, database client, network client, migration or production write path.

## Curated reconciliation contract

The dry-run accepts an offline curated export with existing cuids and complete original fields. An explicit reviewed binding is:

```json
{ "curatedId": "existing-cuid", "effectId": "ava_ea20", "versionHash": "exact-version-sha256", "curatedHash": "sha256-of-complete-exported-row" }
```

Every binding checks cuid existence, exact Buff identity, exact version and unchanged curated row hash. Stale/missing bindings remain blocked (`missing-curated-record`, `missing-definition`, `definition-drift`, `curated-drift`). Unbound records are reported, never matched by name. Even verified bindings propose no writes. A later integration should store this source association separately/additively and preserve curated cuids/descriptions and every existing `WarNodeAllocation`/`QuestEncounterNode`. Reworks must create reviewed source versions; they must not delete/recreate curated records or redirect planning references. Changes to production persistence and the legacy name-only importer remain root-owned follow-up work.

## Quest reverse-use bridge

The sibling owns all quest/map/path/placement normalization. The parent can bridge its verified occurrence projection to this catalog using the following source association, without importing unreleased sibling code:

```typescript
type ModifierUse = {
  effectId: string // exact Buff ID, not a BCG component or English name
  questId: string
  mapId: string
  sourceSha256: string // captured map source bytes
  sourcePath: string // exact JSON pointer within those bytes
  pathIndex: number | null // null for an application outside a verified path
  node: { x: number; y: number }
  applicationId: string // sibling's stable occurrence identity
  definitionVersionHash: string | null // only when full definition/parameter evidence agrees
  rawSourceType: { name: string; value: number } | null
  target: 'attacker' | 'defender' | 'unknown'
  remainActive: boolean | null // raw flag; never simulated active state
  resolvedText: string | null
}
```

An effect ID can locate the definition family; a version join additionally requires matching full Buff/component/parameter evidence. Missing definitions must remain unresolved rather than joining by name. Definitions' representative application contexts cannot substitute for the sibling's complete occurrence index. The bounded modifier location projection below uses only the original five maps. There are no sibling links, live access claims or removal-state conclusions.

### Recorded quest location projection

`src/data/game-node-modifiers/uses.json` is an additive **five-label / 96-source-use projection**, not another normalized quest catalog. It has no graphs, paths, rewards, summaries for other quests or dependency on sibling code. The original modifier catalog/profile and extractor bytes stay unchanged. `scripts/project_mcoc_node_uses.py` deterministically reads only their pinned five map pointers, their native quest summaries/hierarchy and the same named BCG/schema evidence. It writes one local JSON output and refuses to overwrite its inputs.

Story numbering uses exact `Acts -> Chapters -> Quests` membership plus the captured summary's `actIndex.chapterIndex.questIndex`. Native act display indices and labels are retained independently even if they disagree. No qid suffix is parsed. The bound labels include `4.4.6 · Culmination` and `5.1.1 · Fair Play`. A redundant `6. ` name prefix is removed for display only when it agrees with the explicit quest index and verified Story membership. Difficulty uses the recorded text, then the containing set's exact `difficulties[difficultyId]` progression bounds; Crossed Wires is `Progression rank 4`, with no guessed progression title. Missing authored membership/difficulty is not filled from English names or IDs.

Placed defender labels follow the tile's exact boss dictionary key -> `QuestSummary.bosses[key].blueprint` -> named BCG `Blueprint` -> `Character` -> `_friendlyNameLoc.en`. Unknown bindings remain unresolved. Native placement numbers/coordinates remain in Source data; the product presents exact defender portraits instead of node numbers. Unplaced boss-table definitions are not encounters.

The exact join is `(Buff ID, definition hash, application hash) -> modifier version hash`, then `(questId, mapId, capture SHA-256, JSON pointer)`. Every occurrence preserves its source coordinate separately from the affected tile. Only the game's captured **attackerBuffs/defenderBuffs** lists establish assigned destination fights; source lists/linked `bt` targets do not create assignments. Repeated source-list aliases deduplicate without deleting their evidence pointers. Local contexts group by quest/side for display; linked/global contexts keep separate source nodes. All original identities, source pointers, affected placements and labels' native provenance remain in optional Source data.

The placement bridge agreed with the quest track is `(questId, sourceHash, coordinate, boss dictionary key)`, separate from the source tile and modifier application/version identities. The existing rules were confirmed in [quest-track coordination](<t3-thread://v2/b5d11ff5-3b2f-4765-b98d-35572d334145/thread:delegated-task:command%3Amcp%3A6619ed05-3f60-4eab-a94c-f7c9d3f5ab86%3Adelegate-task%3A51adafc6-7aca-4a3a-874e-19d2bc572d3d>). Native labels are retained on disagreement with indices. Runtime imports from that worktree and quest links remain absent in this independently deployable increment.

Reproduce from retained offline inputs:

```powershell
python scripts/project_mcoc_node_uses.py --catalog src/data/game-node-modifiers/catalog.json --source-root C:/Code/CereBro/temp/quest-data-investigation/game-only --bcg C:/Users/ossul/AppData/LocalLow/Kabam/Champions/bcg/out/v1/E95E28EECECC04D6A358C8FD8089D01305D0FB73.bin --schema C:/Code/CereBro/temp/crystals/schema.json --out temp/node-modifier-locations/reproduced-uses.json
```

The projected artifact's hash binds its modifier catalog hash, source input hashes, BCG/schema hashes, five labels, placements and exact application joins. Source-only observations cannot become affected fights. Active state after source removal is never inferred. An unknown/stale projection produces a readable unresolved-location fallback rather than matching names.

## Public presentation

The explorer leads with **Node modifiers**, name/condition search and recorded resolved effect text. Catalog cards retain separate destinations for same-name game IDs, while exact IDs remain available in detail Source data. Additional evidence filtering is secondary to source/assignment filters.

`web/src/app/nodes/node-presentation.ts` groups identical display wording only for presentation. Each group keeps every original application object and definition version; different wording/values form separate groups. **Where it appears** groups recorded uses by verified quest/context, showing Story numbering, names, supported difficulty and named defender placements. Linked/global entries explicitly separate the source node from affected fights, with further placements expandable. Catalog cards also show quest labels. Phone layouts put resolved values first. Original templates, all raw parameters/precision, application/quest/source identities, hashes and source pointers remain under closed **Source data** details. Missing evidence has a concise status; assignment versus active state is clarified close to linked/global uses. The product contains no integration roadmap copy, raw-ID location labels or dead quest links.

This presentation refinement changes no extraction, catalog, hash, reconciliation or occurrence contract.

## Validation and review

New suites for parent CI registration (CI file unchanged):

- `scripts/test_extract_mcoc_node_modifiers.py`
- `scripts/test_project_mcoc_node_uses.py`
- `src/domain/node-modifiers/catalog.test.ts`
- `src/domain/node-modifiers/uses.test.ts`
- `web/src/app/nodes/node-views.test.tsx`

```powershell
python -m unittest discover -s scripts -p test_extract_mcoc_node_modifiers.py
python -m unittest discover -s scripts -p test_project_mcoc_node_uses.py
pnpm exec vitest run src/domain/node-modifiers/catalog.test.ts src/domain/node-modifiers/uses.test.ts web/src/app/nodes/node-views.test.tsx --maxWorkers=1
pnpm exec tsc --project temp/node-modifier-review/tsconfig.json --noEmit
node web/node_modules/eslint/bin/eslint.js --config web/eslint.config.mjs src/domain/node-modifiers src/data/game-node-modifiers/index.ts src/data/game-node-modifiers/uses.ts web/src/app/nodes
```

The temporary scoped tsconfig extends the web config but includes only this feature's source/tests and `next-env.d.ts`, disables incremental/plugins and does not run a full web build/typecheck. Extraction reproduced byte-for-byte from the pinned inputs. A no-op diff and a fixture-only curated dry-run wrote only reports. No live database reconciliation was performed.

Real headless Chromium captures cover 1440px desktop, 768px tablet, 390px mobile and 320px narrow mobile, browse/search/empty states, exact detail/parameter expansion and the missing-binding case. Browser flows check same-name IDs, GET search, detail/back navigation, raw precision, missing-binding filtering, HTTP 404 and document horizontal overflow. Preview navigation failed twice with `Preview automation navigate timed out after 15000ms.` before the permitted headless fallback. All owned contexts/tabs are closed. The dev server remains available at `http://localhost:3013/nodes` and `http://localhost:3013/nodes/ava_ea20`.

Review artifacts, browser results, scoped config, capture script and the frameless `preview.html` with absolute image paths live in this checkout's ignored `temp/node-modifier-review/`. No commits, pushes, PRs, schema/package/global-navigation edits, database writes, migrations, login/game sessions or process-memory captures were made.

The follow-up presentation review used T3 Preview successfully, without a headless fallback. Fresh viewport captures at 1280px, 390px and 320px are in `temp/node-modifier-refinement/`, with the capture manifest, verified document widths and a compact `preview.html` defaulting to the usable Gifted page. It includes Disarray's six compact rows, the missing-evidence state and Source data precision. All owned Preview tabs are closed; port 3013 stays available. The updated focused suites pass 12 Vitest tests plus 12 Python tests, with scoped TypeScript and lint passing. Catalog/source-profile/extractor file hashes are unchanged from the first increment.

The location follow-up adds fresh desktop/390px/320px viewport captures under `temp/node-modifier-locations/`. Two current Preview snapshot calls failed with `Preview automation snapshot timed out after 15000ms.` before headless Chromium fallback. Actual captures include multiple quest uses, Disarray, local Gifted placements, event difficulty, and source versus affected fights. There is no document horizontal overflow or browser page error. A self-contained image-embedded `preview.html` defaults to a normal viewport rather than a scaled whole-page image. All owned tabs/contexts are closed; the own dev server remains on 3013.

## Defender portraits, containing hierarchy and native modifier glyphs

The location heading now leads with the captured containing category/collection and verified native membership: for example **Story / Act 4 / Chapter 4**, native chapter **Devastation**, then **4.4.6** with **Culmination** secondary. Event uses lead with **Event quests / DAWN OF DESTRUCTION**, **DARKEST**, recorded **Quest 1** and **Progression rank 4**. No opaque IDs or qid parsing supply display hierarchy. Native labels remain visible even when summary/display indices disagree. Missing/conflicting memberships do not acquire inferred act/chapter numbering. Quest routes remain absent in this independent increment.

Defender groups use one portrait per exact placement/defender key; repeated champions are not collapsed across placements or incompatible effect variants. Quiet names and accessible champion links use only the exact unique public `gameId`. Defaults **Local effect** and **Assigned to defenders** are omitted. Linked/global/attacker exceptions and **Source** versus **Affected fights** remain explicit. Numbers, coordinates, boss IDs and all underlying placement/application identities remain in optional Source data. Recorded assignments do not establish activation after source removal.

### Art feasibility and exact binding

The saved Buff fields `iconTexture` and `glyphIcon` are empty in all 39 definitions. This does **not** mean node effects lack icons. Named `QuestBuffData` native code assigns `buffAppearance` (offset 48). Its stat-modifier branch selects the first exact `Buff.valueStr[0]` component, reads its exact `AppearanceID`, then `BCGStatModifierAppearance.IconTexture` (named protobuf table 2, field 9; native offset 168). The extracted binding is checked against every saved application glyph; mismatches fail instead of changing definition/application/catalog hashes. The native `bcg` branch has `hp`, `attack`, `hpAttack` glyph cases; for these definitions the exporter retains only the saved supported appearance, without inventing missing raw `attr` parameters.

`GameBCGUtils.BuffItemContext(QuestBuffData, tile)` copies the captured glyph into `typeIconString` (offset 40). `PreFightBuffInfoItem.Refresh` assigns it to `_buffTypeLabel` (offset 200), hiding the label if empty. The installed `ui/ui.assetbundle` prefab `assets/ui/popups/prefightbuffinfoitem.prefab` references that label, its `mCustomFont` FontLocalizer, then `UI/Fonts/Marvel-Icons-Font`. The exact serialized references, named metadata/ISIL hashes, bundle hash and font hash are retained in `artwork-profile.json` and optional Source data. `NodeBuffInfoItem` delegates to that renderer.

This renderer uses a **separate** `UIBuffNodeData.GetNodeUISpriteName` background sprite for generic node type/state. That sprite is not exported as modifier art. The broader `GameBuffUtils.GetBuffAppearanceChar` supports direct glyphs and additional resource/saga fallbacks in other contexts; those fallbacks are not applied here. Glossary/effect names are not used to select images. The 39 verified definition/version bindings export **24 distinct native font outlines**; shared symbols are intentionally shared and are not advertised as 39 unique illustrations. Font codes are opaque: U+002D (`-`) is visibly the native dice outline bound by `dice_icon`, not a missing-icon placeholder. Missing glyph/component/appearance, conflicting application glyphs, unsupported direct art or stale projection hashes produce no substitute generic effect icon.

Portraits follow `QuestSummary.bosses[key].blueprint -> BCGBlueprintBase.Character -> BCGCharacterData.Character`. Named `BCGCharacterData.get_TexturePath` uses `_imgID` with `portraits/portrait_` when `_s3ImgID` is false; the exporter reads only that exact local resource path. It does not download CDN art. The selected 41 game IDs have 41 verified cached native PNGs, exported without cropping/repainting as lossless RGBA WebP. Exact public identities come from the saved `C:/Code/CereBro/temp/crystals/champions.json` (SHA-256 `29882a32447201f3d6f64bfe3f81c424340b0489c7bef752dff391b7ba8cffc9`), **not names**: 40 bind existing `/champions/[slug]` routes. Maestro has native portrait evidence but no exact public identity in that snapshot, so its portrait has no champion link. Unknown/NPC identity or unavailable portrait remains a neutral named silhouette, never a name-matched champion.

This is additive modifier-specific artwork evidence, not a whole quest catalog or quest-art projection. No saved Act/Chapter/QuestSummary art fields are used. No sibling imports, live game/process collection, game-server calls, database access or release actions are involved. Original catalog, source profile, use projection and original extraction pipeline bytes remain unchanged. Coverage remains 39 definitions / five saved maps, without comprehensive/current/automatic-refresh claims.

### Reproduce the reviewed artwork export

Requires local Python with UnityPy/Pillow and the repository's installed `opentype.js`; all inputs are offline. Output is deterministic, content-addressed and refuses to overwrite an input or write into installed game resources. `--out`, `--asset-out` and `--work-dir` can point into a temporary review directory for a read-only-source reproduction. The font is intermediate only; the public output contains 24 selected SVG outlines, 41 lossless portraits and one small binding projection, not the complete font or UI bundle.

```powershell
python scripts/extract_mcoc_node_artwork.py --profile src/data/game-node-modifiers/artwork-profile.json --catalog src/data/game-node-modifiers/catalog.json --uses src/data/game-node-modifiers/uses.json --schema C:/Code/CereBro/temp/crystals/schema.json --bcg C:/Users/ossul/AppData/LocalLow/Kabam/Champions/bcg/out/v1/E95E28EECECC04D6A358C8FD8089D01305D0FB73.bin --champions C:/Code/CereBro/temp/crystals/champions.json --bundle 'C:/Games/Marvel Contest of Champions/default/game/Champions_Data/Resources/Data/ui/ui.assetbundle' --static-root 'C:/Games/Marvel Contest of Champions/default/game/Champions_Data/Resources/Data' --out temp/node-modifier-portraits-icons/reproduced-artwork.json --asset-out temp/node-modifier-portraits-icons/reproduced-assets --work-dir temp/node-modifier-portraits-icons/reproduce
```

New suite paths for parent CI registration: `scripts/test_extract_mcoc_node_artwork.py`, `src/domain/node-modifiers/artwork.test.ts`, `web/src/app/nodes/node-hierarchy.test.ts`. The existing view suite now checks six exact Disarray portrait placements, exact champion routes, neutral unknown/NPC fallback without name matching, repeated placements, readable event collection/difficulty, and default-label removal. Artwork tests verify every exported asset hash and fail-closed stale/version behavior. The extraction suite checks exact component/appearance joins, missing-first-component handling, drift, conflicting glyphs, opaque font codes and public identity uniqueness.

Final portrait/icon review: 26 Vitest + 27 Python tests pass (53 total), with scoped TypeScript, feature lint and export-script syntax checks. The final native artwork projection and every SVG/WebP reproduce byte-for-byte from pinned offline inputs. The UI container TOC, exact font container object and font material/texture raw hashes are now pinned as well. Thirteen actual desktop/320px/390px viewport captures under `temp/node-modifier-portraits-icons/` cover Disarray, linked/global sources, event hierarchy, missing evidence, browse and Gifted's verified dice glyph. All PNGs were inspected; browser checks found no horizontal document overflow, broken feature image or page error. Both current Preview snapshot attempts returned `Preview automation snapshot timed out after 15000ms.` before the permitted headless fallback. Owned Preview tabs and headless contexts are closed. Only the own development server was restarted, on 3013. The self-contained `preview.html` defaults to the readable Disarray 390px viewport; `preview-for-render.html` uses absolute image paths. Exact current and cumulative pending file lists, asset filenames, source hashes and suite paths are in `changed-files.json`; commands and limits are in `HANDOFF.md` in that same review directory.


### Resumed mixed-catalog validation

The affected suites pass **50 Vitest tests** across 14 files and **38 Python tests**. Scoped TypeScript passes with `temp/node-explorer-v2-20261109/tsconfig.json`; feature/core lint passes (existing configuration warnings only). No full build/typecheck was started. Original extraction, expanded sources, portrait exports, and all three new icon proof files reproduce byte-for-byte. Thirty pinned files (the three original artifacts plus 27 shared code/SVG files) remain unchanged.

Real anonymous browser checks use the live three-field curated reader, not protected admin fixtures: 120 checks across 1280/390/320px cover mixed origins, search focus/unfocus, native select keyboard focus, Submit/Clear, GET/Back synchronization, pagination identities, empty search, full long curated descriptions, Disarray's six quest groups / six Culmination defenders, linked source separation, event hierarchy, missing components, complete source download and unknown native/curated 404s. There is no document overflow, broken feature image or page error. The later browser pass also records no console errors. Some first-pass focus PNGs were captured during dev repaint; the approved preview uses fresh settled renders. All owned contexts/tabs are closed, and only the own 3013 server remains available.

Preview was used first. The Clear-filter step failed with `Preview automation click timed out after 15000ms. The click may have happened; check the page before retrying. "a[href='/nodes']" still matches an element after the timeout.` and `Preview automation waitFor timed out after 15000ms.` These were quoted before the permitted headless fallback. Current captures, check JSON, read-only count proof, repro reports, exact current/cumulative file lists, seven new CI suite paths and compact self-contained/absolute-image previews are in `temp/node-explorer-v2-20261109/`.

No schema changes were made in this resumed increment. Earlier icon/admin/planner WIP is preserved, including the **unapplied** nullable iconKey migration. Root must sequence that prior migration with its consumers at release; the new public reader itself remains compatible with the existing three-column database. No migration, database write, commit, push, PR, deployment, shared navigation/CI/package edit, live game access or sibling write occurred.
