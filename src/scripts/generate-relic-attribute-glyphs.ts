import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import opentype from 'opentype.js';
import sharp from 'sharp';
import { z } from 'zod';
import { extractRelicGlyph, normalizeRelicGlyph, RELIC_GLYPH_SIZE } from '../domain/relic-attribute-mask';

// Offline generation only: bind game SocketItems.Treatment characters to the actual bundled font.
async function main() {
  const [rawPath, fontPath, output] = process.argv.slice(2);
  if (!rawPath || !fontPath || !output) throw new Error('Usage: tsx generate-relic-attribute-glyphs.ts <mcoc_relics.raw.json> <Marvel-Icons-Font.ttf> <output.json>');
  const [rawBytes, fontBytes] = await Promise.all([readFile(rawPath), readFile(fontPath)]);
  const raw = z.object({ SocketItems: z.record(z.string(), z.object({ Id: z.string(), Name: z.object({ en: z.string() }), Treatment: z.string().optional() })) }).parse(JSON.parse(rawBytes.toString()));
  const font = opentype.parse(fontBytes.buffer.slice(fontBytes.byteOffset, fontBytes.byteOffset + fontBytes.byteLength));
  const definitions = Object.values(raw.SocketItems).filter(item => item.Id.startsWith('attribute_statcast_si_sec_'));
  if (definitions.length !== 11) throw new Error('Review the attribute set before generating changed game definitions.');
  const glyphs = [];
  for (const item of definitions) {
    if (!item.Treatment || Array.from(item.Treatment).length !== 1) throw new Error(`Missing glyph for ${item.Id}`);
    const path = font.getPath(item.Treatment, 0, 0, 128), b = path.getBoundingBox();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.x1} ${b.y1} ${b.x2 - b.x1} ${b.y2 - b.y1}">${path.toSVG(3)}</svg>`;
    const { data, info } = await sharp(Buffer.from(svg)).resize(128, 128, { fit: 'contain', background: '#00000000' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const mask = new Float32Array(info.width * info.height);
    for (let i = 0;i < mask.length;i++)mask[i] = data[i * 4 + 3] / 255;
    const normalized = normalizeRelicGlyph(mask, info.width, info.height, true);
    if (!normalized) throw new Error(`Empty glyph for ${item.Id}`);
    const encode = (values: Float32Array) => Buffer.from(values.map(v => Math.round(v * 255))).toString('base64');
    const rasterMasks = [];
    // Render all attributes at the same sizes on a neutral dark tile, then use the
    // screenshot foreground extraction. This preserves rasterization loss without
    // relaxing confidence thresholds or learning champion/variant-specific cases.
    const whiteSvg = svg.replace('<path ', '<path fill="white" ');
    for (const size of [12, 16, 20, 24, 32]) {
      const { data: rgb, info: raster } = await sharp(Buffer.from(whiteSvg))
        .resize(size, size, { fit: 'contain', background: '#303030' })
        .flatten({ background: '#303030' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const small = extractRelicGlyph(rgb, raster.width, raster.height, { x: 0, y: 0, width: size, height: size });
      if (!small) throw new Error(`Empty ${size}px glyph for ${item.Id}`);
      rasterMasks.push({ size, mask: encode(small) });
    }
    glyphs.push({ attribute: item.Name.en.replace(/ Secondary$/, ''), sourceId: item.Id, codePoint: item.Treatment.codePointAt(0)!, mask: encode(normalized), rasterMasks });
  }
  const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
  await writeFile(output, JSON.stringify({ version: 2, size: RELIC_GLYPH_SIZE, font: 'Marvel-Icons-Font', fontSha256: sha(fontBytes), relicSourceSha256: sha(rawBytes), glyphs }, null, 2) + '\n');
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });

