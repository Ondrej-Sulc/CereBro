"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowDownAZ, LayoutGrid, RotateCcw } from "lucide-react"
import type { CSSProperties, ReactNode } from "react"
import type { loadCrystalDetails } from "@/lib/data/crystals"
import { getChampionClassColors } from "@/lib/championClassHelper"
import { CrystalLiveSearch } from "./crystal-live-search"
import type { useCrystalFilters } from "./use-crystal-filters"
import type { CrystalPoolState } from "@/lib/crystal-pool"
import { crystalRatePercentage, type CrystalStarRate } from "@/lib/crystal-odds-presentation"
import styles from "./crystals.module.css"

type Details = NonNullable<Awaited<ReturnType<typeof loadCrystalDetails>>>
type Props = Pick<Details, "id" | "q" | "rarity" | "rarities" | "championClass" | "page" | "classes" | "classCounts" | "matchingBeforeClass" | "total" | "championCount">
const className = (value: string) => value.charAt(0) + value.slice(1).toLowerCase()

export function CrystalPoolControls({ data, filters, children, compact = false, singleClass = false, starRates }: { data: Props; filters: ReturnType<typeof useCrystalFilters<CrystalPoolState>>; children?: ReactNode; compact?: boolean; singleClass?: boolean; starRates?: Record<string, CrystalStarRate> | null }) {
  const { draft, navigate, updating } = filters
  const clear = () => navigate({ q: "", championClass: "all", rarity: data.rarities.length === 1 ? String(data.rarities[0]) : "" })
  const hasFilters = !!draft.q || draft.championClass !== "all" || (data.rarities.length > 1 && !!draft.rarity)
  return <div className={styles.poolBrowser}>
    <header className={styles.poolHeading}>
      <div className={styles.poolHeadingTitle}><h2 id="champion-pool-title">Champion pool</h2><p role="status" className={styles.poolCount}>{updating ? "Updating champions…" : <><strong>{data.total}</strong>{data.total !== data.championCount && <span> of {data.championCount}</span>}<span className={styles.srOnly}> {data.total === 1 ? "champion" : "champions"}</span></>}</p></div>
      {!compact && <div className={styles.poolHeadingActions}>{hasFilters && <button type="button" className={styles.poolClear} onClick={clear} aria-label="Clear filters" title="Clear filters"><RotateCcw aria-hidden="true" /><span>Clear<span className={styles.poolClearMore}> filters</span></span></button>}<span className={styles.poolSort} role="img" aria-label="Alphabetical order" title="Alphabetical order"><ArrowDownAZ aria-hidden="true" /><span>Alphabetical</span></span></div>}
    </header>
    {children}
    {!compact && <div className={styles.poolControls} aria-busy={updating}>
    <div className={styles.poolSearchRow}><CrystalLiveSearch value={draft.q} label="Champion name" placeholder="Search champions…" action={`/crystals/${encodeURIComponent(data.id)}`} fields={{ rarity: draft.rarity, class: draft.championClass }} compact updating={updating} onChange={filters.search} onClear={() => navigate({ q: "" }, "replace")} onSubmit={filters.submit} onCompositionStart={filters.compositionStart} onCompositionEnd={filters.compositionEnd} />
    {data.rarities.length > 1 && <nav className={styles.starFilters} aria-label="Filter by stars" data-crystal-odds={starRates ? true : undefined} data-rates={!!starRates || undefined}><span>{starRates ? "Star category rates" : "Stars"}</span><div>{["", ...data.rarities.map(String)].map(rarity => {
      const rate = starRates?.[rarity]
      return <Link key={rarity} prefetch={false} scroll={false} href={filters.href({ ...draft, rarity, page: 1 })} onNavigate={event => { event.preventDefault(); navigate({ rarity }) }} aria-current={draft.rarity === rarity ? "page" : undefined} data-odds-row={rate?.key} title={rate ? `${rate.label} · Server-disclosed value: ${rate.prefix ?? ""}${rate.percentValue}%. Individual champion odds are not inferred.` : undefined}><strong>{rarity ? `${rarity}★` : "All"}</strong>{rate && <span>{rate.prefix}{crystalRatePercentage(rate.percentValue)}%</span>}</Link>
    })}</div></nav>}</div>
    {((data.classes.length > 0 && !singleClass) || draft.championClass !== "all") && <nav className={`${styles.classFilters}${data.classes.length < 4 ? ` ${styles.fewClasses}` : ""}`} aria-label="Filter by class">
      <Link prefetch={false} scroll={false} title="All classes" aria-label={`All classes, ${data.matchingBeforeClass} champions`} href={filters.href({ ...draft, championClass: "all", page: 1 })} onNavigate={event => { event.preventDefault(); navigate({ championClass: "all" }) }} aria-current={draft.championClass === "all" ? "page" : undefined}><LayoutGrid aria-hidden="true" /><span className={styles.classFilterLabel}>All classes</span><span>{data.matchingBeforeClass}</span></Link>
      {data.classes.map(championClass => <Link key={championClass} prefetch={false} scroll={false} title={className(championClass)} aria-label={`${className(championClass)}, ${data.classCounts[championClass] ?? 0} champions`} style={{ "--class-accent": getChampionClassColors(championClass).color } as CSSProperties} href={filters.href({ ...draft, championClass, page: 1 })} onNavigate={event => { event.preventDefault(); navigate({ championClass }) }} aria-current={draft.championClass === championClass ? "page" : undefined} data-empty={!data.classCounts[championClass] || undefined}><Image src={`/assets/icons/${className(championClass)}.png`} alt="" width={20} height={20} sizes="20px" /><span className={styles.classFilterLabel}>{className(championClass)}</span><span>{data.classCounts[championClass] ?? 0}</span></Link>)}
    </nav>}
    </div>}
  </div>
}
