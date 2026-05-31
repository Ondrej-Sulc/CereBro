import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import logger from '../loggerService.js';
import { ChampionClass } from '@prisma/client';
import { CONFIG } from './rosterConfig.js';
import { GridCell } from './types.js';
import { getAssetsPath } from '../../utils/assets.js';

export interface RawImageOptions {
  raw: {
    width: number;
    height: number;
    channels: number;
  };
}

export class RosterFeatureService {
  private classIcons: Map<ChampionClass, Buffer> = new Map();
  private classHues: Map<ChampionClass, number> = new Map();

  constructor() {
    this.loadClassIcons();
  }

  private async loadClassIcons() {
    const iconsPath = getAssetsPath('icons');

    const classMap: Record<string, ChampionClass> = {
      'Cosmic.png': 'COSMIC',
      'Tech.png': 'TECH',
      'Mutant.png': 'MUTANT',
      'Skill.png': 'SKILL',
      'Science.png': 'SCIENCE',
      'Mystic.png': 'MYSTIC',
      'superior.png': 'SUPERIOR',
    };

    for (const [file, className] of Object.entries(classMap)) {
      try {
        const iconBuffer = await fs.readFile(path.join(iconsPath, file));
        
        // This is done once at startup, so using Sharp here is fine/preferred for correctness
        const { data } = await sharp(iconBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        let rSum = 0, gSum = 0, bSum = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] > 128) { // Non-transparent
                rSum += data[i];
                gSum += data[i + 1];
                bSum += data[i + 2];
                count++;
            }
        }
        if (count > 0) {
            const avgR = rSum / count;
            const avgG = gSum / count;
            const avgB = bSum / count;
            const { h } = this.rgbToHsl(avgR, avgG, avgB);
            this.classHues.set(className, h);
        }

        if (className === 'TECH') {
            this.classHues.set(className, 225);
        }

        const resizedIcon = await sharp(iconBuffer)
            .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .toBuffer();

        const composited = await sharp({
            create: {
                width: 32,
                height: 32,
                channels: 4,
                background: { r: 40, g: 40, b: 40, alpha: 1 }
            }
        })
        .composite([{ input: resizedIcon }]) 
        .raw()
        .toBuffer();

        this.classIcons.set(className, composited);
      } catch (error) {
        logger.error({ err: error }, `Failed to load class icon ${file}`);
      }
    }
  }

  public getClassIcon(className: ChampionClass): Buffer | undefined {
      return this.classIcons.get(className);
  }

  public async identifyClass(rawImage: Buffer, rawOpts: RawImageOptions, cell: GridCell): Promise<ChampionClass | undefined> {
    try {
      const { x, y, width, height } = cell.bounds;
      const imgW = rawOpts.raw.width;
      const imgH = rawOpts.raw.height;

      const left = Math.round(x + (width * CONFIG.CLASS_ICON_RATIO.x));
      const top = Math.round(y + (height * CONFIG.CLASS_ICON_RATIO.y));
      const w = Math.round(width * CONFIG.CLASS_ICON_RATIO.width);
      const h = Math.round(height * CONFIG.CLASS_ICON_RATIO.height);
      
      if (left < 0 || top < 0 || left + w > imgW || top + h > imgH) {
            return undefined;
      }

      let rSum = 0, gSum = 0, bSum = 0, count = 0;
      
      // Direct buffer access optimization
      for (let r = 0; r < h; r++) {
          const rowOffset = (top + r) * imgW * 4;
          for (let c = 0; c < w; c++) {
              const offset = rowOffset + (left + c) * 4;
              const red = rawImage[offset];
              const green = rawImage[offset + 1];
              const blue = rawImage[offset + 2];
              // const alpha = rawImage[offset + 3];

              const { s, l } = this.rgbToHsl(red, green, blue);
              
              if (l > 0.20 && s > 0.15) {
                  rSum += red;
                  gSum += green;
                  bSum += blue;
                  count++;
              }
          }
      }

      if (count < 10) { 
          return undefined;
      }

      const avgR = rSum / count;
      const avgG = gSum / count;
      const avgB = bSum / count;
      const { h: avgHue } = this.rgbToHsl(avgR, avgG, avgB);

      let bestMatch: ChampionClass | undefined;
      let minHueDiff = Infinity;

      for (const [className, refHue] of this.classHues.entries()) {
        let diff = Math.abs(avgHue - refHue);
        if (diff > 180) diff = 360 - diff; 

        if (diff < minHueDiff) {
          minHueDiff = diff;
          bestMatch = className;
        }
      }

      cell.debugInfo = {
        ...cell.debugInfo,
        classHue: avgHue.toFixed(1),
        // @ts-ignore
        classMatch: { bestMatch, minHueDiff: minHueDiff.toFixed(1) }
      };

      if (minHueDiff <= 30) {
        return bestMatch;
      }
      
      return undefined;
    } catch (err) {
      logger.error({ err }, "Error identifying class");
      return undefined;
    }
  }

  public async identifyStars(rawImage: Buffer, rawOpts: RawImageOptions, cell: GridCell): Promise<number> {
    try {
      const { x, y, width, height } = cell.bounds;
      const imgW = rawOpts.raw.width;
      const imgH = rawOpts.raw.height;

      let left = Math.round(x + (width * CONFIG.STARS_CHECK_RATIO.x));
      let top = Math.round(y + (height * CONFIG.STARS_CHECK_RATIO.y));
      let w = Math.round(width * CONFIG.STARS_CHECK_RATIO.width);
      let h = Math.round(height * CONFIG.STARS_CHECK_RATIO.height);

      if (left < 0) left = 0;
      if (top < 0) top = 0;
      if (left + w > imgW) w = imgW - left;
      if (top + h > imgH) h = imgH - top;

      let minX = w;
      let maxX = 0;
      let hasBrightPixels = false;
      const threshold = 120; 

      // Direct buffer access + manual grayscale conversion
      // Grayscale = 0.299*R + 0.587*G + 0.114*B
      for (let r = 0; r < h; r++) {
          const rowOffset = (top + r) * imgW * 4;
          for (let c = 0; c < w; c++) {
              const offset = rowOffset + (left + c) * 4;
              const red = rawImage[offset];
              const green = rawImage[offset + 1];
              const blue = rawImage[offset + 2];
              
              // Integer math optimization: (299*R + 587*G + 114*B) / 1000
              const gray = (299 * red + 587 * green + 114 * blue) / 1000;

              if (gray > threshold) {
                  if (c < minX) minX = c;
                  if (c > maxX) maxX = c;
                  hasBrightPixels = true;
              }
          }
      }

      let starWidthRatio = 0;
      if (hasBrightPixels) {
          const contentWidth = maxX - minX;
          starWidthRatio = contentWidth / w;
      }

      cell.debugInfo = {
        ...cell.debugInfo,
        starWidthRatio: starWidthRatio.toFixed(3),
        starContentWidth: (maxX - minX)
      };
      
      if (starWidthRatio > 0.90) return 7;
      if (starWidthRatio > 0.75) return 6;
      if (starWidthRatio > 0.60) return 5;
      if (starWidthRatio > 0.45) return 4;
      if (starWidthRatio > 0.30) return 3;
      if (starWidthRatio > 0.15) return 2;
      
      return 1; 
    } catch (err) {
      logger.error({ err }, "Error identifying stars");
      return 6; 
    }
  }

  public async identifyAscension(rawImage: Buffer, rawOpts: RawImageOptions, cell: GridCell): Promise<{ isAscended: boolean, ascensionLevel: number }> {
    try {
      const { x, y, width, height } = cell.bounds;
      const imgW = rawOpts.raw.width;
      const imgH = rawOpts.raw.height;

      let left = Math.round(x + (width * CONFIG.ASCENSION_ICON_RATIO.x));
      let top = Math.round(y + (height * CONFIG.ASCENSION_ICON_RATIO.y));
      let w = Math.round(width * CONFIG.ASCENSION_ICON_RATIO.width);
      let h = Math.round(height * CONFIG.ASCENSION_ICON_RATIO.height);

      if (left < 0) left = 0;
      if (top < 0) top = 0;
      if (left + w > imgW) w = imgW - left;
      if (top + h > imgH) h = imgH - top;

      let sumR = 0, sumG = 0, sumB = 0;
      let goldPixels = 0;
      const numPixels = w * h || 1;

      for (let r = 0; r < h; r++) {
        const rowOffset = (top + r) * imgW * 4;
        for (let c = 0; c < w; c++) {
            const offset = rowOffset + (left + c) * 4;
            const red = rawImage[offset];
            const green = rawImage[offset + 1];
            const blue = rawImage[offset + 2];
            sumR += red;
            sumG += green;
            sumB += blue;
            if (this.isAscensionGold(red, green, blue)) {
              goldPixels++;
            }
        }
      }

      const avgColor = {
        r: sumR / numPixels,
        g: sumG / numPixels,
        b: sumB / numPixels
      };

      const { h: hue, s, l } = this.rgbToHsl(avgColor.r, avgColor.g, avgColor.b);

      const goldRatio = goldPixels / numPixels;
      const isGold = ((hue >= 25 && hue <= 65) && (s > 0.20) && (l > 0.20)) || goldRatio > 0.14;
      const digitResult = isGold && cell.stars === 7
        ? this.detectAscensionDigitLevel(rawImage, imgW, left, top, w, h)
        : undefined;
      const ascensionLevel = isGold ? (digitResult?.level ?? 1) : 0;

      cell.debugInfo = {
        ...cell.debugInfo,
        ascensionColor: avgColor,
        ascensionHsl: { h: hue.toFixed(0), s: s.toFixed(2), l: l.toFixed(2) },
        ascensionGoldRatio: goldRatio.toFixed(3),
        ascensionDigit: digitResult?.digit,
        ascensionDigitScore: digitResult?.score?.toFixed(2),
        detectedAscensionLevel: ascensionLevel
      };

      return { isAscended: isGold, ascensionLevel };

    } catch (err) {
      return { isAscended: false, ascensionLevel: 0 };
    }
  }

  private detectAscensionDigitLevel(
    rawImage: Buffer,
    imgW: number,
    left: number,
    top: number,
    w: number,
    h: number
  ): { level: number; digit: string; score: number } | undefined {
    if (this.looksLikeAscensionLevelTwo(rawImage, imgW, left, top, w, h)) {
      return { level: 2, digit: "2", score: 1 };
    }

    const medalWidth = Math.max(1, Math.floor(w * 0.68));
    const mask: boolean[][] = Array.from({ length: h }, () => Array(medalWidth).fill(false));

    for (let y = 0; y < h; y++) {
      const rowOffset = (top + y) * imgW * 4;
      for (let x = 0; x < medalWidth; x++) {
        const offset = rowOffset + (left + x) * 4;
        mask[y][x] = this.isAscensionDigitPixel(
          rawImage[offset],
          rawImage[offset + 1],
          rawImage[offset + 2]
        );
      }
    }

    const component = this.findLargestDigitComponent(mask, medalWidth, h);
    if (!component || component.points.length < 8) {
      return undefined;
    }

    const digitWidth = component.maxX - component.minX + 1;
    const digitHeight = component.maxY - component.minY + 1;
    if (digitHeight <= 0) {
      return undefined;
    }

    // The in-game "1" is a narrow vertical glyph; this shortcut avoids
    // over-fitting template matching to anti-aliased variants of the badge.
    if (digitWidth / digitHeight < 0.58) {
      return { level: 1, digit: "1", score: 1 };
    }

    const normalized = this.normalizeDigitComponent(component, 5, 7);
    const match = this.matchDigitTemplate(normalized);
    if (!match || match.score < 0.45) {
      return undefined;
    }

    return { level: match.level, digit: String(match.level), score: match.score };
  }

  private looksLikeAscensionLevelTwo(
    rawImage: Buffer,
    imgW: number,
    left: number,
    top: number,
    w: number,
    h: number
  ): boolean {
    const mask: boolean[][] = Array.from({ length: h }, () => Array(w).fill(false));
    const minDigitX = Math.max(0, Math.floor(w * 0.18));
    const maxDigitX = Math.min(w - 1, Math.floor(w * 0.72));

    for (let y = 0; y < h; y++) {
      const rowOffset = (top + y) * imgW * 4;
      for (let x = minDigitX; x <= maxDigitX; x++) {
        const offset = rowOffset + (left + x) * 4;
        mask[y][x] = this.isLooseAscensionDigitPixel(
          rawImage[offset],
          rawImage[offset + 1],
          rawImage[offset + 2]
        );
      }
    }

    const components = this.findDigitComponents(mask, w, h);
    const horizontalRunStats = this.getAscensionDigitHorizontalRunStats(mask, w, h);
    if (horizontalRunStats.total >= 4) {
      return true;
    }

    const hasCenteredOneStem = components.some((component) => {
      const componentWidth = component.maxX - component.minX + 1;
      const componentHeight = component.maxY - component.minY + 1;
      return (
        componentWidth <= 3 &&
        componentHeight >= Math.max(6, Math.round(h * 0.25)) &&
        component.minX >= Math.floor(w * 0.4) &&
        component.maxX <= Math.ceil(w * 0.72) &&
        component.minY >= Math.floor(h * 0.34) &&
        component.minY <= Math.ceil(h * 0.5)
      );
    });
    if (hasCenteredOneStem) {
      return false;
    }

    if (horizontalRunStats.total >= 3 || horizontalRunStats.lower >= 2) {
      return true;
    }

    return components.some((component) => {
      const componentWidth = component.maxX - component.minX + 1;
      const componentHeight = component.maxY - component.minY + 1;
      return (
        component.points.length >= 20 &&
        componentWidth >= Math.max(10, Math.round(w * 0.35)) &&
        componentHeight >= 4 &&
        component.minY <= Math.floor(h * 0.25) &&
        component.maxY <= Math.ceil(h * 0.4)
      );
    });
  }

  private getAscensionDigitHorizontalRunStats(mask: boolean[][], w: number, h: number): { total: number; lower: number } {
    let rowsWithRuns = 0;
    let lowerRowsWithRuns = 0;
    const minY = Math.floor(h * 0.25);
    const maxY = Math.ceil(h * 0.82);
    const lowerMinY = Math.floor(h * 0.62);
    const minX = Math.floor(w * 0.15);
    const maxX = Math.floor(w * 0.78);

    for (let y = minY; y < maxY; y++) {
      let currentRun = 0;
      let rowMaxRun = 0;

      for (let x = minX; x <= maxX; x++) {
        if (mask[y]?.[x]) {
          currentRun++;
          rowMaxRun = Math.max(rowMaxRun, currentRun);
        } else {
          currentRun = 0;
        }
      }

      if (rowMaxRun >= 4) {
        rowsWithRuns++;
        if (y >= lowerMinY) {
          lowerRowsWithRuns++;
        }
      }
    }

    return { total: rowsWithRuns, lower: lowerRowsWithRuns };
  }

  private findLargestDigitComponent(
    mask: boolean[][],
    width: number,
    height: number
  ): { points: Array<[number, number]>; minX: number; minY: number; maxX: number; maxY: number } | undefined {
    return this.findDigitComponents(mask, width, height)[0];
  }

  private findDigitComponents(
    mask: boolean[][],
    width: number,
    height: number
  ): Array<{ points: Array<[number, number]>; minX: number; minY: number; maxX: number; maxY: number }> {
    const seen = Array.from({ length: height }, () => Array(width).fill(false));
    const components: Array<{ points: Array<[number, number]>; minX: number; minY: number; maxX: number; maxY: number }> = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!mask[y][x] || seen[y][x]) continue;

        const stack: Array<[number, number]> = [[x, y]];
        const points: Array<[number, number]> = [];
        let minX = x;
        let maxX = x;
        let minY = y;
        let maxY = y;
        seen[y][x] = true;

        while (stack.length > 0) {
          const [px, py] = stack.pop()!;
          points.push([px, py]);
          minX = Math.min(minX, px);
          maxX = Math.max(maxX, px);
          minY = Math.min(minY, py);
          maxY = Math.max(maxY, py);

          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = px + dx;
              const ny = py + dy;
              if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
              if (!mask[ny][nx] || seen[ny][nx]) continue;
              seen[ny][nx] = true;
              stack.push([nx, ny]);
            }
          }
        }

        components.push({ points, minX, minY, maxX, maxY });
      }
    }

    return components.sort((a, b) => b.points.length - a.points.length);
  }

  private normalizeDigitComponent(
    component: { points: Array<[number, number]>; minX: number; minY: number; maxX: number; maxY: number },
    columns: number,
    rows: number
  ): boolean[][] {
    const normalized = Array.from({ length: rows }, () => Array(columns).fill(false));
    const width = Math.max(1, component.maxX - component.minX + 1);
    const height = Math.max(1, component.maxY - component.minY + 1);

    for (const [x, y] of component.points) {
      const col = Math.min(columns - 1, Math.floor(((x - component.minX) / width) * columns));
      const row = Math.min(rows - 1, Math.floor(((y - component.minY) / height) * rows));
      normalized[row][col] = true;
    }

    return normalized;
  }

  private matchDigitTemplate(normalized: boolean[][]): { level: number; score: number } | undefined {
    const templates: Record<number, string[]> = {
      2: [
        "11110",
        "00011",
        "00011",
        "00110",
        "01100",
        "11000",
        "11111",
      ],
      3: [
        "11110",
        "00011",
        "00011",
        "01110",
        "00011",
        "00011",
        "11110",
      ],
      4: [
        "10011",
        "10011",
        "10011",
        "11111",
        "00011",
        "00011",
        "00011",
      ],
      5: [
        "11111",
        "11000",
        "11000",
        "11110",
        "00011",
        "00011",
        "11110",
      ],
    };

    let best: { level: number; score: number } | undefined;
    for (const [levelText, template] of Object.entries(templates)) {
      let intersection = 0;
      let union = 0;

      for (let y = 0; y < normalized.length; y++) {
        for (let x = 0; x < normalized[y].length; x++) {
          const actual = normalized[y][x];
          const expected = template[y]?.[x] === "1";
          if (actual && expected) intersection++;
          if (actual || expected) union++;
        }
      }

      const score = union > 0 ? intersection / union : 0;
      const level = Number(levelText);
      if (!best || score > best.score) {
        best = { level, score };
      }
    }

    return best;
  }

  private isAscensionGold(r: number, g: number, b: number): boolean {
    const { h, s, l } = this.rgbToHsl(r, g, b);
    return h >= 25 && h <= 65 && s > 0.22 && l > 0.20;
  }

  private isAscensionDigitPixel(r: number, g: number, b: number): boolean {
    const { s, l } = this.rgbToHsl(r, g, b);
    const spread = Math.max(r, g, b) - Math.min(r, g, b);
    return l > 0.58 && s < 0.35 && spread < 90;
  }

  private isLooseAscensionDigitPixel(r: number, g: number, b: number): boolean {
    const { s, l } = this.rgbToHsl(r, g, b);
    const spread = Math.max(r, g, b) - Math.min(r, g, b);
    return l > 0.36 && s < 0.55 && spread < 160;
  }

  private rgbToHsl(r: number, g: number, b: number): { h: number, s: number, l: number } {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h: h * 360, s, l };
  }
}
