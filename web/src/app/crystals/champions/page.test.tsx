import { beforeEach, expect, it, vi } from "vitest"
const { redirect, load } = vi.hoisted(() => ({ redirect: vi.fn((url: string) => { throw new Error(url) }), load: vi.fn() }))
vi.mock("next/navigation", () => ({ redirect }))
vi.mock("@/lib/data/crystals", () => ({ loadCrystalFinder: load }))
vi.mock("../crystal-champion-finder", () => ({ CrystalChampionFinder: () => null }))
import Page from "./page"

beforeEach(() => { vi.clearAllMocks(); load.mockResolvedValue({}) })

it.each([undefined, "", "1", "4", "5", "6", "99"])("migrates legacy Ascension rarity %s before loading, retaining identity and return context", async rarity => {
  const params = { champion: "hulk", q: "Hulk", reward: "ascension", rarity, page: "2", returnTo: "/champions/hulk?rarity=6" }
  await expect(Page({ searchParams: Promise.resolve(params) })).rejects.toThrow()
  const url = new URL(redirect.mock.calls[0][0], "http://localhost")
  expect(url.pathname).toBe("/crystals/champions")
  expect(Object.fromEntries(url.searchParams)).toEqual({ ...params, rarity: "7" })
  expect(load).not.toHaveBeenCalled()
})

it("preserves normal lower/all-star lookup and loads explicit seven-star focus directly", async () => {
  for (const params of [{ champion: "hulk", rarity: "6" }, { q: "Hulk" }, { champion: "hulk", rarity: "7", reward: "ascension" }]) {
    await Page({ searchParams: Promise.resolve(params) })
    expect(load).toHaveBeenLastCalledWith(params)
  }
  expect(redirect).not.toHaveBeenCalled()
})
