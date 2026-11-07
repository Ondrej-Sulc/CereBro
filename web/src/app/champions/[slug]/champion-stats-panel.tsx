"use client"

import { ChartNoAxesCombined, Shield, Swords } from "lucide-react"
import { ChampionStatIcon, type ChampionStatIconKey } from "@/components/champions/champion-stat-icon"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { applyAscensionToPrestige, expandMcocPrestigeCurve } from "@/lib/mcoc-prestige"
import { PrestigeCurveChart } from "@/app/profile/roster/prestige-curve-chart"
import { BuildReadout } from "./champion-ability-reader"
import { ChampionAttackProfile } from "./champion-attack-profile"
import type { ChampionDetailsView } from "./champion-details-types"
import styles from "./champion-dossier.module.css"

type Rating = { label: string; value: number | string | null; icon?: ChampionStatIconKey }

export function ChampionStatsPanel({ view, onViewAbility }: { view: ChampionDetailsView; onViewAbility?: (chapter: string) => void }) {
  const stat = view.selectedStat
  return (
    <section aria-labelledby="champion-stats-heading">
      <dl className={styles.statsSummary} aria-label="Selected build stats">
        <div>
          <dt>Prestige</dt><dd><span>{formatStat(view.prestige)}</span><PrestigeChartAction view={view} /></dd>
        </div>
        <div><dt>{stat && <ChampionStatIcon stat="health" plain />}Health</dt><dd><span>{formatStat(view.health)}</span></dd></div>
        <div><dt>{stat && <ChampionStatIcon stat="attack" plain />}Attack</dt><dd><span>{formatStat(view.attack)}</span></dd></div>
      </dl>
      <div className={styles.statsHeader}>
        <h2 id="champion-stats-heading" className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Combat ratings</h2>
        {stat && <dl className={styles.statsBuildContext}>
          <div><dt>Level</dt><dd>{stat.level ?? "—"}</dd></div>
          <div><dt>Challenger rating</dt><dd>{stat.challengeRating}</dd></div>
        </dl>}
      </div>
      {stat ? (
        <div className={styles.statsRatingGrid}>
          <RatingPanel name="Offense" detail="Criticals & penetration" tone="offense" icon={Swords}
            featured={[{ label: "Critical rating", value: stat.criticalRating, icon: "criticalRating" }, { label: "Critical damage rating", value: stat.criticalDamageRating, icon: "criticalDamageRating" }]}
            ratings={[
              { label: "Armor penetration", value: stat.armorPenetration, icon: "armorPenetration" },
              { label: "Block penetration", value: stat.blockPenetration, icon: "blockPenetration" },
              { label: "Special damage multiplier", value: stat.specialDamageMultiplier == null ? null : `${stat.specialDamageMultiplier.toFixed(2)}×` },
            ]} />
          <RatingPanel name="Defense" detail="Armor, blocking & resistance" tone="defense" icon={Shield}
            featured={[{ label: "Armor rating", value: stat.armorRating, icon: "armorRating" }, { label: "Block proficiency", value: stat.blockProficiency, icon: "blockProficiency" }]}
            ratings={[
              { label: "Critical resistance", value: stat.criticalResistance, icon: "criticalResistance" },
              { label: "Physical resistance", value: stat.physicalResistance, icon: "physicalResistance" },
              { label: "Energy resistance", value: stat.energyResistance, icon: "energyResistance" },
            ]} />
        </div>
      ) : <p className={styles.statsEmpty}>Build stats are not available for this champion yet.</p>}
      <ChampionAttackProfile view={view} onViewAbility={onViewAbility} />
    </section>
  )
}

function PrestigeChartAction({ view }: { view: ChampionDetailsView }) {
  const stat = view.selectedStat
  if (!stat || view.prestige == null) return null
  const endpoints = view.champion.prestigeData.filter(point => point.rarity === stat.rarity && point.rank === stat.rank)
  if (endpoints.length < 2) return null
  const points = expandMcocPrestigeCurve({ prestigeData: endpoints, stat }).map(point => ({
    ...point,
    prestige: applyAscensionToPrestige(point.prestige, stat.rarity, view.ascensionLevel)!,
  }))

  return <Popover>
    <PopoverTrigger asChild>
      <button type="button" aria-label="View prestige chart" className={styles.prestigeChartAction}>
        <ChartNoAxesCombined aria-hidden="true" />Sig curve
      </button>
    </PopoverTrigger>
    <PopoverContent align="start" sideOffset={12} collisionPadding={16} aria-labelledby="champion-prestige-chart-heading" className="w-[min(560px,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto border-white/15 bg-[#101620] p-4 text-slate-200">
      <h3 id="champion-prestige-chart-heading" className="text-base font-semibold text-white">Prestige by signature level</h3>
      <BuildReadout view={view} className="mb-3 mt-1 text-slate-400" />
      <PrestigeCurveChart data={points} currentSig={view.sigLevel} championClass={view.champion.class} currentLabelPosition={view.sigLevel > view.maxSig / 2 ? "insideTopRight" : "insideTopLeft"} />
    </PopoverContent>
  </Popover>
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
          <dt>{rating.label}</dt><dd data-empty={rating.value == null || rating.value === 0}>{rating.icon && <ChampionStatIcon stat={rating.icon} />}<span>{formatStat(rating.value)}</span></dd>
        </div>)}
      </dl>
      <dl className={styles.statsRatingList}>
        {ratings.map(rating => <div key={rating.label}>
          <dt>{rating.icon && <ChampionStatIcon stat={rating.icon} />}<span>{rating.label}</span></dt><dd data-empty={rating.value == null || rating.value === 0}>{formatStat(rating.value)}</dd>
        </div>)}
      </dl>
    </section>
  )
}

function formatStat(value: number | string | null) {
  return value == null ? "—" : typeof value === "number" ? Math.round(value).toLocaleString("en-US") : value
}
