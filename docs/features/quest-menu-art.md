# Verified native quest menu artwork

Current status: **68 native menu-art files, zero unresolved artwork keys, and verified art for all 211 public permanent variants**. The seven legacy local keys are now resolved through `packs.txt` -> the exact `ui_fightlanding_quest/toc.txt` **files[]** members. Chapter panels preserve adjoining native geometry. See [permanent-quest-explorer.md](permanent-quest-explorer.md) for the current supplement, public classification and new maps. The original art capture and original map/terrain bytes remain unchanged. The initial supplement described below had 61 assets and 243/274 archive bindings; those historical counts are superseded.

The menu-art manifest is `src/data/game-quests/menu-art.json`. It pins capture, catalog, binary, named-layout, reader, exporter, retained-source ledger and asset hashes. Each reference preserves owner kind/container/ID, exact field and capture JSON pointer. Each frozen quest binds its original source hash, map/container identity and correlated parent membership. The pure reader rejects drift; source role is retained independently of the image bytes.

## Authorized supplement and exact asset chain

`capture_source_art.py` reuses the proven external read-only managed-definition reader after validating its exact bytes, named metadata binaries and installed GameAssembly SHA-256 `01f46bb2e36c2160a8df939bbb080bcf2ee89ca15427692a10334efc90fd4abb`. It resolves each allowlisted field by unique metadata name/type/offset, rather than assuming new art offsets. The existing hash-pinned QuestsManager bootstrap also checks class names. It opens only a read handle, calls no game methods, and closes the handle in `finally`.

The capture retained only public definition identity/hierarchy, Act `image/imageSmall/imageLarge`, Chapter `image`, QuestSummary `actImage/bgImage/bgImageUsesCDN/rewardImage`, containing CDN/panel fields and resolved labels. It excludes maps, rewards, opponents, account/profile identity, progression, inventory, owned teams, session data, process IDs and addresses. The user manually opened normal quest selection; the reader did not launch or control the client. Actual bounded reads: **13,346 calls / 170,216 bytes**, below 50,000 calls / 16 MiB limits.

The ignored raw source is `temp/quest-explorer-review/authored-art/source-art-20261109.json`, SHA-256 **`b7321edd7d6544a29c40fe62a54f759b81b0d211dee8c1206946e7b38e4d173d`**. It contains 9 PvE sets, 19 named Acts, 56 named Chapters and 271 summaries. Native resolved image values are retained; original wire localization/CDN booleans absent from native objects are not reconstructed. Their parser/consumer behavior is established by the named static evidence below.

The deterministic exporter follows only exact resolved HTTPS URLs on `kabam-marvel.shared.mcoc-cdn.net/quests/`. `EB.Cache.GetCacheFileNoCdn` establishes the SHA-1 of URI path plus extension cache rule. Twenty exact keys already existed in that cache; 41 exact public image URLs were fetched without credentials, query parameters or redirects into this worktree's ignored research directory. Nothing was written to the game's cache. No CDN paths were guessed, enumerated or selected by visual/name similarity. All source bytes are now retained with an immutable hash ledger for offline reproduction. Actual image format, byte size and dimensions are validated; some CDN JPEG responses incorrectly label their MIME type `multipart/form-data`, so verified image bytes determine format.

The initial supplement exported **61 unique native-size, lossless WebP assets**, 11,306,868 bytes, under `web/public/game-quests/menu-art/`. Their filenames are exported content SHA-256. Pillow version and encoding options are recorded. The application imports the manifest on the server and sends selected image URLs; it adds no all-map, raw capture or provenance JSON client payload. Maps continue to use the independently verified terrain material/texture chain.

## Binding coverage, roles and quiet fallbacks

- All 268 shared identities agree on exact qid/map/container/summary-set/category/difficulty/explicit indices and correlated Act/Chapter membership. The three newly resident definitions are excluded from the frozen catalog. Six previously captured Daily variants were not resident; their art remains unbound.
- Resolved ordinary `image` fields: 15 Acts and 51 Chapters. Act `imageSmall/imageLarge` are explicitly empty on all 19 named Acts; no size role is substituted. There are two empty ordinary owner images.
- Quest detail selection is exact Chapter `image`, then exact Act `image`, then the quest's own exact `actImage`. All parent choices require verified membership and the original catalog source hash. Forty-two event variants lack captured parent membership but have their own authored act-image field; that direct field invents no parent.
- Initially, seven local native keys were unresolved: `quests/a1`, `quests/a2`, `quests/a3`, `quests/story_a1c1`, `quests/story_a2c1`, `quests/story_a3c1`, `quests/story_a3c2`. They cover the 24 frozen Story quests in Acts 1–3. The initial bundle-only investigation found no binding. The permanent supplement now resolves all seven through the exact loose-pack files branch and replaces those former terrain fallbacks with native art. One tutorial definition has empty art. The old 31/274 unsupported count is historical: now only the empty tutorial and six absent Daily variants lack art in the archive; none are in public scope.
- `bgImage` remains its own role: 220 empty, 48 exact generic autoscale placeholders among the 268 bound variants. All 268 bound `rewardImage` values are empty. Neither becomes a poster. Missing/null, empty, default, authored, unresolved-resource and unavailable states remain distinct.

The local-resource loader seam is named: `TexturePoolManager.LoadTexture` → `EB.AssetManager.LoadTexture2D` → `TextureLoadCommand.LoadTexture` → `EB.FileSystem.Manager.GetUrlIfNotExists` / `Find`. HTTP/file paths pass through; the seven legacy keys require the exact mounted local filesystem mapping. The later exact pack/TOC files join establishes that mapping, with all source hashes retained in menu-art v2.

## Reproduce the supplement and review

The capture command below is an opt-in source operation after explicit user readiness, not part of export, CI or the application. It refuses overwrite and unsupported binary/metadata versions. Routine reproduction is offline from the retained source and asset ledger:

```powershell
python -X utf8 scripts/game-quests/capture_source_art.py --support-root C:/Code/CereBro/temp/quest-data-investigation/game-only --out temp/quest-explorer-review/authored-art/source-art-20261109.json
python -X utf8 scripts/game-quests/build_source_art.py --capture temp/quest-explorer-review/authored-art/source-art-20261109.json --image-cache C:/Users/ossul/AppData/LocalLow/Kabam/Champions/asset_cache/files --fetched temp/quest-explorer-review/authored-art/fetched --resources 'C:/Games/Marvel Contest of Champions/default/game/Champions_Data/Resources/Data'
python -m unittest discover -s scripts/game-quests -p 'test_*art*.py'
pnpm exec vitest run --config scripts/game-quests/vitest.config.mts
pnpm exec tsc -p scripts/game-quests/tsconfig.json --noEmit
pnpm --dir web exec eslint src/app/quests src/components/game-quests src/lib/game-quests 'src/app/champions/[slug]/champion-details-client.tsx'
```

Use separate `--output` and `--assets` directories to byte-compare the manifest and every asset. `--fetch-missing` is optional and permits only an exact captured URL; it is unnecessary with the retained ledger. Source captures remain ignored; only the allowlisted public projection/assets enter the repository.

The fresh real application review is under `temp/quest-explorer-review/authored-art/review/`: 23 desktop/tablet/320–390px viewport PNGs, image/overflow metrics and browser interaction checks. Preview was used first. The same catalog image-readiness step then failed twice with `Preview automation evaluate timed out after 15000ms.` Both errors were quoted before headless fallback. Owned Preview tabs and headless contexts are closed; only the existing own-port3011 server remains. The compact parent selector and exact file/check manifests are one directory above.

New suites for parent CI registration: `src/tests/game-quests/menu-art.test.ts`, `scripts/game-quests/test_capture_source_art.py`, `scripts/game-quests/test_source_art_projection.py`. The capture metadata test needs the pinned local evidence; it never opens a process. Shared CI is unchanged.

## Historical offline audit and native UI evidence

Before the authorized supplement, `audit_menu_art.py` proved the omitted-field gap in the accepted November 5 definitions. Its unchanged compact pin is `quest-menu-art-evidence.json`; the complete historical inventory/contact sheets are under `temp/quest-explorer-review/menu-art/final/`. Those unbound candidates were never production bindings. The following native parsing/consumer evidence explains why the supplement captures distinct image roles.

## What the native browse UI actually binds

The saved named client code distinguishes parent artwork, quest-specific art, opponent previews and generic UI decoration:

| Owner / role | Exact native source and selection | Saved evidence gap |
| --- | --- | --- |
| Act / event panel art | `QuestSet.AddQuestSummarys` parses each Act's `image`, `imageSmall`, `imageLarge` through `Dot.Image`, with `cdnImage`, `cdnImageSmall`, `cdnImageLarge` flags and the containing `QuestSet.cdn`. Named Act offsets are 56/64/72. `QuestSelectPanelBase.Refresh` loads the selected Act's `image` (+56); its loader assigns `UITextureRef.baseTexturePath`. | All five image/border fields omitted on all 20 named Acts. The containing CDN field was also omitted on all 10 PvE sets. Image size roles must not be assumed interchangeable; this audit proves parsing of all three and the ordinary panel's use of `image`, not every consumer of the size variants. |
| Event parent selection | `StoryEventPanel.get_actData` selects `QuestSet.Acts[1]` after a bounds check. This is native collection membership, not a quest-ID suffix. | Art values on that exact parent were not retained. |
| Chapter art | `AddQuestSummarys` reads localized `image` into `Chapter.image` (+40), with an explicit `cdnImage` flag controlling CDN prefixing. `ChapterPanel.RefreshDisplay` passes that chapter's +40 field into its texture loader. | `image` omitted on all 59 named Chapters. |
| Quest art | `QuestSummary` constructor parses `actImage` via `Dot.Image` / `cdnActImage`; separately reads `bgImage` and applies `QuestsConfig.CDN` when `cdnBGImage` is true; parses `rewardImage` / `cdnRewardImage` separately. | These resolved art fields are absent on all 274 latest summaries, including the 47 expansion detail captures. Their actual use must remain role-specific; a reward image is not automatically a quest card. |
| Opponent preview on individual quest tiles | `SelectQuestTile.RefreshBossPortraits` calls `GetFinalBoss`, checks hidden-final-tile state and multiple-final-boss handling, then calls `GetBlueprintImageAssetPath`. Ordinary tiles request `TexturePath`; `AutoScalingQuestTile` requests `GachaFeatureTexturePath`. No texture results switches to the placeholder rendering branch. | This is **opponent preview**, not an authored quest poster or a placed-encounter join. Hidden/alternative preview branches need their own source state. This audit does not turn summary boss-table rows into encounters or substitute arbitrary playable champion artwork. |
| Parent panel borders | Act `borderImageLocked` and `borderImageUnlocked` are parsed separately. Native selection uses unlock state. | Art values omitted; no account lock state is inferred. |

`Dot.Image` does not simply use a filename: it resolves the localized field, tests the supplied CDN flag (or its `s3`-prefixed default flag), combines with the supplied CDN base when enabled, and can invoke its configured image processor. A missing field uses the caller's default. The resolved key, locale, CDN base/flag and processor result therefore belong in a verified art binding.

## Defaults and fallbacks are separate

Seven exact installed UI prefabs were examined through their named MonoBehaviour classes and PPtr identities. The Story/Event/AutoScaling/Consolidated parent panels serialize an empty `UITextureRef._baseTexturePath` and no texture object; their authored poster is supplied by the data above. They are not carrying embedded per-quest banners.

`SelectQuestTile` and `ChapterPanel` use the shared `ChapterContentBackgroundGradient` sprite; other panel backers use `CommonSquare`, `CommonTraySmlGlow` and similar UI decoration. Their exact chain is `UISprite._legacySpriteName` + `mAtlas` -> `UnityAtlasWrapper` -> local material and external `_unityAtlas` PPtr. External file 4 / path ID `7355715405354601724` resolves to SpriteAtlas `CAB-ecbc2ee02c94876f48b09b05008a42f2` in the explicitly declared `main_odr/main_atlas_procedural.assetbundle` dependency. Four shared backers are exported through exact packed Sprite membership, render-data key, texture ID and texture rectangle; the chapter gradient is Sprite `-1070446020311254045`, 8x256 pixels. The audit retains bundle/manifest hashes, container/object IDs, external-file table, material, packed atlas/texture identities and rectangle/packing data. These are UI decorations, not quest-specific illustrations.

The autoscaling tile's `_bossBackgroundImage` points to the literal path `Art/UI/Images/autoscale_quest_tile_champ_bg_placeholder`; the installed UI bundle also contains the named 256x256 texture exported as `native-menu-placeholder.png`. It is blurry terrain, not a richer poster. The legacy-path-to-container alias is recorded as a seam; this export does not certify every loader alias.

`UITextureRef.get_potentialPaths` has conditional HD/SD/base ordering, an HTTP/configuration bypass and an optional configured missing-image path. Its static default missing image is `Bundles/UITextures/Misc/MISSING`. `RefreshTexture` separately handles empty paths by releasing the prior texture (with an editor-only path branch). These are loader fallbacks, not an instruction to substitute map terrain for missing quest posters. Relevant branches and their instruction numbers are retained in the evidence; not all configuration-flag names/overrides were reconstructed.

## Historical inventory before the supplement

- Accepted capture audit: 274 latest quest summaries, 20 named Acts, 59 named Chapters, 10 containing PvE sets. Required art fields are **omitted**, not captured as empty or null. The 47 expansion captures were also checked. Source SHA-256 and exact JSON pointers accompany every observation.
- Installed static index: 799 `toc.txt` manifests hashed; 377 references match quest/chapter/story/event/banner/poster terms. These are discovery candidates, mostly UI prefabs, shared graphics and board assets. Similar names establish no definition binding.
- Retained BCG: all present root tags match the named `BCGDataBuffer` schema (25 present tags, zero unknown root tags). It has character/blueprint image fields, but no quest/act/chapter definition registry. Character images are separate from parent browse artwork. This is a scoped schema finding, not a claim about every string in every BCG record.
- Existing cache: 1,041 image files inventoried with dimensions and hashes. 210 are wide image candidates; 146 additional large square/tall images are included. Contact sheets cover all 356. A compact sheet shows eight 600x200 banner candidates; another shows nine 512x1024 poster candidates. These sets were selected by dimensions, not claimed quest identity. They include other modes, store/crystal art, scenery and promotional art.
- **At that audit stage: 0/274 quest bindings.** The subsequent authorized supplement and current coverage are described above. Cache presence, visual resemblance and a plausible filename never establish a mapping or current availability.
- The earlier terrain binding remains independently valid: 274 exact themes / 22 theme prefabs / 10 native textures. Terrain is suitable behind maps; it does not become authored menu artwork because it appears on a catalog card.

`EB.Cache.GetCacheFileNoCdn` derives the cache filename from SHA-1 of the URI path plus extension. This is a forward lookup once the exact public art path is known, not a reverse quest index. The audit does not guess or brute-force URL names. No network download is needed to inspect the already cached bytes.

## Exact unresolved seams and node-track contract

The historical audit identified **already-resolved public art strings** as the smallest missing input. The authorized supplement supplies those strings and exact owner identities. The seven legacy local resource keys have since been resolved through the loose-pack files branch. Placeholder aliases and configuration overrides remain separate seams. Resolving shared atlas backers does not turn them into authored posters.

Any future art projection should carry `ownerKind`, exact owner ID, source SHA/JSON pointer/field, raw and resolved key, locale, CDN flag/base/processor, asset bundle/container key or exact URI path, object/material/texture/atlas IDs and hashes, role, and an explicit fallback flag/scope. Parent art can propagate only through verified correlated membership and should remain labeled parent art. Missing, empty, default and authored values must stay distinct. Snapshot/source drift must invalidate the binding.

For node Where it appears labels, the existing contract is unchanged: retain exact containing category/collection and correlated Act/Chapter membership, preserve native labels, and use explicit captured indices for numbering. Public permanence is an explicit exact-set decision, independent of native category: permanent Mausoleum retains its native `StoryEvent` value, while Road/Realm retain `Event`. Exact containing-set difficulty text takes priority, then recorded PRG min/max. No qid suffix parsing, guessed playable NPC portrait or cross-feature runtime import is permitted. The source-hash-bound effect/application/placement contract remains in `quest-explorer.md`. The label/art contract was shared read-only with the node track; no sibling file was edited.

## Reproduce the historical offline audit

```powershell
python -X utf8 scripts/game-quests/audit_menu_art.py --source-root C:/Code/CereBro/temp/quest-data-investigation/game-only --isil-root D:/CodexArtifacts/Cpp2IL-2026-11-03/IsilDump --resources 'C:/Games/Marvel Contest of Champions/default/game/Champions_Data/Resources/Data' --image-cache C:/Users/ossul/AppData/LocalLow/Kabam/Champions/asset_cache/files --schema C:/Code/CereBro/temp/crystals/schema.json --output temp/quest-explorer-review/menu-art/final
python scripts/game-quests/test_menu_art_audit.py
pnpm exec vitest run --config scripts/game-quests/vitest.config.mts
pnpm exec tsc -p scripts/game-quests/tsconfig.json --noEmit
pnpm --dir web exec eslint src/app/quests src/components/game-quests src/lib/game-quests 'src/app/champions/[slug]/champion-details-client.tsx'
```

Use a separate `--output` directory for deterministic byte comparison. No default publication/export into `web/public` exists. The audit refuses its negative finding if any expected omitted art field appears in a changed input; even an explicitly captured empty/null value invalidates that premise. It also rejects ambiguous named-method overloads. New optional CI suite: `scripts/game-quests/test_menu_art_audit.py` (three checks); shared CI is untouched.

This historical audit alone did not justify web integration. The current integration is supported by the subsequent exact source capture, not these candidate sheets. No synthetic quest artwork, sibling runtime dependency, account/progression export, database change or release action is introduced.
