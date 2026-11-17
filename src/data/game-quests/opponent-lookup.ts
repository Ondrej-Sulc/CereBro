/** Public lookup display model. Exact region matches remain separate from fixed placements. */
import { findChampionEncounters, findQuest, loadQuestMap } from "./index";
import { permanentData } from "./permanent";
import { loadQuestSpawnRegions } from "./spawn-regions";
import { opponentQuest, projectFixedOpponentMatch, type QuestOpponentMatch } from "../../domain/game-quests/opponent-lookup";
import type { QuestSpawnRegionRecord } from "../../domain/game-quests/spawn-regions";
import type { EncounterOccurrence, QuestMap, QuestSummary } from "../../domain/game-quests";

export function validOpponentGameId(value: string) { return /^[a-zA-Z][a-zA-Z0-9_-]{0,159}$/.test(value); }

/** Optional build details never borrow a nearby node, candidate, or another source version. */
function fixedBuild(quest:QuestSummary,occurrence:EncounterOccurrence,map:QuestMap|undefined) {
  if(!map||map.questId!==quest.id||map.questId!==occurrence.questId||map.mapId!==quest.mapId||map.mapId!==occurrence.mapId
    ||map.sourceHash!==quest.mapSourceHash||map.sourceHash!==occurrence.sourceHash)return undefined;
  const candidates=map.encounters.filter(encounter=>encounter.id===occurrence.encounterId);
  if(candidates.length!==1)return undefined;
  const encounter=candidates[0];
  if(encounter.gameId!==occurrence.gameId||encounter.rarity!==occurrence.rarity||encounter.final!==occurrence.final
    ||encounter.coordinate[0]!==occurrence.coordinate[0]||encounter.coordinate[1]!==occurrence.coordinate[1]
    ||![encounter.rank,encounter.level].every(value=>Number.isSafeInteger(value)&&value>0))return undefined;
  return {rank:encounter.rank,level:encounter.level};
}

export async function loadQuestOpponentMatches(gameId: string): Promise<QuestOpponentMatch[]> {
  if(!validOpponentGameId(gameId))return [];
  const matches:QuestOpponentMatch[]=[];
  // Reuse the optional map read for every placement in a quest, including region metadata.
  const maps=new Map<string,Promise<QuestMap|undefined>>();
  const mapFor=(questId:string)=>{
    let pending=maps.get(questId);
    if(!pending){pending=loadQuestMap(questId).catch(()=>undefined);maps.set(questId,pending);}
    return pending;
  };
  const builds:Promise<void>[]=[];
  for(const occurrence of findChampionEncounters(gameId)) {
    const quest=findQuest(occurrence.questId);
    if(!quest)continue;
    const row=projectFixedOpponentMatch(gameId,quest,occurrence);
    if(row){
      row.quest.collection=permanentData.specialCollections[quest.containerSetName]??"";matches.push(row);
      builds.push(mapFor(quest.id).then(map=>{const build=fixedBuild(quest,occurrence,map);if(build)Object.assign(row,build);}));
    }
  }
  await Promise.all(builds);
  const records=[(await import("./spawn-regions/realm3.json")).default,(await import("./spawn-regions/eq_labyrinth.json")).default] as unknown as QuestSpawnRegionRecord[];
  // Load map geometry only for an exact candidate in these two small public region indexes.
  for(const record of records){
    if(!record.regions.some(r=>r.defender.gameId===gameId))continue;
    const quest=findQuest(record.questId),map=quest&&await mapFor(quest.id);
    const layer=map&&await loadQuestSpawnRegions(map);
    if(!quest||!map||!layer)continue;
    for(const region of layer.regions.filter(r=>r.defender.gameId===gameId)){
      const params=new URLSearchParams({region:region.id});
      if(region.pathIndices.length)params.set("path",String(region.pathIndices[0]));
      matches.push({key:`region:${quest.id}:${map.sourceHash}:${region.id}`,kind:"region",rarity:region.defender.rarity,rank:region.defender.rank,level:region.defender.level,boss:false,opponentName:region.defender.name,portraitUrl:region.defender.imageUrl,href:`/quests/${encodeURIComponent(quest.id)}?${params}`,quest:opponentQuest(quest,permanentData.specialCollections[quest.containerSetName]??"")});
    }
  }
  return [...new Map(matches.map(row=>[row.key,row])).values()];
}
