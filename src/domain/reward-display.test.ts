import { expect, it } from "vitest"
import { publicRewardDisplayName, rewardDisplayName, rewardTypeLabel } from "./reward-display"

it("keeps internal IDs out of public fallback labels without altering the source identity", () => {
  for (const [type, data, label] of [
    ["relic2", "relic_statcast_hulkling_crat", "Relic"],
    ["res", "meta_feb2021_shard_crystal", "Resource"],
    ["inv", "platinumpool_covering_ears", "Inventory item"],
    ["sra", "69152ddc4d51d164bc3ea06f", "Reward selector"],
  ]) {
    const source = { type, data, displayName: data }
    expect(publicRewardDisplayName(source)).toBe(label)
    expect(source.data).toBe(data)
  }
  expect(publicRewardDisplayName({ type: "res", data: "sc" })).toBe("Gold")
  expect(publicRewardDisplayName({ type: "inv", data: "item", displayName: "ID_MISSING_TRANSLATION" })).toBe("Inventory item")
  expect(publicRewardDisplayName({ type: "inv", data: "item", displayName: "Native item name" })).toBe("Native item name")
})

it("names the gold resource without changing unrelated reward identities", () => {
  expect(rewardDisplayName({ type: "res", data: "sc" })).toBe("Gold")
  expect(rewardDisplayName({ type: "inv", data: "sc" })).toBe("sc")
  expect(rewardDisplayName({ type: "ebp", data: "t6_cosmic", displayName: "TIER 6 COSMIC CATALYST" })).toBe("TIER 6 COSMIC CATALYST")
  expect(rewardDisplayName({ type: "res", data: "unresolved-resource" })).toBe("unresolved-resource")
})

it("keeps unknown selectors readable while preserving verified names", () => {
  const id = "69152ddc4d51d164bc3ea06f"
  expect(rewardDisplayName({ type: "sra", data: id })).toBe("Reward selector")
  expect(rewardDisplayName({ type: "sra", data: id, displayName: id })).toBe("Reward selector")
  expect(rewardDisplayName({ type: "sra", data: id, displayName: "7-STAR LIMITED POOL SELECTOR 2025" })).toBe("7-STAR LIMITED POOL SELECTOR 2025")
  expect(rewardDisplayName({ type: "sra", data: "Recorded selector label" })).toBe("Recorded selector label")
  expect(rewardTypeLabel("sra")).toBe("Selectors")
})
