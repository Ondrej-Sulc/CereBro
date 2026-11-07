import { expect, it } from "vitest"
import { getChampionCrystalAscensionChampions, getChampionCrystalAscensionSources } from "./champion-crystal-ascension"
import { getCrystalOpening, listCrystalOpenings } from "@cerebro/core/data/game-crystal-openings"
import { ascensionCatalogSource, getAscensionResource, getChampionAscension, getChampionAscensionRules } from "@cerebro/core/data/game-ascension"
import { getRewardArtwork } from "@cerebro/core/data/game-reward-artwork"

it("finds source-matched seven-star Gwenom bonuses absent from the older membership projection", () => {
  const data = getChampionCrystalAscensionSources("gwenom", 7)
  expect(data.observedAt).toBe("2026-11-05T14:05:24+00:00")
  expect(data.crystals.length).toBeGreaterThan(0)
  for (const source of data.crystals) {
    expect(source.rarities).toEqual([7])
    expect(source.kind).toBe("champion-bonus")
    const opening = getCrystalOpening(source.id)!
    const trigger = opening.categories.find(category => category.id === source.categoryId)!.rewards[source.rewardIndex]
    expect(trigger).toMatchObject({ gameId: "gwenom", rarity: 7 })
    expect(source.rewards).toContainEqual(expect.objectContaining({ data: "ascension_token_champion_gwenom", quantity: 1 }))
  }
  expect(getChampionCrystalAscensionSources("gwenom", 6).crystals).toEqual([])
})

it("matches the exact star in mixed crystals rather than another outcome's bonus", () => {
  expect(getChampionCrystalAscensionSources("blackpanther_cw", 7).crystals.map(row => row.id)).toContain("elder_divine_nine_crystal")
  expect(getChampionCrystalAscensionSources("blackpanther_cw", 6).crystals.map(row => row.id)).not.toContain("elder_divine_nine_crystal")
  expect(getChampionCrystalAscensionSources("hulk", 7).crystals).toEqual([])
  expect(getChampionCrystalAscensionSources("phoenix_dark", 7).crystals).toEqual([])
})

it("finds direct champion tokens with cost-supported stars and original quantities", () => {
  const sources = getChampionCrystalAscensionSources("venomtheduck", 7).crystals
  expect(sources).toContainEqual(expect.objectContaining({ id: "venom_duck_ascension_chase_box_prg10", kind: "champion-token", autoAscend: false,
    rarities: [7], rewards: [expect.objectContaining({ data: "ascension_token_champion_venomtheduck", quantity: 1, minQuantity: 1, maxQuantity: 1 })] }))
  expect(getChampionCrystalAscensionSources("venomtheduck", 6).crystals).toEqual([])
  expect(getChampionCrystalAscensionSources("venomtheduck", 8).crystals).toEqual([])
})

it("retains exact source bindings, excluding ordinary pools, selectors, bundles and shared materials", () => {
  for (const gameId of ["gwenom", "blackpanther_cw", "venomtheduck", "abomination_immortal", "arnimzola"]) {
    const sources = getChampionCrystalAscensionSources(gameId).crystals
    expect(new Set(sources.map(row => row.key)).size).toBe(sources.length)
    for (const row of sources) {
      expect(["7_star_hero_shard_crystal", "7_star_titan_hero_shard_crystal", "t7_class_ascension_token_crystal", "arnim_zola_ascension_box"]).not.toContain(row.id)
      const opening = getCrystalOpening(row.id)!
      const reward = opening.categories.find(category => category.id === row.categoryId)!.rewards[row.rewardIndex]
      if (row.kind === "champion-token") {
        expect(reward).toMatchObject({ type: "inv", data: `ascension_token_champion_${gameId}` })
        expect(row.rewards.map(({ imageUrl: _imageUrl, ...value }) => value)).toEqual([reward])
      } else {
        expect(reward.gameId).toBe(gameId)
        expect(row.rarities).toEqual([reward.rarity])
        const binding = opening.conditionalBonuses.find(binding => binding.categoryId === row.categoryId && binding.rewardIndex === row.rewardIndex)!
        expect(row.autoAscend).toBe(binding.bonusReward.autoAscend)
        expect(row.rewards.map(({ imageUrl: _imageUrl, ...value }) => value)).toEqual(binding.bonusReward.rewards)
      }
    }
  }
  expect(getChampionCrystalAscensionSources("not-recorded").crystals).toEqual([])
})

it("does not let consumers mutate the index or the frozen opening source", () => {
  const before = getChampionCrystalAscensionSources("gwenom", 7)
  const mutable = getChampionCrystalAscensionSources("gwenom", 7)
  mutable.crystals[0].rarities.push(6)
  mutable.crystals[0].rewards[0].quantity = 999
  mutable.crystals[0].name = "changed"
  mutable.crystals.length = 0
  expect(getChampionCrystalAscensionSources("gwenom", 7)).toEqual(before)
  expect(Object.isFrozen(listCrystalOpenings())).toBe(true)
  expect(before.crystals[0].rewards[0].imageUrl).toMatch(/^https:\/\//)
})

it("audits every current binding against its exact outcome and independently dated applicability evidence", () => {
  expect(ascensionCatalogSource.observedAt).toBe("2026-11-03T09:10:42+00:00")
  const identities = getChampionCrystalAscensionChampions()
  expect(identities.length).toBeGreaterThan(0)
  for (const { gameId } of identities) {
    const data = getChampionCrystalAscensionSources(gameId)
    expect(data.observedAt).toBe("2026-11-05T14:05:24+00:00")
    expect(new Set(data.crystals.map(source => source.key)).size).toBe(data.crystals.length)
    for (const source of data.crystals) {
      const opening = getCrystalOpening(source.id)!
      const reward = opening.categories.find(category => category.id === source.categoryId)!.rewards[source.rewardIndex]
      const projectedRewards = source.rewards.map(({ imageUrl, ...value }) => {
        expect(imageUrl).toBe(getRewardArtwork(value.type, value.data)?.url ?? null)
        return value
      })
      for (const rarity of source.rarities) {
        // A newer opening is not permission to extend an older eligibility path.
        expect(getChampionAscension(gameId, rarity)?.maxLevel).toBeGreaterThan(0)
        if (source.kind === "champion-token") {
          expect(reward).toMatchObject({ type: "inv", data: `ascension_token_champion_${gameId}` })
          expect(projectedRewards).toEqual([reward])
          const cost = getChampionAscensionRules(gameId).some(rule => rule.rarity === rarity && rule.steps.some(step => step.cost.some(item => item.type === "inv" && item.id === reward.data)))
          const resource = getAscensionResource("inv", reward.data)
          const usage = resource?.metadataResolved && (resource.usageTags ?? "").split(/[\s,;|]+/).includes(`t${rarity}:${gameId}`)
          expect(cost || usage).toBe(true)
        } else {
          expect(["hero", "hcos"]).toContain(reward.type)
          expect(reward).toMatchObject({ gameId, rarity })
          const binding = opening.conditionalBonuses.find(binding => binding.categoryId === source.categoryId && binding.rewardIndex === source.rewardIndex)!
          expect(source.autoAscend).toBe(binding.bonusReward.autoAscend)
          expect(projectedRewards).toEqual(binding.bonusReward.rewards)
        }
      }
    }
  }
})

it("returns independent finder identities without allowing mutations to change later lookups", () => {
  const original = getChampionCrystalAscensionChampions()
  const mutable = getChampionCrystalAscensionChampions()
  mutable[0].name = "changed"
  mutable[0].rarities.push(1)
  mutable.length = 0
  expect(getChampionCrystalAscensionChampions()).toEqual(original)
})
