import { expect, it } from "vitest"
import { rewardDisplayName, rewardTypeLabel } from "./reward-display"

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
