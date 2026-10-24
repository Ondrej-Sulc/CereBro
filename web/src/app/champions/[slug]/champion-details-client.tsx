"use client"

import Image from "next/image"
import { useSearchParams } from "next/navigation"
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { BookOpen, Check, ChevronDown, Copy, Crosshair, Layers3, Link2, SlidersHorizontal, Swords, Target, Users } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { getChampionClassColors } from "@/lib/championClassHelper"
import { getChampionImageUrlOrPlaceholder } from "@/lib/championHelper"
import { applyAscensionToStatValue, maxSigForRarity, projectMcocPrestige } from "@/lib/mcoc-prestige"
import { prepareChampionAbilityTextView } from "@/lib/champion-ability-text"
import { buildChampionSynergyView } from "@/lib/champion-synergies"
import { cn } from "@/lib/utils"
import { championPageSearchParams, readChampionPageState, type ChampionPageState } from "@/lib/champion-page-state"
import { useToast } from "@/hooks/use-toast"
import type { ChampionImages } from "@/types/champion"
import type { ChampionDetailsProps, ChampionDetailsView } from "./champion-details-types"
import { getExternalDuelSourceCredits, prepareDuelTargets } from "./duel-targets"
import { ChampionSynergiesPanel } from "./champion-synergies-panel"
import { BuildReadout, ChampionAbilityReader } from "./champion-ability-reader"
import { ChampionKitOverview } from "./champion-kit-overview"
import { ChampionStatsPanel } from "./champion-stats-panel"
import styles from "./champion-dossier.module.css"

export type { ChampionDetailsPayload, ChampionStatRow } from "./champion-details-types"

export function ChampionDetailsClient(props: ChampionDetailsProps) {
  const { champion, maxStatsByTier } = props
  const searchParams = useSearchParams()
  const stats = useMemo(() => champion.stats.filter(row => row.rarity), [champion.stats])
  const pageState = readChampionPageState(searchParams, stats)
  const rankByRarity = useRef<Record<string, string>>({})
  const updatePageState = (patch: Partial<ChampionPageState>, push = false) => {
    const url = new URL(window.location.href)
    const current = readChampionPageState(url.searchParams, stats)
    const next = readChampionPageState(championPageSearchParams(url.search, { ...current, ...patch }), stats)
    url.search = championPageSearchParams(url.search, next).toString()
    const href = `${url.pathname}${url.search}${url.hash}`
    if (push) window.history.pushState(null, "", href)
    else window.history.replaceState(null, "", href)
  }
  const rarityOptions = useMemo(
    () => Array.from(new Set(stats.map(row => row.rarity).filter(Boolean) as number[])).sort((a, b) => b - a),
    [stats]
  )
  const selectedRarity = pageState.rarity
  const rankOptions = Array.from(new Set(stats
    .filter(row => String(row.rarity) === selectedRarity)
    .map(row => row.rank))).sort((a, b) => b - a)
  const selectedRank = pageState.rank
  const selectedStat = stats.find(row => String(row.rarity) === selectedRarity && String(row.rank) === selectedRank) ?? stats[0]
  const currentMaxSig = maxSigForRarity(selectedStat?.rarity)
  const effectiveAscension = pageState.ascension
  const cappedSig = pageState.sig
  const tierKey = selectedStat?.rarity && selectedStat.rank ? `${selectedStat.rarity}-${selectedStat.rank}` : ""
  const accent = getChampionClassColors(champion.class).color
  const health = applyAscensionToStatValue(selectedStat?.health, selectedStat?.rarity, effectiveAscension)
  const attack = applyAscensionToStatValue(selectedStat?.attack, selectedStat?.rarity, effectiveAscension)
  const descriptionView = prepareChampionAbilityTextView({
    records: champion.abilityTexts,
    curves: champion.abilityCurves,
    maxSig: currentMaxSig,
    sigLevel: cappedSig,
    stat: selectedStat ? { ...selectedStat, health, attack } : undefined,
  })
  const view: ChampionDetailsView = {
    champion,
    portraitUrl: getChampionImageUrlOrPlaceholder(champion.images as ChampionImages, "full"),
    heroUrl: getChampionImageUrlOrPlaceholder(champion.images as ChampionImages, "full", "hero"),
    secondaryUrl: getChampionImageUrlOrPlaceholder(champion.images as ChampionImages, "full", "secondary"),
    accent,
    selectedStat,
    selectedRarity,
    selectedRank,
    rarityOptions,
    rankOptions,
    sigLevel: cappedSig,
    maxSig: currentMaxSig,
    ascensionLevel: effectiveAscension,
    prestige: projectMcocPrestige({
      prestigeData: champion.prestigeData,
      stat: selectedStat,
      sigLevel: cappedSig,
      ascensionLevel: effectiveAscension,
    }),
    health,
    attack,
    maxStats: maxStatsByTier[tierKey] ?? {},
    abilities: champion.abilities.filter(item => item.type === "ABILITY"),
    immunities: champion.abilities.filter(item => item.type === "IMMUNITY"),
    glossaryById: new Map(props.glossaryTerms.map(term => [term.id, term])),
    descriptionView,
    setRarity: value => {
      if (value === selectedRarity) return
      rankByRarity.current[selectedRarity] = selectedRank
      const nextStat = stats.find(row => String(row.rarity) === value)
      updatePageState({ rarity: value, rank: rankByRarity.current[value] ?? "", sig: maxSigForRarity(nextStat?.rarity), ascension: 0 })
    },
    setRank: value => updatePageState({ rank: value }),
    setSigLevel: value => updatePageState({ sig: Math.round(value) }),
    setAscensionLevel: value => updatePageState({ ascension: value }),
  }

  return <TooltipProvider><ChampionDossier view={view} pageState={pageState} updatePageState={updatePageState} /></TooltipProvider>
}

const DOSSIER_TABS = [
  { value: "overview", label: "Kit overview", detail: "Effects & immunities", icon: Layers3 },
  { value: "abilities", label: "Full abilities", detail: "Read the complete kit", icon: BookOpen },
  { value: "synergies", label: "Synergies", detail: "Partners & team bonuses", icon: Users },
  { value: "stats", label: "Stats & attacks", detail: "Ratings & hit breakdowns", icon: Swords },
] as const

function ChampionDossier({ view, pageState, updatePageState }: {
  view: ChampionDetailsView
  pageState: ChampionPageState
  updatePageState: (patch: Partial<ChampionPageState>, push?: boolean) => void
}) {
  const dossierRef = useRef<HTMLDivElement>(null)
  const tabsRef = useRef<HTMLDivElement>(null)
  const sectionsRef = useRef<HTMLDivElement>(null)
  const [synergyTarget, setSynergyTarget] = useState<string | null>(null)
  useEffect(() => {
    const bar = tabsRef.current
    if (!bar) return
    const observer = new ResizeObserver(() => dossierRef.current?.style.setProperty("--champion-tabs-height", `${bar.getBoundingClientRect().height}px`))
    observer.observe(bar)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.has("tab") && !params.has("ability") && !window.location.hash) {
      sectionsRef.current?.scrollIntoView({ block: "start" })
    }
    // Restore a shared section on entry; later tab changes scroll in selectSection.
  }, [])
  const selectSection = (value: string) => {
    setSynergyTarget(null)
    updatePageState({ tab: value as ChampionPageState["tab"], ability: null }, true)
    window.requestAnimationFrame(() => sectionsRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }))
  }
  const openAbility = (recordId: string) => updatePageState({ tab: "abilities", ability: recordId }, true)
  const openSynergy = (synergyId?: string) => {
    setSynergyTarget(synergyId ?? null)
    updatePageState({ tab: "synergies", ability: null }, true)
    if (!synergyId) window.requestAnimationFrame(() => sectionsRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }))
  }
  const openChapter = (chapter: string) => {
    updatePageState({ tab: "abilities", chapter: chapter === "all" ? null : chapter, ability: null }, true)
    window.requestAnimationFrame(() => document.getElementById("champion-descriptions")?.scrollIntoView({ block: "start", behavior: "smooth" }))
  }

  return (
    <div ref={dossierRef} className={cn(styles.dossier, "relative min-h-screen overflow-x-clip bg-[#080b10] pb-16 text-slate-200")} style={{ "--champion-accent": view.accent } as CSSProperties}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[900px] bg-[radial-gradient(circle_at_76%_22%,rgba(255,255,255,.05),transparent_42%)]" />
      <div className="relative w-full px-5 py-7 sm:px-8 lg:px-10 2xl:px-12">
        <section className="relative min-h-[660px] overflow-hidden border-y border-white/10 sm:min-h-[720px] lg:min-h-[700px]">
          <div className={styles.heroArt}>
            <Image src={view.heroUrl} alt="" fill priority sizes="(max-width: 1024px) 100vw, 78vw" className="object-cover object-center" />
          </div>
          <div className={styles.heroShade} />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-[#080b10] via-[#080b10]/70 to-transparent" />
          <div className="pointer-events-none absolute inset-0 opacity-[.045] [background-image:linear-gradient(rgba(255,255,255,.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.5)_1px,transparent_1px)] [background-size:88px_88px]" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-1 w-32" style={{ background: view.accent }} />

          <div className="relative z-10 flex min-h-[660px] flex-col justify-between px-5 py-7 sm:min-h-[720px] sm:px-8 sm:py-9 lg:min-h-[700px] lg:px-10">
            <div className="flex items-start justify-between gap-5">
              <div className="flex items-center gap-4">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden border border-white/20 bg-black/40 shadow-2xl sm:h-24 sm:w-24">
                  <Image src={view.portraitUrl} alt={`${view.champion.name} portrait`} fill sizes="96px" className="object-cover" />
                  <span className="pointer-events-none absolute inset-1 border border-white/10" />
                  <span className="pointer-events-none absolute bottom-0 left-0 h-1 w-8" style={{ background: view.accent }} />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[.18em] text-white/50">Champion dossier</div>
                  <div className="mt-2 flex items-center gap-2 text-xs font-black uppercase tracking-[.2em]" style={{ color: view.accent }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: view.accent, boxShadow: `0 0 14px ${view.accent}` }} />{view.champion.class} class</div>
                  {view.champion.shortName && view.champion.shortName !== view.champion.name && <div className="mt-2 text-xs font-bold text-white/40">{view.champion.shortName}</div>}
                </div>
              </div>
            </div>

            <div className="my-auto py-10 sm:py-14">
              <ChampionHeroWordmark name={view.champion.name} accent={view.accent} />
              <div className="mt-7 h-1 w-24" style={{ background: view.accent }} />
            </div>

            <div className="flex max-w-5xl flex-col gap-4 border-y border-white/15 bg-black/20 px-4 py-5 backdrop-blur-sm sm:px-6 sm:py-6 lg:flex-row lg:items-center lg:gap-6">
              <div className="grid min-w-0 flex-1 grid-cols-3">
                <DossierPrestigeMetric view={view} />
                <DossierMetric label="Health" value={format(view.health)} />
                <DossierMetric label="Attack" value={format(view.attack)} />
              </div>
              <DossierBuildControls view={view} />
            </div>
          </div>
        </section>


        <Tabs ref={sectionsRef} value={pageState.tab} onValueChange={selectSection} className="mt-5 scroll-mt-[var(--champion-header-height)]">
          <div ref={tabsRef} className={styles.tabsBar}>
            <TabsList aria-label="Champion sections" className={styles.tabsList}>
              {DOSSIER_TABS.map(tab => <TabsTrigger key={tab.value} value={tab.value} className={styles.tab}>
                <tab.icon aria-hidden="true" className={styles.tabIcon} />
                <span><span className={styles.tabLabel}>{tab.label}</span><span className={styles.tabDetail}>{tab.detail}</span></span>
              </TabsTrigger>)}
            </TabsList>
          </div>
          <TabsContent value="overview" className="mt-0 pb-8 pt-10">
            <ChampionKitOverview view={view} onViewAbility={openAbility} onViewSynergies={openSynergy} sideContent={view.champion.duels.length > 0 ? <DossierDuelTargets view={view} /> : undefined} />
            <DossierTraits view={view} />
          </TabsContent>
          <TabsContent value="abilities" className="mt-0 pb-8 pt-10"><ChampionAbilityReader key={pageState.ability ?? "all"} view={view} targetRecordId={pageState.ability} chapter={pageState.chapter} onSelectChapter={openChapter} onClearTarget={() => updatePageState({ ability: null, chapter: null })} /></TabsContent>
          <TabsContent value="synergies" className="mt-0 pb-8 pt-10"><DossierSynergies view={view} targetSynergyId={synergyTarget} /></TabsContent>
          <TabsContent value="stats" className="mt-0 pb-8 pt-10"><ChampionStatsPanel view={view} onViewAbility={openChapter} /></TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function ChampionHeroWordmark({ name, accent }: { name: string; accent: string }) {
  const variantMatch = name.match(/^(.+?)\s*\(([^)]+)\)\s*$/)
  const primaryName = (variantMatch?.[1] ?? name).trim()
  const variantName = variantMatch?.[2]?.trim()
  const sizeClass = primaryName.length <= 8
    ? "text-[clamp(5rem,13vw,12rem)]"
    : primaryName.length <= 16
      ? "text-[clamp(4rem,10vw,9rem)]"
      : "text-[clamp(3.1rem,7.6vw,6.75rem)]"
  const wordmarkClass = cn("block max-w-5xl text-balance break-words font-black uppercase leading-[.74] tracking-[-.075em]", sizeClass)

  return (
    <div className="relative w-fit max-w-full">
      <span aria-hidden className={cn("pointer-events-none absolute left-1.5 top-[-6px] w-full text-transparent opacity-45", wordmarkClass)} style={{ WebkitTextStroke: "1px rgba(255,255,255,.38)" }}>{primaryName}</span>
      <h1 className="relative w-full max-w-5xl">
        <span className={cn("text-white [text-shadow:0_12px_50px_rgba(0,0,0,.55)]", wordmarkClass)} style={{ maskImage: "linear-gradient(90deg,#000 0%,#000 88%,rgba(0,0,0,.48) 100%)", WebkitMaskImage: "linear-gradient(90deg,#000 0%,#000 88%,rgba(0,0,0,.48) 100%)" }}>{primaryName}</span>
        {variantName && <span className="mt-4 block max-w-3xl text-balance text-[clamp(1rem,2.4vw,2rem)] font-black uppercase leading-tight tracking-[.12em]" style={{ color: accent }}>{variantName}</span>}
      </h1>
    </div>
  )
}

function DossierBuildControls({ view }: { view: ChampionDetailsView }) {
  const [open, setOpen] = useState(false)
  const { toast } = useToast()
  const copyLink = async () => {
    try {
      const url = new URL(window.location.href)
      url.searchParams.set("rarity", view.selectedRarity)
      url.searchParams.set("rank", view.selectedRank)
      url.searchParams.set("sig", String(view.sigLevel))
      url.searchParams.set("ascension", String(view.ascensionLevel))
      await navigator.clipboard.writeText(url.href)
      toast({ title: "Link copied", description: "Includes this section and champion build." })
    } catch {
      toast({ title: "Could not copy link", description: "Copy the page address from your browser.", variant: "destructive" })
    }
  }
  if (!view.selectedStat) return null
  return (
    <div aria-label="Champion build" className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 lg:shrink-0 lg:flex-col lg:items-start lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
      <BuildReadout view={view} className="text-white/55" />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild><button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/15 bg-white/[.035] px-3 text-sm font-medium text-slate-200 transition-colors hover:border-white/30 hover:bg-white/[.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"><SlidersHorizontal aria-hidden="true" className="h-4 w-4" />Adjust build</button></PopoverTrigger>
        <PopoverContent align="end" sideOffset={12} collisionPadding={16} aria-label="Adjust champion build" aria-describedby="champion-build-description" className="w-[min(420px,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl border-white/15 bg-[#101620] p-5 text-slate-200 shadow-2xl">
          <div className="mb-5"><h2 className="text-lg font-semibold text-white">Adjust build</h2><p id="champion-build-description" className="mt-1 text-sm leading-6 text-slate-400">Stats and abilities update as you adjust.</p></div>
          <div className="grid grid-cols-2 items-end gap-4">
            <BuildSelect label="Rarity" value={view.selectedRarity} onChange={view.setRarity} options={view.rarityOptions.map(rarity => ({ value: String(rarity), label: `${rarity} ★` }))} />
            <BuildSelect label="Rank" value={view.selectedRank} onChange={view.setRank} options={view.rankOptions.map(rank => ({ value: String(rank), label: `Rank ${rank}` }))} />
            <div className="col-span-2">
              <label htmlFor="champion-signature-value" className="mb-1.5 block text-xs font-medium text-slate-400">Signature</label>
              <div className="flex h-10 items-center gap-4">
                <input aria-label="Signature level" type="range" min={0} max={view.maxSig} value={view.sigLevel} onChange={event => view.setSigLevel(Number(event.target.value))} className="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-white/10" style={{ accentColor: view.accent }} />
                <input id="champion-signature-value" aria-label="Signature level value" type="number" min={0} max={view.maxSig} value={view.sigLevel} onChange={event => { if (Number.isFinite(event.target.valueAsNumber)) view.setSigLevel(event.target.valueAsNumber) }} className="h-10 w-16 rounded-lg border border-white/10 bg-white/[.035] px-2 text-center text-sm tabular-nums text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400" />
              </div>
            </div>
            {view.selectedStat.rarity === 7 && <BuildSelect label="Ascension" value={String(view.ascensionLevel)} onChange={value => view.setAscensionLevel(Number(value))} options={[0, 1, 2, 3, 4, 5].map(level => ({ value: String(level), label: `A${level}` }))} />}
          </div>
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4"><CopyPageLink onClick={copyLink} /><button type="button" onClick={() => setOpen(false)} className="min-h-10 rounded-lg bg-slate-200 px-4 text-sm font-semibold text-slate-950 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101620]">Done</button></div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

function BuildSelect({ label, value, options, onChange }: {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  return <label className="block min-w-0"><span className="mb-1.5 block text-xs font-medium text-slate-400">{label}</span><span className="relative block"><select aria-label={label} value={value} onChange={event => onChange(event.target.value)} className="h-10 w-full appearance-none rounded-lg border border-white/10 bg-[#151c27] pl-3 pr-8 text-sm font-semibold text-slate-100 transition-colors hover:border-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400">{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2.5 top-3 h-4 w-4 text-slate-500" /></span></label>
}

function CopyPageLink({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} aria-label="Copy page link" title="Copy link to this section and build" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-slate-400 transition-colors hover:border-white/25 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"><Link2 aria-hidden="true" className="h-4 w-4" />Copy link</button>
}

function DossierTraits({ view }: { view: ChampionDetailsView }) {
  if (!view.champion.tags.length) return null
  return <section aria-label="Champion tags" className="mt-10 border-t border-white/10 pt-6"><h3 className="mb-4 text-sm font-medium text-slate-400">Champion tags</h3><div className="flex flex-wrap gap-2">{view.champion.tags.map(tag => <span key={tag.id} className="rounded-md border border-white/[.08] bg-white/[.025] px-3 py-1.5 text-xs text-slate-400">{tag.name}</span>)}</div></section>
}

function DossierMetric({ label, value }: { label: string; value: string }) {
  return <div className="border-r border-white/10 px-2 first:pl-0 last:border-0 sm:px-4"><div className="text-lg font-black min-[380px]:text-2xl sm:text-3xl">{value}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[.18em] text-white/55">{label}</div></div>
}

function DossierPrestigeMetric({ view }: { view: ChampionDetailsView }) {
  const points = view.champion.prestigeData
    .filter(point => String(point.rarity) === view.selectedRarity && String(point.rank) === view.selectedRank)
    .map(point => ({ sig: point.sig, value: point.prestige }))
    .filter(point => Number.isFinite(point.sig) && Number.isFinite(point.value))
    .sort((a, b) => a.sig - b.sig)

  if (points.length < 2) {
    return <DossierMetric label="Prestige" value={format(view.prestige)} />
  }

  const width = 88
  const height = 32
  const padding = 3
  const sigValues = points.map(point => point.sig)
  const curveValues = points.map(point => point.value)
  const minSig = Math.min(...sigValues)
  const maxSig = Math.max(...sigValues)
  const minValue = Math.min(...curveValues)
  const maxValue = Math.max(...curveValues)
  const x = (sig: number) => padding + ((sig - minSig) / Math.max(1, maxSig - minSig)) * (width - padding * 2)
  const y = (value: number) => height - padding - ((value - minValue) / Math.max(1, maxValue - minValue)) * (height - padding * 2)
  const path = points.map((point, index) => `${index ? "L" : "M"}${x(point.sig).toFixed(1)} ${y(point.value).toFixed(1)}`).join(" ")
  const selectedPoint = points.reduce((nearest, point) => Math.abs(point.sig - view.sigLevel) < Math.abs(nearest.sig - view.sigLevel) ? point : nearest)

  return (
    <div className="border-r border-white/10 pr-2 sm:pr-4">
      <div className="sm:flex sm:items-end sm:justify-between sm:gap-2">
        <div className="text-lg font-black min-[380px]:text-2xl sm:text-3xl">{format(view.prestige)}</div>
        <svg role="img" aria-label="Prestige by signature level" viewBox={`0 0 ${width} ${height}`} className="mt-1 h-3 w-[76px] max-w-full overflow-visible sm:mb-1 sm:mt-0 sm:h-8 sm:w-[88px]">
          <path d={path} fill="none" stroke={view.accent} strokeWidth="1.6" vectorEffect="non-scaling-stroke" opacity=".55" />
          <circle cx={x(selectedPoint.sig)} cy={y(selectedPoint.value)} r="3" fill={view.accent} />
        </svg>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-white/55">
        <span>Prestige</span>
        <span className="hidden truncate text-right text-[10px] tracking-[.1em] text-white/20 sm:block">Sig curve</span>
      </div>
    </div>
  )
}

function DossierDuelTargets({ view }: { view: ChampionDetailsView }) {
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { toast } = useToast()
  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current)
  }, [])
  const prepared = useMemo(() => prepareDuelTargets(view.champion.duels), [view.champion.duels])
  const credits = useMemo(() => getExternalDuelSourceCredits(view.champion.duels), [view.champion.duels])
  if (!view.champion.duels.length) return null
  const featuredId = prepared.activeTargets[0]?.id

  const copyTarget = async (id: number, playerName: string) => {
    try {
      await navigator.clipboard.writeText(playerName)
      if (copyTimer.current) clearTimeout(copyTimer.current)
      setCopiedId(id)
      copyTimer.current = setTimeout(() => setCopiedId(null), 1600)
    } catch {
      toast({ title: "Couldn't copy the duel target", description: `Select and copy the name: ${playerName}`, variant: "destructive" })
    }
  }

  return (
    <section className="rounded-xl border border-white/[.08] bg-[#0e131c] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-white"><Crosshair className="h-4 w-4" style={{ color: view.accent }} />Duel targets</h2>
          <p className="mt-2 text-xs leading-5 text-white/55">Copy a player name and search for it in-game.</p>
        </div>
        <span className="rounded-full border border-white/10 px-2 py-1 font-mono text-xs text-white/55">{view.champion.duels.length}</span>
      </div>
      <div className="mt-5 max-h-[520px] overflow-y-auto border-y border-white/10">
        {prepared.targets.map(duel => (
          <div key={duel.id} className={cn("group relative flex items-center gap-3 border-b border-white/10 px-2 py-3.5 last:border-0", duel.id === featuredId && "bg-white/[.035]")}>
            {duel.id === featuredId ? <Target className="h-4 w-4 shrink-0" style={{ color: view.accent }} /> : <span className={cn("ml-1 h-2 w-2 shrink-0 rounded-full", duel.status === "ACTIVE" ? "bg-emerald-400" : "bg-amber-400")} />}
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2"><span className="select-text break-all text-sm font-bold text-white/80 group-hover:text-white">{duel.playerName}</span>{duel.id === featuredId && <span className="shrink-0 text-xs font-semibold" style={{ color: view.accent }}>Recommended</span>}</div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-normal text-white/50"><span>{duel.sourceLabel}</span><span>{formatDuelDate(duel.updatedAt)}</span>{duel.status === "OUTDATED" && <span className="text-amber-300/70">Outdated</span>}</div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="font-mono text-xs text-white/40">{duel.rank ?? "—"}</span>
              <button type="button" onClick={() => copyTarget(duel.id, duel.playerName)} aria-label={copiedId === duel.id ? `Copied ${duel.playerName}` : `Copy ${duel.playerName}`} className="grid h-9 w-9 place-items-center rounded-md border border-white/10 text-white/55 transition-colors hover:border-white/25 hover:bg-white/[.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60">
                {copiedId === duel.id ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        ))}
      </div>
      {credits.length > 0 && (
        <p className="mt-3 text-xs leading-5 text-white/50">
          Sources: {credits.map((credit, index) => (
            <span key={credit.source}>
              {index > 0 && <span aria-hidden> · </span>}
              <a href={credit.url} target="_blank" rel="noreferrer" className="underline decoration-white/20 underline-offset-4 transition-colors hover:text-white/70">{credit.label}</a>
            </span>
          ))}
        </p>
      )}
    </section>
  )
}

function formatDuelDate(value: Date | string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Date unknown"
  return `Updated ${date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`
}

function format(value: number | null | undefined) {
  return value == null ? "—" : Math.round(value).toLocaleString("en-US")
}

function DossierSynergies({ view, targetSynergyId }: { view: ChampionDetailsView; targetSynergyId: string | null }) {
  const synergyView = useMemo(() => buildChampionSynergyView(view.champion.gameSynergies, view.champion.id, view.selectedStat?.rarity ?? null), [view.champion.gameSynergies, view.champion.id, view.selectedStat?.rarity])
  return <section id="champion-synergies" aria-labelledby="champion-synergies-heading"><div className="mb-8"><h2 id="champion-synergies-heading" className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Team synergies</h2><p className="mt-3 text-base leading-7 text-slate-400">Find partners and explore the bonuses they bring to your team.</p></div><ChampionSynergiesPanel {...synergyView} rarity={view.selectedStat?.rarity ?? null} glossaryById={view.glossaryById} targetSynergyId={targetSynergyId} /></section>
}
