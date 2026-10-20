import type { Prisma } from "@prisma/client";

/**
 * Change membership and release the old alliance's editable defense assignments.
 * Call inside the caller's transaction so a failed cleanup also rolls back membership.
 * Defense templates are independent of War/WarFight history, which stays untouched.
 */
export async function changePlayerAlliance(
  tx: Prisma.TransactionClient,
  playerId: string,
  previousAllianceId: string | null,
  allianceId: string | null,
  data: Omit<Prisma.PlayerUncheckedUpdateInput, "allianceId"> = {},
) {
  const changedAlliance = previousAllianceId !== allianceId;
  // Lock Player before placements, matching defense assignment's SELECT FOR UPDATE.
  // Assignment then either commits before cleanup or sees the new membership.
  const player = await tx.player.update({
    // Reject a stale removal/transfer rather than detaching a newly joined member.
    where: { id: playerId, allianceId: previousAllianceId },
    data: {
      ...(changedAlliance ? { battlegroup: null, isOfficer: false, isPlanner: false } : {}),
      ...data,
      allianceId,
    },
  });

  if (changedAlliance && previousAllianceId) {
    await tx.warDefensePlacement.updateMany({
      where: { playerId, plan: { allianceId: previousAllianceId } },
      // Keep node rows, but make the entire slot available to a replacement.
      data: { playerId: null, defenderId: null, starLevel: null },
    });
  }

  return player;
}
