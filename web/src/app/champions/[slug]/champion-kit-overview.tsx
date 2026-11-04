"use client"

import { useEffect, useState, type CSSProperties, type ReactNode } from "react"
import { LayoutGrid, List, Shield, Sparkles, Swords } from "lucide-react"
import { CompactEffectGrid, CompactEffectTile, ChampionEffectIcon as EffectIcon } from "@/components/champions/compact-effect-grid"
import { EffectSources, EffectFormBadge } from "@/components/champions/effect-sources"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { buildChampionKitOverviewEffects, groupChampionKitAbilitiesByDirection, groupChampionKitSources, type ChampionKitEffect } from "@/lib/champion-kit"
import { buildChampionSynergyView, type ChampionSynergyCard } from "@/lib/champion-synergies"
import { scrollToChampionSection } from "@/lib/champion-page-navigation"
import type { ChampionDetailsView } from "./champion-details-types"
import styles from "./champion-dossier.module.css"

type EffectNavigation = { onViewAbility?: (recordId: string) => void; onViewSynergies?: (synergyId?: string) => void }
type KitDisplay = "compact" | "detailed"
const KIT_DISPLAY_STORAGE_KEY = "cerebro:champion-kit-display"
const DIRECTION_SECTIONS = {
  GAIN: { title: "Gains", description: "Effects on this champion", icon: Sparkles },
  INFLICT: { title: "Inflicts", description: "Effects applied to the opponent", icon: Swords },
  UNKNOWN: { title: "Other effects", icon: Sparkles },
}

export function ChampionKitOverview({ view, sideContent, ...navigation }: {
  view: ChampionDetailsView
  sideContent?: ReactNode
} & EffectNavigation) {
  const [display, setDisplay] = useState<KitDisplay>("detailed")
  useEffect(() => {
    // Restore browser-only preferences after hydration, without a synchronous effect render.
    const frame = window.requestAnimationFrame(() => {
      try {
        const saved = window.localStorage.getItem(KIT_DISPLAY_STORAGE_KEY)
        if (saved === "compact" || saved === "detailed") setDisplay(saved)
      } catch { /* The view switch remains usable when browser storage is unavailable. */ }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])
  const changeDisplay = (next: KitDisplay) => {
    setDisplay(next)
    try { window.localStorage.setItem(KIT_DISPLAY_STORAGE_KEY, next) } catch { /* Saving a preference is optional. */ }
  }
  const rarity = Number(view.selectedRarity) || undefined
  const abilities = buildChampionKitOverviewEffects(view.abilities, view.glossaryById, rarity)
  const immunities = [...abilities.filter(effect => effect.type === "RESISTANCE"), ...buildChampionKitOverviewEffects(view.immunities, view.glossaryById, rarity)]
    .sort((a, b) => a.name.localeCompare(b.name) || a.type.localeCompare(b.type))
  const synergyView = buildChampionSynergyView(view.champion.gameSynergies, view.champion.id, rarity ?? null)
  const synergyCards = [...synergyView.owned, ...synergyView.incoming]
  const sections = groupChampionKitAbilitiesByDirection(abilities)
  const directionalSections = sections.filter(section => section.direction !== "UNKNOWN")
  const mainSections = directionalSections.length ? directionalSections : sections
  const otherEffects = directionalSections.length ? sections.find(section => section.direction === "UNKNOWN") : undefined
  const jumps = [
    { id: "champion-kit-protections", title: "Immunities & resistances", count: immunities.length },
    ...mainSections.map(section => ({ id: `champion-kit-${section.direction.toLowerCase()}`, title: DIRECTION_SECTIONS[section.direction].title, count: section.effects.length })),
    ...(otherEffects ? [{ id: "champion-kit-other", title: "Other effects", count: otherEffects.effects.length }] : []),
    ...(sideContent ? [{ id: "champion-kit-duels", title: "Duel targets", count: view.champion.duels.length }] : []),
  ]
  const shared = { view, synergyCards, display, ...navigation }
  return <>
    <div className={styles.kitOverviewHeader}>
      <h2>Kit overview</h2>
      <p>{display === "compact" ? "Select an effect to explore its conditions and sources." : <>The effects in {view.champion.name}&apos;s kit, and where they come from.</>}</p>
      <div role="group" aria-label="Kit overview display" className={styles.kitDisplaySwitch}>
        {([{ value: "compact", label: "Compact", icon: LayoutGrid }, { value: "detailed", label: "Detailed", icon: List }] as const).map(option => <button key={option.value} type="button" aria-pressed={display === option.value} onClick={() => changeDisplay(option.value)}><option.icon aria-hidden="true" />{option.label}</button>)}
      </div>
    </div>
    <nav aria-label="Jump to kit section" className={styles.kitJumpLinks}>
      {jumps.map(jump => <button key={jump.id} type="button" onClick={() => scrollToChampionSection(document.getElementById(jump.id), true)}>{jump.title}<span>{jump.count}</span></button>)}
    </nav>
    <div className={styles.kitOverview}>
    <div className={`${styles.kitEffects} ${mainSections.length > 1 ? styles.kitEffectsSplit : ""}`}>
      {mainSections.map(section => <ChampionEffectList key={section.direction} id={`champion-kit-${section.direction.toLowerCase()}`} {...DIRECTION_SECTIONS[section.direction]} effects={section.effects} {...shared} />)}
      {!sections.length && <ChampionEffectList title="Abilities" effects={[]} {...shared} />}
    </div>
    <aside className={styles.kitSidebar}>
      <div className={styles.kitImmunities}><ChampionEffectList id="champion-kit-protections" title="Immunities & resistances" description={immunities.some(effect => effect.type === "RESISTANCE") ? "Resistance reduces an effect; it can still apply." : undefined} effects={immunities} {...shared} /></div>
      {otherEffects && <div className={styles.kitOtherEffects}><ChampionEffectList id="champion-kit-other" {...DIRECTION_SECTIONS.UNKNOWN} effects={otherEffects.effects} {...shared} /></div>}
      {sideContent && <div id="champion-kit-duels" tabIndex={-1} className={`${styles.kitSideContent} ${styles.kitJumpTarget}`}>{sideContent}</div>}
    </aside>
    </div>
  </>
}

function ChampionEffectList({ id, title, description, icon, effects, view, synergyCards, display, ...navigation }: {
  id?: string
  title: string
  description?: string
  icon?: typeof Sparkles
  effects: ChampionKitEffect[]
  view: ChampionDetailsView
  synergyCards: ChampionSynergyCard[]
  display: KitDisplay
} & EffectNavigation) {
  const immunity = title === "Immunities & resistances"
  const Icon = icon ?? (immunity ? Shield : Sparkles)
  return (
    <section id={id} tabIndex={-1} aria-label={title} className={styles.kitEffectList} data-display={display}>
      <div className={styles.kitSectionHeader}>
        <span className={styles.kitSectionIcon}><Icon aria-hidden="true" /></span>
        <div className="min-w-0 flex-1"><h3 className="text-lg font-semibold tracking-tight text-slate-100">{title}</h3>{description && <p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p>}</div>
        <span className={styles.kitSectionCount}>{effects.length}</span>
      </div>
      {display === "compact" ? <CompactEffectGrid>{effects.map(effect => <CompactEffectCard key={`${effect.type}:${effect.name}`} effect={effect} view={view} synergyCards={synergyCards} {...navigation} />)}</CompactEffectGrid>
        : <div className={effects.length ? styles.kitDetailedEffects : undefined}>{effects.map(effect => <EffectCard key={`${effect.type}:${effect.name}`} effect={effect} view={view} synergyCards={synergyCards} wide={!immunity} {...navigation} />)}</div>}
      {!effects.length && <p className="rounded-xl border border-dashed border-white/10 px-5 py-6 text-sm leading-6 text-slate-400">No {title.toLowerCase()} recorded for this champion.</p>}
    </section>
  )
}

function CompactEffectCard({ effect, view, synergyCards, ...navigation }: {
  effect: ChampionKitEffect
  view: ChampionDetailsView
  synergyCards: ChampionSynergyCard[]
} & EffectNavigation) {
  const groups = groupChampionKitSources(effect, view.descriptionView, synergyCards, sourceValueContext(view))
  return <CompactEffectTile effect={effect}>{groups.length > 0 ? <EffectSources effect={effect} groups={groups} {...navigation} /> : undefined}</CompactEffectTile>
}

function EffectCard({ effect, wide, view, synergyCards, onViewAbility, onViewSynergies }: {
  effect: ChampionKitEffect
  wide: boolean
  view: ChampionDetailsView
  synergyCards: ChampionSynergyCard[]
} & EffectNavigation) {
  const groups = groupChampionKitSources(effect, view.descriptionView, synergyCards, sourceValueContext(view))
  return (
    <article className={`${styles.kitEffectCard} ${wide && groups.length ? styles.kitEffectCardWithSources : ""}`} style={{ "--kit-effect-color": effect.color } as CSSProperties}>
      <EffectDefinition effect={effect} showAllForms={!groups.length} />
      <EffectSources effect={effect} groups={groups} onViewAbility={onViewAbility} onViewSynergies={onViewSynergies} />
    </article>
  )
}

function sourceValueContext(view: ChampionDetailsView) {
  return { sigLevel: view.sigLevel, maxSig: view.maxSig, championName: view.champion.name,
    championAliases: [view.champion.shortName, view.champion.gameId?.replaceAll('_', ' ')].filter((name): name is string => !!name),
    stat: view.selectedStat ? { ...view.selectedStat, health: view.health, attack: view.attack } : undefined }
}

function EffectDefinition({ effect, showAllForms }: { effect: ChampionKitEffect; showAllForms: boolean }) {
  const [open, setOpen] = useState(false)
  const forms = [...new Set(effect.sources.map(source => source.effectForm))]
  const label = <>
    <EffectIcon effect={effect} />
    <span className={styles.kitEffectLabel}><span className={styles.kitEffectName} style={{ color: `color-mix(in srgb, ${effect.color} 82%, white)` }}>{effect.name}</span>{(effect.type !== "ABILITY" || showAllForms) && <span className={styles.kitEffectMeta}>{effect.type !== "ABILITY" && <span className="text-[11px] font-medium text-cyan-200">{effect.type === "IMMUNITY" ? "Immunity" : "Resistance"}</span>}{showAllForms && forms.map(form => form !== "UNKNOWN" && <EffectFormBadge key={form} form={form} />)}</span>}</span>
  </>
  if (!effect.description) return <div className={styles.kitEffectHeader}>{label}</div>
  return <Tooltip open={open} onOpenChange={setOpen} delayDuration={180}>
    <TooltipTrigger asChild><button type="button" aria-label={`About ${effect.name}${effect.type === "RESISTANCE" ? " resistance" : ""}`} onClick={event => { event.preventDefault(); setOpen(value => !value) }} className={styles.kitEffectHeader}>{label}</button></TooltipTrigger>
    <TooltipContent side="top" align="start" sideOffset={8} className="max-w-[min(360px,calc(100vw-2rem))] rounded-xl border-white/15 bg-[#151b26] p-4 text-slate-300 shadow-2xl"><p className="mb-2 text-base font-semibold" style={{ color: effect.color }}>{effect.name}</p><p className="text-sm leading-6">{effect.description}</p></TooltipContent>
  </Tooltip>
}
