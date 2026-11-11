// Export only reviewed native font outlines; no redraw, name lookup or fallback.
const fs = require('node:fs');
const crypto = require('node:crypto');
const opentype = require('opentype.js');
const [fontPath, input, folder, output] = process.argv.slice(2);
const font = opentype.loadSync(fontPath);
fs.mkdirSync(folder, { recursive: true });
const result = {};
for (const char of JSON.parse(fs.readFileSync(input, 'utf8'))) {
  const glyph = font.charToGlyph(char);
  if (!glyph.index || !glyph.path.commands.length) {
    result[char] = { status: 'missing-font-glyph' };
    continue;
  }
  const path = glyph.getPath(0, 0, font.unitsPerEm);
  const b = path.getBoundingBox(), pad = 40;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.x1-pad} ${b.y1-pad} ${b.x2-b.x1+2*pad} ${b.y2-b.y1+2*pad}"><path fill="#a5e2df" d="${path.toPathData(3)}"/></svg>\n`;
  const hash = crypto.createHash('sha256').update(svg).digest('hex');
  fs.writeFileSync(`${folder}/${hash}.svg`, svg);
  result[char] = { status: 'verified', glyphIndex: glyph.index, src: `/node-modifiers/icons/${hash}.svg`, sha256: hash };
}
fs.writeFileSync(output, JSON.stringify(result));
