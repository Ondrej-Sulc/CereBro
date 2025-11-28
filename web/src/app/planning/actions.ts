'use server';

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { WarStatus } from "@/lib/prisma";
import { WarFight } from "@prisma/client";
import { redirect } from "next/navigation";
import { z } from "zod";

const createWarSchema = z.object({
  season: z.number().min(1),
  warNumber: z.number().min(1).optional(),
  tier: z.number().min(1),
  opponent: z.string().min(1),
});

export async function createWar(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  // 1. Get the NextAuth User's Discord ID
  const account = await prisma.account.findFirst({
    where: {
      userId: session.user.id,
      provider: "discord",
    },
  });

  if (!account?.providerAccountId) {
    throw new Error("No linked Discord account found.");
  }

  // 2. Find the Player and check Officer status
  const player = await prisma.player.findFirst({
    where: { discordId: account.providerAccountId },
    include: { alliance: true },
  });

  if (!player || !player.allianceId || (!player.isOfficer && !player.isBotAdmin)) {
    throw new Error("You must be an Alliance Officer or Bot Admin to plan a war.");
  }

  const season = parseInt(formData.get("season") as string);
  const warNumber = formData.get("warNumber") ? parseInt(formData.get("warNumber") as string) : undefined;
  const tier = parseInt(formData.get("tier") as string);
  const opponent = formData.get("opponent") as string;

  // Validate
  const data = createWarSchema.parse({ season, warNumber, tier, opponent });

  // 3. Create War and Fights
  const war = await prisma.$transaction(async (tx) => {
    // Create War
    const newWar = await tx.war.create({
      data: {
        season: data.season,
        warNumber: data.warNumber,
        warTier: data.tier,
        enemyAlliance: data.opponent,
        allianceId: player.allianceId!,
        status: WarStatus.PLANNING,
      },
    });

    // Generate Fights (3 BGs, 50 Nodes)
    const fightsData = [];
    for (let bg = 1; bg <= 3; bg++) {
      for (let node = 1; node <= 50; node++) {
        // We need to find the node ID from WarNode table? 
        // Or assume they exist? "nodeNumber" is unique.
        // We should fetch the node ID for nodeNumber X.
        // Ideally we fetch all WarNodes first.
      }
    }
    
    // Fetch all nodes mapping
    const warNodes = await tx.warNode.findMany();
    const nodeMap = new Map(warNodes.map(n => [n.nodeNumber, n.id]));

    for (let bg = 1; bg <= 3; bg++) {
      for (let nodeNum = 1; nodeNum <= 50; nodeNum++) {
        const nodeId = nodeMap.get(nodeNum);
        if (nodeId) {
            fightsData.push({
                warId: newWar.id,
                battlegroup: bg,
                nodeId: nodeId,
                death: 0,
            });
        }
      }
    }

    await tx.warFight.createMany({
      data: fightsData,
    });

    return newWar;
  });

  redirect(`/planning/${war.id}`);
}

export async function updateWarFight(updatedFight: Partial<WarFight> & { prefightChampionIds?: number[] }) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  // Basic authorization: Ensure user is an officer of the alliance
  const account = await prisma.account.findFirst({
    where: {
      userId: session.user.id,
      provider: "discord",
    },
  });

  if (!account?.providerAccountId) {
    throw new Error("No linked Discord account found.");
  }

  const player = await prisma.player.findFirst({
    where: { discordId: account.providerAccountId },
    include: { alliance: true },
  });

  if (!player || !player.allianceId || (!player.isOfficer && !player.isBotAdmin)) {
    throw new Error("You must be an Alliance Officer to update war fights.");
  }

  const { id, warId, battlegroup, nodeId, prefightChampionIds, ...rest } = updatedFight;

  const updateData = {
      attackerId: rest.attackerId,
      defenderId: rest.defenderId,
      playerId: rest.playerId,
      death: rest.death,
      notes: rest.notes,
      prefightChampions: prefightChampionIds ? {
          set: prefightChampionIds.map(cid => ({ id: cid })),
      } : undefined,
  };

  if (id) {
      await prisma.warFight.update({
          where: { id },
          data: updateData,
      });
  } else {
      if (!warId || !battlegroup || !nodeId) {
          throw new Error("WarFight ID is missing, and WarID/BG/NodeID are not sufficient to create it.");
      }

      await prisma.warFight.upsert({
          where: {
              warId_battlegroup_nodeId: { warId, battlegroup, nodeId }
          },
          create: {
              warId,
              battlegroup,
              nodeId,
              attackerId: rest.attackerId,
              defenderId: rest.defenderId,
              playerId: rest.playerId,
              death: rest.death ?? 0,
              notes: rest.notes,
              prefightChampions: prefightChampionIds ? {
                  connect: prefightChampionIds.map(cid => ({ id: cid }))
              } : undefined
          },
          update: updateData
      });
  }
}

export async function getPlayerRoster(playerId: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  // Verify access rights (same alliance)
  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, provider: "discord" },
  });
  if (!account?.providerAccountId) return [];

  const requester = await prisma.player.findFirst({
    where: { discordId: account.providerAccountId },
  });
  const targetPlayer = await prisma.player.findUnique({
    where: { id: playerId },
  });

  if (!requester || !targetPlayer || requester.allianceId !== targetPlayer.allianceId) {
    return [];
  }

  return await prisma.roster.findMany({
    where: { playerId },
    include: { champion: true },
    orderBy: [
      { stars: 'desc' },
      { rank: 'desc' },
      { isAscended: 'desc' },
      { champion: { name: 'asc' } }
    ]
  });
}

export async function getOwnersOfChampion(championId: number, allianceId: string, battlegroup?: number) {
  const session = await auth();
  if (!session?.user?.id) return [];

  // Verify access (must be in same alliance)
  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, provider: "discord" },
  });
  if (!account?.providerAccountId) return [];
  const requester = await prisma.player.findFirst({
    where: { discordId: account.providerAccountId },
  });

  if (!requester || requester.allianceId !== allianceId) {
    return [];
  }

  return await prisma.roster.findMany({
    where: { 
      championId,
      player: { 
        allianceId,
        ...(battlegroup ? { battlegroup } : {})
      }
    },
    include: { player: true },
    orderBy: [
      { stars: 'desc' },
      { rank: 'desc' },
      { isAscended: 'desc' },
      { player: { ingameName: 'asc' } }
    ]
  });
}
