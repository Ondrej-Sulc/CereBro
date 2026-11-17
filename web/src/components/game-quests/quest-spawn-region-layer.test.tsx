// @vitest-environment jsdom
import {act,useState} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import {loadQuestMap} from '@cerebro/core/data/game-quests';
import {loadQuestSpawnRegions} from '@cerebro/core/data/game-quests/spawn-regions';
import type {QuestMap} from '@cerebro/core/domain/game-quests';
import type {QuestSpawnRegionLayer} from '@cerebro/core/domain/game-quests/spawn-regions';
import {regionBoardGeometry,regionBoardLabels} from './quest-spawn-region-presentation';
import {QuestSpawnRegionMarkers} from './quest-spawn-region-layer';

vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
let root:Root|undefined;
afterEach(async()=>{if(root)await act(async()=>root?.unmount());root=undefined;document.body.innerHTML='';});
function Regions({map,layer}:{map:QuestMap;layer:QuestSpawnRegionLayer}){
  const [selected,setSelected]=useState<string>(),[hovered,setHovered]=useState<string|null>(null);
  const board=regionBoardGeometry(map,layer),labels=regionBoardLabels(map,layer,board,[selected,hovered].filter((id):id is string=>typeof id==='string'),1);
  return <svg><QuestSpawnRegionMarkers map={map} layer={layer} point={board.point} selected={selected} hovered={hovered??undefined} pathIndex={0} onChoose={setSelected} onHover={setHovered} uid="region-test" labels={labels}/></svg>;
}
it('retains hover, keyboard-focus and selected region nameplates with exact accessible names',async()=>{
  const map=(await loadQuestMap('realm3'))!,original=(await loadQuestSpawnRegions(map))!,layer={...original,regions:original.regions.slice(0,2)};
  const host=document.createElement('div');document.body.append(host);root=createRoot(host);
  await act(async()=>root!.render(<Regions map={map} layer={layer}/>));
  const first=host.querySelector(`[data-spawn-region="${layer.regions[0].id}"]`)!,second=host.querySelector(`[data-spawn-region="${layer.regions[1].id}"]`)!;
  expect(host.querySelector('[data-map-nameplate]')).toBeNull();
  expect(first.getAttribute('aria-label')).toContain(layer.regions[0].defender.name);
  expect(first.querySelector('title')?.textContent).toContain(layer.regions[0].defender.name);
  await act(async()=>first.dispatchEvent(new MouseEvent('mouseover',{bubbles:true})));
  expect(first.querySelector('[data-map-nameplate]')).not.toBeNull();
  await act(async()=>first.dispatchEvent(new MouseEvent('mouseout',{bubbles:true})));
  expect(first.querySelector('[data-map-nameplate]')).toBeNull();
  await act(async()=>second.dispatchEvent(new FocusEvent('focusin',{bubbles:true})));
  expect(second.querySelector('[data-map-nameplate]')).not.toBeNull();
  await act(async()=>second.dispatchEvent(new FocusEvent('focusout',{bubbles:true})));
  expect(second.querySelector('[data-map-nameplate]')).toBeNull();
  await act(async()=>first.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true})));
  expect(first.getAttribute('aria-pressed')).toBe('true');
  expect(first.querySelector('[data-map-nameplate]')).not.toBeNull();
  expect(second.querySelector('[data-map-nameplate]')).toBeNull();
});
