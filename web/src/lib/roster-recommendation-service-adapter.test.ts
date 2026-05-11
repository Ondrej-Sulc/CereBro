import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChampionClass } from "@prisma/client";
import type { RosterPrestigeInsightRosterEntry } from "./roster-prestige-insights";

const findMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    championPrestige: {
      findMany,
    },
  },
}));

const emptyImages = {
  hero: "",
  full_primary: "",
  full_secondary: "",
  p_32: "",
  s_32: "",
  p_64: "",
  s_64: "",
  p_128: "",
  s_128: "",
};

function rosterEntry(id: string, championId: number): RosterPrestigeInsightRosterEntry {
  return {
    id,
    championId,
    stars: 6,
    rank: 1,
    sigLevel: 0,
    ascensionLevel: 0,
    isAwakened: false,
    champion: {
      name: `Champion ${championId}`,
      class: ChampionClass.COSMIC,
      images: emptyImages,
      tags: [],
    },
  };
}

describe("Roster Prestige Insights adapter", () => {
  beforeEach(() => {
    findMany.mockReset();
  });

  it("loads unique champion prestige rows before calling the pure insights module", async () => {
    findMany.mockResolvedValue([
      { championId: 1, rarity: 6, rank: 1, sig: 0, prestige: 10000 },
      { championId: 2, rarity: 6, rank: 1, sig: 0, prestige: 12000 },
    ]);
    const { loadRosterPrestigeInsights } = await import("./roster-recommendation-service");

    const result = await loadRosterPrestigeInsights(
      [rosterEntry("r1", 1), rosterEntry("r2", 1), rosterEntry("r3", 2)],
      {
        targetRank: 3,
        sigBudget: 0,
        rankClassFilter: [],
        sigClassFilter: [],
        rankSagaFilter: false,
        sigSagaFilter: false,
        limit: 5,
      }
    );

    expect(findMany).toHaveBeenCalledWith({
      where: { championId: { in: [1, 2] } },
      select: { championId: true, rarity: true, rank: true, sig: true, prestige: true },
    });
    expect(result.prestigeMap).toEqual({
      r1: 10000,
      r2: 10000,
      r3: 12000,
    });
    expect(result.top30Average).toBe(10667);
  });
});
