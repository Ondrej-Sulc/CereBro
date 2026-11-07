import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { expect, it } from "vitest"
import { getSelectableReward, selectableRewardsSource } from "./index"
import openings from "../game-crystal-openings/catalog.json"
import { getRewardArtwork, rewardArtworkSource } from "../game-reward-artwork"

it("binds selector metadata and artwork to the captured definition and opening snapshots", () => {
  const checksum = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex")
  expect(selectableRewardsSource.openingCatalogSha256).toBe(checksum("src/data/game-crystal-openings/catalog.json"))
  expect(rewardArtworkSource.selectableRewards?.catalogSha256).toBe(checksum("src/data/game-selectable-rewards/catalog.json"))
  const selectors = [...openings.categories, ...openings.bonusRewards].flatMap(category => category.rewards.filter(row => row.type === "sra"))
  const ids = new Set(selectors.map(row => row.data))
  expect(ids.size).toBe(111)
  for (const id of ids) {
    const definition = getSelectableReward(id)!
    const artwork = getRewardArtwork("sra", id)!
    expect(definition.name).not.toMatch(/^[a-f0-9]{24}$/i)
    expect(artwork).toMatchObject({ registry: "selectable-reward", registryId: id, ...definition.icon })
  }
})

it("keeps selector rewards separate from direct champion membership", () => {
  expect(getSelectableReward("690aa4e61db43a840da0c130")?.name).toBe("7-STAR RARE CHAMPION SELECTOR")
  expect(getSelectableReward("69152ddc4d51d164bc3ea06f")?.name).toBe("7-STAR LIMITED POOL SELECTOR 2025")
  expect(getSelectableReward("not-recorded")).toBeNull()
})
