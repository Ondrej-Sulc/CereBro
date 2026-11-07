import { expect, it, vi } from "vitest"

const fixture = vi.hoisted(() => {
  const rewards = [
    { sourceIndex: 0, type: "hero", data: "alpha_t6", gameId: "alpha", rarity: 6 },
    { sourceIndex: 1, type: "hero", data: "beta_t7", gameId: "beta", rarity: 7 },
    { sourceIndex: 2, type: "hero", data: "alpha_t7", gameId: "alpha", rarity: 7 },
    { sourceIndex: 3, type: "inv", data: "ascension_token_champion_alpha", quantity: 2, context: { restriction: "recorded condition" } },
    { sourceIndex: 4, type: "inv", data: "ascension_token_champion_unresolved", quantity: 1 },
    { sourceIndex: 5, type: "sra", data: "ascension_token_champion_beta", quantity: 1 },
    { sourceIndex: 6, type: "inv", data: "primordial_dust_t2", quantity: 200 },
    { sourceIndex: 7, type: "inv", data: "alpha_ascension_bundle", quantity: 1 },
    { sourceIndex: 8, type: "inv", data: "ascension_token_champion_delta", quantity: 1 },
  ]
  const opening = { id: "mixed", name: "Mixed", categories: [{ id: "mixed-category", rewards }], conditionalBonuses: [
    { categoryId: "mixed-category", rewardIndex: 1, bonusReward: { id: "beta-bonus", autoAscend: false,
      rewards: [{ sourceIndex: 0, type: "inv", data: "ascension_token_champion_beta", quantity: 1 }] } },
    { categoryId: "mixed-category", rewardIndex: 2, bonusReward: { id: "alpha-signature", autoAscend: false,
      rewards: [{ sourceIndex: 0, type: "inv", data: "sigup_t7_cosmic", quantity: 1 }] } },
  ] }
  return { opening, list: vi.fn(() => [opening]) }
})
vi.mock("@cerebro/core/data/game-crystal-openings", () => ({ crystalOpeningsSource: { observedAt: "snapshot-date" },
  listCrystalOpenings: fixture.list, getCrystalOpening: () => fixture.opening }))
vi.mock("@cerebro/core/data/game-ascension", () => ({
  getChampionAscensionRules: (gameId: string) => gameId === "alpha" ? [{ rarity: 6, steps: [{ cost: [{ type: "inv", id: "ascension_token_champion_alpha", quantity: 1 }] }] }] : [],
  getAscensionResource: (_type: string, id: string) => id === "ascension_token_champion_delta"
    ? { metadataResolved: true, usageTags: "t5:delta|t7:another" } : null,
}))
vi.mock("@cerebro/core/data/game-crystals", () => ({ getCrystalPresentation: () => null }))
vi.mock("@cerebro/core/data/game-reward-artwork", () => ({ getRewardArtwork: () => null }))
import { getChampionCrystalAscensionSources } from "./champion-crystal-ascension"

it("does not transfer another champion's bonus or signature-only rewards to ordinary members", () => {
  expect(getChampionCrystalAscensionSources("alpha", 7).crystals).toEqual([])
  const beta = getChampionCrystalAscensionSources("beta", 7).crystals
  expect(beta).toHaveLength(1)
  expect(beta[0]).toMatchObject({ kind: "champion-bonus", autoAscend: false, categoryId: "mixed-category", rewardIndex: 1, rarities: [7] })
})

it("uses an exact cost at its recorded star, without assuming seven-star token applicability", () => {
  const alpha = getChampionCrystalAscensionSources("alpha").crystals
  expect(alpha).toHaveLength(1)
  expect(alpha[0]).toMatchObject({ kind: "champion-token", rarities: [6], rewards: [{ quantity: 2, context: { restriction: "recorded condition" } }] })
  expect(getChampionCrystalAscensionSources("alpha", 7).crystals).toEqual([])
  expect(getChampionCrystalAscensionSources("unresolved").crystals).toEqual([])
  expect(getChampionCrystalAscensionSources("delta").crystals[0].rarities).toEqual([5])
  expect(getChampionCrystalAscensionSources("delta", 7).crystals).toEqual([])
})

it("reuses the static index across champion and star queries", () => {
  getChampionCrystalAscensionSources("alpha", 6)
  getChampionCrystalAscensionSources("beta", 7)
  expect(fixture.list).toHaveBeenCalledTimes(1)
})
