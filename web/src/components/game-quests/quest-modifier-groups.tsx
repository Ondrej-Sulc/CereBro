"use client";

import { useId, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { gameText, type Coordinate, type QuestApplication } from "@cerebro/core/domain/game-quests";
import { Globe2, Link2, MapPin } from "lucide-react";
import { QuestApplicationContext, QuestApplicationDetails, QuestApplicationReader } from "./quest-application-details";
import styles from "./quest-modifier-groups.module.css";

const scopeOrder = ["Local", "Link", "Global"];
const scopePriority = (scope:string) => scopeOrder.includes(scope) ? scopeOrder.indexOf(scope) : scopeOrder.length;
const phoneQuery="(max-width: 600px)";
function subscribePhone(onChange:()=>void) {
  if(typeof window.matchMedia!=="function")return ()=>{};
  const media=window.matchMedia(phoneQuery);
  media.addEventListener("change",onChange);
  return ()=>media.removeEventListener("change",onChange);
}
const phoneSnapshot=()=>typeof window.matchMedia==="function"&&window.matchMedia(phoneQuery).matches;
const serverSnapshot=()=>false;

export function QuestModifierGroups({ applications, questId, sourceHash, shareUrl, selectedApplication, choose, positionLabel }: {
  applications:QuestApplication[];questId:string;sourceHash:string;shareUrl:string;selectedApplication?:string;
  choose:(coordinate:Coordinate,center?:boolean)=>void;positionLabel:(coordinate:Coordinate)=>string;
}) {
  const id=useId();
  const phone=useSyncExternalStore(subscribePhone,phoneSnapshot,serverSnapshot);
  const highlighted=applications.find(application=>application.id===selectedApplication);
  const scopes = new Map<string, Map<string, QuestApplication[]>>();
  for (const application of applications) {
    const groups = scopes.get(application.sourceType) ?? new Map<string, QuestApplication[]>();
    // Only identical source context is shared; identities and definitions remain exact.
    const key=JSON.stringify([application.target,application.amount,application.remainActive,application.sourceCoordinate,application.linkedTargets]);
    const group=groups.get(key)??[];group.push(application);groups.set(key,group);scopes.set(application.sourceType,groups);
  }
  const ordered=[...scopes].sort(([left],[right])=>scopePriority(left)-scopePriority(right));
  const [activeScope,setActiveScope]=useState(highlighted?.sourceType??ordered[0]?.[0]??"");
  const [expanded,setExpanded]=useState<string|undefined>(highlighted?.id);
  const [chosen,setChosen]=useState<string|undefined>(highlighted?.id);
  const tabs=useRef(new Map<string,HTMLButtonElement>());
  const choices=useRef(new Map<string,HTMLButtonElement>());
  function move(event:KeyboardEvent<HTMLButtonElement>,keys:string[],current:string,select:(key:string)=>void,refs:Map<string,HTMLButtonElement>) {
    const index=keys.indexOf(current);
    const next=event.key==="Home"?0:event.key==="End"?keys.length-1:event.key==="ArrowRight"?(index+1)%keys.length:event.key==="ArrowLeft"?(index+keys.length-1)%keys.length:null;
    if(next===null)return;
    event.preventDefault();select(keys[next]);refs.get(keys[next])?.focus();
  }
  return <div className={styles.groups} data-modifier-reader-layout={phone||undefined}>
    <div className={styles.tabs} role="tablist" aria-label="Modifier scope">
      {ordered.map(([sourceType,groups],index)=>{
        const label=sourceType==="Link"?"Linked":sourceType||"Other";
        const count=[...groups.values()].reduce((sum,group)=>sum+group.length,0);
        const Icon=sourceType==="Global"?Globe2:sourceType==="Link"?Link2:MapPin;
        return <button type="button" key={sourceType} role="tab" id={`${id}-tab-${index}`} aria-controls={`${id}-scope-${index}`} aria-selected={activeScope===sourceType} tabIndex={activeScope===sourceType?0:-1} data-modifier-tab={sourceType} ref={node=>{if(node)tabs.current.set(sourceType,node);else tabs.current.delete(sourceType);}} onClick={()=>setActiveScope(sourceType)} onKeyDown={event=>move(event,ordered.map(([scope])=>scope),sourceType,setActiveScope,tabs.current)}><Icon size={14} aria-hidden="true"/>{label}<span>{count}</span></button>;
      })}
    </div>
    {ordered.map(([sourceType,groups],scopeIndex)=>{
      const scopeApplications=[...groups.values()].flat();
      const selected=scopeApplications.find(application=>application.id===chosen)?.id??scopeApplications[0]?.id;
      const label=sourceType==="Link"?"Linked":sourceType||"Other";
      return <section className={styles.scope} key={sourceType} role="tabpanel" id={`${id}-scope-${scopeIndex}`} aria-labelledby={`${id}-tab-${scopeIndex}`} aria-label={`${label} modifiers`} hidden={activeScope!==sourceType} data-modifier-scope={sourceType}>
        {phone&&<div className={styles.choices} role="tablist" aria-label={`${label} modifier`}>
          {scopeApplications.map((application,index)=><button type="button" role="tab" key={application.id} id={`${id}-choice-${scopeIndex}-${index}`} aria-controls={`${id}-reader-${scopeIndex}-${index}`} aria-selected={selected===application.id} tabIndex={selected===application.id?0:-1} data-modifier-choice={application.id} ref={node=>{if(node)choices.current.set(application.id,node);else choices.current.delete(application.id);}} onClick={()=>{setChosen(application.id);setExpanded(application.id);}} onKeyDown={event=>move(event,scopeApplications.map(application=>application.id),application.id,key=>{setChosen(key);setExpanded(key);},choices.current)}>{gameText(application.name)||"Node modifier"}</button>)}
        </div>}
        {[...groups].map(([key,group])=><div className={styles.contextGroup} key={key} hidden={phone&&!group.some(application=>application.id===selected)}>
          {group.map(application=>{
            const common={application,questId,sourceHash,shareUrl,highlighted:application.id===selectedApplication,showSourceType:false,showContext:group.length===1,choose,positionLabel};
            const index=scopeApplications.indexOf(application);
            return phone?<QuestApplicationReader key={application.id} {...common} readerId={`${id}-reader-${scopeIndex}-${index}`} labelledBy={`${id}-choice-${scopeIndex}-${index}`} hidden={activeScope!==sourceType||selected!==application.id}/>:<QuestApplicationDetails key={application.id} {...common} flat open={expanded===application.id} onExpandedChange={open=>{if(open){setExpanded(application.id);setChosen(application.id);}else setExpanded(current=>current===application.id?undefined:current);}}/>;
          })}
          {group.length>1&&<QuestApplicationContext application={group[0]} sharedCount={group.length} choose={choose} positionLabel={positionLabel}/>}
        </div>)}
      </section>;
    })}
  </div>;
}
