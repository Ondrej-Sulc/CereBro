import { describe, expect, it } from "vitest";
import { createRelicPrestigePlan } from "./relic-prestige-plan";
const relics = [{ id: "relic_test", type: "statcast" as const, unlockConfigurationId: "cfg",
  rarities: [{ id: "t4", stars: 4, sourceOrderIndex: 0, maxRank: 2, maxSignature: 200 },
    { id: "t5", stars: 5, sourceOrderIndex: 1, maxRank: 2, maxSignature: 200 }],
  slots: [{ index: 0, socketItemIds: ["a", "b"] }, { index: 2, socketItemIds: ["c"] }] }];
const raw = { UnlockConfigurations: { cfg: { Strategies: ["unused", "s5"] } },
  UnlockStrategies: { s5: { UnlockOrder: [0, 2], UnlockRank: [1, 2] } } };
const contexts = ["a", "b", "c"].map(socketItemId => ({ relicId: "relic_test", rarityId: "t5", socketItemId,
  maxSocketLevelByRelicRank: [{ relicRank: 1, maxSocketLevel: 10 }, { relicRank: 2, maxSocketLevel: 20 }] }));
describe("relic prestige source plan", () => {
  it("uses rarity source order, unlock ranks, and source rune limits; excludes low-star Statcasts", () => {
    expect(createRelicPrestigePlan(relics, raw, contexts)).toEqual([{ relicId: "relic_test", rarityId: "t5", maxSignature: 200,
      ranks: [{ rank: 1, socketRanks: { "0": 10 } }, { rank: 2, socketRanks: { "0": 20, "2": 20 } }] }]);
  });
  it("refuses conflicting alternative rune limits", () => {
    const changed = structuredClone(contexts);
    changed[1].maxSocketLevelByRelicRank[0].maxSocketLevel = 11;
    expect(() => createRelicPrestigePlan(relics, raw, changed)).toThrow(/limits/);
  });
  it("refuses missing scaling and unknown unlocked positions", () => {
    expect(() => createRelicPrestigePlan(relics, raw, contexts.slice(1))).toThrow(/scaling/);
    const changed = structuredClone(raw); changed.UnlockStrategies.s5.UnlockOrder[1] = 4;
    expect(() => createRelicPrestigePlan(relics, changed, contexts)).toThrow(/position/);
  });
});
