import Link from "next/link";
import { Gem } from "lucide-react";
import type { QuestRewardView } from "@/lib/game-quests/presentation";
import { TowerImage } from "./tower-image";
import { RewardItemOverlay } from "@/components/reward-item-overlay";
import styles from "./towers.module.css";

const genericNames = new Set(["Resource", "Rating reward", "Recorded reward", "Item", "Recorded champion", "Crystal reward", "Crystal shards", "Upgrade material", "Material fragments", "Reward selector"]);
const unresolved = (r: QuestRewardView) => !r.imageUrl && !r.href && genericNames.has(r.name);
const quantity = (r: QuestRewardView) => r.placeholder ? "" : r.amount || `×${r.quantity.toLocaleString("en")}`;

export function TowerRewards({ rewards, compact = false }: { rewards: QuestRewardView[]; compact?: boolean }) {
  if (!rewards.length) return <p className={styles.muted}>None listed in this definition.</p>;
  const unknown = rewards.filter(unresolved);
  const scope = rewards[0].scope;
  return <><ul className={`${styles.rewards} ${compact ? styles.compactRewards : ""}`}>{rewards.filter(r => !unresolved(r)).map(r => <li key={r.key}>
    <span className={`${styles.rewardImage} relative`}>{r.imageUrl ? <TowerImage src={r.imageUrl}/> : <Gem size={23} aria-hidden="true"/>}<RewardItemOverlay rank={r.rankChange} signaturePoints={r.signaturePoints} rarity={r.itemRarity}/></span>
    <div><span className={styles.rewardQuantity}>{quantity(r)}</span><p>{r.href ? <Link href={r.href}>{r.rarity ? `${r.rarity}★ ` : ""}{r.name}<span aria-hidden="true"> ↗</span></Link> : r.name}</p>{r.placeholder && <small>Details not specified</small>}</div>
  </li>)}</ul>{unknown.length > 0 && <details className={styles.unresolvedRewards}><summary>{scope === "Entry cost" ? "Entry-cost item unresolved" : scope === "Rating rewards" ? "Rating reward details unavailable" : "Reward details unavailable"}<small>{unknown.length} {unknown.length === 1 ? "record" : "records"}</small></summary><p>{scope === "Rating rewards" ? "Reward identities and rating conditions are not established." : "The item identity has not been established."} Quantities remain separate for each record.</p><ol>{unknown.map((r, i) => <li key={r.key}><span>Record {i + 1}</span><strong>{quantity(r)}</strong></li>)}</ol></details>}</>;
}
