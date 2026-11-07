"use client"

import { CrystalBrowseBoundary } from "./crystal-browse-boundary"
import Image from "next/image"
import Link from "next/link"
import { useId, type CSSProperties } from "react"
import { ArrowRight, ArrowUpRight, CalendarDays, Check, Gem, Gift, History, Layers, Percent, RotateCcw, Sparkles, Swords, UserRound, X } from "lucide-react"
import type { CrystalCatalogFamily } from "@cerebro/core/domain/champion-crystals"
import { crystalEditionLabel, type CrystalCategoryId } from "@cerebro/core/domain/crystal-categories"
import { getCrystalChronology } from "@cerebro/core/domain/crystal-chronology"
import type { CrystalAvailability } from "@cerebro/core/domain/crystal-availability"
import type { loadCrystalCatalog } from "@/lib/data/crystals"
import type { CrystalBrowseEntry } from "@/lib/data/crystal-browse-catalog"
import { CRYSTAL_REWARD_FILTERS, crystalRewardFilterUsesChampionStars } from "@/lib/crystal-reward-filters"
import { crystalCatalogHref, crystalFinderHref, crystalHref } from "@/lib/crystal-navigation"
import { SourceNote, Pagination } from "./crystal-shared"
import { CrystalLiveSearch } from "./crystal-live-search"
import { useCrystalFilters } from "./use-crystal-filters"
import { CrystalToolsHeader } from "./crystal-tools-nav"
import { CrystalIntentLink } from "./crystal-intent-link"
import { rewardTypeLabel } from "./crystal-reward-labels"
import type { CrystalEditionGroup } from "@/lib/crystal-browse-groups"
import { CrystalEditionCard } from "./crystal-edition-card"
import { CrystalChampionPreview } from "./crystal-champion-preview"
import type { CrystalChampionPreview as Preview } from "@/lib/crystal-pool-preview"
import { CrystalCatalogArtwork } from "./crystal-catalog-artwork"
import artworkStyles from "./crystal-catalog-artwork.module.css"
import styles from "./crystals.module.css"

type Catalog = Awaited<ReturnType<typeof loadCrystalCatalog>>
const opening = (selection: { draw: number; pick: number }) => `Choose ${selection.pick} of ${selection.draw}`
const stars = (values: number[]) => values.length === 1 ? `${values[0]}★` : `${Math.min(...values)}–${Math.max(...values)}★`
const categoryIcons = { main: Gem, classes: Layers, featured: Sparkles, spotlight: UserRound, modes: Swords, calendar: CalendarDays, collections: History, events: Gift, other: Gem } satisfies Record<CrystalCategoryId, typeof Gem>
const categoryAccents = { main: "#99aef5", classes: "#71bcdf", featured: "#d8b978", spotlight: "#b79be8", modes: "#6bc8ba", calendar: "#85abe0", collections: "#a99cd3", events: "#d4a078", other: "#9caec9" } satisfies Record<CrystalCategoryId, string>

export function CrystalCatalogView({ data }: { data: Catalog }) {
  const filters = useCrystalFilters({ q: data.q, rarity: data.rarity, category: data.category, reward: data.reward, sort: data.sort, availability: data.availability, page: data.page }, crystalCatalogHref)
  const { draft, navigate, updating } = filters
  const activeFilterCount = [draft.q, draft.rarity, draft.category !== "all", draft.reward !== "all", draft.availability !== "all"].filter(Boolean).length
  const clearFilters = () => navigate({ q: "", rarity: "", category: "all", reward: "all", availability: "all" })
  const categories = data.categories.filter(category => category.count > 0 || category.id === draft.category)
  return <CrystalBrowseBoundary returnTo={filters.href(draft)}><div className={styles.page}>
    <nav className={styles.breadcrumb} aria-label="Breadcrumb"><Link href="/champions?view=catalog">Champions</Link><span>/</span><span>Crystals</span></nav>
    <section className={styles.catalogIntro} aria-labelledby="catalog-title">
    <CrystalToolsHeader active="browse">
    <div className={`${styles.catalogHero} ${artworkStyles.hero}`} data-catalog-hero>
      <div className={`${styles.catalogHeroCopy} ${artworkStyles.heroCopy}`}><p className={styles.eyebrow}>Game catalog</p><h1 id="catalog-title">Crystals</h1><p className={styles.catalogLede}>Explore champion pools, materials and crystal rewards.</p><SourceNote observedAt={data.observedAt} description="Includes older crystals. Does not confirm what's on sale today." /></div>
      <CrystalCatalogArtwork artwork={data.heroArtwork} />
    </div>
    </CrystalToolsHeader>
    <div className={styles.catalogTools} role="region" aria-label="Crystal filters">
      <div className={styles.filters}>
        <CrystalLiveSearch value={draft.q} label="Crystal name" placeholder="Search crystals…" action="/crystals" fields={{ rarity: draft.rarity, reward: draft.reward === "all" ? "" : draft.reward, category: draft.category === "all" ? "" : draft.category, sort: draft.sort === "recommended" ? "" : draft.sort, availability: draft.availability === "all" ? "" : draft.availability }} updating={updating} onChange={filters.search} onClear={() => navigate({ q: "" }, "replace")} onSubmit={filters.submit} onCompositionStart={filters.compositionStart} onCompositionEnd={filters.compositionEnd} />
        {crystalRewardFilterUsesChampionStars(draft.reward) && <div className={styles.catalogStarControl}><div className={styles.filterLabel}>Champion stars</div>
          <nav className={styles.catalogStars} aria-label="Filter crystals by stars">{["", "7", "6", "5", "4", "3", "2", "1"].map(rarity => <Link key={rarity} prefetch={false} scroll={false} href={filters.href({ ...draft, rarity, page: 1 })} onNavigate={event => { event.preventDefault(); navigate({ rarity }) }} aria-current={draft.rarity === rarity ? "page" : undefined}>{rarity ? `${rarity}★` : "All"}</Link>)}</nav>
        </div>}
        <Link className={styles.ascensionAction} data-ascension-filter prefetch={false} scroll={false}
          aria-label={draft.reward === "ascension" ? "Remove 7★ Ascension filter" : "7★ Ascension"}
          aria-current={draft.reward === "ascension" ? "page" : undefined}
          aria-describedby={draft.reward === "ascension" ? "crystal-ascension-filter-note" : undefined}
          href={filters.href({ ...draft, reward: draft.reward === "ascension" ? "all" : "ascension", rarity: "", page: 1 })}
          onNavigate={event => { event.preventDefault(); navigate({ reward: draft.reward === "ascension" ? "all" : "ascension", rarity: "" }) }}>
          <Sparkles aria-hidden="true" /><span><strong>7★ Ascension</strong><small>Tokens & champion bonuses</small></span>{draft.reward === "ascension" && <X aria-hidden="true" />}
        </Link>
      </div>
      {draft.reward === "ascension" && <div className={styles.ascensionContext}><p id="crystal-ascension-filter-note">7-star tokens, reviewed token bundles and bonuses tied to specific champion drops. Dust alone is excluded; 7-star A2 also needs dust.</p><Link href={crystalFinderHref({ reward: "ascension" })}>Find a champion for 7★ Ascension <ArrowUpRight aria-hidden="true" /></Link></div>}
      <div className={styles.catalogFilterOptions}>
        <div className={styles.rewardFilters}><span className={styles.catalogFilterLabel}>Rewards</span><nav aria-label="Filter crystals by rewards">{CRYSTAL_REWARD_FILTERS.filter(option => option.id !== "ascension").map(option => {
          const changes = { reward: option.id, rarity: crystalRewardFilterUsesChampionStars(option.id) ? draft.rarity : "" }
          return <Link key={option.id} prefetch={false} scroll={false}
            href={filters.href({ ...draft, ...changes, page: 1 })} onNavigate={event => { event.preventDefault(); navigate(changes) }}
            aria-current={draft.reward === option.id ? "page" : undefined}>{option.name}</Link>
        })}</nav>
        </div>
      </div>
      {activeFilterCount > 0 && <div className={styles.catalogFilterActions}>{draft.availability !== "all" && <button type="button" className={styles.appliedAvailability} aria-label="Remove availability filter" onClick={() => navigate({ availability: "all" })}>{data.availabilityFilters.find(option => option.id === draft.availability)?.label}<X aria-hidden="true" /></button>}<span>{activeFilterCount} active {activeFilterCount === 1 ? "filter" : "filters"}</span><button type="button" aria-label="Clear all crystal filters" onClick={clearFilters}><RotateCcw aria-hidden="true" />Clear all</button></div>}
    </div>
    </section>
    {(categories.length > 1 || draft.category !== "all") && <section className={styles.categoryBrowser} aria-labelledby="crystal-categories-title" aria-busy={updating}>
      <div className={styles.sectionHeading}><h2 id="crystal-categories-title">Browse by type</h2><Link className={styles.allCategories} aria-current={draft.category === "all" ? "page" : undefined} scroll={false} href={filters.href({ ...draft, category: "all", page: 1 })} onNavigate={event => { event.preventDefault(); navigate({ category: "all" }) }}>All types <span>{data.matchingCount.toLocaleString("en")}</span></Link></div>
      <nav className={styles.categoryGrid} aria-label="Crystal categories">{categories.map(category => {
        const Icon = categoryIcons[category.id]
        return <Link key={category.id} prefetch={false} style={{ "--category-accent": categoryAccents[category.id] } as CSSProperties} scroll={false} href={filters.href({ ...draft, category: category.id, page: 1 })} onNavigate={event => { event.preventDefault(); navigate({ category: category.id }) }} aria-current={draft.category === category.id ? "page" : undefined} data-empty={!category.count || undefined}>
          <span className={styles.categoryIcon}><Icon aria-hidden="true" /></span><span className={styles.categoryText}><strong>{category.name}</strong><span>{category.description}</span></span><span className={styles.categoryAside}><span className={styles.categoryCount}>{category.count.toLocaleString("en")}</span>{draft.category === category.id ? <Check aria-hidden="true" /> : <ArrowUpRight aria-hidden="true" />}</span>
        </Link>
      })}</nav>
    </section>}
    <header className={styles.catalogResultsHeader} aria-labelledby="crystal-results-title">
      <div className={styles.catalogResultsHeading}><h2 id="crystal-results-title">{draft.category !== "all" ? data.categories.find(category => category.id === draft.category)?.name : draft.reward === "ascension" ? "7★ Ascension crystals" : "All crystals"}</h2><p role="status">{updating ? "Updating crystals…" : <>{data.total.toLocaleString("en")} {data.crystalCount !== data.total ? data.total === 1 ? "result" : "results" : data.total === 1 ? "crystal" : "crystals"}{data.crystalCount !== data.total ? ` · ${data.crystalCount.toLocaleString("en")} crystals` : ""}{data.rarity ? ` with ${data.rarity}★ champions` : ""}</>}</p></div>
      <div className={styles.catalogOrder}>
        <nav aria-label="Sort crystals" aria-describedby="crystal-sort-description">{[{ id: "recommended", label: "Recommended" }, { id: "newest", label: "Newest editions" }, { id: "name", label: "A–Z" }].map(option => <Link key={option.id} prefetch={false} scroll={false} href={filters.href({ ...draft, sort: option.id, page: 1 })} onNavigate={event => { event.preventDefault(); navigate({ sort: option.id }) }} aria-current={draft.sort === option.id ? "page" : undefined}>{option.label}</Link>)}</nav>
        <p id="crystal-sort-description">{draft.sort === "recommended" ? draft.category === "all" && draft.reward === "all" ? "Main pools first · higher-star pools next" : draft.reward === "items" ? "Named editions first" : "Higher-star pools first · editions break ties" : draft.sort === "newest" ? "Named editions first · undated pools follow" : "Crystal names, A–Z"}</p>
      </div>
    </header>
    <div className={styles.catalogResults} aria-busy={updating}>
    {data.families.length ? data.category === "all" && draft.sort === "recommended" ? data.groups.map(group => <section className={styles.catalogGroup} key={group.id} aria-labelledby={`crystal-group-${group.id}`}>
      <header><h3 id={`crystal-group-${group.id}`}>{group.name}</h3><span>{group.families.length} shown</span><Link prefetch={false} scroll={false} href={filters.href({ ...draft, category: group.id, page: 1 })} onNavigate={event => { event.preventDefault(); navigate({ category: group.id }) }}>View all {group.count.toLocaleString("en")} <ArrowRight aria-hidden="true" /></Link></header>
      <CrystalFamilyGrid families={group.families} rarity={data.rarity} />
    </section>) : <CrystalFamilyGrid families={data.families} rarity={data.rarity} /> : <div className={styles.empty}><Gem aria-hidden="true" /><h3>No matching crystals</h3><p>Try another name, star level, category or reward type.</p><Link className={styles.emptyReset} href={crystalCatalogHref({ category: data.category, availability: data.availability })}>Clear search filters <ArrowRight aria-hidden="true" /></Link></div>}
    <Pagination page={data.page} pages={data.pages} total={data.total} pageSize={data.pageSize} href={page => filters.href({ ...draft, page })} onNavigate={page => navigate({ page: updating ? 1 : page })} />
    </div>
  </div></CrystalBrowseBoundary>
}

type CrystalCard = CrystalCatalogFamily & Partial<Pick<CrystalBrowseEntry, "rewardKind" | "rewardTypes" | "rewardCount" | "hasRates" | "hasPity" | "availabilityReview">> & { availability?: CrystalAvailability; availabilitySourceId?: string; editionGroup?: CrystalEditionGroup; championPreview?: Preview | null }
export function CrystalFamilyGrid({ families, rarity }: { families: CrystalCard[]; rarity: string }) {
  const indicatorId = useId()
  return <div className={styles.crystalGrid}>{families.map(family => {
    if (family.editionGroup) return <CrystalEditionCard key={family.id} name={family.name} artworkUrl={family.artworkUrl} group={family.editionGroup} rarity={rarity} championPreview={family.championPreview} />
    const sourceIds = family.variants.flatMap(variant => variant.sourceIds)
    const chronology = getCrystalChronology(sourceIds)
    const edition = chronology.label ?? crystalEditionLabel(sourceIds, family.category)
    const items = family.rewardKind === "items"
    const rewardLabels = [...new Set(family.rewardTypes?.map(rewardTypeLabel) ?? [])]
    const openingLabels = [...new Set(family.variants.flatMap(variant => variant.selection ? [variant.family?.variantLabel ? `${variant.family.variantLabel} \u00b7 ${opening(variant.selection)}` : opening(variant.selection)] : []))]
    const count = items ? family.rewardCount ?? 0 : rarity ? family.championCountsByRarity[rarity] ?? 0 : family.championCount
    const matchedOpening = family.availabilitySourceId && family.availabilitySourceId !== family.id ? family.variants.find(variant => variant.sourceIds.includes(family.availabilitySourceId!)) : undefined
    const rateDescriptionId = `${indicatorId}-${family.id}-rates`
    return <CrystalIntentLink key={family.id} className={styles.crystalCard} aria-label={`View ${family.name} contents`} aria-describedby={family.hasRates ? rateDescriptionId : undefined} href={crystalHref(family.availabilitySourceId ?? family.id, { rarity })}>
      <span className={styles.cardIndicators}>
        {family.hasRates && <span className={styles.rateIndicator}><Percent aria-hidden="true" /><span id={rateDescriptionId} className={styles.rateTooltip} role="tooltip">Drop rates recorded</span></span>}
        <ArrowUpRight className={styles.cardArrow} aria-hidden="true" />
      </span>
      <div className={styles.crystalCardTop}>{family.artworkUrl ? <Image src={family.artworkUrl} alt="" width={96} height={96} sizes="96px" /> : <Gem aria-hidden="true" />}
        <div><div className={styles.crystalEdition}><span className={styles.starBadge}>{items ? "Rewards" : rarity ? `${rarity}★` : stars(family.rarities)}</span>{edition && <span title="Named edition in game data; not a verified release date.">{edition}</span>}</div><h3>{family.name}</h3></div></div>
      {family.championPreview ? <CrystalChampionPreview champion={family.championPreview} /> : <p className={styles.championCount}><strong>{count}</strong> {items ? count === 1 ? "possible reward" : "possible rewards" : count === 1 ? "champion" : "champions"}</p>}
      {matchedOpening && <p className={styles.matchedOpening}>{`${matchedOpening.family?.variantLabel ?? (matchedOpening.selection ? "Selection" : "Standard")} opening`}</p>}
      {items ? <div className={styles.variantChips}>{rewardLabels.slice(0, 3).map(label => <span key={label}>{label}</span>)}{rewardLabels.length > 3 && <span>+{rewardLabels.length - 3} types</span>}</div> : openingLabels.length > 0 && <div className={styles.variantChips}>{openingLabels.map(label => <span key={label}>{label}</span>)}</div>}
      {(family.hasPity || family.rewardKind === "mixed") && <div className={styles.rewardBadges}>{family.hasPity && <span>Grace rules</span>}{family.rewardKind === "mixed" && <span>Mixed rewards</span>}</div>}
    </CrystalIntentLink>
  })}</div>
}
