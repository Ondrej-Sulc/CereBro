
import sharp from 'sharp';
import logger from '../loggerService.js';
import { CONFIG } from './rosterConfig.js';
import { GridCell } from './types.js';

export class RosterLayoutService {
  public async estimateGridFromStats(detections: any[], imageBuffer: Buffer): Promise<{ 
    grid: GridCell[], 
    avgColDist: number, 
    cellDims: {width: number, height: number},
    headerMinY: number
  }> {
    const cells: GridCell[] = [];
    
    const metadata = await sharp(imageBuffer).metadata();
    const imageWidth = metadata.width || 1000;

    const piCandidates = detections.slice(1).filter((text) => {
      const cleanText = text.description?.replace(/[^\d]/g, '');
      const value = parseInt(cleanText || '0', 10);
      return value > CONFIG.MIN_PI_VALUE;
    });

    logger.info({ candidateCount: piCandidates.length }, "PI Candidates Found");

    if (piCandidates.length === 0) {
      throw new Error("No Power Ratings found to anchor grid.");
    }

    // Header Detection (to ignore partial top rows)
    let headerMinY = 0;
    const headerKeywords = ['MASTERIES', 'CRAFTING'];
    for (const text of detections.slice(1)) {
        if (text.description && headerKeywords.some(kw => text.description.toUpperCase().includes(kw))) {
            const v = text.boundingPoly.vertices;
            const bottomY = Math.max(v[2].y, v[3].y);
            if (bottomY > headerMinY) {
                headerMinY = bottomY;
            }
        }
    }
    if (headerMinY > 0) {
        logger.info({ headerMinY }, "Detected Header Line, ignoring content above.");
    }

    const positions = piCandidates.map((pi: any) => {
        const vertices = pi.boundingPoly.vertices;
        let x = vertices[0].x;
        const text = pi.description || '';
        const firstDigitIndex = text.search(/\d/);
        const height = vertices[2].y - vertices[0].y;

        if (firstDigitIndex > 0 && text.length > 0) {
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

      if (cellY < headerMinY) {
          continue;
      }

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

    return { grid: cells, avgColDist, cellDims, headerMinY };
  }
}
