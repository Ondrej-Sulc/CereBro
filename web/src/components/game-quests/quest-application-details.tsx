"use client";
import Link from "next/link";
import { GameNodeModifierIcon } from "@/components/nodes/GameNodeModifierIcon";
import { gameText, type QuestApplication, type Coordinate } from "@cerebro/core/domain/game-quests";
import styles from "./quest-map-explorer.module.css";

export function QuestApplicationDetails({ application:a, sourceHash, shareUrl, initialOpen, choose, positionLabel }: {
  application:QuestApplication;questId:string;sourceHash:string;shareUrl:string;initialOpen:boolean;choose:(coordinate:Coordinate,center?:boolean)=>void;positionLabel?:(coordinate:Coordinate)=>string;
}) {
  const anchor=`application-${a.id}`;
  const href=`${shareUrl}&${new URLSearchParams({application:a.id,sourceHash})}#${encodeURIComponent(anchor)}`;
  return <details id={anchor} open={initialOpen} data-quest-application={a.id}><summary><span><GameNodeModifierIcon iconKey={a.iconKey} size={18}/>{" "}{gameText(a.name)||a.effectId}</span><small>{a.sourceType} · {a.target}</small></summary>
    <p className={styles.applicationDescription}>{gameText(a.description)||"Description unavailable for this saved application."}</p><p className={styles.muted}>Source <button className={styles.textButton} onClick={()=>choose(a.sourceCoordinate,true)}>{positionLabel?.(a.sourceCoordinate)??"Source location"} ↗</button> · Quantity {a.amount}{a.remainActive===null ? " · Persistence not recorded" : a.remainActive ? " · Source marked persistent" : " · Source not marked persistent"}</p>
    <Link prefetch={false} href={href} className={styles.share}>Link to this application ↗</Link>
    <details className={styles.identity}><summary>Application data</summary><p>Source version: {sourceHash}</p><p>Game effect: {a.effectId}</p>{!a.iconKey&&<p>A native icon has not been established for this saved application.</p>}{gameText(a.name)!==a.name&&<p>Native label: {a.name}</p>}{a.linkedTargets.length>0&&<p>Linked targets: {a.linkedTargets.map((c,i)=><button key={i} onClick={()=>choose(c,true)}>{positionLabel?.(c)??"Target location"}</button>)}</p>}</details>
  </details>;
}
