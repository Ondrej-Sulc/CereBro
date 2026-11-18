// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it } from "vitest";
import type { QuestGateView } from "@/lib/game-quests/map-features";
import { QuestGateMarker } from "./quest-gate-marker";
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
let root:Root|undefined;
afterEach(async()=>{if(root)await act(async()=>root?.unmount());root=undefined;document.body.innerHTML="";});
const gate:QuestGateView={id:"gate",coordinate:[2,3],pathIndices:[0],kind:"champion",label:"King Groot (Deathless) required",requirements:["King Groot (Deathless) required"],resolved:true};
async function render(value:QuestGateView){const host=document.createElement('div');document.body.append(host);root=createRoot(host);await act(async()=>root!.render(<svg><QuestGateMarker gate={value}/></svg>));return host;}
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
