import sharp from 'sharp';
import { getGoogleVisionService } from './googleVisionService.js';
import { prisma } from './prismaService.js';
import logger from './loggerService.js';
import path from 'path';
import fs from 'fs/promises';
import { ChampionClass, Champion } from '@prisma/client';
import { getImageHash, compareHashes, downloadImage } from '../commands/roster/ocr/imageUtils.js';

// Types
export interface GridCell {
  bounds: { x: number; y: number; width: number; height: number };
  piBounds?: { x: number; y: number; width: number; height: number };
  rank?: number;
  sigLevel?: number;
  stars?: number;
  isAscended?: boolean;
  powerRating?: number;
  class?: ChampionClass;
  championName?: string;
  debugInfo?: {
    classMatch?: { bestMatch?: string; minRMSE?: number };
    championMatch?: { bestMatch?: string; minDistance?: number };
    starColor?: { r: number; g: number; b: number };
    hsl?: { h: number; s: number; l: number };
    brightness?: number;
    bestMatchBuffer?: Buffer;
  };
}

interface ProcessingOptions {
  debugMode?: boolean;
}

// Configuration Constants (Relative Ratios)
const CONFIG = {
  MIN_PI_VALUE: 300,
  
  // Grid Structure Ratios (relative to avgColDist)
  CELL_WIDTH_RATIO: 0.93,
  CELL_HEIGHT_RATIO: 1.16,
  
  // Anchor Offsets (relative to avgColDist)
  PI_OFFSET_X_RATIO: 0.20, 
  PI_OFFSET_Y_RATIO: 0.065,

  // Crop Regions (relative to Cell Width/Height)
  CLASS_ICON_RATIO: {
    x: 0.04,    
    y: 0.82,    
    width: 0.18, 
    height: 0.14 
  },

  ASCENSION_ICON_RATIO: {
    x: 0.78,    
    y: 0.84,    
    width: 0.16, 
    height: 0.10
  },

  PORTRAIT_RATIO: {
    x: 0.28,   
    y: 0.18,   
    width: 0.44, 
    height: 0.4 
  },

  // Region to sample for Star Level detection (Star Row)
  STARS_CHECK_RATIO: {
    x: 0.02,
    y: 0.64, 
    width: 0.96,
    height: 0.05
  },

  // Crop to apply to the reference champion image (p_128)
  REFERENCE_PORTRAIT_CROP: {
    x: 0.265,    
    y: 0.15,    
    width: 0.47,
    height: 0.65
  },

  // Recognition Thresholds
  CLASS_RMSE_THRESHOLD: 80, 
  CHAMPION_MATCH_THRESHOLD: 20,
};

export class RosterImageService {
  private classIcons: Map<ChampionClass, Buffer> = new Map();
  // Cache promise to deduplicate in-flight requests
  private championCachePromises: Map<string, Promise<{ champion: Champion; hash: string; buffer: Buffer }>> = new Map();
  private championCache: Map<string, { champion: Champion; hash: string; buffer: Buffer }> = new Map();
  
  // Use a subdirectory in temp for persistent cache (adjust path as needed for production)
  private CACHE_DIR = path.join(process.cwd(), 'temp', 'champion-cache');

  constructor() {
    this.loadClassIcons();
    this.ensureCacheDir();
  }

  private async ensureCacheDir() {
    try {
      await fs.mkdir(this.CACHE_DIR, { recursive: true });
    } catch (err) {
      logger.error({ err }, "Failed to create cache directory");
    }
  }

  private async loadClassIcons() {
    const iconsPath = path.join(process.cwd(), 'web', 'public', 'icons');
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

  public async processStatsView(
    imageBuffer: Buffer,
    options: ProcessingOptions = {}
  ): Promise<{ grid: GridCell[]; debugImage?: Buffer }> {
    const visionService = await getGoogleVisionService();
    const detections = await visionService.detectText(imageBuffer);
    
    if (!detections || detections.length === 0) {
      throw new Error("No text detected in image");
    }

    // 1. Estimate Grid
    const { grid, avgColDist, cellDims } = await this.estimateGridFromStats(detections, imageBuffer);

    // Optimize: Decode image to raw buffer ONCE for all subsequent operations
    const { data: rawImage, info } = await sharp(imageBuffer)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    
    const rawImageOpts = { 
        raw: { 
            width: info.width, 
            height: info.height, 
            channels: 4 
        } 
    };

    // 2. Process Cells concurrently (Class & Stars)
    // We do this first to gather all detected classes for bulk champion fetching
    await Promise.all(grid.map(async (cell) => {
        // Identify Class
        cell.class = await this.identifyClass(rawImage, rawImageOpts, cell);
        // Identify Stars
        cell.stars = await this.identifyStars(rawImage, rawImageOpts, cell);
        // Identify Ascension
        cell.isAscended = await this.identifyAscension(rawImage, rawImageOpts, cell);
    }));

    // 3. Pre-fetch Champions for detected classes
    const detectedClasses = new Set(grid.map(c => c.class).filter(c => c !== undefined));
    await Promise.all(Array.from(detectedClasses).map(c => this.getChampionsByClass(c!)));

    // 4. Identify Champions concurrently
    await Promise.all(grid.map(async (cell) => {
        if (cell.class) {
            cell.championName = await this.identifyChampion(rawImage, rawImageOpts, cell);
        }
    }));

    let debugImage: Buffer | undefined;
    if (options.debugMode) {
      debugImage = await this.drawDebugImage(imageBuffer, grid, cellDims);
    }

    return { grid, debugImage };
  }

  private async estimateGridFromStats(detections: any[], imageBuffer: Buffer): Promise<{ grid: GridCell[], avgColDist: number, cellDims: {width: number, height: number} }> {
    const cells: GridCell[] = [];
    
    const metadata = await sharp(imageBuffer).metadata();
    const imageWidth = metadata.width || 1000;
    const imageHeight = metadata.height || 1000;

    const piCandidates = detections.slice(1).filter((text) => {
      const cleanText = text.description?.replace(/[^\d]/g, '');
      const value = parseInt(cleanText || '0', 10);
      return value > CONFIG.MIN_PI_VALUE;
    });

    logger.info({ candidateCount: piCandidates.length }, "PI Candidates Found");

    if (piCandidates.length === 0) {
      throw new Error("No Power Ratings found to anchor grid.");
    }

    const positions = piCandidates.map((pi: any) => {
        const vertices = pi.boundingPoly.vertices;
        const width = vertices[2].x - vertices[0].x;
        const height = vertices[2].y - vertices[0].y;
        
        let x = vertices[0].x;
        const text = pi.description || '';
        const firstDigitIndex = text.search(/\d/);

        // Heuristic: If text starts with non-digits (e.g. icon detected as "T12345"), 
        // shift the x-anchor rightwards.
        if (firstDigitIndex > 0 && text.length > 0) {
             // The prefix is likely the Class Icon which is roughly square and height-proportional
             // plus a small gap. We use height as a proxy for the icon width.
             x += (height * 1.15); 
        }

        return {
            x: x, 
            y: vertices[2].y, 
            pi
        };
    });

    const sortedX = [...positions].sort((a, b) => a.x - b.x);
    const uniqueCols: number[] = [];
    if (sortedX.length > 0) {
        uniqueCols.push(sortedX[0].x);
        for (let i = 1; i < sortedX.length; i++) {
            if (sortedX[i].x > uniqueCols[uniqueCols.length - 1] + 50) { 
                uniqueCols.push(sortedX[i].x);
            }
        }
    }

    let avgColDist = 0;
    if (uniqueCols.length > 1) {
        avgColDist = (uniqueCols[uniqueCols.length - 1] - uniqueCols[0]) / (uniqueCols.length - 1);
    } else {
        avgColDist = imageWidth / 7; 
    }

    const cellWidth = avgColDist * CONFIG.CELL_WIDTH_RATIO;
    const cellHeight = avgColDist * CONFIG.CELL_HEIGHT_RATIO;
    const cellDims = { width: cellWidth, height: cellHeight };

    for (const pos of positions) {
      const powerRating = parseInt(pos.pi.description?.replace(/[^\d]/g, '') || '0', 10);
      const cellX = pos.x - (avgColDist * CONFIG.PI_OFFSET_X_RATIO);
      const cellY = pos.y - cellHeight + (cellHeight * CONFIG.PI_OFFSET_Y_RATIO);

      const cellBounds = {
          x: cellX,
          y: cellY,
          width: cellWidth,
          height: cellHeight
      };

      let rank: number | undefined;
      let sigLevel: number | undefined;

      const candidateDetections = detections.filter(d => {
          if (!d.description) return false;
          const v = d.boundingPoly.vertices;
          const textCenterX = (v[0].x + v[2].x) / 2;
          const textBottomY = v[2].y;
          
          const isAligned = Math.abs(textCenterX - pos.x) < (cellWidth * 0.6);
          const isAbove = textBottomY < pos.y && textBottomY > (cellY + cellHeight * 0.2);
          return isAligned && isAbove;
      });

      const combinedText = candidateDetections.map(d => d.description).join(' ');
      
      const rankMatch = combinedText.match(/Rank\s*(\d+)/i);
      const sigMatch = combinedText.match(/Sig[.\s]*(\d+)/i);

      if (rankMatch) rank = parseInt(rankMatch[1], 10);
      if (sigMatch) sigLevel = parseInt(sigMatch[1], 10);

      const v = pos.pi.boundingPoly.vertices;
      const piW = v[2].x - v[0].x;
      const piH = v[2].y - v[0].y;

      cells.push({
        bounds: cellBounds,
        piBounds: { x: v[0].x, y: v[0].y, width: piW, height: piH },
        powerRating: powerRating,
        rank,
        sigLevel
      });
    }

    cells.sort((a, b) => {
      if (Math.abs(a.bounds.y - b.bounds.y) > cellHeight / 2) {
        return a.bounds.y - b.bounds.y;
      }
      return a.bounds.x - b.bounds.x;
    });

    return { grid: cells, avgColDist, cellDims };
  }

  private async identifyClass(rawImage: Buffer, rawOpts: any, cell: GridCell): Promise<ChampionClass | undefined> {
    try {
      const { x, y, width, height } = cell.bounds;

      const cropRegion = {
        left: Math.round(x + (width * CONFIG.CLASS_ICON_RATIO.x)),
        top: Math.round(y + (height * CONFIG.CLASS_ICON_RATIO.y)),
        width: Math.round(width * CONFIG.CLASS_ICON_RATIO.width),
        height: Math.round(height * CONFIG.CLASS_ICON_RATIO.height)
      };
      
      const imgW = rawOpts.raw.width;
      const imgH = rawOpts.raw.height;

      if (cropRegion.left < 0 || cropRegion.top < 0 || 
          cropRegion.left + cropRegion.width > imgW || 
          cropRegion.top + cropRegion.height > imgH) {
            return undefined;
      }

      const croppedIcon = await sharp(rawImage, rawOpts)
        .extract(cropRegion)
        .resize(32, 32, { fit: 'fill' }) 
        .ensureAlpha()
        .raw()
        .toBuffer();

      let bestMatch: ChampionClass | undefined;
      let minRMSE = Infinity;

      for (const [className, refBuffer] of this.classIcons.entries()) {
        const rmse = this.calculateRMSE(croppedIcon, refBuffer);
        if (rmse < minRMSE) {
          minRMSE = rmse;
          bestMatch = className;
        }
      }

      cell.debugInfo = {
        ...cell.debugInfo,
        classMatch: { bestMatch, minRMSE }
      };

      if (minRMSE <= CONFIG.CLASS_RMSE_THRESHOLD) {
        return bestMatch;
      }
      
      return undefined;
    } catch (err) {
      logger.error({ err }, "Error identifying class");
      return undefined;
    }
  }

  private calculateRMSE(buf1: Buffer, buf2: Buffer): number {
    if (buf1.length !== buf2.length) return Infinity;
    
    let sumSquares = 0;
    for (let i = 0; i < buf1.length; i += 4) {
        const rDiff = buf1[i] - buf2[i];
        const gDiff = buf1[i+1] - buf2[i+1];
        const bDiff = buf1[i+2] - buf2[i+2];
        sumSquares += (rDiff * rDiff) + (gDiff * gDiff) + (bDiff * bDiff);
    }
    
    const numPixels = buf1.length / 4;
    return Math.sqrt(sumSquares / (numPixels * 3));
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

  private async identifyStars(rawImage: Buffer, rawOpts: any, cell: GridCell): Promise<number> {
    try {
      const { x, y, width, height } = cell.bounds;
      const cropRegion = {
        left: Math.round(x + (width * CONFIG.STARS_CHECK_RATIO.x)),
        top: Math.round(y + (height * CONFIG.STARS_CHECK_RATIO.y)),
        width: Math.round(width * CONFIG.STARS_CHECK_RATIO.width),
        height: Math.round(height * CONFIG.STARS_CHECK_RATIO.height)
      };

      // Boundary check
      if (cropRegion.left < 0) cropRegion.left = 0;
      if (cropRegion.top < 0) cropRegion.top = 0;
      if (cropRegion.left + cropRegion.width > rawOpts.raw.width) {
          cropRegion.width = rawOpts.raw.width - cropRegion.left;
      }
      if (cropRegion.top + cropRegion.height > rawOpts.raw.height) {
          cropRegion.height = rawOpts.raw.height - cropRegion.top;
      }

      // Extract and convert to grayscale raw buffer
      const starStrip = await sharp(rawImage, rawOpts)
          .extract(cropRegion)
          .grayscale()
          .raw()
          .toBuffer();

      // Analyze the strip to find the width of the "bright" content
      let minX = cropRegion.width;
      let maxX = 0;
      let hasBrightPixels = false;
      const threshold = 120; // Luminance threshold for stars

      for (let r = 0; r < cropRegion.height; r++) {
          for (let c = 0; c < cropRegion.width; c++) {
              const val = starStrip[r * cropRegion.width + c];
              if (val > threshold) {
                  if (c < minX) minX = c;
                  if (c > maxX) maxX = c;
                  hasBrightPixels = true;
              }
          }
      }

      let starWidthRatio = 0;
      if (hasBrightPixels) {
          const contentWidth = maxX - minX;
          // Normalize against the cell width (approx) or the crop width
          // cropRegion.width is ~96% of cell width.
          starWidthRatio = contentWidth / cropRegion.width;
      }

      cell.debugInfo = {
        ...cell.debugInfo,
        // @ts-ignore
        starWidthRatio: starWidthRatio.toFixed(3),
        // @ts-ignore
        starContentWidth: (maxX - minX)
      };

      // Heuristic mapping (calibration needed)
      // 7 stars: fills almost 100% of the row
      // 6 stars: fills ~85%?
      // 5 stars: fills ~70%?
      
      if (starWidthRatio > 0.90) return 7;
      if (starWidthRatio > 0.75) return 6;
      if (starWidthRatio > 0.60) return 5;
      if (starWidthRatio > 0.45) return 4;
      if (starWidthRatio > 0.30) return 3;
      if (starWidthRatio > 0.15) return 2;
      
      return 1; // Fallback
    } catch (err) {
      logger.error({ err }, "Error identifying stars");
      return 6; // Default
    }
  }

  private async identifyAscension(rawImage: Buffer, rawOpts: any, cell: GridCell): Promise<boolean> {
    try {
      const { x, y, width, height } = cell.bounds;
      const cropRegion = {
        left: Math.round(x + (width * CONFIG.ASCENSION_ICON_RATIO.x)),
        top: Math.round(y + (height * CONFIG.ASCENSION_ICON_RATIO.y)),
        width: Math.round(width * CONFIG.ASCENSION_ICON_RATIO.width),
        height: Math.round(height * CONFIG.ASCENSION_ICON_RATIO.height)
      };

      // Boundary check
      if (cropRegion.left < 0) cropRegion.left = 0;
      if (cropRegion.top < 0) cropRegion.top = 0;
      if (cropRegion.left + cropRegion.width > rawOpts.raw.width) {
          cropRegion.width = rawOpts.raw.width - cropRegion.left;
      }
      if (cropRegion.top + cropRegion.height > rawOpts.raw.height) {
          cropRegion.height = rawOpts.raw.height - cropRegion.top;
      }

      const cropBuffer = await sharp(rawImage, rawOpts)
          .extract(cropRegion)
          .raw()
          .toBuffer();

      let sumR = 0, sumG = 0, sumB = 0;
      for (let i = 0; i < cropBuffer.length; i += 4) {
          sumR += cropBuffer[i];
          sumG += cropBuffer[i+1];
          sumB += cropBuffer[i+2];
      }
      const numPixels = cropBuffer.length / 4 || 1;
      const avgColor = {
        r: sumR / numPixels,
        g: sumG / numPixels,
        b: sumB / numPixels
      };

      const { h, s, l } = this.rgbToHsl(avgColor.r, avgColor.g, avgColor.b);

      // Gold color definition:
      // Hue: Yellow/Orange is around 30-50 degrees. 
      // Saturation: Should be significant (grey bg is < 10%).
      // Lightness: Gold is bright.
      
      const isGold = (h >= 25 && h <= 65) && (s > 0.20) && (l > 0.20);
      
      cell.debugInfo = {
        ...cell.debugInfo,
        // @ts-ignore
        ascensionColor: avgColor,
        // @ts-ignore
        ascensionHsl: { h: h.toFixed(0), s: s.toFixed(2), l: l.toFixed(2) }
      };

      return isGold;

    } catch (err) {
      return false;
    }
  }

  private async identifyChampion(rawImage: Buffer, rawOpts: any, cell: GridCell): Promise<string | undefined> {
    if (!cell.class) return undefined;

    try {
      const { x, y, width, height } = cell.bounds;

      const cropRegion = {
        left: Math.round(x + (width * CONFIG.PORTRAIT_RATIO.x)),
        top: Math.round(y + (height * CONFIG.PORTRAIT_RATIO.y)),
        width: Math.round(width * CONFIG.PORTRAIT_RATIO.width),
        height: Math.round(height * CONFIG.PORTRAIT_RATIO.height)
      };

       if (cropRegion.left < 0 || cropRegion.top < 0 || 
           cropRegion.left + cropRegion.width > rawOpts.raw.width || 
           cropRegion.top + cropRegion.height > rawOpts.raw.height) {
             return undefined;
       }

       const croppedPortrait = await sharp(rawImage, rawOpts)
         .extract(cropRegion)
         .resize(128, 128)
         .png() // Force PNG encoding so getImageHash can sniff the format
         .toBuffer();
       
       const portraitHash = await getImageHash(croppedPortrait);
       const candidates = await this.getChampionsByClass(cell.class);

       let bestMatch: string | undefined;
       let minDistance = Infinity;
       let bestMatchBuffer: Buffer | undefined;

       for (const candidate of candidates) {
         const distance = compareHashes(portraitHash, candidate.hash);
         if (distance < minDistance) {
           minDistance = distance;
           bestMatch = candidate.champion.name; 
           bestMatchBuffer = candidate.buffer;
         }
       }

       cell.debugInfo = {
         ...cell.debugInfo,
         championMatch: { bestMatch, minDistance },
         bestMatchBuffer
       };

       if (minDistance <= CONFIG.CHAMPION_MATCH_THRESHOLD) {
         return bestMatch;
       }

       return undefined;

    } catch (err) {
      logger.error({ err }, "Error identifying champion");
      return undefined;
    }
  }

  private async getChampionsByClass(championClass: ChampionClass): Promise<{ champion: Champion; hash: string; buffer: Buffer }[]> {
    const championsInDb = await prisma.champion.findMany({
      where: { class: championClass }
    });

    // 1. Identify which champions are not in cache
    const toDownload: Champion[] = [];
    const cachedResults: { champion: Champion; hash: string; buffer: Buffer }[] = [];

    for (const champion of championsInDb) {
        const cached = this.championCache.get(champion.name);
        if (cached) {
            cachedResults.push(cached);
        } else {
            toDownload.push(champion);
        }
    }

    if (toDownload.length === 0) return cachedResults;

    // 2. Download concurrently
    const downloadedResults = await Promise.all(toDownload.map(async (champion) => {
        try {
            const images = champion.images as any;
            const imageUrl = images?.p_128 || images?.full_primary;
            
            if (!imageUrl) return null;

            // Sanitize champion name for filename
            const safeName = champion.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            // Cache the RAW full image, so we can re-crop it if constants change
            const cacheFilePath = path.join(this.CACHE_DIR, `${safeName}_raw`);

            let fullBuffer: Buffer;

            // 1. Check Filesystem Cache for RAW image
            try {
                fullBuffer = await fs.readFile(cacheFilePath);
            } catch (e) {
                // 2. Download if not found
                fullBuffer = await downloadImage(imageUrl);
                // Save RAW image to cache
                await fs.writeFile(cacheFilePath, fullBuffer);
            }

            // 3. Process (Crop & Resize) on every run using current CONFIG
            const metadata = await sharp(fullBuffer).metadata();
            const w = metadata.width || 0;
            const h = metadata.height || 0;
            
            const cropRegion = {
                left: Math.round(w * CONFIG.REFERENCE_PORTRAIT_CROP.x),
                top: Math.round(h * CONFIG.REFERENCE_PORTRAIT_CROP.y),
                width: Math.round(w * CONFIG.REFERENCE_PORTRAIT_CROP.width),
                height: Math.round(h * CONFIG.REFERENCE_PORTRAIT_CROP.height)
            };

            const processedBuffer = await sharp(fullBuffer)
                .extract(cropRegion)
                .resize(128, 128)
                .png() // Ensure valid format for hashing
                .toBuffer();

            const hash = await getImageHash(processedBuffer);
            const entry = { champion, hash, buffer: processedBuffer };
            
            this.championCache.set(champion.name, entry);
            return entry;
        } catch (err) {
            logger.warn({ err }, `Failed to load image for champion ${champion.name}`);
            return null;
        }
    }));

    // Filter nulls and combine
    const validDownloads = downloadedResults.filter(r => r !== null) as { champion: Champion; hash: string; buffer: Buffer }[];
    return [...cachedResults, ...validDownloads];
  }

  public async drawDebugImage(imageBuffer: Buffer, grid: GridCell[], cellDims: {width: number, height: number}): Promise<Buffer> {
    const overlayElements: sharp.OverlayOptions[] = [];

    for (const cell of grid) {
      const { x, y, width, height } = cell.bounds;

      // 1. Cell Bounds (Lime)
      const cellRect = `<svg width="${width}" height="${height}"><rect x="0" y="0" width="${width}" height="${height}" stroke="lime" stroke-width="4" fill="none" /></svg>`;
      overlayElements.push({
        input: Buffer.from(cellRect),
        left: Math.round(x),
        top: Math.round(y),
      });

      // 2. Class Icon Crop (Blue)
      const cx = x + (width * CONFIG.CLASS_ICON_RATIO.x);
      const cy = y + (height * CONFIG.CLASS_ICON_RATIO.y);
      const cw = width * CONFIG.CLASS_ICON_RATIO.width;
      const ch = height * CONFIG.CLASS_ICON_RATIO.height;
      
      const classRect = `<svg width="${cw}" height="${ch}"><rect x="0" y="0" width="${cw}" height="${ch}" stroke="blue" stroke-width="2" fill="none" /></svg>`;
      overlayElements.push({
        input: Buffer.from(classRect),
        left: Math.round(cx),
        top: Math.round(cy),
      });

      // 3. Portrait Crop (Yellow)
      const px = x + (width * CONFIG.PORTRAIT_RATIO.x);
      const py = y + (height * CONFIG.PORTRAIT_RATIO.y);
      const pw = width * CONFIG.PORTRAIT_RATIO.width;
      const ph = height * CONFIG.PORTRAIT_RATIO.height;

      const portRect = `<svg width="${pw}" height="${ph}"><rect x="0" y="0" width="${pw}" height="${ph}" stroke="yellow" stroke-width="2" fill="none" /></svg>`;
      overlayElements.push({
        input: Buffer.from(portRect),
        left: Math.round(px),
        top: Math.round(py),
      });

      // 3b. Star Crop (Cyan)
      const sx = x + (width * CONFIG.STARS_CHECK_RATIO.x);
      const sy = y + (height * CONFIG.STARS_CHECK_RATIO.y);
      const sw = width * CONFIG.STARS_CHECK_RATIO.width;
      const sh = height * CONFIG.STARS_CHECK_RATIO.height;
      const starRect = `<svg width="${sw}" height="${sh}"><rect x="0" y="0" width="${sw}" height="${sh}" stroke="cyan" stroke-width="2" fill="none" /></svg>`;
      overlayElements.push({
        input: Buffer.from(starRect),
        left: Math.round(sx),
        top: Math.round(sy),
      });

      // 3c. Ascension Crop (Orange)
      const ax = x + (width * CONFIG.ASCENSION_ICON_RATIO.x);
      const ay = y + (height * CONFIG.ASCENSION_ICON_RATIO.y);
      const aw = width * CONFIG.ASCENSION_ICON_RATIO.width;
      const ah = height * CONFIG.ASCENSION_ICON_RATIO.height;
      const ascRect = `<svg width="${aw}" height="${ah}"><rect x="0" y="0" width="${aw}" height="${ah}" stroke="orange" stroke-width="2" fill="none" /></svg>`;
      overlayElements.push({
        input: Buffer.from(ascRect),
        left: Math.round(ax),
        top: Math.round(ay),
      });

      // 4. Text Label
      if (cell.championName || cell.class || cell.rank !== undefined) {
        const rankSig = cell.rank !== undefined ? `R${cell.rank} S${cell.sigLevel || 0}` : '';
        const starStr = cell.stars ? `${cell.stars}*` : '';
        const ascStr = cell.isAscended ? '(ASC)' : '';
        // @ts-ignore
        const starRatio = cell.debugInfo?.starWidthRatio || '';
        // @ts-ignore
        const ascHsl = cell.debugInfo?.ascensionHsl ? `H:${cell.debugInfo.ascensionHsl.h} S:${cell.debugInfo.ascensionHsl.s}` : '';
        
        const line1 = `${cell.championName || '?'}`;
        const line2 = `${starStr} ${rankSig} ${ascStr} [${starRatio}] ${ascHsl}`;

        const svgText = `
          <svg width="${width}" height="50">
            <rect x="0" y="0" width="${width}" height="50" fill="black" fill-opacity="0.6" />
            <text x="5" y="20" font-family="Arial" font-size="16" fill="white" font-weight="bold">${line1}</text>
            <text x="5" y="40" font-family="Arial" font-size="14" fill="#dddddd">${line2}</text>
          </svg>`;
        overlayElements.push({
          input: Buffer.from(svgText),
          left: Math.round(x),
          top: Math.round(y + height/4),
        });

        // Get class icon for overlay if it exists
        if (cell.class && this.classIcons.has(cell.class)) {
            const classIconBuffer = await sharp(this.classIcons.get(cell.class)!, {
                raw: { width: 32, height: 32, channels: 4 }
            })
                .resize(32, 32)
                .png()
                .toBuffer();
            
            overlayElements.push({
                input: classIconBuffer,
                left: Math.round(x + 5),
                top: Math.round(y + 5)
            });
        }
      }

      // 5. Best Match Reference Image (Top Right)
      if (cell.debugInfo?.bestMatchBuffer) {
          // Resize to small thumbnail (e.g. 40x40) to fit in corner
          const thumbnail = await sharp(cell.debugInfo.bestMatchBuffer)
            .resize(40, 40)
            .toBuffer();
            
          overlayElements.push({
              input: thumbnail,
              left: Math.round(x + width - 45), // Top right corner with 5px padding
              top: Math.round(y + 5)
          });
      }

      // 6. PI Bounds (Magenta)
      if (cell.piBounds) {
        const { x: px, y: py, width: pw, height: ph } = cell.piBounds;
        const piRect = `<svg width="${pw}" height="${ph}"><rect x="0" y="0" width="${pw}" height="${ph}" stroke="magenta" stroke-width="2" fill="none" /></svg>`;
        overlayElements.push({
            input: Buffer.from(piRect),
            left: Math.round(px),
            top: Math.round(py),
        });
      }
    }

    if (overlayElements.length === 0) return imageBuffer;
    return sharp(imageBuffer).composite(overlayElements).toBuffer();
  }
}

export const rosterImageService = new RosterImageService();