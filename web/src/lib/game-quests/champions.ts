import { prisma } from "@/lib/prisma";
import { getFromCache } from "@/lib/cache";
import type { QuestMap, QuestSummary } from "@cerebro/core/domain/game-quests";
import { getBossPreview, permanentData } from "@cerebro/core/data/game-quests/permanent";
import { projectQuestPortraits, questChampionGameIds, type QuestPortrait } from "./presentation";
import type { QuestRewardRecord } from "@cerebro/core/data/game-quests/rewards";
import { questGateChampionGameIds, projectQuestGatePortraits } from "./gate-presentation";
export async function loadRewardPortraits(record:QuestRewardRecord){
 const identities=Object.values(record.scopes).flatMap(rows=>rows.flatMap(r=>r.identity?[r.identity]:[]));
 const gameIds=questChampionGameIds({encounters:[],rewards:{fixedChampions:identities}});
 const rows=gameIds.length?await getFromCache(`quest-reward-portraits-v2:${gameIds.join(",")}`,3600,()=>prisma.champion.findMany({where:{gameId:{in:gameIds}},select:{id:true,gameId:true,name:true,slug:true,images:true,class:true}})):[];
 return projectQuestPortraits({encounters:[],rewards:{fixedChampions:identities}},rows);
}

export async function loadQuestPortraits(map: QuestMap) {
  const gameIds = [...new Set([...questChampionGameIds(map), ...questGateChampionGameIds(map)])].sort();
  const native:Record<string,QuestPortrait>={};
  for(const encounter of map.encounters) {
    const art=permanentData.nativePortraits[encounter.gameId];
    if(encounter.champion || !art || art.character!==encounter.gameId || art.sourceBcgSha256!==permanentData.bcgSha256)continue;
    native[encounter.gameId]={name:encounter.name,href:null,imageUrl:art.url,className:"NPC / legacy defender",color:"#7891aa",nativeGameId:encounter.gameId};
  }
  const rows = gameIds.length ? await getFromCache(`quest-portraits-v2:${gameIds.join(",")}`, 3600, () => prisma.champion.findMany({
    where: { gameId: { in: gameIds } },
    select: { id: true, gameId: true, name: true, slug: true, images: true, class: true },
  })) : [];
  for (const [gameId, portrait] of Object.entries({ ...projectQuestPortraits(map, rows), ...projectQuestGatePortraits(map, rows) })) native[gameId] = { ...portrait, imageUrl: portrait.imageUrl ?? native[gameId]?.imageUrl ?? null };
  return native;
}

export async function loadBossPortraits(quests: QuestSummary[]) {
  const identities = quests.flatMap(q => {
    return getBossPreview(q)?.bosses ?? [];
  });
  const gameIds=questChampionGameIds({encounters:identities,rewards:{fixedChampions:[]}});
  if (!gameIds.length) return {};
  const rows=await getFromCache(`quest-boss-portraits-v2:${gameIds.join(",")}`,3600,()=>prisma.champion.findMany({where:{gameId:{in:gameIds}},select:{id:true,gameId:true,name:true,slug:true,images:true,class:true}}));
  // Public reader uses only these exact identities. No candidate becomes a placed encounter.
  const sample={encounters:identities,rewards:{fixedChampions:[]}};
  return projectQuestPortraits(sample,rows);
}
