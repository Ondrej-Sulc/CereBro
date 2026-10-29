export const RELIC_GLYPH_SIZE = 32;

/** Normalize glyph foreground only; remove detached tile/font boundary rules, not interior strokes. */
export function normalizeRelicGlyph(source: Float32Array, width: number, height: number, fontRules = false): Float32Array | null {
  const mask = source.slice(), seen = new Uint8Array(mask.length);
  const components: { points: number[]; minX: number; minY: number; maxX: number; maxY: number }[] = [];
  for (let start = 0;start < mask.length;start++) {
    if (seen[start] || mask[start] < .2) continue;
    const points = [start]; seen[start] = 1;
    let minX = width, minY = height, maxX = 0, maxY = 0;
    for (let cursor = 0;cursor < points.length;cursor++) {
      const p = points[cursor], x = p % width, y = Math.floor(p / width);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]]) {
        const nx = x + dx, ny = y + dy, n = ny * width + nx;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height && !seen[n] && mask[n] >= .2) { seen[n] = 1; points.push(n); }
      }
    }
    const w = maxX - minX + 1, h = maxY - minY + 1;
    // A detached arrow tail through the middle is part of a penetration glyph.
    // Only discard long, thin rules at the outer edge (tile borders/font underlines).
    const boundaryRule = (w / h > 4.5 && w > width * .65 && (minY > height * .75 || maxY < height * .2)) ||
      (h / w > 4.5 && h > height * .65 && (minX > width * .8 || maxX < width * .2));
    if (boundaryRule || points.length < 2) for (const p of points) mask[p] = 0;
    else components.push({ points, minX, minY, maxX, maxY });
  }
  const main = components.sort((a, b) => b.points.length - a.points.length)[0];
  if (!main) return null;
  const pad = Math.max(2, Math.min(width, height) * .08);
  // Font paths contain intentional detached strokes; only screenshot crops can contain nearby artwork.
  for (const c of components.slice(1)) if (!fontRules && (c.maxX < main.minX - pad || c.minX > main.maxX + pad || c.maxY < main.minY - pad || c.minY > main.maxY + pad))
    for (const p of c.points) mask[p] = 0;
  let minX = width, minY = height, maxX = -1, maxY = -1, area = 0;
  for (let p = 0;p < mask.length;p++)if (mask[p] >= .2) { const x = p % width, y = Math.floor(p / width); minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); area++; }
  if (area < 8 || area > width * height * .85 || maxX - minX < 3 || maxY - minY < 3) return null;
  // Anchor scale to the body, not a one-pixel arrow tail which may touch the crop edge.
  // Apply the same rule to font templates and photographed glyphs.
  const minColumnInk = Math.max(2, (maxY - minY + 1) * .18);
  const columns = new Uint16Array(width);
  for (let y = minY;y <= maxY;y++)for (let x = minX;x <= maxX;x++)if (mask[y * width + x] >= .2) columns[x]++;
  while (minX < maxX && columns[minX] < minColumnInk) minX++;
  while (maxX > minX && columns[maxX] < minColumnInk) maxX--;
  const size = RELIC_GLYPH_SIZE, w = maxX - minX + 1, h = maxY - minY + 1, scale = (size - 4) / Math.max(w, h);
  const out = new Float32Array(size * size), left = (size - w * scale) / 2, top = (size - h * scale) / 2;
  for (let y = 0;y < size;y++)for (let x = 0;x < size;x++) {
    const sx = (x + .5 - left) / scale + minX - .5, sy = (y + .5 - top) / scale + minY - .5;
    if (sx < minX - .5 || sx > maxX + .5 || sy < minY - .5 || sy > maxY + .5) continue;
    const x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0;
    const pixel = (px: number, py: number) => px >= 0 && px < width && py >= 0 && py < height ? mask[py * width + px] : 0;
    out[y * size + x] = pixel(x0, y0) * (1 - fx) * (1 - fy) + pixel(x0 + 1, y0) * fx * (1 - fy) + pixel(x0, y0 + 1) * (1 - fx) * fy + pixel(x0 + 1, y0 + 1) * fx * fy;
  }
  return out;
}
