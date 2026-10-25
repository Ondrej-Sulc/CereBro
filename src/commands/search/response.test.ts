import { describe, expect, it, vi } from "vitest";
import { Client, ComponentType, ContainerBuilder } from "discord.js";
import type { ChampionWithRelations, RosterEntryWithChampionRelations } from "../../types/search";
import type { CommandResult } from "../../types/command";
import { generateChampionResponse } from "./views/championView";
import { generateRosterResponse } from "./views/rosterView";
import { getChampionDisplayLength, getRosterEntryDisplayLength, getSearchPageLimit } from "./views/common";
import { parseSearchCriteria } from "./utils";
import { paginate } from "./pagination";
import { command } from "./index";

vi.mock("../../utils/buttonHandlerRegistry", () => ({ registerButtonHandler: vi.fn() }));

const date = new Date("2026-10-20T00:00:00Z");
function champion(id: number): ChampionWithRelations {
  return { id, name: `Example ${id}`, slug: `example-${id}`, shortName: "EX", gameId: `example${id}`, class: "MUTANT",
    releaseDate: date, createdAt: date, updatedAt: date, obtainable: ["6"], images: {}, discordEmoji: null,
    fullAbilities: {}, isPlayable: true, tags: [], attacks: [], abilities: [],
    effects: Array.from({ length: 15 }, (_, index) => ({ id: index, championId: id, type: "RESISTANCE",
      source: "During Special Attack 1, preserve the conditional protection and its lifetime. ".repeat(8),
      effectForm: "PASSIVE", effectDirection: "UNKNOWN", ability: { id: 3, name: "Bleed" },
      synergyChampions: [], overviewSummary: null, resistance: { mechanism: "POTENCY", percent: index * 10 },
    })),
  };
}
function readText(result: CommandResult): string {
  const container = (result.components as ContainerBuilder[])[0].toJSON();
  return container.components.flatMap(component => component.type === ComponentType.TextDisplay ? [component.content] : []).join("");
}

describe("Discord search responses", () => {
  it("serializes both command schemas with the new source and protection options", () => {
    const data = command.data.toJSON();
    expect(data.options).toHaveLength(2);
    for (const option of data.options ?? []) {
      expect("options" in option && option.options?.map(item => item.name)).toEqual(expect.arrayContaining([
        "effect-form", "effect-direction", "include-resistances", "min-resistance",
      ]));
    }
  });

  it("keeps enriched global results within the full message budget, including a long criteria header", async () => {
    const criteria = { immunities: "Bleed", tags: "Tag ".repeat(500), minResistance: 0 };
    const parsed = parseSearchCriteria(criteria);
    const champions = Array.from({ length: 6 }, (_, index) => champion(index));
    const pages = paginate(champions, item => getChampionDisplayLength(item, parsed), getSearchPageLimit(criteria, champions.length));
    expect(pages.every(page => page.length > 0)).toBe(true);
    expect(pages.flat()).toEqual(champions);
    for (const [index, page] of pages.entries()) {
      const text = readText(await generateChampionResponse(new Client({ intents: [] }), null, page, criteria,
        champions.length, index + 1, pages.length, "search"));
      expect(text.length).toBeLessThanOrEqual(4000);
      expect(text).toContain("Resistances");
      expect(text).toContain("Full sources:");
    }
  });

  it("keeps enriched roster results and their build labels within the same budget", async () => {
    const criteria = { immunities: "Bleed", includeResistances: true };
    const parsed = parseSearchCriteria(criteria);
    const entries: RosterEntryWithChampionRelations[] = Array.from({ length: 6 }, (_, index) => ({
      id: String(index), playerId: "player", championId: index, champion: champion(index), stars: 6, rank: 5,
      sigLevel: 200, isAwakened: true, isAscended: false, ascensionLevel: 0, powerRating: null,
      reservedForAttack: false, createdAt: date, updatedAt: date,
    }));
    const pages = paginate(entries, item => getRosterEntryDisplayLength(item, parsed), getSearchPageLimit(criteria, entries.length, true));
    for (const [index, page] of pages.entries()) {
      const text = readText(await generateRosterResponse(new Client({ intents: [] }), null, page, criteria,
        entries.length, index + 1, pages.length, "search"));
      expect(text.length).toBeLessThanOrEqual(4000);
      expect(text).toContain("6* R5");
    }
  });
});
