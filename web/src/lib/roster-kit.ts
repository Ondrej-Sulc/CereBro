import { readAbilitySource, type EffectSourceMetadata, type EffectForm, type EffectDirection } from "@cerebro/core/domain/ability-source"
import { buildChampionKitOverviewEffects, groupChampionKitAbilitiesByDirection, isChampionKitSourceAvailableAtRarity, projectResistanceLinks, type KitResistance, type ChampionKitEffect } from "./champion-kit"

export type RosterKitLink = Partial<EffectSourceMetadata> & {
  id: number
  type: string
  source: string | null
  overviewSummary?: string | null
  resistances?: KitResistance[]
  ability: { name: string; iconUrl: string | null; gameGlossaryTermId: string | null; description: string | null; gameGlossaryTerm: { raw: unknown } | null; categories: { name: string }[] }
  synergyChampions: { champion: { name: string; images: unknown; slug?: string | null } }[]
}
export type RosterKitFilters = {
  abilities: string[]; immunities: string[]; categories: string[]
  effectForms?: readonly EffectForm[]; effectDirections?: readonly EffectDirection[]
  abilityLogic?: "AND" | "OR"; immunityLogic?: "AND" | "OR"; categoryLogic?: "AND" | "OR"
  includeResistances?: boolean
}
export type RosterKitEffect = ChampionKitEffect & { matched: boolean; matchedSources: ChampionKitEffect["sources"] }
export type RosterKitSection = { key: "IMMUNITY" | "GAIN" | "INFLICT" | "UNKNOWN"; title: string; effects: RosterKitEffect[] }

function matchesMetadata(source: EffectSourceMetadata, filters: RosterKitFilters): boolean {
  return (!filters.effectForms?.length || filters.effectForms.includes(source.effectForm))
    && (!filters.effectDirections?.length || filters.effectDirections.includes(source.effectDirection))
}

function matchesSelection(selected: string[], actual: Set<string>, logic: "AND" | "OR"): boolean {
  return !selected.length || (logic === "AND" ? selected.every(value => actual.has(value)) : selected.some(value => actual.has(value)))
}

/** Name, category, form and direction qualify the same application. Immunities stay independent. */
export function matchesRosterKitFilters(entries: RosterKitLink[], filters: RosterKitFilters, rarity?: number): boolean {
  const applicable = projectResistanceLinks(entries).filter(entry => isChampionKitSourceAvailableAtRarity(entry.source, rarity))
  const abilities = applicable.filter(entry => entry.type === "ABILITY" && matchesMetadata(readAbilitySource(entry), filters))
  const named = abilities.filter(entry => !filters.abilities.length || filters.abilities.includes(entry.ability.name))
  const categorized = named.filter(entry => !filters.categories.length || entry.ability.categories.some(category => filters.categories.includes(category.name)))
  if ((filters.effectForms?.length || filters.effectDirections?.length) && !categorized.length) return false
  return matchesSelection(filters.abilities, new Set(categorized.map(entry => entry.ability.name)), filters.abilityLogic ?? "AND")
    && matchesSelection(filters.categories, new Set(named.flatMap(entry => entry.ability.categories.map(category => category.name))), filters.categoryLogic ?? "OR")
    && matchesSelection(filters.immunities, new Set(applicable.filter(entry => entry.type === "IMMUNITY" || (filters.includeResistances && entry.type === "RESISTANCE")).map(entry => entry.ability.name)), filters.immunityLogic ?? "AND")
}

export function buildRosterKitSections(entries: RosterKitLink[], filters: RosterKitFilters, rarity?: number): RosterKitSection[] {
  const links = entries.flatMap(entry => entry.type === "ABILITY" || entry.type === "IMMUNITY" ? [{
    ...entry,
    type: entry.type as "ABILITY" | "IMMUNITY",
    synergyChampions: entry.synergyChampions.map(({ champion }) => ({ champion: { ...champion, slug: champion.slug ?? null } })),
  }] : [])
  const glossary = new Map(links.map(link => [link.ability.gameGlossaryTermId ?? link.ability.name.toLowerCase().replace(/[^a-z0-9]+/g, "_"), {
    description: link.ability.description, raw: link.ability.gameGlossaryTerm?.raw, iconUrl: link.ability.iconUrl,
  }]))
  const effects = buildChampionKitOverviewEffects(links, glossary, rarity)
  const abilityFilterActive = !!(filters.abilities.length || filters.categories.length || filters.effectForms?.length || filters.effectDirections?.length)
  const decorate = (effects: ChampionKitEffect[]) => effects.map(effect => {
    const protection = effect.type === "IMMUNITY" || effect.type === "RESISTANCE"
    const matchingIdentity = protection ? (effect.type === "IMMUNITY" || filters.includeResistances) && filters.immunities.includes(effect.name)
      : abilityFilterActive && (!filters.abilities.length || filters.abilities.includes(effect.name))
        && (!filters.categories.length || entries.some(entry => entry.type === "ABILITY" && entry.ability.name === effect.name && entry.ability.categories.some(category => filters.categories.includes(category.name))))
    const matchedSources = matchingIdentity ? effect.sources.filter(source => protection || matchesMetadata(source, filters)) : []
    return { ...effect, matched: matchedSources.length > 0, matchedSources }
  }).sort((a, b) => Number(b.matched) - Number(a.matched) || a.name.localeCompare(b.name) || a.type.localeCompare(b.type))
  const titles = { GAIN: "Gains", INFLICT: "Inflicts", UNKNOWN: "Other effects" }
  return [
    { key: "IMMUNITY", title: "Immunities & resistances", effects: decorate(effects.filter(effect => effect.type === "IMMUNITY" || effect.type === "RESISTANCE")) },
    ...groupChampionKitAbilitiesByDirection(effects).map(section => ({ key: section.direction, title: titles[section.direction], effects: decorate(section.effects) })),
  ]
}
