import type { CrystalPageRewards, CrystalRewardCard } from "./data/crystal-page-rewards"

type Bonus = CrystalPageRewards["conditionalBonuses"][number]
type Reward = Bonus["trigger"]
const classes = {
  chemical: { name: "Science", championClass: "SCIENCE" },
  trained: { name: "Skill", championClass: "SKILL" },
  mutant: { name: "Mutant", championClass: "MUTANT" },
  tech: { name: "Tech", championClass: "TECH" },
  cosmic: { name: "Cosmic", championClass: "COSMIC" },
  mystic: { name: "Mystic", championClass: "MYSTIC" },
} as const
type ClassId = keyof typeof classes

export type CrystalAscensionBonusGroup = {
  key: string
  className: string
  championClass: typeof classes[ClassId]["championClass"]
  rarity: number
  classToken: CrystalRewardCard
  members: { bonus: Bonus; championToken: CrystalRewardCard }[]
}

function fixedQuantity(reward: Reward) {
  if (reward.quantityRangeStatus) return null
  const { quantity, minQuantity, maxQuantity } = reward
  if (minQuantity !== undefined || maxQuantity !== undefined) {
    if (minQuantity === undefined || minQuantity !== maxQuantity || (quantity !== undefined && quantity !== minQuantity)) return null
    return minQuantity > 0 ? minQuantity : null
  }
  return quantity !== undefined && quantity > 0 ? quantity : null
}

function hasConditions(reward: Reward, allowedContext: string[] = []) {
  return [reward.action, reward.balance, reward.header, reward.footer, reward.nestedCrystalId].some(value => value !== undefined)
    || Object.keys(reward.context ?? {}).some(key => !allowedContext.includes(key))
}

/** Share repeated class tokens only within identical, explicitly bound ascension outcomes. */
export function groupCrystalAscensionBonuses(bonuses: Bonus[]) {
  const groups = new Map<string, CrystalAscensionBonusGroup>()
  const otherBonuses: Bonus[] = []
  for (const bonus of bonuses) {
    const { trigger } = bonus
    const championToken = bonus.rewards.find(reward => reward.type === "inv" && reward.data === `ascension_token_champion_${trigger.gameId}`)
    const classToken = bonus.rewards.find(reward => reward.type === "inv" && reward.data.startsWith("ascension_token_class_"))
    const classId = classToken?.data.slice("ascension_token_class_".length) as ClassId | undefined
    if (!bonus.autoAscend || trigger.type !== "hero" || !trigger.gameId || !trigger.rarity || !bonus.categoryId
      || fixedQuantity(trigger) !== 1 || hasConditions(trigger, ["bonusReward"])
      || bonus.rewards.length !== 2 || !championToken || !classToken || !classId || !Object.hasOwn(classes, classId)
      || bonus.rewards.some(reward => fixedQuantity(reward) === null || hasConditions(reward) || reward.href || reward.selection)) {
      otherBonuses.push(bonus)
      continue
    }
    // Keep raw quantity representation and token metadata: no averaging, summing or cross-pool merging.
    const tokenShape = (reward: CrystalRewardCard) => [reward.type, reward.quantity, reward.minQuantity, reward.maxQuantity, reward.rarity, reward.gameId]
    const fingerprint = JSON.stringify([bonus.categoryId, trigger.rarity, trigger.quantity, trigger.minQuantity, trigger.maxQuantity,
      classToken.data, classToken.displayName, classToken.imageUrl, tokenShape(classToken), tokenShape(championToken)])
    let group = groups.get(fingerprint)
    if (!group) {
      group = { key: bonus.key, className: classes[classId].name, championClass: classes[classId].championClass,
        rarity: trigger.rarity, classToken, members: [] }
      groups.set(fingerprint, group)
    }
    group.members.push({ bonus, championToken })
  }
  return { groups: [...groups.values()], otherBonuses }
}
