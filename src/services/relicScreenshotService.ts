import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { getGoogleVisionService, type VisionTextDetection } from './googleVisionService';
import { parseRelicPrestigeRanks } from '../domain/relic-prestige';
import { matchRelicScreenshot, normalizeRelicLabel, type RelicScreenshotRow, type ScreenshotRelic } from '../domain/relic-screenshot';
import { recognizeRelicAttribute } from './relicAttributeRecognition';

export async function loadScreenshotRelics(db: PrismaClient): Promise<ScreenshotRelic[]> {
  const rows = await db.gameRelicRarity.findMany({
    where: { isCurrent: true, selectable: true, relic: { isCurrent: true } },
    select: { relicId: true, stars: true, maxRank: true, maxSignature: true,
      relic: { select: { name: true, shortName: true, class: true, type: true, primaryAttribute: true, secondaryAttribute: true, sourceHash: true, importId: true } },
      prestige: { select: { ranks: true, sourceDefinitionHash: true, sourcePackageHash: true } },
    },
  });
  return rows.map(row => {
    let ranks = null;
    if (row.prestige?.sourceDefinitionHash === row.relic.sourceHash && row.prestige?.sourcePackageHash === row.relic.importId) {
      try { ranks = parseRelicPrestigeRanks(row.prestige.ranks, row); } catch { /* incomplete curves cannot infer a build */ }
    }
    return { relicId: row.relicId, name: row.relic.name, shortName: row.relic.shortName, stars: row.stars,
      className: row.relic.class, type: row.relic.type, primaryAttribute: row.relic.primaryAttribute, secondaryAttribute: row.relic.secondaryAttribute, ranks };
  });
}

type Box = { x: number; y: number; width: number; height: number };
function box(d: VisionTextDetection): Box {
  const xs = d.boundingPoly.vertices.map(v => v.x ?? 0), ys = d.boundingPoly.vertices.map(v => v.y ?? 0);
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}
function hue(r: number, g: number, b: number) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  if (delta < 30 || max < 90) return null;
  return ((max === r ? (g - b) / delta : max === g ? 2 + (b - r) / delta : 4 + (r - g) / delta) * 60 + 360) % 360;
}
const classHues = [['SKILL', 0], ['MUTANT', 52], ['SCIENCE', 100], ['COSMIC', 192], ['TECH', 218], ['MYSTIC', 294]] as const;

/** Layout is anchored to the rating/name plate, never to the bound champion avatar or upgrade arrow. */
export async function parseRelicScreenshot(image: Buffer, catalog: readonly ScreenshotRelic[], detections?: VisionTextDetection[]): Promise<RelicScreenshotRow[]> {
  const input = sharp(image, { limitInputPixels: 24_000_000, animated: false });
  const meta = await input.metadata();
  if (!meta.width || !meta.height || meta.width < 500 || meta.height < 250 || !['png', 'jpeg', 'webp'].includes(meta.format ?? ''))
    throw new Error('Use an original PNG, JPEG or WebP screenshot of My Relics.');
  const { data, info } = await input.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const ocr = detections ?? await (await getGoogleVisionService()).detectText(image);
  const words = ocr.filter(d => d.description && d.boundingPoly.vertices.length >= 4).map(d => ({ text: d.description!, ...box(d) }))
    .filter(w => !w.text.includes('\n') && w.y > info.height * .24 && w.height > 5);
  const labels = new Set(catalog.map(r => normalizeRelicLabel(r.shortName)));
  const ratings = words.filter(w => /^\d[\d, ]{1,5}\d$/.test(w.text) && Number(w.text.replace(/[, ]/g, '')) >= 100);
  const rows: RelicScreenshotRow[] = [];
  for (const rating of ratings) {
    const h = rating.height;
    const rowPeers = ratings.filter(w => Math.abs(w.y - rating.y) < h * .5).sort((a, b) => a.x - b.x);
    const gaps = rowPeers.slice(1).map((w, i) => w.x - rowPeers[i].x).filter(g => g > h * 4 && g < h * 14).sort((a, b) => a - b);
    const stride = gaps.length ? gaps[Math.floor(gaps.length / 2)] : h * 10;
    const nameWords = words.filter(w => w.x >= rating.x - h * .3 && w.x < rating.x + stride * .86 &&
      w.y >= rating.y - h * 1.4 && w.y + w.height <= rating.y + h * .2).sort((a, b) => a.x - b.x);
    const name = nameWords.map(w => w.text).join(' ');
    if (!labels.has(normalizeRelicLabel(name))) continue;
    const sample = (region: Box, fn: (r: number, g: number, b: number, x: number, y: number) => void) => {
      for (let y = Math.max(0, Math.round(region.y)); y < Math.min(info.height, region.y + region.height); y++)
        for (let x = Math.max(0, Math.round(region.x)); x < Math.min(info.width, region.x + region.width); x++) {
          const p = (y * info.width + x) * 3;
          fn(data[p], data[p + 1], data[p + 2], x, y);
        }
    };
    // The class glyph sits on the rating plate; exclude the pale Battlecast sword/Statcast bars.
    const votes = new Map<string, number>();
    sample({ x: rating.x + stride * .56, y: rating.y - h * .1, width: stride * .18, height: h * 1.1 }, (r, g, b) => {
      const value = hue(r, g, b);
      if (value === null || Math.max(r, g, b) - Math.min(r, g, b) < 100) return;
      const ranked = classHues.map(([name, ref]) => ({ name, d: Math.min(Math.abs(value-ref), 360-Math.abs(value-ref)) })).sort((a,b) => a.d-b.d);
      if (ranked[0].d < 20) votes.set(ranked[0].name, (votes.get(ranked[0].name) ?? 0) + 1);
    });
    const classVote = [...votes].sort((a, b) => b[1] - a[1]);
    const className = classVote[0]?.[1] > stride * .25 ? classVote[0][0] : null;
    // Stars occupy a horizontal strip immediately above the label. Count separate bright tips.
    const starTop = rating.y - stride * .245;
    const runsByY: number[][] = [];
    for (let y = Math.round(starTop); y < Math.round(starTop + stride * .035); y++) {
      const runs: number[] = []; let start: number | null = null;
      for (let x = Math.round(rating.x); x < Math.round(rating.x + stride * .8); x++) {
        const p = (y * info.width + x) * 3;
        const bright = y >= 0 && x >= 0 && x < info.width && data[p] > 140 && data[p + 1] > 110 && (data[p + 2] > 100 || data[p] > data[p + 2] * 1.5);
        if (bright && start === null) start = x;
        if ((!bright || x === Math.round(rating.x + stride * .8)-1) && start !== null) {
          if (x-start >= stride * .007) runs.push((x+start)/2);
          start = null;
        }
      }
      if (runs.length >= 3 && runs.length <= 7 && runs.slice(1).every((x,i) => x-runs[i] > stride*.065 && x-runs[i] < stride*.14)) runsByY.push(runs);
    }
    const counts = new Map<number, number>();
    for (const run of runsByY) counts.set(run.length, (counts.get(run.length) ?? 0)+1);
    const best = [...counts].sort((a,b)=>b[1]-a[1])[0];
    const countedStars = best && best[1] >= 2 ? best[0] : null;
    // Sample the main frame below the bound-champion portrait down to the star row.
    // Bulky relic art can cover its upper edge. Keep the same strong-evidence gate;
    // unknown/contradictory pixels never force a rarity.
    const frames = new Map<number, number>();
    sample({ x: rating.x + stride*.025, y: rating.y-stride*.65, width: stride*.045, height: stride*.4 }, (r,g,b) => {
      const value = hue(r,g,b);
      if (value === null || Math.max(r,g,b)-Math.min(r,g,b) < 65) return;
      const frame = value > 255 && value < 290 ? 7 : value > 178 && value < 200 ? 6 : value < 22 ? 5 : null;
      if (frame) frames.set(frame, (frames.get(frame) ?? 0)+1);
    });
    const frameVotes = [...frames].sort((a,b)=>b[1]-a[1]);
    const frameStars = frameVotes[0]?.[1] > stride*.3 && frameVotes[0][1] > (frameVotes[1]?.[1] ?? 0)*4 ? frameVotes[0][0] : null;
    const stars = countedStars && frameStars && countedStars !== frameStars ? null : countedStars ?? frameStars;
    let gold = 0, silver = 0;
    sample({ x: rating.x, y: starTop + stride*.035, width: stride*.8, height: stride*.04 }, (r,g,b) => {
      if (r > 140 && g > 100 && b < r*.6 && g < r*.9) gold++;
      if (r > 140 && g > 140 && b > 140 && Math.abs(r-b) < 55) silver++;
    });
    const awakened = gold + silver < stride ? null : silver > gold * 3 ? true : gold > silver * 3 ? false : null;
    const left = Math.max(0, rating.x - stride*.08), top = Math.max(0, rating.y-stride);
    const bounds = { x: left/info.width, y: top/info.height, width: Math.min(stride*.94, info.width-left)/info.width, height: Math.min(stride*1.15, info.height-top)/info.height };
    const family = catalog.filter(relic => relic.type === 'statcast' && normalizeRelicLabel(relic.shortName) === normalizeRelicLabel(name));
    let attributes: Pick<RelicScreenshotRow, 'primaryAttribute' | 'secondaryAttribute' | 'attributeStatus'> = {};
    if (family.length) {
      // The top glyph denotes the family, the smaller glyph beneath it the secondary variant.
      // Compare all source glyphs before consulting the catalog or prestige matches.
      const primary = recognizeRelicAttribute(data, info.width, info.height, {
        x: rating.x + stride * .683, y: rating.y - stride * .765, width: stride * .12, height: stride * .12,
      });
      const secondary = recognizeRelicAttribute(data, info.width, info.height, {
        x: rating.x + stride * .685, y: rating.y - stride * .636, width: stride * .102, height: stride * .102,
      });
      const conflict = primary && !family.some(relic => relic.primaryAttribute === primary.attribute);
      attributes = conflict ? { attributeStatus: 'conflict' } : {
        primaryAttribute: primary?.attribute ?? null,
        secondaryAttribute: secondary?.attribute ?? null,
        attributeStatus: primary && secondary ? 'recognized' : 'unclear',
      };
    }
    const observation = { name, rating: Number(rating.text.replace(/[, ]/g, '')), stars, awakened, className, ...attributes };
    rows.push({ id: randomUUID(), ...observation, bounds, matches: matchRelicScreenshot(observation, catalog) });
  }
  if (!rows.length) throw new Error('No complete relic cards recognized. Use the My Relics grid with names, stars and ratings visible.');
  return rows.sort((a,b) => Math.abs(a.bounds.y-b.bounds.y) < .05 ? a.bounds.x-b.bounds.x : a.bounds.y-b.bounds.y);
}
