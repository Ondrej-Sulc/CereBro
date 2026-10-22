import { prepareChampionAbilityTextView, type ChampionAbilityTextRecord } from "./champion-ability-text"
import { groupChampionKitSources, type ChampionKitSourceGroup } from "./champion-kit"
import { buildRosterKitSections, type RosterKitLink } from "./roster-kit"
import type { ChampionSynergyCard } from "./champion-synergies"

export type RosterKitDetails = {
  entries: RosterKitLink[]
  groups: Record<string, ChampionKitSourceGroup[]>
}

/** Prepared full-ability text is used only for navigation; source details reuse the overview's safe display copy. */
export function buildRosterKitDetails(entries: RosterKitLink[], records: ChampionAbilityTextRecord[], rarity?: number, synergyCards: ChampionSynergyCard[] = []): RosterKitDetails {
  const view = prepareChampionAbilityTextView({ records })
  const sections = buildRosterKitSections(entries, { abilities: [], immunities: [], categories: [] }, rarity)
  return { entries, groups: Object.fromEntries(sections.flatMap(section => section.effects.flatMap(effect => {
    const groups = groupChampionKitSources(effect, view, synergyCards)
    return [[`${section.key}:${effect.type}:${effect.name}`, groups], ...(effect.type === "RESISTANCE" ? [] : [[`${section.key}:${effect.name}`, groups]])]
  }))) }
}
