import { expect, it } from "vitest"
import { getRewardArtwork } from "@cerebro/core/data/game-reward-artwork"
import { getCrystalOdds } from "@cerebro/core/data/game-crystal-odds"
import { loadCrystalPageRewards } from "./crystal-page-rewards"

it("reuses the published gold, fragment and crystal artwork for the exact Banquet rate rows", () => {
  const opening = loadCrystalPageRewards("superior_banquet_crystal_dec25")!
  expect(opening.oddsVisuals["0:0"].imageUrl).toBe(getRewardArtwork("res", "sc")?.url)
  expect(opening.oddsVisuals["2:3"].imageUrl).toBe(getRewardArtwork("ebpf", "rare_event")?.url)
  expect(opening.oddsVisuals["2:0"].imageUrl).toBe(getRewardArtwork("ebp", "rare_event")?.url)
  expect(opening.oddsVisuals["4:9"]).toMatchObject({ href: "/crystals/jubilant_crystal_dec25" })
  expect(opening.oddsVisuals["4:9"].imageUrl).toMatch(/^https:\/\/storage.googleapis.com\//)
  expect(opening.oddsVisuals["4:0"].imageUrl).toBeNull()
  expect(opening.odds?.groups?.map(group => group.name)).toEqual(["PRIZE 5", "PRIZE 4", "PRIZE 3", "PRIZE 2", "PRIZE 1"])
})

it("links Paragon's exact Nexus drops and leaves its original rate evidence intact", () => {
  const recorded = getCrystalOdds("paragon_crystal_v2")!
  const before = JSON.stringify(recorded)
  const opening = loadCrystalPageRewards("paragon_crystal_v2")!
  expect(opening.oddsVisuals["0:5"].href).toBe("/crystals/sg_6star_nexus_crystal")
  expect(opening.oddsVisuals["0:5"].imageUrl).toMatch(/^https:\/\/storage.googleapis.com\/champion-images\/crystals\//)
  expect(opening.oddsVisuals["0:0"].imageUrl).toBeNull()
  expect(JSON.stringify(recorded)).toBe(before)
})

it("does not expose raw selector object IDs as Jubilant reward names", () => {
  const opening = loadCrystalPageRewards("jubilant_crystal_dec25")!
  const rewards = opening.otherRewards
  for (const [id, name] of [["69152ddc4d51d164bc3ea06f", "7-STAR LIMITED POOL SELECTOR 2025"], ["690aa4e61db43a840da0c130", "7-STAR RARE CHAMPION SELECTOR"]]) {
    const reward = rewards.find(item => item.type === "sra" && item.data === id)!
    expect(reward).toBeDefined()
    expect(reward.displayName).toBe(name)
    expect(reward.imageUrl).toBe(getRewardArtwork("sra", id)?.url)
    expect(reward.imageUrl).toMatch(/^https:\/\/storage.googleapis.com\/champion-images\/rewards\/full\//)
    expect(reward.href).toBeNull()
  }
  expect(opening.champions.some(champion => champion.championId === "vision")).toBe(false)
})
