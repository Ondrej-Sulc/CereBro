// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import type { QuestTile } from "@cerebro/core/domain/game-quests";
import { getQuestPortalArtwork } from "@cerebro/core/data/game-quests/portal-artwork";
import { QuestMapWaypoint } from "./quest-map-waypoint";
import { QuestPortalVisual } from "./quest-portal-visual";
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
let root:Root|undefined;
afterEach(async()=>{if(root)await act(async()=>root?.unmount());root=undefined;document.body.innerHTML="";});
const tile:QuestTile={coordinate:[1,2],nodeNumber:1,start:false,final:false,hidden:false,links:[],barrier:"",applications:[],randomPortal:false,portals:[{target:[3,4],label:"",tags:[],randomChance:0}]};
async function render(element:ReactNode){const host=document.createElement('div');document.body.append(host);root=createRoot(host);await act(async()=>root!.render(<svg>{element}</svg>));return host;}
it("assembles original halves and quarters around their native center",async()=>{
 const host=await render(<QuestPortalVisual x={100} y={120} selected radius={20}/>);
 expect(host.querySelector('[data-portal-artwork]')?.getAttribute('transform')).toBe('translate(100 120)');
 const halves=[...host.querySelectorAll('[data-portal-layer="entrance"] image')];
 expect(halves).toHaveLength(2);expect(halves[0].getAttribute('href')).toBe(getQuestPortalArtwork('entranceHalf')?.url);
 expect(halves[0].getAttribute('x')).toBe('-20');expect(halves[0].getAttribute('y')).toBe('-20');
 expect(halves[0].getAttribute('width')).toBe('20');expect(halves[0].getAttribute('height')).toBe('40');
 expect(halves.map(image=>image.parentElement?.getAttribute('transform'))).toEqual(['rotate(0)','rotate(180)']);
 const quarters=[...host.querySelectorAll('[data-portal-layer="selection"] image')];expect(quarters).toHaveLength(4);
 expect(quarters.map(image=>image.parentElement?.getAttribute('transform'))).toEqual(['rotate(0)','rotate(90)','rotate(180)','rotate(270)']);
 expect(quarters[0].getAttribute('href')).toBe(getQuestPortalArtwork('exitQuarter')?.url);
 expect(quarters[0].getAttribute('x')).toBe('0');
 expect(host.querySelector('[role="button"], [tabindex]')).toBeNull();
});
it("retains one keyboard and pointer target without changing portal connections",async()=>{
 const choose=vi.fn(),before=structuredClone(tile);
 const host=await render(<QuestMapWaypoint tile={tile} x={80} y={90} label="Portal" active selected={false} portalTarget={false} onChoose={choose}/>);
 const target=host.querySelector('[role="button"]')!;expect(host.querySelectorAll('[role="button"]')).toHaveLength(1);
 expect(target.getAttribute('aria-label')).toBe('Portal');expect(target.getAttribute('tabindex')).toBe('0');
 expect(host.querySelector('[data-portal-artwork]')).not.toBeNull();
 await act(async()=>{target.dispatchEvent(new MouseEvent('click',{bubbles:true}));target.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));target.dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true}));});
 expect(choose).toHaveBeenCalledTimes(3);expect(tile).toEqual(before);
});
it("uses the same native treatment for a destination-only tile",async()=>{
 const host=await render(<QuestMapWaypoint tile={{...tile,portals:[]}} x={80} y={90} label="Map location" active selected portalTarget onChoose={vi.fn()}/>);
 expect(host.querySelector('[role="button"]')?.getAttribute('aria-label')).toBe('Portal destination');
 expect(host.querySelector('[data-portal-artwork]')?.getAttribute('data-selected')).toBe('true');
});
it("keeps start and transit waypoints free of portal art",async()=>{
 const host=await render(<QuestMapWaypoint tile={{...tile,portals:[],start:true}} x={80} y={90} label="Start" active selected={false} portalTarget={false} onChoose={vi.fn()}/>);
 expect(host.querySelector('[data-portal-artwork]')).toBeNull();expect(host.querySelector('[data-map-waypoint="start"]')).not.toBeNull();
});
