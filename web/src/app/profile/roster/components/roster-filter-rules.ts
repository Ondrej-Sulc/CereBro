import { EFFECT_FORM_LABELS, EFFECT_DIRECTION_LABELS } from "@cerebro/core/domain/ability-source";
import type { RosterFiltersProps } from "./roster-filters";

export type RosterFilterRule = { id: string; label: string; accent?: boolean; remove: () => void };

const joinSelection = (values: string[], logic: "AND" | "OR") => values.join(logic === "AND" ? " and " : " or ");

/** A summary and its removal describe the same complete filter rule. */
export function buildActiveFilterRules(p: RosterFiltersProps): RosterFilterRule[] {
  const rules: RosterFilterRule[] = [];
  if (p.search) rules.push({ id: "search", label: `Name: ${p.search}`, remove: () => p.onSearchChange("") });

  const progression = [
    p.filterStars.map(value => `${value}★`).join(" / "),
    p.showRankFilter !== false && p.filterRanks.length ? `Rank ${p.filterRanks.join(" / ")}` : "",
    p.showAscensionFilter !== false && p.filterAscensionLevels.length ? `Ascension ${p.filterAscensionLevels.join(" / ")}` : "",
  ].filter(Boolean);
  if (progression.length) rules.push({ id: "progression", label: progression.join(" · "), remove: () => {
    p.onFilterStarsChange([]);
    if (p.showRankFilter !== false) p.onFilterRanksChange([]);
    if (p.showAscensionFilter !== false) p.onFilterAscensionLevelsChange([]);
  } });

  if (p.filterClasses.length) rules.push({ id: "class", label: p.filterClasses.map(value => value.charAt(0) + value.slice(1).toLowerCase()).join(" or "), remove: () => p.onFilterClassesChange([]) });
  if (p.tagFilter.length) rules.push({ id: "tags", label: `Tags: ${joinSelection(p.tagFilter, p.tagLogic)}`, remove: () => {
    p.onTagFilterChange([]); p.onTagLogicChange("AND");
  } });

  const abilities = [
    joinSelection(p.abilityFilter, p.abilityLogic),
    p.abilityCategoryFilter.length ? `Category: ${joinSelection(p.abilityCategoryFilter, p.abilityCategoryLogic)}` : "",
    p.effectForms.map(value => EFFECT_FORM_LABELS[value]).join(" or "),
    p.effectDirections.map(value => EFFECT_DIRECTION_LABELS[value]).join(" or "),
  ].filter(Boolean);
  if (abilities.length) rules.push({ id: "abilities", label: (p.abilityFilter.length || p.abilityCategoryFilter.length ? abilities : ["Abilities", ...abilities]).join(" · "), accent: true, remove: () => {
    p.onAbilityFilterChange([]); p.onAbilityCategoryFilterChange([]); p.onEffectFormsChange([]); p.onEffectDirectionsChange([]);
    p.onAbilityLogicChange("AND"); p.onAbilityCategoryLogicChange("OR");
  } });

  const potencyActive = p.includeResistances && p.minResistancePotency != null;
  if (p.immunityFilter.length || potencyActive || !p.includeResistances) {
    const name = p.immunityFilter.length
      ? `${joinSelection(p.immunityFilter, p.immunityLogic)} ${p.includeResistances ? "protection" : "immunity"}`
      : p.includeResistances ? "Protection" : "Immunities only";
    rules.push({ id: "protection", label: [name, potencyActive ? `≥${p.minResistancePotency}% potency` : ""].filter(Boolean).join(" · "), accent: true, remove: () => {
      p.onImmunityFilterChange([]); p.onMinResistancePotencyChange(null); p.onIncludeResistancesChange(true); p.onImmunityLogicChange("AND");
    } });
  }
  if (p.showOwnershipFilter !== false && !p.showUnowned) rules.push({ id: "ownership", label: "Owned only", remove: () => p.onShowUnownedChange(true) });
  return rules;
}
