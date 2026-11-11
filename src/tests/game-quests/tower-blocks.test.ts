import { describe, expect, it } from "vitest";
import snapshot from "../../data/game-quests/tower-blocks.json";

describe("saved public Tower block observations", () => {
  it("keeps complete captured blocks separate from incomplete Tower coverage", () => {
    expect(snapshot.coverage).toMatchObject({ capturedTowers: 1, capturedBlocks: 2, capturedFloors: 20,
      completeTowerCoverage: false, currentAccessOrRewardEligibilityEstablished: false });
    expect(snapshot.blocks.map(b => [b.towerId, b.blockNumber, b.declaredFloorCount])).toEqual([
      ["class_skill", 63, 12], ["class_skill", 64, 8],
    ]);
    for (const block of snapshot.blocks) {
      expect(block.coverage.allDeclaredFloorsCaptured).toBe(true);
      expect(block.floors.map(f => f.floorNumber)).toEqual(Array.from({ length: block.declaredFloorCount }, (_, i) => i + 1));
      expect(block.floors.every(f => f.towerId === block.towerId && f.blockNumber === block.blockNumber)).toBe(true);
    }
  });

  it("retains exact defender builds, source observations and independent reward scopes", () => {
    const block = snapshot.blocks.find(b => b.blockNumber === 64)!;
    expect(block.floors[0].defender).toMatchObject({ blueprint: "ironman_silvercenturion_t7", gameId: "ironman_silvercenturion",
      stars: 7, build: { Blueprint: "ironman_silvercenturion_t7", Rank: 3, Level: 45, SigLvl: 200, AscensionTier: 0 } });
    expect(block.floors.at(-1)?.defender?.gameId).toBe("red_goblin");
    expect(block.rewards.find(r => r.Data === "7_star_hero_shard_crystal")?.Quantity).toBe(1500);
    expect(block.ratingRewards).toHaveLength(2);
    expect(block.floors.every(f => f.rewards.length === 3)).toBe(true);
    const sources = new Set(snapshot.sources.map(s => s.sha256));
    expect(sources.size).toBe(3);
    for (const entry of snapshot.blocks.flatMap(b => [b, ...b.floors])) {
      expect(entry.sourceObservationSha256s.length).toBeGreaterThan(0);
      expect(entry.sourceObservationSha256s.every(s => sources.has(s))).toBe(true);
      expect(entry.contentSha256).toMatch(/^[a-f0-9]{64}$/);
    }
    expect(JSON.stringify(snapshot)).not.toMatch(/UserFloorsData|ActiveMatchData|CurrentClientAttackerId|"Balance"|mUid/);
  });
});
