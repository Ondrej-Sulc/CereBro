import { z } from "zod";
import type { RelicDefinition } from "./relic-catalog";
import type { RelicPrestigePlan } from "./relic-prestige-capture";

type SourceRelic = Pick<RelicDefinition, "id" | "type" | "rarities" | "unlockConfigurationId"> & {
  slots: Array<Pick<RelicDefinition["slots"][number], "index" | "socketItemIds">>;
};
const rawSchema = z.object({
  UnlockConfigurations: z.record(z.string(), z.object({ Strategies: z.array(z.string()) })),
  UnlockStrategies: z.record(z.string(), z.object({ UnlockOrder: z.array(z.number().int().min(0).max(4)),
    UnlockRank: z.array(z.number().int().min(1).max(6)) })),
});
const contextSchema = z.array(z.object({ relicId: z.string(), rarityId: z.string(), socketItemId: z.string(),
  maxSocketLevelByRelicRank: z.array(z.object({ relicRank: z.number().int().positive(), maxSocketLevel: z.number().int().min(1).max(100) })),
}));

/** Every rune position and level comes from the same verified catalog as the page. */
export function createRelicPrestigePlan(relics: readonly SourceRelic[], rawInput: unknown, contextInput: unknown): RelicPrestigePlan {
  const raw = rawSchema.parse(rawInput), contexts = contextSchema.parse(contextInput);
  const index = new Map<string, Map<number, number>>();
  for (const c of contexts) {
    const key = `${c.relicId}:${c.rarityId}:${c.socketItemId}`;
    const ranks = new Map(c.maxSocketLevelByRelicRank.map(r => [r.relicRank, r.maxSocketLevel]));
    if (index.has(key) || ranks.size !== c.maxSocketLevelByRelicRank.length) throw new Error("Duplicate rune scaling");
    index.set(key, ranks);
  }
  return relics.flatMap(relic => relic.rarities.filter(r => relic.type !== "statcast" || r.stars >= 5).map(rarity => {
    const strategyId = raw.UnlockConfigurations[relic.unlockConfigurationId]?.Strategies[rarity.sourceOrderIndex];
    const strategy = raw.UnlockStrategies[strategyId];
    if (!strategy || strategy.UnlockOrder.length !== strategy.UnlockRank.length ||
      new Set(strategy.UnlockOrder).size !== strategy.UnlockOrder.length) throw new Error("Invalid rune unlock strategy");
    if (strategy.UnlockOrder.some(position => !relic.slots.some(slot => slot.index === position)))
      throw new Error("Unknown unlocked rune position");
    return { relicId: relic.id, rarityId: rarity.id, maxSignature: rarity.maxSignature,
      ranks: Array.from({ length: rarity.maxRank }, (_, i) => {
        const rank = i + 1, socketRanks: Record<string, number> = {};
        strategy.UnlockOrder.forEach((position, j) => {
          if (rank < strategy.UnlockRank[j]) return;
          const slot = relic.slots.find(s => s.index === position)!;
          const levels = slot.socketItemIds.map(item => index.get(`${relic.id}:${rarity.id}:${item}`)?.get(rank));
          if (!levels.length || levels.some(level => level === undefined)) throw new Error("Missing rune scaling");
          if (new Set(levels).size !== 1) throw new Error("Conflicting alternative rune limits");
          socketRanks[String(position)] = levels[0]!;
        });
        return { rank, socketRanks };
      }),
    };
  }));
}
