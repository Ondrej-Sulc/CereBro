import { expect, it } from "vitest"
import { createCrystalCatalog, type CrystalCatalogData } from "./champion-crystals"
import { buildCrystalFamilies } from "./crystal-families"

const fixture = (): CrystalCatalogData => ({
  version: 1, source: { observedAt: "2026-11-03T09:10:42+00:00", gachaSha256: "a".repeat(64), bcgSha256: "b".repeat(64), metadata: [] },
  tiers: [{ id: "hulk_t7", championId: "hulk", rarity: 7 }, { id: "hulk_t6", championId: "hulk", rarity: 6 }],
  pools: [{ id: "basic", heroTierIds: ["hulk_t7"] }, { id: "different", heroTierIds: ["hulk_t7", "hulk_t6"] }],
  crystals: [
    { id: "7_star_hero_shard_crystal", name: "7-STAR HERO CRYSTAL", group: "events", set: "all", categoryIds: ["basic"], selection: null },
    { id: "7star_nexus_crystal", name: "7-STAR NEXUS HERO CRYSTAL", group: "events", set: "all", categoryIds: ["basic"], selection: { draw: 3, pick: 1 } },
    { id: "7star_nexus_crystal_1_of_5", name: "7-STAR EPOCH NEXUS HERO CRYSTAL", group: "events", set: "all", categoryIds: ["basic"], selection: { draw: 5, pick: 1 } },
    { id: "7_star_titan_hero_shard_crystal", name: "7-STAR TITAN CRYSTAL", group: "events", set: "all", categoryIds: ["different"], selection: null },
  ], coverage: { definitions: 4, definitionsWithDirectHeroes: 4, rewardItemTypes: { hero: 3 }, directRewardsOnly: true },
})

it("groups verified base, Nexus and Epoch variants while retaining opening rules and source identities", () => {
  const crystals = createCrystalCatalog(fixture()).forChampion("hulk").crystals
  const families = buildCrystalFamilies(crystals, 7)
  expect(families).toHaveLength(2)
  expect(families[0].name).toBe("7-STAR HERO CRYSTAL")
  expect(families[0].variants.map(v => [v.family?.variantLabel, v.selection, v.sourceIds])).toEqual([
    ["Standard", null, ["7_star_hero_shard_crystal"]],
    ["Nexus", { draw: 3, pick: 1 }, ["7star_nexus_crystal"]],
    ["Epoch Nexus", { draw: 5, pick: 1 }, ["7star_nexus_crystal_1_of_5"]],
  ])
  expect(families[1].name).toBe("7-STAR TITAN CRYSTAL")
})

it("keeps a named variant separate when its actual pool differs and filters rarity before grouping", () => {
  const data = fixture()
  data.crystals[1].categoryIds = ["different"]
  const crystals = createCrystalCatalog(data).forChampion("hulk").crystals
  expect(buildCrystalFamilies(crystals, 7)).toHaveLength(3)
  expect(buildCrystalFamilies(crystals, 6).flatMap(f => f.variants).map(v => v.sourceIds[0])).toEqual(["7_star_titan_hero_shard_crystal", "7star_nexus_crystal"])
})
