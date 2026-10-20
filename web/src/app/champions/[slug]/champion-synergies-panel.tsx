"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useState, type CSSProperties } from "react"
import { Layers2, Search, Users } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { getChampionImageUrlOrPlaceholder } from "@/lib/championHelper"
import { getChampionClassColors } from "@/lib/championClassHelper"
import { buildSynergyCardContent, highlightSynergyChampionNames, parseSynergyDescription, type ChampionSynergyCard, type SynergyChampion, type SynergyPartner, type SynergyTextSegment } from "@/lib/champion-synergies"
import { cn } from "@/lib/utils"
import type { ChampionImages } from "@/types/champion"
import styles from "./champion-dossier.module.css"

type GlossaryEntry = { name: string; description: string | null }

export function ChampionSynergiesPanel({ owned, incoming, rarity, glossaryById, targetSynergyId }: {
  owned: ChampionSynergyCard[]
  incoming: ChampionSynergyCard[]
  rarity: number | null
  glossaryById: Map<string, GlossaryEntry>
  targetSynergyId?: string | null
}) {
  const [query, setQuery] = useState("")
  const [direction, setDirection] = useState<"all" | "owned" | "incoming">("all")
  useEffect(() => {
    if (!targetSynergyId) return
    const frame = window.requestAnimationFrame(() => {
      const card = document.getElementById(`champion-synergy-${targetSynergyId}`)
      card?.scrollIntoView({ block: "start" })
      card?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [targetSynergyId])
  const matches = (card: ChampionSynergyCard) => [card.name, ...card.partners.map(partner => partner.name), parseSynergyDescription(card.description).map(segment => segment.text).join("")].join(" ").toLowerCase().includes(query.trim().toLowerCase())
  const visibleOwned = direction === "incoming" ? [] : owned.filter(matches)
  const visibleIncoming = direction === "owned" ? [] : incoming.filter(matches)
  const filters = [{ value: "all", label: "All synergies", count: owned.length + incoming.length }, { value: "owned", label: "From this champion", count: owned.length }, { value: "incoming", label: "From teammates", count: incoming.length }] as const
  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-5 border-b border-white/10 pb-5">
        <div role="group" aria-label="Synergy direction" className="flex flex-wrap gap-2">{filters.map(filter => <button key={filter.value} type="button" aria-pressed={direction === filter.value} onClick={() => setDirection(filter.value)} className={cn("flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm font-medium transition-colors", direction === filter.value ? "border-white/20 bg-white/[.08] text-white" : "border-transparent text-slate-400 hover:border-white/10 hover:text-slate-200")}>{filter.label}<span className="text-xs tabular-nums text-slate-500">{filter.count}</span></button>)}</div>
        <label className="relative w-full sm:w-80"><span className="sr-only">Search synergies or partners</span><Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" /><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a synergy or partner" className="h-11 w-full rounded-lg border border-white/10 bg-[#0e141e] pl-10 pr-4 text-sm text-slate-200 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400" /></label>
      </div>
      <div className="space-y-10">
        {visibleOwned.length > 0 && <SynergyGroup title="From this champion" description="Add one of the listed partners to activate each bonus." cards={visibleOwned} incoming={false} glossaryById={glossaryById} targetSynergyId={targetSynergyId} />}
        {visibleIncoming.length > 0 && <SynergyGroup title="From teammates" description="These champions bring a synergy that this champion helps activate." cards={visibleIncoming} incoming glossaryById={glossaryById} targetSynergyId={targetSynergyId} />}
        {!visibleOwned.length && !visibleIncoming.length && <div className="rounded-xl border border-dashed border-white/10 px-6 py-12 text-center"><Users className="mx-auto mb-4 h-7 w-7 text-slate-600" /><p className="text-base font-medium text-slate-200">{owned.length + incoming.length ? query ? "No synergies match this search." : "No synergies in this group for the selected build." : `No synergies available${rarity ? ` for this ${rarity}-star build` : ""}.`}</p>{(query || direction !== "all") && <button type="button" onClick={() => { setQuery(""); setDirection("all") }} className="mt-4 text-sm text-slate-400 underline underline-offset-4 hover:text-white">Show all synergies</button>}</div>}
      </div>
    </div>
  )
}

function SynergyGroup({ title, description, cards, incoming, glossaryById, targetSynergyId }: { title: string; description: string; cards: ChampionSynergyCard[]; incoming: boolean; glossaryById: Map<string, GlossaryEntry>; targetSynergyId?: string | null }) {
  return <section aria-label={title}><div className="mb-5"><h3 className="text-xl font-semibold tracking-tight text-white">{title}<span className="ml-3 text-sm font-normal tabular-nums text-slate-500">{cards.length}</span></h3><p className="mt-2 text-sm leading-6 text-slate-400">{description}</p></div><div className={styles.synergyCards}>{cards.map(card => <SynergyCard key={card.id} card={card} incoming={incoming} glossaryById={glossaryById} selected={card.id === targetSynergyId} />)}</div></section>
}

function SynergyCard({ card, incoming, glossaryById, selected }: { card: ChampionSynergyCard; incoming: boolean; glossaryById: Map<string, GlossaryEntry>; selected: boolean }) {
  const content = buildSynergyCardContent(card.description, card.unique)
  const titleId = `champion-synergy-${card.id}-title`
  return (
    <article id={`champion-synergy-${card.id}`} aria-labelledby={titleId} tabIndex={-1} data-selected={selected} className={cn(styles.synergyCard, "scroll-mt-[calc(var(--champion-header-height,4rem)+var(--champion-tabs-height)+1.5rem)] overflow-hidden rounded-xl border outline-none", selected ? "border-indigo-300/40 ring-1 ring-indigo-300/20" : "border-white/[.09]")}>
      <header className={styles.synergyCardHeader}>
        <h4 id={titleId}>{card.name}</h4>
      </header>
      <div className={styles.synergyPartners}>
        <p className={styles.synergyPartnersLabel}>{incoming ? "Brought by" : card.partners.length > 1 ? "Requires one of" : "Requires"}</p>
        <div className="flex flex-wrap gap-2">{card.partners.map(partner => <Partner key={partner.id} partner={partner} />)}</div>
      </div>
      {content.bonuses.length > 0 && (
        <ul className={styles.synergyBenefits}>
          {content.bonuses.map((bonus, index) => (
            <li key={index} className={styles.synergyBenefit}>
              {bonus.label.length > 0 && <p className={styles.synergyRecipient}><SynergyText segments={bonus.label} glossaryById={glossaryById} champions={card.champions} /></p>}
              {bonus.body.length > 0 && <p><SynergyText segments={bonus.body} glossaryById={glossaryById} /></p>}
            </li>
          ))}
        </ul>
      )}
      {card.unique && (
        <footer className={styles.synergyUniqueNote}>
          <Layers2 aria-hidden="true" />
          <p>{content.uniqueNote ? <SynergyText segments={content.uniqueNote} glossaryById={glossaryById} muted /> : <><span className="font-medium">Unique synergy.</span> Does not stack with duplicate synergies.</>}</p>
        </footer>
      )}
    </article>
  )
}

function SynergyText({ segments, glossaryById, muted = false, champions = [] }: { segments: SynergyTextSegment[]; glossaryById: Map<string, GlossaryEntry>; muted?: boolean; champions?: SynergyChampion[] }) {
  return (
    <>
      {highlightSynergyChampionNames(segments, champions).map((segment, index) => {
        const classColor = segment.championClass && !muted ? getChampionClassColors(segment.championClass).color : undefined
        const content = <span className={classColor ? styles.synergyChampionName : undefined} style={{ "--synergy-class-color": classColor, color: muted || classColor ? undefined : segment.color, fontWeight: segment.bold ? 700 : undefined, fontStyle: segment.italic ? "italic" : undefined } as CSSProperties}>{segment.text}</span>
        const term = segment.glossaryId ? glossaryById.get(segment.glossaryId) : undefined
        return term ? (
          <Tooltip key={index}>
            <TooltipTrigger asChild><button type="button" className="cursor-help rounded-sm text-left underline decoration-sky-300/40 underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60">{content}</button></TooltipTrigger>
            <TooltipContent className="max-w-sm border-slate-700 bg-slate-950 p-3 text-white/70">
              <p className="font-semibold text-white">{term.name}</p>
              <p className="mt-1 text-sm">{term.description ? parseSynergyDescription(term.description).map(s => s.text).join("") : ""}</p>
            </TooltipContent>
          </Tooltip>
        ) : <span key={index}>{content}</span>
      })}
    </>
  )
}

function Partner({ partner }: { partner: SynergyPartner }) {
  const style = partner.class ? { "--synergy-class-color": getChampionClassColors(partner.class).color } as CSSProperties : undefined
  const content = <>
    <Image src={getChampionImageUrlOrPlaceholder(partner.images as ChampionImages, "64")} alt="" width={40} height={40} className={cn(styles.synergyPartnerPortrait, "h-10 w-10 shrink-0 rounded-md bg-black/15 object-contain")} />
    <span className={cn(styles.synergyChampionName, "min-w-0 text-[13px] font-medium leading-5 [overflow-wrap:anywhere]")}>{partner.name}</span>
  </>
  const className = styles.synergyPartner
  return (
    <Tooltip delayDuration={250}>
      <TooltipTrigger asChild>
        {partner.slug ? <Link className={className} style={style} href={`/champions/${partner.slug}`}>{content}</Link> : <span tabIndex={0} className={className} style={style}>{content}</span>}
      </TooltipTrigger>
      <TooltipContent className="max-w-xs border-white/15 bg-[#0b0f15] text-white/70">
        Synergy available at {partner.rarities.join(", ")} ★
      </TooltipContent>
    </Tooltip>
  )
}
