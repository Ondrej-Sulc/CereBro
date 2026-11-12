import Image from "next/image";
import Link from "next/link";
import { ArrowRight, UserRound } from "lucide-react";
import { permanentData, getBossPreview } from "@cerebro/core/data/game-quests/permanent";
import type { QuestSummary } from "@cerebro/core/domain/game-quests";
import { hierarchyLabel } from "@cerebro/core/domain/game-quests";
import { questDifficulty } from "@cerebro/core/domain/game-quests/browse";
import type { QuestPortrait } from "@/lib/game-quests/presentation";
import styles from "./quest-boss-card.module.css";

export function QuestBossCard({ quest:q, portraits }: { quest:QuestSummary; portraits:Record<string,QuestPortrait> }) {
  const bosses=getBossPreview(q)?.bosses ?? [];
  const number=hierarchyLabel(q);
  const difficulty=questDifficulty(q);
  const bossLabel=bosses.length>1 ? "Bosses" : "Boss";
  return <article className={styles.card}>
    <Link prefetch={false} href={`/quests/${encodeURIComponent(q.id)}`} aria-label={`Quest ${number}: ${q.name}`} className={styles.link}>
      <div className={styles.heading}>
        <h3><span className={styles.number}>{number}</span>{" "}<span className={styles.title}>{q.name}</span></h3>
        <span className={styles.arrow} aria-hidden="true"><ArrowRight size={18}/></span>
      </div>
      {(difficulty || q.coverage!=="full-map") && <p className={styles.variant}>{[difficulty,q.coverage!=="full-map" ? "Map unavailable" : ""].filter(Boolean).join(" · ")}</p>}
      <div className={styles.bossSection}>
        {bosses.length ? <>
          <p className={styles.bossLabel}>{bossLabel}</p>
          <ul className={styles.bossList} aria-label={bossLabel}>{bosses.map((b,i)=>{
            const portrait=b.champion ? portraits[b.gameId] : undefined;
            const src=portrait?.imageUrl ?? (!b.champion ? permanentData.nativePortraits[b.gameId]?.url : null);
            return <li key={`${b.tierId}:${i}`}>
              <span className={styles.portrait} style={{borderColor:portrait?.color ?? "#7891aa"}}>{src ? <Image src={src} alt="" width={48} height={48} sizes="48px"/> : <UserRound size={24} aria-hidden="true"/>}</span>
              <span className={styles.bossIdentity}><span className={styles.bossName}>{portrait?.name ?? b.champion?.name ?? b.name}</span><span className={styles.rarity}>{b.rarity}★</span></span>
            </li>;
          })}</ul>
        </> : <p className={styles.noBoss}>Boss information unavailable</p>}
      </div>
    </Link>
  </article>;
}
