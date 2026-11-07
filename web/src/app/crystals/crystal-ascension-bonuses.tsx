import Image from "next/image"
import type { CSSProperties } from "react"
import { Package, Plus } from "lucide-react"
import { getChampionClassColors } from "@/lib/championClassHelper"
import { crystalRewardAmount } from "@/lib/crystal-reward-presentation"
import type { CrystalAscensionBonusGroup } from "@/lib/crystal-ascension-bonuses"
import styles from "./crystal-ascension-bonuses.module.css"

const name = (value: string) => value === value.toLocaleUpperCase("en")
  ? value.toLocaleLowerCase("en").replace(/\b[a-z]/g, letter => letter.toUpperCase()) : value

export function CrystalAscensionBonuses({ groups }: { groups: CrystalAscensionBonusGroup[] }) {
  const count = groups.reduce((total, group) => total + group.members.length, 0)
  return <section className={styles.section} aria-labelledby="crystal-bonus-rewards-title">
    <header className={styles.heading}><h2 id="crystal-bonus-rewards-title">Ascension bonuses <span>{count}</span></h2><p>With specific champion outcomes</p></header>
    <p className={styles.description}>Each listed outcome includes its champion token and the matching class token. Other drops of the same champion may not include these bonuses.</p>
    <div className={styles.groups}>{groups.map(group => <article key={group.key} className={styles.group} style={{ "--class-color": getChampionClassColors(group.championClass).color } as CSSProperties} aria-label={`${group.rarity}-star ${group.className} ascension bonuses`}>
      <header className={styles.groupHeader}>
        <div><h3>{group.className}</h3><p>{group.rarity}★ <span>·</span> {group.members.length} {group.members.length === 1 ? "champion" : "champions"}</p></div>
        <div className={styles.classToken} data-class-token={group.classToken.data} title={group.classToken.displayName}>
          <Plus aria-hidden="true" className={styles.plus} />
          {group.classToken.imageUrl ? <Image src={group.classToken.imageUrl} alt="" width={44} height={44} sizes="44px" /> : <Package aria-hidden="true" />}
          <span><strong>Class token {crystalRewardAmount(group.classToken)}</strong><small>per listed outcome</small></span>
        </div>
      </header>
      <ul className={styles.champions} aria-label="Champion-specific ascension tokens">{group.members.map(({ bonus, championToken }) => <li key={bonus.key} data-bonus-outcome={bonus.key} data-champion-token={championToken.data} title={championToken.displayName}>
        <span className={styles.artwork}>{championToken.imageUrl ? <Image src={championToken.imageUrl} alt="" width={64} height={64} sizes="64px" /> : <Package aria-hidden="true" />}<span>{crystalRewardAmount(championToken)}</span></span>
        <span className={styles.championName}>{name(bonus.trigger.displayName || bonus.trigger.gameId!)}</span>
      </li>)}</ul>
    </article>)}</div>
    <p className={styles.footnote}>These materials are used for automatic ascension when applicable. Quantities shown are per qualifying outcome.</p>
  </section>
}
