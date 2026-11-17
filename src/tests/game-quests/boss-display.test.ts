import {describe,expect,it} from 'vitest';
import {questEncounterIsBoss} from '../../domain/game-quests/boss-display';

const encounter={id:'placed-boss',final:false};
const none={tileIsFinalBoss:false,tileShouldDisplayFinalBossIcon:false,bossIsFinalBoss:false,bossMetadataFinalBoss:false};

describe('source-bound quest boss display',()=>{
 it('honours each explicit native boss or boss-icon flag independently',()=>{
  for(const key of Object.keys(none))expect(questEncounterIsBoss({nativeBossFlags:{[encounter.id]:{...none,[key]:true}}},encounter)).toBe(true);
 });
 it('uses explicit negative flags instead of assuming a fight at the finish is a boss',()=>{
  expect(questEncounterIsBoss({nativeBossFlags:{[encounter.id]:none}},{...encounter,final:true})).toBe(false);
 });
 it('does not borrow another encounter identity or turn missing data into a boss',()=>{
  expect(questEncounterIsBoss({nativeBossFlags:{other:{...none,bossMetadataFinalBoss:true}}},encounter)).toBe(false);
  expect(questEncounterIsBoss({},encounter)).toBe(false);
 });
 it('retains the existing final-encounter fallback only when no native flag entry exists',()=>{
  expect(questEncounterIsBoss({},{...encounter,final:true})).toBe(true);
 });
});
