"use client";

import type { Coordinate, QuestApplication } from "@cerebro/core/domain/game-quests";
import { QuestApplicationContext, QuestApplicationDetails } from "./quest-application-details";
import styles from "./quest-application-details.module.css";

const scopeOrder = ["Local", "Link", "Global"];
const scopePriority = (scope: string) => scopeOrder.includes(scope) ? scopeOrder.indexOf(scope) : scopeOrder.length;

export function QuestModifierGroups({ applications, questId, sourceHash, shareUrl, selectedApplication, choose, positionLabel }: {
  applications:QuestApplication[];questId:string;sourceHash:string;shareUrl:string;selectedApplication?:string;
  choose:(coordinate:Coordinate,center?:boolean)=>void;positionLabel:(coordinate:Coordinate)=>string;
}) {
  const scopes = new Map<string, Map<string, QuestApplication[]>>();
  for (const application of applications) {
    const groups = scopes.get(application.sourceType) ?? new Map<string, QuestApplication[]>();
    // Share only identical context. Modifier identities, descriptions and parameters
    // remain separate applications, even when their names or effects repeat.
    const contextKey = JSON.stringify([application.target, application.amount, application.remainActive, application.sourceCoordinate, application.linkedTargets]);
    const group = groups.get(contextKey) ?? [];
    group.push(application);
    groups.set(contextKey, group);
    scopes.set(application.sourceType, groups);
  }
  return [...scopes].sort(([left], [right]) => scopePriority(left) - scopePriority(right)).map(([sourceType, groups]) => {
    const label = sourceType === "Link" ? "Linked" : sourceType || "Other";
    const count = [...groups.values()].reduce((total, group) => total + group.length, 0);
    return <section className={styles.scope} key={sourceType} data-modifier-scope={sourceType} aria-label={`${label} modifiers`}>
      <h4 className={styles.scopeHeading}>{label}<span aria-label={`${count} modifiers`}>{count}</span></h4>
      {[...groups].map(([key, group]) => <div className={styles.contextGroup} key={key}>
        {group.length > 1 && <QuestApplicationContext application={group[0]} sharedCount={group.length} choose={choose} positionLabel={positionLabel}/>}
        {group.map(application => <QuestApplicationDetails key={application.id} application={application} questId={questId} sourceHash={sourceHash} shareUrl={shareUrl} highlighted={selectedApplication===application.id} showSourceType={false} showContext={group.length===1} positionLabel={positionLabel} choose={choose}/>)}
      </div>)}
    </section>;
  });
}
