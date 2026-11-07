import { expect, it } from "vitest"
import { getCrystalPresentation } from "@cerebro/core/data/game-crystals"
import { projectCrystalCatalogArtwork } from "./crystal-catalog-artwork"

it("curates distinct, published crystal artwork across hero, event, ascension and material types", () => {
  const artwork = projectCrystalCatalogArtwork(getCrystalPresentation)
  expect(artwork.map(item => [item.slot, item.id])).toEqual([
    ["hero", "7_star_hero_shard_crystal"],
    ["empowered", "greater_empowered_crystal"],
    ["ascension", "t7_class_ascension_token_crystal"],
    ["event", "superior_banquet_crystal_dec25"],
    ["catalyst", "t6_class_cat_crystal"],
  ])
  expect(new Set(artwork.map(item => item.url)).size).toBe(5)
  for (const item of artwork) {
    expect(item.url).toBe(getCrystalPresentation(item.id)?.artworkUrl)
    expect(item.url).toMatch(/^https:\/\/storage\.googleapis\.com\/champion-images\/crystals\/primary\/[a-f0-9]{64}\.webp$/)
  }
})

it("omits missing artwork without substituting other crystals or changing their slots", () => {
  const full = projectCrystalCatalogArtwork(getCrystalPresentation)
  const missing = new Set(["7_star_hero_shard_crystal", "superior_banquet_crystal_dec25"])
  expect(projectCrystalCatalogArtwork(id => missing.has(id) ? null : getCrystalPresentation(id)))
    .toEqual(full.filter(item => !missing.has(item.id)))
  expect(projectCrystalCatalogArtwork(() => ({ artworkUrl: null }))).toEqual([])
})
