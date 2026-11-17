import { QuestRewardGrid } from "./quest-reward-grid";
import type { QuestPathRewardView } from "@/lib/game-quests/map-features";
import styles from "./quest-rewards.module.css";

export function QuestPathRewards({ pickups, questId, coverage }: { pickups: QuestPathRewardView[]; questId: string; coverage?: "captured" | "uncaptured" }) {
  if (!pickups.length) return coverage === "uncaptured" ? <section id="quest-path-rewards" className={styles.container} aria-labelledby="quest-path-rewards-title"><h2 id="quest-path-rewards-title">Path rewards</h2><p className="mt-3 text-sm text-slate-400">Path reward locations weren’t recorded for this map.</p></section> : null;
  const rewards = pickups.flatMap((pickup, index) => pickup.rewards.map(reward => ({ ...reward,
    contextLabel: pickup.pathIndices.length ? `${pickup.pathIndices.length === 1 ? "Route" : "Routes"} ${pickup.pathIndices.map(i => i + 1).join(", ")}` : `Pickup ${index + 1}`,
    mapHref: `/quests/${encodeURIComponent(questId)}?${new URLSearchParams({ node: pickup.coordinate.join(","), ...(pickup.pathIndices.length ? { path: String(pickup.pathIndices[0]) } : {}) })}#quest-map`,
  })));
  return <section id="quest-path-rewards" className={styles.container} aria-labelledby="quest-path-rewards-title">
    <QuestRewardGrid title="Path rewards" id="quest-path-rewards" groups={[{ scope: "pathRewards", label: "On-path pickups", rewards }]} showSources={false} />
  </section>;
}
