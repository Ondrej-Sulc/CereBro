import { expect, it } from "vitest"
import { getChampionAscensionAcquisitionSources as read } from "./champion-ascension-acquisition"
import { getRewardArtwork } from "@cerebro/core/data/game-reward-artwork"
import { getChampionAscensionAcquisitionSources as core } from "@cerebro/core/data/champion-ascension-acquisition"

const asOf = "2026-11-07"
it("projects names and exact already-published artwork without changing evidence or reward quantities", () => {
  const result = read("magik", 7, asOf)
  const raw = core("magik", 7, asOf)
  expect(result.paths[0].steps[1].costs.find(cost => cost.type === "res")!.name).toBe("Gold")
  expect(result.routes.map(row => row.sources)).toEqual(raw.routes.map(row => row.sources))
  for (const offer of result.routes[0].offers) for (const reward of offer.rewards) {
    expect(reward.name).toBeTruthy()
    expect(reward.imageUrl).toBe(getRewardArtwork(reward.type, reward.id)?.url ?? null)
    const { name: _name, imageUrl: _image, ...tuple } = reward
    expect(raw.routes[0].offers.find(row => row.id === offer.id)!.rewards).toContainEqual(tuple)
  }
  expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThan(16000)
})
it("preserves unresolved names, definitions and defensive copies", () => {
  expect(read("medusa", 7, asOf).routes[0].offers[0].rewards[0].name).toBeNull()
  const result = read("arnimzola", 7, asOf)
  expect(result.routes).toEqual([])
  expect(result.definitions[0].offers[0].rewards.find(reward => reward.type === "hero")!.name).toContain("ARNIM ZOLA")
  result.definitions[0].offers[0].rewards[0].name = "mutated"
  expect(JSON.stringify(read("arnimzola", 7, asOf))).not.toContain("mutated")
  expect(read("hulk", 6, asOf).paths[0].steps[0].costs.every(cost => Object.hasOwn(cost, "imageUrl"))).toBe(true)
})
