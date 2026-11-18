"use client";

import { Fragment } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { QuestGateTagGroups } from "@cerebro/core/domain/game-quests/gate-tag-layout";
import type { QuestMapFeatureLocation } from "@/lib/game-quests/map-features";
import type { QuestRewardView } from "@/lib/game-quests/presentation";
import { questGateChampionLinks } from "@/lib/game-quests/gate-champion-filter";
import { RewardTile } from "./quest-reward-grid";
import { QuestGateMarker, questGateMarkerHeight, questGateMarkerWidth } from "./quest-gate-marker";
import styles from "./quest-map-features.module.css";

type MarkerProps = {
  location: QuestMapFeatureLocation;
  x: number;
  y: number;
  selected: boolean;
  active: boolean;
  onChoose: () => void;
  compact?: boolean;
  markerScale?: number;
};

const rewardAmount = (reward: QuestRewardView) => reward.placeholder ? "" : reward.amount ?? `×${reward.quantity.toLocaleString("en")}`;

function ChestGraphic({ imageUrl }: { imageUrl?: string }) {
  return imageUrl ? <image href={imageUrl} x="-25" y="-25" width="50" height="50" preserveAspectRatio="xMidYMid meet"/> : <g className={styles.chestFallback}>
    <path d="M-20-3v23h40V-3ZM-20-3v-9a8 8 0 0 1 8-8h24a8 8 0 0 1 8 8v9Z"/>
    <path d="M-12-20v40M12-20v40M-20-3h40"/><rect x="-4" y="-7" width="8" height="13" rx="2"/>
  </g>;
}

export function QuestMapFeatureMarker({ location, x, y, selected, active, onChoose, compact = false, markerScale = 1 }: MarkerProps) {
  const rewards = location.pickups.flatMap(pickup => pickup.rewards), firstReward = rewards[0];
  const chests = location.chests ?? [], firstChest = chests[0];
  const label = [...location.gates.map(gate => gate.resolved ? gate.label : "Gate"), ...rewards.map(reward => `Path pickup: ${reward.name}${rewardAmount(reward) ? ` · ${rewardAmount(reward)}` : ""}`), ...(firstChest ? [chests.length > 1 ? "Chests" : "Chest"] : [])].join("; ");
  const slots = [location.gates.length ? "gate" : "", firstReward ? "reward" : "", firstChest ? "chest" : ""].filter(Boolean);
  const slotX = (slot: string) => (slots.indexOf(slot) - (slots.length - 1) / 2) * 50;
  const quantity = firstReward ? rewardAmount(firstReward) : "";
  const amountWidth = Math.max(28, Math.min(80, quantity.length * 5.5 + 12));
  const hitWidth = location.gates.length ? questGateMarkerWidth(location.gates[0]) + 8 : 56;
  const hitHeight = location.gates.length ? Math.max(58, questGateMarkerHeight(location.gates[0])) + 20 : 78;
  return <g className={compact ? styles.compact : styles.marker} transform={compact ? `translate(${x + 37} ${y + 35}) scale(.65)` : `translate(${x} ${y}) scale(${markerScale})`} role={compact ? undefined : "button"} tabIndex={compact ? undefined : 0}
    aria-label={compact ? undefined : label} aria-pressed={compact ? undefined : selected} aria-hidden={compact || undefined} pointerEvents={compact ? "none" : undefined} data-coordinate={location.coordinate.join(",")}
    data-map-feature data-selected={selected} data-active={active} data-marker-scale={markerScale}
    onClick={compact ? undefined : onChoose} onKeyDown={compact ? undefined : event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault(); event.stopPropagation(); onChoose();
      }
    }}>
    {!compact && <title>{label}</title>}
    {!compact && <rect x={-hitWidth / 2 - (slots.length - 1) * 25} y={-hitHeight / 2 + 1} width={hitWidth + (slots.length - 1) * 50} height={hitHeight} rx="10" fill="transparent" pointerEvents="all"/>}
    <g aria-hidden="true" pointerEvents="none">
      {location.gates.length > 0 && <g transform={`translate(${slotX("gate")} 0)`}>
        <QuestGateMarker gate={location.gates[0]}/>
      </g>}
      {firstReward && <g transform={`translate(${slotX("reward")} 0)`}>
        <rect className={styles.pickupFrame} x="-23" y="-24" width="46" height="48" rx="10"/>
        {firstReward.imageUrl ? <image href={firstReward.imageUrl} x="-19" y="-21" width="38" height="38" preserveAspectRatio="xMidYMid meet"/> :
          <path className={styles.pickupFallback} d="M0-14 13-4 0 10-13-4ZM-13-4h26M0-14-5-4 0 10 5-4Z"/>}
        {firstReward.itemRarity&&<text x="0" y="12" textAnchor="middle" fill="#efc76b" stroke="#06101a" strokeWidth="2" paintOrder="stroke" fontSize="8" fontWeight="700">{firstReward.itemRarity}★</text>}
        {quantity && <g className={styles.amount} data-pickup-amount>
          <rect x={-amountWidth / 2} y="16" width={amountWidth} height="17" rx="5"/>
          <text y="28" textAnchor="middle">{quantity}</text>
        </g>}
        <rect className={styles.focusRing} x="-28" y="-29" width="56" height="65" rx="13"/>
      </g>}
      {firstChest && <g transform={`translate(${slotX("chest")} 0)`}>
        <ChestGraphic imageUrl={firstChest.imageUrl}/>
        <rect className={styles.focusRing} x="-29" y="-29" width="58" height="58" rx="11"/>
      </g>}
    </g>
  </g>;
}

function GateRequirementTags({ groups, countLabel }: { groups: QuestGateTagGroups; countLabel?: string }) {
  return <>
    <h4 className={styles.gateRequirementHeading}><span>Champions required</span>{countLabel && <strong>{countLabel}</strong>}</h4>
    <div className={styles.gateTagGroups}>{groups.map((group, groupIndex) => <Fragment key={groupIndex}>
      {groupIndex > 0 && <div className={styles.gateTagOr} data-gate-tag-or><span>or</span></div>}
      <div className={styles.gateTagGroup} data-gate-tag-group>{group.map((term, termIndex) => <Fragment key={termIndex}>
        {termIndex > 0 && <span className={styles.gateTagAnd}>and</span>}
        <span className={styles.gateTag} data-gate-tag data-excluded={term.negated || undefined}>{term.negated && "not "}<span className={styles.gateTagHash}>#</span>{term.label}</span>
      </Fragment>)}</div>
    </Fragment>)}</div>
  </>;
}

export function QuestMapFeatureDetails({ location }: { location: QuestMapFeatureLocation }) {
  return <div className={styles.details}>
    {location.gates.length > 0 && <section aria-label="Gate requirements">
      <h3>Gate requirements</h3>
      {location.gates.map(gate => {
        const links = gate.resolved && gate.kind === "tags" && gate.visual ? questGateChampionLinks(gate.visual) : undefined;
        return <div key={gate.id} className={styles.gateDetails}>
        {gate.resolved && gate.visual?.tagGroups?.length ? <GateRequirementTags groups={gate.visual.tagGroups} countLabel={gate.visual.countLabel}/> : <h4>{gate.resolved ? gate.label : "Gate"}</h4>}
        {gate.requirements.some(requirement=>requirement!==gate.label)&&<ul className={styles.requirements}>{gate.requirements.filter(requirement=>requirement!==gate.label).map((requirement, index) => <li key={index}>{requirement}</li>)}</ul>}
        {!gate.requirements.length&&<p className={styles.note}>Requirements not specified in the recorded definition.</p>}
        {!gate.resolved && gate.requirements.length > 0 && <p className={styles.note}>Complete requirements are not specified in the recorded definition.</p>}
        {links && <div className={styles.gateActions}>
          <Link prefetch={false} href={links.champions}>Matching champions<ArrowUpRight size={13} aria-hidden="true"/></Link>
          <Link prefetch={false} href={links.roster}>My roster<ArrowUpRight size={13} aria-hidden="true"/></Link>
        </div>}
      </div>;
      })}
    </section>}
    {location.pickups.length > 0 && <section aria-label="Path pickups">
      <h3>Path pickups</h3>
      <div className={styles.placements}>{location.pickups.map((pickup, index) => <div key={pickup.id} data-path-pickup={pickup.id} className={styles.pickupDetails}>
        {location.pickups.length > 1 && <h4>Pickup {index + 1}</h4>}
        {pickup.pathIndices.length > 0 && <p className={styles.routes}>{pickup.pathIndices.map(index => `Route ${index + 1}`).join(" · ")}</p>}
        <ul className={styles.rewards}>{pickup.rewards.map(reward => <RewardTile key={reward.key} reward={reward} showName showSources={false}/>)}</ul>
      </div>)}</div>
    </section>}
    {Boolean(location.chests?.length) && <section aria-label="Chests">
      <h3>{location.chests!.length > 1 ? "Chests" : "Chest"}</h3>
      {location.chests!.map(chest => <div key={chest.id} className={styles.chestDetails} data-path-chest>
        <svg viewBox="-30 -30 60 60" width="54" height="54" aria-hidden="true"><ChestGraphic imageUrl={chest.imageUrl}/></svg>
        <div>{chest.pathIndices.length > 0 && <p className={styles.routes}>{chest.pathIndices.map(index=>`Route ${index+1}`).join(" · ")}</p>}<p className={styles.note}>Contents not specified.</p></div>
      </div>)}
    </section>}
  </div>;
}
