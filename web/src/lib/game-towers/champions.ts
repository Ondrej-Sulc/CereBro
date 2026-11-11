import { prisma } from "@/lib/prisma";
import { getFromCache } from "@/lib/cache";
import { getChampionImageUrl } from "@/lib/championHelper";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { permanentData } from "@cerebro/core/data/game-quests/permanent";
import type { CapturedTowerBlock } from "@cerebro/core/domain/game-quests/tower-data";
import type { QuestPortrait } from "@/lib/game-quests/presentation";
import { nativeRows, towerPresentation } from "./presentation";

export function towerChampionGameIds(block: CapturedTowerBlock): string[] {
  const ids = block.floors.flatMap(f => f.defender?.gameId ? [f.defender.gameId] : []);
  for (const s of [block.blockData, ...block.floors.map(f => f.sourceData)]) {
    for (const field of ["rewards", "ratingRewards", "floorCost"]) {
      for (const r of nativeRows(s[field])) {
        const reward = towerPresentation.rewards[`${r.t}:${r.n}`];
        if (reward?.gameId) ids.push(reward.gameId);
      }
    }
  }
  return [...new Set(ids)].sort();
}

export async function loadTowerPortraits(block: CapturedTowerBlock): Promise<Record<string, QuestPortrait>> {
  const gameIds = towerChampionGameIds(block);
  const rows = gameIds.length ? await getFromCache(`tower-portraits-v1:${gameIds.join(",")}`, 3600,
    () => prisma.champion.findMany({ where: { gameId: { in: gameIds }, isPlayable: true },
      select: { gameId: true, name: true, slug: true, images: true, class: true } })) : [];
  const portraits: Record<string, QuestPortrait> = {};
  for (const gid of gameIds) {
    const art = permanentData.nativePortraits[gid];
    if (art?.character === gid && art.sourceBcgSha256 === towerPresentation.bcgSha256) {
      portraits[gid] = { name: towerPresentation.champions[gid]?.name ?? "Recorded defender", href: null,
        imageUrl: art.url, className: "NPC / legacy defender", color: "#7891aa", nativeGameId: gid };
    }
  }
  for (const row of rows) {
    if (!row.gameId || !gameIds.includes(row.gameId)) continue;
    const image = getChampionImageUrl(row.images, "128");
    portraits[row.gameId] = { name: row.name, href: row.slug ? `/champions/${row.slug}` : null,
      imageUrl: /^https?:\/\//.test(image) ? image : null,
      className: row.class.charAt(0) + row.class.slice(1).toLowerCase(), color: getChampionClassColors(row.class).color };
  }
  return portraits;
}
