import { expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { questCatalog, findQuest, loadQuestMap, findChampionEncounters } from "../../data/game-quests";
import { validateQuestMap } from "../../domain/game-quests";
import { getBossPreview, permanentData } from "../../data/game-quests/permanent";

it("adds permanent Special identities across native categories and completes Acts 1–9 and Road", async () => {
  expect(questCatalog).toHaveLength(234);
  expect(questCatalog.filter(q => q.coverage === "full-map")).toHaveLength(234);
  expect(questCatalog.filter(q => q.section === "Story" && q.actIndex <= 9).every(q => q.coverage === "full-map")).toBe(true);
  expect(questCatalog.filter(q => q.containerSetName === "road_to_labyrinth")).toHaveLength(24);
  expect(questCatalog.filter(q => q.coverage === "summary-only").every(q => q.section === "Story" && q.actIndex === 10)).toBe(true);
  for (const id of ["me_pain2024_fin_ques2", "me_crucible_ch02_q02", "me_aug2026_rev_4_Lv1", "me_necropolis_quest"]) {
    expect(findQuest(id)?.section).toBe("Special");
    expect((await loadQuestMap(id))?.questId).toBe(id);
  }
  expect(findQuest("pve_nov2026_1_prg4")).toBeUndefined();
});

it("keeps new boss previews separate from placed NPCs and leaves unproven modifier versions unbound", async () => {
  const quest = findQuest("me_crucible_ch02_q02")!;
  const preview = getBossPreview(quest)!;
  expect(preview.bosses.length).toBeGreaterThan(1);
  expect(getBossPreview({ ...quest, mapId: "other-map" })).toBeUndefined();
  const map = (await loadQuestMap(quest.id))!;
  expect(map.tiles.flatMap(t => t.applications).length).toBeGreaterThan(0);
  expect(map.tiles.flatMap(t => t.applications).some(a => a.iconKey)).toBe(true);
  expect(map.tiles.flatMap(t => t.applications).some(a => a.iconKey === null)).toBe(true);
  for (const e of map.encounters.filter(e => !e.champion)) {
    const portrait = permanentData.nativePortraits[e.gameId];
    if (portrait) {
      expect(portrait.character).toBe(e.gameId);
      expect(portrait.sourceBcgSha256).toBe(permanentData.bcgSha256);
    }
  }
});

it("retains every saved graph, exact placement identity and encounter source through the lazy reader", async () => {
  for (const q of questCatalog.filter(q => q.coverage === "full-map")) {
    const map = (await loadQuestMap(q.id))!;
    expect(validateQuestMap(map), q.id).toEqual([]);
    expect(map.mapId).toBe(q.mapId);
    expect(map.encounters).toHaveLength(q.placedEncounters!);
    expect(map.paths).toHaveLength(q.authoredPaths!);
    for (const e of map.encounters) {
      expect(findChampionEncounters(e.gameId).filter(o => o.questId === q.id && o.encounterId === e.id)).toEqual([
        expect.objectContaining({ sourceHash: map.sourceHash, coordinate: e.coordinate, pathIndices: e.pathIndices, gameId: e.gameId }),
      ]);
    }
  }
  const ledgers = JSON.parse(readFileSync("src/data/game-quests/progressed.json", "utf8")) as { maps: Record<string, { publicMapSha256: string; sourceHash: string }> };
  expect(Object.keys(ledgers.maps)).toHaveLength(152);
  for (const [id, entry] of Object.entries(ledgers.maps)) {
    expect(createHash("sha256").update(readFileSync(`src/data/game-quests/progressed-maps/${id}.json`)).digest("hex")).toBe(entry.publicMapSha256);
    expect((await loadQuestMap(id))?.sourceHash).toBe(entry.sourceHash);
  }
},120000);
