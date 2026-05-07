import { describe, expect, it } from "vitest";
import {
  expandMcocPrestigeCurve,
  maxAscensionLevelForRarity,
  maxSigForRarity,
  projectMcocPrestige,
  projectMcocPrestigeFromCurve,
} from "./mcoc-prestige";

const sevenStarRankThree = {
  rarity: 7,
  rank: 3,
  prestige: 22000,
};

const endpoints = [
  { rarity: 7, rank: 3, sig: 0, prestige: 22000 },
  { rarity: 7, rank: 3, sig: 1, prestige: 22100 },
  { rarity: 7, rank: 3, sig: 200, prestige: 26000 },
];

describe("MCOC Prestige Projection", () => {
  it("owns max signature and ascension caps by rarity", () => {
    expect(maxSigForRarity(4)).toBe(99);
    expect(maxSigForRarity(5)).toBe(200);
    expect(maxSigForRarity(7)).toBe(200);

    expect(maxAscensionLevelForRarity(6)).toBe(0);
    expect(maxAscensionLevelForRarity(7)).toBe(5);
  });

  it("projects game-display prestige with additive 7-star ascension scaling from base", () => {
    expect(projectMcocPrestige({
      prestigeData: endpoints,
      stat: sevenStarRankThree,
      sigLevel: 0,
      ascensionLevel: 0,
    })).toBe(22000);

    expect(projectMcocPrestige({
      prestigeData: endpoints,
      stat: sevenStarRankThree,
      sigLevel: 0,
      ascensionLevel: 1,
    })).toBe(23760);

    expect(projectMcocPrestige({
      prestigeData: endpoints,
      stat: sevenStarRankThree,
      sigLevel: 0,
      ascensionLevel: 2,
    })).toBe(25520);

    expect(projectMcocPrestige({
      prestigeData: endpoints,
      stat: sevenStarRankThree,
      sigLevel: 0,
      ascensionLevel: 5,
    })).toBe(30800);
  });

  it("expands chart curves through the same projection rules", () => {
    const curve = expandMcocPrestigeCurve({
      prestigeData: endpoints,
      stat: sevenStarRankThree,
    });

    expect(curve).toHaveLength(201);
    expect(curve[0]).toEqual({ sig: 0, prestige: 22000 });
    expect(curve[1]).toEqual({ sig: 1, prestige: 22100 });
    expect(curve[200]).toEqual({ sig: 200, prestige: 26000 });
    expect(projectMcocPrestigeFromCurve({
      curve,
      sigLevel: 200,
      rarity: 7,
      ascensionLevel: 5,
    })).toBe(36400);
  });
});
