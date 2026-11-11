import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import index from "../../data/game-quests/unplaced-defenders/index.json";
import identities from "../../data/game-quests/unplaced-defenders/identities.json";
import labyrinth from "../../data/game-quests/unplaced-defenders/quests/eq_labyrinth.json";
import { loadUnplacedQuestDefenders, findUnplacedDefenderReferences } from "../../data/game-quests/unplaced-defenders";
import { findQuest } from "../../data/game-quests";
import { projectUnplacedDefenders, type UnplacedQuestRecord } from "../../domain/game-quests/unplaced-defenders";

function quest(id: keyof typeof index.quests) {
  const binding = index.quests[id];
  return { id, mapId: binding.mapId, containerSetId: binding.containerSetId,
    summarySetId: binding.summarySetId, sourceHash: binding.catalogSourceHash };
}

describe("separate unplaced definition catalog", () => {
  it("shows the fresh preview's placement and personal-node limit only for its exact displayed map", async () => {
    for (const id of ["realm3", "eq_labyrinth"]) {
      const q = findQuest(id)!;
      const dto = await loadUnplacedQuestDefenders(q);
      expect(dto).toMatchObject({ checkedPreview: { notice: expect.stringContaining("without map locations or personal node modifiers") } });
      expect(JSON.stringify(dto)).not.toMatch(/selectedShardSha256|responseSha256|receiptSha256/);
      expect((await loadUnplacedQuestDefenders({ ...q, mapSourceHash: undefined }))?.checkedPreview).toBeUndefined();
    }
    expect((await loadUnplacedQuestDefenders(findQuest("a04_ch01_q01")!))?.checkedPreview).toBeUndefined();
  });
  it("accepts the existing shared quest DTOs without a catalog adapter", async () => {
    for (const id of Object.keys(index.quests)) {
      const sharedQuest = findQuest(id);
      expect(sharedQuest, id).toBeDefined();
      expect(await loadUnplacedQuestDefenders(sharedQuest!), id).toBeDefined();
    }
  });
  it("serves every audited quest with source-bound, placement-free DTOs", async () => {
    expect(Object.keys(index.quests)).toHaveLength(138);
    const documents = await Promise.all((Object.keys(index.quests) as (keyof typeof index.quests)[]).map(id => loadUnplacedQuestDefenders(quest(id))));
    expect(documents.every(doc => doc?.coverage === "placement-unknown")).toBe(true);
    expect(documents.reduce((sum, doc) => sum + doc!.rowCount, 0)).toBe(461);
    for (const doc of documents) {
      expect(doc!.previews.reduce((sum, preview) => sum + preview.sourceEntryCount, 0)).toBe(doc!.rowCount);
      expect(JSON.stringify(doc)).not.toMatch(/"(?:coordinate|pathIndices|encounters|uid|sourcePointer|sourceFile)"/);
    }
  });

  it("does not infer an empty Act10 list or accept stale/cross-quest joins", async () => {
    const bound = quest("realm3");
    for (const change of [{ mapId: "eq_labyrinth" }, { containerSetId: "wrong" }, { summarySetId: "wrong" }, { sourceHash: "stale" }, { mapSourceHash: "newer-definition" }, { id: "epilogue_ch01_q01" }, { id: "__proto__" }]) {
      expect(await loadUnplacedQuestDefenders({ ...bound, ...change })).toBeUndefined();
    }
  });

  it("keeps native summary sets distinct from containing sets", async () => {
    const bound = quest("a04_ch01_q01");
    expect(bound.summarySetId).not.toBe(bound.containerSetId);
    expect((await loadUnplacedQuestDefenders(bound))?.rowCount).toBe(7);
    expect(await loadUnplacedQuestDefenders({ ...bound, summarySetId: bound.containerSetId })).toBeUndefined();
  });

  it("preserves Labyrinth duplicates and first-source display order", async () => {
    const before = JSON.stringify(labyrinth);
    const dto = (await loadUnplacedQuestDefenders(quest("eq_labyrinth")))!;
    expect(dto.rowCount).toBe(31);
    expect(labyrinth.rows.filter(row => row.bossId === "eq_labyrinth_treasure7").map(row => row.sourceIndex)).toEqual([23, 24]);
    expect(dto.previews[0].identity.gameId).toBe("ex_agentvenom");
    expect(dto.previews.find(preview => preview.identity.gameId === "adaptoid_gold_juggernaut")?.sourceEntryCount).toBe(2);
    expect(JSON.stringify(labyrinth)).toBe(before);
  });

  it("does not combine different saved builds or candidate order", () => {
    const one = labyrinth.rows[0];
    const rows = [one, { ...one, sourceIndex: 1, rank: one.rank + 1 },
      { ...one, sourceIndex: 2, candidateTierIds: [labyrinth.rows[1].tierId, one.tierId] },
      { ...one, sourceIndex: 3, candidateTierIds: [one.tierId, labyrinth.rows[1].tierId] }];
    const dto = projectUnplacedDefenders({ ...labyrinth, rows } as UnplacedQuestRecord, identities);
    expect(dto.previews).toHaveLength(4);
    expect(dto.previews.map(preview => preview.key)).toEqual([0, 1, 2, 3].map(i => `eq_labyrinth:preview:${i}`));
  });

  it("keeps EX identities exact and indexes candidate-only identities without aliases", async () => {
    const dto = (await loadUnplacedQuestDefenders(quest("realm3")))!;
    const thing = dto.previews.find(preview => preview.identity.tierId === "npc_abyss_thing_t6")!;
    expect(thing.identity).toMatchObject({ gameId: "ex_thing", name: "EX. THING" });
    expect(thing.identity).not.toHaveProperty("champion");
    expect(findUnplacedDefenderReferences("ex_thing").some(ref => ref.questId === "realm3")).toBe(true);
    expect(findUnplacedDefenderReferences("thing").some(ref => ref.questId === "realm3")).toBe(false);
    expect(findUnplacedDefenderReferences("Thing")).toEqual([]);
    expect(findUnplacedDefenderReferences("__proto__")).toEqual([]);
    const references = findUnplacedDefenderReferences("adaptoid_gold_juggernaut");
    expect(references.find(ref => ref.questId === "eq_labyrinth")?.sourceIndices).toEqual([23, 24]);
    references[0].sourceIndices.length = 0;
    expect(findUnplacedDefenderReferences("adaptoid_gold_juggernaut")[0].sourceIndices.length).toBeGreaterThan(0);
  });

  it("leaves the saved placed map byte-identical while reading previews", async () => {
    const path = "src/data/game-quests/progressed-maps/realm3.json";
    const before = readFileSync(path);
    const map = JSON.parse(before.toString());
    expect(map.encounters).toHaveLength(1);
    expect(map.paths).toHaveLength(20);
    await loadUnplacedQuestDefenders(quest("realm3"));
    expect(createHash("sha256").update(readFileSync(path)).digest("hex")).toBe(createHash("sha256").update(before).digest("hex"));
  });
});
