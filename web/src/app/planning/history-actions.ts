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
  sampleVideoInternalId?: string;
  prefightChampions?: { name: string; images: any }[];
  players: {
    name: string;
    avatar: string | null;
    battlegroup: number | null;
    death: number;
    videoId?: string;
    prefightChampions: { name: string; images: any }[];
  }[];
};

// ... existing imports

export async function getBatchHistoricalCounters(
  requests: { nodeNumber: number, defenderId: number }[],
  options: {
      minSeason?: number;
      maxTier?: number;
      minTier?: number;
      seasons?: number[];
      allianceId?: string;
  } = {}
): Promise<Record<number, HistoricalFightStat[]>> {
  const session = await auth();
  if (!session?.user?.id || requests.length === 0) return {};

  const { minSeason, maxTier, minTier, seasons, allianceId } = options;

  // Create tuple list for the IN clause: ((1, 101), (2, 202), ...)
  const valueTuples = Prisma.join(
    requests.map((r) => Prisma.sql`(${r.nodeNumber}, ${r.defenderId})`)
  );

  const rawStats = await prisma.$queryRaw<any[]>`
    SELECT 
      "wn"."nodeNumber",
      "wf"."defenderId",
      "wf"."attackerId",
      COUNT(*) as "totalFights",
      SUM("wf"."death") as "totalDeaths",
      COUNT(CASE WHEN "wf"."death" = 0 THEN 1 END) as "solos",
      COUNT("wf"."videoId") as "videoCount",
      (SELECT "v"."url" FROM "WarVideo" "v" 
       JOIN "WarFight" "wf2" ON "wf2"."videoId" = "v"."id"
       WHERE "wf2"."attackerId" = "wf"."attackerId" 
       AND "wf2"."defenderId" = "wf"."defenderId"
       AND "wf2"."nodeId" = "wf"."nodeId"
       AND "v"."url" IS NOT NULL
       LIMIT 1
      ) as "sampleVideoUrl",
      (SELECT "v"."id" FROM "WarVideo" "v" 
       JOIN "WarFight" "wf2" ON "wf2"."videoId" = "v"."id"
       WHERE "wf2"."attackerId" = "wf"."attackerId" 
       AND "wf2"."defenderId" = "wf"."defenderId"
       AND "wf2"."nodeId" = "wf"."nodeId"
       AND "v"."id" IS NOT NULL
       LIMIT 1
      ) as "sampleVideoInternalId",
      (SELECT "wf2"."id" FROM "WarFight" "wf2"
       JOIN "WarVideo" "v" ON "wf2"."videoId" = "v"."id"
       WHERE "wf2"."attackerId" = "wf"."attackerId" 
       AND "wf2"."defenderId" = "wf"."defenderId"
       AND "wf2"."nodeId" = "wf"."nodeId"
       AND "v"."id" IS NOT NULL
       LIMIT 1
      ) as "sampleFightId"
    FROM "WarFight" "wf"
    JOIN "War" "w" ON "wf"."warId" = "w"."id"
    JOIN "WarNode" "wn" ON "wf"."nodeId" = "wn"."id"
    WHERE 
      ("wn"."nodeNumber", "wf"."defenderId") IN (${valueTuples})
      AND "wf"."attackerId" IS NOT NULL
      ${minSeason ? Prisma.sql`AND "w"."season" >= ${minSeason}` : Prisma.empty}
      ${maxTier ? Prisma.sql`AND "w"."warTier" <= ${maxTier}` : Prisma.empty}
      ${minTier ? Prisma.sql`AND "w"."warTier" >= ${minTier}` : Prisma.empty}
      ${seasons && seasons.length > 0 ? Prisma.sql`AND "w"."season" IN (${Prisma.join(seasons)})` : Prisma.empty}
      ${allianceId ? Prisma.sql`AND "w"."allianceId" = ${allianceId}` : Prisma.empty}
    GROUP BY "wn"."nodeNumber", "wf"."defenderId", "wf"."attackerId", "wf"."nodeId"
  `;

  // Fetch prefight champions for all sample fights found
  const sampleFightIds = rawStats.map((r: any) => r.sampleFightId).filter(Boolean);
  const fightPrefights = await prisma.warFight.findMany({
    where: { id: { in: sampleFightIds } },
    select: {
      id: true,
      prefightChampions: {
        select: { name: true, images: true }
      }
    }
  });
  const prefightMap = new Map(fightPrefights.map(f => [f.id, f.prefightChampions]));

  // Fetch all attackers involved
  const rawAttackerIds = [...new Set(rawStats.map((r: any) => r.attackerId))]; // dedupe
  const rawAttackers = await prisma.champion.findMany({
    where: { id: { in: rawAttackerIds as number[] } },
    select: { id: true, name: true, images: true }
  });
  const rawAttackerMap = new Map(rawAttackers.map(a => [a.id, a]));

  // Group results by nodeNumber
  const resultsByNode: Record<number, HistoricalFightStat[]> = {};

  for (const row of rawStats) {
      const attacker = rawAttackerMap.get(row.attackerId);
      if (!attacker) continue;

      const prefights = row.sampleFightId ? prefightMap.get(row.sampleFightId) : [];
      const nodeNum = row.nodeNumber;

      if (!resultsByNode[nodeNum]) {
          resultsByNode[nodeNum] = [];
      }

      resultsByNode[nodeNum].push({
          attackerId: attacker.id,
          attackerName: attacker.name,
          attackerImages: attacker.images,
          solos: Number(row.solos),
          deaths: Number(row.totalDeaths),
          totalFights: Number(row.totalFights),
          videoCount: Number(row.videoCount),
          sampleVideoUrl: row.sampleVideoUrl || undefined,
          sampleVideoInternalId: row.sampleVideoInternalId || undefined,
          prefightChampions: prefights || [],
          players: [],
      });
  }

  // Sort each node's list
  for (const key in resultsByNode) {
      resultsByNode[key].sort((a, b) => {
          if (b.solos !== a.solos) return b.solos - a.solos;
          return a.deaths - b.deaths;
      });
  }

  return resultsByNode;
}

export async function getHistoricalCounters(
  nodeNumber: number,
  defenderId: number,
  options: {
      minSeason?: number;
      maxTier?: number;
      minTier?: number;
      seasons?: number[];
      allianceId?: string;
  } = {}
): Promise<HistoricalFightStat[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const { minSeason, maxTier, minTier, seasons, allianceId } = options;

  // 1. Fetch detailed fight records
  const fights = await prisma.warFight.findMany({
    where: {
      node: { nodeNumber },
      defenderId,
      attackerId: { not: null },
      war: {
        AND: [
          minSeason ? { season: { gte: minSeason } } : {},
          maxTier ? { warTier: { lte: maxTier } } : {},
          minTier ? { warTier: { gte: minTier } } : {},
          seasons && seasons.length > 0 ? { season: { in: seasons } } : {},
          allianceId ? { allianceId } : {},
        ]
      }
    },
    include: {
      attacker: { select: { id: true, name: true, images: true } },
      player: { select: { ingameName: true, avatar: true } },
      video: { select: { id: true, url: true } },
      prefightChampions: { select: { name: true, images: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  // 2. Aggregate by Attacker
  const statsMap = new Map<number, HistoricalFightStat>();

  for (const fight of fights) {
    if (!fight.attacker) continue;

    const attackerId = fight.attacker.id;
    
    if (!statsMap.has(attackerId)) {
      statsMap.set(attackerId, {
        attackerId,
        attackerName: fight.attacker.name,
        attackerImages: fight.attacker.images,
        solos: 0,
        deaths: 0,
        totalFights: 0,
        videoCount: 0,
        sampleVideoUrl: undefined,
        sampleVideoInternalId: undefined,
        prefightChampions: [],
        players: []
      });
    }

    const stat = statsMap.get(attackerId)!;
    stat.totalFights++;
    stat.deaths += fight.death;
    if (fight.death === 0) stat.solos++;
    if (fight.video) {
        stat.videoCount++;
        // Keep the first video found as sample
        if (!stat.sampleVideoUrl && !stat.sampleVideoInternalId) {
            stat.sampleVideoUrl = fight.video.url || undefined;
            stat.sampleVideoInternalId = fight.video.id;
            stat.prefightChampions = fight.prefightChampions;
        }
    } else if (stat.prefightChampions!.length === 0 && fight.prefightChampions.length > 0) {
        // If no video yet, still capture prefights from a non-video fight if available
        stat.prefightChampions = fight.prefightChampions;
    }

    // Add to player list
    if (fight.player) {
      stat.players.push({
        name: fight.player.ingameName,
        avatar: fight.player.avatar,
        battlegroup: fight.battlegroup,
        death: fight.death,
        videoId: fight.video?.id,
        prefightChampions: fight.prefightChampions
      });
    }
  }

  // 3. Convert to array and sort
  return Array.from(statsMap.values()).sort((a, b) => {
      if (b.solos !== a.solos) return b.solos - a.solos;
      return a.deaths - b.deaths;
  });
}
