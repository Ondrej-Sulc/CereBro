import {describe,expect,it} from 'vitest';
import type {QuestMap} from '../../domain/game-quests';
import {applyQuestSwapPoints,type QuestSwapLayer,questSwapLayerSchema} from '../../domain/game-quests/swap-points';
const hash='a'.repeat(64),capture='b'.repeat(64);
const map:QuestMap={version:1,questId:'q',mapId:'m',sourceHash:hash,sourceFile:'base.json',capturedAt:'2026-11-18T12:00:00Z',gridDimension:2,adaptive:false,
 tiles:[[0,0],[1,0]].map((c,index)=>({coordinate:c as [number,number],nodeNumber:index,start:index===0,final:false,hidden:false,links:index===0?[[1,0] as [number,number]]:[],portals:[],randomPortal:false,barrier:'',applications:[]})),
 paths:[{index:0,coordinates:[[0,0],[1,0]]}],encounters:[],rewards:{fixedChampions:[],possibleCrystals:[]}};
const layer:QuestSwapLayer={questId:'q',mapId:'m',sourceHash:hash,publicMapSha256:hash,coverage:'captured',unresolvedChoiceCoordinates:[],definitionSources:{'public-preview/q.json':capture},points:[{id:'q:swap:1,0',coordinate:[1,0],pathIndices:[0],options:[{choiceId:'swapteamselect',swapCount:1,minSwaps:0,nativeDefaultsApplied:[]}],source:{file:'public-preview/q.json',sha256:capture,pointer:'/choices/0',capturedAt:'2026-11-18T12:00:00Z'}}]};
describe('source-bound champion swap points',()=>{
 it('adds a swap layer without changing native map identities or topology',()=>{
  const before=JSON.stringify(map),out=applyQuestSwapPoints(map,layer);
  expect(out.swapPoints?.points[0].coordinate).toEqual([1,0]);expect(out.tiles).toBe(map.tiles);expect(out.paths).toBe(map.paths);expect(JSON.stringify(map)).toBe(before);
 });
 it('rejects foreign maps, coordinates and path memberships',()=>{
  for(const bad of [{...layer,mapId:'other'},{...layer,sourceHash:capture},{...layer,points:[{...layer.points[0],coordinate:[1,1] as [number,number]}]},{...layer,points:[{...layer.points[0],pathIndices:[]}]}])expect(()=>applyQuestSwapPoints(map,bad)).toThrow();
 });
 it('rejects duplicates and unbound public preview sources',()=>{
  expect(()=>applyQuestSwapPoints(map,{...layer,points:[...layer.points,...layer.points]})).toThrow();
  expect(()=>applyQuestSwapPoints(map,{...layer,definitionSources:{}})).toThrow();
 });
 it('never treats generic choices or private state as a swap definition',()=>{
  expect(questSwapLayerSchema.safeParse({...layer,points:[{...layer.points[0],options:[{...layer.points[0].options[0],choiceId:'reward'}]}]}).success).toBe(false);
  expect(questSwapLayerSchema.safeParse({...layer,swappedBids:['secret']}).success).toBe(false);
 });
 it('preserves unknown choice coverage and validates default provenance',()=>{
  const missing:QuestSwapLayer={...layer,coverage:'uncaptured',points:[],definitionSources:{},unresolvedChoiceCoordinates:[[1,0]]};expect(applyQuestSwapPoints(map,missing).swapPoints?.coverage).toBe('uncaptured');
  expect(()=>applyQuestSwapPoints(map,{...missing,coverage:'captured'})).toThrow();
  expect(()=>applyQuestSwapPoints(map,{...layer,points:[{...layer.points[0],options:[{...layer.points[0].options[0],nativeDefaultsApplied:[{field:'swapCount',value:0,basis:'native-constructor'}]}]}]})).toThrow();
 });
});
