import { describe, expect, it } from "vitest";
import { getObtainableChampionStats } from "./champion-obtainable";

describe("obtainable champion stats for champion details", () => {
  it("defaults Wasp to her highest obtainable rarity even when 7-star templates exist", () => {
    const wasp = {
      obtainable: ["2", "3", "4", "5", "6"],
      stats: [
        { rarity: 7, rank: 6, attack: 9000 },
        { rarity: 7, rank: 1, attack: 4000 },
        { rarity: 6, rank: 5, attack: 5000 },
        { rarity: 6, rank: 4, attack: 4000 },
        { rarity: 5, rank: 5, attack: 3000 },
        { rarity: null, rank: 1, attack: 1000 },
      ],
    };
    const stats = getObtainableChampionStats(wasp);
    expect(stats).toEqual(wasp.stats.slice(2, 5));
    expect(stats[0]).toMatchObject({ rarity: 6, rank: 5 });
  });

  it("preserves 7-star stats for champions obtainable at that rarity", () => {
    const stats = [{ rarity: 7, rank: 6 }, { rarity: 6, rank: 5 }];
    expect(getObtainableChampionStats({ obtainable: ["6", "7"], stats })).toEqual(stats);
  });

  it("uses the catalog's supported rarity formats", () => {
    const stats = [{ rarity: 7 }, { rarity: 6 }, { rarity: 5 }, { rarity: 4 }];
    expect(getObtainableChampionStats({ obtainable: [" 6-star ", "5*"], stats })).toEqual(stats.slice(1, 3));
  });

  it("does not offer unavailable templates when obtainable stats are missing", () => {
    expect(getObtainableChampionStats({ obtainable: ["6"], stats: [{ rarity: 7 }] })).toEqual([]);
    expect(getObtainableChampionStats({ obtainable: [], stats: [{ rarity: 6 }] })).toEqual([]);
  });
});
