import sharp from "sharp";
import { prisma } from "../../../services/prismaService";
import { getChampionImageUrl } from "../../../utils/championHelper";
import { Champion, Roster } from "@prisma/client";
import logger from "../../../services/loggerService";

import {
  ChampionGridCell,
  RosterUpdateResult,
  RosterWithChampion,
  Vertex,
} from "./types";

import {
  downloadImage,
  getAverageColor,
  getImageHash,
  compareHashes,
  getColorDistance,
} from "./imageUtils";

export async function solveShortNames(
  grid: ChampionGridCell[][],
  imageBuffer: Buffer
): Promise<ChampionGridCell[][]> {
  // --- Constants for tuning the image-based short name solving ---
  // The ratio of the cell height to crop from the bottom to isolate the portrait.
  const PORTRAIT_CROP_BOTTOM_RATIO = 0.33;
  // The ratio of the cell width to crop from the sides to isolate the portrait.
  const PORTRAIT_CROP_HORIZONTAL_RATIO = 0.1;
  // The ratio to crop from the sides of the extracted portrait for the inner hash.
  const INNER_PORTRAIT_CROP_RATIO = 0.275;
  // The width ratio for the inner portrait hash.
  const INNER_PORTRAIT_WIDTH_RATIO = 1 - INNER_PORTRAIT_CROP_RATIO * 2;

  const allChampions = await prisma.champion.findMany();
  const championsByShortName = allChampions.reduce((acc, champ) => {
    if (!acc[champ.shortName]) {
      acc[champ.shortName] = [];
    }
    acc[champ.shortName].push(champ);
    return acc;
  }, {} as Record<string, Champion[]>);

  const ambiguousShortNames = Object.keys(championsByShortName).filter(
    (key) => championsByShortName[key].length > 1
  );

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const cell = grid[r][c];
      if (cell.championName) {
        if (ambiguousShortNames.includes(cell.championName)) {
          const possibleChampions = championsByShortName[cell.championName];
          const [topLeft, , bottomRight] = cell.bounds;

          const boxWidth = bottomRight.x - topLeft.x;
          const boxHeight = bottomRight.y - topLeft.y;

          const cropTop = boxHeight * 0;
          const cropBottom = boxHeight * PORTRAIT_CROP_BOTTOM_RATIO;
          const cropLeft = boxWidth * PORTRAIT_CROP_HORIZONTAL_RATIO;
          const cropRight = boxWidth * PORTRAIT_CROP_HORIZONTAL_RATIO;

          const extractOptions = {
            left: Math.round(topLeft.x + cropLeft),
            top: Math.round(topLeft.y + cropTop),
            width: Math.round(boxWidth - cropLeft - cropRight),
            height: Math.round(boxHeight - cropTop - cropBottom),
          };

          cell.shortNameSolveBounds = [
            { x: extractOptions.left, y: extractOptions.top },
            {
              x: extractOptions.left + extractOptions.width,
              y: extractOptions.top,
            },
            {
              x: extractOptions.left + extractOptions.width,
              y: extractOptions.top + extractOptions.height,
            },
            {
              x: extractOptions.left,
              y: extractOptions.top + extractOptions.height,
            },
          ];

          if (extractOptions.width <= 0 || extractOptions.height <= 0) {
            logger.debug(
              { championName: cell.championName, extractOptions },
              `[DEBUG] Skipping invalid extract region`
            );
            continue;
          }

          const championImageBuffer = await sharp(imageBuffer)
            .extract(extractOptions)
            .toBuffer();

          // Second crop - 15% from all sides
          const champImageMetadata = await sharp(
            championImageBuffer
          ).metadata();
          const champWidth = champImageMetadata.width || 0;
          const champHeight = champImageMetadata.height || 0;
          const champCropLeft = Math.floor(
            champWidth * INNER_PORTRAIT_CROP_RATIO
          );
          const champCropTop = Math.floor(
            champHeight * INNER_PORTRAIT_CROP_RATIO
          );
          const champCropWidth = Math.floor(
            champWidth * INNER_PORTRAIT_WIDTH_RATIO
          );
          const champCropHeight = Math.floor(
            champHeight * INNER_PORTRAIT_WIDTH_RATIO
          );

          const abs_left = extractOptions.left + champCropLeft;
          const abs_top = extractOptions.top + champCropTop;
          const abs_right = abs_left + champCropWidth;
          const abs_bottom = abs_top + champCropHeight;

          cell.innerPortraitCropBounds = [
            { x: abs_left, y: abs_top },
            { x: abs_right, y: abs_top },
            { x: abs_right, y: abs_bottom },
            { x: abs_left, y: abs_bottom },
          ];

          const innerChampionImageBuffer = await sharp(championImageBuffer)
            .extract({
              left: champCropLeft,
              top: champCropTop,
              width: champCropWidth,
              height: champCropHeight,
            })
            .toBuffer();

          const championHash = await getImageHash(innerChampionImageBuffer);
          const championAvgColor = await getAverageColor(
            innerChampionImageBuffer
          );

          let bestMatch: Champion | null = null;
          let bestMatchScore = Infinity;
          let bestMatchOfficialImageBuffer: Buffer | null = null;

          for (const possibleChampion of possibleChampions) {
            const imageUrl = getChampionImageUrl(
              possibleChampion.images,
              "full",
              "primary"
            );
            if (!imageUrl) {
              logger.debug(
                { championName: possibleChampion.name },
                `[DEBUG] Skipping champion due to missing official image URL.`
              );
              continue;
            }
            const officialImageBuffer = await downloadImage(imageUrl);

            // Second crop for official image
            const officialImageMetadata = await sharp(
              officialImageBuffer
            ).metadata();
            const officialWidth = officialImageMetadata.width || 0;
            const officialHeight = officialImageMetadata.height || 0;
            const officialCropLeft = Math.floor(
              officialWidth * INNER_PORTRAIT_CROP_RATIO
            );
            const officialCropTop = Math.floor(
              officialHeight * INNER_PORTRAIT_CROP_RATIO
            );
            const officialCropWidth = Math.floor(
              officialWidth * INNER_PORTRAIT_WIDTH_RATIO
            );
            const officialCropHeight = Math.floor(
              officialHeight * INNER_PORTRAIT_WIDTH_RATIO
            );

            const innerOfficialImageBuffer = await sharp(officialImageBuffer)
              .extract({
                left: officialCropLeft,
                top: officialCropTop,
                width: officialCropWidth,
                height: officialCropHeight,
              })
              .toBuffer();

            const officialImageHash = await getImageHash(
              innerOfficialImageBuffer
            );
            const officialImageAvgColor = await getAverageColor(
              innerOfficialImageBuffer
            );

            const hashDistance = compareHashes(championHash, officialImageHash);
            const colorDistance = getColorDistance(
              championAvgColor,
              officialImageAvgColor
            );

            // Normalize scores (0-1 range)
            const normalizedHashScore = hashDistance / 256; // Max hash distance is 256 for 16x16
            const normalizedColorScore = colorDistance / 441.67; // Max color distance is sqrt(3 * 255^2)

            // Combine scores (lower is better). Give more weight to hash score.
            const combinedScore =
              1 * normalizedHashScore + 0 * normalizedColorScore;

            if (combinedScore < bestMatchScore) {
              bestMatchScore = combinedScore;
              bestMatch = possibleChampion;
              bestMatchOfficialImageBuffer = officialImageBuffer;
            }
          }
          if (bestMatch) {
            grid[r][c].championName = bestMatch.name;
            grid[r][c].champion = bestMatch as any;
            grid[r][c].bestMatchImageBuffer = bestMatchOfficialImageBuffer;
          }
        } else {
          const champions = championsByShortName[cell.championName];
          if (champions && champions.length === 1) {
            const champion = champions[0];
            cell.championName = champion.name;
            cell.champion = champion as any;
          }
        }
      }
    }
  }

  return grid;
}

export async function isChampionAwakened(
  imageBuffer: Buffer,
  bounds: Vertex[],
  debugMode: boolean
): Promise<{ isAwakened: boolean; awakenedCheckBounds: Vertex[] }> {
  // --- Constants for tuning the awakened gem detection ---
  // The width of the color strip to check, as a ratio of the cell width.
  const STRIP_WIDTH_RATIO = 0.4;
  // The height of the color strip to check, as a ratio of the cell height.
  const STRIP_HEIGHT_RATIO = 0.1;
  // The vertical offset of the color strip from the top of the cell, as a ratio of the cell height.
  const STRIP_Y_OFFSET_RATIO = 0.6;
  // The average blue value a pixel must have to be considered part of an awakened gem.
  // UPDATE: We now use a ratio of Blue vs (Red+Green) to distinguish Silver (Awakened) vs Gold (Unawakened).
  // Silver is Grey/White (High B, High R, High G) -> Ratio ~ 1.0
  // Gold is Yellow (Low B, High R, High G) -> Ratio << 1.0
  const BLUE_RATIO_THRESHOLD = 0.7;

  const [topLeft, , bottomRight] = bounds;
  const boxWidth = bottomRight.x - topLeft.x;
  const boxHeight = bottomRight.y - topLeft.y;

  const stripWidth = Math.floor(boxWidth * STRIP_WIDTH_RATIO);
  const stripHeight = Math.floor(boxHeight * STRIP_HEIGHT_RATIO);
  const stripX = Math.floor(topLeft.x + (boxWidth - stripWidth) / 2);
  const stripY = Math.floor(topLeft.y + boxHeight * STRIP_Y_OFFSET_RATIO);

  const awakenedCheckBounds: Vertex[] = [
    { x: stripX, y: stripY },
    { x: stripX + stripWidth, y: stripY },
    { x: stripX + stripWidth, y: stripY + stripHeight },
    { x: stripX, y: stripY + stripHeight },
  ];

  if (stripWidth <= 0 || stripHeight <= 0) {
    if (debugMode) {
      logger.debug(
        { x: bounds[0].x.toFixed(0), y: bounds[0].y.toFixed(0), stripWidth, stripHeight },
        `[DEBUG] Awakened check: Invalid strip dimensions, returning not awakened.`
      );
    }
    return { isAwakened: false, awakenedCheckBounds };
  }

  const strip = await sharp(imageBuffer)
    .extract({
      left: stripX,
      top: stripY,
      width: stripWidth,
      height: stripHeight,
    })
    .toColorspace('srgb') // Ensure standard RGB
    .raw()
    .toBuffer();

  const numPixels = Math.floor(strip.length / 3);
  if (numPixels === 0) {
    return { isAwakened: false, awakenedCheckBounds };
  }

  let r = 0,
    g = 0,
    b = 0;
  for (let i = 0; i < numPixels; i++) {
    r += strip[i * 3];
    g += strip[i * 3 + 1];
    b += strip[i * 3 + 2];
  }

  const avgR = r / numPixels;
  const avgG = g / numPixels;
  const avgB = b / numPixels;
  
  // Calculate Blue Ratio: B / Average(R, G)
  // Avoid divide by zero
  const avgRG = (avgR + avgG) / 2;
  const blueRatio = avgRG > 0 ? avgB / avgRG : 1.0; 

  const isAwakened = blueRatio > BLUE_RATIO_THRESHOLD;

  if (debugMode) {
    logger.debug(
      {
        x: bounds[0].x.toFixed(0),
        y: bounds[0].y.toFixed(0),
        avgR: avgR.toFixed(1),
        avgG: avgG.toFixed(1),
        avgB: avgB.toFixed(1),
        blueRatio: blueRatio.toFixed(2),
        isAwakened
      },
      `[DEBUG] Awakened check result`
    );
  }

  return { isAwakened, awakenedCheckBounds };
}
