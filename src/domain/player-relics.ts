import { z } from "zod";
import type { RelicPrestigeRank } from "./relic-prestige";
import type { PlayerRelicPrestige } from "./player-relic-prestige";

export const relicBuildSchema = z.object({
  rank: z.number().int().min(1).max(100),
  sigLevel: z.number().int().min(0).max(200),
});
export const addPlayerRelicSchema = relicBuildSchema
  .extend({
    relicId: z.string().min(1).max(160),
    stars: z.number().int().min(1).max(7),
  })
  .strict();
export const relicVersionSchema = z
  .object({ id: z.string().min(1).max(100), updatedAt: z.string().datetime() })
  .strict();
export const updatePlayerRelicSchema = relicBuildSchema
  .extend(relicVersionSchema.shape)
  .strict();

export type OwnedRelic = {
  id: string;
  relicId: string;
  sourceRarityId: string;
  slug: string;
  name: string;
  shortName: string;
  type: string;
  className: string;
  portraitPath: string;
  primaryAttribute: string | null;
  secondaryAttribute: string | null;
  stars: number;
  rank: number;
  sigLevel: number;
  maxRank: number;
  maxSignature: number;
  current: boolean;
  updatedAt: string;
  prestige: number | null;
};
export type RelicInventorySnapshot = {
  profile: { id: string; name: string } | null;
  entries: OwnedRelic[];
  prestige: PlayerRelicPrestige | null;
};
export type RelicBuildOption = {
  stars: number;
  maxRank: number;
  maxSignature: number;
  ranks: RelicPrestigeRank[] | null;
};
