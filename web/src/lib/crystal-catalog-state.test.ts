import { expect, it } from "vitest"
import { crystalCatalogHref, crystalFinderHref } from "./crystal-navigation"
import { consumeCrystalBrowseScroll, parseCrystalReturnTo } from "./crystal-browse-return"

it("produces scope-free catalog URLs while accepting old main-pool links", () => {
  expect(crystalCatalogHref()).toBe("/crystals")
  expect(crystalCatalogHref({ scope: "all", reward: "ascension" })).toBe("/crystals?reward=ascension")
  expect(crystalCatalogHref({ scope: "main", rarity: "7" })).toBe("/crystals?rarity=7&category=main")
  expect(crystalCatalogHref({ category: "main", q: "hero", reward: "mixed", sort: "name", page: 2 })).toBe("/crystals?q=hero&category=main&reward=mixed&sort=name&page=2")
})

it("normalizes legacy scope in saved return links without losing filters or pagination", () => {
  expect(parseCrystalReturnTo("/crystals?scope=all&reward=ascension&page=2")).toBe("/crystals?page=2&reward=ascension")
  expect(parseCrystalReturnTo("/crystals?scope=main&rarity=7&page=2")).toBe("/crystals?category=main&page=2&rarity=7")
  expect(parseCrystalReturnTo("/crystals?scope=main&category=classes&sort=newest")).toBe("/crystals?category=classes&sort=newest")
})

it("preserves champion, stars, ascension focus and pagination in shareable finder return links", () => {
  const href = crystalFinderHref({ champion: "gwenom", rarity: "7", reward: "ascension", page: 2 })
  expect(href).toBe("/crystals/champions?champion=gwenom&rarity=7&reward=ascension&page=2")
  expect(parseCrystalReturnTo(href)).toBe("/crystals/champions?champion=gwenom&page=2&rarity=7&reward=ascension")
  expect(crystalFinderHref({ champion: "gwenom", rarity: "7", reward: "all" })).toBe("/crystals/champions?champion=gwenom&rarity=7")
})

it("normalizes legacy seven-star focus URLs and saved return state without changing normal lookup", () => {
  for (const rarity of [undefined, "", "1", "4", "5", "6"]) {
    expect(crystalFinderHref({ champion: "hulk", rarity, q: "Hulk", reward: "ascension", page: 2 })).toBe("/crystals/champions?champion=hulk&rarity=7&q=Hulk&reward=ascension&page=2")
    expect(parseCrystalReturnTo(`/crystals/champions?champion=hulk&q=Hulk&reward=ascension&page=2${rarity ? `&rarity=${rarity}` : ""}`)).toBe("/crystals/champions?champion=hulk&page=2&q=Hulk&rarity=7&reward=ascension")
  }
  expect(crystalFinderHref({ champion: "hulk", rarity: "6" })).toBe("/crystals/champions?champion=hulk&rarity=6")
  expect(parseCrystalReturnTo("/crystals/champions?champion=hulk&rarity=6")).toBe("/crystals/champions?champion=hulk&rarity=6")
  expect(crystalFinderHref({ champion: "hulk" })).toBe("/crystals/champions?champion=hulk")
})

it("restores a previously saved catalog position after removing redundant legacy scope", () => {
  let saved: string | null = JSON.stringify({ url: "/crystals?category=events&q=banquet&scope=all", y: 1840, savedAt: 1000 })
  const storage = { getItem: () => saved, setItem: (_key: string, value: string) => { saved = value }, removeItem: () => { saved = null } }
  expect(consumeCrystalBrowseScroll("/crystals?category=events&q=banquet", storage, 2000)).toBe(1840)
  expect(saved).toBeNull()
})
