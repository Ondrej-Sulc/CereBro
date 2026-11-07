import { describe, expect, it } from "vitest"
import { createCrystalCatalog, type CrystalCatalogData } from "./champion-crystals"

const fixture = (): CrystalCatalogData => ({
  version: 1,
  source: { observedAt: "2026-11-03T09:10:42+00:00", gachaSha256: "a".repeat(64), bcgSha256: "b".repeat(64), metadata: [] },
  tiers: [{ id: "unrelated_suffix", championId: "drstrange", rarity: 7 }, { id: "hulk_6", championId: "hulk", rarity: 6 }],
  pools: [{ id: "titan", heroTierIds: ["unrelated_suffix"] }, { id: "other", heroTierIds: ["hulk_6"] }],
  crystals: [
    { id: "7_star_titan_hero_shard_crystal", name: "TITAN", group: "events", set: "all", categoryIds: ["titan"], selection: null },
    { id: "historical", name: "TITAN", group: "events", set: "all", categoryIds: ["other"], selection: null },
    { id: "archive", name: "OLD CRYSTAL", group: "events", set: "all", categoryIds: ["titan"], selection: null },
    { id: "archive_alias", name: "OLD CRYSTAL", group: "events", set: "all", categoryIds: ["titan"], selection: null },
  ],
  coverage: { definitions: 4, definitionsWithDirectHeroes: 4, rewardItemTypes: { hero: 2 }, directRewardsOnly: true },
})

describe("champion crystal catalog", () => {
  it("retains exact source presentation for crystals without direct champions", () => {
    const data = fixture()
    data.pools[0].heroTierIds = []
    data.coverage.definitionsWithDirectHeroes = 1
    const catalog = createCrystalCatalog(data)
    expect(catalog.getCrystalDetails("archive")).toBeNull()
    expect(catalog.getCrystalPresentation("archive")).toMatchObject({ name: "OLD CRYSTAL", sourceIds: ["archive"] })
    expect(catalog.getCrystalPresentation("unknown")).toBeNull()
  })
  it("preserves exact cosmetic reward tiers and rejects inconsistent source bindings", () => {
    const data = fixture()
    data.pools[0].heroCosmeticRewards = [{ tierId: "unrelated_suffix", cosmeticId: "first_edition", sourceData: "unrelated_suffix|first_edition" }]
    expect(createCrystalCatalog(data).getCrystalDetails("7_star_titan_hero_shard_crystal")?.contents[0].cosmeticRewards).toEqual([{ tierId: "unrelated_suffix", cosmeticId: "first_edition", rarity: 7 }])
    data.pools[0].heroCosmeticRewards[0].sourceData = "hulk_6|first_edition"
    expect(() => createCrystalCatalog(data)).toThrow(/cosmetic champion reward/)
    data.pools[0].heroCosmeticRewards[0].tierId = "hulk_6"
    expect(() => createCrystalCatalog(data)).toThrow(/cosmetic champion reward/)
  })
  it("binds actual artwork to its exact reference and rejects a different source snapshot", () => {
    const data = fixture()
    data.crystals[0].artwork = { source: "cdn", reference: "gacha/titan.png" }
    data.crystals[0].bannerArtwork = { source: "cdn", reference: "gacha/titan-banner.jpg" }
    const artwork = { version: 3, source: { bucket: "champion-images", gachaSha256: "a".repeat(64), gameMetadataSha256: "c".repeat(64), cdnBaseUrl: "https://kabam-marvel.shared.mcoc-cdn.net/" },
      assets: [{ role: "primary", source: "cdn", reference: "gacha/titan.png", url: `https://storage.googleapis.com/champion-images/crystals/primary/${"d".repeat(64)}.webp`, sha256: "d".repeat(64), inputSha256: "e".repeat(64), width: 256, height: 256 },
        { role: "banner", source: "cdn", reference: "gacha/titan-banner.jpg", url: `https://storage.googleapis.com/champion-images/crystals/banner/${"f".repeat(64)}.webp`, sha256: "f".repeat(64), inputSha256: "e".repeat(64), width: 512, height: 128 }], missing: [] }
    expect(createCrystalCatalog(data, artwork).forChampion("drstrange").crystals[0].artworkUrl).toBe(artwork.assets[0].url)
    expect(createCrystalCatalog(data, artwork).forChampion("drstrange").crystals[0].bannerArtworkUrl).toBe(artwork.assets[1].url)
    expect(() => createCrystalCatalog(data, { ...artwork, assets: artwork.assets.slice(0, 1) })).toThrow(/incomplete/i)
    artwork.source.gachaSha256 = "f".repeat(64)
    expect(() => createCrystalCatalog(data, artwork)).toThrow(/snapshot/i)
  })

  it("joins exact character and star identities, puts curated main pools first and retains source IDs", () => {
    const catalog = createCrystalCatalog(fixture())
    const result = catalog.forChampion("drstrange")
    expect(result.observedAt).toBe("2026-11-03T09:10:42+00:00")
    expect(result.crystals.map(c => [c.name, c.rarities, c.sourceIds])).toEqual([
      ["TITAN", [7], ["7_star_titan_hero_shard_crystal"]],
      ["OLD CRYSTAL", [7], ["archive", "archive_alias"]],
    ])
    expect(result.crystals[0].isMainPool).toBe(true)
    expect(result.crystals[1].isMainPool).toBe(false)
    expect(catalog.forChampion("hulk").crystals[0].sourceIds).toEqual(["historical"])
    expect(catalog.forChampion(null).crystals).toEqual([])
  })

  it("does not merge a different reward pool or selection mode with the same name", () => {
    const data = fixture()
    data.crystals.push({ ...data.crystals[2], id: "choice", selection: { draw: 3, pick: 1 } })
    data.coverage.definitions++
    data.coverage.definitionsWithDirectHeroes++
    expect(createCrystalCatalog(data).forChampion("drstrange").crystals).toHaveLength(3)
  })

  it.each(["tier", "category", "duplicate", "coverage"])("rejects invalid %s references instead of showing partial results", invalid => {
    const data = fixture()
    if (invalid === "tier") data.pools[0].heroTierIds.push("missing")
    if (invalid === "category") data.crystals[0].categoryIds.push("missing")
    if (invalid === "duplicate") data.crystals.push(data.crystals[0])
    if (invalid === "coverage") data.coverage.definitions = 99
    expect(() => createCrystalCatalog(data)).toThrow()
  })
})
