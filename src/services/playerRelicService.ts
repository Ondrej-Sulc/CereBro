import { type PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { z } from "zod";
import { calculatePlayerRelicPrestige, type PlayerRelicPrestige } from "../domain/player-relic-prestige";
import { lockPlayerPrestige, syncPlayerRelicPrestige, type PlayerPrestigeState } from "./playerPrestigeService";
import {
  addPlayerRelicSchema,
  updatePlayerRelicSchema,
  relicVersionSchema,
  type OwnedRelic,
  type RelicBuildOption,
} from "../domain/player-relics";
import { relicPrestigeAtBuild } from "../domain/relic-prestige";
import { raritySelect, ownedInclude, curves, present, listPlayerRelics, type Rarity } from "./playerRelicData";
export { listPlayerRelics } from "./playerRelicData";

export class PlayerRelicError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
function validateBuild(rarity: Rarity, rank: number, sigLevel: number) {
  if (!rarity.isCurrent || !rarity.selectable || !rarity.relic.isCurrent)
    throw new PlayerRelicError(
      "This relic rarity is no longer available to edit.",
      422,
    );
  if (rank > rarity.maxRank || sigLevel > rarity.maxSignature)
    throw new PlayerRelicError(
      "Rank or signature exceeds this relic's limits.",
      422,
    );
}
function prestigeSnapshot(entries: OwnedRelic[], player: PlayerPrestigeState): PlayerRelicPrestige {
  return {
    ...calculatePlayerRelicPrestige(entries),
    automatic: player.relicPrestigeFromInventory,
    recorded: player.relicPrestige,
    champion: player.championPrestige,
    summoner: player.summonerPrestige,
    revision: createHash("sha256").update(JSON.stringify({
      player: [player.championPrestige, player.relicPrestige, player.summonerPrestige, player.relicPrestigeFromInventory],
      entries: [...entries].sort((a, b) => a.id.localeCompare(b.id)).map((entry) => [
        entry.id, entry.updatedAt, entry.rank, entry.sigLevel, entry.current, entry.prestige,
      ]),
    })).digest("hex"),
  };
}

export async function getPlayerRelicState(db: PrismaClient, playerId: string) {
  return db.$transaction(async (tx) => {
    const player = await tx.player.findUniqueOrThrow({ where: { id: playerId }, select: {
      relicPrestige: true, championPrestige: true, summonerPrestige: true, relicPrestigeFromInventory: true,
    } });
    const entries = await listPlayerRelics(tx, playerId);
    return { entries, prestige: prestigeSnapshot(entries, player) };
  }, { isolationLevel: "RepeatableRead" });
}

export async function playerRelicBuildOptions(
  db: PrismaClient,
  relicId: string,
): Promise<RelicBuildOption[]> {
  return (
    await db.gameRelicRarity.findMany({
      where: {
        relicId,
        selectable: true,
        isCurrent: true,
        relic: { isCurrent: true },
      },
      select: raritySelect,
      orderBy: { stars: "asc" },
    })
  ).map((rarity) => ({
    stars: rarity.stars,
    maxRank: rarity.maxRank,
    maxSignature: rarity.maxSignature,
    ranks: curves(rarity),
  }));
}
export async function addPlayerRelic(
  db: PrismaClient,
  playerId: string,
  input: unknown,
): Promise<OwnedRelic> {
  const data = addPlayerRelicSchema.parse(input);
  try {
    return await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(718263, 2)`;
      const previousPrestige = await lockPlayerPrestige(tx, playerId);
      const rarity = await tx.gameRelicRarity.findFirst({
        where: {
          relicId: data.relicId,
          stars: data.stars,
          selectable: true,
          isCurrent: true,
          relic: { isCurrent: true },
        },
        select: raritySelect,
      });
      if (!rarity)
        throw new PlayerRelicError("This relic rarity is not available.", 422);
      validateBuild(rarity, data.rank, data.sigLevel);
      const entry = present(
        await tx.playerRelic.create({
          data: {
            playerId,
            relicId: rarity.relicId,
            sourceRarityId: rarity.sourceRarityId,
            rank: data.rank,
            sigLevel: data.sigLevel,
          },
          include: ownedInclude,
        }),
      );
      await syncPlayerRelicPrestige(tx, playerId, previousPrestige);
      return entry;
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      error.code === "P2002"
    )
      throw new PlayerRelicError(
        "You already own this variant at this rarity. Edit the existing relic instead.",
        409,
      );
    throw error;
  }
}
export async function updatePlayerRelic(
  db: PrismaClient,
  playerId: string,
  input: unknown,
): Promise<OwnedRelic> {
  const data = updatePlayerRelicSchema.parse(input);
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(718263, 2)`;
    const previousPrestige = await lockPlayerPrestige(tx, playerId);
    const row = await tx.playerRelic.findFirst({
      where: { id: data.id, playerId },
      include: ownedInclude,
    });
    if (!row)
      throw new PlayerRelicError("Relic not found in this profile.", 404);
    validateBuild(row.rarity, data.rank, data.sigLevel);
    const changes = {
      rank: data.rank,
      sigLevel: data.sigLevel,
      updatedAt: new Date(Math.max(Date.now(), row.updatedAt.getTime() + 1)),
    };
    const result = await tx.playerRelic.updateMany({
      where: { id: data.id, playerId, updatedAt: new Date(data.updatedAt) },
      data: changes,
    });
    if (result.count !== 1)
      throw new PlayerRelicError(
        "This relic changed in another tab. Refresh before editing again.",
        409,
      );
    await syncPlayerRelicPrestige(tx, playerId, previousPrestige);
    return present({ ...row, ...changes });
  });
}
export async function removePlayerRelic(
  db: PrismaClient,
  playerId: string,
  input: unknown,
) {
  const data = relicVersionSchema.parse(input);
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(718263, 2)`;
    const previousPrestige = await lockPlayerPrestige(tx, playerId);
    const result = await tx.playerRelic.deleteMany({
      where: { id: data.id, playerId, updatedAt: new Date(data.updatedAt) },
    });
    if (result.count !== 1)
      throw new PlayerRelicError("This relic changed or was removed. Refresh before trying again.", 409);
    await syncPlayerRelicPrestige(tx, playerId, previousPrestige);
  });
}

const importSchema = z.object({
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  entries: z.array(addPlayerRelicSchema.extend({ expectedPrestige: z.number().int().positive() }).strict()).min(1).max(180),
}).strict();

/** Save a reviewed batch atomically. Omitted relics survive; stale previews cannot overwrite newer edits. */
export async function importPlayerRelics(db: PrismaClient, playerId: string, input: unknown) {
  const data = importSchema.parse(input);
  const unique = new Map<string, typeof data.entries[number]>();
  for (const entry of data.entries) {
    const key = `${entry.relicId}:${entry.stars}`, prior = unique.get(key);
    if (prior && (prior.rank !== entry.rank || prior.sigLevel !== entry.sigLevel || prior.expectedPrestige !== entry.expectedPrestige))
      throw new PlayerRelicError('Two selected cards have conflicting builds for the same relic and rarity. Keep only the correct one.', 422);
    unique.set(key, entry);
  }
  return db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(718263, 2)`;
    const previous = await lockPlayerPrestige(tx, playerId);
    const owned = await listPlayerRelics(tx, playerId);
    if (prestigeSnapshot(owned, previous).revision !== data.revision)
      throw new PlayerRelicError('Your relics or prestige changed. Refresh and review this import again.', 409);
    for (const entry of unique.values()) {
      const rarity = await tx.gameRelicRarity.findFirst({
        where: { relicId: entry.relicId, stars: entry.stars, isCurrent: true, selectable: true, relic: { isCurrent: true } },
        select: raritySelect,
      });
      if (!rarity) throw new PlayerRelicError('This relic rarity is no longer available.', 422);
      validateBuild(rarity, entry.rank, entry.sigLevel);
      const currentCurves = curves(rarity);
      if (!currentCurves || relicPrestigeAtBuild(currentCurves, entry.rank, entry.sigLevel) !== entry.expectedPrestige)
        throw new PlayerRelicError('The selected build no longer matches the screenshot rating. Review it against the current relic data.', 409);
      const existing = owned.find(e => e.relicId === entry.relicId && e.stars === entry.stars);
      if (existing) {
        if (existing.rank === entry.rank && existing.sigLevel === entry.sigLevel) continue;
        await tx.playerRelic.update({ where: { id: existing.id }, data: {
          rank: entry.rank, sigLevel: entry.sigLevel,
          updatedAt: new Date(Math.max(Date.now(), new Date(existing.updatedAt).getTime()+1)),
        } });
      } else {
        await tx.playerRelic.create({ data: { playerId, relicId: entry.relicId, sourceRarityId: rarity.sourceRarityId, rank: entry.rank, sigLevel: entry.sigLevel } });
      }
    }
    await syncPlayerRelicPrestige(tx, playerId, previous);
    const current = await tx.player.findUniqueOrThrow({ where: { id: playerId }, select: {
      championPrestige: true, relicPrestige: true, summonerPrestige: true, relicPrestigeFromInventory: true,
    } });
    const entries = await listPlayerRelics(tx, playerId);
    return { entries, prestige: prestigeSnapshot(entries, current) };
  }, { timeout: 20_000 });
}
