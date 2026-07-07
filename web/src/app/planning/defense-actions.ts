'use server';

import { prisma } from "@/lib/prisma";
import { WarMapType, WarDefensePlacement } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import { canPlanAllianceWar } from "@/lib/alliance-permissions";
import { withActionContext } from "@/lib/with-request-context";
import { createMissingDiscordChannelMessage, findMissingBattlegroupChannels } from "@/lib/discord-config-validation";
import { MapImageService, NodeAssignment, LegendItem } from "@cerebro/core/services/mapImageService";
import { warNodesData, warNodesDataBig } from "@cerebro/core/data/war-planning/nodes-data";
import { getChampionImageUrl } from "@/lib/championHelper";

export type DistributeDefensePlanResult =
  | { success: true }
  | { success: false; error: string };

const createDefensePlanSchema = z.object({
  name: z.string().min(1),
  mapType: z.nativeEnum(WarMapType).optional(),
});

export const createDefensePlan = withActionContext('createDefensePlan', async (formData: FormData) => {
  const player = await getUserPlayerWithAlliance();

  if (!player) {
    throw new Error("Unauthorized: Player profile not found.");
  }

  // Even Bot Admins need to be in an alliance to create a plan for it (in the current UI context)
  if (!player.allianceId || !canPlanAllianceWar(player, player.isBotAdmin)) {
    throw new Error("You must be an Alliance Planner, Officer, or Bot Admin (and in an alliance) to create a defense plan.");
  }

  const name = formData.get("name") as string;
  const mapType = (formData.get("mapType") as WarMapType) || WarMapType.STANDARD;

  const data = createDefensePlanSchema.parse({ name, mapType });

  const plan = await prisma.$transaction(async (tx) => {
    const newPlan = await tx.warDefensePlan.create({
      data: {
        name: data.name,
        mapType: data.mapType,
        allianceId: player.allianceId!,
      },
    });
    
    // Create empty placements for all nodes
    const maxNodes = data.mapType === WarMapType.BIG_THING ? 10 : 50;
    const warNodes = await tx.warNode.findMany({
      where: {
        nodeNumber: {
          lte: maxNodes
        }
      }
    });
    const nodeMap = new Map(warNodes.map(n => [n.nodeNumber, n.id]));

    const placementsData = [];
    for (let bg = 1; bg <= 3; bg++) {
        for (let nodeNum = 1; nodeNum <= maxNodes; nodeNum++) {
            const nodeId = nodeMap.get(nodeNum);
            if (nodeId) {
                placementsData.push({
                    planId: newPlan.id,
                    battlegroup: bg,
                    nodeId: nodeId,
                });
            }
        }
    }

    await tx.warDefensePlacement.createMany({
      data: placementsData,
    });

    return newPlan;
  });

  redirect(`/planning/defense/${plan.id}`);
});

export const updateDefensePlacement = withActionContext('updateDefensePlacement', async (updatedPlacement: Partial<WarDefensePlacement>) => {
  const player = await getUserPlayerWithAlliance();

  if (!player) {
    throw new Error("Unauthorized: Player profile not found.");
  }

  const isBotAdmin = player.isBotAdmin;

  if (!canPlanAllianceWar(player, player.isBotAdmin) || (!isBotAdmin && !player.allianceId)) {
    throw new Error("You must be an Alliance Planner, Officer, or Bot Admin to update defense placements.");
  }

  const { id, planId, nodeId, battlegroup, ...rest } = updatedPlacement;

  // Strict Alliance Ownership Validation
  if (id) {
      const existingPlacement = await prisma.warDefensePlacement.findUnique({
          where: { id },
          include: { plan: { include: { alliance: true } } }
      });

      if (!existingPlacement) {
          throw new Error("Placement not found.");
      }

      if (!isBotAdmin && existingPlacement.plan.alliance.id !== player.allianceId) {
          throw new Error("Unauthorized: Cannot edit placements from another alliance.");
      }
  } else {
      if (!planId) {
          throw new Error("Plan ID is required.");
      }

      const targetPlan = await prisma.warDefensePlan.findUnique({
          where: { id: planId },
          include: { alliance: true }
      });

      if (!targetPlan) {
          throw new Error("Plan not found.");
      }

      if (!isBotAdmin && targetPlan.alliance.id !== player.allianceId) {
          throw new Error("Unauthorized: Cannot edit placements from another alliance.");
      }
  }

  const updateData = {
      defenderId: rest.defenderId,
      playerId: rest.playerId,
      starLevel: rest.starLevel,
  };

    if (id) {
        await prisma.warDefensePlacement.update({
            where: { id },
            data: updateData,
        });
    } else {
        // Upsert logic with new constraint
        if (!planId || !nodeId || !battlegroup) {
            throw new Error("PlanID, NodeID and Battlegroup required.");
        }
        
        await prisma.warDefensePlacement.upsert({
            where: {
                planId_battlegroup_nodeId: { planId, battlegroup, nodeId }
            },
            update: updateData,
            create: {
                planId,
                battlegroup,
                nodeId,
                defenderId: rest.defenderId,
                playerId: rest.playerId,
                starLevel: rest.starLevel
            }
        });
    }
});

export const deleteDefensePlan = withActionContext('deleteDefensePlan', async (planId: string) => {
  const player = await getUserPlayerWithAlliance();

  if (!player) {
    throw new Error("Unauthorized: Player profile not found.");
  }

  const isBotAdmin = player.isBotAdmin;

  if (!canPlanAllianceWar(player, player.isBotAdmin) || (!isBotAdmin && !player.allianceId)) {
    throw new Error("You must be an Alliance Planner, Officer, or Bot Admin to delete a defense plan.");
  }

  const plan = await prisma.warDefensePlan.findUnique({
      where: { id: planId }
  });

  if (!plan) throw new Error("Plan not found");

  if (!isBotAdmin && plan.allianceId !== player.allianceId) {
      throw new Error("Unauthorized");
  }

  await prisma.warDefensePlan.delete({
    where: {
      id: planId,
    },
  });

  revalidatePath("/planning/defense");
});

export const updateDefensePlanHighlightTag = withActionContext('updateDefensePlanHighlightTag', async (planId: string, tagId: number | null) => {
  const player = await getUserPlayerWithAlliance();

  if (!player) {
    throw new Error("Unauthorized: Player profile not found.");
  }

  const isBotAdmin = player.isBotAdmin;

  if (!canPlanAllianceWar(player, player.isBotAdmin) || (!isBotAdmin && !player.allianceId)) {
      throw new Error("Unauthorized");
  }

  const plan = await prisma.warDefensePlan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error("Plan not found");

  if (!isBotAdmin && plan.allianceId !== player.allianceId) {
      throw new Error("Unauthorized");
  }

  await prisma.warDefensePlan.update({
      where: { id: planId },
      data: { highlightTagId: tagId }
  });
  
  revalidatePath(`/planning/defense/${planId}`);
});

export const updateDefensePlanTier = withActionContext('updateDefensePlanTier', async (planId: string, tier: number | null) => {
  const player = await getUserPlayerWithAlliance();

  if (!player) {
    throw new Error("Unauthorized: Player profile not found.");
  }

  const isBotAdmin = player.isBotAdmin;

  if (!canPlanAllianceWar(player, player.isBotAdmin) || (!isBotAdmin && !player.allianceId)) {
      throw new Error("Unauthorized");
  }

  const plan = await prisma.warDefensePlan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error("Plan not found");

  if (!isBotAdmin && plan.allianceId !== player.allianceId) {
      throw new Error("Unauthorized");
  }

  await prisma.warDefensePlan.update({
      where: { id: planId },
      data: { tier: tier }
  });
  
  revalidatePath(`/planning/defense/${planId}`);
});

export const renameDefensePlan = withActionContext('renameDefensePlan', async (planId: string, newName: string) => {
  const player = await getUserPlayerWithAlliance();

  if (!player) {
    throw new Error("Unauthorized: Player profile not found.");
  }

  const isBotAdmin = player.isBotAdmin;

  if (!canPlanAllianceWar(player, player.isBotAdmin) || (!isBotAdmin && !player.allianceId)) {
      throw new Error("Unauthorized");
  }

  const plan = await prisma.warDefensePlan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error("Plan not found");

  if (!isBotAdmin && plan.allianceId !== player.allianceId) {
      throw new Error("Unauthorized");
  }

  await prisma.warDefensePlan.update({
      where: { id: planId },
      data: { name: newName }
  });
  
  revalidatePath("/planning/defense");
  revalidatePath(`/planning/defense/${planId}`);
});

export const distributeDefensePlanToDiscord = withActionContext('distributeDefensePlanToDiscord', async (planId: string, battlegroup?: number, targetChannelId?: string): Promise<DistributeDefensePlanResult> => {
  const player = await getUserPlayerWithAlliance();

  if (!player) {
    throw new Error("Unauthorized: Player profile not found.");
  }

  const isBotAdmin = player.isBotAdmin;

  if (!canPlanAllianceWar(player, player.isBotAdmin) || (!isBotAdmin && !player.allianceId)) {
      throw new Error("Unauthorized");
  }

  const plan = await prisma.warDefensePlan.findUnique({ 
    where: { id: planId },
    include: {
      alliance: true,
      placements: {
        select: { battlegroup: true }
      }
    }
  });
  if (!plan) throw new Error("Plan not found");

  if (!isBotAdmin && plan.allianceId !== player.allianceId) {
      throw new Error("Unauthorized");
  }

  const alliance = plan.alliance;
  if (!alliance) throw new Error("Alliance not found");

  // If distributing to a specific channel (e.g. current web view), skip config check
  if (!targetChannelId) {
      const requiredBgs = battlegroup ? [battlegroup] : Array.from(new Set(plan.placements.map(p => p.battlegroup)));
      const missingBattlegroups = findMissingBattlegroupChannels(alliance, requiredBgs);

      if (missingBattlegroups.length > 0) {
          return {
            success: false,
            error: createMissingDiscordChannelMessage({
              code: "MISSING_DISCORD_CHANNELS",
              missingBattlegroups,
              context: "defense-plan",
            }),
          };
      }
  }

  await prisma.botJob.create({
      data: {
          type: "DISTRIBUTE_DEFENSE_PLAN",
          status: "PENDING",
          payload: {
              allianceId: plan.allianceId,
              battlegroup: battlegroup,
              planId: plan.id,
              targetChannelId
          }
      }
  });

  return { success: true };
});

export const getDefensePlanMapPng = withActionContext('getDefensePlanMapPng', async (planId: string, battlegroup: number): Promise<string> => {
  const player = await getUserPlayerWithAlliance();

  if (!player) {
    throw new Error("Unauthorized: Player profile not found.");
  }

  const isBotAdmin = player.isBotAdmin;

  if (!canPlanAllianceWar(player, player.isBotAdmin) || (!isBotAdmin && !player.allianceId)) {
    throw new Error("Unauthorized");
  }

  const plan = await prisma.warDefensePlan.findUnique({
    where: { id: planId },
    include: {
      alliance: true,
      highlightTag: true,
      tactic: {
        include: {
          defenseTag: true,
        },
      },
      placements: {
        where: { battlegroup },
        include: {
          defender: {
            include: {
              tags: true,
            },
          },
          player: true,
          node: true,
        },
      },
    },
  });

  if (!plan) throw new Error("Plan not found");

  if (!isBotAdmin && plan.allianceId !== player.allianceId) {
    throw new Error("Unauthorized");
  }

  const allianceMembers = await prisma.player.findMany({
    where: { allianceId: plan.allianceId },
    select: { id: true, ingameName: true, battlegroup: true, avatar: true },
  });

  const sortedPlayers = [...allianceMembers].sort((a, b) => {
    const bgA = a.battlegroup ?? 999;
    const bgB = b.battlegroup ?? 999;
    if (bgA !== bgB) return bgA - bgB;
    return a.ingameName.localeCompare(b.ingameName);
  });

  const palette = MapImageService.getPlayerPalette(plan.alliance.playerColorPalette ?? undefined);
  const globalColorMap = new Map<string, string>();
  const uniqueImageUrls = new Set<string>();

  sortedPlayers.forEach((member, index) => {
    globalColorMap.set(member.id, palette[index % palette.length]);
    if (member.avatar) uniqueImageUrls.add(member.avatar);
  });

  const activeDefenseTag = plan.highlightTag ?? plan.tactic?.defenseTag ?? null;
  const assignments = new Map<number, NodeAssignment>();

  for (const placement of plan.placements) {
    let defenderImage: string | undefined;
    if (placement.defender?.images) {
      defenderImage = getChampionImageUrl(placement.defender.images, "128", "primary");
      uniqueImageUrls.add(defenderImage);
    }

    assignments.set(placement.node.nodeNumber, {
      defenderName: placement.defender?.name,
      defenderImage,
      defenderClass: placement.defender?.class,
      assignedColor: placement.playerId ? globalColorMap.get(placement.playerId) : undefined,
      isTarget: false,
      isDefenderTactic: !!(
        activeDefenseTag &&
        placement.defender?.tags?.some((tag) => tag.id === activeDefenseTag.id)
      ),
    });
  }

  const legend: LegendItem[] = [];
  const bgPlayerIds = new Set(plan.placements.map((placement) => placement.playerId).filter(Boolean));
  sortedPlayers
    .filter((member) => bgPlayerIds.has(member.id))
    .forEach((member) => {
      const color = globalColorMap.get(member.id);
      if (!color) return;

      const playerPlacements = plan.placements
        .filter((placement) => placement.playerId === member.id && placement.defender?.images)
        .sort((a, b) => a.node.nodeNumber - b.node.nodeNumber);

      legend.push({
        name: member.ingameName,
        color,
        variant: "defense",
        championImage: member.avatar || undefined,
        assignedChampions: playerPlacements.map((placement) => ({
          url: getChampionImageUrl(placement.defender!.images, "64", "primary"),
          class: placement.defender!.class,
          nodeNumber: placement.node.nodeNumber,
        })),
      });
    });

  const mapType = plan.mapType || WarMapType.STANDARD;
  const nodesData = mapType === WarMapType.BIG_THING ? warNodesDataBig : warNodesData;
  const bgColors: Record<number, string> = {
    1: plan.alliance.battlegroup1Color || "#ef4444",
    2: plan.alliance.battlegroup2Color || "#22c55e",
    3: plan.alliance.battlegroup3Color || "#3b82f6",
  };

  const imageCache = await MapImageService.preloadImages(Array.from(uniqueImageUrls));
  const mapBuffer = await MapImageService.generateMapImage(
    mapType,
    nodesData,
    assignments,
    imageCache,
    legend,
    bgColors[battlegroup] ?? "#6366f1",
  );

  return mapBuffer.toString("base64");
});

export const setDefensePlanActive = withActionContext('setDefensePlanActive', async (planId: string) => {
  const player = await getUserPlayerWithAlliance();

  if (!player) {
    throw new Error("Unauthorized: Player profile not found.");
  }

  const isBotAdmin = player.isBotAdmin;

  if (!canPlanAllianceWar(player, player.isBotAdmin) || (!isBotAdmin && !player.allianceId)) {
      throw new Error("Unauthorized: Only planners, officers, or bot admins can set active plans.");
  }

  const plan = await prisma.warDefensePlan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error("Plan not found");

  if (!isBotAdmin && plan.allianceId !== player.allianceId) {
      throw new Error("Unauthorized: Cannot set plan from another alliance.");
  }

  await prisma.alliance.update({
      where: { id: plan.allianceId },
      data: { activeDefensePlanId: planId }
  });
  
  revalidatePath("/planning/defense");
});

