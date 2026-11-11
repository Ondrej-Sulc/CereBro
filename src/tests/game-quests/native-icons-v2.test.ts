import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect,it } from "vitest";
import { loadQuestMap } from "../../data/game-quests";
import { withApplicationIcons } from "../../data/game-quests/application-icons";
import { questNativeIconsV2 } from "../../data/game-quests/v2-icons.js";
type Ledger={sourceIndexSha256:string;baselines:Record<string,string>;proofs:{effectId:string;iconKey:string}[];maps:Record<string,{sourceHash:string;mapId:string;applications:Record<string,number>}>;counts:{addedBindings:number;mergedBindings:number;totalApplications:number}};
const artifact=questNativeIconsV2 as Ledger;
it("preserves both frozen ledgers and adds source-bound keys without sending proof catalogs to clients",async()=>{
 expect(artifact.sourceIndexSha256).toBe("9fc9209fbd623aa9ceb0500362cd51d2524c177279c1e2a57ee41bc7afb7a793");
 for(const [name,hash] of Object.entries(artifact.baselines))expect(createHash("sha256").update(readFileSync(`src/data/game-quests/${name}`)).digest("hex")).toBe(hash);
 expect(artifact.counts).toMatchObject({addedBindings:98280,mergedBindings:149998,totalApplications:212720});
 const map=(await loadQuestMap("me_crucible_ch02_q02"))!,record=artifact.maps[map.questId];
 const added=map.tiles.flatMap(t=>t.applications).find(a=>record.applications[a.id]!==undefined)!;
 expect(added).toBeDefined();expect(added.iconKey).toBe(artifact.proofs[record.applications[added.id]].iconKey);
 expect(added).not.toHaveProperty("versionHash");expect(added).not.toHaveProperty("componentHashes");expect(added).not.toHaveProperty("definitionSource");
 expect(withApplicationIcons({...map,sourceHash:"stale"}).tiles.flatMap(t=>t.applications).every(a=>a.iconKey===null)).toBe(true);
 expect(withApplicationIcons({...map,mapId:"another-map"}).tiles.flatMap(t=>t.applications).every(a=>a.iconKey===null)).toBe(true);
 const changed=structuredClone(map),app=changed.tiles.flatMap(t=>t.applications).find(a=>a.id===added.id)!;app.effectId="another-effect";
 expect(withApplicationIcons(changed).tiles.flatMap(t=>t.applications).find(a=>a.id===app.id)?.iconKey).toBeNull();
 app.id+="-unobserved";expect(withApplicationIcons(changed).tiles.flatMap(t=>t.applications).find(a=>a.id===app.id)?.iconKey).toBeNull();
});
it("handles additive reference zero as a real icon binding",async()=>{
 const [qid,row]=Object.entries(artifact.maps).find(([,row])=>Object.values(row.applications).includes(0))!;
 const id=Object.keys(row.applications).find(id=>row.applications[id]===0)!;
 const map=(await loadQuestMap(qid))!;
 expect(map.tiles.flatMap(t=>t.applications).find(a=>a.id===id)?.iconKey).toBe(artifact.proofs[0].iconKey);
});
it("joins every additive assignment to the exact current normalized map/application without changing coverage",async()=>{
 const legacy:Record<string,{applications:Record<string,unknown>}>={};
 for(const name of ['application-icons.json','application-icons-expanded.json'])Object.assign(legacy,(JSON.parse(readFileSync(`src/data/game-quests/${name}`,'utf8')) as {maps:typeof legacy}).maps);
 let total=0,bound=0,added=0;
 for(const [qid,row] of Object.entries(artifact.maps)){
  const map=(await loadQuestMap(qid))!;
  expect([map.mapId,map.sourceHash],qid).toEqual([row.mapId,row.sourceHash]);
  const applications=map.tiles.flatMap(t=>t.applications),byId=new Map(applications.map(a=>[a.id,a]));
  expect(Object.entries(row.applications).every(([id,index])=>{const a=byId.get(id),proof=artifact.proofs[index];return a?.effectId===proof.effectId&&a.iconKey===proof.iconKey;}),qid).toBe(true);
  total+=applications.length;bound+=applications.filter(a=>a.iconKey&&(Object.hasOwn(legacy[qid].applications,a.id)||Object.hasOwn(row.applications,a.id))).length;added+=Object.keys(row.applications).length;
 }
 expect({total,bound,added}).toEqual({total:212720,bound:149998,added:98280});
},60000);
