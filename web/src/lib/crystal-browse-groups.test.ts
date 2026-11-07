import { expect, it } from "vitest"
import { groupCrystalEditions } from "./crystal-browse-groups"
import { getCrystalBrowseEntries } from "./data/crystal-browse-catalog"

it("preserves every exact Login pool once across the monthly browse groups", () => {
  const login = getCrystalBrowseEntries().filter(entry => entry.id.startsWith("login_"))
  const groups = groupCrystalEditions(login)
  const restored = groups.flatMap(entry => entry.editionGroup?.options.map(option => option.id) ?? [entry.id])
  expect([...restored].sort()).toEqual(login.map(entry => entry.id).sort())
  expect(new Set(restored).size).toBe(restored.length)
  expect(groups.length).toBeLessThan(login.length / 2)
  const november = groups.find(entry => entry.editionGroup?.label === "Nov 2026")!.editionGroup!
  expect(november.options).toHaveLength(5)
  expect(november.options[0]).toEqual({ id: "login_crystal_7_star_nov26", rarities: [7] })
  expect(november.options.find(option => option.id === "login_crystal_6_7_star_nov26")?.rarities).toEqual(expect.arrayContaining([6, 7]))
})

it("leaves unrelated equal-name crystals and individual search results intact", () => {
  const entry = getCrystalBrowseEntries().find(item => item.id === "login_crystal_7_star_nov26")!
  const fake = { ...entry, id: "unrelated", variants: [{ ...entry.variants[0], sourceIds: ["unrelated"] }] }
  expect(groupCrystalEditions([entry, fake])).toEqual([entry, fake])
  expect(groupCrystalEditions([entry])[0].editionGroup).toBeUndefined()
})

it("only shares a champion preview when all monthly star options have that champion", () => {
  const entries = getCrystalBrowseEntries().filter(entry => entry.id.endsWith("nov26") && entry.id.startsWith("login_"))
  const shared = entries.map(entry => ({ ...entry, singleChampion: { gameId: "hulk", name: "Hulk" } }))
  expect(groupCrystalEditions(shared)[0].editionGroup?.singleChampion?.gameId).toBe("hulk")
  expect(groupCrystalEditions(shared.map((entry, index) => index === 0 ? { ...entry, singleChampion: { gameId: "vision", name: "Vision" } } : entry))[0].editionGroup?.singleChampion).toBeNull()
  expect(groupCrystalEditions(shared.map((entry, index) => index === 0 ? { ...entry, singleChampion: null } : entry))[0].editionGroup?.singleChampion).toBeNull()
})
