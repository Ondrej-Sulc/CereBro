import { describe, expect, it } from "vitest"
import { createCrystalOpeningCatalog } from "./crystal-openings"

const hash = "a".repeat(64)
const fixture = () => ({
  version: 1,
  source: { observedAt: "2026-11-05T14:05:24+00:00", capturedAt: "2026-11-05T14:05:24+00:00", gachaSha256: hash,
    gacha: { fileName: "source.bin", sha256: hash, bytes: 12 }, schemaSha256: hash, metadata: [] },
  numericOddsStatus: "not_in_static_catalog",
  crystals: [{ id: "banquet", name: "Banquet", categoryIds: ["main", "gold"], sourceGroup: "events", sourceSet: "events",
    hideOddsInfo: false, sourceMetadata: { minItems: 5, maxItems: 5, endTime: -1 }, pityTemplateId: "pity",
    presentation: { featuredRewards: [{ sourceIndex: 0, type: "hero", data: "promo_only" }] } }],
  categories: [
    { id: "main", rewards: [
      { sourceIndex: 0, type: "hero", data: "hulk_t7", quantity: 1, context: { bonusReward: "cluster" } },
      { sourceIndex: 1, type: "gs", data: "jubilant_crystal_dec25", quantity: 1 },
    ] },
    { id: "gold", rewards: [{ sourceIndex: 0, type: "res", data: "sc", quantity: 1, minQuantity: 250000, maxQuantity: 500000 }] },
  ],
  bonusRewards: [{ id: "cluster", displayName: "Cluster", autoAscend: true,
    rewards: [{ sourceIndex: 0, type: "inv", data: "ascension_token_champion_hulk", quantity: 1 }] }],
  pityTemplates: [{ id: "pity", groupIds: ["threshold"] }],
  pityGroups: [{ id: "threshold", payoutLimit: 35, descriptionTemplate: "Within {0} openings", shortDescriptionTemplate: "", pityTags: ["shared_counter"] }],
  coverage: { definitions: 1, categories: 2, rewardEntries: 3 },
})

describe("source-specific crystal opening catalog", () => {
  it("keeps possible prizes, conditional bonuses, pity and promotional rewards separate", () => {
    const catalog = createCrystalOpeningCatalog(fixture())
    const opening = catalog.getCrystalOpening("banquet")!
    expect(opening.id).toBe("banquet")
    expect(opening.categories.map(category => category.id)).toEqual(["main", "gold"])
    expect(opening.categories[1].rewards[0]).toMatchObject({ quantity: 1, minQuantity: 250000, maxQuantity: 500000 })
    expect(opening.categories[0].rewards[1]).toEqual({ sourceIndex: 1, type: "gs", data: "jubilant_crystal_dec25", quantity: 1 })
    expect(opening.conditionalBonuses).toEqual([{ categoryId: "main", rewardIndex: 0, bonusReward: opening.conditionalBonuses[0].bonusReward }])
    expect(opening.conditionalBonuses[0].bonusReward.autoAscend).toBe(true)
    expect(opening.pity?.groups[0].pityTags).toEqual(["shared_counter"])
    expect(opening.presentation?.featuredRewards?.[0].data).toBe("promo_only")
    expect(opening.categories.flatMap(category => category.rewards).map(reward => reward.data)).not.toContain("promo_only")
    expect(catalog.getCrystalOpening("missing")).toBeNull()
    expect(catalog.listCrystalOpenings()).toHaveLength(1)
  })

  it("requires exact matching source hashes for cross-snapshot joins", () => {
    const catalog = createCrystalOpeningCatalog(fixture())
    expect(() => catalog.assertSourceHash(hash)).not.toThrow()
    expect(() => catalog.assertSourceHash("b".repeat(64))).toThrow(/snapshot/)
  })

  it("prevents caller mutations from poisoning shared source, categories and bonus rows", () => {
    const catalog = createCrystalOpeningCatalog(fixture())
    const opening = catalog.getCrystalOpening("banquet")!
    expect(() => Object.assign(catalog.source, { observedAt: "wrong" })).toThrow()
    expect(() => Object.assign(catalog.listCrystalOpenings()[0], { name: "wrong" })).toThrow()
    expect(() => Object.assign(opening.categories[0].rewards[0], { data: "wrong" })).toThrow()
    expect(() => Object.assign(opening.conditionalBonuses[0].bonusReward.rewards[0], { quantity: 999 })).toThrow()
    expect(() => Object.assign(catalog.getCrystalOpeningCategory("main")!, { id: "wrong" })).toThrow()
    // Top-level view arrays belong to this read, so changing one cannot affect another.
    opening.categories.pop()
    expect(catalog.getCrystalOpening("banquet")!.categories).toHaveLength(2)
  })

  it("rejects dangling categories, bonus and pity bindings and duplicate IDs", () => {
    const mutations = [
      (input: ReturnType<typeof fixture>) => { input.crystals[0].categoryIds.push("missing") },
      (input: ReturnType<typeof fixture>) => { Object.assign(input.categories[0].rewards[0], { context: { bonusReward: "missing" } }) },
      (input: ReturnType<typeof fixture>) => { input.pityTemplates[0].groupIds.push("missing") },
      (input: ReturnType<typeof fixture>) => { input.crystals.push(input.crystals[0]) },
    ]
    for (const mutate of mutations) {
      const input = fixture(); mutate(input)
      expect(() => createCrystalOpeningCatalog(input)).toThrow()
    }
  })
})
