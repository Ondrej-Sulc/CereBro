import { prepareChampionAbilityTextView, type ChampionAbilityTextRecord, type ChampionAbilityCurve } from "./champion-ability-text"
import { groupChampionKitSources, type ChampionKitSourceGroup } from "./champion-kit"
import { buildRosterKitSections, type RosterKitLink } from "./roster-kit"
import type { ChampionSynergyCard } from "./champion-synergies"
import type { ResistanceValueContext } from "./champion-resistance-values"
import { maxSigForRarity } from "./mcoc-prestige"

export type RosterKitDetails = {
  entries: RosterKitLink[]
  groups: Record<string, ChampionKitSourceGroup[]>
}

/** Keep reviewed conditions; resolve additional numeric passages from current imported text and the requested build. */
export function buildRosterKitDetails(entries: RosterKitLink[], records: ChampionAbilityTextRecord[], rarity?: number, synergyCards: ChampionSynergyCard[] = [], context: ResistanceValueContext = {}, curves: ChampionAbilityCurve[] = []): RosterKitDetails {
  const maxSig = context.maxSig ?? maxSigForRarity(rarity)
  const build = { ...context, sigLevel: context.sigLevel ?? maxSig, maxSig, preview: context.sigLevel === undefined }
  const view = prepareChampionAbilityTextView({ records, curves, sigLevel: build.sigLevel, maxSig, stat: context.stat })
  const sections = buildRosterKitSections(entries, { abilities: [], immunities: [], categories: [] }, rarity)
  return { entries: entries.map(entry => ({ ...entry, ...(entry.resistances ? { resistances: entry.resistances.map(({ effect, mechanism, percent }) => ({ effect, mechanism, percent })) } : {}) })), groups: Object.fromEntries(sections.flatMap(section => section.effects.flatMap(effect => {
    const groups = groupChampionKitSources(effect, view, synergyCards, build)
    return [[`${section.key}:${effect.type}:${effect.name}`, groups], ...(effect.type === "RESISTANCE" ? [] : [[`${section.key}:${effect.name}`, groups]])]
  }))) }
}
