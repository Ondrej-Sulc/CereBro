import { expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { findQuest, questCatalog } from "../../data/game-quests";
import { getGroupMenuArtwork, getQuestMenuArtwork } from "../../data/game-quests/menu-art";
import { questMenuArtwork, type MenuArtManifest } from "../../domain/game-quests/menu-art";
import archivedCatalog from "../../data/game-quests/catalog.json";
import type { QuestSummary } from "../../domain/game-quests";
import raw from "../../data/game-quests/menu-art.json";

it("uses exact captured parent membership and rejects identity/source drift", () => {
  const q = findQuest("a04_ch04_q06")!;
  expect(getQuestMenuArtwork(q)?.role).toBe("chapter");
  expect(getGroupMenuArtwork([q], { kind: "act", id: "act4" })?.role).toBe("act");
  expect(getGroupMenuArtwork([q], { kind: "act", id: "act5" })).toBeNull();
  expect(getQuestMenuArtwork({ ...q, sourceHash: "changed" })).toBeNull();
  expect(getQuestMenuArtwork({ ...q, containerSetId: "wrong-parent" })).toBeNull();
  expect(getQuestMenuArtwork({ ...q, hierarchy: q.hierarchy.map(h => ({ ...h, chapterId: "wrong-chapter" })) })).toBeNull();
  expect(getQuestMenuArtwork(archivedCatalog.find(q=>q.id==="pve_nov2026_1_prg2")! as QuestSummary)?.role).toBe("act"); // Own exact actImage; no inferred hierarchy.
  const roles = structuredClone(raw) as unknown as MenuArtManifest;
  const parent = roles.owners[roles.quests[q.id].parents[0].chapter];
  roles.references[parent.images.image].field = "rewardImage";
  expect(questMenuArtwork(q, roles)?.role).toBe("act"); // Wrong-role parent reference cannot masquerade as chapter art.
});

it("preserves image roles, empty/default states and every frozen catalog identity", () => {
  const manifest = structuredClone(raw) as unknown as MenuArtManifest;
  const q = findQuest("a04_ch04_q06")!;
  for (const owner of Object.values(manifest.owners)) for (const ref of Object.values(owner.images)) manifest.references[ref].state = "default";
  manifest.references[manifest.quests[q.id].actImage].state = "default";
  expect(questMenuArtwork(q, manifest)).toBeNull(); // Never replace with quest reward or generic background art.
  expect(getQuestMenuArtwork(archivedCatalog.find(q=>q.id==="daily_supply_run3_1_1")! as QuestSummary)).toBeNull();
  expect(questCatalog).toHaveLength(234);
  expect(questCatalog.filter(q => getQuestMenuArtwork(q))).toHaveLength(234);
  expect(raw.quests).toHaveProperty("a04_ch04_q06");
  for (const asset of Object.values(raw.assets)) {
    expect(createHash("sha256").update(readFileSync(`web/public${asset.url}`)).digest("hex")).toBe(asset.sha256);
    expect(asset.width).toBeGreaterThan(0);
  }
});

it("uses the containing Act poster for Special collection cards instead of a chapter reward illustration", () => {
  for (const id of ["eq_legends_e", "eq_labyrinth", "me_pain2024_fin_quest"]) {
    const q = findQuest(id)!;
    const art = getGroupMenuArtwork([q]);
    expect(art?.role).toBe("act");
    expect(art?.ownerId).toBe(q.hierarchy[0].actId);
    expect(getQuestMenuArtwork(q)?.role).toBe("act");
  }
});
