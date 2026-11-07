// Server-only static reader. Client components must use the types companion.
import { crystalOpeningsSource, getCrystalOpening, listCrystalOpenings } from "@cerebro/core/data/game-crystal-openings"
import { getAscensionResource, getChampionAscensionRules } from "@cerebro/core/data/game-ascension"
import { getCrystalPresentation } from "@cerebro/core/data/game-crystals"
import { getRewardArtwork } from "@cerebro/core/data/game-reward-artwork"
import type { CrystalOpeningReward } from "@cerebro/core/domain/crystal-openings"
import type { ChampionCrystalAscensionSource, ChampionCrystalAscensionSources } from "./champion-crystal-ascension-types"

export type { ChampionCrystalAscensionSource, ChampionCrystalAscensionSources } from "./champion-crystal-ascension-types"

let index: Map<string, ChampionCrystalAscensionSource[]> | undefined
const identities = new Map<string, { gameId: string; name: string; rarities: number[] }>()
const isMaterial = (reward: CrystalOpeningReward) => reward.type === "inv"
  && /^(?:ascension_token_(?:champion|class)_[a-z0-9_]+|primordial_dust_t[1-3])$/.test(reward.data)

function sourceIndex() {
  if (index) return index
  const result = new Map<string, ChampionCrystalAscensionSource[]>()
  const tokenStars = new Map<string, number[]>()
  const artwork = (reward: CrystalOpeningReward) => ({ ...reward, imageUrl: getRewardArtwork(reward.type, reward.data)?.url ?? null })
  const add = (gameId: string, source: ChampionCrystalAscensionSource) => {
    const rows = result.get(gameId) ?? []
    rows.push(source)
    result.set(gameId, rows)
    const identity = identities.get(gameId) ?? { gameId, name: gameId, rarities: [] }
    identity.rarities = [...new Set([...identity.rarities, ...source.rarities])].sort((a, b) => b - a)
    identities.set(gameId, identity)
  }
  const starsForToken = (gameId: string, id: string) => {
    if (tokenStars.has(id)) return tokenStars.get(id)!
    const stars = new Set(getChampionAscensionRules(gameId).filter(rule => rule.steps.some(step =>
      step.cost.some(cost => cost.type === "inv" && cost.id === id))).map(rule => rule.rarity))
    // Usage metadata is explicit source evidence even when a newer token is not
    // yet on a collectible blueprint path. Never derive stars from the name.
    const resource = getAscensionResource("inv", id)
    for (const tag of resource?.metadataResolved ? (resource.usageTags ?? "").split(/[\s,;|]+/) : []) {
      const match = /^t([1-7]):(.+)$/.exec(tag)
      if (match?.[2] === gameId) stars.add(Number(match[1]))
    }
    const values = [...stars].sort((a, b) => b - a)
    tokenStars.set(id, values)
    return values
  }
  // Build once from the opening snapshot, including definitions absent from the
  // older hero-membership catalog. No nested, selector or preview expansion.
  for (const definition of listCrystalOpenings()) {
    const opening = getCrystalOpening(definition.id)!
    const common = { id: opening.id, name: opening.name, artworkUrl: getCrystalPresentation(opening.id)?.artworkUrl ?? null }
    for (const binding of opening.conditionalBonuses) {
      const trigger = opening.categories.find(category => category.id === binding.categoryId)?.rewards[binding.rewardIndex]
      if (!trigger?.gameId || !trigger.rarity || !["hero", "hcos"].includes(trigger.type)) continue
      if (!binding.bonusReward.autoAscend && !binding.bonusReward.rewards.some(isMaterial)) continue
      add(trigger.gameId, { ...common,
        key: JSON.stringify([opening.id, binding.categoryId, binding.rewardIndex, "champion-bonus", binding.bonusReward.id]),
        rarities: [trigger.rarity], kind: "champion-bonus", autoAscend: binding.bonusReward.autoAscend,
        categoryId: binding.categoryId, rewardIndex: binding.rewardIndex, rewards: binding.bonusReward.rewards.map(artwork) })
      if (trigger.displayName) identities.get(trigger.gameId)!.name = trigger.displayName
    }
    for (const category of opening.categories) for (const reward of category.rewards) {
      if (reward.type !== "inv" || !reward.data.startsWith("ascension_token_champion_")) continue
      const gameId = reward.data.slice("ascension_token_champion_".length)
      if (!gameId) continue
      const rarities = starsForToken(gameId, reward.data)
      if (!rarities.length) continue
      add(gameId, { ...common, key: JSON.stringify([opening.id, category.id, reward.sourceIndex, "champion-token", reward.data]),
        rarities, kind: "champion-token", autoAscend: false, categoryId: category.id,
        rewardIndex: reward.sourceIndex, rewards: [artwork(reward)] })
    }
  }
  for (const rows of result.values()) rows.sort((a, b) => a.name.localeCompare(b.name, "en") || a.key.localeCompare(b.key, "en"))
  index = result
  return index
}

/** Recorded outcomes, not a claim about current sale, probability or eligibility. */
export function getChampionCrystalAscensionSources(gameId: string, rarity?: number): ChampionCrystalAscensionSources {
  const rows = sourceIndex().get(gameId) ?? []
  return { observedAt: crystalOpeningsSource.observedAt,
    crystals: structuredClone(rows.filter(row => rarity === undefined || row.rarities.includes(rarity))) }
}

/** Small server projection for the finder, including newer source-only champions. */
export function getChampionCrystalAscensionChampions() {
  sourceIndex()
  return structuredClone([...identities.values()])
}
