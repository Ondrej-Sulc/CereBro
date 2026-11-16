import Link from "next/link";
import { ArrowUpRight, Compass, MapPinned, Skull } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import type { QuestOpponentMatch } from "@cerebro/core/domain/game-quests/opponent-lookup";
import type { QuestPortrait as Portrait } from "@/lib/game-quests/presentation";
import { QuestPortrait } from "./quest-portrait";
import styles from "./quest-opponent-header.module.css";

export function QuestOpponentHeader({ portrait, name, matches, children }: {
  portrait?: Portrait;
  name?: string;
  matches: QuestOpponentMatch[];
  children?: ReactNode;
}) {
  const encounters = [...new Map(matches.map(match => [match.key, match])).values()];
  const questCount = new Set(encounters.map(match => match.quest.id)).size;
  const bossCount = encounters.filter(match => match.boss).length;

  return <header className={styles.header} data-quest-opponent-header style={{ "--opponent-color": portrait?.color ?? "#86cfe6" } as CSSProperties}>
    <svg className={styles.routes} viewBox="0 0 900 280" fill="none" aria-hidden="true" focusable="false">
      <path d="m368 226 74-74 86 0 55-56 94 0 60-60h89M442 152v-75l49-49h117M528 152l55 56h94l60-60h89" />
      <path className={styles.routeHighlight} d="m368 226 74-74h86l55-56h94l60-60h89" />
      <circle cx="442" cy="152" r="6" /><circle cx="583" cy="96" r="6" />
      <circle cx="677" cy="208" r="6" /><circle cx="737" cy="36" r="6" />
      <circle cx="491" cy="28" r="4" /><circle cx="826" cy="148" r="4" />
    </svg>
    <div className={styles.copy}>
      <p className={styles.eyebrow}>Quest encounters</p>
      <div className={styles.identity}>
        {name ? <span className={styles.portrait}><QuestPortrait portrait={portrait} large /></span>
          : <span className={styles.explorerIcon} aria-hidden="true"><Compass /></span>}
        <div>
          <h1>{portrait?.href ? <Link href={portrait.href}>{name}<ArrowUpRight aria-hidden="true" /></Link> : name ?? "Find a quest opponent"}</h1>
          {portrait && <p className={styles.className}><span aria-hidden="true" />{portrait.className}</p>}
        </div>
      </div>
      <p className={styles.lede}>{name ? "Find this opponent on quest maps and jump straight to an encounter." : "Find where a champion appears in Story and Special quests. Choose an opponent to explore their encounters."}</p>
      {name && <div className={styles.stats} aria-label="All mapped encounters">
        <span><MapPinned aria-hidden="true" /><strong>{questCount}</strong> {questCount === 1 ? "quest with matches" : "quests with matches"}</span>
        <span><Skull aria-hidden="true" /><strong>{bossCount}</strong> {bossCount === 1 ? "boss encounter" : "boss encounters"}</span>
      </div>}
    </div>
    {children && <div className={styles.lookup}>{children}</div>}
  </header>;
}
