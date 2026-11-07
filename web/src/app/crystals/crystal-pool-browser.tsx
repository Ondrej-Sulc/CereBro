"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { ArrowRight, Maximize2, Minimize2, Search } from "lucide-react"
import type { ChampionClass } from "@prisma/client"
import type { CrystalChampion } from "@/lib/data/crystals"
import type { CrystalOddsOpening } from "@cerebro/core/domain/crystal-odds"
import { crystalStarCategoryRates } from "@/lib/crystal-odds-presentation"
import { crystalHref } from "@/lib/crystal-navigation"
import { filterCrystalPool, type CrystalPoolState } from "@/lib/crystal-pool"
import { CrystalChampionGrid } from "./crystal-champion-grid"
import { CrystalPoolControls } from "./crystal-pool-filters"
import styles from "./crystals.module.css"
import pageStyles from "./crystal-detail-page.module.css"

type Pool = {
  returnTo?: string | null
  id: string; champions: CrystalChampion[]; q: string; rarity: string; championClass: string
  rarities: number[]; classes: ChampionClass[]; championCount: number
  championOdds?: CrystalOddsOpening | null
}

function useLocalPoolFilters(data: Pool) {
  const [draft, setDraft] = useState<CrystalPoolState>(() => ({ q: data.q, rarity: data.rarity, championClass: data.championClass, page: 1 }))
  const current = useRef(draft)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const composing = useRef(false)
  const href = (state: CrystalPoolState) => crystalHref(data.id, { ...state, q: state.q.trim().slice(0, 100), returnTo: data.returnTo })
  const cancel = useCallback(() => { if (timer.current !== null) clearTimeout(timer.current); timer.current = null }, [])
  const set = useCallback((next: CrystalPoolState) => { current.current = next; setDraft(next) }, [])
  const commit = (next: CrystalPoolState, mode: "push" | "replace") => {
    const destination = href(next)
    if (destination !== window.location.pathname + window.location.search) {
      // Next integrates native history updates without fetching a new RSC tree.
      window.history[mode === "push" ? "pushState" : "replaceState"](null, "", destination)
    }
  }
  useEffect(() => () => { if (timer.current !== null) clearTimeout(timer.current) }, [])
  useEffect(() => {
    const restore = () => {
      cancel()
      const params = new URLSearchParams(window.location.search)
      const requested = params.get("rarity") ?? ""
      const rarity = data.rarities.some(value => String(value) === requested) ? requested : data.rarities.length === 1 ? String(data.rarities[0]) : ""
      const championClass = data.classes.find(value => value === params.get("class")) ?? "all"
      set({ q: (params.get("q") ?? "").trim().slice(0, 100), rarity, championClass, page: 1 })
    }
    window.addEventListener("popstate", restore)
    return () => window.removeEventListener("popstate", restore)
  }, [data.rarities, data.classes, cancel, set])
  function navigate(changes: Partial<CrystalPoolState>, mode: "push" | "replace" = "push") {
    cancel()
    const next = { ...current.current, ...changes, page: 1 }
    set(next); commit(next, mode)
  }
  function search(q: string) {
    cancel(); set({ ...current.current, q, page: 1 })
    if (!composing.current) timer.current = setTimeout(() => { timer.current = null; commit(current.current, "replace") }, 300)
  }
  return { draft, href, navigate, search, updating: false,
    submit: () => { if (!composing.current) navigate({}, "replace") },
    compositionStart: () => { composing.current = true; cancel() },
    compositionEnd: (q: string) => { composing.current = false; search(q) },
  }
}

export function CrystalPoolBrowser({ data, children }: { data: Pool; children?: ReactNode }) {
  // A server navigation starts a new draft; native filter history retains it.
  return <PoolBrowser key={JSON.stringify([data.id, data.q, data.rarity, data.championClass])} data={data}>{children}</PoolBrowser>
}

function PoolBrowser({ data, children }: { data: Pool; children?: ReactNode }) {
  const filters = useLocalPoolFilters(data)
  const [expanded, setExpanded] = useState(false)
  const { draft } = filters
  const projection = useMemo(() => filterCrystalPool(data.champions, draft), [data.champions, draft])
  const clearHref = crystalHref(data.id, { returnTo: data.returnTo })
  const compact = data.championCount <= 8 && data.rarities.length === 1 && !draft.q && draft.championClass === "all"
  const gallery = projection.champions.length > 40
  const singleClass = data.classes.length === 1 && data.champions.every(champion => champion.championClass === data.classes[0])
  const starRates = crystalStarCategoryRates(data.championOdds, data.rarities)
  return <section className={styles.poolSection} aria-labelledby="champion-pool-title">
    <CrystalPoolControls data={{ ...data, ...draft, ...projection }} filters={filters} compact={compact} singleClass={singleClass} starRates={starRates}>{!compact && !starRates && children}</CrystalPoolControls>
    {projection.champions.length ? <div className={compact ? styles.smallChampionPool : gallery && !expanded ? pageStyles.gallery : undefined} role={gallery ? "region" : undefined} aria-label={gallery ? "Champion portraits" : undefined}><CrystalChampionGrid champions={projection.champions} rarity={draft.rarity} layout={compact ? "cards" : "portraits"} controls={!compact} toolbarActions={gallery && <button type="button" className={styles.expandPool} onClick={() => setExpanded(value => !value)} aria-expanded={expanded} aria-label={expanded ? "Collapse champion pool" : "Expand champion pool"} title={expanded ? "Collapse champion pool" : "Expand champion pool"}>{expanded ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}</button>} />{compact && children}</div> : <div className={styles.empty}>
      <Search aria-hidden="true" /><h3>No matching champions</h3><p>Try another name, class or star level.</p>
      <Link prefetch={false} scroll={false} className={styles.emptyReset} href={clearHref} onNavigate={event => { event.preventDefault(); filters.navigate({ q: "", rarity: data.rarities.length === 1 ? String(data.rarities[0]) : "", championClass: "all" }) }}>Clear filters <ArrowRight aria-hidden="true" /></Link>
    </div>}
  </section>
}
