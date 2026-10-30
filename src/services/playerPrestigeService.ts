import { type Prisma, type PrismaClient } from "@prisma/client";
import { calculatePlayerRelicPrestige } from "../domain/player-relic-prestige";
import { listPlayerRelics } from "./playerRelicData";

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

function withInventoryPrestige(
  state: PlayerPrestigeState,
  calculation: ReturnType<typeof calculatePlayerRelicPrestige>,
): PlayerPrestigeState {
  if (!calculation.ready || calculation.average === null)
    return { ...state, relicPrestigeFromInventory: false };
  return {
    ...state,
    relicPrestige: calculation.average,
    summonerPrestige: (state.championPrestige ?? 0) + calculation.average,
    relicPrestigeFromInventory: true,
  };
}

/** Caller holds the catalog lock followed by the player lock. All inventory mutations use this rule. */
export async function syncPlayerRelicPrestige(tx: Prisma.TransactionClient, playerId: string, previous: PlayerPrestigeState) {
  const calculation = calculatePlayerRelicPrestige(await listPlayerRelics(tx, playerId));
  return writePlayerPrestige(tx, playerId, previous, withInventoryPrestige(previous, calculation));
}

/** Rollout/catalog refresh: preview by default, or apply the same calculation under both locks. */
export async function reconcilePlayerRelicPrestige(
  db: PrismaClient,
  playerId: string,
  { apply = false }: { apply?: boolean } = {},
) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(718263, 2)`;
    const previous = await lockPlayerPrestige(tx, playerId);
    const entries = await listPlayerRelics(tx, playerId);
    const calculation = calculatePlayerRelicPrestige(entries);
    const next = withInventoryPrestige(previous, calculation);
    const changed = Object.keys(next).some(
      key => next[key as keyof PlayerPrestigeState] !== previous[key as keyof PlayerPrestigeState],
    );
    if (apply) await writePlayerPrestige(tx, playerId, previous, next);
    return {
      playerId, previous, next, changed, applied: apply && changed,
      ownedCount: entries.length, ready: calculation.ready, missingCount: calculation.missingCount,
    };
  });
}

/** Manual/profile OCR values are a fallback; an eligible saved collection remains authoritative. */
export async function recordPlayerPrestige(
  db: PrismaClient, playerId: string, values: { relicPrestige: number; championPrestige?: number },
) {
  if (Object.values(values).some((value) => !Number.isSafeInteger(value) || value < 0))
    throw new Error("Prestige must be a non-negative integer.");
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(718263, 2)`;
    const previous = await lockPlayerPrestige(tx, playerId);
    const champion = values.championPrestige ?? previous.championPrestige;
    const calculation = calculatePlayerRelicPrestige(await listPlayerRelics(tx, playerId));
    return writePlayerPrestige(tx, playerId, previous, withInventoryPrestige({
      championPrestige: champion,
      relicPrestige: values.relicPrestige,
      summonerPrestige: (champion ?? 0) + values.relicPrestige,
      relicPrestigeFromInventory: false,
    }, calculation));
  });
}

export async function recordChampionPrestige(db: PrismaClient, playerId: string, championPrestige: number) {
  if (!Number.isSafeInteger(championPrestige) || championPrestige < 0) throw new Error("Invalid champion prestige.");
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(718263, 2)`;
    const previous = await lockPlayerPrestige(tx, playerId);
    // Keep the existing imported-total policy for manual profiles. Automatic profiles always add both components.
    const summonerPrestige = previous.relicPrestigeFromInventory ||
      previous.summonerPrestige === previous.championPrestige || !previous.summonerPrestige
      ? championPrestige + (previous.relicPrestige ?? 0) : previous.summonerPrestige;
    const calculation = calculatePlayerRelicPrestige(await listPlayerRelics(tx, playerId));
    return writePlayerPrestige(tx, playerId, previous, withInventoryPrestige({ ...previous, championPrestige, summonerPrestige }, calculation));
  });
}
