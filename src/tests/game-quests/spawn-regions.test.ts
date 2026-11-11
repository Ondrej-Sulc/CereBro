import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { loadQuestSpawnRegions } from "../../data/game-quests/spawn-regions";
import { projectQuestSpawnRegions, type QuestSpawnRegionRecord } from "../../domain/game-quests/spawn-regions";
import type { QuestMap } from "../../domain/game-quests";

const map = (id: string) => JSON.parse(readFileSync(`src/data/game-quests/progressed-maps/${id}.json`, "utf8")) as QuestMap;

function fixture() {
  const source = map("realm3");
  const record: QuestSpawnRegionRecord = {
    version: 1, questId: source.questId, mapId: source.mapId, mapSourceHash: source.sourceHash,
    provenance: { geometry: "game", defenderBindings: "archived-reference" }, unmappedDefinitionCount: 1,
    regions: [{ id: "realm3:spawnzone01", anchor: [10, 2], coordinates: [[10, 2], [10, 4]],
      definitionCandidateCount: 2, defender: { tierId: "npc_abyss_thing_t6", gameId: "ex_thing", name: "EX. THING", rarity: 6,
        imageUrl: "/game-quests/unplaced-art/ac0571a625165ca5e5e016323b3e2ee65c97c2c35d1708a2457b397826f92c6a.webp",
        rank: 5, level: 65, signature: 200, ascensionTier: 0 } }],
  };
  return { source, record };
}

describe("spawn-region display layer", () => {
  it("loads all 85 representative portraits separately from native map encounters", async () => {
    for (const [id, count, missing] of [["realm3", 62, 1], ["eq_labyrinth", 23, 8]] as const) {
      const source = map(id), before = JSON.stringify(source);
      const layer = await loadQuestSpawnRegions(source);
      expect(layer?.regions).toHaveLength(count);
      expect(layer?.unmappedDefinitionCount).toBe(missing);
      expect(layer?.provenance).toEqual({ geometry: "game", defenderBindings: "archived-reference" });
      expect(JSON.stringify(source)).toBe(before);
      expect(JSON.stringify(layer)).not.toMatch(/responseSha256|sourcePointer|\.json|bossId|sourceFile|"encounters"/);
    }
  });

  it("requires the exact quest, map and source version", async () => {
    const source = map("realm3");
    for (const change of [{ questId: "other" }, { mapId: "other" }, { sourceHash: "stale" }])
      expect(await loadQuestSpawnRegions({ ...source, ...change })).toBeUndefined();
  });

  it("rejects a missing member, repeated member, off-region anchor and duplicate region", () => {
    const { source, record } = fixture();
    expect(projectQuestSpawnRegions(source, record)?.regions).toHaveLength(1);
    expect(projectQuestSpawnRegions({ ...source, tiles: source.tiles.filter(t => t.coordinate.join() !== "10,4") }, record)).toBeUndefined();
    for (const alter of [
      (r: QuestSpawnRegionRecord) => { r.regions[0].coordinates.push([10, 2]); },
      (r: QuestSpawnRegionRecord) => { r.regions[0].anchor = [0, 0]; },
      (r: QuestSpawnRegionRecord) => { r.regions.push(structuredClone(r.regions[0])); },
    ]) {
      const invalid = structuredClone(record); alter(invalid);
      expect(projectQuestSpawnRegions(source, invalid)).toBeUndefined();
    }
  });

  it("counts route intersections once per region despite repeated path member tiles", () => {
    const { source, record } = fixture();
    const projected = projectQuestSpawnRegions({ ...source, paths: [
      { index: 8, coordinates: [[10, 2], [10, 4], [10, 2]] }, { index: 2, coordinates: [[0, 0]] },
      { index: 9, coordinates: [[10, 4]] },
    ] }, record);
    expect(projected?.regions[0].pathIndices).toEqual([8, 9]);
  });

  it("projects only supported public display fields and rejects unsafe portrait bindings", () => {
    const { source, record } = fixture();
    Object.assign(record.regions[0].defender, { sourceFile: "internal-receipt.json", sourcePointer: "/private" });
    expect(JSON.stringify(projectQuestSpawnRegions(source, record))).not.toMatch(/sourceFile|sourcePointer|internal-receipt/);
    record.regions[0].defender.imageUrl = "https://unbound.example/profile.png";
    expect(projectQuestSpawnRegions(source, record)).toBeUndefined();
  });

  it("returns defensive compact copies and preserves NPC identity without champion aliases", async () => {
    const source = map("realm3");
    const first = (await loadQuestSpawnRegions(source))!;
    first.regions[0].coordinates[0][0] = 99; first.regions[0].defender.name = "changed";
    const again = (await loadQuestSpawnRegions(source))!;
    expect(again.regions[0].defender.gameId).toBe("ex_thing");
    expect(again.regions[0].defender.name).toBe("EX. THING");
    expect(again.regions[0].coordinates[0][0]).not.toBe(99);
    expect(again.regions[0].defender).not.toHaveProperty("href");
    expect(again.regions[0].defender).not.toHaveProperty("champion");
  });

  it("anchors every marker on its own visible source region and preserves route membership", async () => {
    for (const id of ["realm3", "eq_labyrinth"]) {
      const source = map(id), layer = (await loadQuestSpawnRegions(source))!;
      for (const region of layer.regions) {
        expect(region.coordinates).toContainEqual(region.anchor);
        const keys = new Set(region.coordinates.map(c => c.join()));
        expect(region.pathIndices).toEqual(source.paths.filter(p => p.coordinates.some(c => keys.has(c.join()))).map(p => p.index));
        expect(source.tiles.find(t => t.coordinate.join() === region.anchor.join())?.hidden).toBe(false);
      }
    }
  });
});
