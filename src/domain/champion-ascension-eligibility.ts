/** Snapshot coverage, not account unlocks, inventory or current source availability. */
export type ChampionAscensionEligibility = {
  /** Stars with a positive collectible path, including exact reviewed playable-event blueprints. */
  ascendableRarities: number[]
  /** Includes empty/no-tier paths; a star absent here has unknown metadata. */
  recordedRarities: number[]
}

/** Omitting rarity means any explicitly recorded eligible star. */
export function hasRecordedAscensionPath(eligibility: ChampionAscensionEligibility, rarity?: number) {
  return rarity === undefined ? eligibility.ascendableRarities.length > 0 : eligibility.ascendableRarities.includes(rarity)
}
