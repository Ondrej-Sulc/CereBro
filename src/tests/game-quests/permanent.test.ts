import { expect, it } from "vitest";
import { questCatalog, searchQuests, findQuest, loadQuestMap, findChampionEncounters } from "../../data/game-quests";
import { validateQuestMap } from "../../domain/game-quests";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { permanentData } from "../../data/game-quests/permanent";
import firstSupplement from "../../data/game-quests/permanent.json";

it("keeps permanent Special sets across native categories and excludes transient discovery", async () => {
  expect(questCatalog).toHaveLength(234);
  expect(searchQuests({ query: "Crossed Wires" })).toEqual([]);
  expect(findQuest("pve_nov2026_1_prg4")).toBeUndefined();
  expect(await loadQuestMap("daily_supply_run3_1_1")).toBeUndefined();
  expect(searchQuests({ query: "NORMAL" }).some(q => q.containerSetName === "mausoleum")).toBe(true);
  expect(searchQuests({ query: "Round 1" }).some(q => q.containerSetName === "road_to_labyrinth")).toBe(true);
  expect(findChampionEncounters("punisher_legacy").every(e => findQuest(e.questId))).toBe(true);
});

it("validates all expanded permanent graphs without turning boss previews into placements", async () => {
  expect(questCatalog.filter(q => q.coverage === "full-map")).toHaveLength(234);
  for (const q of questCatalog.filter(q => q.coverage === "full-map")) {
    const map = await loadQuestMap(q.id);
    expect(map).toBeDefined();
    expect(validateQuestMap(map!)).toEqual([]);
    const supplement=permanentData.maps[q.id];
    if(supplement && Object.hasOwn(firstSupplement.maps,q.id)) {
      expect(createHash("sha256").update(readFileSync(`src/data/game-quests/permanent-maps/${q.id}.json`)).digest("hex")).toBe(supplement.publicMapSha256);
      expect(map?.sourceHash).toBe(supplement.sourceHash);
      expect(map?.mapId).toBe(supplement.mapId);
    }
  }
  expect((await loadQuestMap("eq_legends_e"))?.encounters.length).toBeGreaterThan(0);
  expect((await loadQuestMap("roadtolabyrinth_ch4_quest_1"))?.questId).toBe("roadtolabyrinth_ch4_quest_1");
},120000);
