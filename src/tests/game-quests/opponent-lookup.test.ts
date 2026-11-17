import { expect, it, vi } from "vitest";
import { findQuest, findChampionEncounters, loadQuestMap } from "../../data/game-quests";
import * as questData from "../../data/game-quests";
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
  const rows=Array.from({length:49},(_,i)=>row(i+1));
  const view=opponentResults(rows,{page:"2"});
  expect(view.groups).toHaveLength(24);expect(view.totalQuests).toBe(49);expect(view.totalPages).toBe(3);expect(view.page).toBe(2);
  expect(view.groups[0].quest.id).toBe("quest-25");expect(view.groups.at(-1)?.quest.id).toBe("quest-48");
  expect(opponentResults(rows,{page:"999"}).groups.map(group=>group.quest.id)).toEqual(["quest-49"]);
  expect(opponentResults(rows,{query:"Quest 49",page:"999"}).page).toBe(1);
  expect(opponentResults(rows,{page:"nonsense"}).page).toBe(1);
});

it("counts distinct quests for each filter while excluding that filter's own selection",()=>{
  const six=row(1,{rarity:6});
  const sevenBoss={...row(1,{rarity:7,boss:true}),key:"same-quest-other-build"};
  const special={...row(3,{rarity:7,boss:true}),quest:{...row(3).quest,section:"Special" as const,collection:"The Crucible"}};
  const rows=[six,sevenBoss,sevenBoss,row(2,{rarity:6}),special,row(4,{rarity:5,boss:true})];
  const view=opponentResults(rows,{query:"Quest",section:"Story",rarity:"7",bossOnly:true});
  expect(view.facets).toEqual({all:2,rarities:[{rarity:5,count:1},{rarity:6,count:0},{rarity:7,count:1}],bosses:1});
  expect(view.counts).toEqual({all:2,Story:1,Special:1});
  expect(view.totalQuests).toBe(1);
  expect(opponentResults(rows,{section:"Story"}).facets).toEqual({all:3,rarities:[{rarity:5,count:1},{rarity:6,count:2},{rarity:7,count:1}],bosses:2});
  expect(opponentResults(rows,{query:"unmatched",rarity:"8"}).facets).toEqual({all:0,rarities:[{rarity:5,count:0},{rarity:6,count:0},{rarity:7,count:0},{rarity:8,count:0}],bosses:0});
});

it("sorts only within each collection and uses numeric quest order to break ties",()=>{
  const earlierAct={...row(1,{rarity:7}),quest:{...row(1).quest,actIndex:8}};
  const low=row(10,{rarity:5}), high=row(2,{rarity:7,boss:true}), lowTie=row(3,{rarity:5});
  const rows=[low,high,earlierAct,lowTie];
  expect(opponentResults(rows,{sort:"rarity"}).groups.map(group=>group.quest.id)).toEqual([earlierAct.quest.id,"quest-3","quest-10","quest-2"]);
  expect(opponentResults(rows,{sort:"boss"}).groups.map(group=>group.quest.id)).toEqual([earlierAct.quest.id,"quest-2","quest-3","quest-10"]);
  expect(opponentResults(rows,{sort:"quest"}).groups.map(group=>group.quest.id)).toEqual([earlierAct.quest.id,"quest-2","quest-3","quest-10"]);
});

it("counts all filtered quests in a collection before slicing its page",()=>{
  const rows=Array.from({length:30},(_,i)=>row(i+1));
  const view=opponentResults(rows,{page:"2"});
  expect(view.groups).toHaveLength(6);
  expect(view.collectionCounts).toEqual({"Story:9":30});
  expect(opponentResults(rows,{query:"Quest 30"}).collectionCounts).toEqual({"Story:9":1});
});

it("projects only rank and level bound to the exact fixed encounter and region",async()=>{
  const matches=await loadQuestOpponentMatches("absorbingman");
  for(const match of matches){
    const map=(await loadQuestMap(match.quest.id))!;
    const encounter=map.encounters.find(encounter=>match.key.endsWith(`:${encounter.id}`))!;
    expect({rank:match.rank,level:match.level}).toEqual({rank:encounter.rank,level:encounter.level});
  }
  const region=(await loadQuestOpponentMatches("ex_agentvenom")).find(match=>match.kind==="region")!;
  expect(region.rank).toBeGreaterThan(0);expect(region.level).toBeGreaterThan(0);
});

it("leaves optional build details absent when a map cannot be loaded, preserving index links",async()=>{
  const expected=await loadQuestOpponentMatches("absorbingman");
  const spy=vi.spyOn(questData,"loadQuestMap").mockResolvedValue(undefined);
  try{
    const matches=await loadQuestOpponentMatches("absorbingman");
    expect(matches.map(match=>match.href)).toEqual(expected.map(match=>match.href));
    expect(matches.every(match=>match.rank===undefined&&match.level===undefined)).toBe(true);
    expect(spy).toHaveBeenCalledTimes(new Set(matches.map(match=>match.quest.id)).size);
  }finally{spy.mockRestore();}
});

it.each(["quest","source","map","encounter","gameId","rarity","coordinate","boss","rank","level","ambiguous"])("does not borrow build metadata when its exact binding fails: %s",async reason=>{
  const occurrence=findChampionEncounters("absorbingman")[0];
  const quest=findQuest(occurrence.questId)!;
  const loadOriginal=questData.loadQuestMap;
  const map=structuredClone((await loadOriginal(quest.id))!);
  const encounter=map.encounters.find(encounter=>encounter.id===occurrence.encounterId)!;
  switch(reason){
    case "quest":map.questId="wrong-quest";break;
    case "source":map.sourceHash="wrong-source";break;
    case "map":map.mapId="wrong-map";break;
    case "encounter":map.encounters=map.encounters.filter(row=>row.id!==occurrence.encounterId);break;
    case "gameId":encounter.gameId="another-opponent";break;
    case "rarity":encounter.rarity+=1;break;
    case "coordinate":encounter.coordinate[0]+=1;break;
    case "boss":encounter.final=!encounter.final;break;
    case "rank":encounter.rank=0;break;
    case "level":encounter.level=1.5;break;
    case "ambiguous":map.encounters.push({...encounter});break;
  }
  const spy=vi.spyOn(questData,"loadQuestMap").mockImplementation(id=>id===quest.id?Promise.resolve(map):loadOriginal(id));
  try{
    const matches=await loadQuestOpponentMatches("absorbingman");
    const target=matches.find(match=>match.quest.id===quest.id)!;
    expect(matches).toHaveLength(5);
    expect(target.href).toBe(projectFixedOpponentMatch("absorbingman",quest,occurrence)!.href);
    expect(target.rank).toBeUndefined();expect(target.level).toBeUndefined();
  }finally{spy.mockRestore();}
});

it("loads each matched quest map once even when its index has several matching placements",async()=>{
  const occurrences=findChampionEncounters("absorbingman");
  const occurrenceSpy=vi.spyOn(questData,"findChampionEncounters").mockReturnValue([...occurrences,{...occurrences[0],encounterId:"another-index-placement"}]);
  const mapSpy=vi.spyOn(questData,"loadQuestMap");
  try{
    const matches=await loadQuestOpponentMatches("absorbingman");
    expect(matches).toHaveLength(6);
    expect(mapSpy).toHaveBeenCalledTimes(new Set(occurrences.map(row=>row.questId)).size);
    const unknown=matches.find(match=>match.key.endsWith(":another-index-placement"))!;
    expect(unknown.rank).toBeUndefined();expect(unknown.level).toBeUndefined();
  }finally{mapSpy.mockRestore();occurrenceSpy.mockRestore();}
});
