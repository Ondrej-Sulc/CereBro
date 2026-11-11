import { expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { CapturedTowerBlock } from "../../domain/game-quests/tower-data";
import { loadTowerBlock, towerBackendIndex, towerBlockLoaders } from "../../data/game-quests/tower-backend";

it("exposes every configured Class block without claiming current player access", () => {
  expect(towerBackendIndex.coverage).toMatchObject({ towers: 6, blocks: 882, floors: 9636,
    configuredClassDefinitionsComplete: true, currentPlayerAccessEstablished: false });
  expect(Object.keys(towerBlockLoaders).sort()).toEqual(Object.keys(towerBackendIndex.blocks).sort());
  for (const tower of Object.keys(towerBackendIndex.coverage.perTowerFloors)) {
    const blocks = Object.values(towerBackendIndex.blocks).filter(b => b.towerId === tower);
    expect(blocks.map(b => b.blockNumber).sort((a, b) => a - b)).toEqual(Array.from({ length: 147 }, (_, i) => i + 1));
    expect(blocks.reduce((sum, b) => sum + b.floors, 0)).toBe(1606);
  }
});

it("loads source-matched high blocks and preserves enemy ascension independently of player builds", async () => {
  const [hundred, last] = await Promise.all([loadTowerBlock("class_skill", 100), loadTowerBlock("class_skill", 147)]);
  expect(hundred?.floors).toHaveLength(20);
  expect(last?.floors).toHaveLength(20);
  expect(last?.floors[0].defender).toMatchObject({ blueprint: "shehulk_t7", gameId: "shehulk", rarity: 7, ascensionTier: 11 });
  for (const block of [hundred!, last!]) {
    expect(block.coverage.currentAccessOrEligibilityEstablished).toBe(false);
    expect(block.floors.map(f => f.floorNumber)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(block.source.captureSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(block)).not.toMatch(/"stoken"|"userFloors"|"skipData"|"Balance"/);
  }
});

it("never turns an invalid selection into an arbitrary file import", async () => {
  expect(await loadTowerBlock("class_skill", 148)).toBeUndefined();
  expect(await loadTowerBlock("class_skill", 1.5)).toBeUndefined();
  expect(await loadTowerBlock("../../other", 100)).toBeUndefined();
});

it("verifies every published block hash, floor identity and public-data boundary", async () => {
  const root = new URL("../../data/game-quests/tower-backend/", import.meta.url);
  let floorCount = 0;
  for (const [id, entry] of Object.entries(towerBackendIndex.blocks)) {
    expect(entry.path).toMatch(/^blocks\/class_(cosmic|mutant|mystic|science|skill|tech)-\d{3}\.json$/);
    const bytes = await readFile(new URL(entry.path, root));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(entry.sha256);
    expect(bytes.byteLength).toBe(entry.bytes);
    const text = bytes.toString("utf8");
    const block = JSON.parse(text) as CapturedTowerBlock;
    expect(block.id).toBe(id);
    expect(block.source.captureSha256).toBe(entry.captureSha256);
    expect(block.floors.map(f => f.floorNumber)).toEqual(Array.from({ length: entry.floors }, (_, i) => i + 1));
    for (const floor of block.floors) {
      expect(floor.sourceData.towerId).toBe(block.towerId);
      expect(Number(floor.sourceData.blockId)).toBe(block.blockNumber);
      expect(Number(floor.sourceData.id)).toBe(floor.floorNumber);
      expect(floor.defender?.gameId).toBeTruthy();
    }
    expect(text).not.toMatch(/"(?:stoken|session|userFloors|skipData|Balance|uid)"\s*:/i);
    floorCount += block.floors.length;
  }
  expect(floorCount).toBe(9636);
});
