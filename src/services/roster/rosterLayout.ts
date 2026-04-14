
import sharp from 'sharp';
import logger from '../loggerService.js';
import { CONFIG } from './rosterConfig.js';
import { GridCell } from './types.js';

interface OCRDetection {
  description?: string;
  boundingPoly: {
    vertices: { x?: number; y?: number }[];
  };
}

export class RosterLayoutService {
  public async estimateGridFromBG(detections: OCRDetection[], imageBuffer: Buffer): Promise<{
    grid: GridCell[],
    avgColDist: number,
    cellDims: { width: number, height: number },
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
      const desc = text.description;
      if (desc && headerKeywords.some(kw => desc.toUpperCase().includes(kw))) {
        const v = text.boundingPoly.vertices;
        const bottomY = Math.max(v[2]?.y || 0, v[3]?.y || 0);
        if (bottomY > headerMinY) {
          headerMinY = bottomY;
        }
      }
    }
    if (headerMinY > 0) {
      logger.info({ headerMinY }, "Detected Header Line, ignoring content above.");
    }

    const positions = piCandidates.map((pi: OCRDetection) => {
      const vertices = pi.boundingPoly?.vertices || [];
      const v0 = vertices[0] || { x: 0, y: 0 };
      const v2 = vertices[2] || { x: 0, y: 0 };
      
      let x = v0.x || 0;
      const text = pi.description || '';
      const firstDigitIndex = text.search(/\d/);
      const height = (v2.y || 0) - (v0.y || 0);

      if (firstDigitIndex > 0 && text.length > 0) {
        x += (height * 1.15);
      }

      return {
        x: x,
        y: v2.y || 0,
        pi
      };
    }).filter(pos => pos.y > headerMinY);

    const sortedX = [...positions].sort((a, b) => a.x - b.x);
    const uniqueCols: number[] = [];
    if (sortedX.length > 0) {
      const cols: number[][] = [];
      let currentCol = [sortedX[0].x];
      for (let i = 1; i < sortedX.length; i++) {
        if (sortedX[i].x - currentCol[currentCol.length - 1] < 50) {
          currentCol.push(sortedX[i].x);
        } else {
          cols.push(currentCol);
          currentCol = [sortedX[i].x];
        }
      }
      cols.push(currentCol);

      // The true X coordinate is the maximum (rightmost) X in the cluster
      // because class icons prepended by OCR shift the bounding box left.
      uniqueCols.push(...cols.map(c => Math.max(...c)));
    }

    let avgColDist = 0;
    if (uniqueCols.length > 1) {
      let estColDist = imageWidth / 7;
      
      const rawDists: number[] = [];
      for (let i = 1; i < uniqueCols.length; i++) {
        rawDists.push(uniqueCols[i] - uniqueCols[i - 1]);
      }
      rawDists.sort((a, b) => a - b);
      const minValidDist = imageWidth * 0.03; // ~3% minimum column width
      const validEstDists = rawDists.filter(d => d > minValidDist);
      if (validEstDists.length > 0) {
        // Use a lower quartile to handle gaps while avoiding noise
        estColDist = validEstDists[Math.floor(validEstDists.length / 4)];
      }

      const validDists: number[] = [];
      for (let i = 1; i < uniqueCols.length; i++) {
        const d = uniqueCols[i] - uniqueCols[i - 1];
        const colsBetween = Math.round(d / estColDist);
        if (colsBetween > 0) {
          validDists.push(d / colsBetween);
        }
      }
      if (validDists.length > 0) {
        avgColDist = validDists.reduce((a, b) => a + b, 0) / validDists.length;
      } else {
        avgColDist = estColDist;
      }
    } else {
      avgColDist = imageWidth / 7;
    }

    const cellWidth = avgColDist * CONFIG.CELL_WIDTH_RATIO;
    const cellHeight = avgColDist * CONFIG.CELL_HEIGHT_RATIO;
    const cellDims = { width: cellWidth, height: cellHeight };

    for (const pos of positions) {
      let powerRating = parseInt(pos.pi.description?.replace(/[^\d]/g, '') || '0', 10);

      const closestColX = uniqueCols.reduce((prev, curr) =>
        Math.abs(curr - pos.x) < Math.abs(prev - pos.x) ? curr : prev
      );

      logger.debug({
        powerRating,
        posX: pos.x,
        closestColX,
        diff: closestColX - pos.x
      }, "Cell PI debugging");

      // If the bounding box is shifted left by >10 pixels relative to the clean column X,
      // it means OCR merged the class icon as a leading digit. Strip it.
      if (closestColX - pos.x > 10) {
        const prStr = powerRating.toString();
        if (prStr.length >= 5) {
          powerRating = parseInt(prStr.substring(1), 10);
          logger.debug({ powerRating }, "Stripped PI digit");
        }
      }

      const cellX = closestColX - (avgColDist * CONFIG.PI_OFFSET_X_RATIO);
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
        const textCenterX = ((v[0]?.x || 0) + (v[2]?.x || 0)) / 2;
        const textBottomY = v[2]?.y || 0;

        const isAligned = Math.abs(textCenterX - closestColX) < (cellWidth * 0.6);
        const isAbove = textBottomY < pos.y && textBottomY > (cellY + cellHeight * 0.2);
        return isAligned && isAbove;
      });

      const combinedText = candidateDetections.map(d => d.description).join(' ');

      let rankMatch = combinedText.match(/Rank\s*(\d+)/i);
      if (!rankMatch) {
        rankMatch = combinedText.match(/\bR(\d+)\b/i);
      }

      let sigMatch = combinedText.match(/Sig[.\s]*(\d+)/i);
      if (!sigMatch) {
        sigMatch = combinedText.match(/\bS(\d+)\b/i);
      }

      if (rankMatch) rank = parseInt(rankMatch[1], 10);
      if (sigMatch) sigLevel = parseInt(sigMatch[1], 10);

      const v = pos.pi.boundingPoly.vertices;
      const piW = (v[2]?.x || 0) - (v[0]?.x || 0);
      const piH = (v[2]?.y || 0) - (v[0]?.y || 0);

      cells.push({
        bounds: cellBounds,
        piBounds: { x: v[0]?.x || 0, y: v[0]?.y || 0, width: piW, height: piH },
        powerRating: powerRating,
        rank,
        sigLevel
      });
    }

    // Post-process: detect and correct cells that are smaller due to the user
    // touching a champion card during screenshot capture.
    this.correctTouchedCells(cells, cellHeight);

    cells.sort((a, b) => {
      if (Math.abs(a.bounds.y - b.bounds.y) > cellHeight / 2) {
        return a.bounds.y - b.bounds.y;
      }
      return a.bounds.x - b.bounds.x;
    });

    return { grid: cells, avgColDist, cellDims, headerMinY };
  }

  /**
   * Detects cells whose PI (Power Index) text sits higher than the row median,
   * which happens when the player touches a champion card during screenshot
   * capture — the card appears physically smaller in both dimensions.
   *
   * Model: the card compresses symmetrically from top and bottom by `c` pixels each.
   *   actual_PI_y = standard_PI_y  −  c × (2 × (1 − PI_OFFSET_Y_RATIO) − 1)
   * Solving for c:   c = delta / (2 × (1 − PI_OFFSET_Y_RATIO) − 1)
   * Corrected height: standard_height − 2 × c
   */
  private correctTouchedCells(cells: GridCell[], standardCellHeight: number): void {
    if (cells.length <= 1) return;

    // Group cells into rows by clustering on bounds.y (all cells in the same
    // row will have very similar Y values — within half a cell height).
    const rowThreshold = standardCellHeight * 0.5;
    const sortedByY = [...cells].sort((a, b) => a.bounds.y - b.bounds.y);

    const rows: GridCell[][] = [];
    let currentRow: GridCell[] = [sortedByY[0]];
    for (let i = 1; i < sortedByY.length; i++) {
      const prev = currentRow[currentRow.length - 1];
      if (sortedByY[i].bounds.y - prev.bounds.y < rowThreshold) {
        currentRow.push(sortedByY[i]);
      } else {
        rows.push(currentRow);
        currentRow = [sortedByY[i]];
      }
    }
    rows.push(currentRow);

    const PI_FRACTION = 1 - CONFIG.PI_OFFSET_Y_RATIO; // 0.935
    // Denominator in the symmetric compression model
    const COMPRESSION_DENOM = 2 * PI_FRACTION - 1; // 2*0.935 - 1 = 0.87

    for (const row of rows) {
      if (row.length <= 1) continue;

      // Collect PI bottom Y values for cells that have piBounds
      const piBottomYs: number[] = row
        .map(cell => (cell.piBounds ? cell.piBounds.y + cell.piBounds.height : 0))
        .filter(y => y > 0);

      if (piBottomYs.length < 2) continue;

      const piSorted = [...piBottomYs].sort((a, b) => a - b);
      const medianPIY = piSorted[Math.floor(piSorted.length / 2)];

      for (const cell of row) {
        if (!cell.piBounds) continue;

        const actualPIY = cell.piBounds.y + cell.piBounds.height;
        // Positive delta: PI is higher (smaller Y) → card is compressed
        const delta = medianPIY - actualPIY;

        if (delta > CONFIG.TOUCHED_CELL_PI_THRESHOLD) {
          const compressionPerSide = delta / COMPRESSION_DENOM;
          const touchedHeight = Math.round(standardCellHeight - 2 * compressionPerSide);
          const touchedWidth  = Math.round(touchedHeight / CONFIG.CELL_HEIGHT_RATIO * CONFIG.CELL_WIDTH_RATIO);
          const touchedY      = actualPIY - touchedHeight * PI_FRACTION;

          // Recover the column anchor that was used for this cell.
          // avgColDist = cellWidth / CELL_WIDTH_RATIO; colX = cellX + avgColDist * PI_OFFSET_X_RATIO
          const origAvgColDist = cell.bounds.width / CONFIG.CELL_WIDTH_RATIO;
          const origColX      = cell.bounds.x + origAvgColDist * CONFIG.PI_OFFSET_X_RATIO;

          logger.info({
            pi: cell.powerRating,
            delta,
            compressionPerSide: compressionPerSide.toFixed(1),
            oldHeight: standardCellHeight,
            touchedHeight,
            oldY: cell.bounds.y.toFixed(1),
            touchedY: touchedY.toFixed(1)
          }, "Detected touched cell — correcting bounds");

          // X anchor (left edge) stays the same; only height/width/y change.
          cell.bounds = {
            x: cell.bounds.x,
            y: touchedY,
            width: touchedWidth,
            height: touchedHeight
          };

          // Column-pollution correction: a touched card is physically narrower, so
          // its PI text (same center, less width) starts a few pixels further right.
          // When that cell happened to be the cluster max it pulled the column anchor
          // rightward, mis-positioning every other cell in that column.
          // Fix: if the touched cell's PI x ≈ origColX (it WAS the max), shift every
          // co-column non-touched cell left by the amount of the pollution.
          const touchedPIX     = cell.piBounds!.x;
          const pilledByTouched = origColX - touchedPIX; // 0 if touched cell IS the anchor

          if (pilledByTouched <= 2) {           // touched cell set (or nearly set) the anchor
            for (const other of cells) {
              if (other === cell || !other.piBounds) continue;

              // Same column?
              const otherAvgColDist = other.bounds.width / CONFIG.CELL_WIDTH_RATIO;
              const otherColX       = other.bounds.x + otherAvgColDist * CONFIG.PI_OFFSET_X_RATIO;
              if (Math.abs(otherColX - origColX) > 2) continue;

              // How far is this cell's own PI left edge below the (polluted) anchor?
              const pollution = otherColX - other.piBounds.x;
              if (pollution > 0 && pollution < 10) {
                logger.info({
                  pi: other.powerRating, origColX,
                  ownPIX: other.piBounds.x, pollution
                }, "Corrected column-anchor pollution from touched cell");

                other.bounds = { ...other.bounds, x: other.bounds.x - pollution };
              }
            }
          }
        }
      }
    }
  }
}
