import { describe, expect, it } from "vitest";
import type { Champion } from "@/types/champion";
import type { ProfileRosterEntry } from "@/app/profile/roster/types";
import { createRosterFilterIndex, filterRosterWithFacets, type RosterFiltersState } from "./roster-filtering";
import type { RosterKitLink } from "./roster-kit";
import { withChampionAscensionEligibility } from "./champion-ascension-payload";
import { getChampionCrystalAscensionSources } from "./data/champion-crystal-ascension";

const defaults: RosterFiltersState = {
  search: "", classes: [], stars: [], ranks: [], ascension: [], tags: [], tagLogic: "AND", showUnowned: true,
  abilities: [], categories: [], immunities: [], includeResistances: true,
};
const link = (name: string, overrides: Partial<RosterKitLink> = {}): RosterKitLink => ({
  id: 1, type: "ABILITY", source: null, synergyChampions: [],
  ability: { name, iconUrl: null, gameGlossaryTermId: null, description: null, gameGlossaryTerm: null, categories: [] },
  ...overrides,
});
const champion = (id: number, values: { class?: Champion["class"]; tags?: string[]; abilities?: RosterKitLink[]; obtainable?: string[] } = {}) => ({
  id, name: `Champion ${id}`, class: values.class ?? "SCIENCE", obtainable: values.obtainable ?? ["5", "6", "7"],
  tags: (values.tags ?? []).map(name => ({ id: name, name })), abilities: values.abilities ?? [],
} as unknown as Champion);
const owned = (champion: Champion, stars = 6, rank = 4, ascensionLevel = 0) => ({
  id: `${champion.id}-${stars}`, championId: champion.id, champion, stars, rank, ascensionLevel, isAscended: ascensionLevel > 0,
} as unknown as ProfileRosterEntry);

describe("contextual roster facets", () => {
  it("matches catalog scopes only at obtainable selected stars with positive canonical paths", () => {
    const rows = [
      { ...champion(1), gameId: "hulk" },
      { ...champion(2), gameId: "gwenom" },
      { ...champion(3, { obtainable: ["6"] }), gameId: "gwenom" },
      { ...champion(4), gameId: "unknown" },
      { ...champion(5, { obtainable: ["7"] }), gameId: "carina_white" },
    ].map(withChampionAscensionEligibility);
    const index = createRosterFilterIndex([], rows);
    const filters = { ...defaults, ascensionEligible: true, eligibilityIncludesUnowned: true };
    expect(filterRosterWithFacets(index, filters).entries.map(row => row.championId)).toEqual([2, 5]);
    expect(filterRosterWithFacets(index, { ...filters, stars: [6] }).entries).toEqual([]);
    expect(filterRosterWithFacets(index, { ...filters, stars: [6, 7] }).entries.map(row => row.championId)).toEqual([2, 5]);
    expect(filterRosterWithFacets(index, { ...filters, classes: ["COSMIC"] }).entries).toEqual([]);
    expect(filterRosterWithFacets(index, filters).counts.stars).toEqual({ 7: 2 });
    expect(filters.stars).toEqual([]);
  });
  it("restricts seven-star eligibility to actual owned copies without replacing rarity intent", () => {
    const gwenom = withChampionAscensionEligibility({ ...champion(1), gameId: "gwenom" });
    const hulk = withChampionAscensionEligibility({ ...champion(2), gameId: "hulk" });
    const unknown = { ...champion(3), gameId: "unknown" };
    const index = createRosterFilterIndex([owned(gwenom, 7, 4, 5), owned(gwenom, 6), owned(hulk, 7), owned(hulk, 6), owned(unknown, 7)], [gwenom, hulk, unknown, { ...gwenom, id: 4 }]);
    const filters = { ...defaults, ascensionEligible: true };
    expect(filterRosterWithFacets(index, filters).entries.map(row => row.id)).toEqual(["1-7"]);
    expect(filterRosterWithFacets(index, filters).counts.stars).toEqual({ 7: 1 });
    expect(filterRosterWithFacets(index, { ...filters, ascension: [5], classes: ["SCIENCE"], stars: [6, 7] }).entries.map(row => row.id)).toEqual(["1-7"]);
    expect(filterRosterWithFacets(index, { ...filters, stars: [6] }).entries).toEqual([]);
    expect(filters.stars).toEqual([]);
  });
  it("matches explicit paths at selected obtainable stars with OR semantics, leaving ordinary browsing intact", () => {
    const hulk = withChampionAscensionEligibility({ ...champion(1), gameId: "hulk" });
    const gwenom = withChampionAscensionEligibility({ ...champion(2), gameId: "gwenom" });
    const unknown = withChampionAscensionEligibility({ ...champion(3), gameId: "unknown" });
    const unavailable = { ...hulk, id: 4, obtainable: ["7"] };
    const index = createRosterFilterIndex([], [hulk, gwenom, unknown, unavailable]);
    const eligible = { ...defaults, ascensionEligible: true, eligibilityIncludesUnowned: true };
    expect(filterRosterWithFacets(index, defaults).entries).toHaveLength(4);
    expect(filterRosterWithFacets(index, eligible).entries.map(row => row.championId)).toEqual([2]);
    expect(filterRosterWithFacets(index, { ...eligible, stars: [7] }).entries.map(row => row.championId)).toEqual([2]);
    expect(filterRosterWithFacets(index, { ...eligible, stars: [6, 7] }).entries.map(row => row.championId)).toEqual([2]);
    expect(filterRosterWithFacets(index, eligible).counts.stars).toEqual({ 7: 1 });
  });

  it("checks each owned copy at its actual star, independently of current ascension and other filters", () => {
    const hulk = withChampionAscensionEligibility({ ...champion(1, { tags: ["Hero"] }), gameId: "hulk" });
    const gwenom = withChampionAscensionEligibility({ ...champion(2, { class: "COSMIC" }), gameId: "gwenom" });
    const unknown = withChampionAscensionEligibility({ ...champion(3), gameId: "unknown" });
    const rows = [owned(hulk, 6, 4, 1), owned(hulk, 7, 4, 2), owned(gwenom, 7, 4, 2), owned(unknown, 7, 4, 2)];
    const index = createRosterFilterIndex(rows, [hulk, gwenom, unknown]);
    const eligible = { ...defaults, showUnowned: false, ascensionEligible: true };
    expect(filterRosterWithFacets(index, { ...defaults, showUnowned: false }).entries).toHaveLength(4);
    expect(filterRosterWithFacets(index, eligible).entries.map(row => row.id)).toEqual(["2-7"]);
    expect(filterRosterWithFacets(index, { ...eligible, ascension: [2] }).entries.map(row => row.id)).toEqual(["2-7"]);
    expect(filterRosterWithFacets(index, { ...eligible, ascension: [0] }).entries).toEqual([]);
    const composed = { ...eligible, stars: [6, 7], search: "CHAMPION 2", classes: ["COSMIC" as const], ranks: [4], tags: [], ascension: [2] };
    const result = filterRosterWithFacets(index, composed);
    expect(result.entries.map(row => row.id)).toEqual(["2-7"]);
    expect(result.counts.stars).toEqual({ 7: 1 });
    expect(result.counts.ascension).toEqual({ 2: 1 });
  });

  it("does not match a lower-star path even when canonical and independent of crystal sources", () => {
    expect(getChampionCrystalAscensionSources("gwenom", 6).crystals).toEqual([]);
    const gwenom = withChampionAscensionEligibility({ ...champion(1), gameId: "gwenom" });
    expect(filterRosterWithFacets(createRosterFilterIndex([], [gwenom]), { ...defaults, ascensionEligible: true, eligibilityIncludesUnowned: true, stars: [6] }).entries).toHaveLength(0);
  });

  it("does not use an eligible owned star to qualify a different missing, unsupported star", () => {
    const hulk = withChampionAscensionEligibility({ ...champion(1, { obtainable: ["6", "7"] }), gameId: "hulk" });
    const index = createRosterFilterIndex([owned(hulk, 6)], [hulk]);
    const selected = { ...defaults, stars: [6, 7] };
    expect(filterRosterWithFacets(index, selected).entries).toHaveLength(2);
    expect(filterRosterWithFacets(index, { ...selected, ascensionEligible: true }).entries).toEqual([]);
  });

  it("retains server-derived catalog eligibility when an owned response omits enrichment", () => {
    const gwenom = withChampionAscensionEligibility({ ...champion(1), gameId: "gwenom" });
    const response = { ...gwenom, ascendableRarities: undefined };
    const index = createRosterFilterIndex([owned(response, 7)], [gwenom]);
    expect(filterRosterWithFacets(index, { ...defaults, showUnowned: false, ascensionEligible: true }).entries).toHaveLength(1);
  });
  it("keeps other OR choices available and counts each champion once despite repeated effects", () => {
    const champions = [
      champion(1, { tags: ["Hero", "Avenger"], abilities: [link("Fury"), link("Fury"), link("Bleed")] }),
      champion(2, { tags: ["Hero"], abilities: [link("Fury"), link("Shock")] }),
      champion(3, { class: "COSMIC", tags: ["Villain"], abilities: [link("Shock")] }),
    ];
    const index = createRosterFilterIndex([], champions);
    const science = filterRosterWithFacets(index, { ...defaults, classes: ["SCIENCE"] });
    expect(science.entries).toHaveLength(2);
    expect(science.counts.classes).toMatchObject({ SCIENCE: 2, COSMIC: 1 });
    expect(science.counts.abilities.Fury).toBe(2);
    expect(science.counts.tags).toEqual({ Hero: 2, Avenger: 1 });
    const bothClasses = filterRosterWithFacets(index, { ...defaults, classes: ["SCIENCE", "COSMIC"] });
    expect(bothClasses.entries).toHaveLength(3);
    const all = filterRosterWithFacets(index, { ...defaults, abilities: ["Fury"] });
    expect(all.counts.abilities).toEqual({ Fury: 2, Bleed: 1, Shock: 1 });
    const any = filterRosterWithFacets(index, { ...defaults, abilities: ["Fury"], abilityLogic: "OR" });
    expect(any.counts.abilities).toEqual({ Fury: 2, Bleed: 1, Shock: 2 });
    expect(any.entries).toHaveLength(2);
  });

  it("retains AND tags, ignores OR tags, and respects all other facets and search", () => {
    const index = createRosterFilterIndex([], [
      champion(1, { tags: ["Hero", "Avenger"] }), champion(2, { tags: ["Hero"] }),
      champion(3, { tags: ["Villain"], class: "COSMIC" }),
    ]);
    expect(filterRosterWithFacets(index, { ...defaults, tags: ["Hero"] }).counts.tags).toEqual({ Hero: 2, Avenger: 1 });
    expect(filterRosterWithFacets(index, { ...defaults, tags: ["Hero"], tagLogic: "OR" }).counts.tags.Villain).toBe(1);
    expect(filterRosterWithFacets(index, { ...defaults, tags: ["Hero"], tagLogic: "OR", classes: ["SCIENCE"] }).counts.tags.Villain).toBeUndefined();
    const searched = filterRosterWithFacets(index, { ...defaults, search: "CHAMPION 3" });
    expect(searched.entries.map(entry => entry.championId)).toEqual([3]);
    expect(searched.counts.classes).toEqual({ COSMIC: 1 });
    expect(searched.counts.tags).toEqual({ Villain: 1 });
  });

  it("qualifies forms, directions and categories on the same application", () => {
    const damage = { ...link("Bleed").ability, categories: [{ name: "Damage" }] };
    const index = createRosterFilterIndex([], [
      champion(1, { abilities: [link("Bleed", { effectForm: "BUFF", effectDirection: "GAIN", ability: damage }), link("Bleed", { effectForm: "DEBUFF", effectDirection: "INFLICT", ability: damage })] }),
      champion(2, { abilities: [link("Bleed", { effectForm: "DEBUFF", effectDirection: "GAIN", ability: damage })] }),
      champion(3, { abilities: [link("Fury", { effectForm: "BUFF", effectDirection: "GAIN" })] }),
    ]);
    const filters: RosterFiltersState = { ...defaults, abilities: ["Bleed"], effectForms: ["DEBUFF"], effectDirections: ["GAIN"] };
    const result = filterRosterWithFacets(index, filters);
    expect(result.entries.map(entry => entry.championId)).toEqual([2]);
    expect(result.counts.abilities).toEqual({ Bleed: 1 });
    expect(result.counts.categories).toEqual({ Damage: 1 });
    expect(result.counts.forms).toMatchObject({ BUFF: 1, DEBUFF: 1 });
    expect(result.counts.directions).toMatchObject({ GAIN: 1, INFLICT: 1 });
    // In OR mode Fury can broaden the effect choice, but only after removing the Debuff qualifier.
    expect(filterRosterWithFacets(index, { ...filters, abilityLogic: "OR" }).counts.abilities.Fury).toBeUndefined();
    expect(filterRosterWithFacets(index, { ...filters, abilityLogic: "OR", effectForms: [] }).counts.abilities.Fury).toBe(1);
  });

  it("handles AND/OR category choices together with selected ability names", () => {
    const categoryLink = (name: string, categories: string[]) => link(name, { ability: { ...link(name).ability, categories: categories.map(name => ({ name })) } });
    const index = createRosterFilterIndex([], [
      champion(1, { abilities: [categoryLink("Fury", ["Attack"]), categoryLink("Bleed", ["Damage"])] }),
      champion(2, { abilities: [categoryLink("Fury", ["Attack", "Damage"])] }),
    ]);
    expect(filterRosterWithFacets(index, { ...defaults, abilities: ["Fury"] }).counts.categories).toEqual({ Attack: 2, Damage: 1 });
    expect(filterRosterWithFacets(index, { ...defaults, categories: ["Attack"], categoryLogic: "AND" }).counts.categories.Damage).toBe(2);
    expect(filterRosterWithFacets(index, { ...defaults, abilities: ["Fury"], categories: ["Attack"], categoryLogic: "AND" }).counts.categories.Damage).toBe(1);
  });

  it("counts only qualifying resistance targets, includes full immunities and never sums applications", () => {
    const resistance = (percent: number | null, mechanism: "POTENCY" | "DURATION" = "POTENCY") => link("Reduction", {
      resistances: [{ effect: { name: "Bleed" }, mechanism, percent }],
    });
    const index = createRosterFilterIndex([], [
      champion(1, { abilities: [link("Bleed", { type: "IMMUNITY" })] }),
      champion(2, { abilities: [resistance(80)] }), champion(3, { abilities: [resistance(100, "DURATION")] }),
      champion(4, { abilities: [resistance(40), resistance(40)] }), champion(5, { abilities: [resistance(null)] }),
    ]);
    expect(filterRosterWithFacets(index, defaults).counts.immunities.Bleed).toBe(5);
    const filters = { ...defaults, immunities: ["Bleed"], minResistancePotency: 80 };
    const qualified = filterRosterWithFacets(index, filters);
    expect(qualified.entries.map(entry => entry.championId)).toEqual([1, 2]);
    expect(qualified.counts.immunities.Bleed).toBe(2);
    expect(filterRosterWithFacets(index, { ...filters, includeResistances: false }).counts.immunities.Bleed).toBe(1);
    expect(filterRosterWithFacets(index, { ...filters, minResistancePotency: 90 }).counts.immunities.Bleed).toBe(1);
  });

  it("rebuilds missing-rarity entries for each rarity alternative and retains owned progression rules", () => {
    const first = champion(1, { obtainable: ["5", "6"] });
    const second = champion(2, { obtainable: ["7"] });
    const index = createRosterFilterIndex([owned(first, 5, 3, 1)], [first, second]);
    const initial = filterRosterWithFacets(index, defaults);
    expect(initial.entries.map(entry => entry.id)).toEqual(["1-5", "unowned-2"]);
    expect(initial.counts.stars).toEqual({ 5: 1, 6: 1, 7: 1 });
    const six = filterRosterWithFacets(index, { ...defaults, stars: [6] });
    expect(six.entries.map(entry => entry.id)).toEqual(["unowned-1-6"]);
    expect(six.counts.stars).toEqual({ 5: 1, 6: 1, 7: 1 });
    const ownedOnly = filterRosterWithFacets(index, { ...defaults, stars: [5], showUnowned: false, ranks: [3], ascension: [1] });
    expect(ownedOnly.entries).toHaveLength(1);
    expect(ownedOnly.counts.stars).toEqual({ 5: 1 });
    expect(ownedOnly.counts.ranks).toEqual({ 3: 1 });
    expect(ownedOnly.counts.ascension).toEqual({ 1: 1 });
    expect(filterRosterWithFacets(index, { ...defaults, ascension: [0] }).entries.map(entry => entry.championId)).toEqual([2]);
  });

  it("counts separate owned rarities and applies source rarity restrictions", () => {
    const first = champion(1, { abilities: [link("Fury", { source: "Synergy: Team (7\u2605) with Ally (7\u2605): Gain Fury." })] });
    const index = createRosterFilterIndex([owned(first, 6), owned(first, 7)], [first]);
    expect(filterRosterWithFacets(index, { ...defaults, showUnowned: false }).counts.classes.SCIENCE).toBe(2);
    expect(filterRosterWithFacets(index, { ...defaults, abilities: ["Fury"], showUnowned: false }).counts.stars).toEqual({ 7: 1 });
    expect(filterRosterWithFacets(index, { ...defaults, abilities: ["Fury"], showUnowned: false }).entries.map(entry => entry.stars)).toEqual([7]);
  });

  it("retains selected zero-match values without mutating filters or the roster", () => {
    const first = champion(1, { abilities: [link("Fury")] });
    const roster = [owned(first)];
    const filters = { ...defaults, abilities: ["Bleed"], categories: ["Unavailable"], showUnowned: false };
    const before = structuredClone({ roster, filters });
    const result = filterRosterWithFacets(createRosterFilterIndex(roster, [first]), filters);
    expect(result.entries).toEqual([]);
    expect(result.counts.abilities.Bleed ?? 0).toBe(0);
    expect({ roster, filters }).toEqual(before);
  });
});
