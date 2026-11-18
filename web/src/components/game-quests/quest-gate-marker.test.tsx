// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it } from "vitest";
import sharp from "sharp";
import type { QuestGateView } from "@/lib/game-quests/map-features";
import { QuestGateMarker } from "./quest-gate-marker";
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
let root:Root|undefined;
afterEach(async()=>{if(root)await act(async()=>root?.unmount());root=undefined;document.body.innerHTML="";});
const gate:QuestGateView={id:"gate",coordinate:[2,3],pathIndices:[0],kind:"champion",label:"King Groot (Deathless) required",requirements:["King Groot (Deathless) required"],resolved:true};
async function render(value:QuestGateView){const host=document.createElement('div');document.body.append(host);root=createRoot(host);await act(async()=>root!.render(<svg><QuestGateMarker gate={value}/></svg>));return host;}

// Render the emitted SVG rather than relying on jsdom, which cannot detect an
// invalid path that browsers truncate and implicitly close into a triangle.
async function raster(markup: string) {
 const {data,info}=await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120" viewBox="-100 -60 200 120">${markup}</svg>`)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 return (x:number,y:number)=>data[((y+60)*info.width+x+100)*info.channels+3];
}
it.each([
 {name:"single portrait",images:[{src:"/portrait.png",label:"Champion"}],half:27},
 {name:"alternative portraits",images:[{src:"/a.png",label:"A"},{src:"/b.png",label:"B"}],half:44},
 {name:"text fallback",images:[],half:68},
])("renders a complete symmetric gate frame and focus ring for $name",async({images,half})=>{
 const host=await render({...gate,visual:{kind:"champion",images,caption:"Champion"}});
 const paths=host.querySelectorAll('[data-gate-kind] > path');
 expect(paths).toHaveLength(2);
 for(const [index,path] of [...paths].entries()){
  const alpha=await raster(path.outerHTML);
  const y=index===0?24:30,x=Math.floor(half/2);
  for(const px of [-x,x])for(const py of [-y,y])expect(alpha(px,py),`shape ${index} must include ${px},${py}`).toBeGreaterThan(240);
  expect(alpha(0,0)).toBe(255);
  expect(alpha(half+7,0)).toBe(0);
 }
});
it("keeps the whole central portrait visible through its own gate mask",async()=>{
 const png=await sharp({create:{width:8,height:8,channels:4,background:"#ff00ff"}}).png().toBuffer();
 const host=await render({...gate,visual:{kind:"champion",images:[{src:`data:image/png;base64,${png.toString('base64')}`,label:"Champion"}],caption:"Champion"}});
 const alpha=await raster(`${host.querySelector('defs')!.outerHTML}${host.querySelector('image')!.outerHTML}`);
 for(const x of [-16,0,16])for(const y of [-14,0,14])expect(alpha(x,y),`portrait must remain visible at ${x},${y}`).toBe(255);
 expect(alpha(30,0)).toBe(0);
});
it("shows the exact required champion portrait and its name rather than identical gate bars",async()=>{
 const host=await render({...gate,visual:{kind:"champion",images:[{src:"/deathless-groot.png",label:"King Groot (Deathless)"}],caption:"King Groot (Deathless)",color:"#06b6d4"}});
 expect(host.querySelector('image')?.getAttribute('href')).toBe('/deathless-groot.png');
 expect(host.textContent).toContain('King Groot (Deathless)');expect(host.querySelector('[data-gate-lock]')).not.toBeNull();
 expect(host.querySelector('[role="button"], [tabindex]')).toBeNull();
});
it("distinguishes star rarity, matching champion count and class with the native icon",async()=>{
 const host=await render({...gate,kind:"class-and-rarity",visual:{kind:"class",images:[{src:"/assets/icons/Skill.png",label:"Skill"}],className:"Skill",color:"#ef4444",rarity:6,countLabel:"≥2",caption:"Skill"}});
 expect(host.querySelector('image')?.getAttribute('href')).toBe('/assets/icons/Skill.png');
 expect(host.textContent).toContain('6★');expect(host.textContent).toContain('≥2');expect(host.textContent).toContain('Skill');
});
it("preserves alternative-class wording on the marker itself",async()=>{
 const host=await render({...gate,kind:"tags",visual:{kind:"tags",images:[{src:"/cosmic.png",label:"Cosmic"},{src:"/mystic.png",label:"Mystic"}],countLabel:"≥2",caption:"Cosmic or Mystic"}});
 expect(host.querySelectorAll('image')).toHaveLength(2);expect(host.textContent).toContain('Cosmic or Mystic');
});
it("shows the actual resource and amount and falls back safely when an image fails",async()=>{
 const host=await render({...gate,kind:"resource",visual:{kind:"resource",images:[{src:"/temporal-shard.png",label:"Temporal Shard"}],countLabel:"×5",caption:"Temporal Shard"}});
 expect(host.textContent).toContain('×5');expect(host.textContent).toContain('Temporal Shard');
 await act(async()=>host.querySelector('image')!.dispatchEvent(new Event('error')));
 expect(host.textContent).toContain('Temporal Shard');expect(host.querySelector('image')).toBeNull();
});
it("does not expose internal tokens for an unresolved gate",async()=>{
 const host=await render({...gate,resolved:false,label:"private_token",visual:{kind:"unknown",images:[],caption:"private_token"}});
 expect(host.textContent).toContain('Gate');expect(host.textContent).not.toContain('private_token');
});
