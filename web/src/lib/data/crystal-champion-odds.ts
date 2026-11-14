import { getCrystalOpening } from "@cerebro/core/data/game-crystal-openings"
import type { CrystalOpeningReward } from "@cerebro/core/domain/crystal-openings"
import { crystalOddsRowKey, type CrystalOddsVisuals } from "@/lib/crystal-odds-presentation"
import type { CrystalPageRewards } from "./crystal-page-rewards"

type Portrait = { gameId: string; portraitUrl: string | null; slug: string | null }
const isChampion = (reward: CrystalOpeningReward) => reward.type === "hero" || reward.type === "hcos"
function identity(rewards: readonly CrystalOpeningReward[]) {
  const first = rewards[0]
  if (!first?.gameId || !first.rarity || !isChampion(first)) return null
  if (rewards.some(reward => !isChampion(reward) || reward.gameId !== first.gameId || reward.rarity !== first.rarity)) return null
  return { gameId: first.gameId, rarity: first.rarity }
}

/** Decorative champion metadata only. Rates, group membership and reward amounts stay intact. */
export function withCrystalChampionRateVisuals(opening: CrystalPageRewards, champions: readonly Portrait[]): CrystalPageRewards {
  const source = getCrystalOpening(opening.id)
  if (!source || opening.odds?.status !== "captured") return opening
  const rewards = source.categories.flatMap(category => category.rewards)
  const portraits = new Map<string, Portrait | null>()
  for (const portrait of champions) portraits.set(portrait.gameId, portraits.has(portrait.gameId) ? null : portrait)
  const visuals: CrystalOddsVisuals = {}
  for (const group of opening.odds.groups ?? []) for (const row of group.rows) {
    const key = crystalOddsRowKey(group.sourceIndex, row.sourceIndex)
    let named: ReturnType<typeof identity> = null
    if ((row.rewardType === "hero" || row.rewardType === "hcos") && row.rewardData !== undefined) {
      named = identity(rewards.filter(reward => reward.type === row.rewardType && reward.data === row.rewardData))
    } else if (row.bonusRewardId) {
      const triggers = source.conditionalBonuses.filter(binding => binding.bonusReward.id === row.bonusRewardId && binding.bonusReward.autoAscend)
        .flatMap(binding => {
          const reward = source.categories.find(category => category.id === binding.categoryId)?.rewards[binding.rewardIndex]
          return reward ? [reward] : []
        })
      named = identity(triggers)
    }
    if (named) {
      const portrait = portraits.get(named.gameId)
      visuals[key] = { kind: "champion", imageUrl: portrait?.portraitUrl ?? null,
        href: portrait?.slug ? `/champions/${portrait.slug}` : null, rarity: named.rarity }
    } else if (row.rewardType === undefined && row.rewardData === undefined && row.bonusRewardId === undefined) {
      const category = /^([1-7])-Star (?:Ascended )?(?:Hero|Champion)(?: \+ Ascension Tokens)?$/i.exec(row.label ?? "")
      if (category) visuals[key] = { kind: "champion", imageUrl: null, href: null, rarity: Number(category[1]) }
    }
  }
  return { ...opening, oddsVisuals: { ...opening.oddsVisuals, ...visuals }, rewardPresentation: {
    ...opening.rewardPresentation, groups: opening.rewardPresentation.groups.map(group => ({ ...group,
      rows: group.rows.map(row => visuals[row.key] ? { ...row, visual: visuals[row.key] } : row),
    })),
  } }
}
