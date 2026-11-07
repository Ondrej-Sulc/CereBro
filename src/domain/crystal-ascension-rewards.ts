import type { CrystalOpening, CrystalOpeningReward } from "./crystal-openings"
import type { AscensionResource, ChampionAscensionRules } from "./champion-ascension"

// These exact inventory bundles explicitly name tokens or Primordial Dust in
// the recorded GameStore reward titles. Do not infer bundle contents from the
// crystal's name, or treat ascension-restricted rank-up gems as ascensions.
export const RECORDED_ASCENSION_REWARD_BUNDLES = [
  "arnim_zola_ascension_box_tech_token_and_empowered_crystal_a",
  "arnim_zola_ascension_box_tech_token_and_empowered_crystal_b",
  "arnim_zola_ascension_box_tech_token_and_empowered_crystal_c",
  "arnim_zola_ascension_box_t2_dust_and_empowered_crystal",
  "prg4_secret_stash_lvl3_t1_primordial_dust",
  "prg4_silver_50x_t1_primordial_dust",
  "prg5_secret_stash_lvl3_t1_primordial_dust",
  "prg6_secret_stash_lvl3_t2_primordial_dust_100",
  "prg6_silver_75x_t2_primordial_dust",
  "prg6_silver_75x_t2_primordial_dust_v2",
  "prg8_secret_stash_lvl2_t2_primordial_dust_75",
  "prg8_secret_stash_lvl2_class_ascension_token_crystal",
  "prg8_silver_100_t2_primordial_dust",
  "prg8_silver_3x_class_ascension_token_crystal",
  "prg9_silver_5x_class_ascension_token_crystal",
  "prg9_sliver_200x_t2_primordial_dust",
] as const
const bundles: ReadonlySet<string> = new Set(RECORDED_ASCENSION_REWARD_BUNDLES)

function ascensionMaterial(reward: CrystalOpeningReward) {
  return reward.type === "inv" && (/^ascension_token_(?:champion|class)_[a-z0-9_]+$/.test(reward.data)
    || /^primordial_dust_t[1-3]$/.test(reward.data) || bundles.has(reward.data))
}

/** Source-bound reward discovery, not a promise of an ascension on every pull. */
export function hasCrystalAscensionRewards(opening: Pick<CrystalOpening, "categories" | "conditionalBonuses">) {
  return opening.categories.some(category => category.rewards.some(ascensionMaterial))
    || opening.conditionalBonuses.some(binding => binding.bonusReward.autoAscend || binding.bonusReward.rewards.some(ascensionMaterial))
}

// Reviewed token-bearing subset of the bundles above. Dust-only bundles do not
// establish seven-star discovery relevance, even when their titles mention an
// Empowered Crystal. No nested bundle contents are expanded or guessed.
export const RECORDED_SEVEN_STAR_ASCENSION_REWARD_BUNDLES = [
  "arnim_zola_ascension_box_tech_token_and_empowered_crystal_a",
  "arnim_zola_ascension_box_tech_token_and_empowered_crystal_b",
  "arnim_zola_ascension_box_tech_token_and_empowered_crystal_c",
  "prg8_secret_stash_lvl2_class_ascension_token_crystal",
  "prg8_silver_3x_class_ascension_token_crystal",
  "prg9_silver_5x_class_ascension_token_crystal",
] as const satisfies readonly typeof RECORDED_ASCENSION_REWARD_BUNDLES[number][]
const sevenStarBundles: ReadonlySet<string> = new Set(RECORDED_SEVEN_STAR_ASCENSION_REWARD_BUNDLES)

type SevenStarAscensionEvidence = {
  getRules(gameId: string): ChampionAscensionRules[]
  getResource(type: "inv", id: string): AscensionResource | null
}

function sevenStarToken(reward: CrystalOpeningReward, evidence: SevenStarAscensionEvidence) {
  if (reward.type !== "inv") return false
  const identity = /^ascension_token_(champion|class)_([a-z0-9_]+)$/.exec(reward.data)
  if (!identity) return false
  const [, kind, target] = identity
  if (kind === "champion" && evidence.getRules(target).some(rule => rule.gameId === target && rule.rarity === 7
    && rule.steps.some(step => step.cost.some(cost => cost.type === "inv" && cost.id === reward.data)))) return true
  const resource = evidence.getResource("inv", reward.data)
  return resource?.metadataResolved === true && resource.type === "inv" && resource.id === reward.data
    && (resource.usageTags ?? "").split(/[\s,;|]+/).includes(`t7:${target}`)
}

/** Seven-star discovery only. Reward applicability never grants eligibility,
 * rates, guarantees or current availability; generic dust alone is insufficient. */
export function hasCrystalSevenStarAscensionRewards(opening: Pick<CrystalOpening, "categories" | "conditionalBonuses">, evidence: SevenStarAscensionEvidence) {
  if (opening.categories.some(category => category.rewards.some(reward => sevenStarToken(reward, evidence)
    || reward.type === "inv" && sevenStarBundles.has(reward.data)))) return true
  return opening.conditionalBonuses.some(binding => {
    const trigger = opening.categories.find(category => category.id === binding.categoryId)?.rewards.find(reward => reward.sourceIndex === binding.rewardIndex)
    if (!trigger?.gameId || trigger.rarity !== 7 || !["hero", "hcos"].includes(trigger.type)
      || trigger.context?.bonusReward !== binding.bonusReward.id) return false
    return binding.bonusReward.autoAscend || binding.bonusReward.rewards.some(reward => sevenStarToken(reward, evidence)
      || reward.type === "inv" && sevenStarBundles.has(reward.data))
  })
}
