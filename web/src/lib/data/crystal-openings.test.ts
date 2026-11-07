import { expect, it } from "vitest"
import { loadCrystalOpening } from "./crystal-openings"

it("keeps the Banquet source opening's material and nested rewards separate from its champion pool", () => {
  const result = loadCrystalOpening("superior_banquet_crystal_dec25")!
  expect(result).not.toBeNull()
  expect(result.id).toBe("superior_banquet_crystal_dec25")
  const types = new Set(result.categories.flatMap(category => category.rewards.map(reward => reward.type)))
  expect(types.size).toBeGreaterThan(1)
  expect(types.has("res")).toBe(true)
  expect([...types].some(type => ["bp", "ebp", "ebpf"].includes(type))).toBe(true)
  expect(result.source.gachaSha256).toBe("c4873c0f509665e6f32a18be3c57d8c91887c1122e7a9b8b3e3423805922de3e")
  expect(loadCrystalOpening("missing")).toBeNull()
})
