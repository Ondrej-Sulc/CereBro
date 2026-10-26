import { z } from "zod";

const rankSchema = z.object({
  rank: z.number().int().min(1).max(6),
  socketRanks: z.record(z.string().regex(/^\d+$/), z.number().int().min(1).max(100)),
  prestigeBySignature: z.array(z.number().int().positive()).min(1).max(201),
}).strict();

export type RelicPrestigeRank = z.infer<typeof rankSchema>;
type Bounds = { maxRank: number; maxSignature: number };

/** Only complete, directly captured curves are publishable. No interpolation. */
export function parseRelicPrestigeRanks(value: unknown, bounds: Bounds): RelicPrestigeRank[] {
  const ranks = z.array(rankSchema).min(1).max(6).parse(value);
  if (
    ranks.length !== bounds.maxRank ||
    ranks.some((entry, index) => entry.rank !== index + 1 ||
      entry.prestigeBySignature.length !== bounds.maxSignature + 1)
  ) throw new Error("Incomplete relic prestige rank/signature coverage");
  return ranks;
}

export function relicPrestigeAtBuild(
  ranks: readonly RelicPrestigeRank[], rank: number, signature: number,
): number | null {
  if (!Number.isInteger(rank) || !Number.isInteger(signature) || signature < 0) return null;
  return ranks.find(entry => entry.rank === rank)?.prestigeBySignature[signature] ?? null;
}

export function selectRelicPrestigeBuild(bounds: Bounds, rank: string | null, signature: string | null) {
  const select = (raw: string | null, minimum: number, maximum: number) => {
    if (raw === null || !/^\d+$/.test(raw)) return maximum;
    const number = Number(raw);
    return Number.isSafeInteger(number) && number >= minimum ? Math.min(number, maximum) : maximum;
  };
  return {
    rank: select(rank, 1, bounds.maxRank),
    signature: select(signature, 0, bounds.maxSignature),
  };
}
