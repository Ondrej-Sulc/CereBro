"use server";

import { DuelSource, DuelStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireBotAdmin } from "@/lib/auth-helpers";
import { withActionContext } from "@/lib/with-request-context";
import { buildDuelWhere, DuelFilterInput } from "./filters";

const transitionTargets: Record<DuelStatus, DuelStatus[]> = {
  SUGGESTED: [DuelStatus.ACTIVE, DuelStatus.ARCHIVED],
  OUTDATED: [DuelStatus.ACTIVE, DuelStatus.ARCHIVED],
  ACTIVE: [DuelStatus.ARCHIVED],
  ARCHIVED: [DuelStatus.ACTIVE],
};

function ensureDuelStatus(status: string): DuelStatus {
  if (!Object.values(DuelStatus).includes(status as DuelStatus)) {
    throw new Error(`Invalid duel status: ${status}`);
  }
  return status as DuelStatus;
}

function ensureDuelSource(source: string): DuelSource {
  if (!Object.values(DuelSource).includes(source as DuelSource)) {
    throw new Error(`Invalid duel source: ${source}`);
  }
  return source as DuelSource;
}

function assertAllowedTransition(fromStatus: DuelStatus, toStatus: DuelStatus) {
  if (fromStatus === toStatus) return;
  if (!transitionTargets[fromStatus].includes(toStatus)) {
    throw new Error(`Cannot move duel from ${fromStatus} to ${toStatus}.`);
  }
}

function uniquePositiveIds(ids: number[]) {
  return [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
}

function revalidateDuels() {
  revalidatePath("/admin/duels");
}

export const countMatchingDuels = withActionContext(
  "countMatchingDuels",
  async ({ filter, fromStatus }: { filter: DuelFilterInput; fromStatus: DuelStatus }) => {
    await requireBotAdmin("MANAGE_CHAMPIONS");
    const status = ensureDuelStatus(fromStatus);

    return prisma.duel.count({
      where: buildDuelWhere(filter, status),
    });
  }
);

export const updateDuelStatus = withActionContext(
  "updateDuelStatus",
  async ({ ids, status }: { ids: number[]; status: DuelStatus }) => {
    await requireBotAdmin("MANAGE_CHAMPIONS");
    const targetStatus = ensureDuelStatus(status);
    const uniqueIds = uniquePositiveIds(ids);
    if (uniqueIds.length === 0) {
      return { success: true, updatedCount: 0, message: "No duels selected." };
    }

    const duels = await prisma.duel.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, status: true },
    });

    if (duels.length !== uniqueIds.length) {
      throw new Error("One or more selected duels no longer exist.");
    }

    for (const duel of duels) {
      assertAllowedTransition(duel.status, targetStatus);
    }

    const result = await prisma.duel.updateMany({
      where: { id: { in: uniqueIds } },
      data: { status: targetStatus },
    });

    revalidateDuels();
    return { success: true, updatedCount: result.count };
  }
);

export const bulkUpdateDuels = withActionContext(
  "bulkUpdateDuels",
  async ({
    filter,
    fromStatus,
    toStatus,
  }: {
    filter: DuelFilterInput;
    fromStatus: DuelStatus;
    toStatus: DuelStatus;
  }) => {
    await requireBotAdmin("MANAGE_CHAMPIONS");
    const sourceStatus = ensureDuelStatus(fromStatus);
    const targetStatus = ensureDuelStatus(toStatus);
    assertAllowedTransition(sourceStatus, targetStatus);

    const where = buildDuelWhere(filter, sourceStatus);
    const result = await prisma.duel.updateMany({
      where,
      data: { status: targetStatus },
    });

    revalidateDuels();
    return {
      success: true,
      updatedCount: result.count,
      message: result.count === 0 ? "No matching duels were updated." : undefined,
    };
  }
);

export const updateDuelDetails = withActionContext(
  "updateDuelDetails",
  async ({
    id,
    championId,
    playerName,
    rank,
    source,
    status,
  }: {
    id: number;
    championId: number;
    playerName: string;
    rank: string | null;
    source: DuelSource;
    status: DuelStatus;
  }) => {
    await requireBotAdmin("MANAGE_CHAMPIONS");
    if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid duel id.");
    if (!Number.isInteger(championId) || championId <= 0) throw new Error("Invalid champion id.");

    const nextPlayerName = playerName.trim();
    if (!nextPlayerName) throw new Error("Player name is required.");
    if (nextPlayerName.length > 50) throw new Error("Player name must be 50 characters or fewer.");

    const nextRank = rank?.trim() || null;
    const nextSource = ensureDuelSource(source);
    const nextStatus = ensureDuelStatus(status);

    try {
      await prisma.duel.update({
        where: { id },
        data: {
          championId,
          playerName: nextPlayerName,
          rank: nextRank,
          source: nextSource,
          status: nextStatus,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new Error("A duel target with this champion and player name already exists.");
      }
      throw error;
    }

    revalidateDuels();
    return { success: true };
  }
);

export const deleteDuel = withActionContext(
  "deleteDuel",
  async ({ id }: { id: number }) => {
    await requireBotAdmin("MANAGE_CHAMPIONS");
    if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid duel id.");

    await prisma.duel.delete({ where: { id } });
    revalidateDuels();
    return { success: true };
  }
);
