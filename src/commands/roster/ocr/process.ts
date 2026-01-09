import {
  RosterUpdateResult,
  RosterDebugResult,
  ChampionGridCell,
  RosterWithChampion,
} from "./types";
import { downloadImage, drawDebugBoundsOnImage } from "./imageUtils";
import { processOcrDetections } from "./ocrProcessing";
import { estimateGrid } from "./gridEstimator";
import { solveShortNames, isChampionAwakened } from "./championIdentifier";
import Fuse from "fuse.js";
import { getGoogleVisionService } from "../../../services/googleVisionService.js";
import logger from "../../../services/loggerService.js";

export async function processRosterScreenshot(
  imageInput: string | Buffer,
  stars: number,
  rank: number,
  isAscended: boolean = false,
  debugMode: boolean = false,
  playerId?: string
): Promise<RosterUpdateResult | RosterDebugResult> {
  const googleVisionService = await getGoogleVisionService();
  const { prisma } = await import("../../../services/prismaService.js");
  
  const logContext = { playerId, stars, rank, isAscended };

  if (debugMode)
    logger.debug(logContext, "Starting roster processing (DEBUG MODE)");

  // 1. Prepare image buffer
  let imageBuffer: Buffer;
  if (typeof imageInput === 'string') {
      if (debugMode) logger.debug({ ...logContext, url: imageInput }, "Downloading image from URL");
      imageBuffer = await downloadImage(imageInput);
  } else {
      imageBuffer = imageInput;
  }

  if (debugMode)
    logger.debug({ ...logContext, bufferSize: imageBuffer.length }, "Image buffer ready");

  // 2. Run OCR using Google Cloud Vision
  if (debugMode)
    logger.debug(logContext, "Sending image to Google Cloud Vision for OCR");
  const detections = await googleVisionService.detectText(imageBuffer);
  
  if (debugMode)
    logger.debug(
      { ...logContext, detectionsCount: detections?.length || 0 },
      "OCR complete"
    );

  if (!detections || detections.length === 0) {
    const message = "Could not detect any text in the image.";
    logger.warn(logContext, message);
    if (debugMode) {
      return { message };
    }
    throw new Error(message);
  }

  // 3. Process OCR results
  const ocrResults = processOcrDetections(detections);
  if (debugMode) {
    logger.debug({ ...logContext, resultsCount: ocrResults.length }, "Processed OCR results");
  }

  // 4. Estimate grid and parse champions
  if (debugMode) logger.debug(logContext, "Estimating champion grid");
  let { grid, topBoundary } = await estimateGrid(
    ocrResults,
    imageBuffer,
    debugMode
  );
  if (debugMode) {
    logger.debug(
      { ...logContext, rows: grid.length, cols: grid[0]?.length || 0 },
      "Grid estimated"
    );
  }

  // 5. Identify champions in grid
  const allChampions = await prisma.champion.findMany();
  const fuse = new Fuse(allChampions, {
    keys: ["name", "shortName"],
    includeScore: true,
    threshold: 0.4,
  });

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const cell = grid[r][c];
      if (cell.championName) {
        const results = fuse.search(cell.championName);
        if (results.length > 0) {
          cell.championName = results[0].item.shortName;
        }
      }
    }
  }

  if (debugMode) {
    console.log(
      "[DEBUG] Parsed grid before name solving:\n" + (await gridToString(grid))
    );
  }

  // 6. Solve ambiguous short names
  if (debugMode) logger.debug(logContext, "Solving ambiguous short names");
  grid = await solveShortNames(grid, imageBuffer);
  if (debugMode) logger.debug(logContext, "Short names solved");

  // 7. Final pass for awakened status
  for (const row of grid) {
    for (const cell of row) {
      if (cell.championName) {
        const { isAwakened, awakenedCheckBounds } = await isChampionAwakened(
          imageBuffer,
          cell.bounds,
          debugMode
        );
        cell.isAwakened = isAwakened;
        cell.awakenedCheckBounds = awakenedCheckBounds;
      }
    }
  }

  let debugImageBuffer: Buffer | undefined;
  if (debugMode) {
    logger.debug(logContext, "Drawing debug bounds on image");
    debugImageBuffer = await drawDebugBoundsOnImage(
      imageBuffer,
      grid,
      topBoundary
    );
  }

  if (debugMode) {
    logger.debug(logContext, "Debug mode enabled, skipping database save");
    return {
      message: `--- DEBUG MODE --- \nFinal parsed roster: \n${await gridToString(
        grid
      )}`,
      imageBuffer: imageBuffer,
      debugImageBuffer: debugImageBuffer,
    };
  }

  if (!playerId) {
    throw new Error("playerId is required when not in debug mode.");
  }

  // 8. Save roster to database
  logger.info(logContext, "Saving roster to database");
  const savedChampions = await saveRoster(
    grid,
    playerId,
    stars,
    rank,
    isAscended
  );
  const count = savedChampions.flat().length;
  logger.info({ ...logContext, count }, "Successfully saved roster");

  return {
    champions: savedChampions,
    count: count,
  };
}

async function saveRoster(
  grid: ChampionGridCell[][],
  playerId: string,
  stars: number,
  rank: number,
  isAscended: boolean
): Promise<RosterWithChampion[][]> {
  const { prisma } = await import("../../../services/prismaService.js");
  const savedChampions: RosterWithChampion[][] = [];
  const allChampions = await prisma.champion.findMany();
  const championMap = new Map(allChampions.map((c) => [c.name, c]));

  for (const row of grid) {
    const newRow: RosterWithChampion[] = [];
    for (const cell of row) {
      if (cell.championName) {
        const champion = championMap.get(cell.championName);
        if (champion) {
          const powerRatingInt = cell.powerRating
            ? parseInt(cell.powerRating.replace(/[,.]/g, ""), 10)
            : undefined;
          const rosterEntry = await prisma.roster.upsert({
            where: {
              playerId_championId_stars: {
                playerId,
                championId: champion.id,
                stars,
              },
            },
            update: {
              rank,
              isAwakened: cell.isAwakened || false,
              isAscended,
              powerRating: powerRatingInt,
            },
            create: {
              playerId,
              championId: champion.id,
              stars,
              rank,
              isAwakened: cell.isAwakened || false,
              isAscended,
              powerRating: powerRatingInt,
            },
            include: { champion: true },
          });
          newRow.push(rosterEntry);
        }
      }
    }
    if (newRow.length > 0) {
      savedChampions.push(newRow);
    }
  }

  // Fetch player with alliance and alliance config to check for sheet integration
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: { alliance: { include: { config: true } } },
  });

  if (player?.alliance?.config?.sheetId) {
    await updateRosterInSheet(
      playerId,
      stars,
      rank,
      isAscended,
      savedChampions,
      player.alliance.config.sheetId
    );
  }

  return savedChampions;
}

async function updateRosterInSheet(
  playerId: string,
  stars: number,
  rank: number,
  isAscended: boolean,
  updatedChampions: RosterWithChampion[][],
  sheetId: string
) {
  const { prisma } = await import("../../../services/prismaService.js");
  const { sheetsService } = await import("../../../services/sheetsService.js");
  if (stars !== 6 && stars !== 7) {
    logger.debug({ playerId, stars }, "Skipping sheet update for non-6/7* champions");
    return;
  }

  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) {
    logger.error({ playerId }, "Player not found during sheet update");
    return;
  }

  const sheetName = "Roster";
  const headerRange = `${sheetName}!B2:BI2`;
  const championNamesRange = `${sheetName}!A5:A`;

  const [playerNames, championNames] = await sheetsService.readSheets(
    sheetId,
    [headerRange, championNamesRange]
  );

  if (!playerNames || !championNames) {
    logger.error({ playerId, sheetId }, "Failed to read player or champion names from sheet");
    return;
  }

  const playerIndex = playerNames[0].findIndex(
    (name: string) => name.toLowerCase() === player.ingameName.toLowerCase()
  );

  if (playerIndex === -1) {
    logger.debug({ playerId, ingameName: player.ingameName }, "Player not found in sheet");
    return;
  }

  const columnIndex = playerIndex + (stars === 6 ? 1 : 2);
  const columnLetter = String.fromCharCode(65 + (columnIndex % 26));
  const columnPrefix =
    columnIndex >= 26
      ? String.fromCharCode(65 + Math.floor(columnIndex / 26) - 1)
      : "";
  const targetColumn = `${columnPrefix}${columnLetter}`;

  const targetRange = `${sheetName}!${targetColumn}5:${targetColumn}`;

  const existingRosterData = await sheetsService.readSheet(
    sheetId,
    targetRange
  );
  const newRosterData = existingRosterData ? [...existingRosterData] : [];

  const flatUpdatedChampions = updatedChampions.flat();

  for (let i = 0; i < championNames.length; i++) {
    const sheetChampionName = championNames[i][0];
    const updatedChampion = flatUpdatedChampions.find(
      (c) => c.champion.name.toLowerCase() === sheetChampionName.toLowerCase()
    );

    if (updatedChampion) {
      if (i >= newRosterData.length) {
        for (let j = newRosterData.length; j <= i; j++) {
          newRosterData.push([]);
        }
      }
      let sheetRank = rank;
      if (isAscended && stars === 6) {
        sheetRank += 1;
      }
      newRosterData[i] = [
        `${sheetRank}${updatedChampion.isAwakened ? "*" : ""}`,
      ];
    }
  }

  await sheetsService.writeSheet(
    sheetId,
    targetRange,
    newRosterData
  );
  logger.info(
    { playerId, stars, count: flatUpdatedChampions.length },
    "Successfully updated roster in sheet"
  );
}

async function gridToString(grid: ChampionGridCell[][]): Promise<string> {
  const { prisma } = await import("../../../services/prismaService.js");
  let listString = "";
  const championNames = grid
    .flat()
    .map((cell) => cell.championName)
    .filter((name) => !!name) as string[];

  const champions = await prisma.champion.findMany({
    where: {
      name: { in: championNames },
    },
    select: { name: true, discordEmoji: true },
  });
  const emojiMap = new Map(champions.map((c) => [c.name, c.discordEmoji]));

  for (const row of grid) {
    for (const cell of row) {
      if (cell.championName) {
        const awakened = cell.isAwakened ? "★" : "☆";
        const rating = cell.powerRating ? ` (${cell.powerRating})` : "";
        const emoji = emojiMap.get(cell.championName) || "";
        listString += `- ${awakened} ${emoji} ${cell.championName}${rating}\n`;
      }
    }
  }
  return listString;
}
