import { ChampionWithRelations, RosterEntryWithChampionRelations, SearchCoreParams } from "../../types/search";
import type { ChampionEffect } from "../../domain/champion-effects";
import { parseAndOrConditions } from "./queryBuilder";
import type { ChatInputCommandInteraction } from "discord.js";
import type { EffectForm, EffectDirection } from "../../domain/ability-source";

export type SearchCriteria = Omit<SearchCoreParams, "userId" | "page" | "searchId">;

export function readSearchCriteria(interaction: ChatInputCommandInteraction): SearchCriteria {
  return {
    abilities: interaction.options.getString("abilities"),
    immunities: interaction.options.getString("immunities"),
    tags: interaction.options.getString("tags"),
    championClass: interaction.options.getString("class"),
    abilityCategory: interaction.options.getString("ability-category"),
    attackType: interaction.options.getString("attack-type"),
    effectForm: interaction.options.getString("effect-form") as EffectForm | null,
    effectDirection: interaction.options.getString("effect-direction") as EffectDirection | null,
    includeResistances: interaction.options.getBoolean("include-resistances"),
    minResistance: interaction.options.getNumber("min-resistance"),
  };
}

export function parseSearchCriteria(criteria: SearchCriteria) {
  const terms = (value?: string | null) => parseAndOrConditions(value).conditions.map(value => value.toLowerCase());
  return {
    abilities: terms(criteria.abilities), immunities: terms(criteria.immunities), tags: terms(criteria.tags),
    abilityCategory: terms(criteria.abilityCategory), attackType: terms(criteria.attackType),
    effectForm: criteria.effectForm, effectDirection: criteria.effectDirection,
    includeResistances: criteria.includeResistances !== false, minResistance: criteria.minResistance,
  };
}
export type ParsedSearchCriteria = ReturnType<typeof parseSearchCriteria>;

export function matchesAbilitySource(effect: ChampionEffect, criteria: Pick<ParsedSearchCriteria, "effectForm" | "effectDirection">): boolean {
  return effect.type === "ABILITY" && (!criteria.effectForm || effect.effectForm === criteria.effectForm)
    && (!criteria.effectDirection || effect.effectDirection === criteria.effectDirection);
}

export function matchesProtection(effect: ChampionEffect, criteria: Pick<ParsedSearchCriteria, "includeResistances" | "minResistance">): boolean {
  if (effect.type === "IMMUNITY") return true;
  if (effect.type !== "RESISTANCE" || !criteria.includeResistances) return false;
  if (criteria.minResistance == null) return true;
  return !!effect.resistance && ["POTENCY", "POTENCY_AND_DURATION"].includes(effect.resistance.mechanism)
    && effect.resistance.percent !== null && effect.resistance.percent >= criteria.minResistance;
}

/** Database filters select candidates; current source/evidence validation decides actual effect matches. */
export function matchesChampionEffectCriteria(effects: ChampionEffect[], criteria: SearchCriteria): boolean {
  const parsed = parseSearchCriteria(criteria);
  const match = (value: string | null | undefined, predicate: (term: string) => boolean) => {
    const { conditions, useAnd } = parseAndOrConditions(value);
    return !conditions.length || (useAnd ? conditions.every(term => predicate(term.toLowerCase())) : conditions.some(term => predicate(term.toLowerCase())));
  };
  const abilities = effects.filter(effect => matchesAbilitySource(effect, parsed));
  if (!match(criteria.abilities, term => abilities.some(effect => effect.ability.name.toLowerCase() === term))) return false;
  if (!match(criteria.abilityCategory, term => abilities.some(effect => effect.ability.categories?.some(category => category.name.toLowerCase() === term)))) return false;
  if ((criteria.effectForm || criteria.effectDirection) && !abilities.length) return false;
  const protections = effects.filter(effect => matchesProtection(effect, parsed));
  if (!match(criteria.immunities, term => protections.some(effect => effect.ability.name.toLowerCase() === term))) return false;
  return criteria.minResistance == null || protections.length > 0;
}

export function isRosterEntry(
  champions: ChampionWithRelations[] | RosterEntryWithChampionRelations[]
): champions is RosterEntryWithChampionRelations[] {
  return champions.length > 0 && "champion" in champions[0];
}
