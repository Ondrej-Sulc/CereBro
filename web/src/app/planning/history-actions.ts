'use server';

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export type HistoricalFightStat = {
  attackerId: number;
  attackerName: string;
  attackerImages: any;
  solos: number;
  deaths: number;
  totalFights: number;
  videoCount: number;
  sampleVideoUrl?: string;
  sampleVideoInternalId?: string; // New field for internal video ID
};

export async function getHistoricalCounters(
  nodeNumber: number,
  defenderId: number,
  minSeason?: number,
  maxTier?: number
): Promise<HistoricalFightStat[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  // Raw query to get stats + a sample video URL and its internal ID
  const rawStats = await prisma.$queryRaw<any[]>`
    SELECT 
      "wf"."attackerId",
      COUNT(*) as "totalFights",
      SUM("wf"."death") as "totalDeaths",
      COUNT(CASE WHEN "wf"."death" = 0 THEN 1 END) as "solos",
      COUNT("wf"."videoId") as "videoCount",
      (SELECT "v"."url" FROM "WarVideo" "v" 
       JOIN "WarFight" "wf2" ON "wf2"."videoId" = "v"."id"
       WHERE "wf2"."attackerId" = "wf"."attackerId" 
       AND "wf2"."defenderId" = ${defenderId}
       AND "wf2"."nodeId" IN (SELECT "id" FROM "WarNode" WHERE "nodeNumber" = ${nodeNumber})
       AND "v"."url" IS NOT NULL
       LIMIT 1
      ) as "sampleVideoUrl",
      (SELECT "v"."id" FROM "WarVideo" "v" 
       JOIN "WarFight" "wf2" ON "wf2"."videoId" = "v"."id"
       WHERE "wf2"."attackerId" = "wf"."attackerId" 
       AND "wf2"."defenderId" = ${defenderId}
       AND "wf2"."nodeId" IN (SELECT "id" FROM "WarNode" WHERE "nodeNumber" = ${nodeNumber})
       AND "v"."id" IS NOT NULL
       LIMIT 1
      ) as "sampleVideoInternalId"
    FROM "WarFight" "wf"
    JOIN "War" "w" ON "wf"."warId" = "w"."id"
    JOIN "WarNode" "wn" ON "wf"."nodeId" = "wn"."id"
    WHERE 
      "wn"."nodeNumber" = ${nodeNumber}
      AND "wf"."defenderId" = ${defenderId}
      AND "wf"."attackerId" IS NOT NULL
      ${minSeason ? Prisma.sql`AND "w"."season" >= ${minSeason}` : Prisma.empty}
      ${maxTier ? Prisma.sql`AND "w"."warTier" <= ${maxTier}` : Prisma.empty}
    GROUP BY "wf"."attackerId"
  `;

  // Map raw results
  const finalResults: HistoricalFightStat[] = [];
  
  // We need to fetch attacker details for the raw results
  const rawAttackerIds = rawStats.map((r: any) => r.attackerId);
  const rawAttackers = await prisma.champion.findMany({
    where: { id: { in: rawAttackerIds } },
    select: { id: true, name: true, images: true }
  });
  const rawAttackerMap = new Map(rawAttackers.map(a => [a.id, a]));

  for (const row of rawStats) {
      const attacker = rawAttackerMap.get(row.attackerId);
      if (!attacker) continue;

      finalResults.push({
          attackerId: attacker.id,
          attackerName: attacker.name,
          attackerImages: attacker.images,
          solos: Number(row.solos),
          deaths: Number(row.totalDeaths),
          totalFights: Number(row.totalFights),
          videoCount: Number(row.videoCount),
          sampleVideoUrl: row.sampleVideoUrl || undefined,
          sampleVideoInternalId: row.sampleVideoInternalId || undefined
      });
  }

  // Sort by Solos desc, then Deaths asc
  return finalResults.sort((a, b) => {
      if (b.solos !== a.solos) return b.solos - a.solos;
      return a.deaths - b.deaths;
  });
}
