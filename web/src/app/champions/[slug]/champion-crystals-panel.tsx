"use client"

import { useEffect, useId, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, CalendarDays, ChevronDown, Gem, Gift, History, Layers, Search, Sparkles, Swords, UserRound } from "lucide-react"
import type { ChampionCrystalAvailability } from "@cerebro/core/domain/champion-crystals"
import { CRYSTAL_CATEGORIES, type CrystalCategoryId } from "@cerebro/core/domain/crystal-categories"
import { CHAMPION_CRYSTAL_PAGE_SIZE, CHAMPION_CRYSTAL_PREVIEW, CHAMPION_CRYSTAL_PREVIEW_GROUPS, getChampionCrystalGroups } from "@/lib/champion-crystal-groups"
import { crystalCatalogHref } from "@/lib/crystal-navigation"
import { CompactCrystalFamilyGrid } from "@/components/compact-crystal-family-grid"
import { CrystalCategoryBlock, CrystalCategoryLayout } from "@/components/crystal-category-layout"
import styles from "./champion-crystals-panel.module.css"

type Props = {
  availability: ChampionCrystalAvailability | undefined
  selectedRarity: string
  championName: string
  championSlug?: string | null
  embedded?: boolean
}
const categoryIcons = { main: Gem, classes: Layers, featured: Sparkles, spotlight: UserRound, modes: Swords, calendar: CalendarDays, collections: History, events: Gift, other: Gem }

export function ChampionCrystalsPanel(props: Props) {
  // Also reset when used without the acquisition parent's remount boundary.
  return <CrystalCategories key={`${props.championSlug ?? props.championName}:${props.selectedRarity}:${props.availability?.observedAt}`} {...props} />
}

function CrystalCategories({ availability, selectedRarity, championName, championSlug, embedded = false }: Props) {
  const rarity = Number(selectedRarity)
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<CrystalCategoryId | "all">("all")
  const [limits, setLimits] = useState<Partial<Record<CrystalCategoryId, number>>>({})
  const [remote, setRemote] = useState<ChampionCrystalAvailability | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const id = useId()
  const needsRemote = (availability?.otherCounts?.[selectedRarity] ?? 0) > 0
  useEffect(() => {
    if (!needsRemote || remote) return
    const controller = new AbortController()
    async function load() {
      try {
        if (!championSlug) throw new Error("Could not load recorded crystals.")
        const response = await fetch(`/api/champions/${encodeURIComponent(championSlug)}/crystals?rarity=${rarity}`, { signal: controller.signal })
        if (!response.ok) throw new Error("Could not load recorded crystals.")
        const data: ChampionCrystalAvailability = await response.json()
        if (!Array.isArray(data.crystals) || data.observedAt !== availability?.observedAt) {
          throw new Error("Crystal pools have been updated. Reload this page to view the latest snapshot.")
        }
        if (!controller.signal.aborted) { setRemote(data); setError(null) }
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Could not load recorded crystals.")
      }
    }
    void load()
    return () => controller.abort()
  }, [needsRemote, remote, championSlug, rarity, availability?.observedAt, attempt])
  const groups = useMemo(() => {
    const crystals = remote ? [...(availability?.crystals.filter(crystal => crystal.isMainPool) ?? []), ...remote.crystals.filter(crystal => !crystal.isMainPool)] : availability?.crystals ?? []
    return getChampionCrystalGroups(crystals, rarity, query)
  }, [availability, remote, rarity, query])
  const loading = needsRemote && !remote && !error
  const filtered = groups.filter(group => category === "all" || category === group.id)
  const total = filtered.reduce((count, group) => count + group.count, 0)
  const searching = !!query.trim()
  const hasSources = (availability?.crystals.some(crystal => crystal.rarities.includes(rarity)) ?? false) || needsRemote
  const date = availability ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(availability.observedAt)) : null
  const returnTo = championSlug ? `/champions/${encodeURIComponent(championSlug)}?rarity=${rarity}&tab=crystals` : null
  const Heading = embedded ? "h3" : "h2"
  const Subheading = embedded ? "h4" : "h3"
  const resetFilters = () => { setQuery(""); setCategory("all"); setLimits({}) }

  if (embedded && !hasSources) return null

  return <section aria-labelledby={`${id}-title`} className={styles.panel}>
    <header className={styles.header}>
      <div>{!embedded && <p className={styles.eyebrow}>{selectedRarity}★ acquisition</p>}
        <Heading id={`${id}-title`} className={embedded ? styles.embeddedHeading : undefined}>Crystal pools</Heading>
        {!embedded && <p>Recorded crystals that can contain {championName} at {selectedRarity}★.</p>}
      </div>
      {!embedded && <div className={styles.headerLinks}>{date && <p className={styles.snapshot}>Pool snapshot · <time dateTime={availability!.observedAt}>{date}</time></p>}<Link prefetch={false} href={crystalCatalogHref({ rarity: selectedRarity })}>Browse crystals →</Link></div>}
    </header>
    {!embedded && <p className={styles.sourceNote}>Possible rewards, without drop rates. Includes older crystals; does not confirm what is on sale.</p>}

    {!hasSources ? <div className={styles.empty}><Gem aria-hidden="true" /><h3>No direct champion rewards recorded</h3><p>{availability ? "Try another star level. Other ways to obtain this champion may exist outside these recorded crystal pools." : "Crystal pool data is not available for this champion yet."}</p></div> : <>
      <div className={styles.filters}>
        <div className={styles.searchControl}><label htmlFor={`${id}-search`}>Search all crystal sources</label>
          <div className={styles.search}><Search aria-hidden="true" /><input id={`${id}-search`} type="search" value={query} placeholder="Crystal name or recorded edition…" onChange={event => { setQuery(event.target.value); setLimits({}) }} /></div>
        </div>
        <div className={styles.categoryControl}><label htmlFor={`${id}-category`}>Category</label><select id={`${id}-category`} value={category} onChange={event => { setCategory(event.target.value as CrystalCategoryId | "all"); setLimits({}) }}>
          <option value="all">All categories</option>
          {groups.map(group => <option key={group.id} value={group.id}>{group.name} ({group.count})</option>)}
          {category !== "all" && !groups.some(group => group.id === category) && <option value={category}>{CRYSTAL_CATEGORIES.find(group => group.id === category)?.name} (0)</option>}
        </select></div>
        {(searching || category !== "all") && <button type="button" className={styles.clearFilters} onClick={resetFilters}>Clear filters</button>}
      </div>
      <p role="status" className={styles.resultCount}>{loading ? "Loading all recorded categories…" : error ? "Showing loaded pools; other recorded categories could not be loaded." : `${total} ${total === 1 ? "crystal pool" : "crystal pools"}${searching ? " matching your search" : ` recorded at ${selectedRarity}★`}`}</p>
      {error && <div role="alert" className={styles.loadError}><p>{error}</p><button type="button" className={styles.showMore} onClick={() => {
        if (error.includes("Reload this page")) window.location.reload()
        else { setError(null); setAttempt(value => value + 1) }
      }}>{error.includes("Reload this page") ? "Reload page" : "Try again"}</button></div>}
      <CrystalCategoryLayout>
        {filtered.map((group, index) => {
          const preview = searching || category !== "all" || index < CHAMPION_CRYSTAL_PREVIEW_GROUPS
          const limit = limits[group.id] ?? (preview ? CHAMPION_CRYSTAL_PREVIEW : 0)
          const visible = group.families.slice(0, limit)
          const expanded = limit > CHAMPION_CRYSTAL_PREVIEW || !preview && limit > 0
          const Icon = categoryIcons[group.id]
          const groupId = `${id}-${group.id}`
          return <CrystalCategoryBlock key={group.id} visibleFamilyCount={visible.length} className={styles.category} data-crystal-category={group.id} aria-labelledby={`${groupId}-title`}>
            <header className={styles.categoryHeading}>
              <span className={styles.categoryIcon}><Icon aria-hidden="true" /></span>
              <div className={styles.categoryText}><Subheading id={`${groupId}-title`}>{group.name} <span>{group.count}</span></Subheading><p>{group.description}</p></div>
            </header>
            <div id={groupId}>
              {visible.length > 0 && <CompactCrystalFamilyGrid families={visible} rarity={selectedRarity} target={{ name: championName }} heading={embedded ? "h5" : "h4"} returnTo={returnTo} />}
            </div>
            {(group.count > visible.length || expanded) && <div className={styles.groupFooter}>
              {expanded && <span>{visible.length} of {group.count} pools</span>}
              {group.count > visible.length && <button type="button" className={styles.viewMore} aria-label={expanded ? `Show more ${group.name}` : `View more ${group.name} (${group.count} pools)`} aria-expanded={expanded} aria-controls={groupId} onClick={() => setLimits(value => ({ ...value, [group.id]: limit === 0 ? CHAMPION_CRYSTAL_PREVIEW : limit + CHAMPION_CRYSTAL_PAGE_SIZE }))}>
                {expanded ? `Show ${Math.min(CHAMPION_CRYSTAL_PAGE_SIZE, group.count - visible.length)} more` : "View more"} <ArrowRight aria-hidden="true" />
              </button>}
              {expanded && <button type="button" className={styles.collapse} onClick={() => {
                setLimits(value => ({ ...value, [group.id]: preview ? CHAMPION_CRYSTAL_PREVIEW : 0 }))
                document.getElementById(`${groupId}-title`)?.scrollIntoView?.({ block: "nearest" })
              }}>Show less <ChevronDown aria-hidden="true" /></button>}
            </div>}
          </CrystalCategoryBlock>
        })}
      </CrystalCategoryLayout>
      {!loading && !error && total === 0 && <div className={styles.empty}><Gem aria-hidden="true" /><h3>No matching crystals</h3><p>Try another name or category.</p><button type="button" className={styles.clearFilters} onClick={resetFilters}>Clear filters</button></div>}
    </>}
  </section>
}
