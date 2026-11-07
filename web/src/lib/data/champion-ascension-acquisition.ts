// Server-only static reader. Client components import the types companion.
import { getChampionAscensionAcquisitionSources as read } from "@cerebro/core/data/champion-ascension-acquisition"
import { getAscensionResource, listChampionAscensionEligibility } from "@cerebro/core/data/game-ascension"
import { getRewardArtwork } from "@cerebro/core/data/game-reward-artwork"
import { rewardDisplayName } from "@cerebro/core/domain/reward-display"
import type { AscensionAcquisitionReward, ChampionAscensionAcquisitionSources } from "./champion-ascension-acquisition-types"

let championNames: Map<string, string> | undefined
function rewardName(reward: AscensionAcquisitionReward): string | null {
  if (reward.type === "hero") {
    championNames ??= new Map(listChampionAscensionEligibility().map(row => [row.gameId, row.name]))
    // Canonical blueprint IDs, not a same-name display match.
    const match = /^(.*)_t([1-7])$/.exec(reward.id)
    const name = match && championNames.get(match[1])
    return name ? `${match[2]}-Star ${name}` : null
  }
  const displayName = getAscensionResource(reward.type, reward.id)?.name
  const name = rewardDisplayName({ type: reward.type, data: reward.id, ...(displayName ? { displayName } : {}) })
  return name === reward.id ? null : name
}

/** Exact published artwork only; missing metadata/art stays null. */
export function getChampionAscensionAcquisitionSources(gameId: string, rarity?: number, asOf?: string): ChampionAscensionAcquisitionSources {
  const result = read(gameId, rarity, asOf)
  for (const path of result.paths) for (const step of path.steps) for (const cost of step.costs) {
    cost.name = rewardName({ ...cost, role: "ascension_material" })
    cost.imageUrl = getRewardArtwork(cost.type, cost.id)?.url ?? null
  }
  for (const route of [...result.routes, ...result.definitions]) for (const offer of route.offers) for (const reward of offer.rewards) {
    reward.name = rewardName(reward)
    reward.imageUrl = getRewardArtwork(reward.type, reward.id)?.url ?? null
  }
  return result
}
export type { ChampionAscensionAcquisitionSources, ChampionAscensionAcquisitionRoute, ChampionAscensionMaterialPath } from "./champion-ascension-acquisition-types"
