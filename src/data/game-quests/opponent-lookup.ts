/** Public lookup display model. Exact region matches remain separate from fixed placements. */
import { findChampionEncounters, findQuest, loadQuestMap } from "./index";
import { permanentData } from "./permanent";
import { loadQuestSpawnRegions } from "./spawn-regions";
import { opponentQuest, projectFixedOpponentMatch, type QuestOpponentMatch } from "../../domain/game-quests/opponent-lookup";
import type { QuestSpawnRegionRecord } from "../../domain/game-quests/spawn-regions";

export function validOpponentGameId(value: string) { return /^[a-zA-Z][a-zA-Z0-9_-]{0,159}$/.test(value); }

export async function loadQuestOpponentMatches(gameId: string): Promise<QuestOpponentMatch[]> {
  if(!validOpponentGameId(gameId))return [];
  const matches:QuestOpponentMatch[]=[];
  for(const occurrence of findChampionEncounters(gameId)) {
    const quest=findQuest(occurrence.questId);
    if(!quest)continue;
    const row=projectFixedOpponentMatch(gameId,quest,occurrence);
    if(row){row.quest.collection=permanentData.specialCollections[quest.containerSetName]??"";matches.push(row);}
  }
  const records=[(await import("./spawn-regions/realm3.json")).default,(await import("./spawn-regions/eq_labyrinth.json")).default] as unknown as QuestSpawnRegionRecord[];
  // Load map geometry only for an exact candidate in these two small public region indexes.
  for(const record of records){
    if(!record.regions.some(r=>r.defender.gameId===gameId))continue;
    const quest=findQuest(record.questId),map=quest&&await loadQuestMap(quest.id);
    const layer=map&&await loadQuestSpawnRegions(map);
    if(!quest||!map||!layer)continue;
    for(const region of layer.regions.filter(r=>r.defender.gameId===gameId)){
      const params=new URLSearchParams({region:region.id});
      if(region.pathIndices.length)params.set("path",String(region.pathIndices[0]));
      matches.push({key:`region:${quest.id}:${map.sourceHash}:${region.id}`,kind:"region",rarity:region.defender.rarity,boss:false,opponentName:region.defender.name,portraitUrl:region.defender.imageUrl,href:`/quests/${encodeURIComponent(quest.id)}?${params}`,quest:opponentQuest(quest,permanentData.specialCollections[quest.containerSetName]??"")});
    }
  }
  return [...new Map(matches.map(row=>[row.key,row])).values()];
}
