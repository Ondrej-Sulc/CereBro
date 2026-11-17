import { beforeEach, expect, it, vi } from "vitest";
import { loadQuestMap } from "../../data/game-quests";
const findMany = vi.hoisted(() => vi.fn().mockResolvedValue([]));
vi.mock("@/lib/prisma", () => ({ prisma: { champion: { findMany } } }));
vi.mock("@/lib/cache", () => ({ getFromCache: (_key: string, _ttl: number, read: () => Promise<unknown>) => read() }));
import { loadQuestPortraits, loadRewardPortraits, loadBossPortraits } from "../../../web/src/lib/game-quests/champions";
import { findQuest } from "../../data/game-quests";
import { getBossPreview } from "../../data/game-quests/permanent";
import type { QuestRewardRecord } from "../../data/game-quests/rewards";
beforeEach(() => { findMany.mockReset(); findMany.mockResolvedValue([]); });

it("requests exact map IDs including NPCs while retaining unbound native artwork", async () => {
  const map = (await loadQuestMap("a04_ch04_q06"))!;
  const portraits=await loadQuestPortraits(map);
  expect(findMany).toHaveBeenCalledTimes(1);
  const query = findMany.mock.calls[0][0];
  expect(query.where.isPlayable).toBeUndefined();
  expect(query.where.gameId.in).toContain("maestro");
  expect(query.where.gameId.in).toContain("hulk");
  expect(new Set(query.where.gameId.in).size).toBe(query.where.gameId.in.length);
  expect(query.select).toEqual({ id: true, gameId: true, name: true, slug: true, images: true, class: true });
  expect(portraits.maestro.imageUrl).toMatch(/^\/game-quests\/permanent-art\//);
  expect(portraits.maestro.name).toBe("MAESTRO");
  expect(portraits.maestro.href).toBeNull();
  expect(portraits.maestro.className).toBe("NPC / legacy defender");
  const unknown=await loadQuestPortraits({...map,encounters:[{...map.encounters.find(e=>e.gameId==="maestro")!,gameId:"maestro_unknown"}],rewards:{fixedChampions:[],possibleCrystals:[]}});
  expect(unknown).toEqual({});
  expect(findMany).toHaveBeenCalledTimes(2);
});

it("adds an exact Ares dossier binding and retains native art when the DB has no image", async () => {
  const map = (await loadQuestMap("me_pain2024_fin_ques2"))!, before = JSON.stringify(map);
  findMany.mockResolvedValue([{ id: 809, gameId: "ares", name: "Ares", slug: "ares", class: "SKILL", images: {} }]);
  const portraits = await loadQuestPortraits(map);
  expect(portraits.ares).toMatchObject({ name: "Ares", href: "/champions/ares", championBinding: { id: 809, gameId: "ares" } });
  expect(portraits.ares.imageUrl).toMatch(/^\/game-quests\/progressed-art\//);
  expect(JSON.stringify(map)).toBe(before);
});

it("queries exact NPC IDs in reward identities and menu boss previews", async () => {
  const record = { scopes: { firstCompletionRewards: [{ identity: { gameId: "ares", champion: null } }] } } as unknown as QuestRewardRecord;
  await loadRewardPortraits(record);
  expect(findMany.mock.calls[0][0].where).toEqual({ gameId: { in: ["ares"] } });
  const quest = findQuest("me_crucible_ch01_q01")!;
  await loadBossPortraits([quest]);
  const expected = [...new Set(getBossPreview(quest)!.bosses.map(boss => boss.gameId))].sort();
  expect(findMany.mock.calls[1][0].where).toEqual({ gameId: { in: expected } });
});
