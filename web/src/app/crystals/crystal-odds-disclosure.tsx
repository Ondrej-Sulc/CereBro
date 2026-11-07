"use client"

import Image from "next/image"
import { CrystalIntentLink } from "./crystal-intent-link"
import { useId, useMemo, useState } from "react"
import { ArrowUpRight, Coins, Gem, Gift, Info, Layers, Package, Search, UserRound, X } from "lucide-react"
import type { CrystalOddsGroup, CrystalOddsOpening, CrystalOddsRow } from "@cerebro/core/domain/crystal-odds"
import { crystalOddsIconKind, crystalOddsRowKey, crystalRatePercentage as percentage, type CrystalOddsRowVisual, type CrystalOddsVisuals } from "@/lib/crystal-odds-presentation"
import styles from "./crystal-odds-disclosure.module.css"

const icons = { champion: UserRound, crystal: Gem, material: Layers, resource: Coins, selector: Gift, item: Package }
const normalize = (value: string) => value.normalize("NFKD").toLocaleLowerCase("en").replace(/[^a-z0-9]/g, "")
const groupName = (group: CrystalOddsGroup) => group.name?.trim().replace(/^PRIZE\s*(\d+)$/i, "Prize $1") || `Reward group ${group.sourceIndex + 1}`

function RateRow({ row, group, visual, caption }: { row: CrystalOddsRow; group: number; visual?: CrystalOddsRowVisual; caption?: string }) {
  const label = row.label || row.rewardData || `Reward ${row.sourceIndex + 1}`
  const Icon = icons[visual?.kind ?? crystalOddsIconKind(label)]
  const name = <span className={styles.rewardName}>{label}{visual?.href && <ArrowUpRight aria-hidden="true" />}</span>
  const identity = <><span className={styles.artwork}>{visual?.imageUrl ? <Image data-odds-reward-artwork src={visual.imageUrl} alt="" width={32} height={32} loading="lazy" /> : <Icon aria-hidden="true" />}</span>{caption ? <span className={styles.identityCopy}><span className={styles.guaranteeCaption}>{caption}</span>{name}</span> : name}</>
  return <div className={styles.row} data-odds-row={crystalOddsRowKey(group, row.sourceIndex)}>
    <dt>{visual?.href ? <CrystalIntentLink className={styles.identity} href={visual.href}>{identity}</CrystalIntentLink> : <span className={styles.identity}>{identity}</span>}</dt>
    <dd title={`Server-disclosed value: ${row.prefix ?? ""}${row.percentValue}%`} data-certain={Number(row.percentValue) === 100 && !row.prefix || undefined}>{row.prefix}{percentage(row.percentValue)}%</dd>
  </div>
}

export function CrystalOddsDisclosure({ odds, visuals = {}, compact = false, embedded = false }: { odds: CrystalOddsOpening | null; visuals?: CrystalOddsVisuals; compact?: boolean; embedded?: boolean }) {
  const [query, setQuery] = useState("")
  const [selectedGroup, setSelectedGroup] = useState("all")
  const searchId = useId()
  const groups = useMemo(() => {
    const result = [...(odds?.groups ?? [])]
    const numbered = result.every(group => /^PRIZE\s*\d+$/i.test(group.name ?? ""))
      && new Set(result.map(group => Number(group.name?.match(/\d+$/)?.[0]))).size === result.length
    return numbered ? result.sort((a, b) => Number(a.name?.match(/\d+$/)?.[0]) - Number(b.name?.match(/\d+$/)?.[0])) : result
  }, [odds?.groups])
  const totalRows = groups.reduce((count, group) => count + group.rows.length, 0)
  const search = normalize(query)
  const filtered = groups.flatMap(group => {
    if (selectedGroup !== "all" && selectedGroup !== String(group.sourceIndex)) return []
    const rows = group.rows.filter(row => !search || normalize(row.label || row.rewardData || "").includes(search))
    return rows.length ? [{ group, rows }] : []
  })
  const shown = filtered.reduce((count, group) => count + group.rows.length, 0)
  const narrowed = Boolean(search || selectedGroup !== "all")
  if (odds?.status !== "captured" || totalRows === 0) return null
  const singleGroup = groups.length === 1 ? groups[0] : undefined
  const singleRow = totalRows === 1 ? singleGroup?.rows[0] : undefined
  if (singleGroup && singleRow && Number(singleRow.percentValue) === 100 && !singleRow.prefix) {
    const caption = ["Guaranteed category", singleGroup.name?.trim() ? groupName(singleGroup) : null, singleGroup.isFeatured ? "Featured" : null].filter(Boolean).join(" · ")
    return <section className={styles.guarantee} data-crystal-odds aria-label="Guaranteed reward category" title="Category rate. Individual champion odds are not inferred.">
      <dl><RateRow row={singleRow} group={singleGroup.sourceIndex} visual={visuals[crystalOddsRowKey(singleGroup.sourceIndex, singleRow.sourceIndex)]} caption={caption} /></dl>
    </section>
  }
  if (embedded && singleGroup && singleRow) return <section className={styles.inlineRate} data-crystal-odds aria-label="Champion reward category rate" title="Disclosed category rate. Individual champion odds are not inferred.">
    <dl><RateRow row={singleRow} group={singleGroup.sourceIndex} visual={visuals[crystalOddsRowKey(singleGroup.sourceIndex, singleRow.sourceIndex)]} caption={[singleGroup.name?.trim() ? groupName(singleGroup) : "Category rate", singleGroup.isFeatured ? "Featured" : null].filter(Boolean).join(" · ")} /></dl>
  </section>
  const Heading = embedded ? "h3" : "h2"
  return <section className={`${styles.section}${embedded ? ` ${styles.embedded}` : ""}`} data-crystal-odds data-compact={compact || undefined} aria-labelledby="opening-odds-title">
    <header className={styles.heading}><div><Heading id="opening-odds-title">{embedded ? "Champion category rates" : "Drop rates"}</Heading>{!embedded && <p>{groups.length > 1 ? `${groups.length} prize groups · ` : ""}{totalRows} disclosed {totalRows === 1 ? "outcome" : "outcomes"}{groups.length > 1 ? ". Each group has its own rates." : "."}</p>}</div></header>
      <p className={styles.note}><Info aria-hidden="true" /><span>Percentages apply to the listed reward categories. Individual champion odds are not inferred.</span></p>
      {(groups.length > 1 || totalRows > 10) && <div className={styles.controls}>
        {groups.length > 1 && <nav className={styles.prizes} aria-label="Prize groups"><button type="button" aria-label="Show all prize groups" aria-pressed={selectedGroup === "all"} onClick={() => setSelectedGroup("all")}>All prizes<span>{totalRows}</span></button>{groups.map(group => <button type="button" key={group.sourceIndex} aria-label={`Show ${groupName(group)}`} aria-pressed={selectedGroup === String(group.sourceIndex)} onClick={() => setSelectedGroup(String(group.sourceIndex))}>{groupName(group)}<span>{group.rows.length}</span></button>)}</nav>}
        {totalRows > 10 && <div className={styles.search}><Search aria-hidden="true" /><label className={styles.srOnly} htmlFor={searchId}>Search drop-rate rewards</label><input id={searchId} aria-label="Search drop-rate rewards" type="search" placeholder="Find a reward…" value={query} onChange={event => setQuery(event.target.value)} />{query && <button type="button" aria-label="Clear reward search" onClick={() => setQuery("")}><X aria-hidden="true" /></button>}</div>}
      </div>}
      {narrowed && <p className={styles.filterStatus} role="status">Showing {shown} of {totalRows} outcomes · Rates stay as disclosed<button type="button" onClick={() => { setQuery(""); setSelectedGroup("all") }}>Clear filters</button></p>}
      <div className={styles.groups} data-single={groups.length === 1 || undefined}>{filtered.map(({ group, rows }) => <article className={styles.group} key={group.sourceIndex} data-wide={group.rows.length >= 9 || undefined} data-tiles={compact && groups.length === 1 && totalRows <= 8 || undefined} aria-label={groupName(group)}>
        {(groups.length > 1 || group.name?.trim()) && <header className={styles.groupHeading}><h3>{groupName(group)}</h3><span>{group.isFeatured && <strong>Featured</strong>}{rows.length === group.rows.length ? `${rows.length} ${rows.length === 1 ? "outcome" : "outcomes"}` : `${rows.length} of ${group.rows.length} outcomes`}</span></header>}
        <dl className={styles.rates} data-count={rows.length}>{rows.map(row => <RateRow key={row.sourceIndex} row={row} group={group.sourceIndex} visual={visuals[crystalOddsRowKey(group.sourceIndex, row.sourceIndex)]} />)}</dl>
      </article>)}</div>
      {!shown && <div className={styles.empty}><Search aria-hidden="true" /><p>No rewards match these filters.</p><button type="button" onClick={() => { setQuery(""); setSelectedGroup("all") }}>Show all rewards</button></div>}
  </section>
}
