'use server';

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { WarStatus } from "@/lib/prisma";
import { WarFight } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const createWarSchema = z.object({
  season: z.number().min(1),
  warNumber: z.number().min(1).optional(),
  tier: z.number().min(1),
  opponent: z.string().min(1),
});

export async function getActiveTactic(season: number, tier: number) {
    const session = await auth();
    if (!session?.user?.id) return null;

    // Find a tactic that matches season and includes the tier in its range
    // minTier (Best) <= tier AND maxTier (Worst) >= tier
    // e.g. Tactic 1-5. War Tier 3. (1 <= 3) && (5 >= 3) -> Match.
    const tactic = await prisma.warTactic.findFirst({
        where: {
            season,
            minTier: { lte: tier },
            maxTier: { gte: tier }
        },
        include: {
            attackTag: true,
            defenseTag: true
        }
    });

    return tactic;
}

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
    
    // Fetch all nodes mapping
    const warNodes = await tx.warNode.findMany();
    const nodeMap = new Map(warNodes.map(n => [n.nodeNumber, n.id]));

    const fightsData = [];
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

export async function updateWarFight(updatedFight: Partial<WarFight> & { 
  prefightUpdates?: { championId: number; playerId?: string | null }[] 
}) {
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

  const { id, warId, battlegroup, nodeId, prefightUpdates, ...rest } = updatedFight;

  // Strict Alliance Ownership Validation
  if (id) {
      // Case 1: Update by ID
      const existingFight = await prisma.warFight.findUnique({
          where: { id },
          include: { war: true }
      });

      if (!existingFight) {
          throw new Error("Fight not found.");
      }

      if (existingFight.war.allianceId !== player.allianceId) {
          throw new Error("Unauthorized: Cannot edit fights from another alliance.");
      }
  } else {
      // Case 2: Create/Upsert by Context
      if (!warId) {
          throw new Error("War ID is required for creating a fight.");
      }

      const targetWar = await prisma.war.findUnique({
          where: { id: warId }
      });

      if (!targetWar) {
          throw new Error("War not found.");
      }

      if (targetWar.allianceId !== player.allianceId) {
          throw new Error("Unauthorized: Cannot edit fights from another alliance.");
      }
  }

  const updateData = {
      attackerId: rest.attackerId,
      defenderId: rest.defenderId,
      playerId: rest.playerId,
      death: rest.death,
      notes: rest.notes,
      prefightChampions: prefightUpdates ? {
          deleteMany: {}, // Clear existing
          create: prefightUpdates.map(p => ({
              championId: p.championId,
              playerId: p.playerId
          }))
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

      // For upsert, we first check if it exists to get the ID?
      // upsert with explicit relations is tricky if we want to "replace" existing.
      // But wait, if it creates, it works. If it updates, it runs updateData logic above.
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
              prefightChampions: prefightUpdates ? {
                  create: prefightUpdates.map(p => ({
                      championId: p.championId,
                      playerId: p.playerId
                  }))
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

export async function updateWarStatus(warId: string, status: WarStatus) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

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
    throw new Error("You must be an Alliance Officer to update war status.");
  }

  await prisma.war.update({
    where: {
      id: warId,
      allianceId: player.allianceId,
    },
    data: {
      status,
    },
  });
}

export async function deleteWar(warId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

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
    throw new Error("You must be an Alliance Officer to delete a war.");
  }

  await prisma.war.delete({
    where: {
      id: warId,
      allianceId: player.allianceId,
    },
  });

  revalidatePath("/planning");
}

export async function addExtraChampion(warId: string, battlegroup: number, playerId: string, championId: number) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, provider: "discord" },
  });
  if (!account?.providerAccountId) throw new Error("No linked Discord account found.");

  const player = await prisma.player.findFirst({
    where: { discordId: account.providerAccountId },
    include: { alliance: true },
  });

  if (!player || !player.allianceId || (!player.isOfficer && !player.isBotAdmin)) {
    throw new Error("You must be an Alliance Officer to manage extra champions.");
  }

  // Verify the War belongs to the user's alliance
  const targetWar = await prisma.war.findUnique({
      where: { id: warId }
  });

  if (!targetWar || targetWar.allianceId !== player.allianceId) {
      throw new Error("Unauthorized: Cannot add extra champions to a war outside your alliance.");
  }

  const newExtra = await prisma.warExtraChampion.create({
    data: {
      warId,
      battlegroup,
      playerId,
      championId,
    },
    include: {
        champion: { select: { id: true, name: true, images: true } }
    }
  });

  return newExtra;
}

export async function removeExtraChampion(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, provider: "discord" },
  });
  if (!account?.providerAccountId) throw new Error("No linked Discord account found.");

  const player = await prisma.player.findFirst({
    where: { discordId: account.providerAccountId },
    include: { alliance: true },
  });

  if (!player || !player.allianceId || (!player.isOfficer && !player.isBotAdmin)) {
    throw new Error("You must be an Alliance Officer to manage extra champions.");
  }

  // Verify the WarExtraChampion belongs to the user's alliance
  const extraChampionToDelete = await prisma.warExtraChampion.findUnique({
      where: { id },
      include: { war: true }
  });

  if (!extraChampionToDelete) {
      throw new Error("Extra Champion not found.");
  }

  if (extraChampionToDelete.war.allianceId !== player.allianceId) {
      throw new Error("Unauthorized: Cannot delete extra champions from another alliance's war.");
  }

  await prisma.warExtraChampion.delete({ where: { id } });
}

export async function addWarBan(warId: string, championId: number) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const account = await prisma.account.findFirst({
        where: { userId: session.user.id, provider: "discord" },
    });
    if (!account?.providerAccountId) throw new Error("No linked Discord account found.");

    const player = await prisma.player.findFirst({
        where: { discordId: account.providerAccountId },
        include: { alliance: true },
    });

    if (!player || !player.allianceId || (!player.isOfficer && !player.isBotAdmin)) {
        throw new Error("You must be an Alliance Officer to manage war bans.");
    }

    const targetWar = await prisma.war.findUnique({
        where: { id: warId }
    });

    if (!targetWar || targetWar.allianceId !== player.allianceId) {
        throw new Error("Unauthorized: Cannot add bans to a war outside your alliance.");
    }

    const newBan = await prisma.warBan.create({
        data: {
            warId,
            championId,
        },
        include: {
            champion: { select: { id: true, name: true, images: true } }
        }
    });
    
    return newBan;
}

export async function removeWarBan(id: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const account = await prisma.account.findFirst({
        where: { userId: session.user.id, provider: "discord" },
    });
    if (!account?.providerAccountId) throw new Error("No linked Discord account found.");

    const player = await prisma.player.findFirst({
        where: { discordId: account.providerAccountId },
        include: { alliance: true },
    });

    if (!player || !player.allianceId || (!player.isOfficer && !player.isBotAdmin)) {
        throw new Error("You must be an Alliance Officer to manage war bans.");
    }

    const banToDelete = await prisma.warBan.findUnique({
        where: { id },
        include: { war: true }
    });

    if (!banToDelete) {
        throw new Error("Ban not found.");
    }

    if (banToDelete.war.allianceId !== player.allianceId) {
        throw new Error("Unauthorized: Cannot delete bans from another alliance's war.");
    }

    await prisma.warBan.delete({ where: { id } });
}

export async function getExtraChampions(warId: string, battlegroup: number) {
  const session = await auth();
  if (!session?.user?.id) return [];

  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, provider: "discord" },
  });
  if (!account?.providerAccountId) return [];

  const player = await prisma.player.findFirst({
    where: { discordId: account.providerAccountId },
  });

    if (!player || !player.allianceId) return [];
  
    return await prisma.warExtraChampion.findMany({
      where: {
        warId,
        battlegroup,
        war: { allianceId: player.allianceId }, // Filter by alliance ID
      },
      include: {
          champion: { select: { id: true, name: true, images: true } }
      }
    });
  }
