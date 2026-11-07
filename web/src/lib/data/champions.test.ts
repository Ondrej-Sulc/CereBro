import { beforeEach, expect, it, vi } from "vitest"
import { withChampionAscensionLimits } from "../champion-ascension-payload"
import { getCachedAllChampions, getCachedChampions } from "./champions"

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ prisma: {
  champion: { findMany: mocks.findMany },
  championAbilityResistance: { findMany: () => Promise.resolve([]) },
} }))
vi.mock("@/lib/cache", () => ({ getFromCache: (_key: string, _ttl: number, load: () => Promise<unknown>) => load() }))

beforeEach(() => {
  mocks.findMany.mockClear()
  mocks.findMany.mockImplementation(async ({ select }: { select: Record<string, unknown> }) => [
    Object.fromEntries(Object.keys(select).map(key => [key, ({ id: 1, gameId: "adamwarlock", name: "Adam Warlock", abilities: [], tags: [] } as Record<string, unknown>)[key]])),
  ])
})

it.each([getCachedChampions, getCachedAllChampions])("projects explicit stars and unknowns in one catalog query without blueprint costs (%#)", async load => {
  mocks.findMany.mockResolvedValue([
    { id: 1, gameId: "hulk", abilities: [], tags: [] },
    { id: 2, gameId: "unknown", abilities: [], tags: [] },
    { id: 3, gameId: null, abilities: [], tags: [] },
  ])
  const champions = await load()
  expect(champions.map(champion => champion.ascendableRarities)).toEqual([[6, 5, 4], [], []])
  expect(mocks.findMany).toHaveBeenCalledOnce()
  expect(JSON.stringify(champions)).not.toMatch(/"(?:steps|cost|eligibleTierIds|blueprintId)":/)
})

it.each([getCachedChampions, getCachedAllChampions])("keeps the exact game identity through the cached champion projection (%#)", async load => {
  const [champion] = await load()
  expect(withChampionAscensionLimits(champion).ascensionMaxLevels).toMatchObject({ "6": 1, "7": 2 })
  expect(champion.ascendableRarities).toEqual([7, 6, 5, 4])
})
