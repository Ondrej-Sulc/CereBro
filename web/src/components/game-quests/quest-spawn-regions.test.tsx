// @vitest-environment jsdom
import { act } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadQuestMap } from "../../../../src/data/game-quests";
import { loadQuestSpawnRegions } from "../../../../src/data/game-quests/spawn-regions";
import type { QuestSpawnRegionLayer } from "../../../../src/domain/game-quests/spawn-regions";
import { QuestMapExplorer } from "./quest-map-explorer";
import { regionBoardGeometry, regionCorridors } from "./quest-spawn-region-presentation";

vi.mock("next/link", () => ({ default: ({ href, children, prefetch, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>&{prefetch?:boolean}) => {void prefetch;return <a href={href} {...props}>{children}</a>;} }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
HTMLElement.prototype.scrollBy = vi.fn();
HTMLElement.prototype.scrollTo = vi.fn();
let root: Root | undefined;
afterEach(async () => { if (root) await act(async () => root?.unmount()); document.body.innerHTML = ""; window.history.replaceState(null,"","/"); });
async function setup(initialRegion?: string) {
  const map=(await loadQuestMap("realm3"))!;
  const coordinates=map.paths[0].coordinates.slice(2,5);
  const layer: QuestSpawnRegionLayer={questId:map.questId,unmappedDefinitionCount:1,provenance:{geometry:"game",defenderBindings:"archived-reference"},regions:[{
    id:"fixture-region",anchor:coordinates[1],coordinates,pathIndices:[0],definitionCandidateCount:2,
    defender:{tierId:"npc_abyss_thing_t6",gameId:"ex_thing",name:"EX. THING",rarity:6,imageUrl:"/game-quests/unplaced-art/native-thing.webp",rank:5,level:65,signature:200,ascensionTier:0},
  }]};
  const host=document.createElement("div");document.body.append(host);root=createRoot(host);
  await act(async()=>root!.render(<QuestMapExplorer map={map} spawnRegions={layer} initialRegion={initialRegion}/>));
  return {host,map,layer};
}
describe("spawn-region map presentation",()=>{
  it("shows a representative portrait and all possible tiles without adding a fixed encounter",async()=>{
    const {host,map,layer}=await setup();
    expect(host.querySelectorAll('[data-map-encounter]')).toHaveLength(map.encounters.length);
    expect(host.querySelector('[data-spawn-region="fixture-region"]')).not.toBeNull();
    expect(host.querySelectorAll('[data-region-tile="fixture-region"]')).toHaveLength(layer.regions[0].coordinates.length);
    expect(host.querySelector('[data-encounter-coverage]')).toBeNull();
    expect(host.textContent).toContain("1 encounter region");
    expect(host.querySelector('[aria-label="Recorded routes"] option')?.textContent).toBe("Route 1 · 2 defenders");
  });
  it("selects a region by keyboard, shares its identity and restores it with Back",async()=>{
    const {host,layer}=await setup();
    const marker=host.querySelector('[data-spawn-region="fixture-region"]')!;
    await act(async()=>marker.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true})));
    expect(marker.getAttribute('aria-pressed')).toBe("true");
    expect(host.querySelector('[data-region-inspector]')?.textContent).toContain("Exact trigger tile varies");
    expect(host.querySelector('[data-region-inspector]')?.textContent).not.toContain("Node applications");
    const share=host.querySelector<HTMLAnchorElement>('[data-region-share]')!;
    expect(share.getAttribute('href')).toContain("region=fixture-region");
    expect(new URL(share.href).searchParams.has('node')).toBe(false);
    const regionUrl=window.location.href;
    const tile=host.querySelector<SVGGElement>(`[data-coordinate="${layer.regions[0].coordinates[0].join(',')}"]:not([data-spawn-region])`)!;
    await act(async()=>tile.dispatchEvent(new MouseEvent('click',{bubbles:true})));
    expect(host.querySelector('[data-region-inspector]')).toBeNull();
    await act(async()=>{window.history.replaceState(null,'',regionUrl);window.dispatchEvent(new PopStateEvent('popstate'));});
    expect(host.querySelector('[data-region-inspector]')).not.toBeNull();
    expect(marker.getAttribute('aria-pressed')).toBe("true");
  });
  it("counts a region once, filters it by route, and preserves selection while zooming",async()=>{
    const {host}=await setup("fixture-region");
    const scale=Number(host.querySelector('[data-zoom]')?.getAttribute('data-zoom'));
    await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Zoom in"]')!.click());
    expect(Number(host.querySelector('[data-zoom]')?.getAttribute('data-zoom'))).toBeGreaterThan(scale);
    expect(host.querySelector('[data-region-inspector]')).not.toBeNull();
    expect(host.querySelectorAll('[data-region-list-entry]')).toHaveLength(1);
    const route=host.querySelector<HTMLSelectElement>('[aria-label="Recorded routes"]')!;
    await act(async()=>{route.value='1';route.dispatchEvent(new Event('change',{bubbles:true}));});
    expect(host.querySelectorAll('[data-region-list-entry]')).toHaveLength(0);
    expect(host.querySelector('[data-region-inspector]')).toBeNull();
    const all=[...host.querySelectorAll('button')].find(b=>b.textContent==='All opponents')!;
    await act(async()=>all.click());
    expect(host.querySelectorAll('[data-region-list-entry]')).toHaveLength(1);
    expect([...host.querySelectorAll('title,[aria-label]')].every(e=>!(/\b\d+,\s*\d+\b/.test(e.getAttribute('aria-label')??e.textContent??'')))).toBe(true);
  });
  it("renders all real Abyss regions while preserving native fixed placements and exact NPC portraits",async()=>{
    const map=(await loadQuestMap('realm3'))!,layer=(await loadQuestSpawnRegions(map))!;
    const placements=JSON.stringify(map.encounters),target=layer.regions.find(r=>!r.pathIndices.includes(0))??layer.regions.at(-1)!;
    const host=document.createElement('div');document.body.append(host);root=createRoot(host);
    await act(async()=>root!.render(<QuestMapExplorer map={map} spawnRegions={layer} initialRegion={target.id}/>));
    expect(host.querySelectorAll('[data-spawn-region]')).toHaveLength(62);
    expect(host.querySelectorAll('[data-region-tile]')).toHaveLength(layer.regions.reduce((n,r)=>n+r.coordinates.length,0));
    expect(host.querySelectorAll('[data-map-encounter]')).toHaveLength(1);
    expect(host.textContent).not.toContain('1 placed opponents');
    const singleton=layer.regions.find(r=>r.coordinates.length===1)!;
    expect(host.querySelector(`[data-spawn-region="${singleton.id}"]`)?.getAttribute('aria-label')).toContain('1 possible map position,');
    expect(JSON.stringify(map.encounters)).toBe(placements);
    expect(host.querySelector('[data-region-inspector]')?.textContent).toContain(target.defender.name);
    expect(target.pathIndices).toContain(Number(host.querySelector<HTMLSelectElement>('[aria-label="Recorded routes"]')!.value));
    expect(host.querySelector(`image[data-region-portrait="${target.defender.gameId}"]`)?.getAttribute('href')).toBe(target.defender.imageUrl);
    expect(host.querySelector('[data-region-inspector] a[href^="/champions/"]')).toBeNull();
    const sharedArea=host.querySelector('[data-region-inspector]')!.textContent!;
    expect(sharedArea).toContain('Recorded on every highlighted tile.');
    expect(sharedArea).toContain('About this encounter region');
    const modifiers=[...host.querySelectorAll<HTMLDetailsElement>('[data-region-inspector] section > details')];
    expect(modifiers.length).toBeGreaterThan(0);
    expect(modifiers.every(modifier=>modifier.open)).toBe(true);
  });
  it("keeps a failed regional portrait selectable with its native fallback and accessible name",async()=>{
    const {host}=await setup('fixture-region');
    const image=host.querySelector('image[data-region-portrait]')!;
    await act(async()=>image.dispatchEvent(new Event('error')));
    expect(host.querySelector('image[data-region-portrait]')).toBeNull();
    const marker=host.querySelector('[data-spawn-region="fixture-region"]')!;
    expect(marker.getAttribute('aria-label')).toContain('EX. THING');
    expect(marker.querySelector('path')).not.toBeNull();
    await act(async()=>marker.dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true})));
    expect(marker.getAttribute('aria-pressed')).toBe('true');
  });
  it("keeps real portrait footprints apart using presentation pitch alone",async()=>{
    const map=(await loadQuestMap('realm3'))!,layer=(await loadQuestSpawnRegions(map))!;
    const before=JSON.stringify(map),board=regionBoardGeometry(map,layer);
    const anchors=[...map.encounters.map(e=>({c:e.coordinate,r:e.final?33:27})),...layer.regions.map(r=>({c:r.anchor,r:28}))];
    for(let i=0;i<anchors.length;i++)for(const b of anchors.slice(i+1)){
      const a=anchors[i];expect(Math.hypot(a.c[0]-b.c[0],a.c[1]-b.c[1])*board.pitch).toBeGreaterThanOrEqual(a.r+b.r+10);
    }
    expect(JSON.stringify(map)).toBe(before);
  });
  it("glows actual hidden connectors but never fills a visible gap outside a region",async()=>{
    const map=(await loadQuestMap('p01_ch01_q01'))!;
    const fixture={...map,tiles:Array.from({length:5},(_,x)=>({coordinate:[x,0] as [number,number],nodeNumber:x,start:false,final:false,hidden:x===1||x===3,links:x<4?[[x+1,0] as [number,number]]:[],portals:[],randomPortal:false,barrier:'',applications:[]}))};
    const region:QuestSpawnRegionLayer['regions'][number]={id:'connector-fixture',anchor:[0,0],coordinates:[[0,0],[4,0]],pathIndices:[0],definitionCandidateCount:1,defender:{tierId:'fixture',gameId:'fixture',name:'Fixture',rarity:6,imageUrl:'/fixture.webp',rank:5,level:65,signature:200,ascensionTier:0}};
    expect(regionCorridors(fixture,region)).toEqual([]);
    expect(regionCorridors(fixture,{...region,coordinates:[[0,0],[2,0]]})).toEqual([[[0,0],[1,0]],[[1,0],[2,0]]]);
  });
  it("hydrates real regional SVG titles without replacing server-rendered markup",async()=>{
    const map=(await loadQuestMap('eq_labyrinth'))!,layer=(await loadQuestSpawnRegions(map))!;
    const element=<QuestMapExplorer map={map} spawnRegions={layer} initialRegion={layer.regions[0].id}/>;
    const host=document.createElement('div');host.innerHTML=renderToString(element);document.body.append(host);
    const serverMarker=host.querySelector('[data-spawn-region]'),recoverable=vi.fn();
    await act(async()=>{root=hydrateRoot(host,element,{onRecoverableError:recoverable});});
    expect(recoverable).not.toHaveBeenCalled();
    expect(host.querySelector('[data-spawn-region]')).toBe(serverMarker);
    expect(serverMarker?.querySelector('title')?.textContent).toBe(`${layer.regions[0].defender.name} · Encounter region · Exact trigger tile varies`);
  });
});
