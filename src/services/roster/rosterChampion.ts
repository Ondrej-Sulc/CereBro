
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import logger from '../loggerService.js';
import { prisma } from '../prismaService.js';
import { ChampionClass, Champion } from '@prisma/client';
import { downloadImage } from '../../commands/roster/ocr/imageUtils.js';
import { CONFIG } from './rosterConfig.js';
import { GridCell } from './types.js';

export class RosterChampionService {
  private CACHE_DIR = path.join(os.tmpdir(), 'cerebro', 'champion-cache');
  private championCache: Map<string, { champion: Champion; hash: string }> = new Map();
  private classCache: Map<ChampionClass, Champion[]> = new Map();

  constructor() {
    this.ensureCacheDir();
  }

  private async ensureCacheDir() {
    try {
      await fs.mkdir(this.CACHE_DIR, { recursive: true });
    } catch (err) {
      logger.error({ err }, "Failed to create cache directory");
    }
  }

  public async identifyChampion(rawImage: Buffer, rawOpts: any, cell: GridCell): Promise<string | undefined> {
    if (!cell.class) return undefined;

    try {
      const { x, y, width, height } = cell.bounds;
      const imgW = rawOpts.raw.width;
      const imgH = rawOpts.raw.height;

      const left = Math.round(x + (width * CONFIG.PORTRAIT_RATIO.x));
      const top = Math.round(y + (height * CONFIG.PORTRAIT_RATIO.y));
      const w = Math.round(width * CONFIG.PORTRAIT_RATIO.width);
      const h = Math.round(height * CONFIG.PORTRAIT_RATIO.height);

      if (left < 0 || top < 0 || left + w > imgW || top + h > imgH) {
            return undefined;
      }

      // Optimize: Pure JS Hash calculation directly from raw buffer
      // Avoids Sharp overhead entirely for this step.
      const portraitHash = this.computePortraitHashJS(rawImage, imgW, imgH, left, top, w, h);
       
      const candidates = await this.getChampionsByClass(cell.class);

      let bestMatch: string | undefined;
      let minDistance = Infinity;

      for (const candidate of candidates) {
         const distance = this.compareHashes(portraitHash, candidate.hash);
         if (distance < minDistance) {
           minDistance = distance;
           bestMatch = candidate.champion.name; 
         }
      }

      cell.debugInfo = {
         ...cell.debugInfo,
         championMatch: { bestMatch, minDistance },
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

  public async getChampionsByClass(championClass: ChampionClass): Promise<{ champion: Champion; hash: string }[]> {
    let championsInDb = this.classCache.get(championClass);
    
    if (!championsInDb) {
        championsInDb = await prisma.champion.findMany({
            where: { class: championClass }
        });
        this.classCache.set(championClass, championsInDb);
    }

    const toDownload: Champion[] = [];
    const cachedResults: { champion: Champion; hash: string }[] = [];

    for (const champion of championsInDb) {
        const cached = this.championCache.get(champion.name);
        if (cached) {
            cachedResults.push(cached);
        } else {
            toDownload.push(champion);
        }
    }

    if (toDownload.length === 0) return cachedResults;

    const downloadedResults = await Promise.all(toDownload.map(async (champion) => {
        try {
            const images = champion.images as any;
            const imageUrl = images?.p_128 || images?.full_primary;
            
            if (!imageUrl) return null;

            const safeName = champion.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const cacheFilePath = path.join(this.CACHE_DIR, `${safeName}_raw`);

            let fullBuffer: Buffer;

            try {
                fullBuffer = await fs.readFile(cacheFilePath);
            } catch (e) {
                fullBuffer = await downloadImage(imageUrl);
                await fs.writeFile(cacheFilePath, fullBuffer);
            }

            // Must use consistent hashing: Decode to raw -> computePortraitHashJS
            const { data: rawData, info } = await sharp(fullBuffer)
                .ensureAlpha()
                .raw()
                .toBuffer({ resolveWithObject: true });
            
            const w = info.width;
            const h = info.height;
            
            const cropLeft = Math.round(w * CONFIG.REFERENCE_PORTRAIT_CROP.x);
            const cropTop = Math.round(h * CONFIG.REFERENCE_PORTRAIT_CROP.y);
            const cropWidth = Math.round(w * CONFIG.REFERENCE_PORTRAIT_CROP.width);
            const cropHeight = Math.round(h * CONFIG.REFERENCE_PORTRAIT_CROP.height);

            const hash = this.computePortraitHashJS(rawData, w, h, cropLeft, cropTop, cropWidth, cropHeight);
            
            const entry = { champion, hash };
            this.championCache.set(champion.name, entry);
            return entry;
        } catch (err) {
            logger.warn({ err }, `Failed to load image for champion ${champion.name}`);
            return null;
        }
    }));

    const validDownloads = downloadedResults.filter(r => r !== null) as { champion: Champion; hash: string }[];
    return [...cachedResults, ...validDownloads];
  }

  // Optimized Point-Sampling Resize + Grayscale + pHash
  // Replaces Sharp pipeline for extreme speed
  private computePortraitHashJS(
      source: Buffer, 
      imgW: number, 
      imgH: number, 
      cropX: number, 
      cropY: number, 
      cropW: number, 
      cropH: number
  ): string {
      // "Cover" logic: use the largest centered square
      const size = Math.min(cropW, cropH);
      const startX = cropX + Math.floor((cropW - size) / 2);
      const startY = cropY + Math.floor((cropH - size) / 2);
      
      const targetSize = 16;
      const blockSize = size / targetSize; // Float
      
      const values: number[] = new Array(targetSize * targetSize);
      let totalSum = 0;

      for (let y = 0; y < targetSize; y++) {
          for (let x = 0; x < targetSize; x++) {
              // Sample the center pixel of the block (Point Sampling)
              const srcX = Math.floor(startX + (x + 0.5) * blockSize);
              const srcY = Math.floor(startY + (y + 0.5) * blockSize);
              
              // Clamp coords
              const sx = Math.max(0, Math.min(srcX, imgW - 1));
              const sy = Math.max(0, Math.min(srcY, imgH - 1));
              
              const offset = (sy * imgW + sx) * 4;
              const r = source[offset];
              const g = source[offset + 1];
              const b = source[offset + 2];
              
              // Grayscale: (299R + 587G + 114B) / 1000
              const gray = (299 * r + 587 * g + 114 * b) / 1000;
              
              values[y * targetSize + x] = gray;
              totalSum += gray;
          }
      }
      
      const avg = totalSum / (targetSize * targetSize);
      
      let hash = 0n;
      for (let i = 0; i < values.length; i++) {
          if (values[i] >= avg) {
              hash |= 1n;
          }
          if (i < values.length - 1) {
              hash <<= 1n;
          }
      }
      
      return hash.toString(16).padStart(64, "0");
  }

  private compareHashes(hash1: string, hash2: string): number {
    const h1 = BigInt(`0x${hash1}`);
    const h2 = BigInt(`0x${hash2}`);
    let xorResult = h1 ^ h2;
    let distance = 0;
    while (xorResult > 0n) {
      if (xorResult & 1n) distance++;
      xorResult >>= 1n;
    }
    return distance;
  }
}
