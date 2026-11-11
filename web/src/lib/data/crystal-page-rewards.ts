import { getCrystalOpening } from "@cerebro/core/data/game-crystal-openings"
import { getCrystalOdds } from "@cerebro/core/data/game-crystal-odds"
import { getCrystalPresentation } from "@cerebro/core/data/game-crystals"
import { getRewardArtwork } from "@cerebro/core/data/game-reward-artwork"
import { getSelectableReward } from "@cerebro/core/data/game-selectable-rewards"
import type { CrystalCatalogDetails } from "@cerebro/core/domain/champion-crystals"
import type { CrystalOpeningReward } from "@cerebro/core/domain/crystal-openings"
import { rewardDisplayName } from "@cerebro/core/domain/reward-display"
import { getNativeRewardPresentation, nativeRewardName, type RewardRankChange } from "@cerebro/core/data/game-reward-presentation"
import { getPublicRewardDefinition } from "@cerebro/core/data/game-reward-definitions"
import { getStaticResourceRewardArtwork } from "@cerebro/core/data/game-resource-artwork"
import { getPublicResourceDefinition } from "@cerebro/core/data/game-resource-definitions"
import { crystalHref } from "../crystal-navigation"
import { buildCrystalOddsVisuals } from "../crystal-odds-presentation"
import { buildCrystalRewardPresentation } from "../crystal-reward-presentation"

export type CrystalRewardCard = CrystalOpeningReward & {
  key: string
  categoryId: string
  href: string | null
  imageUrl: string | null
  selection: { draw: number; pick: number } | null
  rankChange?: RewardRankChange
  itemRarity?: number
  signaturePoints?: number
}

export function resolveCrystalPageOpening(family: CrystalCatalogDetails, incomingId: string, legacyVariant?: string) {
  const ids = new Set(family.variants.flatMap(variant => variant.sourceIds))
  return legacyVariant && ids.has(legacyVariant) ? legacyVariant : ids.has(incomingId) ? incomingId
    : ids.has(family.id) ? family.id : family.variants[0]?.sourceIds[0] ?? null
}

export function loadCrystalPageRewards(id: string) {
  const opening = getCrystalOpening(id)
  if (!opening) return null
  const card = (reward: CrystalOpeningReward, categoryId: string): CrystalRewardCard => {
    const nested = reward.nestedCrystalId ? getCrystalOpening(reward.nestedCrystalId) : null
    const selector = reward.type === "sra" ? getSelectableReward(reward.data) : null
    const artwork = getRewardArtwork(reward.type, reward.data)
    const native = getNativeRewardPresentation(reward.type, reward.data)
    const publicDefinition = getPublicRewardDefinition(reward.type, reward.data)
    const publicResource = getPublicResourceDefinition(reward.type, reward.data)
    return { ...reward, displayName: selector?.name ?? (publicDefinition?.name || null) ?? publicResource?.name ?? (native ? nativeRewardName(native, reward.type) : rewardDisplayName(reward)), itemRarity: native?.rarity, signaturePoints: native?.signaturePoints, rankChange: native?.rankChange, key: `${categoryId}:${reward.sourceIndex}`, categoryId,
      href: nested ? crystalHref(nested.id) : null,
      imageUrl: artwork?.url ?? getStaticResourceRewardArtwork(reward.type, reward.data)?.url ?? publicResource?.imageUrl ?? publicDefinition?.imageUrl ?? (reward.type === "gs" && nested ? getCrystalPresentation(nested.id)?.artworkUrl ?? null : null),
      selection: nested?.selection ?? null }
  }
  const categoryCards = opening.categories.map(category => ({ id: category.id, rewards: category.rewards.map(reward => card(reward, category.id)) }))
  const otherGroups = categoryCards.flatMap(category => {
    const rewards = category.rewards.filter(reward => reward.type !== "hero" && reward.type !== "hcos")
    return rewards.length ? [{ id: category.id, rewards }] : []
  })
  const byChampion = new Map<string, { championId: string; sourceName: string; rarities: Set<number>; firstEditionRarities: Set<number> }>()
  const unresolvedChampionRewards: CrystalOpeningReward[] = []
  for (const category of opening.categories) for (const reward of category.rewards) {
    if (reward.type !== "hero" && reward.type !== "hcos") continue
    if (!reward.gameId || !reward.rarity) { unresolvedChampionRewards.push(reward); continue }
    const row = byChampion.get(reward.gameId) ?? { championId: reward.gameId, sourceName: reward.displayName || reward.gameId, rarities: new Set<number>(), firstEditionRarities: new Set<number>() }
    row.rarities.add(reward.rarity)
    if (reward.type === "hcos" && reward.data.split("|").length === 2 && reward.data.endsWith("|first_edition")) row.firstEditionRarities.add(reward.rarity)
    byChampion.set(reward.gameId, row)
  }
  const champions = [...byChampion.values()].map(row => ({ ...row, rarities: [...row.rarities].sort((a, b) => b - a), firstEditionRarities: [...row.firstEditionRarities].sort((a, b) => b - a) }))
  const odds = getCrystalOdds(id, opening.source.gachaSha256)
  const oddsVisuals = buildCrystalOddsVisuals(odds, otherGroups.flatMap(group => group.rewards))
  return { id: opening.id, name: opening.name, observedAt: opening.source.observedAt, selection: opening.selection ?? null,
    artworkUrl: getCrystalPresentation(id)?.artworkUrl ?? null, bannerArtworkUrl: getCrystalPresentation(id)?.bannerArtworkUrl ?? null,
    odds, oddsVisuals, rewardPresentation: buildCrystalRewardPresentation(odds, categoryCards, oddsVisuals), champions, unresolvedChampionRewards,
    otherGroups, otherRewards: otherGroups.flatMap(group => group.rewards),
    conditionalBonuses: opening.conditionalBonuses.map(binding => ({
      key: `${binding.categoryId}:${binding.rewardIndex}`,
      categoryId: binding.categoryId,
      trigger: opening.categories.find(category => category.id === binding.categoryId)!.rewards[binding.rewardIndex],
      autoAscend: binding.bonusReward.autoAscend,
      rewards: binding.bonusReward.rewards.map(reward => card(reward, `${binding.categoryId}:${binding.rewardIndex}:bonus`)),
    })),
    pity: opening.pity, boxRules: opening.boxRules ?? null }
}

export type CrystalPageRewards = NonNullable<ReturnType<typeof loadCrystalPageRewards>>
