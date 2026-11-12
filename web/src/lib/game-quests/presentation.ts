import type { ChampionClass } from "@prisma/client";
import type { QuestMap } from "@cerebro/core/domain/game-quests";
import { getChampionImageUrl } from "@/lib/championHelper";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { listCrystalOpenings } from "@cerebro/core/data/game-crystal-openings";
import { getCrystalPresentation } from "@cerebro/core/data/game-crystals";
import { getQuestRewardArtwork as getRewardArtwork } from "@cerebro/core/data/game-quests/reward-artwork";
import { getSelectableReward } from "@cerebro/core/data/game-selectable-rewards";
import { getQuestRewardRecord,type QuestRewardRecord,type NativeQuestReward } from "@cerebro/core/data/game-quests/rewards";
import { findQuest } from "@cerebro/core/data/game-quests";
import { permanentData } from "@cerebro/core/data/game-quests/permanent";
import { rewardDisplayName } from "@cerebro/core/domain/reward-display";
import { getNativeRewardPresentation, nativeRewardName, type RewardRankChange } from "@cerebro/core/data/game-reward-presentation";
import { getPublicRewardDefinition } from "@cerebro/core/data/game-reward-definitions";
import { getStaticResourceRewardArtwork } from "@cerebro/core/data/game-resource-artwork";
import { getPublicResourceDefinition } from "@cerebro/core/data/game-resource-definitions";

export type QuestPortrait = { name: string; href: string | null; imageUrl: string | null; className: string; color: string; nativeGameId?:string };
export type PublicChampionRow = { gameId: string | null; name: string; slug: string | null; images: unknown; class: ChampionClass };
type IdentitySource = { encounters: {gameId:string;champion:unknown | null}[]; rewards:{fixedChampions:{gameId:string;champion:unknown | null}[]} };
export function questChampionGameIds(map: IdentitySource) {
  return [...new Set([...map.encounters, ...map.rewards.fixedChampions].filter(e => e.champion !== null).map(e => e.gameId))].sort();
}
export function projectQuestPortraits(map: IdentitySource, rows: PublicChampionRow[]): Record<string, QuestPortrait> {
  const allowed = new Set(questChampionGameIds(map));
  return Object.fromEntries(rows.filter(row => row.gameId && allowed.has(row.gameId)).map(row => {
    const url = getChampionImageUrl(row.images, "128");
    return [row.gameId, { name: row.name, href: row.slug ? `/champions/${row.slug}` : null, imageUrl: /^https?:\/\//.test(url) ? url : null,
      className: row.class.charAt(0) + row.class.slice(1).toLowerCase(), color: getChampionClassColors(row.class).color }];
  }));
}
export type QuestRewardView = { key: string; scope: string; token: string; name: string; quantity: number; type: "champion" | "crystal" | "item"; imageUrl: string | null; href: string | null; rarity?: number; itemRarity?: number; signaturePoints?: number; rankChange?: RewardRankChange; sourceType?:string;amount?:string;recordedOutcome?:boolean;placeholder?:boolean };
const openingsByToken = new Map<string, ReturnType<typeof listCrystalOpenings>[number][]>();
for (const opening of listCrystalOpenings()) {
  const token = opening.sourceMetadata.token;
  if (token) openingsByToken.set(token, [...(openingsByToken.get(token) ?? []), opening]);
}
export function resolveQuestCrystal(token: string) {
  // Quest gs data binds GachaBox.Token, not GachaBox.id. Ambiguous tokens stay unresolved.
  const matches = openingsByToken.get(token) ?? [];
  const opening = matches.length === 1 ? matches[0] : null;
  if (!opening) return { name: "Crystal reward", imageUrl: null, href: null };
  return { name: opening.name, href: `/crystals/${encodeURIComponent(opening.id)}`,
    imageUrl: getRewardArtwork("gs", token)?.url ?? getCrystalPresentation(opening.id)?.artworkUrl ?? null };
}
export function projectQuestRewards(map: QuestMap, portraits: Record<string, QuestPortrait>): QuestRewardView[] {
  const q=findQuest(map.questId),record=q?getQuestRewardRecord(q):undefined;
  if(record)return projectRewardRecord(record,portraits);
  return [
    ...map.rewards.fixedChampions.map((r, i) => ({ key: `hero:${i}`, scope: r.scope, token: r.tierId, type: "champion" as const, quantity: r.quantity, rarity: r.rarity,
      name: portraits[r.gameId]?.name ?? r.champion?.name ?? r.name, href: r.champion ? portraits[r.gameId]?.href ?? `/champions/${r.champion.slug}` : null, imageUrl: portraits[r.gameId]?.imageUrl ?? null })),
    ...map.rewards.possibleCrystals.map((r, i) => ({ key: `gs:${i}`, scope: r.scope, token: r.token, quantity: r.quantity, type: "crystal" as const, ...resolveQuestCrystal(r.token) })),
  ];
}
export function questRewardScope(scope: string) {
  const labels: Record<string, string> = {
    firstCompletionRewards: "First completion",
    masteryCompletionRewards: "100% exploration",
    potentialCompletionRewards: "Potential completion outcomes",
    firstCompletionMaximumRewards: "Recorded first-completion maximum",
    replayRewards: "Recorded replay data",
    allianceBossCompletionRewards: "Alliance boss completion",
  };
  return labels[scope] ?? "Other recorded outcomes";
}

const labels:Record<string,string>={res:"Resource",ebp:"Upgrade material",ebpf:"Material fragments",gf:"Crystal shards",inv:"Item",sra:"Reward selector",utitle:"Title",profilebadge:"Profile badge",emote:"Emote",evta:"Recorded event",off:"Offer availability",gent:"Recorded event"};
export function projectRewardRecord(record:QuestRewardRecord,portraits:Record<string,QuestPortrait>={}):QuestRewardView[]{
 return Object.entries(record.scopes).flatMap(([scope,rows])=>rows.map(r=>projectRewardRow(r,scope,`${record.key}:${scope}:${r.sourceIndex}`,portraits)));
}
export function projectRewardRow(r:NativeQuestReward,scope:string,key:string,portraits:Record<string,QuestPortrait>={}):QuestRewardView{
  const placeholder=r.type==="inv"&&r.data==="unknown_rewards";
  if(placeholder)return {key,scope,token:r.data,sourceType:r.type,quantity:r.quantity,amount:"",type:"item",name:"Reward details not specified",href:null,imageUrl:null,placeholder:true};
  const crystal=r.type==="gs"?resolveQuestCrystal(r.data):null;
  const selector=r.type==="sra"?getSelectableReward(r.data):null;
  const native=getNativeRewardPresentation(r.type,r.data);
  const publicDefinition=getPublicRewardDefinition(r.type,r.data);
  const publicResource=getPublicResourceDefinition(r.type,r.data);
  const identity=r.identity,portrait=identity?.champion?portraits[identity.gameId]:null;
  const nativePortrait=identity?permanentData.nativePortraits[identity.gameId]:undefined;
  const nativeImage=nativePortrait?.character===identity?.gameId&&nativePortrait?.sourceBcgSha256===permanentData.bcgSha256?nativePortrait.url:null;
  const title=r.type==="res"&&r.data==="sc"?rewardDisplayName({type:r.type,data:r.data}):selector?.name||publicDefinition?.name||publicResource?.name||(native?nativeRewardName(native,r.type):r.displayName);
  const min=r.minQuantity,max=r.maxQuantity;
  const amount=min!==undefined&&max!==undefined&&min!==max?min<=max?`${min.toLocaleString("en")}–${max.toLocaleString("en")}`:"Quantity range unavailable":`×${r.quantity.toLocaleString("en")}`;
  return {key,scope,token:r.data,sourceType:r.type,quantity:r.quantity,amount,type:identity?"champion":crystal?"crystal":"item",name:identity?portrait?.name??identity.champion?.name??identity.name:crystal?.name??title??`${labels[r.type]??"Recorded"} reward`,href:identity?.champion?portrait?.href??`/champions/${identity.champion.slug}`:crystal?.href??(r.type==="gf"?resolveQuestCrystal(r.data).href:null),imageUrl:identity?portrait?.imageUrl??nativeImage:getRewardArtwork(r.type,r.data)?.url??getStaticResourceRewardArtwork(r.type,r.data)?.url??publicResource?.imageUrl??publicDefinition?.imageUrl??crystal?.imageUrl??null,rarity:identity?.rarity,itemRarity:native?.rarity,signaturePoints:native?.signaturePoints,rankChange:native?.rankChange,recordedOutcome:!["hero","gs","gf","res","ebp","ebpf","inv","sra","utitle","profilebadge","emote"].includes(r.type)};
}
