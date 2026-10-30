import templates from '../data/relic-attribute-glyphs.json';
import { extractRelicGlyph, RELIC_GLYPH_SIZE } from '../domain/relic-attribute-mask';

// Small glyphs lose thin strokes during rasterization. Compare each attribute at the
// same source-rendered resolutions, retaining one confidence/margin vote per attribute.
const glyphs = templates.glyphs.map(g => ({
  attribute: g.attribute,
  masks: [g.mask, ...g.rasterMasks.map(raster => raster.mask)]
    .map(mask => Float32Array.from(Buffer.from(mask, 'base64'), v => v / 255)),
}));
export type AttributeMatch = { attribute: string; score: number; margin: number };

/** Compare white glyph shapes against all 11 source-bound attributes, never against a prestige-filtered subset. */
export function rankRelicAttributes(rgb: Buffer, width: number, height: number, box: { x: number; y: number; width: number; height: number }) {
  const normalized = extractRelicGlyph(rgb, width, height, box);
  if (!normalized) return [];
  const size = RELIC_GLYPH_SIZE;
  return glyphs.map(g => {
    let best = 0;
    for (const mask of g.masks)for (let dy = -1;dy <= 1;dy++)for (let dx = -1;dx <= 1;dx++) {
      let intersection = 0, total = 0;
      for (let y = 0;y < size;y++)for (let x = 0;x < size;x++) {
        const nx = x + dx, ny = y + dy, a = normalized[y * size + x], b = nx >= 0 && nx < size && ny >= 0 && ny < size ? mask[ny * size + nx] : 0;
        intersection += Math.min(a, b); total += a + b;
      }
      best = Math.max(best, total ? 2 * intersection / total : 0);
    }
    return { attribute: g.attribute, score: best };
  }).sort((a, b) => b.score - a.score);
}

export function recognizeRelicAttribute(rgb: Buffer, width: number, height: number, box: { x: number; y: number; width: number; height: number }): AttributeMatch | null {
  const ranked = rankRelicAttributes(rgb, width, height, box), first = ranked[0], second = ranked[1];
  if (!first || first.score < .73 || first.score - (second?.score ?? 0) < (first.score >= .85 ? .03 : .045)) return null;
  return { ...first, margin: first.score - (second?.score ?? 0) };
}

