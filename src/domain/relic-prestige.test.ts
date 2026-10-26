import { describe, expect, it } from "vitest";
import {
  parseRelicPrestigeRanks,
  relicPrestigeAtBuild,
  selectRelicPrestigeBuild,
} from "./relic-prestige";

const bounds = { maxRank: 2, maxSignature: 3 };
const ranks = [
  { rank: 1, socketRanks: { "0": 10, "1": 10 }, prestigeBySignature: [200, 223, 225, 228] },
  { rank: 2, socketRanks: { "0": 20, "1": 20 }, prestigeBySignature: [400, 451, 456, 460] },
];

describe("captured relic prestige", () => {
  it("looks up every signature exactly, including the awakening jump", () => {
    const table = parseRelicPrestigeRanks(ranks, bounds);
    expect([0, 1, 2, 3].map(sig => relicPrestigeAtBuild(table, 1, sig))).toEqual([200, 223, 225, 228]);
    expect(relicPrestigeAtBuild(table, 2, 2)).toBe(456);
  });

  it.each([
    [ranks[0]],
    [ranks[0], ranks[0]],
    [ranks[0], { ...ranks[1], prestigeBySignature: [400, 460] }],
    [ranks[0], { ...ranks[1], prestigeBySignature: [400, 451, 456, 460.5] }],
    [ranks[0], { ...ranks[1], socketRanks: { "0": -1 } }],
  ])("rejects incomplete, duplicate or invalid captured builds: %j", (...rows) => {
    expect(() => parseRelicPrestigeRanks(rows, bounds)).toThrow();
  });

  it("never estimates missing or invalid values", () => {
    expect(relicPrestigeAtBuild(ranks, 3, 0)).toBeNull();
    expect(relicPrestigeAtBuild(ranks, 1, 4)).toBeNull();
    expect(relicPrestigeAtBuild(ranks, 1, 1.5)).toBeNull();
    expect(relicPrestigeAtBuild(ranks, 1, -1)).toBeNull();
    expect(relicPrestigeAtBuild([], 1, 1)).toBeNull();
  });

  it("preserves valid build URLs, uses max defaults and clamps on rarity changes", () => {
    expect(selectRelicPrestigeBuild(bounds, null, null)).toEqual({ rank: 2, signature: 3 });
    expect(selectRelicPrestigeBuild(bounds, "1", "0")).toEqual({ rank: 1, signature: 0 });
    expect(selectRelicPrestigeBuild(bounds, "5", "200")).toEqual({ rank: 2, signature: 3 });
    expect(selectRelicPrestigeBuild(bounds, "-1", "1.5")).toEqual({ rank: 2, signature: 3 });
    expect(selectRelicPrestigeBuild(bounds, "", "no")).toEqual({ rank: 2, signature: 3 });
  });
});
