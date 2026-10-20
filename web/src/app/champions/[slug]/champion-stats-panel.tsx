import { Shield, Swords } from "lucide-react"
import { ChampionAttackProfile } from "./champion-attack-profile"
import type { ChampionDetailsView } from "./champion-details-types"
import styles from "./champion-dossier.module.css"

type Rating = { label: string; value: number | string | null }

export function ChampionStatsPanel({ view, onViewAbility }: { view: ChampionDetailsView; onViewAbility?: (chapter: string) => void }) {
  const stat = view.selectedStat
  return (
    <section aria-labelledby="champion-stats-heading">
      <div className={styles.statsHeader}>
        <div>
          <h2 id="champion-stats-heading" className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Combat ratings</h2>
          <p className="mt-3 text-base leading-7 text-slate-400">The offensive and defensive details of your selected build.</p>
        </div>
        {stat && <dl className={styles.statsBuildContext}>
          <div><dt>Level</dt><dd>{stat.level ?? "—"}</dd></div>
          <div><dt>Challenger rating</dt><dd>{stat.challengeRating}</dd></div>
        </dl>}
      </div>
      {stat ? (
        <div className={styles.statsRatingGrid}>
          <RatingPanel name="Offense" detail="Criticals & penetration" tone="offense" icon={Swords}
            featured={[{ label: "Critical rating", value: stat.criticalRating }, { label: "Critical damage rating", value: stat.criticalDamageRating }]}
            ratings={[
              { label: "Armor penetration", value: stat.armorPenetration },
              { label: "Block penetration", value: stat.blockPenetration },
              { label: "Special damage multiplier", value: stat.specialDamageMultiplier == null ? null : `${stat.specialDamageMultiplier.toFixed(2)}×` },
            ]} />
          <RatingPanel name="Defense" detail="Armor, blocking & resistance" tone="defense" icon={Shield}
            featured={[{ label: "Armor rating", value: stat.armorRating }, { label: "Block proficiency", value: stat.blockProficiency }]}
            ratings={[
              { label: "Critical resistance", value: stat.criticalResistance },
              { label: "Physical resistance", value: stat.physicalResistance },
              { label: "Energy resistance", value: stat.energyResistance },
            ]} />
        </div>
      ) : <p className={styles.statsEmpty}>Build stats are not available for this champion yet.</p>}
      <ChampionAttackProfile view={view} onViewAbility={onViewAbility} />
    </section>
  )
}

function RatingPanel({ name, detail, tone, icon: Icon, featured, ratings }: {
  name: string; detail: string; tone: "offense" | "defense"; icon: typeof Swords; featured: Rating[]; ratings: Rating[]
}) {
  const headingId = `champion-ratings-${tone}`
  return (
    <section aria-labelledby={headingId} className={styles.statsRatingPanel} data-tone={tone}>
      <header className={styles.statsRatingHeader}>
        <span className={styles.statsRatingIcon}><Icon aria-hidden="true" /></span>
        <div><h3 id={headingId}>{name}</h3><p>{detail}</p></div>
      </header>
      <dl className={styles.statsFeaturedRatings}>
        {featured.map(rating => <div key={rating.label}>
          <dt>{rating.label}</dt><dd data-empty={rating.value == null || rating.value === 0}>{formatStat(rating.value)}</dd>
        </div>)}
      </dl>
      <dl className={styles.statsRatingList}>
        {ratings.map(rating => <div key={rating.label}>
          <dt>{rating.label}</dt><dd data-empty={rating.value == null || rating.value === 0}>{formatStat(rating.value)}</dd>
        </div>)}
      </dl>
    </section>
  )
}

function formatStat(value: number | string | null) {
  return value == null ? "—" : typeof value === "number" ? Math.round(value).toLocaleString("en-US") : value
}
