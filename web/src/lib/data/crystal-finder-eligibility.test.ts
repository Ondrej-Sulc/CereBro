import { beforeEach, expect, it, vi } from "vitest"

const findMany = vi.hoisted(() => vi.fn())
vi.mock("@/lib/prisma", () => ({ prisma: { champion: { findMany } } }))
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }))
// A newer reward identity must never grant eligibility in the older blueprint snapshot.
vi.mock("./champion-crystal-ascension", () => ({
  getChampionCrystalAscensionChampions: () => [{ gameId: "reward-only", name: "Reward only", rarities: [7] }],
  getChampionCrystalAscensionSources: (gameId: string) => ({ observedAt: "2026-11-05T14:05:24+00:00", crystals: gameId === "reward-only" ? [{ id: "new-token-reward", rarities: [7] }] : [] }),
}))
import { loadCrystalFinder } from "./crystals"

beforeEach(() => findMany.mockResolvedValue([
  { gameId: "hulk", name: "Hulk", slug: "hulk", class: "SCIENCE", images: null, obtainable: ["6", "7"] },
  { gameId: "unknown", name: "Unknown", slug: "unknown", class: "TECH", images: null, obtainable: ["7"] },
]))

it("attaches compact blueprint eligibility to all options without using crystal or token membership", async () => {
  const data = await loadCrystalFinder({ reward: "ascension", rarity: "7" })
  expect(findMany).toHaveBeenCalledTimes(1)
  const options = new Map(data.championOptions.map(option => [option.id, option]))
  expect(options.get("hulk")).toMatchObject({ ascendableRarities: [6, 5, 4], recordedRarities: [7, 6, 5, 4, 3, 2, 1] })
  expect(options.get("gwenom")?.ascendableRarities).toContain(7)
  for (const id of ["unknown", "reward-only"]) expect(options.get(id)).toMatchObject({ ascendableRarities: [], recordedRarities: [] })
  expect(JSON.stringify(data.championOptions)).not.toMatch(/"(?:steps|cost|eligibleTierIds|blueprintId)":/)
  expect(data.ascensionEligibilityObservedAt).toBe("2026-11-03T09:10:42+00:00")
  expect(data.observedAt).toBe("2026-11-05T14:05:24+00:00")
})

it("keeps eligible champions with zero sources selectable and preserves unsupported explicit identities", async () => {
  const gap = await loadCrystalFinder({ champion: "cable", reward: "ascension" })
  expect(gap.rarity).toBe("7")
  expect(gap.selected?.gameId).toBe("cable")
  expect(gap.selected?.ascendableRarities).toContain(7)
  expect(gap.ascensionSources).toEqual([])
  for (const id of ["hulk", "unknown", "reward-only"]) {
    const data = await loadCrystalFinder({ champion: id, rarity: "7", reward: "ascension" })
    expect(data.selected?.gameId).toBe(id)
    expect(data.rarity).toBe("7")
    expect(data.unresolvedChampion).toBe(false)
  }
  expect((await loadCrystalFinder({ q: "Gwenom", rarity: "1", reward: "ascension" })).selected?.gameId).toBe("gwenom")
  for (const id of ["hulk", "unknown", "reward-only"]) {
    const normal = await loadCrystalFinder({ champion: id })
    expect(normal.selected?.gameId).toBe(id)
    expect(normal.ascensionAcquisition).toBeNull()
    expect(normal.ascensionSources).toEqual([])
  }
  const normalGap = await loadCrystalFinder({ champion: "cable" })
  expect(normalGap.ascensionAcquisition?.paths.map(path => [path.rarity, path.state])).toEqual([[7, "recorded_path"]])
})

it("normalizes omitted and lower legacy stars to seven, preserving normal lookup", async () => {
  const seven = await loadCrystalFinder({ q: "hulk", rarity: "7", reward: "ascension" })
  expect(seven.matches.map(row => row.gameId)).not.toContain("hulk")
  const six = await loadCrystalFinder({ q: "hulk", rarity: "6", reward: "ascension" })
  const all = await loadCrystalFinder({ q: "hulk", reward: "ascension" })
  const normal = await loadCrystalFinder({ q: "hulk", rarity: "7" })
  for (const data of [six, all]) {
    expect(data.rarity).toBe("7")
    expect(data.matches.map(row => row.gameId)).not.toContain("hulk")
    expect(data.matches.every(row => row.ascendableRarities.includes(7))).toBe(true)
  }
  expect(normal.matches.map(row => row.gameId)).toContain("hulk")
  expect((await loadCrystalFinder({ reward: "ascension", rarity: "1", q: "hulk" })).matches).toEqual(seven.matches)
  for (const rarity of [undefined, "", "1", "4", "5", "6", "99"]) {
    const data = await loadCrystalFinder({ champion: "hulk", rarity, reward: "ascension" })
    expect(data.rarity).toBe("7")
    expect(data.selected?.gameId).toBe("hulk")
    expect(data.ascensionAcquisition?.paths.map(path => [path.rarity, path.state])).toEqual([[7, "recorded_empty"]])
  }
})
