"use client";
import Link from "next/link";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { QuestNodeModifierIcon } from "./quest-node-modifier-icon";
import { gameText, type QuestApplication, type Coordinate } from "@cerebro/core/domain/game-quests";
import styles from "./quest-application-details.module.css";

type ApplicationNavigation = { choose:(coordinate:Coordinate,center?:boolean)=>void;positionLabel?:(coordinate:Coordinate)=>string };

export function QuestApplicationContext({ application:a, sharedCount, choose, positionLabel }: ApplicationNavigation & { application:QuestApplication;sharedCount?:number }) {
  const hasContext=(a.sourceType!=="Local"&&a.sourceType!=="Global")||a.amount!==1||a.remainActive===true||a.linkedTargets.length>0;
  if (!hasContext) return null;
  return <details className={styles.context} data-modifier-context data-shared-modifier-context={sharedCount}>
    <summary>{sharedCount ? `Shared modifier details · ${sharedCount} modifiers` : "Modifier details"}</summary>
    <p>Quantity {a.amount}{a.remainActive===null ? " · Persistence not recorded" : a.remainActive ? " · Source marked persistent" : " · Source not marked persistent"}</p>
    <p>Source <button onClick={()=>choose(a.sourceCoordinate,true)}>{positionLabel?.(a.sourceCoordinate)??"Source location"} ↗</button></p>
    {a.linkedTargets.length>0&&<p>Linked locations: {a.linkedTargets.map((c,i)=><button key={i} onClick={()=>choose(c,true)}>{positionLabel?.(c)??"Target location"} ↗</button>)}</p>}
  </details>;
}

type ApplicationProps = ApplicationNavigation & {
  application:QuestApplication;questId:string;sourceHash:string;shareUrl:string;initialOpen?:boolean;highlighted?:boolean;showSourceType?:boolean;showContext?:boolean;
};

function ApplicationContent({application:a,showContext=true,choose,positionLabel}:ApplicationProps) {
  const name=gameText(a.name)||"Node modifier";
  return <>
    <p className={styles.description}>{gameText(a.description)||"Description unavailable for this saved application."}</p>
    {showContext&&<QuestApplicationContext application={a} choose={choose} positionLabel={positionLabel}/>}
    {a.definitionHref&&<div className={styles.actions}><Link prefetch={false} href={a.definitionHref} aria-label={`View ${name} node modifier`}>View modifier<ArrowUpRight size={13} aria-hidden="true"/></Link></div>}
  </>;
}

export function QuestApplicationReader({application:a,highlighted=false,hidden,readerId,labelledBy,...props}:ApplicationProps&{hidden:boolean;readerId:string;labelledBy:string}) {
  return <article className={styles.reader} id={`application-${a.id}`} hidden={hidden} data-quest-application={a.id} data-highlighted={highlighted||undefined}>
    <div role="tabpanel" id={readerId} aria-labelledby={labelledBy} tabIndex={0}>
      <h4 className={styles.readerHeading}><QuestNodeModifierIcon iconKey={a.iconKey} size={22}/><span className={styles.readerTitle}>{gameText(a.name)||"Node modifier"}</span>{a.target==="attacker"&&<small>Attacker</small>}</h4>
      <ApplicationContent application={a} {...props}/>
    </div>
  </article>;
}

export function QuestApplicationDetails({ application:a, initialOpen = false, highlighted = false, showSourceType = true, open, onExpandedChange, flat=false, ...props }: ApplicationProps & {
  open?:boolean;onExpandedChange?:(expanded:boolean)=>void;flat?:boolean;
}) {
  const anchor=`application-${a.id}`;
  const name=gameText(a.name)||"Node modifier";
  const sourceLabel=!showSourceType||a.sourceType==="Local"?null:a.sourceType==="Link"?"Linked":a.sourceType;
  return <details className={`${styles.modifier}${flat?` ${styles.flat}`:""}`} id={anchor} open={open??(initialOpen||highlighted)} onToggle={onExpandedChange?event=>onExpandedChange(event.currentTarget.open):undefined} data-quest-application={a.id} data-highlighted={highlighted||undefined}>
    <summary className={styles.heading}><span className={styles.icon}><QuestNodeModifierIcon iconKey={a.iconKey} size={19}/></span><span className={styles.name}>{name}</span>{(sourceLabel||a.target==="attacker")&&<span className={styles.badges}>{sourceLabel&&<small>{sourceLabel}</small>}{a.target==="attacker"&&<small>Attacker</small>}</span>}<ChevronDown size={14} className={styles.chevron} aria-hidden="true"/></summary>
    <ApplicationContent application={a} {...props}/>
  </details>;
}
