import { type Prisma, type PrismaClient } from "@prisma/client";
import type { OwnedRelic } from "../domain/player-relics";
import { parseRelicPrestigeRanks, relicPrestigeAtBuild } from "../domain/relic-prestige";

// Never load raw extraction/scaling blobs for a player's collection.
const rarityInclude = {
  relic: {
    select: {
      id: true,
      slug: true,
      name: true,
      shortName: true,
      type: true,
      class: true,
      portraitPath: true,
      primaryAttribute: true,
      secondaryAttribute: true,
      isCurrent: true,
      sourceHash: true,
      importId: true,
    },
  },
  prestige: {
    select: {
      sourceDefinitionHash: true,
      sourcePackageHash: true,
      ranks: true,
    },
  },
} satisfies Prisma.GameRelicRarityInclude;
export const raritySelect = {
  relicId: true,
  sourceRarityId: true,
  stars: true,
  maxRank: true,
  maxSignature: true,
  isCurrent: true,
  selectable: true,
  ...rarityInclude,
} satisfies Prisma.GameRelicRaritySelect;
export const ownedInclude = {
  rarity: { select: raritySelect },
} satisfies Prisma.PlayerRelicInclude;
export type Rarity = Prisma.GameRelicRarityGetPayload<{
  select: typeof raritySelect;
}>;
type OwnedRow = Prisma.PlayerRelicGetPayload<{ include: typeof ownedInclude }>;
export function curves(rarity: Rarity) {
  const captured = rarity.prestige;
  if (
    !rarity.isCurrent || !rarity.selectable ||
    !rarity.relic.isCurrent ||
    !captured ||
    captured.sourceDefinitionHash !== rarity.relic.sourceHash ||
    captured.sourcePackageHash !== rarity.relic.importId
  )
    return null;
  try {
    return parseRelicPrestigeRanks(captured.ranks, rarity);
  } catch {
    return null;
  }
}
export function present(row: OwnedRow): OwnedRelic {
  const { rarity } = row,
    relic = rarity.relic,
    ranks = curves(rarity);
  return {
    id: row.id,
    relicId: row.relicId,
    sourceRarityId: row.sourceRarityId,
    slug: relic.slug,
    name: relic.name,
    shortName: relic.shortName,
    type: relic.type,
    className: relic.class,
    portraitPath: relic.portraitPath,
    primaryAttribute: relic.primaryAttribute,
    secondaryAttribute: relic.secondaryAttribute,
    stars: rarity.stars,
    rank: row.rank,
    sigLevel: row.sigLevel,
    maxRank: rarity.maxRank,
    maxSignature: rarity.maxSignature,
    current: rarity.isCurrent && rarity.selectable && relic.isCurrent,
    updatedAt: row.updatedAt.toISOString(),
    prestige: ranks
      ? relicPrestigeAtBuild(ranks, row.rank, row.sigLevel)
      : null,
  };
}
export async function listPlayerRelics(
  db: PrismaClient | Prisma.TransactionClient,
  playerId: string,
): Promise<OwnedRelic[]> {
  return (
    await db.playerRelic.findMany({
      where: { playerId },
      include: ownedInclude,
      orderBy: [{ rarity: { stars: "desc" } }, { createdAt: "desc" }],
    })
  ).map(present);
}

