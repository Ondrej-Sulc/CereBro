'use server';

import { prisma } from "@/lib/prisma";
import { WarMapType, WarDefensePlacement } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";

const createDefensePlanSchema = z.object({
  name: z.string().min(1),
  mapType: z.nativeEnum(WarMapType).optional(),
});

export async function createDefensePlan(formData: FormData) {
  const player = await getUserPlayerWithAlliance();

  if (!player) {
    throw new Error("Unauthorized: Player profile not found.");
  }

  // Even Bot Admins need to be in an alliance to create a plan for it (in the current UI context)
  if (!player.allianceId || (!player.isOfficer && !player.isBotAdmin)) {
    throw new Error("You must be an Alliance Officer or Bot Admin (and in an alliance) to create a defense plan.");
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
}

export async function updateDefensePlacement(updatedPlacement: Partial<WarDefensePlacement>) {
  const player = await getUserPlayerWithAlliance();

  if (!player) {
    throw new Error("Unauthorized: Player profile not found.");
  }

  const isBotAdmin = player.isBotAdmin;

  if (!isBotAdmin && (!player.allianceId || !player.isOfficer)) {
    throw new Error("You must be an Alliance Officer to update defense placements.");
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
}

export async function deleteDefensePlan(planId: string) {
  const player = await getUserPlayerWithAlliance();

  if (!player) {
    throw new Error("Unauthorized: Player profile not found.");
  }

  const isBotAdmin = player.isBotAdmin;

  if (!isBotAdmin && (!player.allianceId || !player.isOfficer)) {
    throw new Error("You must be an Alliance Officer to delete a defense plan.");
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
}

export async function updateDefensePlanHighlightTag(planId: string, tagId: number | null) {
  const player = await getUserPlayerWithAlliance();

  if (!player) {
    throw new Error("Unauthorized: Player profile not found.");
  }

  const isBotAdmin = player.isBotAdmin;

  if (!isBotAdmin && (!player.allianceId || !player.isOfficer)) {
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
}

export async function updateDefensePlanTier(planId: string, tier: number | null) {
  const player = await getUserPlayerWithAlliance();

  if (!player) {
    throw new Error("Unauthorized: Player profile not found.");
  }

  const isBotAdmin = player.isBotAdmin;

  if (!isBotAdmin && (!player.allianceId || !player.isOfficer)) {
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
}

export async function renameDefensePlan(planId: string, newName: string) {
  const player = await getUserPlayerWithAlliance();

  if (!player) {
    throw new Error("Unauthorized: Player profile not found.");
  }

  const isBotAdmin = player.isBotAdmin;

  if (!isBotAdmin && (!player.allianceId || !player.isOfficer)) {
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
}

export async function distributeDefensePlanToDiscord(planId: string, battlegroup?: number) {
  const player = await getUserPlayerWithAlliance();

  if (!player) {
    throw new Error("Unauthorized: Player profile not found.");
  }

  const isBotAdmin = player.isBotAdmin;

  if (!isBotAdmin && (!player.allianceId || !player.isOfficer)) {
      throw new Error("Unauthorized");
  }

  const plan = await prisma.warDefensePlan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error("Plan not found");

  if (!isBotAdmin && plan.allianceId !== player.allianceId) {
      throw new Error("Unauthorized");
  }

  await prisma.botJob.create({
      data: {
          type: "DISTRIBUTE_DEFENSE_PLAN",
          status: "PENDING",
          payload: {
              allianceId: plan.allianceId,
              battlegroup: battlegroup
          }
      }
  });

  return { success: true };
}
