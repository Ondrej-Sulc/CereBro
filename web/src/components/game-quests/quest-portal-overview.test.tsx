// @vitest-environment jsdom
import { act, createRef } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import type { QuestMap } from "@cerebro/core/domain/game-quests";
import { getQuestPortalArtwork } from "@cerebro/core/data/game-quests/portal-artwork";
import { QuestBoard } from "./quest-board";

it("marks only exact portal endpoints in the automatic overview without changing the map",async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});
 vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockReturnValue(300);vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(200);
 const scroll=HTMLElement.prototype.scrollTo;HTMLElement.prototype.scrollTo=vi.fn();
 const coordinates:[number,number][]=[[0,0],[1,0],[3,0]];
 const map:QuestMap={version:1,questId:'portal',mapId:'portal',sourceHash:'source',sourceFile:'frozen.json',capturedAt:'',gridDimension:5,adaptive:false,encounters:[],rewards:{fixedChampions:[],possibleCrystals:[]},paths:[{index:0,coordinates}],tiles:coordinates.map((coordinate,i)=>({coordinate,nodeNumber:i,start:i===0,final:i===2,hidden:false,links:i===0?[coordinates[1]]:[],portals:i===1?[{target:coordinates[2],label:'',randomChance:0,tags:[]}]:[],randomPortal:false,barrier:'',applications:[]}))};
 const before=JSON.stringify(map),host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(<QuestBoard map={map} selected="0,0" pathIndex={0} portraits={{}} onChoose={vi.fn()} viewportRef={createRef<HTMLDivElement>()}/>));
  expect(host.querySelector('[aria-label="Map overview"]')).toBeNull();
  await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Zoom in"]')!.click());
  const markers=[...host.querySelectorAll('[aria-label="Map overview"] [data-overview-portal]')];
  expect(markers).toHaveLength(2);expect(markers.every(marker=>marker.getAttribute('href')===getQuestPortalArtwork('small')?.url)).toBe(true);
  expect(JSON.stringify(map)).toBe(before);
 }finally{await act(async()=>root.unmount());host.remove();HTMLElement.prototype.scrollTo=scroll;vi.restoreAllMocks();vi.unstubAllGlobals();}
});
