import {expect,it} from 'vitest';
import {loadQuestMap} from '../../data/game-quests';
import data from '../../data/game-quests/swap-points.json';
it('loads exact public swap previews while distinguishing unverified Special choices',async()=>{
 expect(data.counts).toMatchObject({maps:234,swapMaps:96,swapPoints:154,unverifiedMaps:8});
 const map=(await loadQuestMap('a09_ch03_q01'))!;
 expect(map.swapPoints?.coverage).toBe('captured');
 const point=map.swapPoints!.points.find(point=>point.coordinate.join(',')==='31,18')!;
 expect(point.options).toEqual([{choiceId:'swapteamselect',swapCount:1,minSwaps:0,nativeDefaultsApplied:[{field:'minSwaps',value:0,basis:'native-constructor'}]}]);
 expect(point.pathIndices.length).toBeGreaterThan(0);
 const act10=(await loadQuestMap('epilogue_ch01_q01'))!;
 expect(act10.swapPoints).toMatchObject({coverage:'captured',points:[]});
 const crucible=(await loadQuestMap('me_crucible_ch01_q01'))!;
 expect(crucible.swapPoints).toMatchObject({coverage:'uncaptured',points:[]});
 expect(crucible.swapPoints!.unresolvedChoiceCoordinates.length).toBeGreaterThan(0);
},60000);
