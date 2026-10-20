"use client"

import type { CSSProperties, ReactNode } from "react"
import { Check, ChevronDown, Shield, Sparkles, UsersRound } from "lucide-react"
import type { ChampionKitEffect } from "@/lib/champion-kit"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import styles from "./compact-effect-grid.module.css"

export function CompactEffectGrid({ children, dense = false }: { children: ReactNode; dense?: boolean }) {
  return <TooltipProvider><div className={styles.kitCompactGrid} data-density={dense ? "dense" : undefined}>{children}</div></TooltipProvider>
}

export function CompactEffectTile({ effect, children, matched = false, expanded, onExpandedChange }: {
  effect: ChampionKitEffect; children?: ReactNode; matched?: boolean
  expanded?: boolean; onExpandedChange?: (expanded: boolean) => void
}) {
  const synergyOnly = effect.sources.length > 0 && effect.sources.every(source => source.champions.length > 0 || /^synergy\b/i.test(source.rawLabel))
  const tileStyle = { "--kit-effect-color": effect.color } as CSSProperties
  const label = <>
    {matched && <span role="img" aria-label="Matches current filters" className={styles.kitCompactMatch}><Check aria-hidden="true" /></span>}
    <ChampionEffectIcon effect={effect} compact />
    <span className={styles.kitCompactLabel}><span className={styles.kitCompactName}>{effect.name}</span>{synergyOnly && <span aria-label="Synergy only" className={styles.kitCompactSynergy}><UsersRound aria-hidden="true" />Synergy</span>}</span>
    {children && <ChevronDown aria-hidden="true" className={styles.kitCompactChevron} />}
  </>
  if (!children) return <div className={styles.kitCompactStatic} style={tileStyle} data-matched={matched || undefined}>{label}</div>
  const summary = <summary className={styles.kitCompactTile} aria-label={`${effect.name} details`}>{label}</summary>
  return <details className={styles.kitCompactEffect} style={tileStyle} data-matched={matched || undefined} open={expanded} onToggle={event => onExpandedChange?.(event.currentTarget.open)}>
    {effect.description ? <Tooltip delayDuration={250}><TooltipTrigger asChild>{summary}</TooltipTrigger><TooltipContent side="top" className="max-w-[min(340px,calc(100vw-2rem))] border-white/15 bg-[#151b26] p-3 text-sm leading-6 text-slate-300"><p className="mb-1 font-semibold text-slate-100">{effect.name}</p><p>{effect.description}</p></TooltipContent></Tooltip> : summary}
    {children}
  </details>
}

export function ChampionEffectIcon({ effect, compact = false }: { effect: ChampionKitEffect; compact?: boolean }) {
  const Icon = effect.type === "IMMUNITY" ? Shield : Sparkles
  return <span aria-hidden="true" className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border ${compact ? styles.kitCompactIcon : ""}`} style={{ backgroundColor: `${effect.color}16`, borderColor: `${effect.color}40` }}>
    {effect.iconUrl ? <span className={compact ? "h-6 w-6" : "h-7 w-7"} style={{ backgroundColor: effect.color, mask: `url(${effect.iconUrl}) center / contain no-repeat`, WebkitMask: `url(${effect.iconUrl}) center / contain no-repeat` }} /> : <Icon className="h-5 w-5" style={{ color: effect.color }} />}
  </span>
}
