import { expect, it } from "vitest"
import { parseCrystalReturnTo, withCrystalReturnTo, saveCrystalBrowseScroll, consumeCrystalBrowseScroll } from "./crystal-browse-return"

it("preserves catalog filters and pagination through an exact crystal link", () => {
  const origin = "/crystals?q=banquet&category=events&sort=name&page=3&rarity=7"
  const destination = new URL(withCrystalReturnTo("/crystals/jubilant_crystal_dec25?rarity=7", origin), "https://cerebro.test")
  expect(destination.searchParams.get("returnTo")).toBe(parseCrystalReturnTo(origin))
  expect(destination.searchParams.get("rarity")).toBe("7")
  expect(new URL(destination.searchParams.get("returnTo")!, "https://cerebro.test").searchParams.get("page")).toBe("3")
})

it("retains Ascension results, category, sorting and pagination when returning from a crystal", () => {
  const origin = "/crystals?reward=ascension&category=events&sort=newest&page=2"
  const destination = new URL(withCrystalReturnTo("/crystals/valiant_metamorphosis_crystal", origin), "https://cerebro.test")
  const back = new URL(destination.searchParams.get("returnTo")!, "https://cerebro.test")
  expect(back.pathname).toBe("/crystals")
  expect(Object.fromEntries(back.searchParams)).toEqual({ category: "events", page: "2", reward: "ascension", sort: "newest" })
})

it("rejects external or unrelated destinations and removes unknown query fields", () => {
  for (const value of ["https://evil.test", "//evil.test", "/admin", "/api/profile", "/crystals/../../admin", "/\\evil.test", "/crystals?" + "q=" + "a".repeat(3000)]) {
    expect(parseCrystalReturnTo(value)).toBeNull()
  }
  expect(parseCrystalReturnTo("/crystals?q=hulk&token=private&sort=recommended&page=1")).toBe("/crystals?q=hulk")
  expect(withCrystalReturnTo("https://evil.test/crystals/example", "/crystals")).toBe("https://evil.test/crystals/example")
})

it("restores a matching position once and ignores expired or different searches", () => {
  const values = new Map<string, string>()
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } }
  saveCrystalBrowseScroll("/crystals?q=banquet", 1840, storage, 1000)
  expect(consumeCrystalBrowseScroll("/crystals?q=hulk&scope=all", storage, 2000)).toBeNull()
  expect(consumeCrystalBrowseScroll("/crystals?q=banquet&scope=all", storage, 2000)).toBe(1840)
  expect(consumeCrystalBrowseScroll("/crystals?q=banquet&scope=all", storage, 2000)).toBeNull()
  saveCrystalBrowseScroll("/crystals", 1000, storage, 1000)
  expect(consumeCrystalBrowseScroll("/crystals", storage, 3601000)).toBeNull()
})
