# Native champion stat icons

The 11 stat icons are original vector outlines from the game's `Marvel-Icons-Font`. The supplied screenshots are visual references; they were not cropped, traced, or used to guess glyphs. These exports use the same verified font bytes as the native synergy icons.

`HeroAttributesPanel` creates its detail rows with native stat IDs, then assigns each row through `StatFocusUtils.GetIconForStat(statId)` and `GetColorForStat(statId)`. Those methods read `StatFocusTuning.IconTexture` and `AttributeColor` (native object offsets 56 and 64). The source tuning records are protobuf top-level field 24; child field 5 is the exact glyph string, child field 6 is its hex color. Some attack/defense contexts have empty presentation fields. The extractor requires exactly one nonempty presentation record per requested stat; it never guesses a fallback from a stat's English name.

The serialized font binding is:

`HeroAttributesPanel._attributeStatItemPrefab → HeroAttributeStatItem._statIcon → UILabel.mCustomFont → FontLocalizer._defaultFontPath = UI/Fonts/Marvel-Icons-Font`.

`health` and `attack` also have explicit tuning entries with `H` and `W`. These produce the heart with a cross and crossed swords. They are separate from the regeneration pulse glyph. The source manifest records every prefab object path ID, input hash, record hash, codepoint, glyph index, and SVG hash.

| CereBro key | Native stat ID | Glyph | Native color |
| --- | --- | --- | --- |
| criticalRating | crit_rating | U+0050 | #a99024 |
| criticalDamageRating | crit_damage | U+0044 | #a99024 |
| armorPenetration | armor_pen | U+E460 | #872d13 |
| blockPenetration | block_pen | U+E690 | #712986 |
| criticalResistance | crit_hit_resist | U+0071 | #a99024 |
| armorRating | armor | U+0061 | #117986 |
| blockProficiency | block_proficiency | U+0042 | #115526 |
| physicalResistance | resist_physical | U+0075 | #11772f |
| energyResistance | resist_magic | U+0074 | #724986 |
| health | health | U+0048 | #11772f |
| attack | attack | U+0057 | #82542b |

The small client contract is [src/data/stat-icons.json](../src/data/stat-icons.json): `{ schemaVersion: 1, icons: { [statKey]: { src, color } } }`. Full diagnostics remain in [stat-icons-source.json](stat-icons-source.json), outside the client manifest. The silhouettes can be used as CSS masks; the colors describe native badge backgrounds, not colored glyph fills.

No icon is assigned to `specialDamageMultiplier`. CereBro imports that value from the reverse-engineered static `special_dmg` field. A separate native `specialDamage` tuning entry exists, but no authoritative alias to the imported multiplier has been established. Names alone do not justify assigning it the `S` glyph.

## Reproduce

From the repository root, with Python UnityPy 1.25.0 and the existing `opentype.js` dependency:

```powershell
python scripts/extract-mcoc-stat-font.py `
  --bundle 'C:/Games/Marvel Contest of Champions/default/game/Champions_Data/Resources/Data/ui/ui.assetbundle' `
  --bcg 'C:/Users/ossul/AppData/LocalLow/Kabam/Champions/bcg/out/v1/371DB0131A906AB077B58A9AE3F5D62D7E087C3A.bin' `
  --isil 'D:/CodexArtifacts/Cpp2IL-2026-11-03/IsilDump/Marvel.Runtime' `
  --out temp/stat-icons

pnpm exec tsx src/scripts/extract-mcoc-stat-icons.ts `
  --font=temp/stat-icons/Marvel-Icons-Font.ttf `
  --evidence=temp/stat-icons/stat-font-evidence.json `
  --root=.

pnpm exec vitest run src/tests/stat-icons.test.ts
```

The Python step checks the decompiled UI calls and native field offsets, reads the original BCG tuning bytes, and follows the serialized prefab references to the font. The TypeScript step verifies the extracted font hash before exporting bounds and paths directly through `opentype.js`. It performs no outline simplification or shape substitutions. Repeat with `--root=temp/stat-icons-reproduction` to compare a separate output tree. No database, game files, bundle, full font, or decompiled game method is written to the repository.

Current fingerprints: BCG `9e95551a68cfeeebf395f49b0bff676c5a2406ba7c30795c228cc48bd89ede61`; UI bundle `91679c15633f0336087415828a089a9ba0d28e7c71a73442216b4ac379aca28e`; font `8a8784655a64d06a8c51b1ea20a14ed605bf6f81ef4556ff8412aa0ca0016b61`.

Validation: repeating both extraction stages into a separate temporary tree reproduced all 11 SVGs and both manifests byte for byte. The source tests verify every native stat ID/glyph/color mapping, all emitted asset hashes, the client metadata boundary, and the absence of unverified multiplier artwork. The exported silhouettes were also visually compared with the supplied stat and Health/Attack screenshots.
