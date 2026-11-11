// Finite additional native outlines. No font substitution, redraw or name join.
const fs = require('node:fs');
const crypto = require('node:crypto');
const opentype = require('opentype.js');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');

function glyphGeometry(font, glyphText) {
  if (Array.from(glyphText).length !== 1) throw new Error('Expected one exact native codepoint');
  const glyph = font.charToGlyph(glyphText);
  const base = { glyph: glyphText, codepoint: 'U+' + glyphText.codePointAt(0).toString(16).toUpperCase().padStart(4, '0'), glyphIndex: glyph.index, unitsPerEm: font.unitsPerEm };
  if (!glyph.index) return { ...base, status: 'missing-native-cmap-entry' };
  if (!glyph.path.commands.length) return { ...base, status: 'empty-native-outline' };
  const path = glyph.getPath(0, 0, font.unitsPerEm), bounds = path.getBoundingBox();
  const values = [bounds.x1, bounds.y1, bounds.x2, bounds.y2];
  if (values.some(value => !Number.isFinite(value)) || bounds.x2 <= bounds.x1 || bounds.y2 <= bounds.y1) return { ...base, status: 'invalid-native-outline-bounds' };
  const padding = 40, rounded = value => Number(value.toFixed(3));
  const frame = [bounds.x1 - padding, bounds.y1 - padding, bounds.x2 - bounds.x1 + 2 * padding, bounds.y2 - bounds.y1 + 2 * padding].map(rounded);
  const d = path.toPathData(3);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${frame.join(' ')}"><path fill="currentColor" d="${d}"/></svg>\n`;
  return { ...base, status: 'verified', advanceWidth: glyph.advanceWidth, pathBounds: values.map(rounded), viewBox: frame, padding,
    outlineSha256: sha(d), sha256: sha(svg), svg };
}

function exportGlyphs(fontPath, expectedHash, input, assets, output) {
  const bytes = fs.readFileSync(fontPath);
  if (sha(bytes) !== expectedHash) throw new Error('Native font source hash drift');
  const chars = JSON.parse(fs.readFileSync(input, 'utf8'));
  if (new Set(chars).size !== chars.length) throw new Error('Duplicate native glyph request');
  const font = opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  fs.mkdirSync(assets, { recursive: true });
  const rows = chars.map(char => {
    const { svg, ...row } = glyphGeometry(font, char);
    if (svg) {
      fs.writeFileSync(`${assets}/${row.sha256}.svg`, svg);
      row.iconKey = 'node-game-glyph-' + row.sha256.slice(0, 16);
      row.src = `/node-modifiers/v3/icons/${row.sha256}.svg`;
    }
    return row;
  });
  fs.writeFileSync(output, JSON.stringify(rows));
  return rows;
}
module.exports = { glyphGeometry, exportGlyphs };
if (require.main === module) exportGlyphs(...process.argv.slice(2));
