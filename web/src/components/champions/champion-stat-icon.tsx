import type { CSSProperties } from "react"
import statIcons from "@cerebro/core/data/stat-icons.json"
import { cn } from "@/lib/utils"
import styles from "./champion-stat-icon.module.css"

export type ChampionStatIconKey = keyof typeof statIcons.icons

/** Original game glyphs; adjacent text supplies the accessible stat name. */
export function ChampionStatIcon({ stat, plain = false }: { stat: ChampionStatIconKey; plain?: boolean }) {
  const icon = statIcons.icons[stat]
  return <span aria-hidden="true" data-stat-icon={stat} className={cn(styles.icon, plain && styles.plain)} style={{ "--stat-icon-color": icon.color } as CSSProperties}>
    <span className={styles.glyph} style={{ maskImage: `url(${icon.src})`, WebkitMaskImage: `url(${icon.src})` }} />
  </span>
}
