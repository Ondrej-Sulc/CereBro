import { expect, it } from "vitest"
import { createSelectableRewardCatalog } from "./selectable-rewards"

const hash = "a".repeat(64)
const id = "69152ddc4d51d164bc3ea06f"
const snapshot = () => ({ version: 1, source: { observedAt: "2026-11-06T12:00:00Z", captureMethod: "read-only-game-definition-registry",
  gameAssemblySha256: hash, metadataSha256: hash, openingCatalogSha256: hash },
  selectors: [{ id, name: "7-STAR LIMITED POOL SELECTOR 2025", description: "Choose a Champion.",
    icon: { source: "cdn", reference: "selectable_rewards/example/icon.png" } }], missingIds: [] })

it("resolves exact selector IDs and keeps source definitions immutable", () => {
  const catalog = createSelectableRewardCatalog(snapshot(), hash)
  expect(catalog.getSelectableReward(id)?.name).toBe("7-STAR LIMITED POOL SELECTOR 2025")
  expect(catalog.getSelectableReward("unknown")).toBeNull()
  expect(Object.isFrozen(catalog.getSelectableReward(id))).toBe(true)
})

it("rejects unrelated snapshots, duplicate identities and unsafe image references", () => {
  expect(() => createSelectableRewardCatalog(snapshot(), "b".repeat(64))).toThrow("snapshot mismatch")
  const duplicate = snapshot(); duplicate.selectors.push(duplicate.selectors[0])
  expect(() => createSelectableRewardCatalog(duplicate)).toThrow("Duplicate selector")
  const unsafe = snapshot(); unsafe.selectors[0].icon.reference = "../private.png"
  expect(() => createSelectableRewardCatalog(unsafe)).toThrow()
})
