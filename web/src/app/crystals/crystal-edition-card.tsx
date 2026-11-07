import Image from "next/image"
import { CrystalIntentLink } from "./crystal-intent-link"
import { CalendarDays, Gem } from "lucide-react"
import type { CrystalEditionGroup } from "@/lib/crystal-browse-groups"
import { crystalHref } from "@/lib/crystal-navigation"
import cardStyles from "./crystals.module.css"
import styles from "./crystal-edition-card.module.css"
import { CrystalChampionPreview } from "./crystal-champion-preview"
import type { CrystalChampionPreview as Preview } from "@/lib/crystal-pool-preview"

const stars = (values: number[]) => values.length === 1 ? `${values[0]}★` : `${Math.min(...values)}–${Math.max(...values)}★`

export function CrystalEditionCard({ name, artworkUrl, group, rarity, championPreview }: {
  name: string; artworkUrl: string | null; group: CrystalEditionGroup; rarity: string; championPreview?: Preview | null
}) {
  return <article className={`${cardStyles.crystalCard} ${styles.editionCard}`} data-crystal-editions={group.kind}>
    <div className={cardStyles.crystalCardTop}>
      {artworkUrl ? <Image src={artworkUrl} alt="" width={96} height={96} sizes="96px" /> : <Gem aria-hidden="true" />}
      <div><span className={styles.editionMonth}><CalendarDays aria-hidden="true" />{group.label}</span><h3>{name}</h3><p className={styles.editionStars}>{rarity ? `${rarity}★` : stars(group.rarities)}</p></div>
    </div>
    {championPreview && <CrystalChampionPreview champion={championPreview} />}
    <div className={styles.pools}>
      <p className={styles.caption}>Star-range pools <span>{group.options.length}</span></p>
      <nav className={styles.options} aria-label={`Login crystal pools for ${group.label}`}>
        {group.options.map(option => <CrystalIntentLink key={option.id} href={crystalHref(option.id, { rarity })} aria-label={`${stars(option.rarities)} Login Crystal, ${group.label}`}>{stars(option.rarities)}</CrystalIntentLink>)}
      </nav>
    </div>
  </article>
}
