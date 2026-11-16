import type { QuestSummary } from "@cerebro/core/domain/game-quests";
import { getParentRewardRecord,hasRecordedRewards } from "@cerebro/core/data/game-quests/rewards";
import { projectRewardRecord,questParentRewardTitle } from "@/lib/game-quests/presentation";
import { loadRewardPortraits } from "@/lib/game-quests/champions";
import { QuestRewards } from "./quest-rewards";
export async function QuestParentRewards({quests,kind,id}:{quests:QuestSummary[];kind:"act"|"chapter";id:string}){
 const record=getParentRewardRecord(quests,kind,id);
 const title=questParentRewardTitle(quests,kind);
 if(!record)return <p className="mt-6 text-sm text-slate-400">{title} have not been recorded for this collection.</p>;
 if(!hasRecordedRewards(record))return null;
 const portraits=await loadRewardPortraits(record);
 return <QuestRewards rewards={projectRewardRecord(record,portraits).filter(reward=>!reward.placeholder)} title={title} id={`${kind}-rewards`}/>;
}
