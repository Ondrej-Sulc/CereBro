import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyQuestDetails, type QuestDetailsLayer } from "../../domain/game-quests/quest-details";
import type { QuestMap } from "../../domain/game-quests";
import { withQuestDetails } from "../../data/game-quests/quest-details";
import raw from "../../data/game-quests/quest-details.json";
import progressed from "../../data/game-quests/progressed.json";

const source = { file: "frozen/map.json", sha256: "a".repeat(64), pointer: "/quest", capturedAt: "2026-11-09T00:00:00Z" };
const map: QuestMap = { version: 1, questId: "q", mapId: "m", sourceHash: source.sha256, sourceFile: source.file, capturedAt: source.capturedAt,
  gridDimension: 3, adaptive: false, tiles: [[0,0],[1,0],[2,0]].map(([x,y],i)=>({ coordinate: [x,y], nodeNumber: i,
    start: i===0, final: i===2, hidden: false, links: i<2?[[x+1,y]]:[], portals: [], randomPortal: false, barrier: "", applications: [] })),
  paths: [{ index: 0, coordinates: [[0,0],[1,0],[2,0]] }, { index: 1, coordinates: [[0,0],[1,0],[2,0]] }], encounters: [],
  rewards: { fixedChampions: [], possibleCrystals: [] } };
const layer: QuestDetailsLayer = { questId: "q", mapId: "m", sourceHash: source.sha256, publicMapSha256: "b".repeat(64),
  preparation: { energyPerTile: 2, minTeamSize: 1, maxTeamSize: 5,
    championRequirement: { groups: [["tg_deathless", "t7"]], label: "Each champion: Deathless and 7★", resolved: true }, source },
  chests: [{ id: "q:chest:1,0:c", coordinate: [1,0], pathIndices: [0,1], chestId: "c", asset: "object_chest_level03",
    source: { ...source, pointer: "/map/walkableTiles/1/item" } }], chestCoverage: "captured" };

describe("quest preparation and chest definitions", () => {
  it("attaches a separate layer without changing native positions or duplicating shared chests", () => {
    const before = structuredClone(map), actual = applyQuestDetails(map, layer);
    expect(map).toEqual(before);
    expect(actual.tiles).toBe(map.tiles);
    expect(actual.details?.chests).toHaveLength(1);
    expect(actual.details?.chests[0].pathIndices).toEqual([0,1]);
    expect(actual.details?.preparation.championRequirement?.groups).toEqual([["tg_deathless", "t7"]]);
  });

  it("rejects foreign sources, invented coordinates, duplicate chests and changed route membership", () => {
    expect(() => applyQuestDetails(map, { ...layer, sourceHash: "c".repeat(64) })).toThrow(/source mismatch/);
    expect(() => applyQuestDetails(map, { ...layer, chests: [{ ...layer.chests[0], coordinate: [2,2] }] })).toThrow(/placement/);
    expect(() => applyQuestDetails(map, { ...layer, chests: [...layer.chests, layer.chests[0]] })).toThrow(/placement/);
    expect(() => applyQuestDetails(map, { ...layer, chests: [{ ...layer.chests[0], pathIndices: [0] }] })).toThrow(/route mismatch/);
    expect(() => applyQuestDetails(map, { ...layer, preparation: { ...layer.preparation, source: { ...source, sha256: "d".repeat(64) } } })).toThrow(/source mismatch/);
    expect(() => applyQuestDetails(map, { ...layer, chests: [{ ...layer.chests[0], source: { ...source, file: "foreign/map.json" } }] })).toThrow(/source mismatch/);
  });

  it("rejects account state, invented contents, machine paths and zero-sized teams at the strict boundary", () => {
    const preparationWithAccountState = { ...layer.preparation, eligible: true };
    const collectedChest = { ...layer.chests[0], collected: true };
    const chestWithContents = { ...layer.chests[0], contents: [{ type: "inv", data: "gold", quantity: 3 }] };
    expect(() => applyQuestDetails(map, { ...layer, preparation: preparationWithAccountState })).toThrow();
    expect(() => applyQuestDetails(map, { ...layer, chests: [collectedChest] })).toThrow();
    expect(() => applyQuestDetails(map, { ...layer, chests: [chestWithContents] })).toThrow();
    expect(() => applyQuestDetails(map, { ...layer, preparation: { ...layer.preparation, maxTeamSize: 0 } })).toThrow();
    expect(() => applyQuestDetails(map, { ...layer, preparation: { ...layer.preparation, minTeamSize: 6 } })).toThrow(/team size range/);
    expect(() => applyQuestDetails(map, { ...layer, preparation: { ...layer.preparation, source: { ...source, file: "C:/private/map.json" } } })).toThrow();
  });

  it("binds every published overlay to exact map bytes, public sources, tiles and routes", () => {
    const data = raw as unknown as { maps: Record<string, QuestDetailsLayer>; sourceHashes: Record<string, string> };
    expect(Object.keys(data.maps).sort()).toEqual([...progressed.publicQuestIds].sort());
    expect(Object.keys(data.maps)).toHaveLength(234);
    for (const [qid, details] of Object.entries(data.maps)) {
      const directory = qid.startsWith("epilogue_") ? "act10-maps" : ["progressed-maps", "permanent-maps", "maps"].find(directory => {
        try { return JSON.parse(readFileSync(`src/data/game-quests/${directory}/${qid}.json`, "utf8")).sourceHash === details.sourceHash; }
        catch { return false; }
      });
      expect(directory, qid).toBeDefined();
      const bytes = readFileSync(`src/data/game-quests/${directory}/${qid}.json`);
      expect(createHash("sha256").update(bytes).digest("hex"), qid).toBe(details.publicMapSha256);
      const native = JSON.parse(bytes.toString()) as QuestMap;
      const actual = withQuestDetails(native);
      expect(actual.details, qid).toEqual(details);
      expect(details.preparation.source.sha256, qid).toBe(data.sourceHashes[details.preparation.source.file]);
      for (const chest of details.chests) expect(chest.source.sha256, qid).toBe(data.sourceHashes[chest.source.file]);
    }
    const mausoleum = data.maps.me_mausoleum_ch01_q02;
    expect(mausoleum.preparation).toMatchObject({ energyPerTile: 1, minTeamSize: 1, maxTeamSize: 5, recommendedTeamRating: 60000,
      championRequirement: { groups: [["tg_deathless", "t7"]], resolved: true } });
    expect(data.maps.a04_ch01_q01.chests.find(chest => chest.coordinate.join(",") === "3,5"))
      .toMatchObject({ chestId: "chests03", asset: "object_chest_level03" });
    expect(data.maps.epilogue_ch01_q01.chestCoverage).toBe("uncaptured");
    expect(Object.values(data.maps).some(details => (details.preparation.recommendedTeamRating ?? 0) >= 9999999)).toBe(false);
    expect(data.maps.me_painquest_accpt_quest.preparation.recommendedTeamRating).toBe(99999);
    expect(data.maps.me_wheelfate2025_1.preparation.recommendedTeamRating).toBe(999999);
    expect(data.maps.me_crucible_ch01_q01.preparation.maxTeamSize).toBe(1);
    expect(data.maps.me_grandmastergauntlet_2.preparation).toMatchObject({ energyPerTile: 0, recommendedTeamRating: 250000 });
    expect(Object.values(data.maps).some(details => details.preparation.maxTeamSize === 0)).toBe(false);
    const keys = new Set<string>();
    const visit = (value: unknown) => { if (Array.isArray(value)) value.forEach(visit); else if (value && typeof value === "object") for (const [key, item] of Object.entries(value)) { keys.add(key); visit(item); } };
    visit(raw);
    for (const forbidden of ["collected", "claimed", "claimedPersistentChests", "collectedPathBasedRewardsList", "inventory", "playerId", "accountId", "progress", "eligible", "contents", "spawnedItems"])
      expect(keys.has(forbidden), forbidden).toBe(false);
  }, 30000);
});
