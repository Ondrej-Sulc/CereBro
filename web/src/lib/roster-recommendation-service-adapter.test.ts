import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChampionClass } from "@prisma/client";
import type { RosterPrestigeInsightRosterEntry } from "./roster-prestige-insights";

const championPrestigeFindMany = vi.fn();
const rosterFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    roster: {
      findMany: rosterFindMany,
    },
    championPrestige: {
      findMany: championPrestigeFindMany,
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
    championPrestigeFindMany.mockReset();
    rosterFindMany.mockReset();
  });

  it("loads unique champion prestige rows before calling the pure insights module", async () => {
    championPrestigeFindMany.mockResolvedValue([
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

    expect(championPrestigeFindMany).toHaveBeenCalledWith({
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

  it("normalizes query options and chooses a roster-aware default target rank", async () => {
    const { normalizeRosterPrestigeInsightOptions } = await import("./roster-recommendation-service");

    const options = normalizeRosterPrestigeInsightOptions(
      new URLSearchParams({
        sigBudget: "12",
        rankClassFilter: `${ChampionClass.COSMIC},NOT_A_CLASS`,
        sigClassFilter: ChampionClass.MUTANT,
        rankSagaFilter: "true",
        sigAwakenedOnly: "true",
        limit: "250",
      }),
      [
        { stars: 6, rank: 5 },
        { stars: 7, rank: 4 },
      ]
    );

    expect(options).toEqual({
      targetRank: 4,
      sigBudget: 12,
      rankClassFilter: [ChampionClass.COSMIC],
      sigClassFilter: [ChampionClass.MUTANT],
      rankSagaFilter: true,
      sigSagaFilter: false,
      sigAwakenedOnly: true,
      limit: 100,
    });
  });

  it("loads a player roster through the insight-specific intake", async () => {
    rosterFindMany.mockResolvedValue([
      {
        id: "r1",
        championId: 1,
        stars: 7,
        rank: 4,
        sigLevel: 1,
        ascensionLevel: 2,
        isAwakened: true,
        champion: {
          name: "Alpha",
          class: ChampionClass.COSMIC,
          images: emptyImages,
          tags: [{ name: "#Saga Champions" }],
        },
      },
    ]);
    championPrestigeFindMany.mockResolvedValue([
      { championId: 1, rarity: 7, rank: 4, sig: 0, prestige: 20000 },
      { championId: 1, rarity: 7, rank: 4, sig: 1, prestige: 20100 },
      { championId: 1, rarity: 7, rank: 4, sig: 200, prestige: 26000 },
    ]);
    const { loadPlayerRosterPrestigeInsightSnapshot } = await import("./roster-recommendation-service");

    const snapshot = await loadPlayerRosterPrestigeInsightSnapshot("player-1", new URLSearchParams({ limit: "10" }));

    expect(rosterFindMany).toHaveBeenCalledWith({
      where: { playerId: "player-1" },
      select: {
        id: true,
        championId: true,
        stars: true,
        rank: true,
        sigLevel: true,
        ascensionLevel: true,
        isAwakened: true,
        champion: {
          select: {
            name: true,
            class: true,
            images: true,
            tags: { select: { name: true } },
          },
        },
      },
      orderBy: [{ stars: "desc" }, { rank: "desc" }],
    });
    expect(snapshot.options).toMatchObject({ targetRank: 4, limit: 10 });
    expect(snapshot.insights.prestigeMap).toEqual({ r1: 23320 });
  });

  it("can hide sensitive suggestions while preserving roster prestige values", async () => {
    const { visibleRosterPrestigeInsights } = await import("./roster-recommendation-service");

    expect(visibleRosterPrestigeInsights({
      top30Average: 10000,
      prestigeMap: { r1: 10000 },
      recommendations: [{
        championId: 1,
        championName: "Alpha",
        championClass: ChampionClass.COSMIC,
        championImage: emptyImages,
        stars: 6,
        ascensionLevel: 0,
        fromRank: 1,
        toRank: 2,
        prestigeGain: 1000,
        accountGain: 100,
      }],
      sigRecommendations: [{
        championId: 1,
        championName: "Alpha",
        championClass: ChampionClass.COSMIC,
        championImage: emptyImages,
        stars: 6,
        ascensionLevel: 0,
        rank: 4,
        fromSig: 1,
        toSig: 2,
        prestigeGain: 100,
        accountGain: 10,
        prestigePerSig: 10,
      }],
    }, { includeSuggestions: false })).toEqual({
      top30Average: 10000,
      prestigeMap: { r1: 10000 },
      recommendations: [],
      sigRecommendations: [],
    });
  });
});
