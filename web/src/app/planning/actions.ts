'use server';

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { WarStatus } from "@/lib/prisma";
import { WarFight, WarMapType, War, Alliance, WarResult } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import { ChampionImages } from "@/types/champion";

export interface ExtraChampion {
  id: string;
  warId: string;
  playerId: string;
  championId: number;
  battlegroup: number;
  champion: { id: number; name: string; images: ChampionImages };
}

const createWarSchema = z.object({
  season: z.number().min(1),
  warNumber: z.number().min(1).optional(),
  tier: z.number().min(1),
  opponent: z.string().min(1),
  mapType: z.nativeEnum(WarMapType).optional(),
});

export async function getActiveTactic(season: number, tier: number) {
    const session = await auth();
    if (!session?.user?.id) return null;

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
  const player = await getUserPlayerWithAlliance();

  if (!player || !player.allianceId || (!player.isOfficer && !player.isBotAdmin)) {
    throw new Error("You must be an Alliance Officer or Bot Admin to plan a war.");
  }

  const season = parseInt(formData.get("season") as string);
  const isOffSeason = formData.get("isOffSeason") === "true";
  const warNumber = !isOffSeason && formData.get("warNumber") ? parseInt(formData.get("warNumber") as string) : undefined;
  const tier = parseInt(formData.get("tier") as string);
  const opponent = formData.get("opponent") as string;
  const mapType = (formData.get("mapType") as WarMapType) || WarMapType.STANDARD;

  const data = createWarSchema.parse({ season, warNumber, tier, opponent, mapType });

  const war = await prisma.$transaction(async (tx) => {
    const newWar = await tx.war.create({
      data: {
        season: data.season,
        warNumber: data.warNumber,
        warTier: data.tier,
        enemyAlliance: data.opponent,
        allianceId: player.allianceId!,
        status: WarStatus.PLANNING,
        mapType: data.mapType,
      },
    });
    
    const warNodes = await tx.warNode.findMany();
    const nodeMap = new Map(warNodes.map(n => [n.nodeNumber, n.id]));

    const maxNodes = data.mapType === WarMapType.BIG_THING ? 10 : 50;

    const fightsData = [];
    for (let bg = 1; bg <= 3; bg++) {
      for (let nodeNum = 1; nodeNum <= maxNodes; nodeNum++) {
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
  const player = await getUserPlayerWithAlliance();

  if (!player || (!player.allianceId && !player.isBotAdmin)) {
      throw new Error("Unauthorized.");
  }

  if (!player.isOfficer && !player.isBotAdmin) {
    throw new Error("You must be an Alliance Officer or Bot Admin to update war fights.");
  }

  const { id, warId, battlegroup, nodeId, prefightUpdates, ...rest } = updatedFight;

  let targetWar: (War & { alliance: Alliance }) | null = null;

  if (id) {
      const existingFight = await prisma.warFight.findUnique({
          where: { id },
          include: { war: { include: { alliance: true } } }
      });

      if (!existingFight) throw new Error("Fight not found.");

      if (!player.isBotAdmin && existingFight.war.alliance.id !== player.allianceId) {
          throw new Error("Unauthorized: Cannot edit fights from another alliance.");
      }
      targetWar = existingFight.war;
      updatedFight.warId = existingFight.war.id;
  } else {
      if (!warId) throw new Error("War ID is required for creating a fight.");

      targetWar = await prisma.war.findUnique({
          where: { id: warId },
          include: { alliance: true }
      });

      if (!targetWar) throw new Error("War not found.");

      if (!player.isBotAdmin && targetWar.alliance.id !== player.allianceId) {
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
          deleteMany: {}, 
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
      if (!updatedFight.warId || !battlegroup || !nodeId) {
          throw new Error("WarFight ID is missing, and WarID/BG/NodeID are not sufficient to create it.");
      }
      
      if (targetWar.warNumber === null) {
        await prisma.warFight.create({
            data: {
                warId: updatedFight.warId,
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
            }
        });
      } else {
        const existingFight = await prisma.warFight.findFirst({
            where: { warId: updatedFight.warId, battlegroup, nodeId }
        });

        if (existingFight) {
            await prisma.warFight.update({
                where: { id: existingFight.id },
                data: updateData
            });
        } else {
            await prisma.warFight.create({
                data: {
                    warId: updatedFight.warId,
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
                }
            });
        }
      }
  }
}

export async function getPlayerRoster(playerId: string) {
  const requester = await getUserPlayerWithAlliance();
  
  if (!requester) return [];

  const targetPlayer = await prisma.player.findUnique({
    where: { id: playerId },
  });

  if (!targetPlayer) return [];
  
  if (!requester.isBotAdmin && requester.allianceId !== targetPlayer.allianceId) {
    return [];
  }

  return await prisma.roster.findMany({
    where: { playerId },
    include: { 
      champion: {
        include: { tags: true }
      } 
    },
    orderBy: [
      { stars: 'desc' },
      { rank: 'desc' },
      { isAscended: 'desc' },
      { champion: { name: 'asc' } }
    ]
  });
}

export async function getOwnersOfChampion(championId: number, allianceId: string, battlegroup?: number) {
  const requester = await getUserPlayerWithAlliance();

  if (!requester) return [];
  
  if (!requester.isBotAdmin && requester.allianceId !== allianceId) {
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
  const player = await getUserPlayerWithAlliance();

  if (!player || (!player.allianceId && !player.isBotAdmin)) {
      throw new Error("Unauthorized");
  }

  if (!player.isOfficer && !player.isBotAdmin) {
    throw new Error("You must be an Alliance Officer or Bot Admin to update war status.");
  }

  if (!player.isBotAdmin) {
      const war = await prisma.war.findUnique({ where: { id: warId } });
      if (!war || war.allianceId !== player.allianceId) {
          throw new Error("Unauthorized.");
      }
  }

  await prisma.war.update({
    where: { id: warId },
    data: { status },
  });
}

export async function deleteWar(warId: string) {
  const player = await getUserPlayerWithAlliance();

  if (!player || (!player.allianceId && !player.isBotAdmin)) {
      throw new Error("Unauthorized");
  }

  if (!player.isOfficer && !player.isBotAdmin) {
    throw new Error("You must be an Alliance Officer or Bot Admin to delete a war.");
  }

  if (!player.isBotAdmin) {
      const war = await prisma.war.findUnique({ where: { id: warId } });
      if (!war || war.allianceId !== player.allianceId) {
          throw new Error("Unauthorized.");
      }
  }

  await prisma.war.delete({ where: { id: warId } });

  revalidatePath("/planning");
}

export async function addExtraChampion(warId: string, battlegroup: number, playerId: string, championId: number) {
  const player = await getUserPlayerWithAlliance();

  if (!player || (!player.allianceId && !player.isBotAdmin)) {
      throw new Error("Unauthorized");
  }

  if (!player.isOfficer && !player.isBotAdmin) {
    throw new Error("You must be an Alliance Officer or Bot Admin to manage extra champions.");
  }

  const targetWar = await prisma.war.findUnique({ where: { id: warId } });

  if (!targetWar) throw new Error("War not found.");

  if (!player.isBotAdmin && targetWar.allianceId !== player.allianceId) {
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
  const player = await getUserPlayerWithAlliance();

  if (!player || (!player.allianceId && !player.isBotAdmin)) {
      throw new Error("Unauthorized");
  }

  if (!player.isOfficer && !player.isBotAdmin) {
    throw new Error("You must be an Alliance Officer or Bot Admin to manage extra champions.");
  }

  const extraChampionToDelete = await prisma.warExtraChampion.findUnique({
      where: { id },
      include: { war: true }
  });

  if (!extraChampionToDelete) {
      throw new Error("Extra Champion not found.");
  }

  if (!player.isBotAdmin && extraChampionToDelete.war.allianceId !== player.allianceId) {
      throw new Error("Unauthorized: Cannot delete extra champions from another alliance's war.");
  }

  await prisma.warExtraChampion.delete({ where: { id } });
}

export async function addWarBan(warId: string, championId: number) {
    const player = await getUserPlayerWithAlliance();

    if (!player || (!player.allianceId && !player.isBotAdmin)) {
        throw new Error("Unauthorized");
    }

    if (!player.isOfficer && !player.isBotAdmin) {
        throw new Error("You must be an Alliance Officer or Bot Admin to manage war bans.");
    }

    const targetWar = await prisma.war.findUnique({ where: { id: warId } });

    if (!targetWar) throw new Error("War not found.");

    if (!player.isBotAdmin && targetWar.allianceId !== player.allianceId) {
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
    const player = await getUserPlayerWithAlliance();

    if (!player || (!player.allianceId && !player.isBotAdmin)) {
        throw new Error("Unauthorized");
    }

    if (!player.isOfficer && !player.isBotAdmin) {
        throw new Error("You must be an Alliance Officer or Bot Admin to manage war bans.");
    }

    const banToDelete = await prisma.warBan.findUnique({
        where: { id },
        include: { war: true }
    });

    if (!banToDelete) throw new Error("Ban not found.");

    if (!player.isBotAdmin && banToDelete.war.allianceId !== player.allianceId) {
        throw new Error("Unauthorized: Cannot delete bans from another alliance's war.");
    }

    await prisma.warBan.delete({ where: { id } });
}

export async function getExtraChampions(warId: string, battlegroup: number): Promise<ExtraChampion[]> {
  const player = await getUserPlayerWithAlliance();

  if (!player || (!player.allianceId && !player.isBotAdmin)) return [];
  
  const extras = await prisma.warExtraChampion.findMany({
    where: {
      warId,
      battlegroup,
      ...(player.isBotAdmin ? {} : { war: { allianceId: player.allianceId as string } })
    },
    include: {
        champion: { select: { id: true, name: true, images: true } }
    }
  });

  return extras.map(e => ({
    id: e.id,
    warId: e.warId,
    playerId: e.playerId,
    championId: e.championId,
    battlegroup: e.battlegroup,
    champion: {
      id: e.champion.id,
      name: e.champion.name,
      images: e.champion.images as unknown as ChampionImages
    }
  }));
}

export async function distributePlan(warId: string, battlegroup?: number) {
  const player = await getUserPlayerWithAlliance();

  if (!player || (!player.allianceId && !player.isBotAdmin)) {
      throw new Error("Unauthorized");
  }

  if (!player.isOfficer && !player.isBotAdmin) {
    throw new Error("You must be an Alliance Officer or Bot Admin to distribute plans.");
  }

  const war = await prisma.war.findUnique({ where: { id: warId } });

  if (!war) throw new Error("War not found.");

  if (!player.isBotAdmin && war.allianceId !== player.allianceId) {
      throw new Error("Unauthorized: Cannot distribute plans for another alliance.");
  }

  await prisma.botJob.create({
    data: {
      type: 'DISTRIBUTE_WAR_PLAN',
      payload: {
        allianceId: war.allianceId,
        warId,
        battlegroup
      } as { allianceId: string; warId: string; battlegroup?: number }
    }
  });

  return { success: true };
}

export async function updateWarDetails(warId: string, data: Partial<War>) {
  const player = await getUserPlayerWithAlliance();

  if (!player || (!player.allianceId && !player.isBotAdmin)) {
      throw new Error("Unauthorized");
  }

  if (!player.isOfficer && !player.isBotAdmin) {
    throw new Error("You must be an Alliance Officer or Bot Admin to update war details.");
  }

  const war = await prisma.war.findUnique({ where: { id: warId } });
  if (!war) throw new Error("War not found");

  if (!player.isBotAdmin && war.allianceId !== player.allianceId) {
      throw new Error("Unauthorized: Cannot update wars outside your alliance.");
  }

  await prisma.war.update({
    where: { id: warId },
    data: {
        name: data.name,
        enemyAlliance: data.enemyAlliance,
        season: data.season,
        warNumber: data.warNumber,
        warTier: data.warTier,
        mapType: data.mapType,
        result: data.result,
        enemyDeaths: data.enemyDeaths,
    },
  });

  revalidatePath("/planning");
  revalidatePath(`/planning/${warId}`);
}
