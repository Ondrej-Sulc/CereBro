import { describe, expect, it } from "vitest";
import { questCatalog, findQuest, searchQuests, loadQuestMap, findChampionEncounters } from "../../data/game-quests";
import { validateQuestMap, routeEncounters, effectOccurrences } from "../../domain/game-quests";

describe("public game quest snapshot", () => {
  it("retains exact variants and explicit summary coverage", () => {
    expect(questCatalog).toHaveLength(234);
    expect(questCatalog.filter(q => q.coverage === "full-map")).toHaveLength(234);
    expect(findQuest("a05_ch01_q02")?.coverage).toBe("full-map");
    expect(findQuest("epilogue_ch01_q01")?.coverage).toBe("full-map");
    expect(findQuest("../../private")).toBeUndefined();
  });
  it("searches names, native hierarchy and exact difficulty without conflating variants", () => {
    expect(searchQuests({ query: "surrender" }).map(q => q.id)).toContain("p01_ch01_q01");
    expect(searchQuests({ category: "Story", coverage: "full-map" })).toHaveLength(184);
    const variants = searchQuests({ query: "Crossed Wires" });
    expect(variants.length).toBe(0);
    expect(new Set(variants.map(q => q.id)).size).toBe(0);
    expect(searchQuests({ query: "no-such-quest" })).toEqual([]);
  });
  it("validates every graph, ordered route, placement and application join", async () => {
    let tiles = 0, paths = 0, encounters = 0;
    for (const q of questCatalog.filter(q => q.coverage === "full-map")) {
      const map = await loadQuestMap(q.id);
      expect(map).toBeDefined();
      expect(validateQuestMap(map!)).toEqual([]);
      tiles += map!.tiles.length; paths += map!.paths.length; encounters += map!.encounters.length;
    }
    expect({ tiles, paths, encounters }).toEqual({ tiles: 51333, paths: 1501, encounters: 6027 });
    expect(await loadQuestMap("epilogue_ch01_q01")).toBeDefined();
  });
  it("preserves shared bosses, authored order, and excludes unplaced table candidates", async () => {
    const simple = (await loadQuestMap("p01_ch01_q01"))!;
    expect(routeEncounters(simple, 0).map(e => e.gameId)).toEqual(["ironman", "drstrange", "doc_ock"]);
    expect(simple.encounters.some(e => e.gameId === "blackpanther")).toBe(false);
    const map = (await loadQuestMap("a05_ch01_q01"))!;
    expect(map.encounters).toHaveLength(20);
    expect(map.paths.map((_, i) => routeEncounters(map, i).length)).toEqual([7, 7, 8, 8]);
    const boss = map.encounters.find(e => e.final)!;
    expect(map.paths.every((_, i) => routeEncounters(map, i).includes(boss))).toBe(true);
    expect(map.tiles.some(t => t.portals.length > 0)).toBe(true);
  });
  it("joins champions only by exact gameId, keeps NPC unknowns and reward roles separate", async () => {
    const map = (await loadQuestMap("a04_ch04_q06"))!;
    const maestro = map.encounters.find(e => e.gameId === "maestro")!;
    expect(maestro.champion).toBeNull();
    expect(maestro.name).toBe("MAESTRO");
    expect(findChampionEncounters("punisher_legacy").every(e => findQuest(e.questId))).toBe(true);
    expect(findChampionEncounters("punisher").every(e => e.gameId === "punisher")).toBe(true);
    expect(findChampionEncounters("MAESTRO")).toEqual([]);
    const simple = (await loadQuestMap("p01_ch01_q01"))!;
    expect(simple.rewards.fixedChampions.some(r => r.gameId === "captainamerica" && r.rarity === 2)).toBe(true);
    expect(simple.encounters.some(e => e.gameId === "captainamerica")).toBe(false);
  });
  it("projects exact effect applications with source, target, path and identity", async () => {
    const map = (await loadQuestMap("a05_ch01_q01"))!;
    const rows = effectOccurrences(map, "ava_ea20");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every(r => r.questId === map.questId && r.sourceHash === map.sourceHash && r.effectId === "ava_ea20")).toBe(true);
    const gambit = rows.find(r => r.coordinate[0] === 10 && r.coordinate[1] === 21)!;
    expect(gambit.target).toBe("defender");
    expect(gambit.sourceType).toBe("Local");
    expect(gambit.pathIndices.length).toBeGreaterThan(0);
    const broken = structuredClone(map);
    broken.paths[0].coordinates[1] = [999, 999];
    expect(validateQuestMap(broken).length).toBeGreaterThan(0);
  });
});
