import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRight, Flame, Skull, UserRound } from "lucide-react";
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
          <p className={styles.bossLabel}>{bosses.length > 1 ? `${bosses.length} bosses` : "Boss"}</p>
          <ul className={styles.bossList} data-boss-count={bosses.length} aria-label={bossLabel} role="list">{bosses.map((b,i)=>{
            const portrait=b.champion ? portraits[b.gameId] : undefined;
            const src=portrait?.imageUrl ?? (!b.champion ? permanentData.nativePortraits[b.gameId]?.url : null);
            const name=portrait?.name ?? b.champion?.name ?? b.name;
            return <li key={`${b.tierId}:${i}`} title={`${name} · ${b.rarity}-star boss`} style={{"--boss-color":portrait?.color ?? "#7891aa"} as CSSProperties}>
              <span className={styles.portraitFrame}>
                <span className={styles.portrait}>{src ? <Image src={src} alt="" width={56} height={56} sizes="56px"/> : <UserRound size={24} aria-hidden="true"/>}</span>
                <span className={styles.bossMarker} data-quest-boss-marker aria-hidden="true"><Flame className={styles.flame}/><Skull className={styles.skull}/></span>
                <span className={styles.rarity}>{b.rarity}★</span>
              </span>
              <span className={styles.bossName}>{name}</span>
            </li>;
          })}</ul>
        </> : <p className={styles.noBoss}>Boss information unavailable</p>}
      </div>
    </Link>
  </article>;
}
