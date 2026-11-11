import { expect, it, vi } from "vitest";
import { loadQuestMap } from "../../data/game-quests";
const findMany = vi.hoisted(() => vi.fn().mockResolvedValue([]));
vi.mock("@/lib/prisma", () => ({ prisma: { champion: { findMany } } }));
vi.mock("@/lib/cache", () => ({ getFromCache: (_key: string, _ttl: number, read: () => Promise<unknown>) => read() }));
import { loadQuestPortraits } from "../../../web/src/lib/game-quests/champions";

it("requests one deduplicated public champion batch and excludes unresolved game IDs", async () => {
  const map = (await loadQuestMap("a04_ch04_q06"))!;
  const portraits=await loadQuestPortraits(map);
  expect(findMany).toHaveBeenCalledTimes(1);
  const query = findMany.mock.calls[0][0];
  expect(query.where.isPlayable).toBe(true);
  expect(query.where.gameId.in).not.toContain("maestro");
  expect(query.where.gameId.in).toContain("hulk");
  expect(new Set(query.where.gameId.in).size).toBe(query.where.gameId.in.length);
  expect(query.select).toEqual({ gameId: true, name: true, slug: true, images: true, class: true });
  expect(portraits.maestro.imageUrl).toMatch(/^\/game-quests\/permanent-art\//);
  expect(portraits.maestro.name).toBe("MAESTRO");
  expect(portraits.maestro.href).toBeNull();
  expect(portraits.maestro.className).toBe("NPC / legacy defender");
  const unknown=await loadQuestPortraits({...map,encounters:[{...map.encounters.find(e=>e.gameId==="maestro")!,gameId:"maestro_unknown"}],rewards:{fixedChampions:[],possibleCrystals:[]}});
  expect(unknown).toEqual({});
  expect(findMany).toHaveBeenCalledTimes(1);
});
