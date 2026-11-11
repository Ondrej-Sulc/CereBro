import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect,it } from "vitest";
import { loadQuestMap } from "../../data/game-quests";
import { withApplicationIcons } from "../../data/game-quests/application-icons";
import { questNativeIconsV3 } from "../../data/game-quests/v3-icons.js";
import { additionalNativeGameIcons,resolveNativeGameModifierIcon } from "../../domain/node-modifiers/native-game-icons";
import { nativeModifierIcons,resolveNativeModifierIcon,validateModifierIconEdit } from "../../domain/node-modifiers/native-icons";
type Ledger={sourceIndexSha256:string;baselines:Record<string,string>;proofs:{effectId:string;iconKey:string}[];maps:Record<string,{sourceHash:string;mapId:string;applications:Record<string,number>}>;unresolved:{questId:string;applicationId:string;effectId:string;reason:string}[];counts:{addedBindings:number;mergedBindings:number;remainingUnbound:number}};
const artifact=questNativeIconsV3 as Ledger;
it("fills the exact new application reference zero while preserving the prior ledger bytes",async()=>{
 expect(artifact.sourceIndexSha256).toBe("72947e3803b19069ade45728333e9cd92ecbdbd66d4cec91d3f1ccd89b61eb9f");
 for(const [name,hash] of Object.entries(artifact.baselines))expect(createHash("sha256").update(readFileSync(`src/data/game-quests/${name}`)).digest("hex")).toBe(hash);
 const [qid,row]=Object.entries(artifact.maps).find(([,row])=>Object.values(row.applications).includes(0))!;
 const id=Object.keys(row.applications).find(id=>row.applications[id]===0)!;
 const map=(await loadQuestMap(qid))!;
 expect(map.tiles.flatMap(t=>t.applications).find(a=>a.id===id)?.iconKey).toBe(artifact.proofs[0].iconKey);
});
it("keeps the game registry finite and outside curated presentation choices",()=>{
 expect(additionalNativeGameIcons).toHaveLength(204);expect(nativeModifierIcons).toHaveLength(24);
 expect(new Set([...nativeModifierIcons,...additionalNativeGameIcons].map(i=>i.key)).size).toBe(228);
 for(const icon of additionalNativeGameIcons){
  expect(resolveNativeGameModifierIcon(icon.key)).toEqual(icon);expect(resolveNativeModifierIcon(icon.key)).toBeUndefined();
  expect(icon.src).toMatch(/^\/node-modifiers\/v3\/icons\/[a-f0-9]{64}\.svg$/);
  const hash=icon.src.split('/').pop()!.replace('.svg','');
  expect(createHash("sha256").update(readFileSync(`web/public${icon.src}`)).digest("hex")).toBe(hash);
 }
 for(const key of [null,undefined,123,"https://example.com/icon.svg","node-game-glyph-unknown","../icons/unknown"]){expect(resolveNativeGameModifierIcon(key)).toBeUndefined();}
 expect(()=>validateModifierIconEdit({id:"curated-record",iconKey:additionalNativeGameIcons[0].key,expected:{name:"Existing",description:"Unchanged",iconKey:null}})).toThrow();
});
it("rejects stale source/map/effect/application identities without exposing proof metadata",async()=>{
 const map=(await loadQuestMap("me_crucible_ch02_q02"))!,row=artifact.maps[map.questId];
 const id=Object.keys(row.applications)[0],app=map.tiles.flatMap(t=>t.applications).find(a=>a.id===id)!;
 expect(app.iconKey).toBe(artifact.proofs[row.applications[id]].iconKey);
 expect(app).not.toHaveProperty("versionHash");expect(app).not.toHaveProperty("definitionSource");expect(app).not.toHaveProperty("componentHashes");
 for(const changed of [{...map,sourceHash:"wrong"},{...map,mapId:"wrong"}])expect(withApplicationIcons(changed).tiles.flatMap(t=>t.applications).every(a=>a.iconKey===null)).toBe(true);
 const changed=structuredClone(map),altered=changed.tiles.flatMap(t=>t.applications).find(a=>a.id===id)!;altered.effectId="wrong";
 expect(withApplicationIcons(changed).tiles.flatMap(t=>t.applications).find(a=>a.id===id)?.iconKey).toBeNull();
 altered.id+="-absent";expect(withApplicationIcons(changed).tiles.flatMap(t=>t.applications).find(a=>a.id===altered.id)?.iconKey).toBeNull();
});
it("joins every v3 assignment across all218 maps and keeps exactly the ten source gaps unbound",async()=>{
 let total=0,bound=0,added=0;
 for(const [qid,row] of Object.entries(artifact.maps)){
  const map=(await loadQuestMap(qid))!,applications=map.tiles.flatMap(t=>t.applications),byId=new Map(applications.map(a=>[a.id,a]));
  expect([map.mapId,map.sourceHash],qid).toEqual([row.mapId,row.sourceHash]);
  expect(Object.entries(row.applications).every(([id,index])=>{const a=byId.get(id),proof=artifact.proofs[index];return a?.effectId===proof.effectId&&a.iconKey===proof.iconKey;}),qid).toBe(true);
  total+=applications.length;bound+=applications.filter(a=>a.iconKey).length;added+=Object.keys(row.applications).length;
 }
 expect({total,bound,added}).toEqual({total:212720,bound:212710,added:62712});
 expect(artifact.unresolved).toHaveLength(10);
 for(const gap of artifact.unresolved){const map=(await loadQuestMap(gap.questId))!,app=map.tiles.flatMap(t=>t.applications).find(a=>a.id===gap.applicationId)!;expect(app.effectId).toBe(gap.effectId);expect(app.iconKey).toBeNull();}
},60000);
