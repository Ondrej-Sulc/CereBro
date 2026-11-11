import { expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { questCatalog, loadQuestMap, findQuest, findChampionEncounters } from "../../data/game-quests";
import { act10Data } from "../../data/game-quests/act10";
import { getQuestRewardRecord, questRewardsSource } from "../../data/game-quests/rewards";
import { permanentData, getBossPreview } from "../../data/game-quests/permanent";
import { validateQuestMap, routeEncounters } from "../../domain/game-quests";

it("loads all16 real Act10 maps and establishes234/234 coverage without changing catalog identities",async()=>{
  expect(questCatalog).toHaveLength(234);
  expect(questCatalog.filter(q=>q.coverage==="full-map")).toHaveLength(234);
  expect(questCatalog.filter(q=>q.section==="Special")).toHaveLength(50);
  const ids=Object.keys(act10Data.maps);expect(ids).toHaveLength(16);
  const totals={tiles:0,paths:0,placements:0,portals:0,applications:0};
  for(const id of ids){
    const q=findQuest(id)!,map=(await loadQuestMap(id))!,meta=act10Data.maps[id];
    expect([q.actIndex,q.coverage,map.questId,map.mapId,map.sourceHash]).toEqual([10,"full-map",id,id,meta.sourceHash]);
    expect(validateQuestMap(map),id).toEqual([]);
    expect(createHash("sha256").update(readFileSync(`src/data/game-quests/act10-maps/${id}.json`)).digest("hex")).toBe(meta.publicMapSha256);
    totals.tiles+=map.tiles.length;totals.paths+=map.paths.length;totals.placements+=map.encounters.length;
    totals.portals+=map.tiles.reduce((n,t)=>n+t.portals.length,0);totals.applications+=map.tiles.reduce((n,t)=>n+t.applications.length,0);
    expect(map.tiles.flatMap(t=>t.applications).every(a=>a.iconKey===null&&a.description===null&&a.parameters.definitionCoverage==="unresolved-native-definition-version")).toBe(true);
    for(const e of map.encounters){
      expect(findChampionEncounters(e.gameId)).toContainEqual(expect.objectContaining({questId:id,encounterId:e.id,sourceHash:meta.sourceHash}));
      if(!e.champion){const art=permanentData.nativePortraits[e.gameId];expect(art.character).toBe(e.gameId);expect(art.sourceBcgSha256).toBe(act10Data.bcgSha256);}
    }
    const reward=getQuestRewardRecord(q)!;expect(reward.sourceHash).toBe(meta.sourceHash);
    expect(questRewardsSource[reward.sourceHash].capturedAt).toBe(map.capturedAt);
    expect(getBossPreview(q)).toBeDefined();
  }
  expect(totals).toEqual({tiles:249,paths:37,placements:32,portals:13,applications:271});
});

it("keeps real branched placements separate from unplaced preview bosses and preserves six shared-boss routes",async()=>{
  const branch=(await loadQuestMap("epilogue_ch01_q01"))!;
  expect(branch.encounters.map(e=>e.gameId)).toEqual(["scarletwitch_current","hulkbuster_movie","hulk_ragnarok"]);
  expect(branch.encounters.some(e=>e.gameId==="doctorbong")).toBe(false);
  expect(branch.paths.map((_,i)=>routeEncounters(branch,i).length)).toEqual([1,1,1]);
  const longest=(await loadQuestMap("epilogue_ch04_q04"))!;
  expect(longest.tiles).toHaveLength(62);expect(longest.paths).toHaveLength(6);expect(longest.encounters).toHaveLength(1);
  expect(longest.encounters[0]).toMatchObject({gameId:"chronoserpent",champion:null,final:true,pathIndices:[0,1,2,3,4,5]});
  for(const id of ["epilogue_ch05_q01","__proto__","../../private"]){expect(await loadQuestMap(id)).toBeUndefined();}
});
