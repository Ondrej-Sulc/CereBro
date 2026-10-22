"use client"

import { useEffect, useState, type CSSProperties } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowUpRight, Hash, Shield, Sparkles, Swords, Tag, UsersRound, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { CompactEffectGrid, CompactEffectTile } from "@/components/champions/compact-effect-grid"
import { EffectSources } from "@/components/champions/effect-sources"
import { getChampionClassColors } from "@/lib/championClassHelper"
import { getChampionImageUrlOrPlaceholder } from "@/lib/championHelper"
import { buildRosterKitSections, type RosterKitEffect } from "@/lib/roster-kit"
import type { RosterKitDetails } from "@/lib/roster-kit-details"
import type { ChampionKitSourceGroup, ChampionKitAbilityTarget } from "@/lib/champion-kit"
import type { FilterState, ProfileRosterEntry } from "../types"

const SECTION_ICONS = { IMMUNITY: Shield, GAIN: Sparkles, INFLICT: Swords, UNKNOWN: Sparkles }

export function QuickChampionDialog({ item, prestige, open, onOpenChange, filters, showUnownedState }: {
  item: ProfileRosterEntry
  prestige?: number
  open: boolean
  onOpenChange: (open: boolean) => void
  filters: FilterState
  showUnownedState: boolean
}) {
  const classColors = getChampionClassColors(item.champion.class)
  const heroUrl = getChampionImageUrlOrPlaceholder(item.champion.images, "full", "hero")
  const portraitUrl = getChampionImageUrlOrPlaceholder(item.champion.images, "full")
  const [details, setDetails] = useState<RosterKitDetails | null>(null)
  const [detailsError, setDetailsError] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!open || !item.champion.slug) return
    const controller = new AbortController()
    setDetails(null)
    setDetailsError(false)
    const params = item.stars ? `?rarity=${item.stars}` : ""
    fetch(`/api/champions/${encodeURIComponent(item.champion.slug)}/kit${params}`, { signal: controller.signal, cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Unable to load kit details")
        const result: RosterKitDetails = await response.json()
        if (!controller.signal.aborted) setDetails(result)
      }).catch(() => { if (!controller.signal.aborted) setDetailsError(true) })
    return () => controller.abort()
  }, [open, item.champion.slug, item.stars, retry])
  const sections = buildRosterKitSections(details?.entries ?? item.champion.abilities, filters, item.stars || undefined)
  const filterKey = JSON.stringify([filters.abilities, filters.categories, filters.immunities, filters.includeResistances, filters.effectForms, filters.effectDirections])
  const matchingTagsOnly = filters.tags.length > 0
  const highlightedTags = matchingTagsOnly ? item.champion.tags.filter(tag => filters.tags.includes(tag.name)) : item.champion.tags.slice(0, 12)
  const owned = !item.isUnowned
  const detailsParams = new URLSearchParams({ tab: "overview" })
  if (owned) {
    detailsParams.set("rarity", String(item.stars))
    detailsParams.set("rank", String(item.rank))
    detailsParams.set("sig", String(item.isAwakened ? item.sigLevel : 0))
    detailsParams.set("ascension", String(item.ascensionLevel || 0))
  }
  const detailsHref = `/champions/${item.champion.slug}?${detailsParams}`
  const abilityHref = (target: ChampionKitAbilityTarget) => {
    const params = new URLSearchParams(detailsParams)
    params.set("tab", "abilities")
    params.set("ability", target.recordId)
    return `/champions/${item.champion.slug}?${params}`
  }
  const synergyParams = new URLSearchParams(detailsParams)
  synergyParams.set("tab", "synergies")
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent onEscapeKeyDown={event => {
      // The detail panel handles Escape and returns focus to its tile. Radix's
      // document-level listener runs first, so prevent it from closing the dialog.
      if (document.activeElement?.closest("[data-effect-panel]")) event.preventDefault()
    }} onCloseAutoFocus={event => {
      event.preventDefault()
      // The virtualized grid can replace the original trigger while the dialog is open.
      window.requestAnimationFrame(() => {
        const card = Array.from(document.querySelectorAll<HTMLElement>("[data-roster-entry-id]")).find(element => element.dataset.rosterEntryId === item.id)
        card?.focus({ preventScroll: true })
      })
    }} style={{ "--champion-accent": classColors.color } as CSSProperties} className="flex h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[960px] flex-col gap-0 overflow-hidden rounded-2xl border-white/10 bg-[#0a0f17] p-0 text-slate-200 shadow-2xl sm:h-[min(900px,92dvh)] sm:rounded-2xl">
      <DialogDescription className="sr-only">Champion quick overview with grouped effects and roster details.</DialogDescription>
      <header className="relative shrink-0 overflow-hidden border-b border-white/[.08] bg-[#101622]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <Image src={heroUrl} alt="" fill sizes="960px" className="object-cover object-right-top opacity-45" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0c111b] via-[#0c111b]/90 to-[#0c111b]/25" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f17] via-transparent to-transparent" />
          <div className="absolute inset-x-0 top-0 h-px opacity-70" style={{ backgroundColor: classColors.color }} />
        </div>
        <div className="relative flex min-h-[154px] items-center gap-4 p-4 pr-9 sm:min-h-[174px] sm:gap-5 sm:p-6 sm:pr-12">
          <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/25 shadow-lg shadow-black/25 sm:h-28 sm:w-24">
            <Image src={portraitUrl} alt="" fill sizes="96px" className="object-cover object-top" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[.18em]" style={{ color: classColors.color }}>{item.champion.class}</p>
            <DialogTitle className="text-2xl font-semibold leading-tight tracking-tight text-white sm:text-[32px]">{item.champion.name}</DialogTitle>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-medium text-slate-400">
              {showUnownedState ? <span className="rounded border border-white/10 bg-white/[.035] px-2 py-1 text-[10px] uppercase tracking-wider">Unowned</span> : owned && <>
                <span className="text-slate-100">{item.stars}<span className="ml-0.5 text-amber-300">★</span></span>
                <span>Rank {item.rank}</span><span>Sig {item.isAwakened ? item.sigLevel : 0}</span>
                {(item.ascensionLevel || 0) > 0 && <span className="text-amber-200">A{item.ascensionLevel}</span>}
              </>}
              {prestige !== undefined && prestige > 0 && <span className="inline-flex items-baseline gap-1.5 border-l border-white/10 pl-3"><strong className="font-semibold tabular-nums text-slate-100">{prestige.toLocaleString()}</strong><span className="text-[10px] text-slate-500">Prestige</span></span>}
            </div>
          </div>
        </div>
        <DialogClose asChild><button type="button" aria-label="Close champion preview" className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-black/20 text-slate-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"><X aria-hidden="true" className="h-4 w-4" /></button></DialogClose>
      </header>
      <div tabIndex={0} aria-label="Champion kit overview" className="min-h-0 flex-1 space-y-7 overflow-y-auto overscroll-contain px-4 py-5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-slate-500 sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-base font-semibold text-slate-100">Kit overview</h3><p className="mt-1 text-xs text-slate-500">Select an effect for its conditions and sources.</p></div><span className="inline-flex items-center gap-1.5 text-[10px] text-slate-500"><UsersRound aria-hidden="true" className="h-3 w-3" />Synergy-only effects are marked</span></div>
        {sections.map(section => {
          const Icon = SECTION_ICONS[section.key]
          const matchedCount = section.effects.filter(effect => effect.matched).length
          return <section key={section.key} aria-label={section.title}>
            <div className="mb-3 flex items-center gap-2.5 border-b border-white/[.06] pb-3"><Icon aria-hidden="true" className="h-4 w-4 text-slate-500" /><h4 className="flex-1 text-sm font-semibold text-slate-200">{section.title}</h4>{matchedCount > 0 && <span className="text-[10px] text-sky-300">{matchedCount} matched</span>}<span className="min-w-6 rounded-md border border-white/[.06] bg-white/[.025] px-1.5 py-0.5 text-center text-[11px] tabular-nums text-slate-500">{section.effects.length}</span></div>
            {section.effects.length ? <CompactEffectGrid dense>{section.effects.map(effect => <QuickEffect key={`${effect.type}:${effect.name}:${filterKey}`} effect={effect} groups={details?.groups[`${section.key}:${effect.type}:${effect.name}`] ?? details?.groups[`${section.key}:${effect.name}`]} loading={!details && !detailsError} error={detailsError} onRetry={() => setRetry(value => value + 1)} abilityHref={abilityHref} synergiesHref={`/champions/${item.champion.slug}?${synergyParams}`} />)}</CompactEffectGrid> : <p className="text-xs text-slate-500">No immunities or resistances recorded.</p>}
          </section>
        })}
        {highlightedTags.length > 0 && <section aria-label={matchingTagsOnly ? "Matching tags" : "Tags"} className="border-t border-white/[.06] pt-5"><h4 className="mb-3 flex items-center gap-2 text-xs font-medium text-slate-500"><Tag aria-hidden="true" className="h-3.5 w-3.5" />{matchingTagsOnly ? "Matching tags" : "Tags"}</h4><div className="flex flex-wrap gap-1.5">{highlightedTags.map(tag => <span key={tag.id} className="inline-flex items-center gap-1 rounded-md border border-white/[.07] bg-white/[.025] px-2 py-1 text-[11px] text-slate-400"><Hash aria-hidden="true" className="h-3 w-3 text-slate-600" />{tag.name}</span>)}</div></section>}
      </div>
      <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-white/[.08] bg-[#0d131d] px-4 py-3 sm:px-6">
        <Button variant="ghost" className="text-slate-400 hover:bg-white/5 hover:text-white" onClick={() => onOpenChange(false)}>Close</Button>
        {item.champion.slug && <Button asChild className="bg-sky-600 text-white hover:bg-sky-500"><Link href={detailsHref}>Full Details<ArrowUpRight aria-hidden="true" className="ml-2 h-4 w-4" /></Link></Button>}
      </footer>
    </DialogContent>
  </Dialog>
}

export function QuickEffect({ effect, groups, loading, error, onRetry, abilityHref, synergiesHref }: {
  effect: RosterKitEffect
  groups?: ChampionKitSourceGroup[]
  loading: boolean; error: boolean; onRetry: () => void
  abilityHref: (target: ChampionKitAbilityTarget) => string
  synergiesHref: string
}) {
  const visibleGroups = groups?.filter(group => !effect.matched || effect.matchedSources.some(source => source.effectForm === group.effectForm && source.effectDirection === group.effectDirection)) ?? []
  return <CompactEffectTile effect={effect} matched={effect.matched}>
    {loading ? <p role="status" className="border-t border-white/[.06] px-4 py-4 text-xs text-slate-500">Loading conditions…</p>
      : error ? <div className="space-y-2 border-t border-white/[.06] px-4 py-4 text-xs text-slate-400"><p>Conditions couldn&apos;t be loaded.</p><button type="button" onClick={onRetry} className="text-sky-300 hover:text-sky-100">Try again</button></div>
        : visibleGroups.length ? <EffectSources effect={effect} groups={visibleGroups} showForms abilityHref={abilityHref} synergiesHref={synergiesHref} />
          : undefined}
  </CompactEffectTile>
}
