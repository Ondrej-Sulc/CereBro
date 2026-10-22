"use client"

import { createContext, useContext, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "framer-motion"
import { Check, ChevronDown, Shield, Sparkles, UsersRound, X } from "lucide-react"
import type { ChampionKitEffect } from "@/lib/champion-kit"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import styles from "./compact-effect-grid.module.css"

type TilePosition = { tileOrder: number; panelOrder: number; anchor: number }
const GridPositions = createContext<Record<string, TilePosition>>({})
const GridExpansion = createContext<{
  expandedId: string | null
  setExpandedId: (id: string | null) => void
} | null>(null)

export function CompactEffectGrid({ children, dense = false }: { children: ReactNode; dense?: boolean }) {
  const gridRef = useRef<HTMLDivElement>(null)
  const [positions, setPositions] = useState<Record<string, TilePosition>>({})
  const [expandedId, setExpandedId] = useState<string | null>(null)
  useLayoutEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const measure = () => {
      const css = getComputedStyle(grid)
      const columns = Math.max(1, css.gridTemplateColumns.split(/\s+/).filter(Boolean).length)
      const gap = parseFloat(css.columnGap) || 0
      const columnWidth = (grid.clientWidth - gap * (columns - 1)) / columns
      const tiles = Array.from(grid.querySelectorAll<HTMLElement>(":scope > [data-effect-tile]"))
      const next = Object.fromEntries(tiles.map((tile, index) => [tile.dataset.effectTile!, {
        tileOrder: index * 2,
        panelOrder: Math.min(tiles.length - 1, Math.floor(index / columns) * columns + columns - 1) * 2 + 1,
        anchor: (index % columns) * (columnWidth + gap) + columnWidth / 2,
      }]))
      setPositions(current => JSON.stringify(current) === JSON.stringify(next) ? current : next)
    }
    measure()
    const resize = new ResizeObserver(measure)
    const childrenChanged = new MutationObserver(measure)
    resize.observe(grid)
    childrenChanged.observe(grid, { childList: true })
    return () => { resize.disconnect(); childrenChanged.disconnect() }
  }, [])
  return <TooltipProvider><GridPositions.Provider value={positions}><GridExpansion.Provider value={{ expandedId, setExpandedId }}><div ref={gridRef} className={styles.kitCompactGrid} data-density={dense ? "dense" : undefined}>{children}</div></GridExpansion.Provider></GridPositions.Provider></TooltipProvider>
}

export function CompactEffectTile({ effect, children, matched = false }: {
  effect: ChampionKitEffect; children?: ReactNode; matched?: boolean
}) {
  const id = useId()
  const triggerId = `effect-trigger-${id}`
  const panelId = `effect-panel-${id}`
  const position = useContext(GridPositions)[id]
  const expansion = useContext(GridExpansion)
  const triggerRef = useRef<HTMLButtonElement>(null)
  // Filter matches stay independently expandable; ordinary browsing opens one tile per section.
  const [localExpanded, setLocalExpanded] = useState(matched)
  const open = !!children && (matched || !expansion ? localExpanded : expansion.expandedId === id)
  const changeExpanded = (next: boolean, returnFocus = false) => {
    if (matched || !expansion) setLocalExpanded(next)
    else expansion.setExpandedId(next ? id : null)
    if (returnFocus) triggerRef.current?.focus({ preventScroll: true })
  }
  const synergyOnly = effect.sources.length > 0 && effect.sources.every(source => source.champions.length > 0 || /^synergy\b/i.test(source.rawLabel))
  const tileStyle = { "--kit-effect-color": effect.color, order: position?.tileOrder } as CSSProperties
  const label = <>
    {matched && <span role="img" aria-label="Matches current filters" className={styles.kitCompactMatch}><Check aria-hidden="true" /></span>}
    <ChampionEffectIcon effect={effect} compact />
    <span className={styles.kitCompactLabel}><span className={styles.kitCompactName}>{effect.name}</span>{synergyOnly && <span aria-label="Synergy only" className={styles.kitCompactSynergy}><UsersRound aria-hidden="true" />Synergy</span>}</span>
    {children && <ChevronDown aria-hidden="true" className={styles.kitCompactChevron} />}
  </>
  const trigger = children
    ? <button ref={triggerRef} id={triggerId} type="button" data-effect-tile={id} className={styles.kitCompactTile} style={tileStyle} data-matched={matched || undefined} aria-label={`${effect.name} details`} aria-expanded={open} aria-controls={panelId} onClick={() => changeExpanded(!open)}>{label}</button>
    : <div data-effect-tile={id} className={styles.kitCompactStatic} style={tileStyle} data-matched={matched || undefined} tabIndex={effect.description ? 0 : undefined} aria-label={effect.description ? `About ${effect.name}` : undefined}>{label}</div>
  const header = effect.description ? <Tooltip delayDuration={250}><TooltipTrigger asChild>{trigger}</TooltipTrigger><TooltipContent side="top" className="max-w-[min(340px,calc(100vw-2rem))] border-white/15 bg-[#151b26] p-3 text-sm leading-6 text-slate-300"><p className="mb-1 font-semibold text-slate-100">{effect.name}</p><p>{effect.description}</p></TooltipContent></Tooltip> : trigger
  return <>
    {header}
    <AnimatePresence initial={false}>{open && <EffectDetailsPanel key={panelId} id={panelId} triggerId={triggerId} effect={effect} position={position} onClose={() => changeExpanded(false, true)}>{children}</EffectDetailsPanel>}</AnimatePresence>
  </>
}

function EffectDetailsPanel({ id, triggerId, effect, position, onClose, children }: {
  id: string; triggerId: string; effect: ChampionKitEffect; position?: TilePosition; onClose: () => void; children: ReactNode
}) {
  const present = useIsPresent()
  const reducedMotion = useReducedMotion()
  const bodyRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number>()
  useLayoutEffect(() => {
    const body = bodyRef.current
    if (!body) return
    const measure = () => {
      const css = getComputedStyle(body)
      setHeight(body.getBoundingClientRect().height + (parseFloat(css.marginTop) || 0) + (parseFloat(css.marginBottom) || 0))
    }
    measure()
    const resize = new ResizeObserver(measure)
    resize.observe(body)
    return () => resize.disconnect()
  }, [])
  return <motion.section
    id={id} role="region" aria-labelledby={triggerId} aria-hidden={!present || undefined} inert={!present || undefined} data-effect-panel
    className={styles.kitCompactPanel}
    style={{ "--kit-effect-color": effect.color, "--kit-panel-anchor": `${position?.anchor ?? 66}px`, order: position?.panelOrder } as CSSProperties}
    initial={{ height: 0, opacity: 0 }}
    animate={{ height: height ?? "auto", opacity: 1, transition: { height: { duration: reducedMotion ? 0 : .26, ease: [.22, 1, .36, 1] }, opacity: { duration: reducedMotion ? 0 : .16, delay: reducedMotion ? 0 : .05 } } }}
    exit={{ height: 0, opacity: 0, transition: { height: { duration: reducedMotion ? 0 : .22, delay: reducedMotion ? 0 : .06 }, opacity: { duration: reducedMotion ? 0 : .09 } } }}
    onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose() } }}
  >
    <div ref={bodyRef} className={styles.kitCompactPanelBody}>
      <div className={styles.kitCompactPanelHeader}>
        <ChampionEffectIcon effect={effect} compact />
        <div className="min-w-0 flex-1"><p className={styles.kitCompactPanelTitle}>{effect.name}</p><p className="mt-0.5 text-[11px] text-slate-500">Conditions &amp; sources</p></div>
        <button type="button" aria-label={`Close ${effect.name} details`} onClick={onClose} className={styles.kitCompactPanelClose}><X aria-hidden="true" /></button>
      </div>
      {children}
    </div>
  </motion.section>
}

export function ChampionEffectIcon({ effect, compact = false }: { effect: ChampionKitEffect; compact?: boolean }) {
  const Icon = effect.type === "IMMUNITY" ? Shield : Sparkles
  return <span aria-hidden="true" className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border ${compact ? styles.kitCompactIcon : ""}`} style={{ backgroundColor: `${effect.color}16`, borderColor: `${effect.color}40` }}>
    {effect.iconUrl ? <span className={compact ? "h-6 w-6" : "h-7 w-7"} style={{ backgroundColor: effect.color, mask: `url(${effect.iconUrl}) center / contain no-repeat`, WebkitMask: `url(${effect.iconUrl}) center / contain no-repeat` }} /> : <Icon className="h-5 w-5" style={{ color: effect.color }} />}
  </span>
}
