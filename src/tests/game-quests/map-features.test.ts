import { describe, expect, it } from "vitest";
import type { QuestMap } from "../../domain/game-quests";
import { applyQuestMapFeatures, type QuestMapFeatureLayer } from "../../domain/game-quests/map-features";
import { questBoardGeometry } from "../../domain/game-quests/board";

const source = { file: "public-map.json", sha256: "b".repeat(64), pointer: "/quest/pathBasedRewardsList/0", capturedAt: "2026-11-09T00:00:00Z" };
const map: QuestMap = { version: 1, questId: "q", mapId: "m", sourceHash: "a".repeat(64), sourceFile: "map.json", capturedAt: source.capturedAt,
  gridDimension: 4, adaptive: false, tiles: [[0,0],[1,0],[2,0]].map(([x,y],i)=>({ coordinate: [x,y], nodeNumber: i, start: i===0, final: i===2, hidden: false,
    links: i<2?[[x+1,y]]:[], portals: [], randomPortal: false, barrier: i===1?"gate":"", applications: [] })),
  paths: [{ index: 0, coordinates: [[0,0],[1,0],[2,0]] },{ index: 1, coordinates: [[0,0],[1,0],[2,0]] }], encounters: [], rewards: { fixedChampions: [], possibleCrystals: [] } };
const layer: QuestMapFeatureLayer = { questId: "q", mapId: "m", sourceHash: map.sourceHash, publicMapSha256: "c".repeat(64),
  gates: [{ id: "gate:1", barrierId: "gate", coordinate: [1,0], kind: "class", label: "Mutant gate", requirements: ["At least one Mutant champion on the team."], resolved: true, pathIndices: [0,1], source }],
  pathRewards: [{ id: "pickup:1", coordinate: [2,0], pathIndices: [0,1], source, rewards: [{ sourceIndex: 0, type: "inv", data: "stone", quantity: 10 }] }],
  coverage: { gates: "complete", pathRewards: "captured", unresolvedGateCount: 0 } };

describe("public quest map feature binding", () => {
  it("keeps neighboring tag gate captions from covering each other", () => {
    const gate = { ...layer.gates[0], kind: "tags" as const, constraints: { nativeType:"hasTags", champions:[], count:3, countOperator:"gte", tags:["tg_vill:tg_gam"], tagLogic:"any-group-all-terms" as const } };
    const displayMap: QuestMap = { ...map, features: { ...layer, gates: [gate, { ...gate, id:"tag-gate-2", coordinate:[2,0] }] } };
    const board=questBoardGeometry(displayMap), a=board.point(gate.coordinate), b=board.point([2,0]);
    expect(Math.abs(a[0]-b[0]) > 136 || Math.abs(a[1]-b[1]) > 78).toBe(true);
  });
  it("leaves room for adjacent gate markers without moving their native coordinates", () => {
    const displayMap: QuestMap = { ...map, features: { ...layer, gates: [layer.gates[0], { ...layer.gates[0], id: "gate:2", coordinate: [2,0] }] } };
    const before = JSON.stringify(displayMap), board = questBoardGeometry(displayMap);
    const a = board.point([1,0]), b = board.point([2,0]);
    expect(Math.hypot(a[0]-b[0],a[1]-b[1])).toBeGreaterThanOrEqual(60);
    expect(JSON.stringify(displayMap)).toBe(before);
  });
  it("preserves shared pickups once with their original quantity and native map unchanged", () => {
    const before = structuredClone(map);
    const actual = applyQuestMapFeatures(map, layer);
    expect(actual.features?.pathRewards).toHaveLength(1);
    expect(actual.features?.pathRewards[0]).toMatchObject({ pathIndices: [0,1], rewards: [{ quantity: 10 }] });
    expect(map).toEqual(before);
  });
  it("rejects foreign map versions, invented positions, wrong gate links and route membership", () => {
    expect(() => applyQuestMapFeatures(map,{ ...layer, sourceHash: "d".repeat(64) })).toThrow(/source mismatch/);
    expect(() => applyQuestMapFeatures(map,{ ...layer, gates: [{ ...layer.gates[0], barrierId: "foreign" }] })).toThrow(/gate binding/);
    expect(() => applyQuestMapFeatures(map,{ ...layer, pathRewards: [{ ...layer.pathRewards[0], coordinate: [3,3] }] })).toThrow(/placement/);
    expect(() => applyQuestMapFeatures(map,{ ...layer, pathRewards: [{ ...layer.pathRewards[0], pathIndices: [0] }] })).toThrow(/route mismatch/);
  });
  it("rejects account collection state and unexpected native fields at the public boundary", () => {
    const privateState = { ...layer, pathRewards: [{ ...layer.pathRewards[0], collected: true }] };
    expect(() => applyQuestMapFeatures(map, privateState)).toThrow();
  });
  it("loads every published feature layer and retains Mausoleum's four distinct ten-stone pickups", async () => {
    const { loadQuestMap, questCatalog } = await import("../../data/game-quests");
    let observed = 0;
    for (const quest of questCatalog) {
      const actual = await loadQuestMap(quest.id);
      if (actual?.features) observed++;
    }
    expect(observed).toBe(questCatalog.filter(quest => quest.coverage === "full-map").length);
    const mausoleum = await loadQuestMap("me_mausoleum_ch01_q02");
    expect(mausoleum?.features?.pathRewards).toHaveLength(4);
    expect(mausoleum?.features?.pathRewards.map(pickup => pickup.rewards[0])).toEqual(Array.from({ length: 4 }, () => ({ sourceIndex: 0, type: "inv", data: "deathless_signature_stone_t7", quantity: 10, minQuantity: 10, maxQuantity: 10 })));
    expect(mausoleum?.features?.gates).toHaveLength(4);
    expect(mausoleum?.features?.gates.every(gate => gate.resolved)).toBe(true);
  }, 120000);
});
