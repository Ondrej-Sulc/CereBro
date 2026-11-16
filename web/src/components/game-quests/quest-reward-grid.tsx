"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Gem, X } from "lucide-react";
import type { QuestRewardView } from "@/lib/game-quests/presentation";
import { RewardItemOverlay } from "@/components/reward-item-overlay";
import { RewardSourceLink } from "@/components/discovery/reward-source-link";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import styles from "./quest-rewards.module.css";

const preferenceKey = "cerebro:quest-rewards:show-names";
const preferenceEvent = "cerebro:quest-reward-names-change";
function useRewardNames() {
  const [showNames,setShowNames] = useState(false);
  useEffect(()=>{
    const read=()=>{try{setShowNames(window.localStorage.getItem(preferenceKey)==="true");}catch{/* Keep the current in-page choice when storage is unavailable. */}};
    const storage=(event:StorageEvent)=>{if(event.key===preferenceKey||event.key===null)read();};
    const changed=(event:Event)=>{if(event instanceof CustomEvent&&typeof event.detail==="boolean")setShowNames(event.detail);};
    read();window.addEventListener("storage",storage);window.addEventListener(preferenceEvent,changed);
    return()=>{window.removeEventListener("storage",storage);window.removeEventListener(preferenceEvent,changed);};
  },[]);
  return [showNames,(value:boolean)=>{
    setShowNames(value);
    try{window.localStorage.setItem(preferenceKey,String(value));}catch{/* The toggle still works for this page. */}
    window.dispatchEvent(new CustomEvent(preferenceEvent,{detail:value}));
  }] as const;
}

const name = (r:QuestRewardView) => `${r.rarity?`${r.rarity}★ `:""}${r.name}`;
const amount = (r:QuestRewardView) => r.placeholder ? "" : r.amount??`×${r.quantity.toLocaleString("en")}`;
function kind(r:QuestRewardView) {
  if(r.type==="champion")return "Champion";
  if(r.type==="crystal")return "Crystal";
  return ({gf:"Crystal shards",ebp:"Upgrade material",ebpf:"Fragments",res:"Resource",utitle:"Title",profilebadge:"Profile badge",sra:"Selector"} as Record<string,string>)[r.sourceType??""]??"Item";
}

function RewardTile({reward:r,showName}:{reward:QuestRewardView;showName:boolean}) {
  const [failed,setFailed] = useState(false);
  const [open,setOpen] = useState(false);
  const title=name(r),quantity=amount(r),possible=r.scope==="potentialCompletionRewards";
  const fallback=failed||!r.imageUrl||r.placeholder;
  return <li data-quest-reward={r.key} className={styles.item}>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild><button type="button" className={styles.tile} aria-label={`Reward details: ${title}${quantity?` · ${quantity}`:""}${possible?" · Possible outcome; not guaranteed":""}`} title={`${title}${quantity?` · ${quantity}`:""}`}>
        <span className={styles.artwork}>{!failed&&r.imageUrl?<Image src={r.imageUrl} width={64} height={64} sizes="64px" alt="" className={styles.image} onError={()=>setFailed(true)}/>:<Gem aria-hidden="true"/>}<RewardItemOverlay rank={r.rankChange} signaturePoints={r.signaturePoints} rarity={r.itemRarity}/>{r.rarity&&<small className={styles.rarity} aria-hidden="true">{r.rarity}★</small>}</span>
        {quantity&&<span className={styles.quantity}>{quantity}</span>}
        {(showName||fallback)&&<span data-reward-name className={styles.name}>{title}</span>}
      </button></PopoverTrigger>
      <PopoverContent className={styles.detail} aria-label={`Reward details: ${title}`}>
        <div className={styles.detailHeading}><h4>{title}</h4><button type="button" onClick={()=>setOpen(false)} aria-label="Close reward details"><X size={18} aria-hidden="true"/></button></div>
        <p>{kind(r)}{quantity&&` · ${quantity}`}</p>
        {r.placeholder&&<p>Native definition contains a placeholder.</p>}
        {possible&&<p>Possible outcome; not guaranteed</p>}
        <div className={styles.actions}>{r.href&&<Link href={r.href} prefetch={false}>View {r.type==="champion"?"champion":r.type==="crystal"?"crystal":"reward"}<ArrowUpRight size={14} aria-hidden="true"/></Link>}<RewardSourceLink type={r.sourceType} token={r.token}/></div>
      </PopoverContent>
    </Popover>
  </li>;
}

export function QuestRewardGrid({title,id,groups}:{title:string;id:string;groups:{scope:string;label:string;rewards:QuestRewardView[]}[]}) {
  const [showNames,setShowNames] = useRewardNames();
  return <>
    <header className={styles.header}><h2 id={`${id}-title`}>{title}</h2>{groups.length>0&&<label className={styles.toggle}><input type="checkbox" aria-label="Show reward names" checked={showNames} onChange={event=>setShowNames(event.currentTarget.checked)}/>Show names</label>}</header>
    {groups.length>0&&<p className={styles.hint}>Tap a reward for details.</p>}
    <div className={styles.scopes}>{groups.map(group=><section key={group.scope} id={`${id}-${group.scope}`} data-quest-reward-scope={group.scope} aria-labelledby={`${id}-${group.scope}-title`}>
      <h3 id={`${id}-${group.scope}-title`}>{group.label}</h3>
      {group.scope==="potentialCompletionRewards"&&<p className={styles.possible}>Possible outcomes; not guaranteed</p>}
      <ul className={styles.grid}>{group.rewards.map(r=><RewardTile key={r.key} reward={r} showName={showNames}/>)}</ul>
    </section>)}</div>
  </>;
}
