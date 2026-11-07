import { beforeEach, expect, it, vi } from "vitest"
const { findUnique, getSources, getAcquisition } = vi.hoisted(() => ({ findUnique: vi.fn(), getSources: vi.fn(), getAcquisition: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ prisma: { champion: { findUnique } } }))
vi.mock("@/lib/data/champion-crystal-ascension", () => ({ getChampionCrystalAscensionSources: getSources }))
vi.mock("@/lib/data/champion-ascension-acquisition", () => ({ getChampionAscensionAcquisitionSources: getAcquisition }))
import { GET } from "./route"
import type { ChampionCrystalAscensionSources } from "@/lib/data/champion-crystal-ascension-types"
const request = (query: string) => GET(new Request(`http://localhost/api/champions/adam-warlock/ascension-sources?${query}`), { params: Promise.resolve({ slug: "adam-warlock" }) })
const acquisition = { gameId: "adamwarlock", paths: [], routes: [], definitions: [], reviewedAt: "2026-11-07", evaluatedAsOf: "2026-11-07T12:00:00Z", accountStatus: "unverified" }
beforeEach(() => { findUnique.mockReset().mockResolvedValue({ gameId: "adamwarlock" }); getSources.mockReset().mockReturnValue({ observedAt: "2026-11-05T14:05:24Z", crystals: [] }); getAcquisition.mockReset().mockReturnValue(acquisition) })
it("projects only the requested champion identity and star via the shared server helper", async () => {
  const response = await request("rarity=6")
  expect(response.status).toBe(200)
  expect(getSources).toHaveBeenCalledExactlyOnceWith("adamwarlock", 6)
  expect(getAcquisition).toHaveBeenCalledExactlyOnceWith("adamwarlock", 6)
  expect(await response.json()).toEqual({ observedAt: "2026-11-05T14:05:24Z", crystals: [], acquisition })
  expect(findUnique).toHaveBeenCalledWith({ where: { slug: "adam-warlock" }, select: { gameId: true } })
  expect(response.headers.get("Cache-Control")).toContain("public, max-age=300")
})
it.each(["", "rarity=0", "rarity=8", "rarity=7.0", "rarity=all"])("rejects an invalid star query before data access: %s", async query => {
  expect((await request(query)).status).toBe(400)
  expect(findUnique).not.toHaveBeenCalled()
  expect(getSources).not.toHaveBeenCalled()
  expect(getAcquisition).not.toHaveBeenCalled()
})
it.each([null, { gameId: null }])("does not guess a missing champion identity", async champion => {
  findUnique.mockResolvedValue(champion)
  expect((await request("rarity=7")).status).toBe(404)
  expect(getSources).not.toHaveBeenCalled()
  expect(getAcquisition).not.toHaveBeenCalled()
})

it.each(["gwenom", "venomtheduck"])("integrates the real static source projection without leaking seven-star rows to lower stars: %s", async gameId => {
  const { getChampionCrystalAscensionSources } = await vi.importActual<typeof import("@/lib/data/champion-crystal-ascension")>("@/lib/data/champion-crystal-ascension")
  getSources.mockImplementation(getChampionCrystalAscensionSources)
  findUnique.mockResolvedValue({ gameId })
  const seven: ChampionCrystalAscensionSources = await (await request("rarity=7")).json()
  expect(seven.observedAt).toBe("2026-11-05T14:05:24+00:00")
  expect(seven.crystals.length).toBeGreaterThan(0)
  expect(seven.crystals.every(source => source.rarities.includes(7))).toBe(true)
  expect(seven.crystals.map(source => source.id)).not.toContain("7_star_hero_shard_crystal")
  expect(seven.crystals.some(source => source.kind === (gameId === "gwenom" ? "champion-bonus" : "champion-token"))).toBe(true)
  const six: ChampionCrystalAscensionSources = await (await request("rarity=6")).json()
  expect(six.crystals).toEqual([])
}, 20000)
