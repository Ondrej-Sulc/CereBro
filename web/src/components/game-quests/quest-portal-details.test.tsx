// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import type { Coordinate, QuestTile } from "@cerebro/core/domain/game-quests";
import { QuestPortalDetails } from "./quest-portal-details";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
afterEach(async () => { if(root)await act(async()=>root?.unmount());root=undefined;document.body.innerHTML=""; });
const tile: QuestTile = { coordinate:[1,2],nodeNumber:1,start:false,final:false,hidden:false,links:[],applications:[],barrier:"",randomPortal:false,
  portals:[{target:[3,4],label:"[ea7800]Exit A[-]",randomChance:0,tags:[]},{target:[5,6],label:"",randomChance:0,tags:[]}] };
async function setup(value=tile, positionLabel: (coordinate:Coordinate)=>string = c=>c[0]===3?"Medusa":"Quest finish") {
  const host=document.createElement("div");document.body.append(host);root=createRoot(host);
  const choose=vi.fn();
  await act(async()=>root!.render(<QuestPortalDetails tile={value} choose={choose} positionLabel={positionLabel}/>));
  return {host,choose};
}
it("navigates to each exact recorded portal destination using readable names",async()=>{
  const {host,choose}=await setup();
  expect(host.textContent).toContain("Portal destinations");expect(host.textContent).toContain("Exit A");
  expect(host.textContent).toContain("Medusa");expect(host.textContent).toContain("Quest finish");
  const buttons=host.querySelectorAll("button");expect(buttons).toHaveLength(2);
  await act(async()=>{buttons[0].click();buttons[1].click();});
  expect(choose.mock.calls).toEqual([[[3,4],true],[[5,6],true]]);
  expect(host.textContent).not.toMatch(/ea7800|\[-\]|3,4|5,6|0%/);
});
it("does not invent destinations for a tile without targets",async()=>{
  const {host}=await setup({...tile,portals:[]});expect(host.textContent).toBe("");
});
it("keeps recorded random destinations possible without inventing probabilities",async()=>{
  const {host}=await setup({...tile,randomPortal:true});
  expect(host.textContent).toContain("Possible portal destinations");
  expect(host.textContent).not.toMatch(/guaranteed|chance|%/i);
});
it("distinguishes destinations when their native labels are empty or generic",async()=>{
  const {host}=await setup({...tile,portals:tile.portals.map(portal=>({...portal,label:""}))},()=>"Map location");
  const labels=[...host.querySelectorAll("button")].map(button=>button.textContent);
  expect(labels).toEqual(["Destination 1","Destination 2"]);
});
