import { Roster, Prisma, Champion } from "@prisma/client";
import logger from "./loggerService";

export type RosterWithChampion = Roster & { champion: Champion };

export async function getRoster(
  playerId: string,
  stars: number | null,
  rank: number | null,
  isAscended: boolean | null
): Promise<RosterWithChampion[] | string> {
  const { prisma } = await import("./prismaService.js");
  const where: any = { playerId };
  if (stars) {
    where.stars = stars;
  }
  if (rank) {
    where.rank = rank;
  }
  if (isAscended !== null) {
    where.isAscended = isAscended;
  }

  const rosterEntries = await prisma.roster.findMany({
    where,
    include: { champion: true },
    orderBy: [{ stars: "desc" }, { rank: "desc" }],
  });

  if (rosterEntries.length === 0) {
    return "No champions found in the roster that match the criteria.";
  }

  return rosterEntries;
}

export async function importRosterFromSheet(playerId: string) {
  const { prisma } = await import("./prismaService.js");
  const { config } = await import("../config.js");
  const { sheetsService } = await import("./sheetsService.js");
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) {
    logger.error(`Player with ID ${playerId} not found.`);
    return;
  }

  const sheetName = "Roster";
  const headerRange = `${sheetName}!B2:BI2`;
  const championNamesRange = `${sheetName}!A5:A`;

  const [playerNames, championNames] = await sheetsService.readSheets(
    config.MCOC_SHEET_ID,
    [headerRange, championNamesRange]
  );

  if (!playerNames || !championNames) {
    logger.error("Failed to read player or champion names from the sheet.");
    return;
  }

  const playerIndex = playerNames[0].findIndex(
    (name: string) => name.toLowerCase() === player.ingameName.toLowerCase()
  );

  if (playerIndex === -1) {
    logger.info(
      `Player ${player.ingameName} not found in the sheet, skipping roster import.`
    );
    return;
  }

  const rosterDataToCreate: Prisma.RosterCreateManyInput[] = [];
  const allChampions = await prisma.champion.findMany();
  const championMap = new Map(
    allChampions.map((c) => [c.name.toLowerCase(), c])
  );

  for (const stars of [6, 7]) {
    const columnIndex = playerIndex + (stars === 6 ? 1 : 2);
    const columnLetter = String.fromCharCode(65 + (columnIndex % 26));
    const columnPrefix =
      columnIndex >= 26
        ? String.fromCharCode(65 + Math.floor(columnIndex / 26) - 1)
        : "";
    const targetColumn = `${columnPrefix}${columnLetter}`;
    const targetRange = `${sheetName}!${targetColumn}5:${targetColumn}`;

    const rosterColumn = await sheetsService.readSheet(
      config.MCOC_SHEET_ID,
      targetRange
    );

    if (rosterColumn) {
      for (let i = 0; i < rosterColumn.length; i++) {
        const sheetValue = rosterColumn[i][0];
        if (sheetValue && championNames[i] && championNames[i][0]) {
          const champion = championMap.get(championNames[i][0].toLowerCase());
          if (champion) {
            const sheetRank = parseInt(sheetValue.replace("*", ""));
            const isAwakened = sheetValue.includes("*");
            let dbRank = sheetRank;
            let isAscended = false;

            if (stars === 6 && sheetRank === 6) {
              dbRank = 5;
              isAscended = true;
            }

            rosterDataToCreate.push({
              playerId,
              championId: champion.id,
              stars,
              rank: dbRank,
              isAwakened,
              isAscended,
            });
          }
        }
      }
    }
  }

  if (rosterDataToCreate.length > 0) {
    await prisma.roster.createMany({
      data: rosterDataToCreate,
      skipDuplicates: true,
    });
    logger.info(
      `Successfully imported ${rosterDataToCreate.length} champions for ${player.ingameName}.`
    );
  }
}

export async function deleteRoster(
  where: Prisma.RosterWhereInput
): Promise<string> {
  const { prisma } = await import("./prismaService.js");
  const { count } = await prisma.roster.deleteMany({
    where,
  });
  return `Successfully deleted ${count} champions from the roster`;
}