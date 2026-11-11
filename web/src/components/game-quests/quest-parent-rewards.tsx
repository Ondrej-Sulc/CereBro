import type { QuestSummary } from "@cerebro/core/domain/game-quests";
import { getParentRewardRecord,questRewardsSource } from "@cerebro/core/data/game-quests/rewards";
import { projectRewardRecord } from "@/lib/game-quests/presentation";
import { loadRewardPortraits } from "@/lib/game-quests/champions";
import { QuestRewards } from "./quest-rewards";
export async function QuestParentRewards({quests,kind,id}:{quests:QuestSummary[];kind:"act"|"chapter";id:string}){
 const record=getParentRewardRecord(quests,kind,id);
 const title=kind==="act"?"Act rewards":"Chapter rewards";
 if(!record)return <p className="mt-6 text-sm text-slate-400">{title} have not been recorded for this collection.</p>;
 const portraits=await loadRewardPortraits(record);
 if(!Object.values(record.scopes).some(rows=>rows.length))return null;
 return <><QuestRewards rewards={projectRewardRecord(record,portraits)} title={title} id={`${kind}-rewards`}/><details className="mt-3 text-xs text-slate-500"><summary>{title} source</summary><p>Saved {questRewardsSource[record.sourceHash].capturedAt.slice(0,10)} · Independent {kind} first-completion and exploration lists. Current reward eligibility is not established.</p><p className="break-all">Source SHA-256: {record.sourceHash}</p></details></>;
}
