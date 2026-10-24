import { describe, expect, it } from "vitest";
import type { AllianceRosterEntry } from "@/app/actions/alliance-roster";
import { createAllianceRosterFilters, createAllianceRosterFilterIndex, filterAllianceRosterWithFacets, allianceRosterOptions } from "./alliance-roster-filter";

type AllianceEffect = AllianceRosterEntry["champion"]["abilities"][number];
const effect = (name: string, extra: Partial<AllianceEffect> = {}): AllianceEffect => ({
  id: 1, type: "ABILITY", source: null, synergyChampions: [],
  ability: { name, iconUrl: null, description: null, gameGlossaryTermId: null, gameGlossaryTerm: null, categories: [] }, ...extra,
});
const entry = (id: string, extra: Partial<AllianceRosterEntry> = {}): AllianceRosterEntry => ({
  id, playerId: "one", championId: Number(id), ingameName: "Player One", battlegroup: 1, avatar: null,
  stars: 7, rank: 4, sigLevel: 200, isAwakened: true, isAscended: false, ascensionLevel: 0, tactics: { attack: false, defense: false },
  champion: { id: Number(id), name: `Champion ${id}`, slug: `champion-${id}`, class: "SCIENCE", tags: [], abilities: [],
    images: { hero: "", full_primary: "", full_secondary: "", p_32: "", s_32: "", p_64: "", s_64: "", p_128: "", s_128: "" } }, ...extra,
});

describe("shared alliance roster filtering", () => {
  it("scopes facets by battlegroup and applies each player limit after matching and counting", () => {
    const rows = [entry("1"), entry("2", { stars: 6 }), entry("3", { playerId: "two" }), entry("4", { playerId: "three", battlegroup: 2 }), entry("5", { playerId: "four", battlegroup: null })];
    const index = createAllianceRosterFilterIndex(rows);
    const result = filterAllianceRosterWithFacets(index, createAllianceRosterFilters(), "1", 1);
    expect(result.entries.map(row => row.id)).toEqual(["1", "2", "3"]);
    expect(result.counts.stars).toEqual({ 7: 2, 6: 1 });
    expect([...result.championsByPlayer.values()].flat().map(row => row.id)).toEqual(["1", "3"]);
    expect(result.matchingByPlayer.get("one")).toBe(2);
    expect(filterAllianceRosterWithFacets(index, createAllianceRosterFilters(), "UNASSIGNED", null).entries.map(row => row.id)).toEqual(["5"]);
    expect(filterAllianceRosterWithFacets(index, createAllianceRosterFilters(), "ALL", null).entries).toHaveLength(5);
  });

  it("combines search, multi-rarity, rank, class, tags and legacy ascension", () => {
    const legacy = entry("1", { isAscended: true });
    legacy.champion.tags = [{ id: "hero", name: "Hero" }];
    const rows = [legacy, entry("2", { stars: 6, isAscended: true, ascensionLevel: 1 }), entry("3")];
    const filters = { ...createAllianceRosterFilters(), search: "CHAMPION", stars: [6, 7], ranks: [4], classes: ["SCIENCE" as const], ascension: [1], tags: ["Hero"] };
    expect(filterAllianceRosterWithFacets(createAllianceRosterFilterIndex(rows), filters, "ALL", null).entries.map(row => row.id)).toEqual(["1"]);
    expect(filterAllianceRosterWithFacets(createAllianceRosterFilterIndex(rows), { ...filters, tags: [] }, "ALL", null).entries.map(row => row.id)).toEqual(["1", "2"]);
  });

  it("uses same-application forms and directions and includes qualifying protections by default", () => {
    const rows = [entry("1"), entry("2"), entry("3"), entry("4")];
    rows[0].champion.abilities = [effect("Bleed", { effectForm: "DEBUFF", effectDirection: "INFLICT" }), effect("Resistance", { resistances: [{ mechanism: "POTENCY", percent: 80, effect: effect("Bleed").ability }] })];
    rows[1].champion.abilities = [effect("Bleed", { effectForm: "DEBUFF", effectDirection: "GAIN" }), effect("Bleed", { effectForm: "PASSIVE", effectDirection: "INFLICT" }), effect("Bleed", { type: "IMMUNITY" })];
    rows[2].champion.abilities = [effect("Resistance", { resistances: [{ mechanism: "DURATION", percent: 100, effect: effect("Bleed").ability }] })];
    rows[3].champion.abilities = [effect("Resistance", { resistances: [{ mechanism: "POTENCY", percent: null, effect: effect("Bleed").ability }] })];
    const index = createAllianceRosterFilterIndex(rows);
    const protections = { ...createAllianceRosterFilters(), immunities: ["Bleed"] };
    expect(filterAllianceRosterWithFacets(index, protections, "ALL", null).entries).toHaveLength(4);
    expect(filterAllianceRosterWithFacets(index, { ...protections, minResistancePotency: 80 }, "ALL", null).entries.map(row => row.id)).toEqual(["1", "2"]);
    expect(filterAllianceRosterWithFacets(index, { ...protections, includeResistances: false }, "ALL", null).entries.map(row => row.id)).toEqual(["2"]);
    const applications = { ...createAllianceRosterFilters(), abilities: ["Bleed"], effectForms: ["DEBUFF" as const], effectDirections: ["INFLICT" as const] };
    expect(filterAllianceRosterWithFacets(index, applications, "ALL", null).entries.map(row => row.id)).toEqual(["1"]);
  });

  it("keeps OR alternatives available and counts the same champion on different players separately", () => {
    const science = entry("1");
    const cosmic = entry("2");
    cosmic.champion.class = "COSMIC";
    const otherOwner = { ...science, id: "other-owner", playerId: "two" };
    const original = structuredClone([science, cosmic, otherOwner]);
    const result = filterAllianceRosterWithFacets(createAllianceRosterFilterIndex([science, cosmic, otherOwner]), { ...createAllianceRosterFilters(), classes: ["SCIENCE"] }, "ALL", 1);
    expect(result.entries).toHaveLength(2);
    expect(result.counts.classes).toEqual({ SCIENCE: 2, COSMIC: 1 });
    expect([science, cosmic, otherOwner]).toEqual(original);
  });

  it("uses shared effect icons and resistance target options across the alliance", () => {
    const row = entry("1");
    row.champion.abilities = [effect("Bleed", { ability: { ...effect("Bleed").ability, iconUrl: "bleed.svg" } }), effect("Resistance", { resistances: [{ mechanism: "POTENCY", percent: 80, effect: { ...effect("Shock").ability, iconUrl: "shock.svg" } }] })];
    const options = allianceRosterOptions([row, { ...row, id: "duplicate-owner", playerId: "two" }]);
    expect(options.abilities).toMatchObject([{ name: "Bleed", iconUrl: "bleed.svg" }]);
    expect(options.immunities).toMatchObject([{ name: "Shock", iconUrl: "shock.svg", resistanceOnly: true }]);
  });
});
