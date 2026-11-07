import { expect, it } from "vitest"
import { loadCrystalPageRewards, type CrystalPageRewards } from "./data/crystal-page-rewards"
import { groupCrystalAscensionBonuses } from "./crystal-ascension-bonuses"

type Bonus = CrystalPageRewards["conditionalBonuses"][number]
const sample = () => structuredClone(loadCrystalPageRewards("valiant_metamorphosis_crystal")!.conditionalBonuses[0])

it("compresses Metamorphosis into six class groups without changing any of its 30 source bindings", () => {
  const opening = loadCrystalPageRewards("valiant_metamorphosis_crystal")!
  const before = JSON.stringify(opening.conditionalBonuses)
  const result = groupCrystalAscensionBonuses(opening.conditionalBonuses)
  expect(result.groups).toHaveLength(6)
  expect(result.groups.map(group => group.className)).toEqual(["Science", "Skill", "Mutant", "Tech", "Cosmic", "Mystic"])
  expect(result.groups.every(group => group.rarity === 7 && group.members.length === 5)).toBe(true)
  expect(result.otherBonuses).toEqual([])
  const members = result.groups.flatMap(group => group.members)
  expect(members.map(member => member.bonus.key)).toEqual(opening.conditionalBonuses.map(bonus => bonus.key))
  for (const group of result.groups) for (const member of group.members) {
    expect(member.championToken.data).toBe(`ascension_token_champion_${member.bonus.trigger.gameId}`)
    expect(member.bonus.rewards).toContain(member.championToken)
    expect(member.bonus.rewards.some(reward => reward.data === group.classToken.data)).toBe(true)
  }
  expect(JSON.stringify(opening.conditionalBonuses)).toBe(before)
})

it("keeps different source categories, rarities and token quantities in separate groups", () => {
  const first = sample()
  const category = { ...structuredClone(first), categoryId: "other_category", key: "other_category:0" }
  const rarity = structuredClone(first); rarity.key = "rarity:0"; rarity.trigger.rarity = 6
  const quantity = structuredClone(first); quantity.key = "quantity:0"; quantity.rewards[1].quantity = 2
  const championQuantity = structuredClone(first); championQuantity.key = "champion_quantity:0"; championQuantity.rewards[0].quantity = 2
  const result = groupCrystalAscensionBonuses([first, category, rarity, quantity, championQuantity])
  expect(result.groups).toHaveLength(5)
  expect(result.groups.every(group => group.members.length === 1)).toBe(true)
})

const unusual: ((bonus: Bonus) => void)[] = [
  bonus => { bonus.autoAscend = false },
  bonus => { bonus.rewards[0].data = "ascension_token_champion_someone_else" },
  bonus => { bonus.rewards[1].data = "ascension_token_class_unknown" },
  bonus => { bonus.rewards.push({ ...bonus.rewards[0], key: "extra", sourceIndex: 2 }) },
  bonus => { bonus.rewards[0].minQuantity = 0; bonus.rewards[0].maxQuantity = 2 },
  bonus => { bonus.trigger.context = { ...bonus.trigger.context, extraCondition: "unreviewed" } },
  bonus => { bonus.rewards[1].action = "unreviewed" },
]
it.each(unusual.map((change, index) => [index, change] as const))("preserves unsupported bonus patterns in the fallback (%s)", (_, change) => {
  const bonus = sample()
  change(bonus)
  const before = JSON.stringify(bonus)
  const result = groupCrystalAscensionBonuses([bonus])
  expect(result.groups).toEqual([])
  expect(result.otherBonuses).toEqual([bonus])
  expect(JSON.stringify(bonus)).toBe(before)
})
