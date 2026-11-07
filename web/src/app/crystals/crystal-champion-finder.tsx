"use client"

import { CrystalBrowseBoundary } from "./crystal-browse-boundary"
import Image from "next/image"
import Link from "next/link"
import { useMemo, useState, type CSSProperties, type MouseEvent } from "react"
import { ArrowUpRight, Search, Sparkles, UserRound } from "lucide-react"
import { getChampionClassColors } from "@/lib/championClassHelper"
import { ChampionCombobox } from "@/components/comboboxes/ChampionCombobox"
import { ChampionAcquisitionSources } from "@/components/champion-acquisition-sources"
import { ChampionAcquisitionDataNotes } from "@/components/champion-acquisition-data-notes"
import { ChampionAscensionSourceContent } from "@/components/champion-ascension-source-content"
import type { loadCrystalFinder } from "@/lib/data/crystals"
import { crystalFinderHref } from "@/lib/crystal-navigation"
import { CompactCrystalFamilyGrid } from "@/components/compact-crystal-family-grid"
import { CrystalCategoryBlock, CrystalCategoryLayout } from "@/components/crystal-category-layout"
import { CrystalToolsHeader } from "./crystal-tools-nav"
import { Pagination } from "./crystal-shared"
import { useCrystalFilters } from "./use-crystal-filters"
import base from "./crystals.module.css"
import styles from "./crystal-tools.module.css"
import { CrystalFinderArtwork } from "./crystal-finder-artwork"
import { finderIdentityForSelection } from "@/lib/crystal-finder-artwork"
import artworkStyles from "./crystal-finder-artwork.module.css"
import { hasRecordedAscensionPath } from "@cerebro/core/domain/champion-ascension-eligibility"

type Data = Awaited<ReturnType<typeof loadCrystalFinder>>
export function CrystalChampionFinder({ data }: { data: Data }) {
  const filters = useCrystalFilters({ q: data.q, champion: data.championId, rarity: data.rarity, category: data.category, reward: data.reward, page: data.page }, crystalFinderHref)
  const { draft, navigate, updating } = filters
  const [pickerOpen, setPickerOpen] = useState(false)
  const changeChampion = () => setPickerOpen(true)
  const selectedId = draft.champion || (draft.q && draft.q === data.q ? data.selected?.gameId : "") || ""
  const target = { name: data.selected?.name ?? "", rarities: data.matchingRarities }
  const hasOtherSources = !!data.acquisition?.methods.length
  const ascension = draft.reward === "ascension"
  const ascensionMethodCount = data.ascensionAcquisition?.routes.length ?? 0
  const ascensionSourceCount = data.ascensionCount + ascensionMethodCount
  const crystalFamilyCount = data.mainCount + data.otherCount
  const normalSourceSummary = [
    crystalFamilyCount > 0 ? `${crystalFamilyCount} recorded crystal ${crystalFamilyCount === 1 ? "family" : "families"}` : "",
    hasOtherSources ? `${data.acquisition!.methods.length} other acquisition ${data.acquisition!.methods.length === 1 ? "source" : "sources"}` : "",
  ].filter(Boolean).join(" and ")
  const championOptions = useMemo(() => data.championOptions.filter(champion => !ascension || hasRecordedAscensionPath(champion, 7)), [data.championOptions, ascension])
  const selectedOption = data.championOptions.find(champion => champion.id === selectedId)
  const selectedIdentity = finderIdentityForSelection(data.selected, selectedId)
  const selectedName = selectedOption?.name ?? selectedIdentity?.name
  const profileHref = selectedIdentity && draft.rarity === data.rarity ? selectedIdentity.profileHref : null
  const selectedEligible = data.selected && hasRecordedAscensionPath(data.selected, 7)
  const knownEmptyPath = data.selected && data.selected.recordedRarities.includes(7)
  const examples = ascension ? championOptions.slice(0, 3) : [{ id: "gwenom", name: "Gwenom" }, { id: "hulk", name: "Hulk" }, { id: "phoenix_dark", name: "Dark Phoenix" }]

  const jumpToSource = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const target = document.getElementById(id)
    if (!target) return
    event.preventDefault()
    if (target instanceof HTMLDetailsElement) {
      target.open = true
      target.querySelector("summary")?.focus({ preventScroll: true })
    } else target.focus({ preventScroll: true })
    // Native fragment navigation to <details> resets summary focus in Chromium.
    // Keep the real fragment/scroll destination while preserving disclosure focus.
    if (window.location.hash !== `#${id}`) window.history.pushState(null, "", `#${id}`)
    target.scrollIntoView({ block: "start" })
  }
  const resultLinks = data.selected && data.ascensionAcquisition && selectedEligible && (!ascension || hasOtherSources) && <nav className={styles.resultLinks} aria-label="Jump to source section">
    <span>Jump to</span>
    <a href="#finder-champion-acquisition" onClick={event => jumpToSource(event, "finder-champion-acquisition")}>Champion acquisition</a>
    <a href="#finder-ascension" onClick={event => jumpToSource(event, "finder-ascension")}>7★ Ascension</a>
  </nav>
  const ascensionContent = data.selected && data.ascensionAcquisition && selectedEligible && <ChampionAscensionSourceContent
        id="finder-ascension" showDataNotes={false} headingLevel={2} headingActions={ascension ? resultLinks : undefined}
        key={`${data.selected.gameId}:${data.rarity}:${data.reward}:${data.page}`}
        championName={data.selected.name}
        data={{ observedAt: data.ascensionObservedAt, crystals: data.ascensionSources, acquisition: data.ascensionAcquisition }}
        returnTo={filters.href(draft)} crystalCount={data.ascensionCount} previewSize={ascension ? data.pageSize : 6}>
        {ascension && <Pagination page={data.page} pages={data.pages} total={data.total} pageSize={data.pageSize} href={page => filters.href({ ...draft, page })} onNavigate={page => navigate({ page })} />}
      </ChampionAscensionSourceContent>
  return <CrystalBrowseBoundary returnTo={filters.href(draft)}><div className={[base.page, !ascension && styles.finderPage].filter(Boolean).join(" ")}>
    <nav className={base.breadcrumb} aria-label="Breadcrumb"><Link href="/champions?view=catalog">Champions</Link><span>/</span><Link href="/crystals">Crystals</Link><span>/</span><span>Find a champion</span></nav>
    <section className={[base.catalogIntro, styles.finderIntro].join(" ")} aria-labelledby="finder-title">
    <CrystalToolsHeader active="champions">
      <div className={[artworkStyles.hero, selectedId && artworkStyles.selectedHero].filter(Boolean).join(" ")} aria-label={selectedId ? "Selected champion" : undefined}>
        {selectedId ? <div className={artworkStyles.selectedCopy}>
          <p className={artworkStyles.finderLabel}>Find a champion</p>
          <h1 id="finder-title">{selectedName ?? (updating ? "Finding champion…" : "Champion not found")}</h1>
          <div className={artworkStyles.identityContext}>
            <span>{draft.rarity ? `${draft.rarity}★` : "All star levels"}</span>
            {profileHref && <Link href={profileHref} data-finder-profile>View champion <ArrowUpRight aria-hidden="true" /></Link>}
          </div>
        </div> : <div className={artworkStyles.copy}><p className={base.eyebrow}>Champion acquisition</p><h1 id="finder-title">Find a champion</h1><p>Explore crystal pools, quest rewards, piece collections and other ways to obtain a champion.</p></div>}
        <CrystalFinderArtwork artwork={data.heroArtwork} selectedId={selectedId} />
      </div>
    </CrystalToolsHeader>
    <div className={styles.finderControls}>
      <div className={styles.finderChampion}><label htmlFor="crystal-champion-selector">Champion</label><ChampionCombobox showSelectedPortrait={false} id="crystal-champion-selector" champions={championOptions} value={selectedId} placeholder={selectedOption ? `${selectedOption.name} (outside Ascension filter)` : "Select a champion…"} open={pickerOpen} onOpenChange={setPickerOpen} onSelect={champion => navigate({ champion, q: "", category: "all" })} /></div>
      {!ascension && <div className={styles.finderStars}><span>Champion stars</span><nav className={base.catalogStars} aria-label="Find crystals by champion stars">{["", "7", "6", "5", "4", "3", "2", "1"].map(rarity => <Link key={rarity} scroll={false} aria-current={draft.rarity === rarity ? "page" : undefined} href={filters.href({ ...draft, rarity, page: 1 })} onNavigate={event => { event.preventDefault(); navigate({ rarity }) }}>{rarity ? `${rarity}★` : "All"}</Link>)}</nav></div>}
      <nav className={styles.finderFocus} aria-label="Champion source focus">{[{ id: "all", name: "All sources" }, { id: "ascension", name: "7★ Ascension" }].map(option => <Link key={option.id} scroll={false} aria-current={draft.reward === option.id ? "page" : undefined} href={filters.href({ ...draft, reward: option.id, rarity: option.id === "ascension" ? "7" : draft.rarity, category: "all", page: draft.page })} onNavigate={event => { event.preventDefault(); navigate({ reward: option.id, rarity: option.id === "ascension" ? "7" : draft.rarity, category: "all", page: draft.page }) }}>{option.id === "ascension" && <Sparkles aria-hidden="true" />}{option.name}</Link>)}</nav>
    </div>

    </section>
    <p role="status" className={data.selected && !updating ? styles.srOnly : styles.finderStatus}>{updating ? "Finding acquisition sources…" : data.selected ? ascension ? ascensionSourceCount > 0 ? `${ascensionSourceCount} recorded ascension sources at 7★` : "Ascension material sources unverified at 7★" : `${normalSourceSummary || "No champion acquisition sources recorded"}${data.rarity ? ` at ${data.rarity}★` : " across all stars"}` : data.q ? `${data.totalMatches} matching ${data.totalMatches === 1 ? "champion" : "champions"}${data.totalMatches > 20 ? " · showing the first 20" : ""}` : "Choose a champion, then select a star level."}</p>
    <div aria-busy={updating} className={styles.finderResults}>
    {!updating && <>{!data.selected && !data.q && !data.unresolvedChampion ? <section className={styles.finderWelcome}>
      <div className={styles.welcomeIcon}><UserRound aria-hidden="true" /><Search aria-hidden="true" /></div><h2>Who are you looking for?</h2><p>{ascension ? "Choose a champion with a recorded 7★ ascension path to explore material sources and exact champion bonuses. Missing sources remain unknown." : "Choose any champion to explore crystal pools and other recorded acquisition sources at the star level you want."}</p>
      <div className={styles.exampleSearches}><span>{examples.length ? "Try a champion" : "No 7★ ascension paths recorded. Choose All sources for champion acquisition."}</span>{examples.map(champion => <Link key={champion.id} scroll={false} href={filters.href({ ...draft, q: "", champion: champion.id, page: 1 })} onNavigate={event => { event.preventDefault(); navigate({ q: "", champion: champion.id, category: "all" }) }}>{champion.name} <ArrowUpRight aria-hidden="true" /></Link>)}</div>
    </section> : !data.selected ? <section className={styles.championChoices} aria-label="Matching champions">
      {data.matches.length && !data.unresolvedChampion ? <><div className={base.sectionHeading}><h2>Choose a champion</h2><p>Different versions have different pools.</p></div><ul>{data.matches.map(champion => <li key={champion.gameId}><Link style={{ "--class-accent": getChampionClassColors(champion.championClass ?? undefined).color } as CSSProperties} scroll={false} href={filters.href({ ...draft, champion: champion.gameId, category: "all", page: 1 })} onNavigate={event => { event.preventDefault(); navigate({ champion: champion.gameId, category: "all" }) }}>{champion.portraitUrl ? <Image src={champion.portraitUrl} alt="" width={44} height={44} sizes="44px" /> : <span className={styles.choiceFallback}>{champion.name.charAt(0)}</span>}<span><strong>{champion.name}</strong><small>{(ascension ? [7] : champion.rarities).map(value => `${value}★`).join(" · ")}</small></span><ArrowUpRight aria-hidden="true" /></Link></li>)}</ul></> : <div className={base.empty}><Search aria-hidden="true" /><h2>{data.unresolvedChampion ? "Champion not found" : "No matching champions"}</h2><p>{ascension ? "No matching champion has a recorded ascension path at 7★. Try the normal lookup." : "Try another name. You can search champions with crystal pools or other acquisition sources."}</p>{ascension && <div><Link className={base.emptyReset} scroll={false} href={filters.href({ ...draft, reward: "all", category: "all", page: 1 })} onNavigate={event => { event.preventDefault(); navigate({ reward: "all", category: "all" }) }}>View all acquisition sources</Link></div>}<button type="button" className={styles.changeCrystal} onClick={changeChampion}>Choose a champion</button></div>}
    </section> : <>
      {ascension && !selectedEligible && <section className={styles.ascensionEmpty} aria-label="Recorded ascension eligibility">
        <h2>{knownEmptyPath ? "No ascension path recorded" : "Ascension eligibility not recorded"}{data.rarity ? ` at ${data.rarity}★` : ""}</h2>
        <p>{knownEmptyPath ? `The recorded ${data.rarity ? `${data.rarity}★ ` : ""}blueprint has no ascension tiers.` : "This champion/star is missing from the eligibility snapshot; its real-world eligibility is unknown."} Your champion and star selection have been kept.</p>
        <div><Link scroll={false} href={filters.href({ ...draft, reward: "all", category: "all", page: 1 })} onNavigate={event => { event.preventDefault(); navigate({ reward: "all", category: "all" }) }}>View all acquisition sources <ArrowUpRight aria-hidden="true" /></Link><Link href="/crystals?reward=ascension">Browse 7★ ascension materials <ArrowUpRight aria-hidden="true" /></Link></div>
      </section>}
      {ascension && ascensionContent}
      {ascension && hasOtherSources && <details className={styles.championMethods} id="finder-champion-acquisition"><summary><span>Champion acquisition</span><small>{data.acquisition!.methods.length} {data.acquisition!.methods.length === 1 ? "method" : "methods"} · separate from Ascension</small></summary><ChampionAcquisitionSources acquisition={data.acquisition!} selectedRarity={data.rarity} /></details>}
      {(!ascension && (hasOtherSources || data.mainCount + data.otherCount === 0)) && <section id="finder-champion-acquisition" tabIndex={-1} className={styles.finderAcquisition} aria-labelledby="finder-acquisition-title" style={{ "--champion-accent": getChampionClassColors(data.selected.championClass ?? undefined).color } as CSSProperties}>
        <div className={[base.sectionHeading, styles.finderResultsHeading].join(" ")}><h2 id="finder-acquisition-title">How to obtain</h2>{resultLinks}</div>
        {hasOtherSources ? <ChampionAcquisitionSources acquisition={data.acquisition!} selectedRarity={data.rarity} /> : <p className={styles.acquisitionUnknown}>No acquisition source recorded{data.rarity ? ` at ${data.rarity}★` : ""}. Other ways to obtain this champion may exist.</p>}
      </section>}
      {!ascension && data.mainCount + data.otherCount > 0 && <section id={hasOtherSources ? undefined : "finder-champion-acquisition"} tabIndex={hasOtherSources ? undefined : -1} className={styles.finderSection} aria-labelledby="finder-pools-title">
          <div className={[base.sectionHeading, styles.finderResultsHeading].join(" ")}><h2 id="finder-pools-title">Crystal pools</h2><p>{crystalFamilyCount} {crystalFamilyCount === 1 ? "family" : "families"}</p>{!hasOtherSources && resultLinks}</div>
          {(data.categories.filter(category => category.count > 0).length > 1 || data.category !== "all") && <nav className={styles.finderCategories} aria-label="Matching crystal categories"><Link scroll={false} aria-current={draft.category === "all" ? "page" : undefined} href={filters.href({ ...draft, category: "all", page: 1 })} onNavigate={event => { event.preventDefault(); navigate({ category: "all" }) }}>All types <span>{data.otherCount}</span></Link>{data.categories.filter(category => category.count > 0).map(category => <Link key={category.id} scroll={false} aria-current={draft.category === category.id ? "page" : undefined} href={filters.href({ ...draft, category: category.id, page: 1 })} onNavigate={event => { event.preventDefault(); navigate({ category: category.id }) }}>{category.name}<span>{category.count}</span></Link>)}</nav>}
          <CrystalCategoryLayout>
            {data.main.length > 0 && <CrystalCategoryBlock visibleFamilyCount={data.main.length} className={styles.finderPoolGroup} data-crystal-category="main" aria-labelledby="finder-main-title"><header><h3 id="finder-main-title">Main pools</h3><span>{data.mainCount} {data.mainCount === 1 ? "family" : "families"}</span></header><CompactCrystalFamilyGrid families={data.main} rarity={data.rarity} target={target} /></CrystalCategoryBlock>}
            {data.groups.map(group => <CrystalCategoryBlock visibleFamilyCount={group.families.length} className={styles.finderPoolGroup} key={group.id} data-crystal-category={group.id} aria-labelledby={`finder-${group.id}-title`}><header><h3 id={`finder-${group.id}-title`}>{group.name}</h3><span>{group.count} families</span></header><CompactCrystalFamilyGrid families={group.families} rarity={data.rarity} target={target} /></CrystalCategoryBlock>)}
          </CrystalCategoryLayout>
          {data.otherCount > 0 && !data.groups.length && <div className={base.empty}><h3>No matching crystals in this category</h3><Link className={base.emptyReset} scroll={false} href={filters.href({ ...draft, category: "all", page: 1 })} onNavigate={event => { event.preventDefault(); navigate({ category: "all" }) }}>Show all categories</Link></div>}
          {data.otherCount > 0 && <Pagination page={data.page} pages={data.pages} total={data.total} pageSize={data.pageSize} href={page => filters.href({ ...draft, page })} onNavigate={page => navigate({ page })} />}
      </section>}


      {!ascension && ascensionContent}
      <ChampionAcquisitionDataNotes acquisition={data.acquisition} crystalPoolObservedAt={ascension ? undefined : data.observedAt} ascension={data.ascensionAcquisition} ascensionObservedAt={data.ascensionAcquisition ? data.ascensionObservedAt : undefined} eligibilityObservedAt={data.ascensionAcquisition ? data.ascensionEligibilityObservedAt : undefined} />
    </>}</>}
    </div>
  </div></CrystalBrowseBoundary>
}
