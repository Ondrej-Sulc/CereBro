import { describe, expect, it } from "vitest";
import type { ChampionEffect } from "../../domain/champion-effects";
import { matchesChampionEffectCriteria, parseSearchCriteria } from "./utils";
import { buildSearchWhereClause } from "./queryBuilder";
import { getChampionDetailsString } from "./views/common";
import type { ChampionWithRelations } from "../../types/search";

const effect = (overrides: Partial<ChampionEffect> = {}): ChampionEffect => ({
  id: 1, championId: 2, type: "ABILITY", source: "During Special Attack 1.",
  effectForm: "DEBUFF", effectDirection: "INFLICT", ability: { id: 1, name: "Bleed", categories: [{ name: "Damage" }] },
  overviewSummary: "During Special Attack 1.", synergyChampions: [], ...overrides,
});

describe("Discord search effect matching", () => {
  it("requires form and direction on the matching ability source", () => {
    const effects = [effect({ effectDirection: "GAIN" }), effect({ effectForm: "PASSIVE" })];
    expect(matchesChampionEffectCriteria(effects, { abilities: "Bleed", effectForm: "DEBUFF", effectDirection: "INFLICT" })).toBe(false);
    expect(matchesChampionEffectCriteria(effects, { abilities: "Bleed", effectForm: "PASSIVE", effectDirection: "INFLICT" })).toBe(true);
    expect(matchesChampionEffectCriteria(effects, { abilities: "Bleed", abilityCategory: "Utility" })).toBe(false);
    expect(matchesChampionEffectCriteria([...effects, effect({ ability: { id: 3, name: "Evade", categories: [{ name: "Utility" }] } })],
      { abilities: "Bleed", abilityCategory: "Utility" })).toBe(true);
  });

  it("includes resistances by default but supports immunity-only and minimum potency searches", () => {
    const effects = [effect({ type: "RESISTANCE", effectDirection: "UNKNOWN", resistance: { mechanism: "POTENCY", percent: 60 } })];
    expect(matchesChampionEffectCriteria(effects, { immunities: "Bleed" })).toBe(true);
    expect(matchesChampionEffectCriteria(effects, { immunities: "Bleed", includeResistances: false })).toBe(false);
    expect(matchesChampionEffectCriteria(effects, { immunities: "Bleed", minResistance: 65 })).toBe(false);
    expect(matchesChampionEffectCriteria(effects, { immunities: "Bleed", minResistance: 60 })).toBe(true);
    expect(matchesChampionEffectCriteria([effect({ type: "IMMUNITY" })], { immunities: "Bleed", minResistance: 100 })).toBe(true);
    expect(matchesChampionEffectCriteria([effect({ type: "RESISTANCE", resistance: { mechanism: "DAMAGE", percent: 100 } })],
      { immunities: "Bleed", minResistance: 50 })).toBe(false);
  });

  it("preserves AND/OR behavior across immunity and resistance targets", () => {
    const effects = [effect({ type: "IMMUNITY" }), effect({ type: "RESISTANCE", ability: { id: 2, name: "Poison" } })];
    expect(matchesChampionEffectCriteria(effects, { immunities: "Bleed and Poison" })).toBe(true);
    expect(matchesChampionEffectCriteria(effects, { immunities: "Bleed and Shock" })).toBe(false);
    expect(matchesChampionEffectCriteria(effects, { immunities: "Shock or Poison" })).toBe(true);
    expect(matchesChampionEffectCriteria(effects, { abilities: "Bleed" })).toBe(false);
  });

  it("fetches resistance candidates without trusting database classifications before validation", async () => {
    const query = await buildSearchWhereClause({ immunities: "Bleed" });
    expect(JSON.stringify(query)).toContain('"resistances"');
    const strict = await buildSearchWhereClause({ immunities: "Bleed", includeResistances: false });
    expect(JSON.stringify(strict)).not.toContain('"resistances"');
  });

  it("labels the actual matching protection and preserves partners without emoji", () => {
    const data = { id: 2, name: "Example", shortName: "EX", gameId: null, obtainable: [],
      abilities: [], tags: [], attacks: [], effects: [effect({ type: "RESISTANCE",
      resistance: { mechanism: "DURATION", percent: 100 }, synergyChampions: [{ championId: 3, champion: { name: "Partner" } }],
    })] } as unknown as ChampionWithRelations;
    const text = getChampionDetailsString(data, parseSearchCriteria({ immunities: "Bleed" }));
    expect(text).toContain("Resistances");
    expect(text).toContain("100% duration reduction");
    expect(text).toContain("Partner");
    expect(text).not.toContain("*Immunities:*");
  });
});
