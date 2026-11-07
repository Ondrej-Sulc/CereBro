import { getChampionAscensionEligibility, getChampionAscensionRules } from "@cerebro/core/data/game-ascension"

/** Explicit per-star paths only; missing rules and reward/owned state never imply eligibility. */
export function withChampionAscensionEligibility<T extends { gameId?: string | null }>(champion: T): T & { ascendableRarities: number[] } {
  return { ...champion, ascendableRarities: getChampionAscensionEligibility(champion.gameId).ascendableRarities }
}

/** Server-only enrichment; clients receive limits, never the full game catalog. */
export function withChampionAscensionLimits<T extends { gameId?: string | null }>(champion: T): T & { ascensionMaxLevels: Record<string, number> } {
  return { ...champion, ascensionMaxLevels: Object.fromEntries(getChampionAscensionRules(champion.gameId).map(rule => [String(rule.rarity), rule.maxLevel])) }
}
