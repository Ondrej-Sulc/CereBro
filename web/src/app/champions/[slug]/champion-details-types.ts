import type { ChampionClass } from "@prisma/client"
import type { ChampionSynergy } from "@/lib/champion-synergies"
import type { prepareChampionAbilityTextView } from "@/lib/champion-ability-text"
import type { EffectSourceMetadata } from "@cerebro/core/domain/ability-source"

export type ChampionDetailsPayload = {
  id: number
  name: string
  shortName: string
  slug: string | null
  gameId: string | null
  class: ChampionClass
  images: unknown
  gameSynergies: ChampionSynergy[]
  tags: Array<{ id: number; name: string; category: string | null }>
  abilities: Array<EffectSourceMetadata & {
    id: number
    type: "ABILITY" | "IMMUNITY"
    source: string | null
    overviewSummary?: string | null
    ability: { name: string; description?: string | null; categories: Array<{ name: string }>; iconUrl?: string | null; gameGlossaryTermId?: string | null }
    synergyChampions: Array<{ champion: { name: string; slug: string | null; images: unknown } }>
  }>
  abilityTexts: Array<{
    id: number
    group: string
    title: string | null
    sortOrder: number
    template: unknown
  }>
  abilityCurves: Array<{
    id: number
    curveId: string
    kind: string
    formula: string
    params: unknown
    minSig: number | null
    maxSig: number | null
  }>
  attacks: Array<{
    id: number
    type: "L1" | "L2" | "L3" | "L4" | "M1" | "M2" | "H" | "S1" | "S2"
    hits: Array<{
      id: number
      properties: string[]
    }>
  }>
  stats: ChampionStatRow[]
  prestigeData: Array<{
    id: number
    rarity: number
    rank: number
    sig: number
    prestige: number
  }>
  duels: Array<{
    id: number
    playerName: string
    rank: string | null
    status: "ACTIVE" | "OUTDATED"
    source: "USER_SUGGESTION" | "GUIA_MTC" | "COCPIT" | "MCOCHUB"
    updatedAt: Date | string
  }>
}

export type ChampionStatRow = {
  id: number
  tierId: string
  rarity: number | null
  rarityLabel: string | null
  rank: number
  level: number | null
  challengeRating: number
  health: number | null
  attack: number | null
  healthRating: number | null
  attackRating: number | null
  prestige: number | null
  armorRating: number | null
  armorPenetration: number | null
  criticalRating: number | null
  criticalResistance: number | null
  criticalDamageRating: number | null
  blockProficiency: number | null
  blockPenetration: number | null
  specialDamageMultiplier: number | null
  energyResistance: number | null
  physicalResistance: number | null
  baseAbilityIds: string[]
  sigAbilityIds: string[]
}

export type GlossaryTerm = {
  id: string
  name: string
  description: string | null
  category: string | null
  iconUrl: string | null
  raw: unknown
}

export type ChampionDetailsProps = {
  champion: ChampionDetailsPayload
  glossaryTerms: GlossaryTerm[]
  maxStatsByTier: Record<string, Record<string, number | null>>
}

export type ChampionDetailsView = {
  champion: ChampionDetailsPayload
  portraitUrl: string
  heroUrl: string
  secondaryUrl: string
  accent: string
  selectedStat: ChampionStatRow | undefined
  selectedRarity: string
  selectedRank: string
  rarityOptions: number[]
  rankOptions: number[]
  sigLevel: number
  maxSig: number
  ascensionLevel: number
  prestige: number | null
  health: number | null
  attack: number | null
  maxStats: Record<string, number | null>
  abilities: ChampionDetailsPayload["abilities"]
  immunities: ChampionDetailsPayload["abilities"]
  glossaryById: Map<string, GlossaryTerm>
  descriptionView: ReturnType<typeof prepareChampionAbilityTextView>
  setRarity: (value: string) => void
  setRank: (value: string) => void
  setSigLevel: (value: number) => void
  setAscensionLevel: (value: number) => void
}
