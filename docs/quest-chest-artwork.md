# Native quest chest artwork

The chest artwork sidecar resolves all 12 exact chest asset tokens authored in the 234 frozen map sources: `object_chest_level01` through `object_chest_level05`, and `object_chest_book2_level01` through `object_chest_book2_level07`. It retains 12 complete original 128 × 128 PNGs, totalling 202,710 bytes. No pixels are generated, cropped, resized or recolored.

`src/data/game-quests/chest-artwork.json` records 879 exact definition joins. These are authored chest dictionary entries, including entries without a placed chest. Placement remains the separate exact `tile.item -> quest.chests[chestId]` join; the presence of artwork does not create a placement or assert chest contents.

The source chain is:

1. Each entry of the frozen map audit identifies a raw source file, its SHA-256, and the exact quest JSON pointer. The exporter verifies the raw file hash and quest identity before reading `quest.chests`.
2. The saved native `QuestChestEntity.LoadChestSprite(System.String assetName)` implementation concatenates literal `chests/` with `assetName`, then calls `TexturePoolManager.LoadTexture`. Thus `object_chest_level03` binds exactly to `chests/object_chest_level03`.
3. The existing exact native pack resolver follows `packs.txt` and the pack TOC, using the source-proved `PackDriver.Exists` rules: exact path, extension ignored, case ignored. All 12 keys have a unique loose PNG in the installed static `ui_fightlanding_quest` pack. These are direct map sprites, so no Unity mesh composition is required.
4. The complete original PNG bytes are copied to `web/public/game-quests/chest-art/{sha256}.png`. The manifest pins their byte hashes, decoded RGBA hashes, dimensions, lengths, pack manifest/TOC hashes, and all quest definition pointers. Native loader and pack resolver source hashes are also pinned.

The expanded audit's sorted `sources` list is pinned independently of other audit fields. Adding feature counts or explanatory fields to that audit does not change this art source set. The builder pins all 234 original source entries and fails on source drift. The original 211-map audit remains immutable; the expanded ledger adds the 23 previously omitted public progressed quests.

`getQuestChestArtwork(asset: string | null)` in `src/data/game-quests/chest-artwork.ts` returns `{ asset, imageUrl, sha256, width, height } | undefined`. Lookup is case-sensitive and accepts only the exact native token. Null, chest dictionary keys such as `chests03`, unknown tokens, and inherited object keys remain unresolved so callers can show their neutral chest icon. The manifest has no unresolved tokens in this frozen source set. Keep the full provenance manifest in server code and send only the resolved artwork metadata needed by the board.

Reproduce and verify from the already saved local inputs:

```powershell
python scripts/game-quests/build_chest_artwork.py
python scripts/game-quests/build_chest_artwork.py --check
python scripts/game-quests/test_build_chest_artwork.py
pnpm exec vitest run src/tests/game-quests/chest-artwork.test.ts
```

The defaults read `temp/quest-map-features-20261118/expanded-source-audit.json`, saved native analysis under `D:/CodexArtifacts/Cpp2IL-2026-11-03/IsilDump`, and installed static resources under `C:/Games/Marvel Contest of Champions/default/game/Champions_Data/Resources/Data`. Path overrides are available through `--audit`, `--native-root` and `--resources`. Verification rederives the entire manifest and compares original PNG bytes without writing files. The exporter has no network, game, process, account, session or database acquisition step.
