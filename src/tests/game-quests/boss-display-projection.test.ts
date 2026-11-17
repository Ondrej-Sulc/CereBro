import {describe,expect,it} from 'vitest';
import {applyQuestBossDisplay,questEncounterIsBoss,type QuestBossDisplayObservation} from '../../domain/game-quests/boss-display';
import type {QuestMap} from '../../domain/game-quests';

const flags={tileIsFinalBoss:false,tileShouldDisplayFinalBossIcon:true,bossIsFinalBoss:false,bossMetadataFinalBoss:true};
const map:QuestMap={version:1,questId:'q',mapId:'m',sourceHash:'source-a',capturedAt:'2026-11-17',sourceFile:'frozen.json',gridDimension:3,adaptive:false,tiles:[],paths:[],encounters:[{id:'q:1,1:boss',coordinate:[1,1],bossKey:'exact-boss',final:false,rank:1,level:1,signature:0,ascension:0,candidates:[],pathIndices:[],tierId:'native_t1',gameId:'native',rarity:1,name:'Native defender',champion:null}],rewards:{fixedChampions:[],possibleCrystals:[]}};
const observation:QuestBossDisplayObservation={questId:'q',mapId:'m',sourceHash:'source-a',encounters:[{...flags,id:map.encounters[0].id,coordinate:[1,1],bossKey:'exact-boss'}]};

describe('frozen native boss flag projection',()=>{
 it('adds flags to the exact placement without changing identities, builds, source data or map geometry',()=>{
  const before=JSON.stringify(map),result=applyQuestBossDisplay(map,[observation]);
  expect(questEncounterIsBoss(result,map.encounters[0])).toBe(true);
  expect(result.encounters).toBe(map.encounters);expect(result.tiles).toBe(map.tiles);expect(result.paths).toBe(map.paths);
  expect(result.sourceHash).toBe(map.sourceHash);expect(JSON.stringify(map)).toBe(before);
 });
 it('does not apply observations from another quest, map or source revision',()=>{
  for(const patch of [{questId:'other'},{mapId:'other'},{sourceHash:'source-b'}])expect(applyQuestBossDisplay(map,[{...observation,...patch}])).toBe(map);
 });
 it('rejects ambiguous observations, new placements and omitted placements',()=>{
  expect(()=>applyQuestBossDisplay(map,[observation,observation])).toThrow(/Ambiguous/);
  for(const encounters of [[],[...observation.encounters,...observation.encounters]])expect(()=>applyQuestBossDisplay(map,[{...observation,encounters}])).toThrow(/count mismatch/);
 });
 it('rejects a changed placement identity, coordinate or exact native boss key',()=>{
  for(const patch of [{id:'wrong'},{coordinate:[2,1] as [number,number]},{bossKey:'different'}])expect(()=>applyQuestBossDisplay(map,[{...observation,encounters:[{...observation.encounters[0],...patch}]}])).toThrow(/placement mismatch/);
 });
 it('rejects malformed flags and conflicts with already captured native flags',()=>{
  const malformed={...observation,encounters:[{...observation.encounters[0],tileIsFinalBoss:'true'}]} as unknown as QuestBossDisplayObservation;
  expect(()=>applyQuestBossDisplay(map,[malformed])).toThrow(/Invalid native/);
  const existing={...map,nativeBossFlags:{[map.encounters[0].id]:{...flags,bossIsFinalBoss:true}}};
  expect(()=>applyQuestBossDisplay(existing,[observation])).toThrow(/Conflicting/);
 });
});
