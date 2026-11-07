import type { CrystalRewardCard } from "./data/crystal-page-rewards"

export type CrystalRewardGroup = { reward: CrystalRewardCard; options: CrystalRewardCard[] }
const types = new Set(["res", "ebp", "ebpf", "inv"])
function identity(reward: CrystalRewardCard) {
  if (!types.has(reward.type) || reward.href || reward.selection || reward.quantityRangeStatus ||
    reward.quantity === undefined && (reward.minQuantity === undefined || reward.maxQuantity === undefined)) return null
  const context = Object.entries(reward.context ?? {}).sort(([left], [right]) => left.localeCompare(right))
  return JSON.stringify([reward.type, reward.data, reward.categoryId, reward.rarity, reward.imageUrl, reward.displayName,
    reward.action, reward.header, reward.footer, reward.balance, context])
}
const amountKey = (reward: CrystalRewardCard) => JSON.stringify(reward.minQuantity !== undefined && reward.maxQuantity !== undefined
  ? [reward.minQuantity, reward.maxQuantity] : [reward.quantity, reward.quantity])

/** Presentation only: quantities remain exact options, never totals or inferred
 * continuous ranges. Prize groups and conditional rewards cannot be combined. */
export function groupCrystalRewardCards(rewards: readonly CrystalRewardCard[]): CrystalRewardGroup[] {
  const groups = new Map<string, CrystalRewardCard[]>()
  for (const reward of rewards) {
    const key = identity(reward)
    if (!key) continue
    const group = groups.get(key) ?? []
    group.push(reward); groups.set(key, group)
  }
  const emitted = new Set<string>()
  return rewards.flatMap(reward => {
    const key = identity(reward)
    const options = key ? groups.get(key)! : [reward]
    if (!key || options.length < 2 || new Set(options.map(amountKey)).size < 2) return [{ reward, options: [reward] }]
    if (emitted.has(key)) return []
    emitted.add(key)
    return [{ reward, options }]
  })
}
