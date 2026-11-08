"use client"

import Image from "next/image"
import { useSearchParams } from "next/navigation"
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { BookOpen, Check, ChevronDown, Compass, Copy, Crosshair, Layers3, Link2, SlidersHorizontal, Swords, Target, Users } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import * as Dialog from "@radix-ui/react-dialog"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { getChampionClassColors } from "@/lib/championClassHelper"
import { getChampionImageUrlOrPlaceholder } from "@/lib/championHelper"
import { applyAscensionToStatValue, maxAscensionLevelForRarity, maxSigForRarity, projectMcocPrestige } from "@/lib/mcoc-prestige"
import { getAscensionEffects } from "@cerebro/core/domain/champion-ascension"
import { prepareChampionAbilityTextView } from "@/lib/champion-ability-text"
import { buildChampionSynergyView } from "@/lib/champion-synergies"
import { cn } from "@/lib/utils"
import { championPageHref, championPageSearchParams, readChampionPageState, type ChampionPageState } from "@/lib/champion-page-state"
import { scrollToChampionSection } from "@/lib/champion-page-navigation"
import { useToast } from "@/hooks/use-toast"
import type { ChampionImages } from "@/types/champion"
import type { ChampionDetailsProps, ChampionDetailsView } from "./champion-details-types"
import { getExternalDuelSourceCredits, prepareDuelTargets } from "./duel-targets"
import { ChampionSynergiesPanel } from "./champion-synergies-panel"
import { BuildReadout, ChampionAbilityReader } from "./champion-ability-reader"
import { ChampionKitOverview } from "./champion-kit-overview"
import { ChampionStatsPanel } from "./champion-stats-panel"
import { ChampionAcquisitionPanel } from "./champion-acquisition-panel"
import styles from "./champion-dossier.module.css"

export type { ChampionDetailsPayload, ChampionStatRow } from "./champion-details-types"

export function ChampionDetailsClient(props: ChampionDetailsProps) {
  const { champion, maxStatsByTier } = props
  const searchParams = useSearchParams()
  const stats = useMemo(() => champion.stats.filter(row => row.rarity), [champion.stats])
  const pageState = readChampionPageState(searchParams, stats, champion.ascensionRules)
  const rankByRarity = useRef<Record<string, string>>({})
  const updatePageState = (patch: Partial<ChampionPageState>, push = false) => {
    const url = new URL(window.location.href)
    const current = readChampionPageState(url.searchParams, stats, champion.ascensionRules)
    const next = readChampionPageState(championPageSearchParams(url.search, { ...current, ...patch }), stats, champion.ascensionRules)
    const changesDestination = patch.tab !== undefined || patch.ability !== undefined || patch.chapter !== undefined || patch.synergy !== undefined
    const href = championPageHref(url.href, next, changesDestination)
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
  const baseSelectedStat = stats.find(row => String(row.rarity) === selectedRarity && String(row.rank) === selectedRank) ?? stats[0]
  const ascensionRules = champion.ascensionRules?.find(rule => rule.rarity === baseSelectedStat?.rarity) ?? null
  const ascensionEffects = getAscensionEffects(ascensionRules, pageState.ascension)
  const selectedStat = baseSelectedStat ? { ...baseSelectedStat, challengeRating: baseSelectedStat.challengeRating + ascensionEffects.challengeRating } : undefined
  const currentMaxSig = maxSigForRarity(selectedStat?.rarity)
  const effectiveAscension = pageState.ascension
  const cappedSig = pageState.sig
  const tierKey = selectedStat?.rarity && selectedStat.rank ? `${selectedStat.rarity}-${selectedStat.rank}` : ""
  const accent = getChampionClassColors(champion.class).color
  const health = applyAscensionToStatValue(selectedStat?.health, selectedStat?.rarity, effectiveAscension, champion.ascensionRules === undefined ? undefined : ascensionRules, "health")
  const attack = applyAscensionToStatValue(selectedStat?.attack, selectedStat?.rarity, effectiveAscension, champion.ascensionRules === undefined ? undefined : ascensionRules, "attack")
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
    ascensionRules,
    ascensionOptions: Array.from({ length: (champion.ascensionRules === undefined ? maxAscensionLevelForRarity(selectedStat?.rarity) : ascensionRules?.maxLevel ?? 0) + 1 }, (_, level) => level),
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

  return <TooltipProvider><ChampionDossier key={champion.id} view={view} pageState={pageState} updatePageState={updatePageState} /></TooltipProvider>
}

const DOSSIER_TABS = [
  { value: "overview", label: "Kit overview", icon: Layers3 },
  { value: "abilities", label: "Full abilities", icon: BookOpen },
  { value: "synergies", label: "Synergies", icon: Users },
  { value: "stats", label: "Stats & attacks", icon: Swords },
  { value: "crystals", label: "How to obtain", icon: Compass },
] as const

function ChampionDossier({ view, pageState, updatePageState }: {
  view: ChampionDetailsView
  pageState: ChampionPageState
  updatePageState: (patch: Partial<ChampionPageState>, push?: boolean) => void
}) {
  const dossierRef = useRef<HTMLDivElement>(null)
  const tabsRef = useRef<HTMLDivElement>(null)
  const heroRef = useRef<HTMLElement>(null)
  const sectionRef = useRef<HTMLDivElement>(null)
  const [heroAbsent, setHeroAbsent] = useState(false)
  useLayoutEffect(() => {
    const bar = tabsRef.current
    const dossier = dossierRef.current
    const hero = heroRef.current
    if (!bar || !dossier || !hero) return
    let identityObserver: IntersectionObserver | undefined
    const measureBar = () => {
      const height = bar.getBoundingClientRect().height
      dossier.style.setProperty("--champion-tabs-height", `${height}px`)
      const headerHeight = parseFloat(getComputedStyle(dossier).getPropertyValue("--champion-header-height")) || 64
      // The bar follows the hero: identity changes at the header edge, where it docks.
      // Read synchronously as well as observing so restored scroll has no identity flash.
      setHeroAbsent(hero.getBoundingClientRect().bottom <= headerHeight)
      identityObserver?.disconnect()
      if (typeof IntersectionObserver !== "undefined") {
        identityObserver = new IntersectionObserver(([entry]) => {
          setHeroAbsent(!entry.isIntersecting && entry.boundingClientRect.bottom <= headerHeight)
        }, { rootMargin: `-${headerHeight}px 0px 0px 0px`, threshold: 0 })
        identityObserver.observe(hero)
      }
    }
    // Deep-link effects must read the actual toolbar height on their first scroll.
    measureBar()
    const observer = new ResizeObserver(measureBar)
    observer.observe(bar)
    return () => { observer.disconnect(); identityObserver?.disconnect() }
  }, [])
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (window.scrollY === 0 && params.has("tab") && !params.has("ability") && !params.has("synergy") && !window.location.hash) {
      scrollToChampionSection(sectionRef.current)
    }
    // Preserve user/browser scroll and exact targets if hydration completes after interaction.
    // Later deliberate tab changes scroll in selectSection.
  }, [])
  const selectSection = (value: string) => {
    updatePageState({ tab: value as ChampionPageState["tab"], ability: null, synergy: null }, true)
    window.requestAnimationFrame(() => scrollToChampionSection(sectionRef.current))
  }
  const openAbility = (recordId: string) => updatePageState({ tab: "abilities", ability: recordId }, true)
  const openSynergy = (synergyId?: string) => {
    updatePageState({ tab: "synergies", ability: null, synergy: synergyId ?? null }, true)
    if (!synergyId) window.requestAnimationFrame(() => scrollToChampionSection(sectionRef.current))
  }
  const openChapter = (chapter: string) => {
    updatePageState({ tab: "abilities", chapter: chapter === "all" ? null : chapter, ability: null }, true)
    window.requestAnimationFrame(() => scrollToChampionSection(document.getElementById("champion-descriptions")))
  }

  return (
    <div ref={dossierRef} className={cn(styles.dossier, "relative min-h-screen overflow-x-clip bg-[#080b10] pb-16 text-slate-200")} style={{ "--champion-accent": view.accent } as CSSProperties}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[900px] bg-[radial-gradient(circle_at_76%_22%,rgba(255,255,255,.05),transparent_42%)]" />
      <Tabs value={pageState.tab} onValueChange={selectSection} className={styles.dossierSections}>
        <div className={styles.heroFrame}>
          <section ref={heroRef} className={styles.hero} aria-label={`${view.champion.name} banner`}>
            <div className={styles.heroArt}>
              <Image src={view.heroUrl} alt="" fill priority sizes="(max-width: 1024px) 100vw, 78vw" className="object-cover object-center" />
            </div>
            <div className={styles.heroShade} />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-[#080b10] via-[#080b10]/70 to-transparent" />
            <div className="pointer-events-none absolute inset-0 opacity-[.045] [background-image:linear-gradient(rgba(255,255,255,.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.5)_1px,transparent_1px)] [background-size:88px_88px]" />

            <div className={styles.heroContent}>
              <div className="flex items-start justify-between gap-5">
                <div className="flex items-center gap-4">
                  <div className={styles.heroPortrait}>
                    <Image src={view.portraitUrl} alt={`${view.champion.name} portrait`} fill sizes="64px" className="object-cover" />
                    <span className="pointer-events-none absolute inset-1 border border-white/10" />
                    <span className="pointer-events-none absolute bottom-0 left-0 h-1 w-8" style={{ background: view.accent }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.2em]" style={{ color: view.accent }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: view.accent, boxShadow: `0 0 14px ${view.accent}` }} />{view.champion.class} class</div>
                    {view.champion.shortName && view.champion.shortName !== view.champion.name && <div className="mt-2 text-xs font-bold text-white/40">{view.champion.shortName}</div>}
                  </div>
                </div>
              </div>

              <div className={styles.heroTitle}>
                <ChampionHeroWordmark name={view.champion.name} accent={view.accent} />
                <div className="mt-5 h-1 w-24" style={{ background: view.accent }} />
              </div>

            </div>
          </section>
        </div>
        <div ref={tabsRef} className={styles.tabsBar} data-champion-context data-docked={heroAbsent}>
          <div className={styles.contextInner}>
            <div className={styles.contextBuild} aria-label="Champion build">
              <span className={styles.contextName} data-visible={heroAbsent} aria-hidden={!heroAbsent} title={view.champion.name}>{view.champion.name}</span>
              <BuildReadout view={view} className={styles.contextReadout} showAscension />
            </div>
            <DossierSectionNavigation value={pageState.tab} onSelect={selectSection} accent={view.accent} championName={view.champion.name} showName={heroAbsent} />
            <DossierBuildControls view={view} />
          </div>
        </div>
        <div className="relative w-full px-5 sm:px-8 lg:px-10 2xl:px-12">
          <div ref={sectionRef} className={styles.sections} data-champion-section-content>
          <TabsContent value="overview" className="mt-0 pb-8 pt-10">
            <ChampionKitOverview view={view} onViewAbility={openAbility} onViewSynergies={openSynergy} sideContent={view.champion.duels.length > 0 ? <DossierDuelTargets view={view} /> : undefined} />
            <DossierTraits view={view} />
          </TabsContent>
          <TabsContent value="abilities" className="mt-0 pb-8 pt-10"><ChampionAbilityReader view={view} targetRecordId={pageState.ability} chapter={pageState.chapter} onSelectChapter={openChapter} onClearTarget={() => updatePageState({ ability: null, chapter: null })} /></TabsContent>
          <TabsContent value="synergies" className="mt-0 pb-8 pt-10"><DossierSynergies view={view} targetSynergyId={pageState.synergy} onClearTarget={() => updatePageState({ synergy: null }, true)} /></TabsContent>
          <TabsContent value="stats" className="mt-0 pb-8 pt-10"><ChampionStatsPanel view={view} onViewAbility={openChapter} /></TabsContent>
          <TabsContent value="crystals" className="mt-0 pb-8 pt-10"><ChampionAcquisitionPanel key={view.selectedRarity} acquisition={view.champion.acquisition} availability={view.champion.crystalAvailability} selectedRarity={view.selectedRarity} championName={view.champion.name} championSlug={view.champion.slug} ascensionRules={view.ascensionRules} /></TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  )
}

function DossierSectionNavigation({ value, onSelect, accent, championName, showName }: {
  value: ChampionPageState["tab"]
  onSelect: (value: ChampionPageState["tab"]) => void
  accent: string
  championName: string
  showName: boolean
}) {
  const [open, setOpen] = useState(false)
  const [previousValue, setPreviousValue] = useState(value)
  if (previousValue !== value) { setPreviousValue(value); setOpen(false) }
  const currentChoiceRef = useRef<HTMLButtonElement>(null)
  const desktopTabsRef = useRef<HTMLDivElement>(null)
  const pickerRef = useRef<HTMLButtonElement>(null)
  const active = DOSSIER_TABS.find(tab => tab.value === value) ?? DOSSIER_TABS[0]

  useEffect(() => {
    if (!window.matchMedia) return
    const desktop = window.matchMedia("(min-width: 1200px)")
    const closeOnDesktop = () => {
      if (desktop.matches) {
        if (open) setOpen(false)
        else if (document.activeElement === pickerRef.current) desktopTabsRef.current?.querySelector<HTMLElement>('[data-state="active"]')?.focus({ preventScroll: true })
      } else if (desktopTabsRef.current?.contains(document.activeElement)) pickerRef.current?.focus({ preventScroll: true })
    }
    closeOnDesktop()
    desktop.addEventListener("change", closeOnDesktop)
    return () => desktop.removeEventListener("change", closeOnDesktop)
  }, [open])

  return <>
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button ref={pickerRef} type="button" className={styles.sectionPicker} aria-label={`Champion section: ${active.label}`} aria-describedby={showName ? "champion-context-picker-name" : undefined}>
          <active.icon aria-hidden="true" className={styles.sectionPickerIcon} />
          <span className={styles.pickerText}><span>{active.label}</span><span id="champion-context-picker-name" className={styles.contextName} data-visible={showName} aria-hidden={!showName} title={championName}>{championName}</span></span>
          <ChevronDown aria-hidden="true" className={styles.sectionPickerChevron} />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal><Dialog.Overlay className={styles.sectionOverlay} />
      <Dialog.Content className={styles.sectionSheet} style={{ "--champion-accent": accent } as CSSProperties} aria-describedby={undefined}
        onOpenAutoFocus={event => { event.preventDefault(); currentChoiceRef.current?.focus() }}
        onCloseAutoFocus={event => {
          if (window.matchMedia?.("(min-width: 1200px)").matches) {
            event.preventDefault()
            desktopTabsRef.current?.querySelector<HTMLElement>('[data-state="active"]')?.focus({ preventScroll: true })
          }
        }}>
        <Dialog.Title className={styles.sectionSheetTitle}>Champion sections</Dialog.Title>
        <div className={styles.sectionChoices}>
          {DOSSIER_TABS.map(tab => <button key={tab.value} type="button" ref={tab.value === value ? currentChoiceRef : undefined}
            className={styles.sectionChoice} aria-current={tab.value === value ? "page" : false}
            onClick={() => { if (tab.value !== value) onSelect(tab.value); setOpen(false) }}>
            <tab.icon aria-hidden="true" className={styles.sectionPickerIcon} />
            <span>{tab.label}</span>
            {tab.value === value && <Check aria-hidden="true" className={styles.sectionChoiceCheck} />}
          </button>)}
        </div>
        <Dialog.Close className={styles.sectionClose} aria-label="Close champion sections">×</Dialog.Close>
      </Dialog.Content></Dialog.Portal>
    </Dialog.Root>
    <TabsList ref={desktopTabsRef} aria-label="Champion sections" className={styles.tabsList}>
      {DOSSIER_TABS.map(tab => <TabsTrigger key={tab.value} value={tab.value} className={styles.tab}>
        <tab.icon aria-hidden="true" className={styles.tabIcon} />
        <span className={styles.tabLabel}>{tab.label}</span>
      </TabsTrigger>)}
    </TabsList>
  </>
}

function ChampionHeroWordmark({ name, accent }: { name: string; accent: string }) {
  const variantMatch = name.match(/^(.+?)\s*\(([^)]+)\)\s*$/)
  const primaryName = (variantMatch?.[1] ?? name).trim()
  const variantName = variantMatch?.[2]?.trim()
  const longestWord = Math.max(...primaryName.split(/\s+/).map(word => word.length))
  const wordmarkClass = styles.heroWordmark
  const wordmarkStyle = { "--champion-name-size": `${Math.min(14, 120 / longestWord)}cqw` } as CSSProperties

  return (
    <div className={styles.heroWordmarkContainer} style={wordmarkStyle}>
      <h1 className="relative w-full max-w-5xl">
        <span className={cn("text-white [text-shadow:0_12px_50px_rgba(0,0,0,.55)]", wordmarkClass)}>{primaryName}</span>
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
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" className={styles.buildTrigger} aria-label="Adjust build" title={`Adjust build: ${view.selectedRarity}-star, Rank ${view.selectedRank}, Signature ${view.sigLevel}, Ascension ${view.ascensionLevel}`}>
            <SlidersHorizontal aria-hidden="true" />
            <span className={styles.buildEditLabel}>Adjust build</span>
            <span className={styles.mobileBuild} aria-hidden="true">
              <span><span>{view.selectedRarity}{"\u2605"}</span><span>Rank {view.selectedRank}</span></span>
              <span><span>Sig {view.sigLevel}</span><span>A{view.ascensionLevel}</span></span>
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={8} collisionPadding={16} aria-label="Adjust champion build" aria-describedby="champion-build-description" className="z-[150] w-[min(420px,calc(100vw-2rem))] max-h-[var(--radix-popover-content-available-height)] overflow-y-auto rounded-xl border-white/15 bg-[#101620] p-5 text-slate-200 shadow-2xl">
          <div className="mb-5"><h2 className="text-lg font-semibold text-white">Adjust build</h2><p id="champion-build-description" className="mt-1 text-sm leading-6 text-slate-400">Stats and abilities update as you adjust.</p></div>
          <div className={styles.buildFields} data-ascendable={(view.ascensionOptions?.length ?? 0) > 1}>
            <BuildSelect label="Rarity" value={view.selectedRarity} onChange={view.setRarity} options={view.rarityOptions.map(rarity => ({ value: String(rarity), label: `${rarity} ★` }))} />
            <BuildSelect label="Rank" value={view.selectedRank} onChange={view.setRank} options={view.rankOptions.map(rank => ({ value: String(rank), label: `Rank ${rank}` }))} />
            {(view.ascensionOptions?.length ?? 0) > 1 && <BuildSelect label="Ascension" value={String(view.ascensionLevel)} onChange={value => view.setAscensionLevel(Number(value))} options={view.ascensionOptions!.map(level => ({ value: String(level), label: `A${level}` }))} />}
            <div className={styles.buildSignature}>
              <label htmlFor="champion-signature-value" className="mb-1.5 block text-xs font-medium text-slate-400">Signature</label>
              <div className="flex h-10 items-center gap-4">
                <input aria-label="Signature level" type="range" min={0} max={view.maxSig} value={view.sigLevel} onChange={event => view.setSigLevel(Number(event.target.value))} className="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-white/10" style={{ accentColor: view.accent }} />
                <SignatureLevelInput key={`${view.selectedRarity}-${view.selectedRank}`} value={view.sigLevel} max={view.maxSig} onChange={view.setSigLevel} />
              </div>
              <p id="champion-signature-help" className="mt-2 text-xs leading-5 text-slate-400">0–{view.maxSig}. Press Enter or leave the number field to apply.</p>
            </div>
          </div>
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4"><CopyPageLink onClick={copyLink} /><button type="button" onClick={() => setOpen(false)} className="min-h-10 rounded-lg bg-slate-200 px-4 text-sm font-semibold text-slate-950 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101620]">Done</button></div>
        </PopoverContent>
      </Popover>
  )
}

function SignatureLevelInput({ value, max, onChange }: { value: number; max: number; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value))
  const [previousValue, setPreviousValue] = useState(value)
  if (previousValue !== value) {
    setPreviousValue(value)
    setDraft(String(value))
  }
  const commit = () => {
    const parsed = draft.trim() ? Number(draft) : Number.NaN
    if (!Number.isFinite(parsed)) {
      setDraft(String(value))
      return
    }
    const next = Math.max(0, Math.min(max, Math.round(parsed)))
    setDraft(String(next))
    if (next !== value) onChange(next)
  }
  return <input id="champion-signature-value" aria-label="Signature level value" aria-describedby="champion-signature-help" type="number" min={0} max={max} step={1} value={draft} onChange={event => setDraft(event.target.value)} onBlur={commit} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); commit() } }} className="h-10 w-16 rounded-lg border border-white/10 bg-white/[.035] px-2 text-center text-sm tabular-nums text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400" />
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

function DossierSynergies({ view, targetSynergyId, onClearTarget }: { view: ChampionDetailsView; targetSynergyId: string | null; onClearTarget: () => void }) {
  const synergyView = useMemo(() => buildChampionSynergyView(view.champion.gameSynergies, view.champion.id, view.selectedStat?.rarity ?? null), [view.champion.gameSynergies, view.champion.id, view.selectedStat?.rarity])
  return <section id="champion-synergies" aria-labelledby="champion-synergies-heading"><div className={styles.sectionHeader}><h2 id="champion-synergies-heading">Team synergies</h2><p>Find partners and explore the bonuses they bring to your team.</p></div><ChampionSynergiesPanel {...synergyView} rarity={view.selectedStat?.rarity ?? null} glossaryById={view.glossaryById} targetSynergyId={targetSynergyId} onClearTarget={onClearTarget} /></section>
}
