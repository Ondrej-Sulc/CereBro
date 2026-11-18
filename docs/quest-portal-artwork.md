# Original quest portal artwork

The quest map uses four explicitly selected original game sprites as decorative
markers. Their filenames do not prove arrival/departure roles. The lookup in
`src/data/game-quests/portal-artwork.ts` imports only an 872-byte finite manifest;
the source audit stays in the separate `portal-artwork-proof.json`.

| Key | Exact native Sprite name | Native PNG size | Source bundle |
| --- | --- | --- | --- |
| `entranceHalf` | `Portal_Entrance_Ring_Half` | 170 × 340 | `quest_odr/quest.assetbundle` |
| `summoningQuarter` | `Portal_Summoning_Ring_Quarter` | 114 × 114 | `quest_odr/quest.assetbundle` |
| `exitQuarter` | `Portal_ExitRing_White_Quarter` | 114 × 114 | `quest_odr/quest.assetbundle` |
| `small` | `PortalSmall` | 96 × 96 | `main_odr/main_atlas_procedural.assetbundle` |

The exporter selects an exact case-sensitive `Sprite` name in its pinned source,
not a similarly named `Texture2D`, alias or preview. It checks the installed pack
manifest and TOC, original bundle SHA-256, Unity object identity and raw-object
hash, retained PNG bytes, dimensions and every RGBA byte against a fresh native
Sprite decode. Matching original Texture2D and duplicate Sprite objects remain
in the audit. `PortalSmall` retains its exact MainAtlas render-data/texture crop
chain. The four PNG files total 73,518 bytes.

The public files are unchanged retained lossless native sprite exports: no
resizing, recoloring, repainting or full-ring rasterization. Transparent RGB is
also retained. Shader/material composition and native animation are not claimed.

Native PNG coordinates use a top-left origin. The half-ring occupies the left
half of a 340 × 340 ring, with pivot `(170,170)` in its 170 × 340 canvas. Place it
at `(-170,-170)` around a shared origin and rotate the second instance 180°.
Each quarter occupies the upper-right quadrant of a 228 × 228 ring, with pivot
`(0,114)` in its 114 × 114 canvas. Place it at `(0,-114)` and rotate instances
0°, 90°, 180° and 270°. Preserve the entire native canvas when composing; alpha
bounds describe faint native pixels and are not trimming instructions. The
small ring is already complete and centered at `(48,48)`.

The map composes the cyan half-ring around an existing portal coordinate and
adds a quiet rotating cyan quarter-ring. White quarters provide the selection
and keyboard-focus halo. The stationary `PortalSmall` glyph fills the center of
standalone portals; portraits and path features keep their own center when they
share a portal location. Rotation stops when reduced motion is requested.
Defenders at recorded portal destinations use the same ring treatment around
their unchanged portrait. The automatic overview and map key use `PortalSmall`;
overview markers are derived only from recorded source/target tiles. Connections,
destinations, route membership and keyboard selection remain owned by quest data.
Portal-only sources, random entrances and destinations omit combat modifiers in
the location details. A defender sharing that location retains its modifiers.

Reproduce from the existing offline artwork library and installed static assets:

```powershell
python scripts/game-quests/build_portal_artwork.py
python scripts/game-quests/build_portal_artwork.py --check
python -m unittest discover -s scripts/game-quests -p test_build_portal_artwork.py -v
pnpm exec vitest run src/tests/game-quests/portal-artwork.test.ts --maxWorkers=1
```

`--library` and `--installed` override the documented local defaults. Dependencies
are the existing Pillow/UnityPy versions in `scripts/game-artwork/requirements.txt`.
The build reads only the public static artwork index/blobs and Unity resources;
it does not access an application database, game process, account, session or
network. `--check` reproduces both manifests and all four byte-identical PNGs
without writing. Conflicting identities or changed immutable outputs fail.
