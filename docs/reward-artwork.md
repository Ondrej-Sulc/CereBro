# Reward artwork sidecar

`src/data/game-reward-artwork/manifest.json` is a separate, source-bound game artwork manifest. It does not modify the all-opening catalog or its history fingerprint. The server reader exports `getRewardArtwork(type, data, role?)`; the default role is `fragment` for `gf`/`ebpf`, otherwise `full`. Unknown or unresolved artwork returns `null`; `getRewardArtworkStatus` distinguishes recorded missing artwork from an unrecorded identity.

The extracted catalog covers 1,522 distinct non-hero reward identities found in direct possible-prize categories and conditional bonuses, plus 70 exact collection-piece inventory items used by champion acquisition pages. It resolves 1,397 of 1,592 bindings: 1,012 inventory items, all 114 upgrade materials, all 76 material-fragment identities, all 61 crystal-token identities, all 17 crystal-shard identities, six currency resources and all 111 selectable-reward identities. Before the selector extension, the manifest referenced 631 reward WebPs and 51 existing crystal images reused across 62 bindings: 682 publicly verified immutable objects. The selector extension uses 22 reward WebPs, including three already published objects, bringing the total to 701 publicly verified immutable objects.

## Exact lookup rules

| Reward | Verified game definition / renderer | Artwork source |
| --- | --- | --- |
| `inv` | GameStore exact `Name`; `InventoryRedeemerMapping`; reviewed neutral champion consumables use `GameStoreUtils.AdjustColourForItem` | English `image`, `ImageS3`, exact class tags, BCG class definition and overlay shader |
| `ebp` | Exact BCG `EvoBlueprint`; `BCGEvoBlueprintBase.TexturePath` | CDN `_imgID` when `_s3ImgID`, otherwise `portraits/` + `_imgID` |
| `ebpf` | `GameBCGUtils.GetCatalystFragmentImageAssetPath` | Same texture path plus the exact renderer suffix `_fragment` |
| `gs` | `GachaSpinRedeemerMapping` → `GachaManager.GetTokenTexture` | Match reward `Data` to box `Token`, then `_tokenImage` / `TokenImageOnCDN` |
| `gf` | `GachaFragmentRedeemerMapping` → `GachaManager.GetFragmentTexture` | Same exact token join, then `_fragmentImage` / `FragmentImageOnCDN` |
| `res` | Explicit default texture branches in `ResourceRedeemerMapping.GetTexture` | Game resource paths for `sc`, `hc`, `ap`, `ave`, `der`, `xp`, `pvp-cur` |

Multiple registry matches must agree on source/reference before an image is bound. No names, families, ID prefixes or presumed aliases establish artwork identity. For example, `ascension_token_class_science` has no exact GameStore definition and remains missing; it is not silently aliased to `ascension_token_class_chemical`.

An existing hosted crystal image can be reused only when its exact source/reference matches the verified reward-art reference and the existing manifest's content hash agrees. The publication step checks its public bytes before creating any new reward objects. A crystal's full image is never substituted for missing shard art.

## Pixels and tint

New images are decoded from exact cached game images, shipped resource PNGs or exact public game-CDN references and re-encoded as transparent, lossless WebP. Original input SHA-256, final WebP SHA-256 and dimensions are recorded. No generated or substitute icons are used.

All 190 material/full-fragment bindings now include the game's tint in their published pixels (`tintApplied=true`). `BlueprintTile.InitFromData`, `LoadTexture` and `RefreshPortraitProperties` apply `GameBCGUtils.GetEvoBlueprintColor` through `UIWidget.color`. The reviewed `BlueprintType` flags use `BCGEvoBlueprintBase.TintColor` for blueprint/evolve/events/relic/relic_enhance/relic_blueprint: explicit `_tintColor`, otherwise `ColorDictionary.Get("class_" + class)`. Other reviewed enhancement kinds use `class_iso_generic`. Unreviewed kinds or absent palette keys stop generation instead of guessing a color.

`palette.json` records the native `UI/ColorDictionary` asset: 156 colors, including 28 class-related keys. The extractor identifies the unique named MonoBehaviour in `resources.assets`, validates the reviewed metadata hash, reads the complete serialized rarity/color arrays and rejects truncated, duplicate, out-of-range or trailing fields. File, object, metadata and palette hashes preserve provenance. The published manifest records the exact tint key/source/RGBA; source texture hashes still describe the original input pixels. The lossless export multiplies texture channels by the game tint, retaining texture detail and transparency, so consumers need no CSS filters. Full materials and fragments retain separate game images and output objects.

The shared reader validates dictionary-derived tints against the frozen palette and exports `rewardClassColors` and `rewardColorPaletteSource` for future reward views. `src/domain/reward-display.ts` supplies shared type labels and display names; the exact `res:sc` resource is presented as Gold while unknown identities retain their source labels. These presentation helpers do not modify opening evidence or probability rows.

### Class awakening gems and signature stones

The previous inventory extractor copied only `image`/`ImageS3`. Thus exact
`inv:awaken_t6_mutant`, `inv:awaken_t6_trained`, `inv:awaken_t6_chemical`, etc.
all published the neutral `inventory/Awaken` texture; `inv:sigup_t6_*` and
`inv:sigupfive_t6_*` similarly shared neutral `inventory/SkillUp`. The
`6star_max_sig_crystal` reward category (crystal route
`/crystals/6_star_max_sig_crystal`) reproduces the reported grey artwork.

Verified renderer chain in the reviewed local game build:

1. `QuestItemEntityUI.SetTextureColourTint` and
   `FeaturedDisplayWidget.SetTextureColorTint` call
   `GameStoreUtils.AdjustColourForItem` for inventory rewards.
2. `GetColourAndMaterialForItem` calls `GetTextureColor`; this resolves
   `GetClassFromTags`, then `BCGHeroClass.DefaultColour`. `GetClassFromTags`
   scans `HTags + "," + Name`, trims and lowercases each comma group, splits
   on colons, and uses the first exact non-none class token found by
   `BCGManager.GetClassFromString`. It does **not** infer class from English
   titles or underscore-separated item-name suffixes. `trained` is Skill;
   `chemical` is Science. The BCG class registry is field 9, decoded with the
   named `BCGHeroClass` contract. All seven captured class definitions have
   empty `_defaultColour`, so their default comes from
   `GameBCGUtils.GetHeroClassColor` → `ColorDictionary["class_" + classId]`.
   A future explicit BCG class colour stops extraction for review. The separate
   `class_consumable_*` palette is used for quantity text, not this texture.
3. A class colour selects `EBG/UI/OverlayColored`; no class resolves to white
   with `EBG/UI/BlendColored`. The compiled overlay pixel shader was extracted
   read-only from `resources.assets`, path ID **506**, decompressed with
   UnityPy and disassembled with Windows `D3DDisassemble`. For each normalized
   source RGB channel `s` and class colour `c`, its operation is
   `2*s*c` below 0.5, otherwise `1 - 2*(1-s)*(1-c)`; alpha is multiplied
   independently. Bright facets remain bright. This is a shader reproduction,
   not a CSS filter, guessed colour, or a multiply-only recolour.

The extractor reviews only the neutral champion-consumable paths
`inventory/Awaken` and `inventory/SkillUp`, with `UseOnHero` and `SigState`
`d`/`a`. Other inventory paths retain their existing behavior. Class identity,
palette RGBA, `blendMode: "overlay"`, and `source.inventoryShader` preserve
the rendering evidence. The shader object SHA-256 is
`60d753e9a57e49ea3c53f436c9061571fc1ac90ffc8e69c83af1f4afd3e22d5e`;
its containing file SHA-256 is
`60c2e827f714249169b9b759f0dd18b8c509d265cc9df32fc6d1f0f6c6a9c669`,
the same file as the frozen palette. Extraction rejects shader drift; shared
manifest validation rejects missing/mismatched shader provenance, unrelated
inventory references, class/palette mismatches, and overlay mode on materials.
Duplicate exact GameStore records must agree on rendering as well as texture.

The correction changes **132 inventory bindings**: six classes at 2–7 stars
for gems and ordinary stones, 3–7 stars for +5 stones, and 2–6 stars for +2
stones. Quantity and tier do not alter these two base textures; the game's
separate rarity/quantity UI is not baked into the icon. Generic controls remain
byte-identical, including ordinary and +5 stones. Existing ISO, catalysts,
fragments, selector and collection artwork remain unchanged.

Publication on 2026-11-06 validated the local delta with the standard publisher
before uploading **12** unique lossless WebPs to
`champion-images/rewards/full/{sha256}.webp`, using the existing create-only
generation precondition. Every public object was downloaded and checked for
SHA-256, WebP format and dimensions before merging the 132 bindings into the
validated full manifest. Coverage remains 1,397/1,592; the manifest now references
713 unique immutable URLs. No existing objects were overwritten/deleted. Local
review artifacts are under ignored `temp/reward-artwork/`: the regenerated
`local-inventory-colored.json`, `inventory-delta.json`,
`published-inventory-delta.json`, and `inventory-colored-contact-sheet.png`.
For incremental publication, preserve the full manifest's unrelated selector
and collection bindings; publish the changed binding delta to a temporary
output, validate its source hashes against the full manifest, then merge by
exact type/data/role after public verification.

Validation: the regression first failed because class and generic URLs were
identical, then passed for all recorded tiers and both stone quantities.
Focused Python extraction/palette/collection/selector tests (14 tests), the
reward-domain/reader/publisher/GCS Vitest suites (18 tests), and the focused
TypeScript `tsc --noEmit` configuration passed. The contact sheet was visually
reviewed, as was the local Max Signature Ability Crystal page: all 22 reward
images loaded through Next Image, class variants used the new URLs, generic
controls stayed grey, and the review tab was closed. A screenshot is retained
locally as `temp/reward-artwork/inventory-ui-reviewed.png`. Existing missing
artwork remains missing; no full application deployment is required for asset
publication, but consumers must use the updated manifest.

Unsupported registries, including relics, cosmetics and champion blueprints, remain explicitly missing. Selectable-reward objects now use their exact game definition registry; see [selectable-rewards.md](selectable-rewards.md) for capture, provenance and publication. Hero portraits are handled by the existing champion image pipeline. One `ave` currency resource is absent from the captured resource files; one old event resource has no reviewed static texture branch. These cases retain their source IDs and reasons.

## Provenance and publication

Manifest provenance includes the opening gacha SHA-256, unchanged normalized opening-catalog SHA-256, exact BCG/GameStore binary hashes, reviewed Marvel/Fuse metadata hashes, current game metadata hash (which verifies the public CDN base) and reused crystal-manifest hash. It contains no local paths, credentials, account data or raw binaries.

New objects use `rewards/{full|fragment}/{sha256}.webp` in the existing champion-image bucket. `uploadImmutableBuffer` uses a create-only generation precondition; an existing object is accepted only if its bytes agree. Before publication, every local file must match its hash, actual WebP format and dimensions. Each uploaded object is read through its public URL and checked again. The public manifest is written only after all objects pass.

Reproduce with `scripts/extract_mcoc_reward_artwork.py`, supplying the captured gacha/BCG/GameStore binaries, reviewed named schema, shipped Resources/Data directory, asset-cache directory, game metadata and existing crystal manifest. Local output stays under ignored `temp/reward-artwork/`.

```powershell
python scripts/extract_mcoc_reward_palette.py `
  --resources "$gameInstall/Champions_Data/resources.assets" `
  --metadata "$reviewedMetadata/Marvel.Runtime.dll" `
  --out src/data/game-reward-artwork/palette.json

python scripts/extract_mcoc_reward_artwork.py `
  --catalog src/data/game-crystal-openings/catalog.json `
  --acquisition-catalog src/data/champion-acquisition/catalog.json `
  --gacha temp/quest-data-investigation/game-only/sources/gacha-A29758BCA3552F42481F416859DD53E4BE131265.bin `
  --bcg temp/quest-data-investigation/game-only/sources/bcg-E95E28EECECC04D6A358C8FD8089D01305D0FB73.bin `
  --gamestore temp/crystal-openings/gamestore-5AFEBC8CC99BE2C1546DB91EF7B1F6360DFD7154.bin `
  --schema temp/crystals/schema.json `
  --palette src/data/game-reward-artwork/palette.json `
  --resources "$gameInstall/Champions_Data/Resources/Data" `
  --cache "$gameCache/asset_cache/files" `
  --game-metadata "$gameInstall/Champions_Data/il2cpp_data/Metadata/global-metadata.dat" `
  --crystal-artwork src/data/game-crystals/artwork.json `
  --manifest temp/reward-artwork/local-colored.json `
  --assets temp/reward-artwork/assets `
  --download-cache temp/reward-artwork/downloads --download-missing

pnpm exec tsx src/scripts/publish-mcoc-reward-artwork.ts --manifest=temp/reward-artwork/local-colored.json
# Validates all local assets and prints the immutable publication plan.

pnpm exec tsx src/scripts/publish-mcoc-reward-artwork.ts --manifest=temp/reward-artwork/local-colored.json --upload-assets
# Publishes and publicly verifies new objects; reuses verified crystal URLs.
```

Set the example's task-specific `$gameInstall`, `$gameCache` and `$reviewedMetadata` variables to the local game and reviewed Cpp2IL metadata directories. The publisher verifies raw gacha, normalized opening-catalog and palette file hashes, palette bindings and every local image before any upload.

### Collection artwork

For an incremental collection addition, `extract_mcoc_collection_artwork.py`
reuses the validated local reward manifest and exact GameStore decoder. It
resolves only the explicitly requested piece IDs, preserving all existing
bindings. A registry/hash mismatch, unknown metadata field or unresolved exact
item prevents export. Images remain transparent lossless WebP, using the same
reward object paths and publication checks as all other inventory rewards.

```powershell
python scripts/extract_mcoc_collection_artwork.py `
  --catalog src/data/champion-acquisition/catalog.json `
  --gamestore temp/crystal-openings/gamestore-5AFEBC8CC99BE2C1546DB91EF7B1F6360DFD7154.bin `
  --schema temp/crystals/schema.json `
  --base-manifest temp/reward-artwork/local-colored.json `
  --assets temp/reward-artwork/assets `
  --download-cache temp/reward-artwork/downloads `
  --manifest temp/reward-artwork/local-collections.json

pnpm exec tsx src/scripts/publish-mcoc-reward-artwork.ts --manifest=temp/reward-artwork/local-collections.json
pnpm exec tsx src/scripts/publish-mcoc-reward-artwork.ts --manifest=temp/reward-artwork/local-collections.json --upload-assets

python scripts/extract_mcoc_collection_artwork.py `
  --catalog src/data/champion-acquisition/catalog.json `
  --published-manifest src/data/game-reward-artwork/manifest.json `
  --projection src/data/champion-acquisition/piece-artwork.json
```

The last command generates the small champion-page projection after publication.
It rejects missing assets, unrelated URLs and piece evidence from a different
GameStore snapshot. Adding an acquisition piece never adds it to crystal drops.

Checks: `python -m unittest discover -s scripts -p test_extract_mcoc_reward_artwork.py`; `python -m unittest discover -s scripts -p test_extract_mcoc_collection_artwork.py`; `python -m unittest discover -s scripts -p test_reward_palette.py`; `pnpm exec vitest run src/domain/reward-artwork.test.ts src/domain/reward-display.test.ts src/services/rewardArtworkService.test.ts src/data/game-reward-artwork/index.test.ts`. No database, application deployment or base opening-catalog changes are part of this pipeline.
