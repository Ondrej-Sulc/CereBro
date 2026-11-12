import { expect, it } from "vitest";
import { findQuest, findChampionEncounters } from "../../data/game-quests";
import { loadQuestOpponentMatches } from "../../data/game-quests/opponent-lookup";
import { opponentResults, projectFixedOpponentMatch, type QuestOpponentMatch } from "../../domain/game-quests/opponent-lookup";

it("finds all five exact Absorbing Man placements and links directly to their selected encounters", async () => {
  const rows=await loadQuestOpponentMatches("absorbingman");
  expect(rows).toHaveLength(5);
  expect(rows.every(row=>row.kind==="fixed"&&row.rarity===7)).toBe(true);
  const view=opponentResults(rows,{});
  expect(view.counts).toEqual({all:5,Story:3,Special:2});
  expect(view.groups.slice(0,3).map(g=>g.quest.number)).toEqual(["9.2.4","9.3.1","9.4.1"]);
  expect(view.groups.filter(g=>g.quest.section==="Special").every(g=>g.quest.collection==="The Epoch of Pain")).toBe(true);
  for(const row of rows){const url=new URL(row.href,"https://example.test");expect(url.pathname).toBe(`/quests/${row.quest.id}`);expect(url.searchParams.get("node")).toMatch(/^\d+,\d+$/);expect(url.searchParams.has("region")).toBe(false);}
});

it("does not combine native NPC regions with playable champions or fixed placements",async()=>{
  const npc=await loadQuestOpponentMatches("ex_agentvenom");
  expect(npc.some(row=>row.kind==="region")).toBe(true);
  for(const row of npc.filter(r=>r.kind==="region")){const url=new URL(row.href,"https://example.test");expect(url.searchParams.has("region")).toBe(true);expect(url.searchParams.has("node")).toBe(false);expect(row.boss).toBe(false);}
  const playable=await loadQuestOpponentMatches("agentvenom");
  expect(playable.some(row=>row.kind==="region")).toBe(false);
  expect(await loadQuestOpponentMatches("not-a-known-opponent")).toEqual([]);
});

it("rejects mismatched source, map and game identities before producing a fixed encounter link",()=>{
  const e=findChampionEncounters("absorbingman")[0],q=findQuest(e.questId)!;
  expect(projectFixedOpponentMatch("absorbingman",q,e)).toBeDefined();
  expect(projectFixedOpponentMatch("absorbingman",{...q,mapSourceHash:"other"},e)).toBeUndefined();
  expect(projectFixedOpponentMatch("absorbingman",q,{...e,mapId:"other"})).toBeUndefined();
  expect(projectFixedOpponentMatch("other",q,e)).toBeUndefined();
});

function row(index:number,extra:Partial<QuestOpponentMatch>={}):QuestOpponentMatch{return {key:`fixed:${index}`,kind:"fixed",rarity:7,boss:false,href:`/quests/example-${index}?node=1%2C1`,quest:{id:`quest-${index}`,number:`9.2.${index}`,name:`Quest ${index}`,section:"Story",collection:"",difficulty:"",actIndex:9,chapterIndex:2,questIndex:index},...extra};}

it("groups duplicate index entries once, sorts numeric quest numbers and keeps distinct matches",()=>{
  const one=row(2),two=row(10),another={...one,key:"another",rarity:6};
  const view=opponentResults([two,one,one,another],{});
  expect(view.groups.map(g=>g.quest.number)).toEqual(["9.2.2","9.2.10"]);
  expect(view.groups[0].matches).toHaveLength(2);
  expect(view.totalMatches).toBe(3);
});

it("combines name, category, rarity and boss filters without losing the result counts",()=>{
  const special={...row(2,{rarity:6,boss:true}),quest:{...row(2).quest,section:"Special" as const,collection:"The Crucible"}};
  const view=opponentResults([row(1),special],{query:"crucible",section:"Special",rarity:"6",bossOnly:true});
  expect(view.groups).toHaveLength(1);expect(view.counts).toEqual({all:1,Story:0,Special:1});
  expect(opponentResults([special],{rarity:"7"}).groups).toEqual([]);
});

it("bounds page size and restores valid pagination after filters reduce the results",()=>{
  const rows=Array.from({length:25},(_,i)=>row(i+1));
  const view=opponentResults(rows,{page:"2"});
  expect(view.groups).toHaveLength(12);expect(view.totalQuests).toBe(25);expect(view.totalPages).toBe(3);expect(view.page).toBe(2);
  expect(opponentResults(rows,{query:"Quest 25",page:"999"}).page).toBe(1);
  expect(opponentResults(rows,{page:"nonsense"}).page).toBe(1);
});
