import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import logger from '../loggerService.js';
import { ChampionClass } from '@prisma/client';
import { CONFIG } from './rosterConfig.js';
import { GridCell } from './types.js';

export class RosterFeatureService {
  private classIcons: Map<ChampionClass, Buffer> = new Map();
  private classHues: Map<ChampionClass, number> = new Map();

  constructor() {
    this.loadClassIcons();
  }

  private async loadClassIcons() {
    let iconsPath = path.join(process.cwd(), 'web', 'public', 'icons');
    
    // Check if we are already in the web directory (Next.js server context)
    if (process.cwd().endsWith('web') || process.cwd().endsWith('web' + path.sep)) {
        const localPath = path.join(process.cwd(), 'public', 'icons');
        try {
            await fs.access(localPath);
            iconsPath = localPath;
        } catch (e) {
            // Fallback to standard path if check fails, or maybe we are in a different 'web' folder?
            // But usually this means we are in CereBro/web, so icons are in ./public/icons
        }
    }

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

  public async identifyClass(rawImage: Buffer, rawOpts: any, cell: GridCell): Promise<ChampionClass | undefined> {
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

  public async identifyStars(rawImage: Buffer, rawOpts: any, cell: GridCell): Promise<number> {
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

  public async identifyAscension(rawImage: Buffer, rawOpts: any, cell: GridCell): Promise<boolean> {
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
      const numPixels = w * h || 1;

      for (let r = 0; r < h; r++) {
        const rowOffset = (top + r) * imgW * 4;
        for (let c = 0; c < w; c++) {
            const offset = rowOffset + (left + c) * 4;
            sumR += rawImage[offset];
            sumG += rawImage[offset + 1];
            sumB += rawImage[offset + 2];
        }
      }

      const avgColor = {
        r: sumR / numPixels,
        g: sumG / numPixels,
        b: sumB / numPixels
      };

      const { h: hue, s, l } = this.rgbToHsl(avgColor.r, avgColor.g, avgColor.b);
      
      const isGold = (hue >= 25 && hue <= 65) && (s > 0.20) && (l > 0.20);
      
      cell.debugInfo = {
        ...cell.debugInfo,
        ascensionColor: avgColor,
        ascensionHsl: { h: hue.toFixed(0), s: s.toFixed(2), l: l.toFixed(2) }
      };

      return isGold;

    } catch (err) {
      return false;
    }
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