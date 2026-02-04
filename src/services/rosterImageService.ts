import sharp from 'sharp';
import { getGoogleVisionService } from './googleVisionService.js';
import { RosterLayoutService } from './roster/rosterLayout.js';
import { RosterFeatureService } from './roster/rosterFeatures.js';
import { RosterChampionService } from './roster/rosterChampion.js';
import { RosterDebugService } from './roster/rosterDebug.js';
import { GridCell } from './roster/types.js';
import { getMinPrestigeThresholds } from './championService.js';
import logger from './loggerService.js';
import { performance } from 'perf_hooks';

export * from './roster/types.js';

interface ProcessingOptions {
  debugMode?: boolean;
}

export class RosterImageService {
  private layoutService = new RosterLayoutService();
  private featureService = new RosterFeatureService();
  private championService = new RosterChampionService();
  private debugService = new RosterDebugService(this.featureService);

  public async processBGView(
    imageBuffer: Buffer,
    options: ProcessingOptions = {}
  ): Promise<{ grid: GridCell[]; debugImage?: Buffer }> {
    const t0 = performance.now();

    const visionService = await getGoogleVisionService();
    const detections = await visionService.detectText(imageBuffer);
    
    const t1 = performance.now(); // OCR done

    if (!detections || detections.length === 0) {
      throw new Error("No text detected in image");
    }

    // 1. Estimate Grid
    let { grid, avgColDist, cellDims, headerMinY } = await this.layoutService.estimateGridFromBG(detections, imageBuffer);
    
    const t2 = performance.now(); // Layout done

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

    const t3 = performance.now(); // Image Decode done

    // 2. Process Cells concurrently (Class & Stars)
    // We do this first to gather all detected classes for bulk champion fetching
    await Promise.all(grid.map(async (cell) => {
        // Identify Class
        cell.class = await this.featureService.identifyClass(rawImage, rawImageOpts, cell);
        // Identify Stars
        cell.stars = await this.featureService.identifyStars(rawImage, rawImageOpts, cell);
        // Identify Ascension
        cell.isAscended = await this.featureService.identifyAscension(rawImage, rawImageOpts, cell);
    }));

    const t4 = performance.now(); // Feature Detection done

    // 3. Pre-fetch Champions for detected classes
    const detectedClasses = new Set(grid.map(c => c.class).filter(c => c !== undefined));
    await Promise.all(Array.from(detectedClasses).map(c => this.championService.getChampionsByClass(c!)));

    const t5 = performance.now(); // Champion Fetch done

    // 4. Identify Champions concurrently
    await Promise.all(grid.map(async (cell) => {
        if (cell.class) {
            cell.championName = await this.championService.identifyChampion(rawImage, rawImageOpts, cell);
        }
    }));

    const t6 = performance.now(); // Champion Matching done

    // 5. Sanity Check: Filter out nonsense records based on Prestige Thresholds
    const prestigeThresholds = await getMinPrestigeThresholds();
    const originalCount = grid.length;
    // Allow for some variance (e.g. masteries not accounted for, or DB missing the absolute lowest prestige char)
    // We mainly want to catch gross errors like 4* detected as 7* (5k PI vs 20k Min).
    const PRESTIGE_TOLERANCE = 0.9; 

    grid = grid.filter(cell => {
        if (cell.stars && cell.rank && cell.powerRating) {
            const key = `${cell.stars}-${cell.rank}`;
            const minPrestige = prestigeThresholds.get(key);
            // If the detected PI is significantly lower than the minimum possible base prestige, it's likely a parsing error (e.g. 7* detected as 4*)
            if (minPrestige && cell.powerRating < (minPrestige * PRESTIGE_TOLERANCE)) {
                logger.warn({ 
                    cellStars: cell.stars, 
                    cellRank: cell.rank, 
                    cellPI: cell.powerRating, 
                    minPrestige,
                    threshold: minPrestige * PRESTIGE_TOLERANCE
                }, "Discarding nonsense record (PI < MinPrestige * Tolerance)");
                return false;
            }
        }
        return true;
    });

    if (grid.length < originalCount) {
        logger.info({ removed: originalCount - grid.length }, "Filtered invalid roster entries.");
    }

    let debugImage: Buffer | undefined;
    if (options.debugMode) {
      debugImage = await this.debugService.drawDebugImage(imageBuffer, grid, cellDims, headerMinY);
    }

    const t7 = performance.now(); // Total done

    logger.debug({
        ocr: Math.round(t1 - t0),
        layout: Math.round(t2 - t1),
        decode: Math.round(t3 - t2),
        features: Math.round(t4 - t3),
        fetch: Math.round(t5 - t4),
        matching: Math.round(t6 - t5),
        total: Math.round(t7 - t0)
    }, "Roster Processing Timings (ms)");

    return { grid, debugImage };
  }
}

export const rosterImageService = new RosterImageService();