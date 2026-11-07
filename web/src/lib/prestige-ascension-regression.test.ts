import { describe, expect, it } from "vitest";
import { ChampionClass } from "@prisma/client";
import fixture from "../../../src/tests/fixtures/champion-prestige-ascension.json";
import { getChampionAscension } from "@cerebro/core/data/game-ascension";
import { normalizeRosterAscensionState } from "@cerebro/core/domain/roster-ascension-state";
import {
  createMcocPrestigeProjector, expandMcocPrestigeCurve,
  projectMcocPrestige, projectMcocPrestigeFromCurve,
} from "./mcoc-prestige";
import { calculateRosterPrestigeInsights, type RosterPrestigeInsightRosterEntry } from "./roster-prestige-insights";
import { buildGlobalPrestigeList } from "./global-prestige-list";

const stat = { rarity: fixture.rarity, rank: fixture.rank, prestige: fixture.baseEndpoints[0].prestige };
const rows = fixture.baseEndpoints.map(row => ({ ...row, championId: 1 }));
const options = { targetRank: 4, sigBudget: 0, rankClassFilter: [], sigClassFilter: [], rankSagaFilter: false, sigSagaFilter: false };
const images = { hero: "", full_primary: "", full_secondary: "", p_32: "", s_32: "", p_64: "", s_64: "", p_128: "", s_128: "" };
const champion = { name: "Infamous Iron Man", class: ChampionClass.TECH, images, tags: [] };
const owned = (id: string, ascensionLevel: number): RosterPrestigeInsightRosterEntry => ({
  id, championId: 1, stars: 7, rank: 4, sigLevel: 200, ascensionLevel, champion,
});

describe("7-star prestige ascension gameplay regression", () => {
  it("matches the confirmed Infamous Iron Man 7R4 S200 A2 observation at all production projection seams", () => {
    const curve = expandMcocPrestigeCurve({ prestigeData: rows, stat });
    const projector = createMcocPrestigeProjector(rows);
    for (const [ascensionLevel, prestige] of [[0, 34060], [1, 36780], [2, fixture.observation.prestige]]) {
      expect(projectMcocPrestige({ prestigeData: rows, stat, sigLevel: 200, ascensionLevel })).toBe(prestige);
      expect(projectMcocPrestigeFromCurve({ curve, rarity: 7, sigLevel: 200, ascensionLevel })).toBe(prestige);
      expect(projector.project({ championId: 1, rarity: 7, rank: 4, sigLevel: 200, ascensionLevel })).toBe(prestige);
    }
    // Reusing the base curve/endpoints must never compound already projected values.
    expect(curve[200]).toEqual({ sig: 200, prestige: 34060 });
    expect(rows[2].prestige).toBe(34060);
    expect(projector.project({ championId: 1, rarity: 7, rank: 4, sigLevel: 200, ascensionLevel: 2 })).toBe(39730);
  });

  it("uses the selected signature/rank before applying ascension once", () => {
    const curve = expandMcocPrestigeCurve({ prestigeData: rows, stat });
    const projector = createMcocPrestigeProjector(rows);
    // Only sig200 A2 is an independent ascended observation; other points check the projection contract.
    expect(projectMcocPrestige({ prestigeData: rows, stat, sigLevel: 0, ascensionLevel: 2 })).toBe(29580);
    expect(projectMcocPrestige({ prestigeData: rows, stat, sigLevel: 1, ascensionLevel: 2 })).toBe(30260);
    for (const sigLevel of [0, 1, 2, 99, 199, 200]) {
      const direct = projectMcocPrestige({ prestigeData: rows, stat, sigLevel, ascensionLevel: 2 });
      expect(projectMcocPrestigeFromCurve({ curve, rarity: 7, sigLevel, ascensionLevel: 2 })).toBe(direct);
      expect(projector.project({ championId: 1, rarity: 7, rank: 4, sigLevel, ascensionLevel: 2 })).toBe(direct);
    }
    expect(projector.project({ championId: 1, rarity: 7, rank: 3, sigLevel: 200, ascensionLevel: 2 })).toBe(0);
  });

  it.each([[10000, 11660], [11030, 12870], [34060, 39730]])(
    "retains one final nearest-ten rounding for base %i (boundary contract, not an additional game observation)",
    (prestige, expected) => {
      expect(projectMcocPrestige({ prestigeData: [], stat: { ...stat, prestige }, sigLevel: 0, ascensionLevel: 2 })).toBe(expected);
    },
  );

  it("projects mixed owned/legacy/lower-star entries before calculating the account average", () => {
    const roster = [owned("a0", 0), owned("a1", 1), owned("a2", 2),
      { ...owned("legacy", 0), isAscended: true },
      { ...owned("six", 1), championId: 2, stars: 6 }];
    const result = calculateRosterPrestigeInsights(roster, [
      ...rows, { championId: 2, rarity: 6, rank: 4, sig: 0, prestige: 10000 },
    ], options);
    expect(result.prestigeMap).toEqual({ a0: 34060, a1: 36780, a2: 39730, legacy: 36780, six: 10000 });
    expect(result.top30Average).toBe(31470);
    expect(normalizeRosterAscensionState(roster[3]).ascensionLevel).toBe(1);
    expect(roster[3].ascensionLevel).toBe(0);
  });

  it("keeps exact target caps, Carina A1 and unknown/empty paths separate from owned observations", () => {
    const identities = [fixture.gameId, "carina_white", "hulk", "unknown", "magik_legacy"];
    const result = buildGlobalPrestigeList({
      champions: identities.map((gameId, index) => ({
        ...champion, id: index + 1, slug: gameId, name: gameId, obtainable: ["7*"], isPlayable: true,
        ascensionMaxLevels: { "7": getChampionAscension(gameId, 7)?.maxLevel ?? 0 },
      })),
      roster: [{ ...owned("historical", 2), championId: 3 }],
      prestigeRows: identities.flatMap((_, index) => rows.map(row => ({ ...row, championId: index + 1 }))),
      options: { rarity: 7, rank: 4, sig: 200, ascensionLevel: 5, classFilter: [], ownership: "all", sagaOnly: false, search: "", limit: 100 },
    });
    expect(result.entries.map(entry => [entry.championName, entry.targetAscensionLevel, entry.targetPrestige])).toEqual([
      [fixture.gameId, 2, 39730], ["carina_white", 1, 36780],
      ["hulk", 0, 34060], ["magik_legacy", 0, 34060], ["unknown", 0, 34060],
    ]);
    expect(result.entries.find(entry => entry.championName === "hulk")?.ownership).toMatchObject({ ascensionLevel: 2, currentPrestige: 39730 });
  });
});
