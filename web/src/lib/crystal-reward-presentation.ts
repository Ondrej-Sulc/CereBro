import type { CrystalOddsGroup, CrystalOddsOpening, CrystalOddsRow } from "@cerebro/core/domain/crystal-odds"
import { rewardDisplayName } from "@cerebro/core/domain/reward-display"
import type { CrystalRewardCard } from "./data/crystal-page-rewards"
import { crystalOddsIconKind, crystalOddsRowKey, type CrystalOddsRowVisual, type CrystalOddsVisuals } from "./crystal-odds-presentation"

export type CrystalRewardVariant = { reward: CrystalRewardCard; label: string; className: string | null; options: CrystalRewardCard[] }
export type CrystalRewardRate = { key: string; rate: CrystalOddsRow; variants: CrystalRewardVariant[]; visual: CrystalOddsRowVisual }
export type CrystalRewardPrize = Pick<CrystalOddsGroup, "sourceIndex" | "name" | "isFeatured"> & { rows: CrystalRewardRate[]; guaranteed: boolean }
export type CrystalRewardPresentation = { groups: CrystalRewardPrize[]; unrated: CrystalRewardVariant[]; championOdds: CrystalOddsOpening | null; hasRates: boolean }
type Category = { id: string; rewards: readonly CrystalRewardCard[] }
type Cell = { key: string; group: CrystalOddsGroup; row: CrystalOddsRow }
const classes: Record<string, string> = { chemical: "Science", cosmic: "Cosmic", mutant: "Mutant", mystic: "Mystic", tech: "Tech", trained: "Skill" }
const hero = (reward: CrystalRewardCard) => reward.type === "hero" || reward.type === "hcos"
const normalize = (text: string) => text.normalize("NFKD").toLocaleLowerCase("en").replace(/\b(shard|fragment)s\b/g, "$1").replace(/[^a-z0-9]/g, "")
const rewardClass = (reward: CrystalRewardCard) => classes[reward.data.split("_").at(-1) ?? ""] ?? null

function inventoryName(reward: CrystalRewardCard) {
  const match = reward.type === "inv" && reward.data.match(/^(sigupfive|sigup|awaken)_t([1-7])(?:_(chemical|cosmic|mutant|mystic|tech|trained|generic))?$/)
  if (!match) return null
  return { stars: match[2], item: match[1] === "awaken" ? "Awakening Gem" : "Signature Stone", plusFive: match[1] === "sigupfive" }
}

function variantName(reward: CrystalRewardCard) {
  const inventory = inventoryName(reward)
  if (inventory) return [`${inventory.stars}-Star`, rewardClass(reward), inventory.plusFive ? "+5" : null, inventory.item].filter(Boolean).join(" ")
  const name = rewardDisplayName(reward)
  return reward.type === "ebpf" && !/fragment/i.test(name) ? `${name} Fragments` : name
}

function aliases(reward: CrystalRewardCard) {
  const name = variantName(reward)
  const result = new Set([normalize(name)])
  if (hero(reward) && reward.rarity) {
    result.add(normalize(`${reward.rarity}-Star Hero`))
    result.add(normalize(`${reward.rarity}-Star Champion`))
    result.add(normalize(`${reward.rarity}-Star ${rewardDisplayName(reward)}`))
  }
  if (reward.type === "ebp" || reward.type === "ebpf") {
    result.add(normalize(name.replace(/\b(?:Science|Cosmic|Mutant|Mystic|Tech|Skill)\b/i, "Class")))
    if (/ISO-?8/i.test(name)) result.add(normalize("ISO-8"))
  }
  const inventory = inventoryName(reward)
  if (inventory) {
    result.add(normalize(`${inventory.stars}-Star ${inventory.item}`))
    if (inventory.plusFive) result.add(normalize(`${inventory.stars}-Star +5 ${inventory.item}`))
  }
  return result
}

function matches(row: CrystalOddsRow, reward: CrystalRewardCard, names: Set<string>) {
  if (row.rewardType && row.rewardType !== reward.type) return false
  if (row.rewardType && row.rewardData !== undefined) return row.rewardData === reward.data
  return names.has(normalize(row.label || row.rewardData || ""))
}

function variants(rewards: readonly CrystalRewardCard[]): CrystalRewardVariant[] {
  const groups = new Map<string, CrystalRewardVariant>()
  for (const reward of rewards) {
    const context = Object.entries(reward.context ?? {}).sort(([a], [b]) => a.localeCompare(b))
    const key = JSON.stringify([reward.categoryId, reward.type, reward.data, reward.displayName, reward.rarity, reward.action, reward.header, reward.footer, reward.balance, context, reward.href, reward.imageUrl, reward.selection])
    const group = groups.get(key)
    if (group) group.options.push(reward)
    else groups.set(key, { reward, label: variantName(reward), className: rewardClass(reward), options: [reward] })
  }
  return [...groups.values()]
}

/** Join only within this opening. An ambiguous binding never receives quantities.
 * Scope constraints use category membership and complete matching sets, never
 * prize numbering, source-array position, amounts or probability magnitudes. */
export function buildCrystalRewardPresentation(odds: CrystalOddsOpening | null, categories: readonly Category[], visuals: CrystalOddsVisuals = {}): CrystalRewardPresentation {
  const groups = odds?.status === "captured" ? odds.groups ?? [] : []
  const cells: Cell[] = groups.flatMap(group => group.rows.map(row => ({ key: crystalOddsRowKey(group.sourceIndex, row.sourceIndex), group, row })))
  const rewards = categories.flatMap(category => category.rewards)
  const hits = new Map(rewards.map(reward => { const names = aliases(reward); return [reward.key, cells.filter(cell => matches(cell.row, reward, names))] as const }))
  const scopes = new Map(categories.map(category => {
    const matchable = category.rewards.map(reward => hits.get(reward.key)!).filter(list => list.length)
    const intersection = matchable.length ? [...new Set(matchable[0].map(cell => cell.group.sourceIndex))].filter(index => matchable.every(list => list.some(cell => cell.group.sourceIndex === index))) : []
    return [category.id, new Set(intersection)] as const
  }))
  const candidates = (cell: Cell, scoped: boolean) => categories.filter(category => {
    const scope = scopes.get(category.id)!
    return (!scoped || !scope.size || scope.has(cell.group.sourceIndex)) && category.rewards.some(reward => hits.get(reward.key)!.includes(cell))
  })
  let changed = true
  while (changed) {
    changed = false
    for (const cell of cells) {
      const possible = candidates(cell, true)
      if (possible.length === 1 && scopes.get(possible[0].id)!.size > 1) {
        scopes.set(possible[0].id, new Set([cell.group.sourceIndex])); changed = true
      }
    }
  }
  const inconsistent = new Set(cells.flatMap(cell => candidates(cell, true).length ? [] : candidates(cell, false).map(category => category.id)))
  const bound = new Map<string, CrystalRewardCard[]>()
  const used = new Set<string>()
  for (const reward of rewards) {
    const matching = hits.get(reward.key)!
    const scope = scopes.get(reward.categoryId)!
    const scoped = !inconsistent.has(reward.categoryId) && scope.size === 1 ? matching.filter(cell => scope.has(cell.group.sourceIndex)) : []
    const cell = matching.length === 1 ? matching[0] : scoped.length === 1 ? scoped[0] : null
    if (!cell) continue
    const list = bound.get(cell.key) ?? []; list.push(reward); bound.set(cell.key, list); used.add(reward.key)
  }
  const championKeys = new Set(cells.filter(cell => { const list = bound.get(cell.key) ?? []; return list.length > 0 && list.every(hero) }).map(cell => cell.key))
  // Move only whole champion-only groups beside the pool. Slicing a mixed group
  // hides part of its disclosure in the star filters and makes the rest look incomplete.
  const championGroups = groups.filter(group => group.rows.length > 0 && group.rows.every(row => championKeys.has(crystalOddsRowKey(group.sourceIndex, row.sourceIndex))))
  const projected = groups.filter(group => !championGroups.includes(group)).map(group => ({ sourceIndex: group.sourceIndex, name: group.name, isFeatured: group.isFeatured,
    guaranteed: group.rows.length > 0 && group.rows.every(row => Number(row.percentValue) === 100 && !row.prefix),
    rows: group.rows.map(rate => {
      const key = crystalOddsRowKey(group.sourceIndex, rate.sourceIndex)
      return { key, rate, variants: variants((bound.get(key) ?? []).filter(reward => !hero(reward))),
        visual: visuals[key] ?? { imageUrl: null, href: null, kind: crystalOddsIconKind(rate.label ?? "") } }
    }) })).filter(group => group.rows.length)
  if (projected.every(group => /^PRIZE\s*\d+$/i.test(group.name ?? "")) && new Set(projected.map(group => group.name)).size === projected.length) {
    projected.sort((a, b) => Number(a.name!.match(/\d+$/)![0]) - Number(b.name!.match(/\d+$/)![0]))
  }
  return { groups: projected, unrated: variants(rewards.filter(reward => !hero(reward) && !used.has(reward.key))),
    championOdds: odds && championGroups.length ? { ...odds, groups: championGroups } : null, hasRates: cells.length > 0 }
}

export function crystalRewardAmount(reward: CrystalRewardCard) {
  if (reward.quantityRangeStatus === "reversed_in_source") return "Range unavailable"
  if (reward.minQuantity !== undefined && reward.maxQuantity !== undefined) return reward.minQuantity === reward.maxQuantity
    ? `×${reward.minQuantity.toLocaleString("en")}` : `${reward.minQuantity.toLocaleString("en")}–${reward.maxQuantity.toLocaleString("en")}`
  return reward.quantity !== undefined ? `×${reward.quantity.toLocaleString("en")}` : ""
}
