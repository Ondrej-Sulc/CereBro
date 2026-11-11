import Image from "next/image";
import Link from "next/link";
import { permanentData, getBossPreview } from "@cerebro/core/data/game-quests/permanent";
import type { QuestSummary } from "@cerebro/core/domain/game-quests";
import { hierarchyLabel } from "@cerebro/core/domain/game-quests";
import { questDifficulty } from "@cerebro/core/domain/game-quests/browse";
import type { QuestPortrait } from "@/lib/game-quests/presentation";
import styles from "./quest-catalog.module.css";

export function QuestBossCard({ quest:q, portraits }: { quest:QuestSummary; portraits:Record<string,QuestPortrait> }) {
  const bosses=getBossPreview(q)?.bosses ?? [];
  return <article className={`${styles.bossCard} ${bosses.length>1 ? styles.multipleBosses : ""}`}>
    <Link prefetch={false} href={`/quests/${encodeURIComponent(q.id)}`} className={styles.bossCardLink}>
      <div className={styles.bossPortraits}>{bosses.map((b,i)=>{
        const portrait=b.champion ? portraits[b.gameId] : undefined;
        const src=portrait?.imageUrl ?? (!b.champion ? permanentData.nativePortraits[b.gameId]?.url : null);
        return <figure key={`${b.tierId}:${i}`}><div className={styles.bossPortrait} style={{borderColor:portrait?.color ?? "#7891aa"}}>{src ? <Image src={src} alt="" width={112} height={112} sizes="112px"/> : <span aria-hidden="true">?</span>}<small>{b.rarity}★</small></div><figcaption>{portrait?.name ?? b.champion?.name ?? b.name}</figcaption></figure>;
      })}{!bosses.length && <p className={styles.noBoss}>Boss preview not recorded</p>}</div>
      <p className={styles.rowEyebrow}>{q.section} · {hierarchyLabel(q)}</p><h3>{q.name} ↗</h3>
      {questDifficulty(q) && <p className={styles.coverage}>{questDifficulty(q)}</p>}
      <p className={styles.coverage}>{q.coverage==="full-map" ? `${q.authoredPaths} recorded ${q.authoredPaths===1?"route":"routes"} · ${q.placedEncounters} placed ${q.placedEncounters===1?"opponent":"opponents"}` : "Quest summary · map not captured"}</p>
    </Link>
    <details className={styles.rowData}><summary>Quest data</summary><p>Quest {q.id} / map {q.mapId}</p><p>Explicit final-boss preview; separate from placements and rewards.</p>{bosses.map((b,i)=><p key={i}>{b.gameId} / {b.tierId}{!b.champion && " · native NPC/legacy identity"}</p>)}</details>
  </article>;
}
