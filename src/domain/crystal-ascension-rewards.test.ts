import { expect, it } from "vitest"
import { getCrystalOpening, listCrystalOpenings } from "../data/game-crystal-openings"
import { getAscensionResource, getChampionAscensionRules } from "../data/game-ascension"
import { hasCrystalAscensionRewards, hasCrystalSevenStarAscensionRewards, RECORDED_ASCENSION_REWARD_BUNDLES, RECORDED_SEVEN_STAR_ASCENSION_REWARD_BUNDLES } from "./crystal-ascension-rewards"

const evidence = { getRules: getChampionAscensionRules, getResource: getAscensionResource }

it.each([
  "valiant_metamorphosis_crystal", "greater_empowered_crystal", "vfh_gwenom_broken_justice_crystal",
  "t7_class_ascension_token_crystal", "venom_duck_ascension_chase_box_prg10",
  "arnim_zola_ascension_box", "prg_9_silver_bty_bx",
])("finds exact seven-star ascension rewards in %s", id => {
  expect(hasCrystalSevenStarAscensionRewards(getCrystalOpening(id)!, evidence)).toBe(true)
})

it("excludes generic dust and unknown tokens from seven-star discovery while retaining broad material recognition", () => {
  const opening = structuredClone(getCrystalOpening("t7_class_ascension_token_crystal")!)
  const reward = opening.categories[0].rewards[0]
  opening.categories = [{ id: "test", rewards: [reward] }]
  opening.conditionalBonuses = []
  for (const data of ["primordial_dust_t1", "primordial_dust_t2", "primordial_dust_t3", "ascension_token_champion_unknown", "ascension_token_class_unknown"]) {
    reward.data = data
    reward.displayName = "7-STAR ASCENSION TOKEN"
    expect(hasCrystalSevenStarAscensionRewards(opening, evidence), data).toBe(false)
    expect(hasCrystalAscensionRewards(opening), data).toBe(true)
  }
  reward.data = "ascension_token_class_tech"
  expect(hasCrystalSevenStarAscensionRewards(opening, evidence)).toBe(true)
  reward.type = "res"
  expect(hasCrystalSevenStarAscensionRewards(opening, evidence)).toBe(false)
})

it("requires exact seven-star token usage or a canonical seven-star cost, never a name or lower-star path", () => {
  const opening = structuredClone(getCrystalOpening("venom_duck_ascension_chase_box_prg10")!)
  const reward = opening.categories.flatMap(category => category.rewards).find(reward => reward.data === "ascension_token_champion_venomtheduck")!
  opening.categories = [{ id: "token", rewards: [reward] }]
  opening.conditionalBonuses = []
  const rules = getChampionAscensionRules("venomtheduck").filter(rule => rule.rarity === 7)
  expect(hasCrystalSevenStarAscensionRewards(opening, { getRules: () => rules, getResource: () => null })).toBe(true)
  expect(hasCrystalSevenStarAscensionRewards(opening, { getRules: () => rules.map(rule => ({ ...rule, rarity: 6 })), getResource: () => null })).toBe(false)
  expect(hasCrystalSevenStarAscensionRewards(opening, { getRules: () => [], getResource: () => ({ type: "inv", id: reward.data, metadataResolved: true, usageTags: "t7:venomtheduck" }) })).toBe(true)
  for (const usageTags of ["t6:venomtheduck", "t7:other", "t7:venomtheduck_lookalike"]) {
    expect(hasCrystalSevenStarAscensionRewards(opening, { getRules: () => [], getResource: () => ({ type: "inv", id: reward.data, metadataResolved: true, usageTags }) })).toBe(false)
  }
})

it("requires the seven-star bonus's exact direct champion outcome binding", () => {
  const opening = structuredClone(getCrystalOpening("vfh_gwenom_broken_justice_crystal")!)
  const binding = opening.conditionalBonuses.find(binding => opening.categories.find(category => category.id === binding.categoryId)?.rewards[binding.rewardIndex].rarity === 7)!
  const trigger = opening.categories.find(category => category.id === binding.categoryId)!.rewards[binding.rewardIndex]
  opening.conditionalBonuses = [binding]
  opening.categories = [{ id: binding.categoryId, rewards: [trigger] }]
  expect(hasCrystalSevenStarAscensionRewards(opening, evidence)).toBe(true)
  trigger.rarity = 6
  expect(hasCrystalSevenStarAscensionRewards(opening, evidence)).toBe(false)
  trigger.rarity = 7
  trigger.context = { bonusReward: "unrelated" }
  expect(hasCrystalSevenStarAscensionRewards(opening, evidence)).toBe(false)
  trigger.context = { bonusReward: binding.bonusReward.id }
  trigger.type = "bp"
  expect(hasCrystalSevenStarAscensionRewards(opening, evidence)).toBe(false)
  trigger.type = "hero"
  binding.bonusReward.rewards = [{ sourceIndex: 0, type: "inv", data: "primordial_dust_t2", quantity: 500 }]
  binding.bonusReward.autoAscend = false
  expect(hasCrystalSevenStarAscensionRewards(opening, evidence)).toBe(false)
  binding.bonusReward.autoAscend = true
  expect(hasCrystalSevenStarAscensionRewards(opening, evidence)).toBe(true)
})

it("keeps reviewed seven-star bundles explicit and excludes dust bundles and lookalikes", () => {
  const opening = structuredClone(getCrystalOpening("t7_class_ascension_token_crystal")!)
  const reward = opening.categories[0].rewards[0]
  opening.categories = [{ id: "bundle", rewards: [reward] }]
  opening.conditionalBonuses = []
  for (const data of RECORDED_ASCENSION_REWARD_BUNDLES) {
    reward.data = data
    expect(hasCrystalSevenStarAscensionRewards(opening, evidence), data).toBe((RECORDED_SEVEN_STAR_ASCENSION_REWARD_BUNDLES as readonly string[]).includes(data))
  }
  for (const data of ["arnim_zola_ascension_box_tech_token_and_empowered_crystal_d", "prg5_secret_stash_lvl1_mysterio_ascension_token", "ascension_rankup_t71"]) {
    reward.data = data
    reward.displayName = "7-STAR ASCENSION TOKEN"
    expect(hasCrystalSevenStarAscensionRewards(opening, evidence), data).toBe(false)
  }
})

it("does not turn ordinary seven-star pools, cosmetics or similarly named crystals into ascension sources", () => {
  for (const id of ["7_star_hero_shard_crystal", "7_star_titan_hero_shard_crystal", "greater_ascendant_crystal", "paragon_crystal_v2"]) {
    expect(hasCrystalSevenStarAscensionRewards(getCrystalOpening(id)!, evidence), id).toBe(false)
  }
})

it("retains canonical lower-star paths and the seven-star A2 dust and gold costs", () => {
  const rules = getChampionAscensionRules("gwenom")
  expect(rules.filter(rule => [4, 5, 6].includes(rule.rarity)).every(rule => rule.steps.some(step => step.cost.some(cost => /^primordial_dust_t[12]$/.test(cost.id))))).toBe(true)
  expect(rules.find(rule => rule.rarity === 7)?.steps.find(step => step.level === 2)?.cost).toEqual(expect.arrayContaining([
    { type: "inv", id: "primordial_dust_t2", quantity: 500 }, { type: "res", id: "sc", quantity: 100000 },
  ]))
})

it.each([
  "valiant_metamorphosis_crystal", "greater_empowered_crystal", "vfh_gwenom_broken_justice_crystal",
  "t7_class_ascension_token_crystal", "venom_duck_ascension_chase_box_prg10",
  "arnim_zola_ascension_box", "prg_9_silver_bty_bx",
])("finds recorded bonus, token and bundled ascension rewards in %s", id => {
  expect(hasCrystalAscensionRewards(getCrystalOpening(id)!)).toBe(true)
})

it.each(["7_star_hero_shard_crystal", "7_star_titan_hero_shard_crystal", "greater_ascendant_crystal", "paragon_crystal_v2"])("does not infer ascension from an ordinary champion pool or the name of %s", id => {
  expect(hasCrystalAscensionRewards(getCrystalOpening(id)!)).toBe(false)
})

it("recognizes exact material identities without treating rank-up gems, currencies or arbitrary names as ascensions", () => {
  const opening = structuredClone(getCrystalOpening("t7_class_ascension_token_crystal")!)
  const reward = opening.categories[0].rewards[0]
  opening.conditionalBonuses = []
  opening.categories = [{ id: "test", rewards: [reward] }]
  for (const data of ["primordial_dust_t1", "primordial_dust_t2", "primordial_dust_t3", "ascension_token_champion_venomtheduck"]) {
    reward.data = data
    expect(hasCrystalAscensionRewards(opening)).toBe(true)
  }
  for (const data of ["ascension_rankup_t71", "sc", "unknown_ascension_reward", "primordial_dust_title"]) {
    reward.data = data
    reward.displayName = "ASCENSION TOKEN"
    expect(hasCrystalAscensionRewards(opening)).toBe(false)
  }
  reward.data = "primordial_dust_t2"; reward.type = "res"
  expect(hasCrystalAscensionRewards(opening)).toBe(false)
})

it("keeps reviewed bundle recognition tied to exact recorded inventory rewards with explicit material names", () => {
  const rewards = listCrystalOpenings().flatMap(definition => getCrystalOpening(definition.id)!.categories.flatMap(category => category.rewards))
  for (const id of RECORDED_ASCENSION_REWARD_BUNDLES) {
    const matches = rewards.filter(reward => reward.type === "inv" && reward.data === id)
    expect(matches.length, id).toBeGreaterThan(0)
    expect(matches.every(reward => /ASCENSION TOKEN|PRIMORDIAL DUST/.test(reward.displayName ?? "")), id).toBe(true)
  }
})
