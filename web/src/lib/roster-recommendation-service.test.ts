import { describe, expect, it } from "vitest";
import { ChampionClass } from "@prisma/client";
import {
  calculateRosterPrestigeInsights,
  type RosterPrestigeInsightOptions,
  type RosterPrestigeInsightRosterEntry,
  type RosterPrestigeRow,
} from "./roster-prestige-insights";

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

const defaultOptions: RosterPrestigeInsightOptions = {
  targetRank: 3,
  sigBudget: 0,
  rankClassFilter: [],
  sigClassFilter: [],
  rankSagaFilter: false,
  sigSagaFilter: false,
  limit: 5,
};

function rosterEntry({
  id,
  championId,
  name,
  rank,
  stars = 6,
  sigLevel = 0,
  championClass = ChampionClass.COSMIC,
  tags = [],
}: {
  id: string;
  championId: number;
  name: string;
  rank: number;
  stars?: number;
  sigLevel?: number;
  championClass?: ChampionClass;
  tags?: string[];
}): RosterPrestigeInsightRosterEntry {
  return {
    id,
    championId,
    rank,
    stars,
    sigLevel,
    ascensionLevel: 0,
    isAwakened: sigLevel > 0,
    champion: {
      name,
      class: championClass,
      images: emptyImages,
      tags: tags.map(name => ({ name })),
    },
  };
}

function prestigeRows(championId: number, rank: number, prestige: number, rarity = 6): RosterPrestigeRow[] {
  return [{ championId, rarity, rank, sig: 0, prestige }];
}

function sigPrestigeRows(championId: number, rank: number, prestigeBySig: Record<number, number>, rarity = 6): RosterPrestigeRow[] {
  return Object.entries(prestigeBySig).map(([sig, prestige]) => ({
    championId,
    rarity,
    rank,
    sig: Number(sig),
    prestige,
  }));
}

describe("Roster Prestige Insights", () => {
  it("calculates Top 30 average and rank-up impact through a pure interface", () => {
    const roster = [
      rosterEntry({ id: "r1", championId: 1, name: "Alpha", rank: 1 }),
      rosterEntry({ id: "r2", championId: 2, name: "Bravo", rank: 5 }),
      rosterEntry({ id: "r3", championId: 3, name: "Charlie", rank: 1 }),
    ];
    const prestigeData = [
      ...prestigeRows(1, 1, 10000),
      ...prestigeRows(1, 2, 13000),
      ...prestigeRows(2, 5, 12000),
      ...prestigeRows(3, 1, 9000),
      ...prestigeRows(3, 2, 9500),
    ];

    const result = calculateRosterPrestigeInsights(roster, prestigeData, defaultOptions);

    expect(result.top30Average).toBe(10333);
    expect(result.prestigeMap).toEqual({
      r1: 10000,
      r2: 12000,
      r3: 9000,
    });
    expect(result.recommendations[0]).toMatchObject({
      championName: "Alpha",
      fromRank: 1,
      toRank: 2,
      prestigeGain: 3000,
      accountGain: 1000,
    });
  });

  it("allocates a sig budget without assuming the roster has 30 champions", () => {
    const roster = [
      rosterEntry({ id: "r1", championId: 1, name: "Alpha", rank: 4, sigLevel: 0 }),
      rosterEntry({ id: "r2", championId: 2, name: "Bravo", rank: 5, sigLevel: 0 }),
    ];
    const prestigeData: RosterPrestigeRow[] = [
      { championId: 1, rarity: 6, rank: 4, sig: 0, prestige: 10000 },
      { championId: 1, rarity: 6, rank: 4, sig: 1, prestige: 10300 },
      { championId: 1, rarity: 6, rank: 4, sig: 200, prestige: 20000 },
      { championId: 2, rarity: 6, rank: 5, sig: 0, prestige: 9000 },
    ];

    const result = calculateRosterPrestigeInsights(roster, prestigeData, {
      ...defaultOptions,
      sigBudget: 1,
    });

    expect(result.top30Average).toBe(9500);
    expect(result.sigRecommendations).toHaveLength(1);
    expect(result.sigRecommendations[0]).toMatchObject({
      championName: "Alpha",
      fromSig: 0,
      toSig: 1,
      prestigeGain: 300,
      accountGain: 150,
      prestigePerSig: 150,
    });
  });

  it("applies class, Saga, and awakened filters to user-visible suggestions", () => {
    const roster = [
      rosterEntry({ id: "r1", championId: 1, name: "Alpha", rank: 1, championClass: ChampionClass.COSMIC, tags: ["#Saga Champions"] }),
      rosterEntry({ id: "r2", championId: 2, name: "Bravo", rank: 1, championClass: ChampionClass.MUTANT }),
      rosterEntry({ id: "r3", championId: 3, name: "Charlie", rank: 4, sigLevel: 1, championClass: ChampionClass.COSMIC, tags: ["#Saga Champions"] }),
      rosterEntry({ id: "r4", championId: 4, name: "Delta", rank: 4, sigLevel: 0, championClass: ChampionClass.COSMIC, tags: ["#Saga Champions"] }),
    ];
    const prestigeData = [
      ...prestigeRows(1, 1, 10000),
      ...prestigeRows(1, 2, 13000),
      ...prestigeRows(2, 1, 11000),
      ...prestigeRows(2, 2, 15000),
      ...sigPrestigeRows(3, 4, { 0: 9000, 1: 9100, 200: 12000 }),
      ...sigPrestigeRows(4, 4, { 0: 9200, 1: 9300, 200: 12500 }),
    ];

    const result = calculateRosterPrestigeInsights(roster, prestigeData, {
      ...defaultOptions,
      rankClassFilter: [ChampionClass.COSMIC],
      sigClassFilter: [ChampionClass.COSMIC],
      rankSagaFilter: true,
      sigSagaFilter: true,
      sigAwakenedOnly: true,
    });

    expect(result.recommendations.map(item => item.championName)).toEqual(["Alpha"]);
    expect(result.sigRecommendations.map(item => item.championName)).toEqual(["Charlie"]);
  });

  it("reports account gain when a rank-up moves a champion into a full Top 30", () => {
    const roster = Array.from({ length: 30 }, (_, index) =>
      rosterEntry({
        id: `top-${index}`,
        championId: index + 1,
        name: `Top ${index}`,
        rank: 5,
      })
    );
    roster.push(rosterEntry({ id: "bench", championId: 31, name: "Bench", rank: 1 }));

    const prestigeData = roster.flatMap((entry, index) => {
      if (entry.id === "bench") {
        return [
          ...prestigeRows(entry.championId, 1, 9000),
          ...prestigeRows(entry.championId, 2, 11000),
        ];
      }
      return prestigeRows(entry.championId, entry.rank, 10000 + index);
    });

    const result = calculateRosterPrestigeInsights(roster, prestigeData, defaultOptions);

    expect(result.top30Average).toBe(10015);
    expect(result.recommendations[0]).toMatchObject({
      championName: "Bench",
      prestigeGain: 2000,
      accountGain: 33,
    });
  });

  it("reports low-rank champions with high practical max prestige as potential recommendations", () => {
    const roster = Array.from({ length: 30 }, (_, index) =>
      rosterEntry({
        id: `top-${index}`,
        championId: index + 1,
        name: `Top ${index}`,
        rank: 5,
      })
    );
    roster.push(rosterEntry({
      id: "sleeper",
      championId: 101,
      name: "Sleeper",
      stars: 7,
      rank: 1,
      sigLevel: 20,
    }));

    const prestigeData: RosterPrestigeRow[] = [
      ...roster.slice(0, 30).flatMap(entry => prestigeRows(entry.championId, entry.rank, 10000)),
      ...sigPrestigeRows(101, 1, { 0: 9000, 1: 9100, 200: 10000 }, 7),
      ...sigPrestigeRows(101, 4, { 0: 16000, 1: 16100, 200: 25000 }, 7),
    ];

    const result = calculateRosterPrestigeInsights(roster, prestigeData, {
      ...defaultOptions,
      targetRank: 4,
    });

    expect(result.top30Average).toBe(10000);
    expect(result.potentialRecommendations[0]).toMatchObject({
      championName: "Sleeper",
      fromRank: 1,
      toRank: 4,
      fromSig: 20,
      toSig: 200,
      targetPrestige: 25000,
      accountGain: 500,
    });
    expect(result.potentialRecommendations[0].prestigeGain).toBe(
      result.potentialRecommendations[0].targetPrestige - result.potentialRecommendations[0].currentPrestige
    );
  });

  it("uses the selected target rank for 7-star potential instead of always using rank 6", () => {
    const roster = [
      rosterEntry({ id: "r1", championId: 1, name: "Alpha", stars: 7, rank: 1 }),
    ];
    const prestigeData = [
      ...sigPrestigeRows(1, 1, { 0: 9000, 1: 9100, 200: 10000 }, 7),
      ...sigPrestigeRows(1, 4, { 0: 16000, 1: 16100, 200: 20000 }, 7),
      ...sigPrestigeRows(1, 6, { 0: 24000, 1: 24100, 200: 30000 }, 7),
    ];

    const result = calculateRosterPrestigeInsights(roster, prestigeData, {
      ...defaultOptions,
      targetRank: 4,
    });

    expect(result.potentialRecommendations[0]).toMatchObject({
      championName: "Alpha",
      fromRank: 1,
      toRank: 4,
      targetPrestige: 20000,
    });
  });

  it("does not reduce a 7-star current rank when target rank is lower", () => {
    const roster = [
      rosterEntry({ id: "r1", championId: 1, name: "Alpha", stars: 7, rank: 5 }),
    ];
    const prestigeData = [
      ...sigPrestigeRows(1, 4, { 0: 16000, 1: 16100, 200: 20000 }, 7),
      ...sigPrestigeRows(1, 5, { 0: 19000, 1: 19100, 200: 24000 }, 7),
    ];

    const result = calculateRosterPrestigeInsights(roster, prestigeData, {
      ...defaultOptions,
      targetRank: 4,
    });

    expect(result.potentialRecommendations[0]).toMatchObject({
      championName: "Alpha",
      fromRank: 5,
      toRank: 5,
      targetPrestige: 24000,
    });
  });

  it("applies rank class and Saga filters to potential recommendations", () => {
    const roster = [
      rosterEntry({ id: "r1", championId: 1, name: "Alpha", rank: 1, championClass: ChampionClass.COSMIC, tags: ["#Saga Champions"] }),
      rosterEntry({ id: "r2", championId: 2, name: "Bravo", rank: 1, championClass: ChampionClass.MUTANT, tags: ["#Saga Champions"] }),
      rosterEntry({ id: "r3", championId: 3, name: "Charlie", rank: 1, championClass: ChampionClass.COSMIC }),
    ];
    const prestigeData = roster.flatMap(entry => [
      ...prestigeRows(entry.championId, 1, 9000),
      ...sigPrestigeRows(entry.championId, 5, { 0: 12000, 1: 12100, 200: 16000 }),
    ]);

    const result = calculateRosterPrestigeInsights(roster, prestigeData, {
      ...defaultOptions,
      rankClassFilter: [ChampionClass.COSMIC],
      rankSagaFilter: true,
    });

    expect(result.potentialRecommendations.map(item => item.championName)).toEqual(["Alpha"]);
  });
});
