import type { CrystalOpeningReward } from "@cerebro/core/domain/crystal-openings"

export type ChampionCrystalAscensionSource = {
  key: string
  /** Exact opening ID; never a grouped champion-family ID. */
  id: string
  name: string
  artworkUrl: string | null
  rarities: number[]
  kind: "champion-bonus" | "champion-token"
  autoAscend: boolean
  categoryId: string
  rewardIndex: number
  rewards: Array<CrystalOpeningReward & { imageUrl: string | null }>
}

export type ChampionCrystalAscensionSources = {
  observedAt: string
  crystals: ChampionCrystalAscensionSource[]
}
