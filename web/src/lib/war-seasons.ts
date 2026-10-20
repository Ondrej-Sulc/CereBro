import { prisma } from "@/lib/prisma";
import { getFromCache } from "@/lib/cache";

/** Call with the alliance authorized by the owning server page. */
export async function getAvailableSeasons(allianceId: string): Promise<number[]> {
  return getFromCache(`distinct-seasons-${allianceId}`, 3600, async () => {
    const seasons = await prisma.war.findMany({
      where: { allianceId },
      distinct: ["season"],
      select: { season: true },
      orderBy: { season: "desc" },
    });
    return seasons.map(war => war.season).filter(season => season > 0);
  });
}
