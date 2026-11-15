import { questRewardScope, type QuestRewardView } from "@/lib/game-quests/presentation";
import { QuestRewardGrid } from "./quest-reward-grid";
import styles from "./quest-rewards.module.css";

export function QuestRewards({ rewards,title="Quest rewards",id="quest-rewards" }: { rewards: QuestRewardView[];title?:string;id?:string }) {
  if (!rewards.length) return null;
  const scopes = [...new Set(rewards.filter(r=>!r.recordedOutcome).map(r => r.scope))];
  const groups = scopes.map(scope=>({scope,label:questRewardScope(scope),rewards:rewards.filter(r=>r.scope===scope&&!r.recordedOutcome)}));
  const outcomes=rewards.filter(r=>r.recordedOutcome);
  return <section id={id} className={styles.container} aria-labelledby={`${id}-title`}>
    <QuestRewardGrid title={title} id={id} groups={groups}/>
    {outcomes.length>0&&<details className={styles.outcomes}><summary>Other recorded outcomes</summary><ul>{outcomes.map(r=><li key={r.key}>{questRewardScope(r.scope)} · {r.name}{r.amount&&` · ${r.amount}`}</li>)}</ul></details>}
  </section>;
}
