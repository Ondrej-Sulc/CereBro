import { expect, it } from "vitest"
import artwork from "../data/game-crystals/artwork.json"
import { getChampionCrystals, getCrystalDetails } from "../data/game-crystals"
import { publishedCrystalArtworkSchema } from "../domain/crystal-artwork"

it("ships only source-bound immutable cloud references, without local deployment assets", () => {
  const manifest = publishedCrystalArtworkSchema.parse(artwork)
  expect(manifest.assets.length).toBeGreaterThan(700)
  expect(manifest.assets.every(asset => asset.width > 0 && asset.height > 0)).toBe(true)
  expect(manifest.assets.every(asset => !Object.hasOwn(asset, "file"))).toBe(true)
})

it("uses actual, distinct in-game artwork for basic, Titan and Nexus crystals", () => {
  const hulk = getChampionCrystals("hulk").crystals
  const strange = getChampionCrystals("drstrange").crystals
  const basic = hulk.find(c => c.sourceIds.includes("7_star_hero_shard_crystal"))!
  const titan = strange.find(c => c.sourceIds.includes("7_star_titan_hero_shard_crystal"))!
  const nexus = strange.find(c => c.sourceIds.includes("7_star_nexus_titan_hero_shard_crystal"))!
  expect(new Set([basic.artworkUrl, titan.artworkUrl, nexus.artworkUrl]).size).toBe(3)
  expect([...hulk, ...strange].filter(c => c.isMainPool).every(c => c.artworkUrl?.startsWith("https://storage.googleapis.com/champion-images/crystals/primary/"))).toBe(true)
  expect(basic.bannerArtworkUrl).toMatch(/^https:\/\/storage.googleapis.com\/champion-images\/crystals\/banner\/[a-f0-9]{64}\.webp$/)
  const titanBanner = artwork.assets.find(asset => asset.role === "banner" && asset.reference === "gacha/7_star_titan_hero_shard_crystal/Gacha_Titan_Pool_Sep_26_7d4f7cb0ad51.jpg")
  expect(titanBanner).toBeDefined()
  expect(titan.bannerArtworkUrl).toBe(titanBanner?.url)
})

it.each([
  ["3_star_hero_shard_crystal", "3_star_hero_crystal"],
  ["4_star_hero_shard_crystal", "4_star_hero_crystal"],
  ["cavalier_crystal_v2", "cavalier_shards_v2"],
  ["premium_hero_shard", "premium_hero_improvedspin"],
])("keeps %s grouped with its exact-pool counterpart despite different banners", (anchor, alternate) => {
  const family = getCrystalDetails(anchor)!
  expect(family.variants.flatMap(variant => variant.sourceIds)).toContain(alternate)
  expect(getCrystalDetails(alternate)?.id).toBe(family.id)
  expect(family.variants.every(variant => variant.bannerArtworkUrl)).toBe(true)
})
