import { hierarchyLabel, type EncounterOccurrence, type QuestSummary } from "./index";

export type QuestOpponentMatch = {
  key: string; kind: "fixed" | "region"; rarity: number; boss: boolean; href: string; opponentName?: string; portraitUrl?: string;
  quest: { id: string; number: string; name: string; section: "Story" | "Special"; collection: string; difficulty: string; actIndex: number; chapterIndex: number; questIndex: number };
};
export type OpponentFilters = { query?: string; section?: string; rarity?: string; bossOnly?: boolean; page?: string };

export function opponentQuest(quest: QuestSummary, collection = ""): QuestOpponentMatch["quest"] {
  return {id:quest.id,number:hierarchyLabel(quest),name:quest.name,section:quest.section==="Special"?"Special":"Story",collection,difficulty:quest.difficulty,actIndex:quest.actIndex,chapterIndex:quest.chapterIndex,questIndex:quest.questIndex};
}

export function projectFixedOpponentMatch(gameId: string, quest: QuestSummary, e: EncounterOccurrence): QuestOpponentMatch | undefined {
  if(e.gameId!==gameId||e.questId!==quest.id||e.mapId!==quest.mapId||e.sourceHash!==quest.mapSourceHash||quest.coverage!=="full-map"||!["Story","Special"].includes(quest.section??""))return undefined;
  const params=new URLSearchParams({node:e.coordinate.join(",")});
  if(e.pathIndices.length)params.set("path",String(e.pathIndices[0]));
  return {key:`fixed:${e.questId}:${e.sourceHash}:${e.encounterId}`,kind:"fixed",rarity:e.rarity,boss:e.final,opponentName:e.name,href:`/quests/${encodeURIComponent(quest.id)}?${params}`,quest:opponentQuest(quest)};
}

export function opponentResults(matches: QuestOpponentMatch[], filters: OpponentFilters) {
  const terms=(filters.query??"").trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const unique=[...new Map(matches.map(row=>[row.key,row])).values()];
  const eligible=unique.filter(row=>(!filters.rarity||String(row.rarity)===filters.rarity)&&(!filters.bossOnly||row.boss)&&terms.every(term=>[row.quest.name,row.quest.number,row.quest.collection,row.quest.difficulty].join(" ").toLocaleLowerCase().includes(term)));
  const grouped=new Map<string,{quest:QuestOpponentMatch["quest"];matches:QuestOpponentMatch[]}>();
  for(const row of eligible){const group=grouped.get(row.quest.id)??{quest:row.quest,matches:[]};group.matches.push(row);grouped.set(row.quest.id,group);}
  const groups=[...grouped.values()].sort((a,b)=>{
    const section=(a.quest.section==="Story"?0:1)-(b.quest.section==="Story"?0:1);
    return section||(a.quest.section==="Special"?a.quest.collection.localeCompare(b.quest.collection):0)||a.quest.actIndex-b.quest.actIndex||a.quest.chapterIndex-b.quest.chapterIndex||a.quest.questIndex-b.quest.questIndex||a.quest.id.localeCompare(b.quest.id);
  });
  const counts={all:groups.length,Story:groups.filter(g=>g.quest.section==="Story").length,Special:groups.filter(g=>g.quest.section==="Special").length};
  const selected=groups.filter(g=>!filters.section||g.quest.section===filters.section);
  const totalPages=Math.max(1,Math.ceil(selected.length/12));
  const parsed=Number(filters.page);
  const page=Math.min(totalPages,Number.isSafeInteger(parsed)&&parsed>0?parsed:1);
  return {groups:selected.slice((page-1)*12,page*12),totalQuests:selected.length,totalMatches:selected.reduce((n,g)=>n+g.matches.length,0),counts,page,totalPages,hasRegions:selected.some(g=>g.matches.some(m=>m.kind==="region"))};
}
