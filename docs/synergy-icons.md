# Native game synergy icons

The native icon identifier is **`BCGSynergyBonus.Texture`**, protobuf top-level field 6, child field 5. It is text in the game's icon font, including ordinary Latin codepoints and private-use characters. It is not a champion portrait, class icon, or glossary lookup. Names are never used to choose artwork.

The current `ui.assetbundle` serializes this binding:

`SynergyBonusInfoPanelItem._bonusTile → SynergyBonusTile._icon → UILabel.mCustomFont → FontLocalizer._defaultFontPath = UI/Fonts/Marvel-Icons-Font`.

The font bytes come from the same bundle's `Font` object, `Marvel-Icons-Font`. The extraction script follows those references; it does not choose a font by visual similarity. Object path IDs and hashes are retained in [the manifest](../src/data/synergy-icons.json).

## Current verified package

- BCG SHA-256: `9e95551a68cfeeebf395f49b0bff676c5a2406ba7c30795c228cc48bd89ede61`
- Typed snapshot SHA-256: `1703c5e63ffce04e0d6b058cb3bea2c9df677984263c67b4c876a19e3cbde810`
- UI bundle SHA-256: `91679c15633f0336087415828a089a9ba0d28e7c71a73442216b4ac379aca28e`
- Font SHA-256: `8a8784655a64d06a8c51b1ea20a14ed605bf6f81ef4556ff8412aa0ca0016b61`
- 3,335 source synergy IDs; 298 exact texture strings; 296 distinct, content-addressed SVGs; no unresolved glyphs.

Five source records include trailing non-rendering CR/tab controls. Their exact strings remain in the manifest and database. Only those controls are removed when extracting the visible glyph outline; no visible character is truncated. Every SVG retains the original vector outline and its bounds. The UI uses a neutral tint; it does not imply active-team status or an effect color.

The provided Khonshu screenshot is a visual reference only. It was not used to infer any mapping.

## Reproduce or refresh

Use the existing local extraction project first: `C:/Games/Marvel Contest of Champions/default/game/Scripts/export_mcoc_synergies.py`. Its typed `mcoc_synergies.json` is the input to CereBro's existing `import:mcoc-synergies` command. Retain the original BCG file named in the snapshot's metadata.

From the repository root (Python requires UnityPy; the current run used 1.25.0):

```powershell
python scripts/extract-mcoc-synergy-font.py `
  --bundle 'C:/Games/Marvel Contest of Champions/default/game/Champions_Data/Resources/Data/ui/ui.assetbundle' `
  --snapshot 'D:/CodexArtifacts/monthly-update-2026-11-03/champions/mcoc_synergies.json' `
  --game-scripts 'C:/Games/Marvel Contest of Champions/default/game/Scripts' `
  --out temp/synergy-icons

pnpm exec tsx src/scripts/extract-mcoc-synergy-icons.ts `
  --snapshot=D:/CodexArtifacts/monthly-update-2026-11-03/champions/mcoc_synergies.json `
  --font=temp/synergy-icons/Marvel-Icons-Font.ttf `
  --evidence=temp/synergy-icons/font-evidence.json `
  --root=.
```

Replace the snapshot/bundle paths for a later game version. The Python step verifies the BCG hash and reuses the original typed exporter to independently compare **every ID and texture** with the binary. It then extracts the font and UI-reference evidence. The TypeScript step rejects changed snapshot/font bytes, uses the existing `opentype.js` dependency to export glyph paths, and writes `web/public/icons/synergies/` plus `src/data/synergy-icons.json`. Each path's filename contains its codepoint and content hash. Missing or ambiguous glyphs are reported in `unresolved`; they receive no substitute. Generation does not delete old assets or write a database.

The full proprietary font and BCG bundle are not added to the repository. Only the referenced SVG outlines and evidence are included. Repeating generation into `temp/synergy-icons-reproduction` produced a byte-identical manifest and all 296 SVGs.

Git keeps these SVGs at LF line endings on every platform so checkout conversion cannot invalidate the verified byte hashes.

## Import and read contract

`parseMcocSynergiesJson` already requires `texture`, and `prepareMcocSynergiesImport` stores each full record in `GameSynergy.raw`, retaining its original ID and BCG `sourceHash`. This import contract is unchanged. No migration, catalog replacement, ID rewrite, or database write is needed for these icons.

`getChampionSynergies` selects `raw` on the server and projects `raw.texture` through the verified glyph map only if `raw.id` matches the row ID. It returns an optional `iconUrl`, excluding raw metadata from the client payload. Its cache version changed to avoid reusing the earlier icon-free projection. The source snapshot hash records provenance; it is not an allow-list that would hide known glyphs on the next catalog refresh. New IDs or renamed synergies resolve their current raw texture; unknown textures remain absent until extraction is refreshed.

Both rarity grouping and leveled-family grouping include the resolved icon identity. Different or missing icons stay separate, retaining all source targets and exact level rules. Identical icons continue sharing the compact header. The title remains the accessible name; the adjacent 20px CSS-mask span is decorative (`aria-hidden`). Missing metadata renders the existing title without an icon or generic placeholder.

## Validation

See [the UI notes](ux/champions/synergy-icons/notes.md) and [matched comparison gallery](ux/champions/synergy-icons/comparison.html).

- All 3,335 local raw records resolve icons; the 45,502 members match the existing import plan. Text, IDs, tags, rules and raw nonnumeric fields compare exactly. PostgreSQL/Prisma's pre-existing float serialization differences compare equally at original game float32 precision; they were not rewritten. [Read-only verification](ux/champions/synergy-icons/catalog-verification.json).
- Tests verify all exact source mappings and SVG hashes, changed/raw unknown textures across refresh, projection through the server read path, decorative rendering, and grouping/alias preservation.
- Existing champion UX edits are preserved. No commit, push, PR or deployment was performed.
