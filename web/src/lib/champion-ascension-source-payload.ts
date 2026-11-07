import type { ChampionCrystalAscensionSources } from "./data/champion-crystal-ascension-types"
import type { ChampionAscensionAcquisitionSources } from "./data/champion-ascension-acquisition-types"

/** Crystal bindings retain their own source-specific contract. */
export type ChampionAscensionSourcePayload = ChampionCrystalAscensionSources & {
  acquisition: ChampionAscensionAcquisitionSources
}
