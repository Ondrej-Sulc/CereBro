import { expect, it } from "vitest";
import { findQuest } from "../../data/game-quests";
import { getQuestRewardRecord, getParentRewardRecord,hasRecordedRewards } from "../../data/game-quests/rewards";
import { projectRewardRecord, questRewardScope } from "../../../web/src/lib/game-quests/presentation";

it("renders the real Act 10 maximum-first and replay arrays as separate recorded scopes", () => {
 const record=getQuestRewardRecord(findQuest("epilogue_ch04_q04")!)!;
 const outcomes=projectRewardRecord(record).filter(r=>r.scope==="firstCompletionMaximumRewards"||r.scope==="replayRewards");
 expect(outcomes).toHaveLength(2);
 expect(outcomes.every(r=>r.recordedOutcome&&r.quantity===3900)).toBe(true);
 const labels=outcomes.map(r=>questRewardScope(r.scope));
 expect(labels).toContain("Recorded first-completion maximum");
 expect(labels).toContain("Recorded replay data");
 expect(labels).not.toContain("Potential completion outcomes");
 const scopes=["firstCompletionRewards","masteryCompletionRewards","potentialCompletionRewards","firstCompletionMaximumRewards","replayRewards","allianceBossCompletionRewards"];
 expect(new Set(scopes.map(questRewardScope)).size).toBe(6);
});

it("keeps quest, chapter and act completion/exploration separate by exact containing identity", () => {
  const q=findQuest("a05_ch01_q01")!;
  const quest=getQuestRewardRecord(q)!;
  const act=getParentRewardRecord([q],"act","act5")!;
  const chapter=getParentRewardRecord([q],"chapter","a05_ch01")!;
  expect(quest.scopes.firstCompletionRewards.length).toBeGreaterThan(2);
  expect(act.scopes.firstCompletionRewards.length).toBeGreaterThan(0);
  expect(chapter.scopes.masteryCompletionRewards.length).toBeGreaterThan(0);
  expect(new Set([quest.key,act.key,chapter.key]).size).toBe(3);
  expect(getParentRewardRecord([{...q,containerSetId:"wrong"}],"act","act5")).toBeUndefined();
  expect(getQuestRewardRecord({...q,mapId:"wrong"})).toBeUndefined();
});
it("keeps repeated Special act IDs independent and distinguishes observed empty scopes",()=>{
 const a=findQuest("realm3")!,b=findQuest("eq_labyrinth")!;
 const ar=getParentRewardRecord([a],"act","act1")!,br=getParentRewardRecord([b],"act","act1")!;
 expect(ar).toBeDefined();expect(br).toBeDefined();expect(ar.key).not.toBe(br.key);
 expect(ar.sourceHash).toBe("496aab35a0ce29e4eae50f8a329c7febaa158dad4b674fe160294c5c5e43dfd7");
 expect(ar.key).toContain(ar.sourceHash);
 expect(getParentRewardRecord([a,b],"act","act1")).toBeUndefined();
 const q=findQuest("pve_may2023_shootingstar_1")!,r=getParentRewardRecord([q],"chapter",q.hierarchy[0].chapterId)!;
 expect(r).toBeDefined();expect(r.scopes.firstCompletionRewards).toEqual([]);expect(hasRecordedRewards(r)).toBe(false);
});
it("preserves native placeholder observations without inventing a grant",()=>{
 const q=findQuest("me_crucible_ch01_q01")!,r=getParentRewardRecord([q],"act",q.hierarchy[0].actId)!;
 const view=projectRewardRecord(r).find(v=>v.token==="unknown_rewards")!;
 expect(view.placeholder).toBe(true);expect(view.amount).toBe("");expect(view.href).toBeNull();
 expect(view.name).toBe("Reward details not specified");
});
it("presents exact material/currency quantities separately per reward scope without dropping rows",()=>{
 const q=findQuest("a05_ch01_q01")!,r=getQuestRewardRecord(q)!,views=projectRewardRecord(r);
 expect(views).toHaveLength(Object.values(r.scopes).flat().length);
 expect(views.some(v=>v.sourceType==="res"&&v.name==="Gold")).toBe(true);
 expect(views.some(v=>v.sourceType==="ebp"&&v.name.includes("ISO"))).toBe(true);
 expect(new Set(views.map(v=>v.key)).size).toBe(views.length);
 expect(views.filter(v=>v.sourceType==="gs").every(v=>v.type==="crystal")).toBe(true);
 const allOutcomes=projectRewardRecord({...r,scopes:{firstCompletionRewards:[{sourceIndex:0,type:"setstat",data:"epi44",quantity:1},{sourceIndex:1,type:"rma",data:"",quantity:1}]}});
 expect(allOutcomes.every(v=>v.recordedOutcome)).toBe(true);
});
