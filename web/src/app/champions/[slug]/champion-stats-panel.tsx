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
  const summaries = ([
    { label: "Prestige", value: view.prestige },
    { label: "Health", value: view.health, icon: "health" },
    { label: "Attack", value: view.attack, icon: "attack" },
  ] satisfies Rating[]).filter(rating => isRecordedValue(rating.value))
  const offense: { featured: Rating[]; ratings: Rating[] } = {
    featured: stat ? [{ label: "Critical rating", value: stat.criticalRating, icon: "criticalRating" }, { label: "Critical damage rating", value: stat.criticalDamageRating, icon: "criticalDamageRating" }] : [],
    ratings: stat ? [
      { label: "Armor penetration", value: stat.armorPenetration, icon: "armorPenetration" },
      { label: "Block penetration", value: stat.blockPenetration, icon: "blockPenetration" },
      { label: "Special damage multiplier", value: stat.specialDamageMultiplier != null && Number.isFinite(stat.specialDamageMultiplier) ? `${stat.specialDamageMultiplier.toFixed(2)}×` : null },
    ] : [],
  }
  const defense: { featured: Rating[]; ratings: Rating[] } = {
    featured: stat ? [{ label: "Armor rating", value: stat.armorRating, icon: "armorRating" }, { label: "Block proficiency", value: stat.blockProficiency, icon: "blockProficiency" }] : [],
    ratings: stat ? [
      { label: "Critical resistance", value: stat.criticalResistance, icon: "criticalResistance" },
      { label: "Physical resistance", value: stat.physicalResistance, icon: "physicalResistance" },
      { label: "Energy resistance", value: stat.energyResistance, icon: "energyResistance" },
    ] : [],
  }
  const hasOffense = [...offense.featured, ...offense.ratings].some(rating => isRecordedValue(rating.value))
  const hasDefense = [...defense.featured, ...defense.ratings].some(rating => isRecordedValue(rating.value))
  const context: Rating[] = stat ? [{ label: "Level", value: stat.level }, { label: "Challenger rating", value: stat.challengeRating }].filter(rating => isRecordedValue(rating.value)) : []
  const hasStats = summaries.length > 0 || context.length > 0 || hasOffense || hasDefense
  const attacks = view.champion.attacks.filter(attack => attack.hits.length > 0)
  if (!hasStats && !attacks.length) return null
  return (
    <section aria-labelledby={hasStats ? "champion-stats-heading" : "champion-attacks-heading"} className={!hasStats ? "[&>#champion-attacks]:mt-0 [&>#champion-attacks]:border-t-0 [&>#champion-attacks]:pt-0" : undefined}>
      {hasStats && <>
        <div className={styles.statsHeader}>
          <h2 id="champion-stats-heading" className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{hasOffense || hasDefense ? "Combat ratings" : "Build stats"}</h2>
          {context.length > 0 && <dl className={styles.statsBuildContext}>{context.map(rating => <div key={rating.label}><dt>{rating.label}</dt><dd>{formatStat(rating.value)}</dd></div>)}</dl>}
        </div>
        {summaries.length > 0 && <dl className={styles.statsSummary} aria-label="Selected build stats" style={{ gridTemplateColumns: `repeat(${summaries.length}, minmax(0, 1fr))` }}>
          {summaries.map(rating => <div key={rating.label}>
            <dt>{rating.icon && <ChampionStatIcon stat={rating.icon} plain />}{rating.label}</dt>
            <dd><span>{formatStat(rating.value)}</span>{rating.label === "Prestige" && <PrestigeChartAction view={view} />}</dd>
          </div>)}
        </dl>}
      </>}
      {(hasOffense || hasDefense) && <div className={styles.statsRatingGrid} style={!hasOffense || !hasDefense ? { gridTemplateColumns: "minmax(0, 1fr)" } : undefined}>
          {hasOffense &&
          <RatingPanel name="Offense" detail="Criticals & penetration" tone="offense" icon={Swords}
            {...offense} />}
          {hasDefense &&
          <RatingPanel name="Defense" detail="Armor, blocking & resistance" tone="defense" icon={Shield}
            {...defense} />}
      </div>}
      {attacks.length > 0 && <ChampionAttackProfile view={{ ...view, champion: { ...view.champion, attacks } }} onViewAbility={onViewAbility} />}
    </section>
  )
}

function PrestigeChartAction({ view }: { view: ChampionDetailsView }) {
  const stat = view.selectedStat
  if (!stat || !isRecordedValue(view.prestige)) return null
  const endpoints = view.champion.prestigeData.filter(point => point.rarity === stat.rarity && point.rank === stat.rank && isRecordedValue(point.prestige))
  if (endpoints.length < 2) return null
  const points = expandMcocPrestigeCurve({ prestigeData: endpoints, stat }).map(point => ({
    ...point,
    prestige: applyAscensionToPrestige(point.prestige, stat.rarity, view.ascensionLevel)!,
  }))
  if (points.length < 2) return null

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
  const recordedFeatured = featured.filter(rating => isRecordedValue(rating.value))
  const recordedRatings = ratings.filter(rating => isRecordedValue(rating.value))
  return (
    <section aria-labelledby={headingId} className={styles.statsRatingPanel} data-tone={tone}>
      <header className={styles.statsRatingHeader}>
        <span className={styles.statsRatingIcon}><Icon aria-hidden="true" /></span>
        <div><h3 id={headingId}>{name}</h3><p>{detail}</p></div>
      </header>
      {recordedFeatured.length > 0 && <dl className={styles.statsFeaturedRatings} style={{ gridTemplateColumns: `repeat(${recordedFeatured.length}, minmax(0, 1fr))` }}>
        {recordedFeatured.map(rating => <div key={rating.label}>
          <dt>{rating.label}</dt><dd>{rating.icon && <ChampionStatIcon stat={rating.icon} />}<span>{formatStat(rating.value)}</span></dd>
        </div>)}
      </dl>}
      {recordedRatings.length > 0 && <dl className={styles.statsRatingList}>
        {recordedRatings.map(rating => <div key={rating.label}>
          <dt>{rating.icon && <ChampionStatIcon stat={rating.icon} />}<span>{rating.label}</span></dt><dd>{formatStat(rating.value)}</dd>
        </div>)}
      </dl>}
    </section>
  )
}

function isRecordedValue(value: number | string | null | undefined) {
  return typeof value === "number" ? Number.isFinite(value) : typeof value === "string" && value.trim().length > 0
}

function formatStat(value: number | string | null) {
  return value == null ? "—" : typeof value === "number" ? Math.round(value).toLocaleString("en-US") : value
}
