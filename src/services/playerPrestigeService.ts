import { type Prisma, type PrismaClient } from "@prisma/client";

export type PlayerPrestigeState = {
  championPrestige: number | null;
  relicPrestige: number | null;
  summonerPrestige: number | null;
  relicPrestigeFromInventory: boolean;
};

/** All prestige writers share this row lock, so concurrent edits cannot lose a component. */
export async function lockPlayerPrestige(tx: Prisma.TransactionClient, playerId: string): Promise<PlayerPrestigeState> {
  const [player] = await tx.$queryRaw<PlayerPrestigeState[]>`
    SELECT "championPrestige", "relicPrestige", "summonerPrestige", "relicPrestigeFromInventory"
    FROM "Player" WHERE "id" = ${playerId} FOR UPDATE`;
  if (!player) throw new Error("Player profile not found.");
  return player;
}

export async function writePlayerPrestige(
  tx: Prisma.TransactionClient,
  playerId: string,
  previous: PlayerPrestigeState,
  next: PlayerPrestigeState,
) {
  const valuesChanged = previous.championPrestige !== next.championPrestige ||
    previous.relicPrestige !== next.relicPrestige || previous.summonerPrestige !== next.summonerPrestige;
  if (valuesChanged || previous.relicPrestigeFromInventory !== next.relicPrestigeFromInventory)
    await tx.player.update({ where: { id: playerId }, data: next, select: { id: true } });
  if (valuesChanged)
    await tx.prestigeLog.create({ data: {
      playerId,
      championPrestige: next.championPrestige ?? 0,
      relicPrestige: next.relicPrestige ?? 0,
      summonerPrestige: next.summonerPrestige ?? 0,
    } });
  return next;
}

/** A deliberate manual/screenshot import takes precedence until automatic mode is re-enabled. */
export async function recordPlayerPrestige(
  db: PrismaClient, playerId: string, values: { relicPrestige: number; championPrestige?: number },
) {
  if (Object.values(values).some((value) => !Number.isSafeInteger(value) || value < 0))
    throw new Error("Prestige must be a non-negative integer.");
  return db.$transaction(async (tx) => {
    const previous = await lockPlayerPrestige(tx, playerId);
    const champion = values.championPrestige ?? previous.championPrestige;
    return writePlayerPrestige(tx, playerId, previous, {
      championPrestige: champion,
      relicPrestige: values.relicPrestige,
      summonerPrestige: (champion ?? 0) + values.relicPrestige,
      relicPrestigeFromInventory: false,
    });
  });
}

export async function recordChampionPrestige(db: PrismaClient, playerId: string, championPrestige: number) {
  if (!Number.isSafeInteger(championPrestige) || championPrestige < 0) throw new Error("Invalid champion prestige.");
  return db.$transaction(async (tx) => {
    const previous = await lockPlayerPrestige(tx, playerId);
    // Keep the existing imported-total policy for manual profiles. Automatic profiles always add both components.
    const summonerPrestige = previous.relicPrestigeFromInventory ||
      previous.summonerPrestige === previous.championPrestige || !previous.summonerPrestige
      ? championPrestige + (previous.relicPrestige ?? 0) : previous.summonerPrestige;
    return writePlayerPrestige(tx, playerId, previous, { ...previous, championPrestige, summonerPrestige });
  });
}
