import { expect, it } from "vitest"
import { getChampionCrystals, getChampionCrystalSummary, getCrystalDetails } from "../data/game-crystals"

it("includes Gwenom's 7-star First Edition rewards from both recorded Grace crystals", () => {
  const crystals = getChampionCrystals("gwenom").crystals
  for (const id of ["pfh_gwenom_en_pointe_crystal", "vfh_gwenom_broken_justice_crystal"]) {
    expect(crystals.find(crystal => crystal.sourceIds.includes(id))?.rarities).toContain(7)
    expect(getCrystalDetails(id)?.contents.find(reward => reward.championId === "gwenom")).toMatchObject({ rarities: expect.arrayContaining([7]), cosmeticRewards: [{ tierId: "gwenom_t7", rarity: 7, cosmeticId: "first_edition" }] })
  }
  expect(getChampionCrystalSummary("gwenom").otherCounts[7]).toBeGreaterThan(0)
})

it("validates the extracted snapshot and keeps basic, Titan and same-name special pools distinct", () => {
  const strange = getChampionCrystals("drstrange").crystals
  expect(strange.find(c => c.sourceIds.includes("7_star_titan_hero_shard_crystal"))?.rarities).toContain(7)
  expect(strange.find(c => c.sourceIds.includes("7_star_hero_shard_crystal"))).toBeUndefined()
  const hulk = getChampionCrystals("hulk").crystals
  expect(hulk.find(c => c.sourceIds.includes("7_star_hero_shard_crystal"))?.rarities).toContain(7)
  expect(getChampionCrystals("not_a_source_id").crystals).toEqual([])
})

it("does not recommend an unverified same-name crystal as a way to obtain Deathless Thanos", () => {
  const thanos = "thanos_deathless_trophy"
  expect(getCrystalDetails("7_star_hero_shard_crystal")?.contents.some(reward => reward.championId === thanos)).toBe(false)
  // Preserve the extracted record for inspection without treating it as player availability.
  expect(getCrystalDetails("jessies_crystal")?.contents.some(reward => reward.championId === thanos)).toBe(true)
  expect(getChampionCrystals(thanos).crystals).toEqual([])
  expect(getChampionCrystalSummary(thanos).otherCounts).toEqual({})
})

it("keeps the initial champion payload compact while preserving exact archive counts", () => {
  const all = getChampionCrystals("hulk")
  const summary = getChampionCrystalSummary("hulk")
  expect(summary.crystals.every(c => c.isMainPool)).toBe(true)
  expect(summary.otherCounts[7]).toBe(all.crystals.filter(c => !c.isMainPool && c.rarities.includes(7)).length)
  expect(summary.crystals).toEqual(all.crystals.filter(c => c.isMainPool).map(crystal => ({
    name: crystal.name, sourceIds: crystal.sourceIds, rarities: crystal.rarities,
    isMainPool: crystal.isMainPool, selection: crystal.selection,
    artworkUrl: crystal.artworkUrl, family: crystal.family,
  })))
  for (const crystal of summary.crystals) {
    expect(crystal).not.toHaveProperty("bannerArtworkUrl")
    expect(crystal).not.toHaveProperty("availability")
    expect(crystal).not.toHaveProperty("availabilitySourceId")
  }
  expect(Buffer.byteLength(JSON.stringify(summary))).toBeLessThan(10_000)
})
