import { prisma } from "@/lib/prisma";
import { getFromCache } from "@/lib/cache";
import type { QuestMap, QuestSummary } from "@cerebro/core/domain/game-quests";
import { getBossPreview, permanentData } from "@cerebro/core/data/game-quests/permanent";
import { projectQuestPortraits, questChampionGameIds, type QuestPortrait } from "./presentation";
import type { QuestRewardRecord } from "@cerebro/core/data/game-quests/rewards";
export async function loadRewardPortraits(record:QuestRewardRecord){
 const identities=Object.values(record.scopes).flatMap(rows=>rows.flatMap(r=>r.identity?[r.identity]:[]));
 const gameIds=[...new Set(identities.filter(r=>r.champion).map(r=>r.gameId))];
 const rows=gameIds.length?await getFromCache(`quest-reward-portraits:${gameIds.join(",")}`,3600,()=>prisma.champion.findMany({where:{gameId:{in:gameIds},isPlayable:true},select:{gameId:true,name:true,slug:true,images:true,class:true}})):[];
 return projectQuestPortraits({encounters:[],rewards:{fixedChampions:identities}},rows);
}

export async function loadQuestPortraits(map: QuestMap) {
  const gameIds = questChampionGameIds(map);
  const native:Record<string,QuestPortrait>={};
  for(const encounter of map.encounters) {
    const art=permanentData.nativePortraits[encounter.gameId];
    if(encounter.champion || !art || art.character!==encounter.gameId || art.sourceBcgSha256!==permanentData.bcgSha256)continue;
    native[encounter.gameId]={name:encounter.name,href:null,imageUrl:art.url,className:"NPC / legacy defender",color:"#7891aa",nativeGameId:encounter.gameId};
  }
  const rows = gameIds.length ? await getFromCache(`quest-portraits-v1:${gameIds.join(",")}`, 3600, () => prisma.champion.findMany({
    where: { gameId: { in: gameIds }, isPlayable: true },
    select: { gameId: true, name: true, slug: true, images: true, class: true },
  })) : [];
  return {...native,...projectQuestPortraits(map, rows)};
}

export async function loadBossPortraits(quests: QuestSummary[]) {
  const identities = quests.flatMap(q => {
    return getBossPreview(q)?.bosses ?? [];
  });
  const gameIds=[...new Set(identities.filter(b=>b.champion).map(b=>b.gameId))].sort();
  if (!gameIds.length) return {};
  const rows=await getFromCache(`quest-boss-portraits-v1:${gameIds.join(",")}`,3600,()=>prisma.champion.findMany({where:{gameId:{in:gameIds},isPlayable:true},select:{gameId:true,name:true,slug:true,images:true,class:true}}));
  // Public reader uses only these exact identities. No candidate becomes a placed encounter.
  const sample={encounters:identities,rewards:{fixedChampions:[]}};
  return projectQuestPortraits(sample,rows);
}
