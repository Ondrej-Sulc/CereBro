import Link from "next/link";
import type { QuestPortrait as Portrait } from "@/lib/game-quests/presentation";
import { QuestPortrait } from "./quest-portrait";
import styles from "./quest-map-explorer.module.css";

export function QuestEncounterSummary({ name, portrait, href, rarity, rank, level, signature, ascension = 0, npc = false, headingId }: {
  name: string; portrait?: Portrait; href?: string | null; rarity: number; rank: number; level: number; signature: number; ascension?: number; npc?: boolean; headingId?: string;
}) {
  const Heading = headingId ? "h2" : "h3";
  return <div className={styles.encounterSummary} data-encounter-summary>
    <div className={styles.encounterIdentity}>
      <QuestPortrait portrait={portrait}/>
      <div><Heading id={headingId}>{href ? <Link href={href}>{name} ↗</Link> : name}</Heading>
        {npc ? <p className={styles.muted}>NPC / legacy defender</p> : portrait && <p className={styles.encounterClass} style={{color:portrait.color}}>{portrait.className}</p>}
      </div>
    </div>
    <p className={styles.encounterBuild}><span>{rarity}★</span><span>Rank {rank}</span><span>Level {level}</span><span>Sig {signature}</span>{ascension>0&&<span>Ascension {ascension}</span>}</p>
  </div>;
}
