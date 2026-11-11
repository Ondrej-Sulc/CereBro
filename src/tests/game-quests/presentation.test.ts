import { expect, it } from "vitest";
import { findQuest, loadQuestMap, questCatalog, searchQuests } from "../../data/game-quests";
import { storyActs, storyChapters, groupQuestRows } from "../../domain/game-quests/browse";
import { projectQuestPortraits, projectQuestRewards, resolveQuestCrystal, questRewardScope } from "../../../web/src/lib/game-quests/presentation";

it("drills through authored membership and keeps native names independent from indices", () => {
  const acts = storyActs(questCatalog);
  expect(acts).toHaveLength(10);
  expect(searchQuests({ act: "act4", chapter: "a04_ch04" })).toHaveLength(6);
  expect(searchQuests({ act: "p_act1", chapter: "a04_ch04" })).toEqual([]);
  expect(storyChapters(questCatalog, "act4").map(c => c.label)).toContain("Devastation");
  const changed = structuredClone(findQuest("p01_ch01_q01")!);
  changed.hierarchy[0].actName = "ACT NATIVE LABEL";
  changed.hierarchy[0].chapterName = "Native chapter";
  expect(storyActs([changed])[0].label).toBe("ACT NATIVE LABEL");
  expect(storyChapters([changed], "p_act1")[0].label).toBe("Native chapter");
  const variants = searchQuests({ query: "NORMAL" });
  expect(groupQuestRows(variants).flat().map(q => q.id).sort()).toEqual(variants.map(q => q.id).sort());
  expect(groupQuestRows(variants).length).toBeLessThanOrEqual(variants.length);
});
it("uses exact batched identities and never gives an unresolved NPC a similar portrait", async () => {
  const map = (await loadQuestMap("a04_ch04_q06"))!;
  const portraits = projectQuestPortraits(map, [
    { gameId: "hulk", name: "Hulk", slug: "hulk", class: "SCIENCE", images: { p_128: "https://example.com/hulk.png" } },
    { gameId: "maestro", name: "Maestro", slug: "maestro", class: "SCIENCE", images: { p_128: "https://example.com/guessed.png" } },
  ]);
  expect(portraits.hulk.imageUrl).toBe("https://example.com/hulk.png");
  expect(portraits.hulk.className).toBe("Science");
  expect(portraits.maestro).toBeUndefined();
});
it("resolves exact crystal tokens to actual supported destinations and scopes", async () => {
  expect(resolveQuestCrystal("quest_crystal").href).toBe("/crystals/quest_crystal_improvedspin");
  expect(resolveQuestCrystal("mythic_shard_crystal").name).toBe("MYTHIC CRYSTAL");
  expect(resolveQuestCrystal("class_cat_crystal").imageUrl).toMatch(/^https:/);
  expect(resolveQuestCrystal("class_cat_crystal_typo")).toEqual({ name: "Crystal reward", imageUrl: null, href: null });
  const rewards = projectQuestRewards((await loadQuestMap("a05_ch01_q01"))!, {});
  expect(rewards.find(r => r.token === "mythic_shard_crystal")?.scope).toBe("masteryCompletionRewards");
  expect(questRewardScope("masteryCompletionRewards")).toBe("100% exploration");
  expect(projectQuestRewards((await loadQuestMap("p01_ch01_q01"))!, {}).find(r => r.type === "champion")?.name).toBe("Captain America");
});
