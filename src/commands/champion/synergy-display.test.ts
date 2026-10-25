import { describe, expect, it } from "vitest";
import type { ChampionWithAllRelations } from "../../services/championService";
import { overviewSourceHash } from "../../domain/champion-overview-summary";
import { getImmunitiesContent } from "./immunities";
import { getAbilitiesContent } from "./abilities";
import { getChampionDetailsString } from "../search/views/common";
import { parseSearchCriteria } from "../search/utils";

const date = new Date("2026-10-20T00:00:00Z");
function champion(): ChampionWithAllRelations {
  return { id: 2, name: "Absorbing Man", shortName: "Abs", gameId: "absorbing_man", slug: "absorbing-man", class: "MYSTIC",
    releaseDate: date, createdAt: date, updatedAt: date, obtainable: ["6", "7"], images: {}, discordEmoji: null,
    fullAbilities: {}, isPlayable: true, abilities: [], tags: [], attacks: [], duels: [] };
}
function partner(id: number, name: string, discordEmoji: string | null = null) {
  return { ...champion(), id, name, slug: name.toLowerCase(), discordEmoji };
}
function source(data: ChampionWithAllRelations, id: number, raw: string, summary: string, partners: ReturnType<typeof partner>[], name = "Poison") {
  const link = { id, championId: data.id, abilityId: 3, type: "IMMUNITY" as const, source: raw,
    effectForm: "UNKNOWN" as const, effectDirection: "UNKNOWN" as const,
    ability: { id: 3, name, description: null, emoji: null, iconUrl: null, gameGlossaryTermId: null },
    synergyChampions: partners.map(champion => ({ id: champion.id, championId: champion.id, championAbilityLinkId: id, champion })),
  };
  return { ...link, overviewSummary: { text: summary, sourceHash: overviewSourceHash({ ...link, name,
    synergyChampionIds: partners.map(partner => partner.id) }) } };
}

describe("Discord synergy sources compared with the website", () => {
  it("shows partner icons without names or synergy titles, retaining activation requirements", () => {
    const data = champion();
    data.abilities = [source(data, 1,
      "Synergy: THE GREEN DOOR (6★/7★) with Abomination (Immortal) (2★/3★/4★/5★/6★/7★) OR Hulk (Immortal) (2★/3★/4★/5★/6★/7★); does not stack: Immune to Poison.",
      "This synergy grants Poison immunity; duplicate synergies do not stack.",
      [partner(4, "Abomination (Immortal)", "<:abi:1283138119918555239>"), partner(5, "Hulk (Immortal)", "<:hi:1283136378468827238>")])];
    const text = getImmunitiesContent(data, text => text);
    expect(text).not.toContain("The Green Door");
    expect(text).not.toContain("Abomination (Immortal)");
    expect(text).not.toContain("Hulk (Immortal)");
    expect(text).toContain("<:abi:1283138119918555239> (2–7★) OR <:hi:1283136378468827238> (2–7★)");
    expect(text).not.toContain("Champion 6–7★");
    expect(text).toMatch(/\bor\b/i);
    expect(text).not.toContain("Synergy: THE GREEN DOOR (");
    expect(text).not.toContain("Requires:");
    expect(text).not.toContain("2★/3★/4★/5★/6★/7★");
  });

  it("resolves the current champion's recorded protection bonus from the same catalog as the website", () => {
    const data = champion();
    const rogue = partner(4, "Rogue", "<:ru:1283132793068716072>");
    const link = source(data, 1,
      "Synergy: HANDS-ON APPROACH (4★/5★/6★/7★) with Rogue (2★/3★/4★/5★/6★); does not stack: Reduce Non-Damaging Debuff duration by 50%, excluding Stuns.",
      "This synergy shortens Non-Damaging Debuffs, excluding Stuns; duplicate synergies do not stack.", [rogue], "Debuff Resistance");
    const incoming = { ...link, type: "ABILITY" as const, effectDirection: "GAIN" as const };
    const hash = overviewSourceHash({ ...incoming, name: incoming.ability.name, synergyChampionIds: [rogue.id] });
    data.abilities = [{ ...incoming, overviewSummary: { ...link.overviewSummary, sourceHash: hash },
      resistances: [{ effectId: 8, effect: { ...link.ability, id: 8, name: "Debuffs" }, mechanism: "DURATION", percent: null,
        evidence: { version: 1, records: [] }, sourceHash: hash }],
    }];
    data.gameSynergies = [{ id: "rogue", name: "HANDS-ON APPROACH", unique: true, enabled: true, requiredHeroGroups: false,
      description: "[64acff]Absorbing Man:[-] Reduce the duration of Non-Damaging Debuffs other than Stuns by 50%.\n[64acff]Rogue:[-] Increase potency by 80%.",
      members: [...[4, 5, 6, 7].map(rarity => ({ role: "OWNER" as const, rarity, champion: data })),
        ...[2, 3, 4, 5, 6].map(rarity => ({ role: "REQUIRED" as const, rarity, champion: rogue }))],
    }];
    const text = getImmunitiesContent(data, text => text);
    expect(text).not.toContain("Hands-On Approach");
    expect(text).not.toContain("Rogue");
    expect(text).toContain("<:ru:1283132793068716072>");
    expect(text).toContain("Reduce the duration of Non-Damaging Debuffs other than Stuns by 50%.");
    expect(text).not.toContain("80%");
    expect(text).not.toContain("Champion 4–7★");
    const searchChampion = { ...data, abilities: data.abilities.map(link => ({ ...link, ability: { ...link.ability, categories: [] } })) };
    const search = getChampionDetailsString(searchChampion, parseSearchCriteria({ immunities: "Debuffs" }));
    expect(search).not.toContain("Hands-On Approach");
    expect(search).not.toContain("Rogue");
    expect(search).toContain("<:ru:1283132793068716072>");
    expect(search).toContain("by 50%.");
    expect(search).not.toContain("80%");
    expect(search).not.toContain("Champion 4–7★");
  });

  it("shares reviewed copy across synergy levels while retaining every correlated activation variant", () => {
    const data = champion();
    const scream = partner(4, "Scream", "<:scream:1283132793068716000>");
    data.abilities = [3, 4, 5].map((stars, index) => {
      const link = source(data, index + 1,
        `Synergy: BLOODY MARYS - LV. ${index + 1} (2★/3★/4★/5★/6★/7★) with Scream (${stars}★): Inflict Bleed with increased potency.`,
        "This synergy boosts Bleed potency; SP2 inflicts timed Bleed.", [scream], "Bleed");
      const incoming = { ...link, type: "ABILITY" as const, effectForm: "DEBUFF" as const, effectDirection: "INFLICT" as const };
      return { ...incoming, overviewSummary: { ...link.overviewSummary,
        sourceHash: overviewSourceHash({ ...incoming, name: "Bleed", synergyChampionIds: [scream.id] }) } };
    });
    const text = getAbilitiesContent(data, text => text);
    expect(text.match(/This synergy boosts Bleed potency; SP2 inflicts timed Bleed\./g)).toHaveLength(1);
    for (const level of [1, 2, 3]) expect(text).toContain(`Lv. ${level}`);
    for (const stars of [3, 4, 5]) expect(text).toContain(`${stars}★`);
    expect(text).not.toContain("Champion 2–7★");
    expect(text).toContain("<:scream:1283132793068716000>");
    expect(text).not.toContain("Scream");
    expect(text).not.toContain("Bloody Marys");
  });
});
