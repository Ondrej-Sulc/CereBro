import { expect, it } from "vitest"
import { createCrystalCatalog, type CrystalCatalogData } from "./champion-crystals"

const fixture = (): CrystalCatalogData => ({
  version: 1, source: { observedAt: "2026-11-03T09:10:42+00:00", gachaSha256: "a".repeat(64), bcgSha256: "b".repeat(64), metadata: [] },
  tiers: [{ id: "hulk7", championId: "hulk", rarity: 7 }, { id: "strange7", championId: "drstrange", rarity: 7 }, { id: "hulk6", championId: "hulk", rarity: 6 }],
  pools: [{ id: "basic", heroTierIds: ["hulk7", "strange7", "hulk7"] }, { id: "old", heroTierIds: ["hulk6"] }],
  crystals: [
    { id: "7_star_hero_shard_crystal", name: "7-STAR HERO CRYSTAL", group: "events", set: "all", categoryIds: ["basic"], selection: null },
    { id: "7star_nexus_crystal", name: "7-STAR NEXUS HERO CRYSTAL", group: "events", set: "all", categoryIds: ["basic"], selection: { draw: 3, pick: 1 } },
    { id: "historical", name: "7-STAR HERO CRYSTAL", group: "events", set: "all", categoryIds: ["old"], selection: null },
    { id: "historical_alias", name: "7-STAR HERO CRYSTAL", group: "events", set: "all", categoryIds: ["old"], selection: null },
  ], coverage: { definitions: 4, definitionsWithDirectHeroes: 4, rewardItemTypes: { hero: 3 }, directRewardsOnly: true },
})

it("lists families with deduplicated champion counts and preserves different pools with equal names", () => {
  const catalog = createCrystalCatalog(fixture())
  const families = catalog.listCrystalFamilies()
  expect(families).toHaveLength(2)
  expect(families[0]).toMatchObject({ id: "7_star_hero_shard_crystal", championCount: 2, rarities: [7], championCountsByRarity: { "7": 2 }, isMainPool: true })
  expect(families[0].variants.map(v => v.id)).toEqual(["7_star_hero_shard_crystal", "7star_nexus_crystal"])
  expect(families[1]).toMatchObject({ id: "historical", championCount: 1, rarities: [6], isMainPool: false })
})

it("indexes only champions and stars reachable from a recorded direct reward", () => {
  const data = fixture()
  data.tiers.push({ id: "unused1", championId: "unused", rarity: 1 })
  data.pools.push({ id: "unreferenced", heroTierIds: ["unused1"] })
  const champions = createCrystalCatalog(data).listCrystalChampions()
  expect(champions).toEqual([
    { gameId: "drstrange", name: "drstrange", rarities: [7] },
    { gameId: "hulk", name: "hulk", rarities: [7, 6] },
  ])
})

it("resolves variant and alias links to exact contents without mixing same-name pools", () => {
  const catalog = createCrystalCatalog(fixture())
  const nexus = catalog.getCrystalDetails("7star_nexus_crystal")!
  expect(nexus.id).toBe("7_star_hero_shard_crystal")
  expect(nexus.contents).toEqual([
    { championId: "drstrange", rarities: [7], tierIds: ["strange7"] },
    { championId: "hulk", rarities: [7], tierIds: ["hulk7"] },
  ])
  expect(catalog.getCrystalDetails("historical_alias")?.contents).toEqual([{ championId: "hulk", rarities: [6], tierIds: ["hulk6"] }])
  expect(catalog.getCrystalDetails("does_not_exist")).toBeNull()
})

it("keeps identical reward aliases together when their browsing clues differ", () => {
  const data = fixture()
  data.crystals[2].id = "a_generic_alias"
  data.crystals[3].id = "cfh_hulk_hero_crystal"
  data.crystals[3].promotedChampionIds = ["hulk"]
  const families = createCrystalCatalog(data).listCrystalFamilies()
  expect(families).toHaveLength(2)
  expect(families[1].variants).toHaveLength(1)
  expect(families[1].variants[0].sourceIds).toEqual(["a_generic_alias", "cfh_hulk_hero_crystal"])
  expect(families[1].category).toBe("spotlight")
})
