import {describe,expect,it} from 'vitest';
import {loadQuestMap,questCatalog} from '../../data/game-quests';
import {questEncounterIsBoss} from '../../domain/game-quests/boss-display';

describe('published quest boss metadata',()=>{
 it('marks the three saved Act 9 boss-icon encounters, without treating the empty finish as a defender',async()=>{
  const map=(await loadQuestMap('a09_ch03_q02'))!;
  expect(map.encounters.filter(encounter=>questEncounterIsBoss(map,encounter)).map(encounter=>encounter.coordinate.join(','))).toEqual(['37,7','37,13','37,19']);
  expect(map.tiles.find(tile=>tile.coordinate.join(',')==='40,10')?.final).toBe(true);
  expect(map.encounters.some(encounter=>encounter.coordinate.join(',')==='40,10')).toBe(false);
 });
 it('binds every public map placement to its independently captured native boss flags',async()=>{
  let maps=0,placements=0;
  for(const quest of questCatalog.filter(quest=>quest.coverage==='full-map')){
   const map=await loadQuestMap(quest.id);expect(map,quest.id).toBeDefined();
   if(!map)continue;
   expect(Object.keys(map.nativeBossFlags??{}).sort(),quest.id).toEqual(map.encounters.map(encounter=>encounter.id).sort());
   maps++;placements+=map.encounters.length;
  }
  expect(maps).toBeGreaterThan(200);expect(placements).toBeGreaterThan(5000);
 },60000);
});
