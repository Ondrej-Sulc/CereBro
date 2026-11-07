import { describe, expect, it } from "vitest"
import { assertCrystalOpeningsSourceHash, crystalOpeningsCoverage, crystalOpeningsSource,
  getCrystalOpening, getCrystalOpeningCategory, listCrystalOpenings } from "./index"

describe("public all-reward game snapshot", () => {
  it("retains all source definitions, including openings without direct champion rewards", () => {
    expect(listCrystalOpenings()).toHaveLength(2448)
    expect(crystalOpeningsCoverage).toMatchObject({ categories: 3386, rewardEntries: 40404,
      definitionsWithoutDirectChampions: 336, definitionsWithoutPrizeCategories: 3 })
    expect(crystalOpeningsSource.gachaSha256).toBe("c4873c0f509665e6f32a18be3c57d8c91887c1122e7a9b8b3e3423805922de3e")
    expect(crystalOpeningsSource.observedAt).toBe("2026-11-05T14:05:24+00:00")
    // November 3 membership evidence cannot be silently presented as this source.
    expect(() => assertCrystalOpeningsSourceHash("087359950217387120337353cbb331eb733d9b49a2329db127634d307ae40dd6")).toThrow(/snapshot/)
    expect(JSON.stringify(crystalOpeningsSource)).not.toMatch(/Users|LocalLow|CodexArtifacts|[A-Z]:\\/)
  })

  it("includes mixed Greater Banquet rewards and exact ranges", () => {
    const opening = getCrystalOpening("greater_banquet_crystal_dec23")!
    expect(opening).not.toBeNull()
    expect(opening.categories.map(category => category.id)).toEqual([
      "greater_banquet_crystal_bonus_dec2023", "greater_banquet_crystal_iso_dec2023", "greater_banquet_crystal_gold_dec2023",
    ])
    const rewards = opening.categories.flatMap(category => category.rewards)
    expect(new Set(rewards.map(reward => reward.type))).toEqual(new Set(["inv", "gs", "gf", "sra", "ebp", "ebpf", "hero", "res"]))
    expect(rewards).toContainEqual(expect.objectContaining({ type: "res", data: "sc", quantity: 1, minQuantity: 250000, maxQuantity: 250000 }))
    expect(rewards.some(reward => reward.type === "hero" && reward.data.startsWith("thanos"))).toBe(true)
  })

  it("does not omit Superior Banquet or infer direct champions from its nested rewards", () => {
    const opening = getCrystalOpening("superior_banquet_crystal_dec25")!
    expect(opening.categories).toHaveLength(6)
    const rewards = opening.categories.flatMap(category => category.rewards)
    expect(rewards.some(reward => reward.type === "hero" || reward.type === "hcos")).toBe(false)
    expect(rewards).toContainEqual(expect.objectContaining({ type: "gs", data: "jubilant_crystal_dec25", minQuantity: 1, maxQuantity: 1,
      displayName: "JUBILANT CRYSTAL", nestedCrystalId: "jubilant_crystal_dec25" }))
    expect(rewards).toContainEqual(expect.objectContaining({ type: "ebpf", data: "rare_event", displayName: "TIER 3 ALPHA CATALYST" }))
    expect(rewards).toContainEqual(expect.objectContaining({ type: "gf", data: "7_star_hero_shard_crystal", minQuantity: 100, maxQuantity: 100 }))
    // Raw count tuning is kept as evidence, never translated into guaranteed buckets.
    expect(opening.sourceMetadata).toMatchObject({ minItems: 1, maxItems: 1, endTime: -1 })
    const nested = getCrystalOpening("jubilant_crystal_dec25")!
    expect(nested.categories.flatMap(category => category.rewards)).toContainEqual(expect.objectContaining({ type: "hero", rarity: 7 }))
  })

  it("retains conditional cluster drops, exact pity tags and source anomalies", () => {
    const opening = getCrystalOpening("super_duper_gamestore_box")!
    expect(opening.boxRules?.openLimit).toBe(6)
    expect(opening.conditionalBonuses.length).toBeGreaterThan(0)
    expect(opening.conditionalBonuses.every(binding => binding.bonusReward.autoAscend)).toBe(true)
    expect(opening.conditionalBonuses[0].bonusReward.rewards.every(reward => reward.type === "inv")).toBe(true)
    const anomaly = getCrystalOpeningCategory("ave_map5_crystal_20_0_1")!.rewards.find(reward => reward.quantityRangeStatus)
    expect(anomaly).toMatchObject({ type: "ebpf", data: "epic_mutant", minQuantity: 600, maxQuantity: 500, quantityRangeStatus: "reversed_in_source" })
    const withPity = listCrystalOpenings().find(crystal => crystal.pityTemplateId)!
    expect(getCrystalOpening(withPity.id)?.pity?.groups[0].pityTags.length).toBeGreaterThan(0)
  })
})
