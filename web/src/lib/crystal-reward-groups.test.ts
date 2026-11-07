import { expect, it } from "vitest"
import { groupCrystalRewardCards } from "./crystal-reward-groups"
import { loadCrystalPageRewards, type CrystalRewardCard } from "./data/crystal-page-rewards"

const gold = (quantity: number, index: number, categoryId = "prize1"): CrystalRewardCard => ({ type: "res", data: "sc", quantity,
  sourceIndex: index, key: `${categoryId}:${index}`, categoryId, displayName: "Gold", href: null, imageUrl: null, selection: null })

it("groups amounts of the same resource without losing exact source options", () => {
  const rewards = [gold(100000, 0), gold(200000, 1), gold(500000, 2)]
  const before = JSON.stringify(rewards)
  const grouped = groupCrystalRewardCards(rewards)
  expect(grouped).toHaveLength(1)
  expect(grouped[0].options).toEqual(rewards)
  expect(JSON.stringify(rewards)).toBe(before)
})

it("does not merge prize groups, classes, fragments, links or reward conditions", () => {
  const base = gold(1, 0)
  const rewards = [base, gold(2, 1, "prize2"), { ...gold(2, 2), context: { bonusReward: "bonus" } },
    { ...gold(2, 3), type: "ebp" as const, data: "t6_cosmic" }, { ...gold(3, 4), type: "ebp" as const, data: "t6_tech" },
    { ...gold(4, 5), type: "ebpf" as const, data: "t6_cosmic" }, { ...gold(5, 6), type: "gs" as const, href: "/crystals/example" }]
  expect(groupCrystalRewardCards(rewards)).toHaveLength(rewards.length)
  expect(groupCrystalRewardCards([base, { ...gold(1, 1) }])).toHaveLength(2)
  expect(groupCrystalRewardCards([{ ...base, minQuantity: 100 }, { ...gold(1, 1), minQuantity: 200 }])).toHaveLength(2)
})

it("reduces repeated Banquet amount cards while retaining their original quantity and rate evidence", () => {
  const opening = loadCrystalPageRewards("greater_banquet_crystal_dec22")!
  const before = JSON.stringify(opening)
  const groups = groupCrystalRewardCards(opening.otherRewards)
  const goldGroup = groups.find(group => group.reward.type === "res" && group.reward.data === "sc" && group.reward.categoryId === "greater_banquet_crystal_gold_dec2022")!
  expect(goldGroup.options.map(reward => reward.minQuantity)).toEqual([100000, 200000, 500000, 1000000])
  expect(groups.filter(group => group.reward.type === "res" && group.reward.data === "sc")).toHaveLength(2)
  expect(groups.length).toBeLessThan(opening.otherRewards.length)
  expect(JSON.stringify(opening)).toBe(before)
})
