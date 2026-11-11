import raw from "./rewards.json";
import { act10Data } from "./act10";
import type { GameIdentity,QuestSummary } from "../../domain/game-quests";
export type NativeQuestReward={sourceIndex:number;type:string;data:string;quantity:number;minQuantity?:number;maxQuantity?:number;action?:string;header?:string;footer?:string;displayName?:string;identity?:GameIdentity};
export type QuestRewardRecord={key:string;kind:"quest"|"act"|"chapter";ownerId:string;containerSetId:string;actId?:string;mapId?:string;catalogSourceHash?:string;sourceHash:string;sourcePointer:string;questBindings?:Record<string,{mapId:string;sourceHash:string}>;scopes:Record<string,NativeQuestReward[]>};
const data=raw as unknown as {owners:Record<string,QuestRewardRecord>;quests:Record<string,string>;sources:Record<string,{capturedAt:string}>};
export const questRewardsSource={...data.sources,...act10Data.sources};
export function hasRecordedRewards(record:QuestRewardRecord|undefined){return Boolean(record&&Object.values(record.scopes).some(rows=>rows.length));}
export function getQuestRewardRecord(q:QuestSummary){const r=act10Data.rewards[q.id]??data.owners[data.quests[q.id]];return r?.mapId===q.mapId&&r.catalogSourceHash===q.sourceHash&&r.containerSetId===q.containerSetId?r:undefined;}
export function getParentRewardRecord(quests:QuestSummary[],kind:"act"|"chapter",id:string){
 const matched=Object.values(data.owners).filter(r=>r.kind===kind&&r.ownerId===id&&quests.length&&quests.every(q=>q.containerSetId===r.containerSetId&&r.questBindings?.[q.id]?.mapId===q.mapId&&r.questBindings[q.id].sourceHash===q.sourceHash&&q.hierarchy.some(h=>h.actId===r.actId&&(kind==="act"||h.chapterId===id))));
 return matched.length===1?matched[0]:undefined;
}
