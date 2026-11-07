import { expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({ prisma: { champion: { findMany: async () => [] } } }))
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }))
import { loadCrystalFinder } from "./crystals"

it("carries canonical Carina eligibility into finder options and exact-star search without a database row", async () => {
  const seven = await loadCrystalFinder({ q: "carina_white", rarity: "7", reward: "ascension" })
  expect(seven.matches.map(row => row.gameId)).toContain("carina_white")
  expect(seven.championOptions.find(row => row.id === "carina_white")).toMatchObject({ ascendableRarities: [7], recordedRarities: [7] })
  expect(seven.selected).toMatchObject({ gameId: "carina_white", ascendableRarities: [7], recordedRarities: [7] })
  expect(seven.ascensionEligibilityObservedAt).toBe("2026-11-03T09:10:42+00:00")
  expect(seven.ascensionSources).toEqual([])
  const all = await loadCrystalFinder({ q: "carina_white", reward: "ascension" })
  expect(all.matches.map(row => row.gameId)).toContain("carina_white")
  const six = await loadCrystalFinder({ champion: "carina_white", q: "carina_white", rarity: "6", reward: "ascension" })
  expect(six.rarity).toBe("7")
  expect(six.matches.map(row => row.gameId)).toContain("carina_white")
  expect(six.selected).toMatchObject({ gameId: "carina_white", ascendableRarities: [7], recordedRarities: [7] })
  expect(six.ascensionAcquisition?.paths.map(path => [path.rarity, path.maxLevel])).toEqual([[7, 1]])
  expect(six.ascensionAcquisition?.routes[0].offers[0].binding).toBe("epilogue_ch04_q04.masteryCompletionRewards")
  for (const rarity of [undefined, "7"]) {
    const normal = await loadCrystalFinder({ champion: "carina_white", rarity })
    expect(normal.selected?.slug).toBeNull()
    expect(normal.ascensionAcquisition).toEqual({ ...seven.ascensionAcquisition, evaluatedAsOf: expect.any(String) })
  }
  expect((await loadCrystalFinder({ champion: "carina_white", rarity: "6" })).ascensionAcquisition).toBeNull()
})
