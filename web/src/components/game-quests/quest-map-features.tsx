"use client";

import type { QuestMapFeatureLocation } from "@/lib/game-quests/map-features";
import type { QuestRewardView } from "@/lib/game-quests/presentation";
import { RewardTile } from "./quest-reward-grid";
import styles from "./quest-map-features.module.css";

type MarkerProps = {
  location: QuestMapFeatureLocation;
  x: number;
  y: number;
  selected: boolean;
  active: boolean;
  onChoose: () => void;
  compact?: boolean;
};

const rewardAmount = (reward: QuestRewardView) => reward.placeholder ? "" : reward.amount ?? `×${reward.quantity.toLocaleString("en")}`;

export function QuestMapFeatureMarker({ location, x, y, selected, active, onChoose, compact = false }: MarkerProps) {
  const rewards = location.pickups.flatMap(pickup => pickup.rewards), firstReward = rewards[0];
  const label = [...location.gates.map(gate => gate.resolved ? gate.label : "Gate"), ...rewards.map(reward => `Path pickup: ${reward.name}${rewardAmount(reward) ? ` · ${rewardAmount(reward)}` : ""}`)].join("; ");
  const gateX = firstReward ? -25 : 0, rewardX = location.gates.length ? 25 : 0;
  const quantity = firstReward ? rewardAmount(firstReward) : "";
  const amountWidth = Math.max(28, Math.min(80, quantity.length * 5.5 + 12));
  return <g className={compact ? styles.compact : styles.marker} transform={compact ? `translate(${x + 37} ${y + 35}) scale(.65)` : `translate(${x} ${y})`} role={compact ? undefined : "button"} tabIndex={compact ? undefined : 0}
    aria-label={compact ? undefined : label} aria-pressed={compact ? undefined : selected} aria-hidden={compact || undefined} pointerEvents={compact ? "none" : undefined} data-coordinate={location.coordinate.join(",")}
    data-map-feature data-selected={selected} data-active={active}
    onClick={compact ? undefined : onChoose} onKeyDown={compact ? undefined : event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault(); event.stopPropagation(); onChoose();
      }
    }}>
    {!compact && <title>{label}</title>}
    {!compact && <rect x={location.gates.length && firstReward ? -53 : -28} y="-30" width={location.gates.length && firstReward ? 106 : 56} height="64" fill="transparent" pointerEvents="all"/>}
    <g aria-hidden="true" pointerEvents="none">
      {location.gates.length > 0 && <g transform={`translate(${gateX} 0)`}>
        <path className={styles.gateFrame} d="M-22-17 0-26 22-17V18L0 27-22 18Z"/>
        <path className={styles.gateBars} d="M-12 14V-6a12 12 0 0 1 24 0v20M-16 14h32M-5-15v29M5-15v29M-12-2h24"/>
        <path className={styles.focusRing} d="M-27-20 0-31 27-20V21L0 32-27 21Z"/>
      </g>}
      {firstReward && <g transform={`translate(${rewardX} 0)`}>
        <rect className={styles.pickupFrame} x="-23" y="-24" width="46" height="48" rx="10"/>
        {firstReward.imageUrl ? <image href={firstReward.imageUrl} x="-19" y="-21" width="38" height="38" preserveAspectRatio="xMidYMid meet"/> :
          <path className={styles.pickupFallback} d="M0-14 13-4 0 10-13-4ZM-13-4h26M0-14-5-4 0 10 5-4Z"/>}
        {firstReward.itemRarity&&<text x="0" y="12" textAnchor="middle" fill="#efc76b" stroke="#06101a" strokeWidth="2" paintOrder="stroke" fontSize="8" fontWeight="700">{firstReward.itemRarity}★</text>}
        {quantity && <g className={styles.amount}>
          <rect x={-amountWidth / 2} y="16" width={amountWidth} height="17" rx="5"/>
          <text y="28" textAnchor="middle">{quantity}</text>
        </g>}
        <rect className={styles.focusRing} x="-28" y="-29" width="56" height="65" rx="13"/>
      </g>}
    </g>
  </g>;
}

export function QuestMapFeatureDetails({ location }: { location: QuestMapFeatureLocation }) {
  return <div className={styles.details}>
    {location.gates.length > 0 && <section aria-label="Gate requirements">
      <h3>Gate requirements</h3>
      {location.gates.map(gate => <div key={gate.id} className={styles.gateDetails}>
        <h4>{gate.resolved ? gate.label : "Gate"}</h4>
        {gate.requirements.some(requirement=>requirement!==gate.label)&&<ul className={styles.requirements}>{gate.requirements.filter(requirement=>requirement!==gate.label).map((requirement, index) => <li key={index}>{requirement}</li>)}</ul>}
        {!gate.requirements.length&&<p className={styles.note}>Requirements not specified in the recorded definition.</p>}
        {!gate.resolved && gate.requirements.length > 0 && <p className={styles.note}>Complete requirements are not specified in the recorded definition.</p>}
      </div>)}
    </section>}
    {location.pickups.length > 0 && <section aria-label="Path pickups">
      <h3>Path pickups</h3>
      <div className={styles.placements}>{location.pickups.map((pickup, index) => <div key={pickup.id} data-path-pickup={pickup.id} className={styles.pickupDetails}>
        <h4>Recorded pickup{location.pickups.length > 1 ? ` ${index + 1}` : ""}</h4>
        {pickup.pathIndices.length > 0 && <p className={styles.routes}>{pickup.pathIndices.map(index => `Route ${index + 1}`).join(" · ")}</p>}
        <ul className={styles.rewards}>{pickup.rewards.map(reward => <RewardTile key={reward.key} reward={reward} showName showSources={false}/>)}</ul>
      </div>)}</div>
    </section>}
  </div>;
}
