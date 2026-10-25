import { describe, expect, it } from "vitest";
import type { ChampionWithAllRelations } from "../../services/championService";
import { overviewSourceHash } from "../../domain/champion-overview-summary";
import { resistanceEvidenceHash } from "../../domain/champion-resistance-classification";
import { getAbilitiesContent } from "./abilities";
import { getImmunitiesContent } from "./immunities";
import { getOverviewContent } from "./overview";
import { getInfoContent } from "./info";

const date = new Date("2026-10-20T00:00:00Z");
const ability = { id: 1, name: "Bleed Resistance", description: null, emoji: null, iconUrl: null, gameGlossaryTermId: null };
const template = { raw: "Incoming Bleed potency is reduced by 60%." };
const link = {
  id: 1, championId: 2, abilityId: 1, type: "ABILITY" as const,
  source: "While charging a Heavy Attack, incoming Bleed potency is reduced by 60%.",
  effectForm: "PASSIVE" as const, effectDirection: "GAIN" as const,
  ability, synergyChampions: [],
};
const sourceHash = overviewSourceHash({ ...link, name: ability.name, synergyChampionIds: [] });
function champion() {
  return {
    id: 2, name: "Example", slug: "example", shortName: "EX", gameId: "example", class: "MUTANT",
    releaseDate: date, createdAt: date, updatedAt: date, obtainable: ["6"], images: {}, discordEmoji: null,
    fullAbilities: { abilities_breakdown: [{ title: "Old description", description: "Outdated text." }] },
    isPlayable: true, tags: [], attacks: [], duels: [],
    abilities: [{ ...link,
      overviewSummary: { text: "Reduces incoming Bleed potency while charging Heavy Attacks.", sourceHash },
      resistances: [{ effect: { ...ability, id: 3, name: "Bleed" }, effectId: 3, mechanism: "POTENCY" as const,
        percent: 60, sourceHash, evidence: { version: 1, records: [{ recordId: 5, templateHash: resistanceEvidenceHash(template) }] } }],
    }],
    abilityTexts: [{ id: 5, championId: 2, group: "base", title: null, sortOrder: 0, template }],
  } satisfies ChampionWithAllRelations;
}

describe("Discord champion effect content", () => {
  it("shows verified resistance under its target effect and preserves the activation condition", () => {
    const text = getImmunitiesContent(champion(), text => text);
    expect(text).toContain("Bleed");
    expect(text).toContain("60% potency reduction");
    expect(text).toContain("while charging Heavy Attacks");
    expect(getAbilitiesContent(champion(), text => text)).not.toContain("Bleed Resistance");
    expect(getOverviewContent(champion(), text => text)).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: "Immunities & resistances", content: expect.stringContaining("60% potency reduction") }),
    ]));
  });

  it.each([100, 150])("keeps %s%% reduction distinct from immunity", percent => {
    const data = champion();
    data.abilities[0].resistances[0].percent = percent;
    const text = getImmunitiesContent(data, text => text);
    expect(text).toContain(`${percent}% potency reduction`);
    expect(text).not.toMatch(/Bleed.*[—:] Immunity/);
  });

  it("rejects changed source or imported evidence rather than publishing a stale classification", () => {
    const data = champion();
    data.abilityTexts[0].template = { raw: "Changed combat text." };
    expect(getImmunitiesContent(data, text => text)).not.toContain("60% potency reduction");
    expect(getAbilitiesContent(data, text => text)).toContain("Bleed Resistance");
    data.abilities[0].source = "Changed activation condition.";
    const text = getAbilitiesContent(data, text => text);
    expect(text).toContain("Changed activation condition.");
    expect(text).not.toContain("Reduces incoming Bleed potency while charging Heavy Attacks.");
  });

  it("keeps gain and inflict applications and their partners distinct when using reviewed copy", () => {
    const data: ChampionWithAllRelations = champion();
    data.abilities = ["GAIN", "INFLICT"].map((direction, index) => {
      const source = { ...link, id: index + 10, ability: { ...ability, name: "Bleed" },
        effectDirection: direction as "GAIN" | "INFLICT", source: `Application ${index}`,
        synergyChampions: [{ id: index, championId: 9, championAbilityLinkId: index + 10,
          champion: { ...data, id: 9, name: "Required partner" } }],
      };
      return { ...source, overviewSummary: { text: "On activation.", sourceHash: overviewSourceHash({ ...source,
        name: "Bleed", synergyChampionIds: [9] }) } };
    });
    const text = getAbilitiesContent(data, text => text);
    expect(text).toContain("Gains");
    expect(text).toContain("Inflicts");
    expect(text).toContain("Passive");
    expect(text).toContain("Required partner");
    expect(text.match(/On activation\./g)).toHaveLength(2);
  });

  it("prefers imported combat text and localized sections over the old JSON and HUD help", () => {
    const data: ChampionWithAllRelations = champion();
    data.abilityTexts = [
      { id: 6, championId: 2, group: "base", title: "Bleed", sortOrder: 1, template: {
        raw: "Combat rule.", display: { kind: "ability", section: { id: "heavy", title: "Charging Heavy" } },
      } },
      { id: 7, championId: 2, group: "base", title: "Help", sortOrder: 2,
        template: { raw: "HUD glossary help.", display: { kind: "glossary" } } },
    ];
    const text = getInfoContent(data).content;
    expect(text).toContain("Charging Heavy");
    expect(text).toContain("Combat rule.");
    expect(text).not.toContain("HUD glossary help.");
    expect(text).not.toContain("Outdated text.");
  });

  it("resolves verified numeric bindings with the highest obtainable build and discloses it", () => {
    const data: ChampionWithAllRelations = champion();
    data.stats = [7, 6].map(rarity => ({ rarity, rank: 5, challengeRating: 150, attack: rarity * 1000,
      health: 20000, sigAbilityIds: [] }));
    data.abilityTexts = [{ id: 8, championId: 2, group: "base", title: "Attack", sortOrder: 1,
      template: { raw: "Deals {1} damage.", display: { kind: "ability" }, blocks: [{ type: "paragraph", children: [
        { type: "text", value: "Deals " }, { type: "value", key: "damage", placeholderIndex: 1,
          source: { kind: "abilityParam", gameBinding: { version: 1, slot: 1, value: 0.5,
            formula: { id: "attack", type: "mod_x_attk", a: 0, b: 0, c: 0 } } } },
        { type: "text", value: " damage." },
      ] }] },
    }];
    const text = getInfoContent(data).content;
    expect(text).toContain("6★ Rank 5, Sig 200");
    expect(text).toMatch(/Deals 3,?000 damage\./);
    expect(text).not.toContain("3,500");
  });
});
