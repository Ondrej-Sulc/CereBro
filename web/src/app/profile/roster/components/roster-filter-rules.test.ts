import { describe, expect, it, vi } from "vitest";
import type { RosterFiltersProps } from "./roster-filters";
import { buildActiveFilterRules } from "./roster-filter-rules";

function props(overrides: Partial<RosterFiltersProps> = {}): RosterFiltersProps {
  return {
    search: "", viewMode: "view", showUnowned: true, sortBy: "NAME", sortDirection: "ASC",
    visibleChampionCount: 335, countLabel: "335 champions",
    filterStars: [], filterRanks: [], filterAscensionLevels: [], filterClasses: [],
    tagFilter: [], tagLogic: "AND", abilityCategoryFilter: [], abilityCategoryLogic: "OR",
    abilityFilter: [], abilityLogic: "AND", effectForms: [], effectDirections: [],
    immunityFilter: [], immunityLogic: "AND", includeResistances: true, minResistancePotency: null,
    initialTags: [], initialAbilityCategories: [], initialAbilities: [], initialImmunities: [],
    onSearchChange: vi.fn(), onViewModeChange: vi.fn(), onShowUnownedChange: vi.fn(), onAddClick: vi.fn(),
    onSortByChange: vi.fn(), onSortDirectionChange: vi.fn(), onFilterStarsChange: vi.fn(),
    onFilterRanksChange: vi.fn(), onFilterAscensionLevelsChange: vi.fn(), onFilterClassesChange: vi.fn(),
    onTagFilterChange: vi.fn(), onTagLogicChange: vi.fn(), onAbilityCategoryFilterChange: vi.fn(),
    onAbilityCategoryLogicChange: vi.fn(), onAbilityFilterChange: vi.fn(), onAbilityLogicChange: vi.fn(),
    onEffectFormsChange: vi.fn(), onEffectDirectionsChange: vi.fn(), onImmunityFilterChange: vi.fn(),
    onImmunityLogicChange: vi.fn(), onIncludeResistancesChange: vi.fn(), onMinResistancePotencyChange: vi.fn(),
    ...overrides,
  };
}

describe("active roster filter rules", () => {
  it("removes a protection and its potency as one rule without clearing independent filters", () => {
    const p = props({ filterClasses: ["SCIENCE"], immunityFilter: ["Bleed"], minResistancePotency: 80 });
    const rules = buildActiveFilterRules(p);
    expect(rules.map(rule => rule.label)).toEqual(["Science", "Bleed protection · ≥80% potency"]);
    rules.find(rule => rule.id === "protection")!.remove();
    expect(p.onImmunityFilterChange).toHaveBeenCalledWith([]);
    expect(p.onMinResistancePotencyChange).toHaveBeenCalledWith(null);
    expect(p.onIncludeResistancesChange).toHaveBeenCalledWith(true);
    expect(p.onImmunityLogicChange).toHaveBeenCalledWith("AND");
    expect(p.onFilterClassesChange).not.toHaveBeenCalled();
  });

  it("summarizes only active potency settings and resets a saved minimum when removing immunity-only mode", () => {
    expect(buildActiveFilterRules(props({ minResistancePotency: 0 }))[0].label).toBe("Protection · ≥0% potency");
    const p = props({ includeResistances: false, minResistancePotency: 80 });
    const [rule] = buildActiveFilterRules(p);
    expect(rule.label).toBe("Immunities only");
    rule.remove();
    expect(p.onMinResistancePotencyChange).toHaveBeenCalledWith(null);
    expect(p.onIncludeResistancesChange).toHaveBeenCalledWith(true);
  });

  it("keeps matching logic in the summary and clears all ability qualifiers together", () => {
    const p = props({ abilityFilter: ["Bleed", "Shock"], abilityLogic: "OR", effectForms: ["DEBUFF"], effectDirections: ["INFLICT"] });
    const [rule] = buildActiveFilterRules(p);
    expect(rule.label).toBe("Bleed or Shock · Debuff · Inflicts");
    rule.remove();
    expect(p.onAbilityFilterChange).toHaveBeenCalledWith([]);
    expect(p.onAbilityCategoryFilterChange).toHaveBeenCalledWith([]);
    expect(p.onEffectFormsChange).toHaveBeenCalledWith([]);
    expect(p.onEffectDirectionsChange).toHaveBeenCalledWith([]);
    expect(p.onAbilityLogicChange).toHaveBeenCalledWith("AND");
    expect(p.onAbilityCategoryLogicChange).toHaveBeenCalledWith("OR");
  });

  it("groups progression and excludes unavailable controls from both summary and removal", () => {
    const p = props({ filterStars: [7], filterRanks: [4], filterAscensionLevels: [0], showRankFilter: false });
    const [rule] = buildActiveFilterRules(p);
    expect(rule.label).toBe("7★ · Ascension 0");
    rule.remove();
    expect(p.onFilterStarsChange).toHaveBeenCalledWith([]);
    expect(p.onFilterAscensionLevelsChange).toHaveBeenCalledWith([]);
    expect(p.onFilterRanksChange).not.toHaveBeenCalled();
  });

  it("has no active rule for the inclusive defaults", () => {
    expect(buildActiveFilterRules(props())).toEqual([]);
  });
});
