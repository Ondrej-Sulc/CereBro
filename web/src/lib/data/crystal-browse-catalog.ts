import { getCrystalFamilies, getCrystalPresentation } from "@cerebro/core/data/game-crystals"
import { getCrystalOpening, listCrystalOpenings } from "@cerebro/core/data/game-crystal-openings"
import { getCrystalOdds } from "@cerebro/core/data/game-crystal-odds"
import type { CrystalCatalogFamily } from "@cerebro/core/domain/champion-crystals"
import type { CrystalOpening } from "@cerebro/core/domain/crystal-openings"
import { classifyCrystalCategory } from "@cerebro/core/domain/crystal-categories"
import { compareCrystalStars, sortCrystalsNewestFirst } from "@cerebro/core/domain/crystal-chronology"
import { getCrystalAvailabilityReview, type CrystalAvailabilityReview } from "@cerebro/core/data/game-crystals/availability"
import { hasCrystalSevenStarAscensionRewards } from "@cerebro/core/domain/crystal-ascension-rewards"
import { getAscensionResource, getChampionAscensionRules } from "@cerebro/core/data/game-ascension"
import type { CrystalRewardKind } from "../crystal-reward-filters"
import type { CrystalPoolChampion } from "../crystal-pool-preview"
export type CrystalBrowseEntry = CrystalCatalogFamily & {
  rewardKind: CrystalRewardKind
  rewardTypes: string[]
  rewardCount: number
  hasRates: boolean
  hasPity: boolean
  /** Exact seven-star discovery matches, independent of the family's other variants. */
  ascensionSourceIds: string[]
  singleChampion: CrystalPoolChampion | null
  availabilityReview?: Readonly<CrystalAvailabilityReview> | null
}

export function crystalBrowseOpeningSummary(opening: CrystalOpening) {
  const rewards = opening.categories.flatMap(category => category.rewards)
  const heroes = rewards.filter(reward => reward.type === "hero" || reward.type === "hcos")
  const byChampion = new Map<string, Set<number>>()
  for (const hero of heroes) {
    if (!hero.gameId || !hero.rarity) continue
    const rarities = byChampion.get(hero.gameId) ?? new Set<number>()
    rarities.add(hero.rarity)
    byChampion.set(hero.gameId, rarities)
  }
  const championCountsByRarity: Record<string, number> = {}
  for (const rarities of byChampion.values()) for (const rarity of rarities) championCountsByRarity[rarity] = (championCountsByRarity[rarity] ?? 0) + 1
  const hasOtherRewards = rewards.some(reward => reward.type !== "hero" && reward.type !== "hcos" && reward.type !== "nothing")
    || opening.conditionalBonuses.some(bonus => bonus.bonusReward.rewards.length > 0)
  const rewardKind: CrystalRewardKind = heroes.length ? hasOtherRewards ? "mixed" : "champions" : "items"
  const singleChampion = byChampion.size === 1 && heroes.every(hero => hero.gameId && hero.rarity)
    ? { gameId: heroes[0].gameId!, name: heroes[0].displayName || heroes[0].gameId! } : null
  return { championCount: byChampion.size, championCountsByRarity, rarities: Object.keys(championCountsByRarity).map(Number).sort((a, b) => b - a),
    rewardKind, rewardTypes: [...new Set(rewards.map(reward => reward.type))].sort(), rewardCount: rewards.length,
    hasRates: getCrystalOdds(opening.id, opening.source.gachaSha256)?.status === "captured", hasPity: opening.pity !== null, singleChampion }
}

let entries: readonly CrystalBrowseEntry[] | undefined
const ordered: Partial<Record<"recommended" | "newest" | "name", readonly CrystalBrowseEntry[]>> = {}
const ascensionEvidence = { getRules: getChampionAscensionRules, getResource: getAscensionResource }

/** All current definitions, retaining the existing explicit champion-family grouping. */
export function getCrystalBrowseEntries(order?: "recommended" | "newest" | "name"): readonly CrystalBrowseEntry[] {
  if (order) {
    if (ordered[order]) return ordered[order]!
    const rows = order === "name"
      ? [...getCrystalBrowseEntries()].sort((a, b) => a.name.localeCompare(b.name, "en") || a.id.localeCompare(b.id, "en"))
      : sortCrystalsNewestFirst(getCrystalBrowseEntries().map(entry => ({ id: entry.id, name: entry.name, rarities: entry.rarities, sourceIds: entry.variants.flatMap(variant => variant.sourceIds), entry }))).map(item => item.entry)
    // Stable sorting retains edition order within equal star ranges. Resources
    // have no champion stars, so their relative order remains edition-based.
    if (order === "recommended") rows.sort(compareCrystalStars)
    return ordered[order] = Object.freeze(rows)
  }
  if (entries) return entries
  const definitions = new Map(listCrystalOpenings().map(opening => [opening.id, opening]))
  const covered = new Set<string>()
  const result: CrystalBrowseEntry[] = []
  for (const family of getCrystalFamilies()) {
    const variants = family.variants.flatMap(variant => {
      const sourceIds = variant.sourceIds.filter(id => definitions.has(id))
      return sourceIds.length ? [{ ...variant, sourceIds }] : []
    })
    if (!variants.length) continue
    const opening = getCrystalOpening(family.id) ?? getCrystalOpening(variants[0].sourceIds[0])!
    const ascensionSourceIds = variants.flatMap(variant => variant.sourceIds).filter(id => hasCrystalSevenStarAscensionRewards(getCrystalOpening(id)!, ascensionEvidence))
    result.push({ ...family, variants, ...crystalBrowseOpeningSummary(opening), ascensionSourceIds })
    for (const variant of variants) for (const id of variant.sourceIds) covered.add(id)
  }
  for (const definition of definitions.values()) {
    if (covered.has(definition.id)) continue
    const opening = getCrystalOpening(definition.id)!
    const art = getCrystalPresentation(definition.id)
    const category = classifyCrystalCategory({ ...definition, isMainPool: false })
    const summary = crystalBrowseOpeningSummary(opening)
    result.push({ id: opening.id, name: opening.name, artworkUrl: art?.artworkUrl ?? null, isMainPool: false, category, ...summary,
      ascensionSourceIds: hasCrystalSevenStarAscensionRewards(opening, ascensionEvidence) ? [opening.id] : [], availabilityReview: getCrystalAvailabilityReview([opening.id]),
      variants: [{ id: opening.id, name: opening.name, sourceIds: [opening.id], isMainPool: false, category, rarities: summary.rarities,
        selection: opening.selection ?? null, artworkUrl: art?.artworkUrl ?? null, bannerArtworkUrl: art?.bannerArtworkUrl ?? null }] })
  }
  entries = Object.freeze(result)
  return entries
}
