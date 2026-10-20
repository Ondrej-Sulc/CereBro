"use client"

import { useState, type CSSProperties } from "react"
import { ArrowUpRight, ChevronDown, Hand, MoveUpRight, Orbit, Swords, Zap } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { ChampionDetailsPayload, ChampionDetailsView } from "./champion-details-types"
import { championAbilityPanelMatchesChapter, type PreparedChampionAbilityTextPanel } from "@/lib/champion-ability-text"
import { summarizeChampionAttackHits } from "@/lib/champion-attack-profile"
import styles from "./champion-dossier.module.css"

const ATTACK_ORDER = ["L1", "L2", "L3", "L4", "M1", "M2", "H", "S1", "S2"] as const
type Attack = ChampionDetailsPayload["attacks"][number]

type AttackNavigation = { panels: PreparedChampionAbilityTextPanel[]; onViewAbility?: (chapter: string) => void }

export function ChampionAttackProfile({ view, onViewAbility }: { view: ChampionDetailsView; onViewAbility?: (chapter: string) => void }) {
  const attacks = [...view.champion.attacks].sort((a, b) => ATTACK_ORDER.indexOf(a.type) - ATTACK_ORDER.indexOf(b.type))
  const basics = attacks.filter(attack => !attack.type.startsWith("S"))
  const specials = attacks.filter(attack => attack.type.startsWith("S"))
  return (
    <section id="champion-attacks" aria-label="Attack breakdown" className={styles.attackSection}>
      <div className={styles.attackSectionHeader}><div><h3 className="text-2xl font-semibold tracking-tight text-white">Attack breakdown</h3><p className="mt-2 text-sm leading-6 text-slate-400">Damage types, contact properties, and individual hits.</p></div><p className={styles.attackMoveCount}>{attacks.length} moves <span aria-hidden="true">·</span> {attacks.reduce((sum, attack) => sum + attack.hits.length, 0)} hits</p></div>
      {!attacks.length ? <p className={styles.statsEmpty}>No attack hit data has been recorded for this champion yet.</p> : (
        <>
          <AttackHitProfile attacks={attacks} />
          <div className={`grid items-start gap-6 ${basics.length > 0 && specials.length > 0 ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]" : ""}`}>
            {basics.length > 0 && <MoveGroup title="Basic attacks" attacks={basics} panels={view.descriptionView.descriptionPanels} />}
            {specials.length > 0 && <MoveGroup title="Special attacks" attacks={specials} panels={view.descriptionView.descriptionPanels} onViewAbility={onViewAbility} />}
          </div>
        </>
      )}
    </section>
  )
}

function MoveGroup({ title, attacks, ...navigation }: { title: string; attacks: Attack[] } & AttackNavigation) {
  const Icon = attacks[0]?.type.startsWith("S") ? Zap : Swords
  return <section><h4 className={styles.attackGroupHeading}><Icon aria-hidden="true" />{title}<span>{attacks.length}</span></h4><div className={styles.attackMoves}>{attacks.map(attack => <AttackMove key={attack.id} attack={attack} {...navigation} />)}</div></section>
}

function AttackHitProfile({ attacks }: { attacks: Attack[] }) {
  const profile = summarizeChampionAttackHits(attacks)
  if (!profile.total) return null
  const damageTypes = [
    { label: "Physical", count: profile.damage.physical, color: propertyColor("Physical") },
    { label: "Energy", count: profile.damage.energy, color: propertyColor("Energy") },
    { label: "Physical + Energy", count: profile.damage.mixed, color: "#c4b5fd" },
    { label: "Other / unspecified", count: profile.damage.other, color: "#94a3b8" },
  ].filter(type => type.count > 0)
  return <figure className={styles.attackHitProfile}>
    <figcaption className={styles.attackHitProfileLabel}><Orbit aria-hidden="true" /><div><p>Hit profile</p><span>Recorded hits by damage type</span></div></figcaption>
    <div className={styles.attackHitDistribution}>
      <div aria-hidden="true" className={styles.attackHitBar}>{damageTypes.map(type => <span key={type.label} style={{ flexGrow: type.count, backgroundColor: type.color }} />)}</div>
      <ul className={styles.attackHitLegend}>{damageTypes.map(type => <li key={type.label}><span aria-hidden="true" style={{ backgroundColor: type.color }} />{type.label}<strong>{type.count} {type.count === 1 ? "hit" : "hits"}</strong></li>)}</ul>
    </div>
    <div className={styles.attackContactCounts}>
      <span><Hand aria-hidden="true" /><strong>{profile.contact}</strong> contact hits</span>
      <span><MoveUpRight aria-hidden="true" /><strong>{profile.projectile}</strong> projectile hits</span>
    </div>
  </figure>
}

function AttackMove({ attack, panels, onViewAbility }: { attack: Attack } & AttackNavigation) {
  const properties = Array.from(new Set(attack.hits.flatMap(hit => hit.properties)))
  const hasSequence = attack.hits.length > 1
  const specialNumber = Number(attack.type.slice(1))
  const panel = attack.type.startsWith("S") ? panels.find(panel => championAbilityPanelMatchesChapter(panel, `special${specialNumber}`)) : undefined
  const title = (panel?.specialAttackIntros?.find(intro => intro.number === specialNumber)?.record ?? panel?.introRecord)?.displayTitle
  const abilityLink = panel && (panel.introRecord || panel.specialAttackIntros?.length || panel.recordGroups.length > 0) && onViewAbility
    ? <div className="flex justify-end border-t border-white/[.06] px-4 py-2.5"><button type="button" aria-label={`Read Special ${attack.type.slice(1)} ability`} onClick={() => onViewAbility(panel.group)} className={styles.attackAbilityLink}>Read ability<ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" /></button></div>
    : null
  const summary = <>
    <span className={styles.attackMoveLabel} data-special={attack.type.startsWith("S")}>{attackLabel(attack.type)}</span>
    <span className="flex min-w-0 flex-wrap gap-1.5">{properties.map(property => <Property key={property} property={property} />)}</span>
    <span className="flex shrink-0 items-center justify-end gap-2 whitespace-nowrap text-xs tabular-nums text-slate-400">{attack.hits.length} {attack.hits.length === 1 ? "hit" : "hits"}<span className="w-4">{hasSequence && <ChevronDown aria-hidden="true" className="h-4 w-4 transition-transform group-open/move:rotate-180" />}</span></span>
    {title && <span className="col-span-full text-sm leading-5 text-slate-400">{title}</span>}
  </>
  const rowClassName = "grid min-h-14 grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 px-3 py-3 sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:gap-x-3 sm:px-4"

  if (!hasSequence) {
    return <div className={styles.attackMove}><div className={rowClassName}>{summary}</div>{abilityLink}</div>
  }

  return <details open={attack.type.startsWith("S")} className={`group/move ${styles.attackMove}`}>
    <summary className={`${rowClassName} cursor-pointer list-none transition-colors hover:bg-white/[.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-400 [&::-webkit-details-marker]:hidden`}>{summary}</summary>
    <HitSequence attack={attack} />
    {abilityLink}
  </details>
}

function HitSequence({ attack }: { attack: Attack }) {
  const runs: Array<{ start: number; end: number; properties: string[] }> = []
  attack.hits.forEach((hit, index) => {
    const previous = runs[runs.length - 1]
    if (previous && [...previous.properties].sort().join("|") === [...hit.properties].sort().join("|")) previous.end = index + 1
    else runs.push({ start: index + 1, end: index + 1, properties: hit.properties })
  })
  return <div className="border-t border-white/[.06] bg-black/15 px-3 py-4 sm:px-4">
    <ol aria-label={`${attackLabel(attack.type)} hit sequence`} className="flex flex-wrap gap-2">
      {attack.hits.map((hit, index) => <li key={hit.id} className="relative after:pointer-events-none after:absolute after:-right-2 after:top-1/2 after:h-px after:w-2 after:bg-white/10 last:after:hidden"><HitMarker hit={hit} number={index + 1} /></li>)}
    </ol>
    <div className="mt-3 space-y-1.5">{runs.map(run => <p key={run.start} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs leading-5"><span className="font-medium tabular-nums text-slate-500">{run.start === run.end ? `Hit ${run.start}` : `Hits ${run.start}–${run.end}`}</span><span className="text-slate-400">{run.properties.length ? run.properties.join(" · ") : "Properties not recorded"}</span></p>)}</div>
  </div>
}

function HitMarker({ hit, number }: { hit: Attack["hits"][number]; number: number }) {
  const [open, setOpen] = useState(false)
  const damageType = hit.properties.includes("Energy") ? "Energy" : hit.properties.includes("Physical") ? "Physical" : "Other"
  const color = propertyColor(damageType)
  const ContactIcon = hit.properties.includes("Projectile") ? MoveUpRight : hit.properties.includes("Contact") ? Hand : Orbit
  const label = `Hit ${number}: ${hit.properties.length ? hit.properties.join(", ") : "properties not recorded"}`
  return <Tooltip open={open} onOpenChange={setOpen} delayDuration={100}>
    <TooltipTrigger asChild><button type="button" aria-label={label} onClick={() => setOpen(value => !value)} className="flex h-12 w-11 flex-col items-center justify-center gap-1 rounded-lg border transition-[filter] hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300" style={{ color, backgroundColor: `${color}0d`, borderColor: `${color}35` }}><span className="font-mono text-sm font-semibold leading-4">{String(number).padStart(2, "0")}</span><ContactIcon aria-hidden="true" className="h-3 w-3 opacity-70" /></button></TooltipTrigger>
    <TooltipContent side="top" className="max-w-64 border-white/15 bg-[#151b26] px-3 py-2 text-sm text-slate-200">{label}</TooltipContent>
  </Tooltip>
}

function Property({ property }: { property: string }) {
  const color = propertyColor(property)
  return <span className={styles.attackProperty} style={{ "--attack-property-color": color } as CSSProperties}>{property}</span>
}

function propertyColor(property: string) {
  return property === "Energy" ? "#7dd3fc" : property === "Projectile" ? "#f9a8d4" : property === "Physical" ? "#fcd69b" : property === "Contact" ? "#a7d7be" : "#c4b5fd"
}

function attackLabel(type: Attack["type"]) {
  return type.startsWith("L") ? `Light ${type.slice(1)}` : type.startsWith("M") ? `Medium ${type.slice(1)}` : type === "H" ? "Heavy" : `Special ${type.slice(1)}`
}
