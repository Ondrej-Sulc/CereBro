import { readAbilitySource, type EffectSourceMetadata, type EffectForm, type EffectDirection } from "@cerebro/core/domain/ability-source"
import { buildChampionKitOverviewEffects, groupChampionKitAbilitiesByDirection, isChampionKitSourceAvailableAtRarity, projectResistanceLinks, type KitResistance, type ChampionKitEffect, type ChampionKitSourceGroup } from "./champion-kit"
import type { ResistanceDetail } from "@cerebro/core/domain/champion-resistance"

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
  minResistancePotency?: number | null
}
export type RosterKitEffect = ChampionKitEffect & { matched: boolean; matchedSources: ChampionKitEffect["sources"] }
export type RosterKitSection = { key: "IMMUNITY" | "GAIN" | "INFLICT" | "UNKNOWN"; title: string; effects: RosterKitEffect[] }

function matchesMetadata(source: EffectSourceMetadata, filters: Pick<RosterKitFilters, "effectForms" | "effectDirections">): boolean {
  return (!filters.effectForms?.length || filters.effectForms.includes(source.effectForm))
    && (!filters.effectDirections?.length || filters.effectDirections.includes(source.effectDirection))
}

function matchesSelection(selected: string[], actual: Set<string>, logic: "AND" | "OR"): boolean {
  return !selected.length || (logic === "AND" ? selected.every(value => actual.has(value)) : selected.some(value => actual.has(value)))
}

/** Duration and damage reduction cannot establish a potency threshold; unknown values stay unknown. */
export function matchesResistancePotency(detail: ResistanceDetail | undefined, minimum?: number | null): boolean {
  if (minimum == null) return true
  return Number.isFinite(minimum) && minimum >= 0 && detail?.percent != null && Number.isFinite(detail.percent)
    && (detail.mechanism === "POTENCY" || detail.mechanism === "POTENCY_AND_DURATION") && detail.percent >= minimum
}

/** Each effect and its qualifiers must match the same application. Immunities always satisfy a protection minimum. */
export function matchesRosterKitFilters(entries: RosterKitLink[], filters: RosterKitFilters, rarity?: number): boolean {
  return matchesPreparedRosterKitFilters(prepareRosterKit(entries, rarity), filters)
}

/** Project resistance targets and parse source metadata once, then reuse them across facet candidates. */
export function prepareRosterKit(entries: RosterKitLink[], rarity?: number) {
  const applicable = projectResistanceLinks(entries).filter(entry => isChampionKitSourceAvailableAtRarity(entry.source, rarity))
  return {
    abilities: applicable.filter(entry => entry.type === "ABILITY").map(entry => ({
      name: entry.ability.name, categories: entry.ability.categories.map(category => category.name), metadata: readAbilitySource(entry),
    })),
    protections: applicable.filter(entry => entry.type === "IMMUNITY" || entry.type === "RESISTANCE").map(entry => ({
      name: entry.ability.name, type: entry.type, resistance: entry.resistance,
    })),
  }
}

export type PreparedRosterKit = ReturnType<typeof prepareRosterKit>

export function matchesPreparedRosterKitFilters(kit: PreparedRosterKit, filters: RosterKitFilters): boolean {
  const abilities = kit.abilities.filter(entry => matchesMetadata(entry.metadata, filters))
  const named = abilities.filter(entry => !filters.abilities.length || filters.abilities.includes(entry.name))
  const categorized = named.filter(entry => !filters.categories.length || entry.categories.some(category => filters.categories.includes(category)))
  if ((filters.effectForms?.length || filters.effectDirections?.length) && !categorized.length) return false
  const minimum = filters.includeResistances !== false ? filters.minResistancePotency : null
  const protections = kit.protections.filter(entry => entry.type === "IMMUNITY" || (filters.includeResistances !== false && entry.type === "RESISTANCE"
    && matchesResistancePotency(entry.resistance, minimum)))
  if (minimum != null && !protections.length) return false
  return matchesSelection(filters.abilities, new Set(categorized.map(entry => entry.name)), filters.abilityLogic ?? "AND")
    && matchesSelection(filters.categories, new Set(named.flatMap(entry => entry.categories)), filters.categoryLogic ?? "OR")
    && matchesSelection(filters.immunities, new Set(protections.map(entry => entry.name)), filters.immunityLogic ?? "AND")
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
  const minimum = filters.includeResistances !== false ? filters.minResistancePotency : null
  const protectionFilterActive = !!filters.immunities.length || minimum != null
  const decorate = (effects: ChampionKitEffect[]) => effects.map(effect => {
    const protection = effect.type === "IMMUNITY" || effect.type === "RESISTANCE"
    const matchingIdentity = protection ? protectionFilterActive && (effect.type === "IMMUNITY" || filters.includeResistances !== false) && (!filters.immunities.length || filters.immunities.includes(effect.name))
      : abilityFilterActive && (!filters.abilities.length || filters.abilities.includes(effect.name))
        && (!filters.categories.length || entries.some(entry => entry.type === "ABILITY" && entry.ability.name === effect.name && entry.ability.categories.some(category => filters.categories.includes(category.name))))
    const matchedSources = matchingIdentity ? effect.sources.filter(source => protection
      ? effect.type === "IMMUNITY" || matchesResistancePotency(source.resistance, minimum)
      : matchesMetadata(source, filters)) : []
    return { ...effect, matched: matchedSources.length > 0, matchedSources }
  }).sort((a, b) => Number(b.matched) - Number(a.matched) || a.name.localeCompare(b.name) || a.type.localeCompare(b.type))
  const titles = { GAIN: "Gains", INFLICT: "Inflicts", UNKNOWN: "Other effects" }
  return [
    { key: "IMMUNITY", title: "Immunities & resistances", effects: decorate(effects.filter(effect => effect.type === "IMMUNITY" || effect.type === "RESISTANCE")) },
    ...groupChampionKitAbilitiesByDirection(effects).map(section => ({ key: section.direction, title: titles[section.direction], effects: decorate(section.effects) })),
  ]
}

/** Keep expanded conditions consistent when several percentages share one form/direction group. */
export function matchingRosterKitSourceGroups(effect: RosterKitEffect, groups: ChampionKitSourceGroup[] = [], minimum?: number | null): ChampionKitSourceGroup[] {
  const matching = groups.filter(group => !effect.matched || effect.matchedSources.some(source => source.effectForm === group.effectForm && source.effectDirection === group.effectDirection))
  if (!effect.matched || effect.type !== "RESISTANCE" || minimum == null) return matching
  return matching.map(group => ({
    ...group,
    nativeSources: group.nativeSources.filter(source => matchesResistancePotency(source.resistance, minimum)),
    synergies: group.synergies.map(synergy => ({ ...synergy, links: synergy.links.filter(link => matchesResistancePotency(link.resistance, minimum)) })).filter(synergy => synergy.links.length > 0),
  })).filter(group => group.nativeSources.length > 0 || group.synergies.length > 0)
}
