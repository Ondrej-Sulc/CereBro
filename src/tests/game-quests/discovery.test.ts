import { beforeAll, expect, it } from "vitest";
import { buildDiscovery } from "../../data/game-discovery/build";
import { rewardIdentity, packDiscovery, type GameDiscovery } from "../../domain/game-discovery";
import snapshot from "../../data/game-discovery/index.json";

let data: GameDiscovery;
beforeAll(async () => { data = await buildDiscovery(); }, 120000);

it("links exact quest applications and Tower floors without exposing empty path positions as encounters", () => {
  const contagion = data.nodes.pve_contagion;
  expect(contagion.some(row => row.href.includes("me_mausoleum_ch01_q01") && row.context.includes("Hood") && row.href.includes("node="))).toBe(true);
  expect(data.nodes.avx_hp_pct800.some(row => row.href.includes("class_skill?block=1") && row.href.endsWith("#block-rules"))).toBe(true);
  expect(Object.values(data.nodes).flat().some(row => /Route position|Map location/.test(row.context))).toBe(false);
});

it("keeps reward variants, grant scopes, quantities and source owners independent", () => {
  expect(rewardIdentity("inv", "rankup_3_4")).not.toBe(rewardIdentity("inv", "rankup_2_3"));
  const gold = data.rewards[rewardIdentity("res", "sc")];
  expect(gold.sources.some(row => row.section === "Story" && row.scope === "firstCompletionRewards")).toBe(true);
  expect(gold.sources.some(row => row.scope === "Floor rewards" && row.href.includes("rewardFloor=1"))).toBe(true);
  expect(gold.sources.some(row => row.scope === "masteryCompletionRewards")).toBe(true);
  expect(Object.values(data.rewards).flatMap(r => r.sources).some(row => row.scope === "Entry cost")).toBe(false);
  expect(data.rewards[rewardIdentity("inv", "unknown_rewards")]).toBeUndefined();
});

it("has no duplicate destinations per native node and preserves distinct reward source rows", () => {
  for (const rows of Object.values(data.nodes)) expect(new Set(rows.map(r => r.href)).size).toBe(rows.length);
  for (const reward of Object.values(data.rewards)) expect(new Set(reward.sources.map(r => r.key)).size).toBe(reward.sources.length);
  expect(data.coverage).toEqual(expect.objectContaining({ quests: 234, towerBlocks: 900 }));
});

it("reproduces the compact published index from the accepted source readers", () => {
  expect(packDiscovery(data)).toEqual(snapshot);
});
