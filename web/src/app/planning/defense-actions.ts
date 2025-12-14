'use server';

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { WarMapType, WarDefensePlacement } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const createDefensePlanSchema = z.object({
  name: z.string().min(1),
  mapType: z.nativeEnum(WarMapType).optional(),
});

export async function createDefensePlan(formData: FormData) {
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
    throw new Error("You must be an Alliance Officer or Bot Admin to create a defense plan.");
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
    const warNodes = await tx.warNode.findMany();
    const nodeMap = new Map(warNodes.map(n => [n.nodeNumber, n.id]));
    const maxNodes = data.mapType === WarMapType.BIG_THING ? 10 : 50;

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

      if (existingPlacement.plan.alliance.id !== player.allianceId) {
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

      if (targetPlan.alliance.id !== player.allianceId) {
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
        }}

export async function deleteDefensePlan(planId: string) {
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
    throw new Error("You must be an Alliance Officer to delete a defense plan.");
  }

  await prisma.warDefensePlan.delete({
    where: {
      id: planId,
      allianceId: player.allianceId,
    },
  });

  revalidatePath("/planning/defense");
}

export async function updateDefensePlanHighlightTag(planId: string, tagId: number | null) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, provider: "discord" },
  });

  const player = await prisma.player.findFirst({
    where: { discordId: account?.providerAccountId },
    include: { alliance: true }
  });

  if (!player?.allianceId || !player.isOfficer) {
      throw new Error("Unauthorized");
  }

  await prisma.warDefensePlan.update({
      where: { id: planId, allianceId: player.allianceId },
      data: { highlightTagId: tagId }
  });
  
  revalidatePath(`/planning/defense/${planId}`);
}
