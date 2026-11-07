import { beforeEach, expect, it, vi } from "vitest"
const findUnique = vi.hoisted(() => vi.fn())
vi.mock("@/lib/prisma", () => ({ prisma: { champion: { findUnique } } }))
vi.mock("@cerebro/core/data/game-crystals", () => ({ getChampionCrystals: () => ({ observedAt: "2026-11-03T09:10:42+00:00", crystals: [
  { name: "SEVEN", sourceIds: ["seven"], rarities: [7], isMainPool: false, selection: null },
  { name: "SIX", sourceIds: ["six"], rarities: [6], isMainPool: false, selection: null },
  { name: "MAIN", sourceIds: ["main"], rarities: [7], isMainPool: true, selection: null },
] }) }))
import { GET } from "./route"
beforeEach(() => { findUnique.mockReset(); findUnique.mockResolvedValue({ gameId: "hulk" }) })
const request = (query: string) => GET(new Request(`http://localhost/api/champions/hulk/crystals?${query}`), { params: Promise.resolve({ slug: "hulk" }) })
it("returns only other recorded pools for the requested star level", async () => {
  const response = await request("rarity=7")
  expect(response.status).toBe(200)
  expect((await response.json()).crystals.map((c: { name: string }) => c.name)).toEqual(["SEVEN"])
  expect(findUnique).toHaveBeenCalledWith({ where: { slug: "hulk" }, select: { gameId: true } })
})
it("rejects invalid star levels before querying and returns 404 for an unknown champion", async () => {
  expect((await request("rarity=8")).status).toBe(400)
  expect(findUnique).not.toHaveBeenCalled()
  findUnique.mockResolvedValue(null)
  expect((await request("rarity=7")).status).toBe(404)
})
