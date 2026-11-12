"use client";
import Link from "next/link";
import { ChevronDown, Link2 } from "lucide-react";
import { GameNodeModifierIcon } from "@/components/nodes/GameNodeModifierIcon";
import { ModifierName } from "@/components/nodes/ModifierName";
import { gameText, type QuestApplication, type Coordinate } from "@cerebro/core/domain/game-quests";
import styles from "./quest-application-details.module.css";

export function QuestApplicationDetails({ application:a, sourceHash, shareUrl, initialOpen = true, highlighted = false, choose, positionLabel }: {
  application:QuestApplication;questId:string;sourceHash:string;shareUrl:string;initialOpen?:boolean;highlighted?:boolean;choose:(coordinate:Coordinate,center?:boolean)=>void;positionLabel?:(coordinate:Coordinate)=>string;
}) {
  const anchor=`application-${a.id}`;
  const href=`${shareUrl}${shareUrl.includes("?")?"&":"?"}${new URLSearchParams({application:a.id,sourceHash})}#${encodeURIComponent(anchor)}`;
  const name=gameText(a.name)||"Node modifier";
  const sourceLabel=a.sourceType==="Local"?null:a.sourceType==="Link"?"Linked":a.sourceType;
  const hasContext=(a.sourceType!=="Local"&&a.sourceType!=="Global")||a.amount!==1||a.remainActive===true||a.linkedTargets.length>0;
  return <details className={styles.modifier} id={anchor} open={initialOpen} data-quest-application={a.id} data-highlighted={highlighted||undefined}>
    <summary className={styles.heading}><GameNodeModifierIcon iconKey={a.iconKey} size={18}/><span className={styles.name}><ModifierName name={name} href={a.definitionHref}/></span>{(sourceLabel||a.target==="attacker")&&<span className={styles.badges}>{sourceLabel&&<small>{sourceLabel}</small>}{a.target==="attacker"&&<small>Attacker</small>}</span>}<ChevronDown size={14} className={styles.chevron} aria-hidden="true"/></summary>
    <p className={styles.description}>{gameText(a.description)||"Description unavailable for this saved application."}</p>
    {hasContext&&<details className={styles.context} data-modifier-context><summary>Modifier details</summary>
      <p>Quantity {a.amount}{a.remainActive===null ? " · Persistence not recorded" : a.remainActive ? " · Source marked persistent" : " · Source not marked persistent"}</p>
      <p>Source <button onClick={()=>choose(a.sourceCoordinate,true)}>{positionLabel?.(a.sourceCoordinate)??"Source location"} ↗</button></p>
      {a.linkedTargets.length>0&&<p>Linked locations: {a.linkedTargets.map((c,i)=><button key={i} onClick={()=>choose(c,true)}>{positionLabel?.(c)??"Target location"} ↗</button>)}</p>}
    </details>}
    <Link prefetch={false} href={href} className={styles.share} aria-label={`Link to ${name} modifier`} title="Link to this modifier"><Link2 size={15} aria-hidden="true"/></Link>
  </details>;
}
