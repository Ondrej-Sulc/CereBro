"use client";

import type { QuestRewardView } from "@/lib/game-quests/presentation";
import { RewardNamesToggle, RewardTile, useRewardNames } from "@/components/game-quests/quest-reward-grid";
import towerStyles from "./towers.module.css";
import styles from "./tower-rewards.module.css";

const genericNames = new Set(["Resource", "Rating reward", "Recorded reward", "Item", "Recorded champion", "Crystal reward", "Crystal shards", "Upgrade material", "Material fragments", "Reward selector"]);
const unresolved = (r: QuestRewardView) => !r.imageUrl && !r.href && genericNames.has(r.name);
const quantity = (r: QuestRewardView) => r.placeholder ? "" : r.amount || `×${r.quantity.toLocaleString("en")}`;

export function TowerRewards({ rewards, compact = false }: { rewards: QuestRewardView[]; compact?: boolean }) {
  const [showNames, setShowNames] = useRewardNames();
  if (!rewards.length) return <p className={towerStyles.muted}>None listed in this definition.</p>;
  const known = rewards.filter(r => !unresolved(r));
  const unknown = rewards.filter(unresolved);
  const scope = rewards[0].scope;
  return <div className={styles.container} data-tower-rewards={scope}>
    {known.length > 0 && <>
      <div className={styles.controls}><p>Tap an item for details.</p><RewardNamesToggle showNames={showNames} onChange={setShowNames}/></div>
      <ul className={`${styles.grid} ${compact ? styles.compact : ""}`} aria-label={scope}>
        {known.map(r => <RewardTile key={r.key} reward={r} showName={showNames} showSources={r.scope !== "Entry cost"}/>)}
      </ul>
    </>}
    {unknown.length > 0 && <details className={towerStyles.unresolvedRewards}><summary>{scope === "Entry cost" ? "Entry-cost item unresolved" : scope === "Rating rewards" ? "Rating reward details unavailable" : "Reward details unavailable"}<small>{unknown.length} {unknown.length === 1 ? "record" : "records"}</small></summary><p>{scope === "Rating rewards" ? "Reward identities and rating conditions are not established." : "The item identity has not been established."} Quantities remain separate for each record.</p><ol>{unknown.map((r, i) => <li key={r.key}><span>Record {i + 1}</span><strong>{quantity(r)}</strong></li>)}</ol></details>}
  </div>;
}
