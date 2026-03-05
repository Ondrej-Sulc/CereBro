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



export async function deleteRoster(
  where: Prisma.RosterWhereInput
): Promise<string> {
  const { prisma } = await import("./prismaService.js");
  const { count } = await prisma.roster.deleteMany({
    where,
  });
  return `Successfully deleted ${count} champions from the roster`;
}