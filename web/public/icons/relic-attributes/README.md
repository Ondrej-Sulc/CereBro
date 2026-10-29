# Relic attribute glyphs

`physical-penetration.svg` is the actual Statcast attribute glyph, extracted from the game's `Marvel-Icons-Font.ttf`. The older website glossary's `physical_pen` artwork is different; it is not used for this relic attribute. The shared relic icon map uses this SVG for catalog cards, filters, detail pages and screenshot choices. This does not change recognition masks or glossary records.

Source binding from `mcoc_relics.raw.json`:

- Socket item: `attribute_statcast_si_sec_ppen`
- Treatment: U+F110 (61712), Physical Penetration Secondary
- Font SHA-256: `3fd45947178653508917b6abc88ed4506b0f711f37eaf8998bf8279c4fa118f6`
- Relic source SHA-256: `b7c34489a35034dc58cc4eda26f0727e98ee3465d5596261b613d25b6133a47d`
- SVG SHA-256: `bb73ac85cebc7cecba873003e7d5748723a3b1f8a4cd808838aa67e332a7a1ed`

These source hashes and the code point also appear in `src/data/relic-attribute-glyphs.json`. To reproduce the SVG, parse the verified font bytes with `opentype.js`, call `font.getPath(String.fromCodePoint(61712), 0, 0, 128)`, and use `path.toSVG(3)` inside an SVG with its `path.getBoundingBox()` as the viewBox. The path is unmodified and rendered as a CSS mask; its neutral display color is not a claim about in-game effect color.
