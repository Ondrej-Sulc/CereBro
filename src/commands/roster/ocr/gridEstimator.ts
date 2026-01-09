import sharp from "sharp";
import { prisma } from "../../../services/prismaService";
import { ChampionGridCell, OcrResult } from "./types";
import { mergeOcrResults } from "./ocrProcessing";
import logger from "../../../services/loggerService";

export async function estimateGrid(
  ocrResults: OcrResult[],
  imageBuffer: Buffer,
  debugMode: boolean
): Promise<{ grid: ChampionGridCell[][]; topBoundary: number }> {
  // --- Constants for tuning the grid estimation logic ---
  // The ratio of the average column distance used to determine the cell width.
  const COL_WIDTH_RATIO = 0.83;
  // The ratio of the average row distance used to determine the cell height.
  const ROW_HEIGHT_RATIO = 0.98;
  // The horizontal tolerance in pixels for pairing a champion name with a rating.
  const HORIZONTAL_PAIRING_TOLERANCE = 75;
  // The vertical tolerance in pixels for pairing a champion name with a rating.
  const VERTICAL_PAIRING_TOLERANCE = 150;
  // The pixel tolerance for clustering X and Y coordinates to determine grid columns and rows.
  const GRID_PIXEL_TOLERANCE = 40;
  // The ratio to adjust the calculated x-center of a cell.
  const X_CENTER_ADJUSTMENT_RATIO = 0.18;
  // The ratio to adjust the calculated y-center of a cell.
  const Y_CENTER_ADJUSTMENT_RATIO = 0.08;

  // --- Constants for the single champion case ---
  // The multiplier for the average character width of the rating to estimate the cell width.
  const SINGLE_CHAMP_CELL_WIDTH_MULTIPLIER = 11;
  // The ratio of the cell width to its height.
  const SINGLE_CHAMP_CELL_ASPECT_RATIO = 1.2;
  // The padding below the rating to determine the cell bottom.
  const SINGLE_CHAMP_CELL_BOTTOM_PADDING = 10;

  const mergedOcrResultsForBoundary = mergeOcrResults(ocrResults);
  const infoText = mergedOcrResultsForBoundary.find((r) =>
    r.text.includes("INFORMATION")
  );
  let topBoundary = 0;
  if (infoText) {
    topBoundary = infoText.bounds[3].y;
    if (debugMode)
      logger.debug(`[DEBUG] Found top boundary at y=${topBoundary}`);
  }

  const ocrResultsBelowBoundary = ocrResults.filter(
    (r) => r.bounds[0].y > topBoundary
  );
  const mergedOcrResults = mergeOcrResults(ocrResultsBelowBoundary);

  const ratingPattern = /^(\d{1,2}[.,]\d{3}|\d{3}).*$/;
  const starPattern = /^[\*X]+$/;
  const championNamePattern = /^[A-Z0-9- '.()]+$/;

  const ratingTexts: OcrResult[] = [];
  const potentialNameParts: OcrResult[] = [];

  for (const result of mergedOcrResults) {
    if (ratingPattern.test(result.text)) {
      ratingTexts.push(result);
    } else if (
      result.text.length > 0 &&
      result.text.toUpperCase() === result.text &&
      !starPattern.test(result.text) &&
      !/^[0-9]+$/.test(result.text) &&
      championNamePattern.test(result.text)
    ) {
      potentialNameParts.push(result);
    }
  }

  if (ratingTexts.length === 0) {
    logger.debug("[DEBUG] No ratings found, cannot estimate grid.");
    return { grid: [], topBoundary: 0 };
  }

  const championData: {
    name: string;
    rating: string;
    nameBounds: any[];
    ratingBounds: any[];
  }[] = [];

  const primaryParts = [...potentialNameParts];

  for (const primaryPart of primaryParts) {
    let closestRating: OcrResult | null = null;
    let minRatingDistance = Infinity;

    const primaryPartCenterX =
      (primaryPart.bounds[0].x + primaryPart.bounds[1].x) / 2;
    const primaryPartBottomY = primaryPart.bounds[3].y;

    for (const ratingText of ratingTexts) {
      const ratingCenterX =
        (ratingText.bounds[0].x + ratingText.bounds[1].x) / 2;
      const ratingTopY = ratingText.bounds[0].y;

      const horizontalDist = Math.abs(primaryPartCenterX - ratingCenterX);
      const verticalDist = ratingTopY - primaryPartBottomY;

      if (
        verticalDist > 0 &&
        verticalDist < VERTICAL_PAIRING_TOLERANCE &&
        horizontalDist < HORIZONTAL_PAIRING_TOLERANCE
      ) {
        const distance = Math.sqrt(
          horizontalDist * horizontalDist + verticalDist * verticalDist
        );
        if (distance < minRatingDistance) {
          minRatingDistance = distance;
          closestRating = ratingText;
        }
      }
    }

    if (closestRating) {
      let secondaryPart: OcrResult | null = null;
      let minSecondaryDist = Infinity;

      for (const possibleSecondary of potentialNameParts) {
        if (possibleSecondary === primaryPart) continue;

        const isBelowPrimary =
          possibleSecondary.bounds[0].y > primaryPart.bounds[3].y;
        const isAboveRating =
          possibleSecondary.bounds[3].y < closestRating.bounds[0].y;
        const isAligned =
          Math.abs(possibleSecondary.bounds[0].x - primaryPart.bounds[0].x) <
          HORIZONTAL_PAIRING_TOLERANCE;

        if (isBelowPrimary && isAboveRating && isAligned) {
          const dist = possibleSecondary.bounds[0].y - primaryPart.bounds[3].y;
          if (dist < minSecondaryDist) {
            minSecondaryDist = dist;
            secondaryPart = possibleSecondary;
          }
        }
      }

      let finalName = primaryPart.text;
      let finalBounds = primaryPart.bounds;
      if (secondaryPart) {
        finalName += ` ${secondaryPart.text}`;
        finalBounds[2] = secondaryPart.bounds[2];
        finalBounds[3] = secondaryPart.bounds[3];
        potentialNameParts.splice(potentialNameParts.indexOf(secondaryPart), 1);
      }

      championData.push({
        name: finalName,
        rating: closestRating.text,
        nameBounds: finalBounds,
        ratingBounds: closestRating.bounds,
      });

      ratingTexts.splice(ratingTexts.indexOf(closestRating), 1);
      potentialNameParts.splice(potentialNameParts.indexOf(primaryPart), 1);
    }
  }

  if (championData.length === 1) {
    const champ = championData[0];
    const nameBounds = champ.nameBounds;
    const ratingBounds = champ.ratingBounds;
    const ratingText = champ.rating;

    const ratingWidth = ratingBounds[1].x - ratingBounds[0].x;
    const numCharsInRating = ratingText.length;
    const avgCharWidth = ratingWidth / numCharsInRating;
    const cellWidth = avgCharWidth * SINGLE_CHAMP_CELL_WIDTH_MULTIPLIER;

    const cellHeight = cellWidth * SINGLE_CHAMP_CELL_ASPECT_RATIO;

    const nameCenter_x = (nameBounds[0].x + nameBounds[1].x) / 2;

    const cellBottom = ratingBounds[2].y + SINGLE_CHAMP_CELL_BOTTOM_PADDING;
    const cellTop = cellBottom - cellHeight;

    const cellLeft = nameCenter_x - cellWidth / 2;
    const cellRight = nameCenter_x + cellWidth / 2;

    const singleCell: ChampionGridCell = {
      bounds: [
        { x: cellLeft, y: cellTop },
        { x: cellRight, y: cellTop },
        { x: cellRight, y: cellBottom },
        { x: cellLeft, y: cellBottom },
      ],
      championName: champ.name,
      powerRating: champ.rating,
    };

    const grid: ChampionGridCell[][] = [[singleCell]];
    grid[0][0] = singleCell;

    return { grid, topBoundary };
  }

  if (championData.length === 0) {
    logger.debug("[DEBUG] Could not pair any champions with ratings.");
    return { grid: [], topBoundary: 0 };
  }

  // Grid estimation based on rating positions
  const positions = championData.map((entry) => ({
    x: entry.ratingBounds[3].x,
    y: entry.ratingBounds[3].y,
  }));
  const sortedX = [...new Set(positions.map((p) => p.x))].sort((a, b) => a - b);
  const sortedY = [...new Set(positions.map((p) => p.y))].sort((a, b) => a - b);

  const columnStarts: number[] = [];
  if (sortedX.length > 0) {
    columnStarts.push(sortedX[0]);
    for (let i = 1; i < sortedX.length; i++) {
      if (
        sortedX[i] >
        columnStarts[columnStarts.length - 1] + GRID_PIXEL_TOLERANCE
      ) {
        columnStarts.push(sortedX[i]);
      }
    }
  }

  const rowStarts: number[] = [];
  if (sortedY.length > 0) {
    rowStarts.push(sortedY[0]);
    for (let i = 1; i < sortedY.length; i++) {
      if (sortedY[i] > rowStarts[rowStarts.length - 1] + GRID_PIXEL_TOLERANCE) {
        rowStarts.push(sortedY[i]);
      }
    }
  }

  const numCols = columnStarts.length;
  let numRows = rowStarts.length;

  if (numCols === 0 || numRows === 0) return { grid: [], topBoundary: 0 };

  const avgColDist =
    numCols > 1
      ? (columnStarts[numCols - 1] - columnStarts[0]) / (numCols - 1)
      : ((await sharp(imageBuffer).metadata()).width || 0) / 7;
  const avgRowDist =
    numRows > 1
      ? (rowStarts[numRows - 1] - rowStarts[0]) / (numRows - 1)
      : avgColDist * 0.98;

  const cellWidth = avgColDist * COL_WIDTH_RATIO;
  const cellHeight = avgRowDist * ROW_HEIGHT_RATIO;

  let grid: ChampionGridCell[][] = Array(numRows)
    .fill(0)
    .map(() =>
      Array(numCols)
        .fill(0)
        .map(() => ({ bounds: [] }))
    );

  // Create grid cells with bounds
  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      const x_center =
        columnStarts[c] +
        avgColDist / 2 -
        cellWidth * X_CENTER_ADJUSTMENT_RATIO;
      const y_center =
        rowStarts[r] - avgRowDist / 2 + cellHeight * Y_CENTER_ADJUSTMENT_RATIO;

      const left = x_center - cellWidth / 2;
      const top = y_center - cellHeight / 2;
      const right = x_center + cellWidth / 2;
      const bottom = y_center + cellHeight / 2;

      grid[r][c] = {
        bounds: [
          { x: left, y: top },
          { x: right, y: top },
          { x: right, y: bottom },
          { x: left, y: bottom },
        ],
      };
    }
  }

  if (topBoundary > 0) {
    grid = grid.filter((row) => {
      const firstCell = row[0];
      if (!firstCell) return false;
      const rowTop = firstCell.bounds[0].y;
      return rowTop > topBoundary;
    });
  }

  if (debugMode)
    logger.debug(
      `[DEBUG] Placing ${championData.length} identified champions into the grid...`
    );
  for (const champ of championData) {
    const centerX = (champ.nameBounds[0].x + champ.nameBounds[1].x) / 2;
    const centerY = (champ.nameBounds[0].y + champ.nameBounds[2].y) / 2;

    let bestCell: { r: number; c: number } | null = null;
    let minDist = Infinity;

    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        const cell = grid[r][c];
        const [topLeft, , bottomRight] = cell.bounds;
        if (
          centerX >= topLeft.x &&
          centerX <= bottomRight.x &&
          centerY >= topLeft.y &&
          centerY <= bottomRight.y
        ) {
          const cellCenterX = (topLeft.x + bottomRight.x) / 2;
          const cellCenterY = (topLeft.y + bottomRight.y) / 2;
          const dist = Math.sqrt(
            Math.pow(centerX - cellCenterX, 2) +
              Math.pow(centerY - cellCenterY, 2)
          );
          if (dist < minDist) {
            minDist = dist;
            bestCell = { r, c };
          }
        }
      }
    }

    if (bestCell) {
      if (debugMode)
        logger.debug(
          `[DEBUG] Placing '${champ.name}' (${champ.rating}) into grid cell [${bestCell.r}, ${bestCell.c}].`
        );
      grid[bestCell.r][bestCell.c].championName = champ.name;
      grid[bestCell.r][bestCell.c].powerRating = champ.rating;
    } else {
      if (debugMode)
        logger.warn(
          `[DEBUG] Could not find a grid cell for champion '${champ.name}'.`
        );
    }
  }

  const allChampions = await prisma.champion.findMany();

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const cell = grid[r][c];
      if (cell.championName) {
      }
    }
  }

  if (grid.length > 0) {
    const lastRow = grid[grid.length - 1];
    let lastChampionIndex = -1;
    for (let c = lastRow.length - 1; c >= 0; c--) {
      if (lastRow[c].championName) {
        lastChampionIndex = c;
        break;
      }
    }
    grid[grid.length - 1] = lastRow.slice(0, lastChampionIndex + 1);
  }

  return { grid, topBoundary };
}
