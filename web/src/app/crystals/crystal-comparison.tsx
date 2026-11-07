"use client"

import { CrystalIntentLink } from "./crystal-intent-link"
import { CrystalBrowseBoundary } from "./crystal-browse-boundary"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeftRight, ArrowUpRight, Gem, Layers } from "lucide-react"
import type { loadCrystalComparison } from "@/lib/data/crystals"
import { crystalComparisonHref, crystalHref } from "@/lib/crystal-navigation"
import { CrystalChampionGrid } from "./crystal-champion-grid"
import { CrystalGridNamesToggle } from "./crystal-grid-preferences"
import { CrystalToolsHeader } from "./crystal-tools-nav"
import { CrystalPicker } from "./crystal-picker"
import { CrystalLiveSearch } from "./crystal-live-search"
import { SourceNote } from "./crystal-shared"
import { CrystalAvailabilityNotice } from "./crystal-availability-notice"
import { useCrystalFilters } from "./use-crystal-filters"
import base from "./crystals.module.css"
import styles from "./crystal-tools.module.css"

type Data = Awaited<ReturnType<typeof loadCrystalComparison>>
export function CrystalComparisonView({ data }: { data: Data }) {
  const filters = useCrystalFilters({ left: data.leftId, right: data.rightId, rarity: data.rarity, q: data.q, section: data.section, page: 1 }, crystalComparisonHref)
  const { draft, navigate, updating } = filters
  const labels = { left: `Only in ${data.left?.name ?? "first crystal"}`, shared: "In both crystals", right: `Only in ${data.right?.name ?? "second crystal"}` }
  const visible = data.groups.filter(group => draft.section === "all" || draft.section === group.id)
  return <CrystalBrowseBoundary returnTo={filters.href(draft)}><div className={base.page}>
    <section className={base.catalogIntro} aria-labelledby="comparison-title">
      <CrystalToolsHeader active="compare">
        <div className={styles.pageHeading}><p className={base.eyebrow}>Crystal explorer</p><h1 id="comparison-title">Compare pools</h1><p>See what overlaps, and what each crystal adds to the pool.</p></div>
      </CrystalToolsHeader>
    </section>
    <section className={styles.comparisonHero} aria-label="Selected crystals">
      {(["left", "right"] as const).map((side, index) => <div className={`${styles.compareSlot} ${side === "right" ? styles.rightSlot : ""}`} key={side}>
        {data[side]?.bannerArtworkUrl && <Image className={styles.slotBanner} src={data[side]!.bannerArtworkUrl!} alt="" fill sizes="(max-width: 639px) 100vw, 50vw" />}
        <div className={styles.slotContent}><span className={styles.slotLabel}>{index === 0 ? "First crystal" : "Second crystal"}</span><div className={styles.slotIdentity}>{data[side]?.artworkUrl ? <Image src={data[side]!.artworkUrl!} alt="" width={80} height={90} sizes="80px" /> : <Gem aria-hidden="true" />}<div><h2>{data[side]?.name ?? "Crystal not found"}</h2><p>{data[side] ? <><strong>{data[side]!.championCount}</strong> champions at {data.rarity}★</> : "Choose a recorded crystal to continue."}</p></div></div><div className={styles.slotActions}><CrystalPicker selectedId={data[side]?.id ?? ""} label={data[side] ? "Change crystal" : "Choose crystal"} onSelect={id => navigate({ [side]: id, q: "", section: "all" })} />{data[side] && <CrystalIntentLink href={crystalHref(data[side]!.id, { rarity: data.rarity })}>View pool <ArrowUpRight aria-hidden="true" /></CrystalIntentLink>}</div></div>
      </div>)}
      <button type="button" className={styles.swapButton} aria-label="Swap crystals" onClick={() => navigate({ left: draft.right, right: draft.left, section: draft.section === "left" ? "right" : draft.section === "right" ? "left" : draft.section })}><ArrowLeftRight aria-hidden="true" /></button>
    </section>
    <div className={styles.compareStarRow}><span>Compare champions at</span><nav aria-label="Comparison star level">{data.rarities.map(value => <Link scroll={false} key={value} aria-current={draft.rarity === String(value) ? "page" : undefined} href={filters.href({ ...draft, rarity: String(value) })} onNavigate={event => { event.preventDefault(); navigate({ rarity: String(value) }) }}>{value}★</Link>)}</nav><span className={styles.exactStarNote}>Same star level in both pools</span></div>
    {(data.left || data.right) && <SourceNote observedAt={data.observedAt} contentObservations={data.observedAt ? undefined : [
      ...(data.left ? [{ label: "First crystal contents captured", observedAt: data.left.observedAt }] : []),
      ...(data.right ? [{ label: "Second crystal contents captured", observedAt: data.right.observedAt }] : []),
    ]} />}
    {([data.left, data.right]).filter((pool, index, pools) => pool?.availabilityReview && pools.findIndex(candidate => candidate?.id === pool.id) === index).map(pool => <CrystalAvailabilityNotice key={pool!.id} id={pool!.id} review={pool!.availabilityReview!} />)}
    {!data.ready ? <div className={base.empty}><Gem aria-hidden="true" /><h2>Choose two crystals to compare</h2><p>One of these crystal links could not be found.</p></div> : <>
      {data.left?.id === data.right?.id && <p className={styles.samePoolNote}><Layers aria-hidden="true" />These openings share the same champion pool.</p>}
      {data.left?.id !== data.right?.id && data.counts.shared > 0 && data.counts.left === 0 && data.counts.right === 0 && <p className={styles.samePoolNote}><Layers aria-hidden="true" />These crystals contain the same champions at {data.rarity}★.</p>}
      <nav className={styles.compareMetrics} aria-label="Champion overlap">
        {(["left", "shared", "right"] as const).map(side => <Link key={side} className={side === "shared" ? styles.sharedMetric : ""} scroll={false} aria-current={draft.section === side ? "page" : undefined} href={filters.href({ ...draft, section: draft.section === side ? "all" : side })} onNavigate={event => { event.preventDefault(); navigate({ section: draft.section === side ? "all" : side }) }}><strong>{data.counts[side]}</strong><span>{side === "shared" ? "Shared champions" : `Only in ${side === "left" ? "first" : "second"}`}</span><small>{side === "shared" ? "Present in both pools" : data[side]?.name}</small></Link>)}
      </nav>
      <div className={styles.comparisonControls}><CrystalLiveSearch value={draft.q} label="Search compared champions" compact placeholder="Find a champion in these pools…" action="/crystals/compare" fields={{ left: draft.left, right: draft.right, rarity: draft.rarity, section: draft.section }} updating={updating} onChange={filters.search} onClear={() => navigate({ q: "" }, "replace")} onSubmit={filters.submit} onCompositionStart={filters.compositionStart} onCompositionEnd={filters.compositionEnd} /><CrystalGridNamesToggle />{draft.section !== "all" && <Link scroll={false} className={styles.showAll} href={filters.href({ ...draft, section: "all" })} onNavigate={event => { event.preventDefault(); navigate({ section: "all" }) }}>Show all groups</Link>}</div>
      <p role="status" className={styles.resultStatus}>{updating ? "Updating comparison…" : `${visible.reduce((total, group) => total + group.champions.length, 0)} matching champions · ${data.rarity}★`}</p>
      <div className={styles.comparisonGroups} aria-busy={updating}>{visible.map(group => <section className={styles.comparisonGroup} key={group.id} aria-label={labels[group.id]}><header><span className={`${styles.groupDot} ${group.id === "shared" ? styles.sharedDot : group.id === "right" ? styles.rightDot : ""}`} /><h2>{labels[group.id]}</h2><span>{group.champions.length}</span></header>{group.champions.length ? <CrystalChampionGrid champions={group.champions} rarity={data.rarity} controls={false} label={labels[group.id]} /> : <p className={styles.smallEmpty}>{draft.q ? "No champions match this search in this group." : group.id === "shared" ? `No shared champions at ${data.rarity}★.` : `No champions exclusive to this crystal at ${data.rarity}★.`}</p>}</section>)}</div>
      <p className={base.poolNote}>“Only in” compares these two recorded pools at {data.rarity}★. Champions may also appear in other crystals. Counts describe membership, without drop rates.</p>
    </>}
  </div></CrystalBrowseBoundary>
}
