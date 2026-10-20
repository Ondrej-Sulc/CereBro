"use client"

import Image from "next/image"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { ChevronRight, Search, Sparkles, X } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { championAbilityPanelMatchesChapter, formatGameText, type ChampionAbilityTextRecord, type PreparedChampionAbilityText, type PreparedChampionAbilityTextNode, type PreparedChampionAbilityTextPanel, type PreparedChampionAbilityCurveSeries } from "@/lib/champion-ability-text"
import { cn } from "@/lib/utils"
import { buildChampionKitEffects, getGameEffectColors, type ChampionKitEffect } from "@/lib/champion-kit"
import { championAbilityTextContent, filterChampionAbilityPanels } from "@/lib/champion-ability-search"
import type { ChampionDetailsView, GlossaryTerm } from "./champion-details-types"
import styles from "./champion-dossier.module.css"

const DESCRIPTION_THEME = {
    shell: "mt-16 border-t border-white/10 pt-10",
    kicker: "text-white/55",
    heading: "text-white",
    intro: "text-white/45",
    bio: "border-white/10 bg-white/[.025]",
    panel: "border-white/10 bg-white/[.025]",
    group: "border-white/10 bg-black/20",
    title: "text-white",
    body: "text-[15px] leading-[1.7] text-slate-300",
    muted: "text-white/55",
    value: "text-slate-100 hover:text-white",
    glossary: "bg-white/[.035] text-sky-300 hover:bg-white/[.075]",
    warning: "border-amber-400/20 bg-amber-400/[.06] text-amber-100/65",
  }

type DescriptionTheme = typeof DESCRIPTION_THEME

type DescriptionPanelData = PreparedChampionAbilityTextPanel<ChampionAbilityTextRecord>

type ReaderNavigation = {
  targetRecordId?: string | null
  chapter: string | null
  onSelectChapter: (chapter: string) => void
  onClearTarget?: () => void
}

export function ChampionAbilityReader({ view, ...navigation }: {
  view: ChampionDetailsView
} & ReaderNavigation) {
  const panels = [view.descriptionView.signaturePanel, ...view.descriptionView.descriptionPanels].filter(panel => panel.introRecord || panel.specialAttackIntros?.length || panel.recordGroups.length > 0)
  return <DossierDescriptions view={view} panels={panels} {...navigation} />
}

function DossierDescriptions({ view, panels, targetRecordId, chapter, onSelectChapter, onClearTarget }: {
  view: ChampionDetailsView
  panels: DescriptionPanelData[]
} & ReaderNavigation) {
  const targetPanel = panels.find(panel => panel.recordGroups.some(group => group.records.some(record => String(record.id) === targetRecordId)))
  const selectedPanel = panels.find(panel => championAbilityPanelMatchesChapter(panel, chapter))
  const activeChapter = targetPanel?.group ?? selectedPanel?.group ?? (chapter === "biography" && view.descriptionView.bioRecords.length > 0 ? "biography" : "all")
  const [query, setQuery] = useState("")
  const search = filterChampionAbilityPanels(panels, query)
  const visiblePanels = search.panels.filter(panel => activeChapter === "all" || panel.group === activeChapter)
  const biography = view.descriptionView.bioRecords.filter(record => !query.trim() || championAbilityTextContent(record.prepared).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const visibleCount = activeChapter === "biography" ? biography.length : filterChampionAbilityPanels(visiblePanels, "").passageCount
  const readerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!targetRecordId) return
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(`ability-record-${targetRecordId}`)
      target?.scrollIntoView({ block: "start" })
      target?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [targetRecordId])
  const effectsByName = new Map(buildChampionKitEffects(view.champion.abilities, view.glossaryById)
    .map(effect => [effectKey(effect.name), effect]))
  const selectChapter = (chapter: string) => {
    onSelectChapter(chapter)
    window.requestAnimationFrame(() => readerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
  }
  const chapters = [{ key: "all", label: "All abilities" }, ...panels.map(panel => ({ key: panel.group, label: chapterLabel(panel.title) })), ...(view.descriptionView.bioRecords.length ? [{ key: "biography", label: "Biography" }] : [])]
  return (
    <section id="champion-descriptions" aria-label="Full ability descriptions" className="scroll-mt-[calc(var(--champion-header-height,4rem)+var(--champion-tabs-height)+1.5rem)]">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-5"><div><h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Full abilities</h2><p className="mt-3 text-base leading-7 text-slate-400">Signature, base abilities, and special attacks. Read together or focus on a section.</p></div><BuildReadout view={view} className="text-slate-400" /></div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xl"><Search aria-hidden="true" className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-500" /><input aria-label="Search ability text" type="search" value={query} maxLength={200} onChange={event => setQuery(event.target.value)} placeholder="Find an effect, condition, or value…" className="h-11 w-full rounded-xl border border-white/10 bg-[#0d131c] pl-11 pr-11 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 [&::-webkit-search-cancel-button]:appearance-none" />{query && <button type="button" aria-label="Clear ability search" onClick={() => setQuery("")} className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white"><X aria-hidden="true" className="h-4 w-4" /></button>}</div>
        <p role="status" aria-live="polite" className="text-sm tabular-nums text-slate-500">{visibleCount} {visibleCount === 1 ? "passage" : "passages"}{query.trim() ? " found" : " in this view"}</p>
      </div>
      {targetPanel && !query.trim() && <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[.035] px-5 py-3 text-sm"><p className="text-slate-300">Linked passage in <span className="font-semibold text-white">{targetPanel.title}</span></p><button type="button" onClick={() => { onClearTarget?.(); window.requestAnimationFrame(() => document.getElementById("champion-descriptions")?.scrollIntoView({ block: "start" })) }} className="rounded text-sm font-medium text-slate-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400">Show full kit</button></div>}
      <div ref={readerRef} className="grid min-w-0 grid-cols-1 scroll-mt-[calc(var(--champion-header-height,4rem)+var(--champion-tabs-height)+1.5rem)] items-start gap-6 lg:grid-cols-[190px_minmax(0,1fr)] lg:gap-8">
        <aside className="min-w-0 lg:sticky lg:top-[calc(var(--champion-header-height,4rem)+var(--champion-tabs-height)+1.5rem)]">
          <p className="mb-3 text-sm font-medium text-slate-500">In this kit</p>
          <select aria-label="Ability section" value={activeChapter} onChange={event => selectChapter(event.target.value)} className="h-12 w-full rounded-lg border border-white/15 bg-[#111823] px-4 text-sm font-medium text-slate-200 lg:hidden">{chapters.map(chapter => <option key={chapter.key} value={chapter.key}>{chapter.label}</option>)}</select>
          <nav aria-label="Champion description chapters" className="hidden space-y-1 lg:block">{chapters.map(chapter => <button key={chapter.key} type="button" aria-pressed={activeChapter === chapter.key} onClick={() => selectChapter(chapter.key)} className={cn("w-full rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors", activeChapter === chapter.key ? "border-white/15 bg-white/[.06] text-white" : "border-transparent text-slate-400 hover:bg-white/[.025] hover:text-slate-200")}>{chapter.label}</button>)}</nav>
        </aside>
        <div className="min-w-0 space-y-6">
          {visiblePanels.map(panel => <article key={panel.group} id={dossierAnchor(panel.title)} className="rounded-2xl border border-white/[.09] bg-[#0d131c] p-4 sm:p-6">
            <h3 className="mb-5 text-2xl font-semibold leading-tight tracking-tight text-white"><SearchMatch text={panel.title} query={query} /></h3>
            {panel.group === "signature" && view.sigLevel === 0 && <p className="mb-6 rounded-lg border border-amber-300/15 bg-amber-300/[.04] px-4 py-3 text-sm leading-6 text-amber-100/80">Unawakened at Sig 0. The signature ability becomes active after awakening.</p>}
            {panel.introRecord && <div className="mb-5 italic text-slate-400"><RenderedDescriptionTemplate prepared={panel.introRecord.prepared} glossaryById={view.glossaryById} theme={DESCRIPTION_THEME} query={query} /></div>}
            {panel.specialAttackIntros && panel.specialAttackIntros.length > 0 && <div className="mb-6 grid gap-5 border-b border-white/10 pb-6 xl:grid-cols-2">{panel.specialAttackIntros.map(({ number, record }) => <div key={record.id}><p className="mb-2 text-sm font-semibold text-slate-200">Special {number}{record.displayTitle ? ` · ${record.displayTitle}` : ""}</p><div className="italic text-slate-400"><RenderedDescriptionTemplate prepared={record.prepared} glossaryById={view.glossaryById} theme={DESCRIPTION_THEME} query={query} /></div></div>)}</div>}
            <div className={styles.abilityGroups}>{panel.recordGroups.map(group => <section key={group.id} className={styles.abilityGroup}>
              {!(panel.specialAttackNumbers && group.title === panel.title) && <div className={styles.abilityGroupHeader}><AbilityGroupHeading title={group.title || "Details"} query={query} effect={effectsByName.get(effectKey(group.title))} glossaryById={view.glossaryById} /></div>}
              <ul className={styles.abilityRules}>{group.records.map(record => <li key={record.id} id={`ability-record-${record.id}`} tabIndex={String(record.id) === targetRecordId ? -1 : undefined} className={cn(styles.abilityRule, "relative scroll-mt-[calc(var(--champion-header-height,4rem)+var(--champion-tabs-height)+2rem)]", String(record.id) === targetRecordId && "rounded-r-lg border-l-2 bg-white/[.045] py-2 pl-3 pr-4 outline-none")} style={String(record.id) === targetRecordId ? { borderColor: view.accent } : undefined}><span aria-hidden="true" className={styles.abilityRuleMarker} /><div className={styles.abilityRuleBody}><RenderedDescriptionTemplate prepared={record.prepared} glossaryById={view.glossaryById} theme={DESCRIPTION_THEME} query={query} /></div></li>)}</ul>
            </section>)}</div>
            {panel.group === "signature" && !query.trim() && <ChampionSignatureChart view={view} />}
          </article>)}
          {activeChapter === "biography" && biography.length > 0 && <article id="dossier-biography" className="rounded-2xl border border-white/[.09] bg-[#0d131c] p-5 sm:p-8"><div className="mb-6 flex items-center justify-between gap-5"><h3 className="text-2xl font-semibold tracking-tight text-white">Biography</h3><Image src={view.secondaryUrl} alt="" width={96} height={96} className="h-24 w-24 object-contain" /></div><div className="space-y-5">{biography.map(record => <RenderedDescriptionTemplate key={record.id} prepared={record.prepared} glossaryById={view.glossaryById} theme={DESCRIPTION_THEME} query={query} />)}</div></article>}
          {query.trim() && visibleCount === 0 && <div className="rounded-xl border border-dashed border-white/10 p-6 text-sm leading-6 text-slate-400"><p>No passages match <span className="break-words font-medium text-slate-200">“{query.trim()}”</span> in this section.</p><p className="mt-1">Try another term or choose a different chapter.</p><button type="button" onClick={() => setQuery("")} className="mt-4 rounded font-semibold text-slate-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400">Clear search</button></div>}
          {!panels.length && activeChapter !== "biography" && !query.trim() && <p className="rounded-xl border border-dashed border-white/10 p-6 text-sm text-slate-400">Full descriptions are not available for this champion yet.</p>}
        </div>
      </div>
    </section>
  )
}

function AbilityGroupHeading({ title, effect, glossaryById, query }: {
  title: string
  effect: ChampionKitEffect | undefined
  glossaryById: Map<string, GlossaryTerm>
  query: string
}) {
  const term = glossaryById.get(effectKey(title))
  const iconUrl = effect?.iconUrl ?? term?.iconUrl
  const color = effect?.color ?? getGameEffectColors(term?.raw).color

  return (
    <h4 className="flex items-center gap-2.5 text-[15px] font-semibold leading-6 text-slate-100">
      {iconUrl && (
        <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-full border" style={{ backgroundColor: `${color}16`, borderColor: `${color}40` }}>
          <span className="h-4 w-4" style={{ backgroundColor: color, mask: `url(${iconUrl}) center / contain no-repeat`, WebkitMask: `url(${iconUrl}) center / contain no-repeat` }} />
        </span>
      )}
      <span><SearchMatch text={title} query={query} /></span>
    </h4>
  )
}

function effectKey(name: string) {
  return formatGameText(name).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")
}

function dossierAnchor(title: string) {
  return `dossier-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`
}

function chapterLabel(title: string) {
  if (title.startsWith("Special Attacks ")) return title.replace(/^Special Attacks /, "Specials ").replace(/ and /g, " & ")
  return title.replace(/^Special Attack (\d).*$/, "Special $1")
}

export function BuildReadout({ view, className }: { view: ChampionDetailsView; className?: string }) {
  if (!view.selectedStat) return null
  return <div className={cn("flex flex-wrap items-center gap-2 text-xs font-medium tracking-wide", className)}><span>{view.selectedRarity}★</span><span>R{view.selectedRank}</span><span>Sig {view.sigLevel}</span>{view.ascensionLevel > 0 && <span>A{view.ascensionLevel}</span>}</div>
}

export function ChampionAbilityText({ prepared, glossaryById }: {
  prepared: PreparedChampionAbilityText
  glossaryById: Map<string, GlossaryTerm>
}) {
  return <RenderedDescriptionTemplate prepared={prepared} glossaryById={glossaryById} theme={DESCRIPTION_THEME} />
}

function RenderedDescriptionTemplate({
  prepared,
  glossaryById,
  theme,
  query = "",
}: {
  prepared: PreparedChampionAbilityText
  glossaryById: Map<string, GlossaryTerm>
  theme: DescriptionTheme
  query?: string
}) {
  if (prepared.status === "error") {
    return <div className={cn("border px-3 py-2 text-xs", theme.warning)}>This description is not available yet.</div>
  }

  return (
    <div className={cn("space-y-2 text-sm leading-6", theme.body)}>
      {prepared.blocks.map((block, blockIndex) => (
        <div key={blockIndex}>{block.children.map((node, nodeIndex) => renderDescriptionNode(node, nodeIndex, glossaryById, theme, query))}</div>
      ))}
    </div>
  )
}

function renderDescriptionNode(
  node: PreparedChampionAbilityTextNode,
  index: number,
  glossaryById: Map<string, GlossaryTerm>,
  theme: DescriptionTheme,
  query: string,
): ReactNode {
  if (node.type === "text") return <SearchMatch key={index} text={node.value} query={query} />
  if (node.type === "value") {
    return <ResolvedValueTooltip key={index} node={node} theme={theme} query={query} />
  }
  if (node.type === "glossary") {
    const term = glossaryById.get(node.id)
    const description = term?.description?.trim() || rawDescription(term?.raw) || "This effect is referenced by the game data, but its standalone definition is not included in the imported glossary."
    return <GlossaryEffectTooltip key={index} label={node.label} term={term} description={description} theme={theme} query={query} />
  }
  if (node.type === "color") {
    return <span key={index} style={{ color: safeColor(node.color) }}>{node.children.map((child, childIndex) => renderDescriptionNode(child, childIndex, glossaryById, theme, query))}</span>
  }
  return null
}

function SearchMatch({ text, query }: { text: string; query: string }) {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle) return <>{text}</>
  const lower = text.toLocaleLowerCase()
  const parts: ReactNode[] = []
  let start = 0
  let match = lower.indexOf(needle)
  while (match !== -1) {
    parts.push(text.slice(start, match), <mark key={match} className="rounded-sm bg-amber-200/20 text-inherit">{text.slice(match, match + needle.length)}</mark>)
    start = match + needle.length
    match = lower.indexOf(needle, start)
  }
  parts.push(text.slice(start))
  return <>{parts}</>
}

const DOSSIER_CURVE_COLORS = ["#22c55e", "#38bdf8", "#f59e0b", "#f472b6", "#a78bfa"]

const DOSSIER_CURVE_DASHES = [undefined, "8 4", "3 3", "12 4 2 4", "2 4"]

export function ChampionSignatureChart({ view }: { view: ChampionDetailsView }) {
  const curveView = view.descriptionView.curveView
  const candidates = curveView.series.map(series => {
    const points = curveView.data
      .map(row => ({ sig: row.sig, value: normalizeDossierCurveValue(series, row[series.dataKey]) }))
      .filter(point => Number.isFinite(point.sig) && Number.isFinite(point.value))
    const selected = points.length
      ? points.reduce((nearest, point) => Math.abs(point.sig - view.sigLevel) < Math.abs(nearest.sig - view.sigLevel) ? point : nearest, points[0])
      : undefined
    return {
      series,
      points,
      selected,
      presentation: dossierCurvePresentation(series),
    }
  }).filter(curve => curve.points.length && curve.selected)
  const unique = new Map<string, (typeof candidates)[number]>()
  for (const curve of candidates) {
    const valueFingerprint = curve.points.map(point => point.value.toFixed(4)).join(",")
    const key = `${curve.presentation.label}|${curve.presentation.unit}|${valueFingerprint}`
    if (!unique.has(key)) unique.set(key, curve)
  }
  const curves: DossierCurve[] = Array.from(unique.values()).map((curve, index) => ({
    ...curve,
    color: DOSSIER_CURVE_COLORS[index % DOSSIER_CURVE_COLORS.length] ?? view.accent,
  }))

  if (!curves.length) return null

  return (
    <details className="group/curves mt-8 border-y border-white/10 bg-white/[.018]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 marker:hidden sm:px-5 [&::-webkit-details-marker]:hidden">
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-white/[.05]"><Sparkles className="h-4 w-4" style={{ color: view.accent }} /></span>
          <div><div className="text-sm font-black text-white/80">Signature curves</div><div className="mt-0.5 text-xs font-bold uppercase tracking-[.13em] text-white/50">{curves.length} effects · Combined view</div></div>
        </div>
        <ChevronRight className="h-4 w-4 text-white/50 transition-transform group-open/curves:rotate-90" />
      </summary>
      <div className="border-t border-white/10 p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap gap-x-4 gap-y-2">
          {curves.map(curve => <span key={curve.series.id} className="flex items-center gap-2 text-xs font-bold text-white/45"><span className="h-2 w-2 rounded-full" style={{ background: curve.color }} />{curve.presentation.label}<span className="font-mono" style={{ color: curve.color }}>{formatCurveValue(curve.selected?.value ?? 0, curve.presentation.unit)}</span></span>)}
        </div>
        <DossierCombinedCurveStage curves={curves} sigLevel={view.sigLevel} />
      </div>
    </details>
  )
}

type DossierCurve = {
  series: PreparedChampionAbilityCurveSeries
  points: Array<{ sig: number; value: number }>
  selected: { sig: number; value: number } | undefined
  presentation: { label: string; unit: string }
  color: string
}

function DossierCombinedCurveStage({ curves, sigLevel }: { curves: DossierCurve[]; sigLevel: number }) {
  const [inspectionIndex, setInspectionIndex] = useState<number | null>(null)
  const referenceCurve = curves[0]
  const points = referenceCurve?.points ?? []
  if (!points.length || !referenceCurve?.selected) return null
  const width = 700
  const height = 210
  const plotLeft = 58
  const plotRight = 18
  const plotTop = 12
  const plotBottom = 28
  const minSig = Math.min(...points.map(point => point.sig))
  const maxSig = Math.max(...points.map(point => point.sig))
  const x = (sig: number) => plotLeft + ((sig - minSig) / Math.max(1, maxSig - minSig)) * (width - plotLeft - plotRight)
  const y = (normalized: number) => height - plotBottom - (normalized / 100) * (height - plotTop - plotBottom)
  const selectedIndex = Math.max(0, points.reduce((nearest, point, index) => Math.abs(point.sig - sigLevel) < Math.abs(points[nearest]?.sig - sigLevel) ? index : nearest, 0))
  const activeIndex = inspectionIndex == null ? selectedIndex : Math.min(inspectionIndex, points.length - 1)
  const activeSig = points[activeIndex]?.sig ?? sigLevel
  const isInspecting = inspectionIndex != null
  const tickSigs = Array.from(new Set([minSig, Math.round(maxSig * .25), Math.round(maxSig * .5), Math.round(maxSig * .75), maxSig]))
  const yTicks = [100, 75, 50, 25, 0]
  const inspectedValues = curves.map(curve => ({ curve, point: nearestCurvePoint(curve.points, activeSig) }))

  const inspectAt = (clientX: number, left: number, renderedWidth: number) => {
    const viewBoxX = ((clientX - left) / Math.max(1, renderedWidth)) * width
    const ratio = Math.max(0, Math.min(1, (viewBoxX - plotLeft) / (width - plotLeft - plotRight)))
    const targetSig = minSig + ratio * (maxSig - minSig)
    const nearestIndex = points.reduce((nearest, point, index) => Math.abs(point.sig - targetSig) < Math.abs(points[nearest]?.sig - targetSig) ? index : nearest, 0)
    setInspectionIndex(nearestIndex)
  }

  return (
    <figure className="relative min-w-0">
      <p className="mb-3 text-xs leading-relaxed text-white/55">Mixed units share a normalized range. Hover, tap, or focus the chart to see actual values.</p>
      <div
        role="application"
        tabIndex={0}
        data-chart-arrow-keys
        aria-label="Interactive combined signature effect chart. Use left and right arrow keys to inspect signature levels."
        className="relative touch-pan-y focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
        onPointerMove={event => inspectAt(event.clientX, event.currentTarget.getBoundingClientRect().left, event.currentTarget.getBoundingClientRect().width)}
        onPointerDown={event => inspectAt(event.clientX, event.currentTarget.getBoundingClientRect().left, event.currentTarget.getBoundingClientRect().width)}
        onPointerLeave={() => setInspectionIndex(null)}
        onBlur={() => setInspectionIndex(null)}
        onKeyDown={event => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
          event.preventDefault()
          setInspectionIndex(current => {
            const start = current ?? selectedIndex
            return event.key === "ArrowLeft" ? Math.max(0, start - 1) : Math.min(points.length - 1, start + 1)
          })
        }}
      >
        <svg role="img" aria-label={`Combined signature curves from signature ${minSig} to ${maxSig}`} viewBox={`0 0 ${width} ${height}`} className="block aspect-[2.4/1] w-full sm:aspect-[3.4/1]">
          <line x1={plotLeft} x2={plotLeft} y1={plotTop} y2={height - plotBottom} stroke="rgba(255,255,255,.18)" />
          <line x1={plotLeft} x2={width - plotRight} y1={height - plotBottom} y2={height - plotBottom} stroke="rgba(255,255,255,.18)" />
          {yTicks.map(tick => {
            const tickY = y(tick)
            return <g key={tick}><line x1={plotLeft} x2={width - plotRight} y1={tickY} y2={tickY} stroke="rgba(255,255,255,.07)" strokeDasharray="3 7" /><text x={plotLeft - 9} y={tickY} textAnchor="end" dominantBaseline="middle" fill="rgba(255,255,255,.35)" fontFamily="monospace" fontSize="10">{tick}%</text></g>
          })}
          <text x="13" y={height / 2} transform={`rotate(-90 13 ${height / 2})`} textAnchor="middle" fill="rgba(255,255,255,.25)" fontFamily="monospace" fontSize="9">EFFECT RANGE</text>
          {curves.map((curve, index) => {
            const path = curve.points.map((point, index) => `${index ? "L" : "M"}${x(point.sig)} ${y(normalizeCurvePoint(curve, point.value))}`).join(" ")
            const selectedPoint = nearestCurvePoint(curve.points, sigLevel)
            const inspectedPoint = nearestCurvePoint(curve.points, activeSig)
            return (
              <g key={curve.series.id}>
                <path d={path} fill="none" stroke={curve.color} strokeWidth="2.25" strokeDasharray={DOSSIER_CURVE_DASHES[index % DOSSIER_CURVE_DASHES.length]} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                {selectedPoint && <circle cx={x(selectedPoint.sig)} cy={y(normalizeCurvePoint(curve, selectedPoint.value))} r="3.5" fill={curve.color} stroke="#080b10" strokeWidth="2.5" vectorEffect="non-scaling-stroke" opacity={isInspecting && activeSig !== selectedPoint.sig ? .45 : 1} />}
                {isInspecting && inspectedPoint && <circle cx={x(inspectedPoint.sig)} cy={y(normalizeCurvePoint(curve, inspectedPoint.value))} r="4.5" fill={curve.color} stroke="#080b10" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />}
              </g>
            )
          })}
          <line x1={x(Math.max(minSig, Math.min(maxSig, sigLevel)))} x2={x(Math.max(minSig, Math.min(maxSig, sigLevel)))} y1={plotTop} y2={height - plotBottom} stroke="rgba(255,255,255,.3)" strokeDasharray="4 5" />
          {isInspecting && <line x1={x(activeSig)} x2={x(activeSig)} y1={plotTop} y2={height - plotBottom} stroke="rgba(255,255,255,.55)" />}
          {tickSigs.map(sig => <text key={sig} x={x(sig)} y={height - 8} textAnchor={sig === minSig ? "start" : sig === maxSig ? "end" : "middle"} fill="rgba(255,255,255,.35)" fontFamily="monospace" fontSize="10">{sig}</text>)}
        </svg>
        {isInspecting && (
          <div className="pointer-events-none absolute z-10 min-w-44 border border-white/15 bg-[#080b10]/95 px-3 py-2.5 shadow-xl backdrop-blur" style={{ left: `${(x(activeSig) / width) * 100}%`, top: "8px", transform: activeSig > (minSig + maxSig) / 2 ? "translateX(calc(-100% - 10px))" : "translateX(10px)" }}>
            <div className="font-mono text-xs uppercase tracking-[.14em] text-white/40">Sig {activeSig}</div>
            <div className="mt-2 space-y-1.5">
              {inspectedValues.map(({ curve, point }) => point && <div key={curve.series.id} className="flex items-center justify-between gap-4 text-xs"><span className="flex items-center gap-1.5 text-white/45"><span className="h-1.5 w-1.5 rounded-full" style={{ background: curve.color }} />{curve.presentation.label}</span><span className="font-mono font-black" style={{ color: curve.color }}>{formatCurveValue(point.value, curve.presentation.unit)}</span></div>)}
            </div>
          </div>
        )}
        <span className="sr-only" aria-live="polite">Sig {activeSig}: {inspectedValues.map(({ curve, point }) => point ? `${curve.presentation.label} ${formatCurveValue(point.value, curve.presentation.unit)}` : "").filter(Boolean).join(", ")}</span>
      </div>
      <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs font-bold uppercase tracking-[.12em] text-white/50"><span>Y-axis · Effect range</span><span>Actual values in legend and tooltip</span><span>X-axis · Signature level</span></figcaption>
    </figure>
  )
}

function nearestCurvePoint(points: Array<{ sig: number; value: number }>, sig: number) {
  if (!points.length) return undefined
  return points.reduce((nearest, point) => Math.abs(point.sig - sig) < Math.abs(nearest.sig - sig) ? point : nearest)
}

function normalizeCurvePoint(curve: DossierCurve, value: number) {
  const values = curve.points.map(point => point.value)
  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  return ((value - minimum) / Math.max(Number.EPSILON, maximum - minimum)) * 100
}

function dossierCurvePresentation(series: PreparedChampionAbilityCurveSeries) {
  const label = series.label
  const params = series.curve.params as Record<string, unknown> | null
  const source = params && typeof params.source === "object" && params.source ? params.source as Record<string, unknown> : null
  const ability = source && typeof source.ability === "object" && source.ability ? source.ability as Record<string, unknown> : null
  const buffType = typeof ability?.buffType === "string" ? ability.buffType : ""

  if (label === "Unstoppable") return { label: "Unstoppable duration", unit: "s" }
  if (label === "Crit Resist") return { label: "Critical resistance", unit: "" }
  if (label === "Physical Resist" || label === "Resist Physical") return { label: "Physical resistance", unit: "" }
  if (label === "Dummy Ui") return { label: "Resistance potency", unit: "%" }
  if (buffType === "set_var") return { label: "Duration reduction", unit: "%" }
  if (buffType === "pvitr_pause") return { label: "Energy Vulnerability pause", unit: "s" }
  return { label, unit: "" }
}

function normalizeDossierCurveValue(series: PreparedChampionAbilityCurveSeries, value: number) {
  const params = series.curve.params as Record<string, unknown> | null
  const source = params && typeof params.source === "object" && params.source ? params.source as Record<string, unknown> : null
  const ability = source && typeof source.ability === "object" && source.ability ? source.ability as Record<string, unknown> : null
  const display = params && typeof params.display === "object" && params.display ? params.display as Record<string, unknown> : null
  const baseField = typeof display?.baseField === "string" ? display.baseField : null
  const multiplier = typeof display?.multiplier === "number" ? display.multiplier : 1

  if (ability?.buffType === "set_var" && typeof ability.baseVal === "number") {
    const displayBase = baseField && typeof ability[baseField] === "number" ? ability[baseField] : 0
    return value + (ability.baseVal - displayBase) * multiplier
  }

  if (ability?.paramName !== "duration") return value

  const displayBase = baseField && typeof ability[baseField] === "number" ? ability[baseField] : 0
  const durationBase = typeof ability.duration === "number" ? ability.duration : displayBase
  return durationBase + value / multiplier - displayBase
}

function formatCurveValue(value: number, unit = "") {
  const formatted = value.toLocaleString("en-US", { maximumFractionDigits: Math.abs(value) < 100 ? 2 : 0 })
  return unit ? `${formatted}${unit}` : formatted
}

function rawDescription(raw: unknown) {
  if (!raw || typeof raw !== "object") return null
  const description = (raw as { description?: unknown }).description
  return typeof description === "string" && description.trim() ? formatGameText(description.trim()) : null
}

function safeColor(color: string) {
  if (/^[0-9a-fA-F]{6}$/.test(color)) return `#${color}`
  if (/^[0-9a-fA-F]{8}$/.test(color)) return `#${color.slice(0, 6)}`
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color
  return undefined
}

function ResolvedValueTooltip({ node, theme, query }: { node: Extract<PreparedChampionAbilityTextNode, { type: "value" }>; theme: DescriptionTheme; query: string }) {
  const displayValue = node.resolution.status === "resolved" ? node.resolution.displayValue : "Value unavailable"
  return (
    <Popover>
      <PopoverTrigger asChild><button type="button" aria-label={`About ${displayValue}`} className={cn("inline rounded-sm px-0.5 py-0 text-[.95em] font-semibold tabular-nums decoration-dotted underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60", theme.value)}><SearchMatch text={displayValue} query={query} /></button></PopoverTrigger>
      <PopoverContent side="top" collisionPadding={16} className="w-[min(310px,calc(100vw-2rem))] border-white/15 bg-[#0b0f15] p-4 text-white">
        <div className="font-bold">{displayValue}</div>
        <p className="mt-2 text-xs leading-5 text-white/65">{node.resolution.status === "resolved" ? node.resolution.detail : "This value is not available for the selected build yet."}</p>
      </PopoverContent>
    </Popover>
  )
}

function GlossaryEffectTooltip({ label, term, description, theme, query }: { label: string; term: GlossaryTerm | undefined; description: string; theme: DescriptionTheme; query: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild><button type="button" style={{ color: `color-mix(in srgb, ${getGameEffectColors(term?.raw).color} 40%, #e2e8f0)` }} className={cn("rounded-sm px-0.5 font-medium underline decoration-dotted underline-offset-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60", theme.glossary)}><SearchMatch text={label} query={query} /></button></PopoverTrigger>
      <PopoverContent side="top" collisionPadding={16} className="w-[min(310px,calc(100vw-2rem))] border-white/15 bg-[#0b0f15] p-4 text-white">
        <div className="font-bold">{term?.name?.trim() || label}</div>
        <p className="mt-2 text-sm leading-6 text-white/65">{formatGameText(description)}</p>
      </PopoverContent>
    </Popover>
  )
}
