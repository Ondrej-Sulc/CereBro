"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type RefObject } from "react"
import { ChevronDown, Search, Users, X } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { getChampionImageUrlOrPlaceholder } from "@/lib/championHelper"
import { getChampionClassColors } from "@/lib/championClassHelper"
import { buildSynergyCardContent, highlightSynergyChampionNames, parseSynergyDescription, type ChampionSynergyCard, type SynergyChampion, type SynergyPartner, type SynergyTextSegment } from "@/lib/champion-synergies"
import { formatSynergyRarities, groupChampionSynergyFamilies, type ChampionSynergyDisplayCard, type ChampionSynergyFamily } from "@/lib/champion-synergy-display"
import { cn } from "@/lib/utils"
import { scrollToChampionSection } from "@/lib/champion-page-navigation"
import { readChampionSynergyHash } from "@/lib/champion-page-state"
import type { ChampionImages } from "@/types/champion"
import styles from "./champion-dossier.module.css"

type GlossaryEntry = { name: string; description: string | null }

function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange)
  window.addEventListener("popstate", onChange)
  return () => {
    window.removeEventListener("hashchange", onChange)
    window.removeEventListener("popstate", onChange)
  }
}

type SynergyDirection = "all" | "owned" | "incoming"

export function ChampionSynergiesPanel({ owned, incoming, rarity, glossaryById, targetSynergyId, onClearTarget }: {
  owned: ChampionSynergyCard[]
  incoming: ChampionSynergyCard[]
  rarity: number | null
  glossaryById: Map<string, GlossaryEntry>
  targetSynergyId?: string | null
  onClearTarget?: () => void
}) {
  const hash = useSyncExternalStore(subscribeToHash, () => window.location.hash, () => "")
  const target = targetSynergyId ?? readChampionSynergyHash(hash)
  const [filters, setFilters] = useState({ target, query: "", direction: "all" as SynergyDirection })
  if (filters.target !== target) setFilters({ target, query: "", direction: "all" })
  const { query, direction } = filters
  const searchRef = useRef<HTMLInputElement>(null)
  const controlsRef = useRef<HTMLDivElement>(null)
  const searchId = useId()
  const noticeId = useId()
  const groupedOwned = useMemo(() => groupChampionSynergyFamilies(owned), [owned])
  const groupedIncoming = useMemo(() => groupChampionSynergyFamilies(incoming), [incoming])
  const targetAvailable = !target || [...groupedOwned, ...groupedIncoming].some(family => family.variants.some(card => card.ids.includes(target)))
  useEffect(() => {
    if (!target) return
    const frame = window.requestAnimationFrame(() => {
      const card = document.getElementById(targetAvailable ? `champion-synergy-${target}` : noticeId)
      scrollToChampionSection(card, true)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [target, targetAvailable, rarity, noticeId])
  const focusSearch = () => window.requestAnimationFrame(() => {
    scrollToChampionSection(controlsRef.current)
    searchRef.current?.focus({ preventScroll: true })
  })
  const clearSearch = (resetDirection = false) => {
    setFilters(current => ({ ...current, query: "", direction: resetDirection ? "all" : current.direction }))
    focusSearch()
  }
  const matches = (family: ChampionSynergyFamily) => family.variants.some(card => [card.name, ...card.partners.map(partner => partner.name), parseSynergyDescription(card.description).map(segment => segment.text).join("")].join(" ").toLowerCase().includes(query.trim().toLowerCase()))
  const matchingOwned = groupedOwned.filter(matches)
  const matchingIncoming = groupedIncoming.filter(matches)
  const visibleOwned = direction === "incoming" ? [] : matchingOwned
  const visibleIncoming = direction === "owned" ? [] : matchingIncoming
  const directionOptions = [{ value: "all", label: "All synergies", count: matchingOwned.length + matchingIncoming.length }, { value: "owned", label: "From this champion", count: matchingOwned.length }, { value: "incoming", label: "From teammates", count: matchingIncoming.length }] as const
  const scope = directionOptions.find(option => option.value === direction)!.label
  const visibleCount = visibleOwned.length + visibleIncoming.length
  const totalCount = groupedOwned.length + groupedIncoming.length
  return (
    <div>
      {target && !targetAvailable && <div id={noticeId} tabIndex={-1} role="status" className="mb-6 scroll-mt-[calc(var(--champion-header-height,4rem)+var(--champion-tabs-height)+1.5rem)] rounded-xl border border-amber-300/20 bg-amber-300/[.035] px-5 py-4 text-sm leading-6 text-slate-300 outline-none focus-visible:ring-2 focus-visible:ring-slate-400"><p>This linked synergy is not available for the selected {rarity ? `${rarity}-star ` : ""}build.</p><p className="mt-1 text-slate-400">Try another star level, or browse the available synergies below.</p>{onClearTarget && <button type="button" onClick={() => { onClearTarget(); focusSearch() }} className="mt-2 min-h-10 rounded px-1 font-medium text-sky-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400">Browse all synergies</button>}</div>}
      <div ref={controlsRef} className={styles.synergyTools}>
        <div className="relative min-w-0"><label htmlFor={searchId} className="sr-only">Search synergies or partners</label><Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" /><input ref={searchRef} id={searchId} type="search" value={query} maxLength={200} onChange={event => setFilters(current => ({ ...current, query: event.target.value }))} placeholder="Find a synergy or partner" className="h-11 w-full rounded-lg border border-white/10 bg-[#080d14] pl-10 pr-11 text-sm text-slate-200 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 [&::-webkit-search-cancel-button]:appearance-none" />{query && <button type="button" aria-label="Clear synergy search" onClick={() => clearSearch()} className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded text-slate-400 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"><X aria-hidden="true" className="h-4 w-4" /></button>}</div>
        <div role="group" aria-label="Synergy direction" className={styles.synergyDirection}>{directionOptions.map(filter => <button key={filter.value} type="button" aria-pressed={direction === filter.value} onClick={() => setFilters(current => ({ ...current, direction: filter.value }))}><span>{filter.label}</span><span className={styles.synergyDirectionCount}>{filter.count}</span></button>)}</div>
        <p role="status" aria-live="polite" className={styles.synergyResultCount}>Showing {visibleCount} of {totalCount} {totalCount === 1 ? "synergy" : "synergies"}{rarity ? ` for this ${rarity}-star build` : ""} · {scope}</p>
      </div>
      <div className="space-y-10">
        {visibleOwned.length > 0 && <SynergyGroup title="From this champion" description="Add one of the listed partners to activate each bonus." cards={visibleOwned} incoming={false} rarity={rarity} glossaryById={glossaryById} targetSynergyId={target} />}
        {visibleIncoming.length > 0 && <SynergyGroup title="From teammates" description="These champions bring a synergy that this champion helps activate." cards={visibleIncoming} incoming rarity={rarity} glossaryById={glossaryById} targetSynergyId={target} />}
        {!visibleOwned.length && !visibleIncoming.length && <div className="rounded-xl border border-dashed border-white/10 px-6 py-12 text-center"><Users className="mx-auto mb-4 h-7 w-7 text-slate-600" /><p className="break-words text-base font-medium text-slate-200">{totalCount ? query.trim() ? `No synergies match “${query.trim()}” in ${scope}.` : `No synergies in ${scope} for the selected build.` : `No synergies available${rarity ? ` for this ${rarity}-star build` : ""}.`}</p>{(query || direction !== "all") && <button type="button" onClick={() => clearSearch(true)} className="mt-4 min-h-10 rounded px-2 text-sm text-slate-300 underline underline-offset-4 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400">Show all synergies</button>}</div>}
      </div>
    </div>
  )
}

function SynergyGroup({ title, description, cards, incoming, rarity, glossaryById, targetSynergyId }: { title: string; description: string; cards: ChampionSynergyFamily[]; incoming: boolean; rarity: number | null; glossaryById: Map<string, GlossaryEntry>; targetSynergyId?: string | null }) {
  return <section aria-label={title}><div className={styles.synergyGroupHeader}><h3>{title}<span>{cards.length}</span></h3><p>{description}</p><p className={styles.synergyDisclosureHint}><ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />Expand rows for names and star requirements.</p></div><div className={styles.synergyCards}>{cards.map(family => <SynergyFamilyCard key={family.id} family={family} incoming={incoming} rarity={rarity} glossaryById={glossaryById} targetSynergyId={targetSynergyId} />)}</div></section>
}

function SynergyFamilyCard({ family, incoming, rarity, glossaryById, targetSynergyId }: { family: ChampionSynergyFamily; incoming: boolean; rarity: number | null; glossaryById: Map<string, GlossaryEntry>; targetSynergyId?: string | null }) {
  const [requirementsOpen, setRequirementsOpen] = useState(false)
  const requirementsId = useId()
  const requirementsToggleRef = useRef<HTMLButtonElement>(null)
  const first = family.variants[0]
  const selected = !!targetSynergyId && family.variants.some(card => card.ids.includes(targetSynergyId))
  if (family.variants.length === 1) return <SynergyCard card={first} incoming={incoming} rarity={rarity} glossaryById={glossaryById} selected={selected} />
  const titleId = `champion-synergy-family-${family.id}-title`
  const contents = family.variants.map(card => buildSynergyCardContent(card.description, card.unique))
  const sharedUniqueNote = first.unique && contents.every(content => JSON.stringify(content.uniqueNote) === JSON.stringify(contents[0].uniqueNote))
  const partnerLabel = incoming ? "Brought by" : first.partners.length > 1 ? "Requires one of" : "Requires"
  return <article id={`champion-synergy-family-${family.id}`} aria-labelledby={titleId} data-selected={selected} className={styles.synergyCard}>
    <SynergyCardHeader iconUrl={first.iconUrl} title={family.name} titleId={titleId} partners={first.partners} partnerLabel={partnerLabel} levels={family.variants.length} expanded={requirementsOpen} panelId={requirementsId} toggleRef={requirementsToggleRef} onToggle={() => setRequirementsOpen(open => !open)} />
    <div id={requirementsId} role="region" aria-label={`Partners and star requirements for ${family.name}`} hidden={!requirementsOpen} className={styles.synergyRequirementsBody} onKeyDown={event => {
      if (event.key === "Escape") {
        event.preventDefault()
        setRequirementsOpen(false)
        window.requestAnimationFrame(() => scrollToChampionSection(requirementsToggleRef.current, true))
      }
    }}>
      <p className={styles.synergyPartnersLabel}>{incoming ? "Brought by" : first.partners.length > 1 ? "Requires one of" : "Requires"}</p>
      <ul className={styles.synergyRequirementGrid}>{first.partners.map(partner => <li key={partner.id}><PartnerRequirementRow partner={partner} showStars={false} /></li>)}</ul>
      <p className="mt-1 text-slate-400">Exact partner stars are shown with each level below.</p>
    </div>
    <div>{family.variants.map((card, index) => {
      const levelTitleId = `champion-synergy-${card.id}-title`
      return <section key={card.id} id={`champion-synergy-${card.id}`} aria-labelledby={levelTitleId} tabIndex={-1} data-targeted={!!targetSynergyId && card.ids.includes(targetSynergyId)} className={styles.synergyLevel}>
        {card.ids.filter(id => id !== card.id).map(id => <span key={id} id={`champion-synergy-${id}`} role="group" aria-labelledby={levelTitleId} tabIndex={-1} className={styles.synergyAlias} />)}
        <div className={styles.synergyLevelHeader}>
          <h5 id={levelTitleId}><span className="sr-only">{family.name} </span>Lv. {card.level}</h5>
          <div className={styles.synergyLevelStars}><p>{rarity === null ? "Star requirements" : "Partner stars"}</p><StarRequirements card={card} rarity={rarity} /></div>
        </div>
        <SynergyBonuses content={contents[index]} champions={card.champions} glossaryById={glossaryById} />
        {card.unique && !sharedUniqueNote && <SynergyUniqueNote content={contents[index]} glossaryById={glossaryById} />}
      </section>
    })}</div>
    {sharedUniqueNote && <SynergyUniqueNote content={contents[0]} glossaryById={glossaryById} />}
  </article>
}

function SynergyCard({ card, incoming, rarity, glossaryById, selected }: { card: ChampionSynergyDisplayCard; incoming: boolean; rarity: number | null; glossaryById: Map<string, GlossaryEntry>; selected: boolean }) {
  const [requirementsOpen, setRequirementsOpen] = useState(false)
  const requirementsId = useId()
  const requirementsToggleRef = useRef<HTMLButtonElement>(null)
  const content = buildSynergyCardContent(card.description, card.unique)
  const titleId = `champion-synergy-${card.id}-title`
  const singleRule = card.availability.length === 1
  const partners = singleRule ? card.availability[0].partners : card.partners
  return (
    <article id={`champion-synergy-${card.id}`} aria-labelledby={titleId} tabIndex={-1} data-selected={selected} className={styles.synergyCard}>
      {card.ids.filter(id => id !== card.id).map(id => <span key={id} id={`champion-synergy-${id}`} role="group" aria-labelledby={titleId} tabIndex={-1} className={styles.synergyAlias} />)}
      <SynergyCardHeader iconUrl={card.iconUrl} title={card.name} titleId={titleId} partners={partners} partnerLabel={incoming ? "Brought by" : card.partners.length > 1 ? "Requires one of" : "Requires"} showRequirements={singleRule} expanded={requirementsOpen} panelId={requirementsId} toggleRef={requirementsToggleRef} onToggle={() => setRequirementsOpen(open => !open)} />
      <div id={requirementsId} role="region" aria-label={`Partners and star requirements for ${card.name}`} hidden={!requirementsOpen} className={styles.synergyRequirementsBody} onKeyDown={event => {
        if (event.key === "Escape") {
          event.preventDefault()
          setRequirementsOpen(false)
          window.requestAnimationFrame(() => scrollToChampionSection(requirementsToggleRef.current, true))
        }
      }}>
        <p className={styles.synergyPartnersLabel}>{incoming ? "Brought by" : card.partners.length > 1 ? "Requires one of" : "Requires"}</p>
        <StarRequirements card={card} rarity={rarity} showNames />
      </div>
      <SynergyBonuses content={content} champions={card.champions} glossaryById={glossaryById} />
      {card.unique && <SynergyUniqueNote content={content} glossaryById={glossaryById} />}
    </article>
  )
}

function SynergyCardHeader({ iconUrl, title, titleId, partners, partnerLabel, showRequirements = false, levels, expanded, panelId, toggleRef, onToggle }: {
  iconUrl?: string | null; title: string; titleId: string; partners: SynergyPartner[]; partnerLabel: string; showRequirements?: boolean; levels?: number
  expanded: boolean; panelId: string; toggleRef: RefObject<HTMLButtonElement | null>; onToggle: () => void
}) {
  return <header className={styles.synergyCardHeader}>
    <div className={styles.synergyRowTitle}><div className={styles.synergyTitleWithIcon}>{iconUrl && <span aria-hidden="true" className={styles.synergyNativeIcon} style={{ maskImage: `url("${iconUrl}")` }} />}<h4 id={titleId}>{title}</h4></div>{levels && <span className={styles.synergyCardMeta}>{levels} levels</span>}</div>
    <div role="group" aria-label={partnerLabel} className={styles.synergyPartnerList}>{partners.map(partner => <Partner key={partner.id} partner={partner} showRequirements={showRequirements} />)}</div>
    <Tooltip delayDuration={180}>
      <TooltipTrigger asChild><button ref={toggleRef} type="button" aria-label={`${expanded ? "Hide" : "Show"} partners and star requirements for ${title}`} aria-expanded={expanded} aria-controls={panelId} onClick={onToggle} className={styles.synergyRequirementsToggle}><ChevronDown aria-hidden="true" className="h-4 w-4" /></button></TooltipTrigger>
      <TooltipContent side="top" align="end" sideOffset={6} className="border-white/15 bg-[#111925] text-slate-200">Partner names and star requirements</TooltipContent>
    </Tooltip>
  </header>
}

function StarRequirements({ card, rarity, showNames = false }: { card: ChampionSynergyDisplayCard; rarity: number | null; showNames?: boolean }) {
  return <div className={styles.synergyLevelAvailability}>{card.availability.map((rule, index) => <div key={index} className={showNames ? styles.synergyRequirementRule : undefined} role={showNames ? "group" : undefined} aria-label={showNames ? rarity === null && rule.championRarities.length ? `This champion: ${formatSynergyRarities(rule.championRarities)}` : "Partner requirements" : undefined}>
    {rarity === null && rule.championRarities.length > 0 && <p>This champion: {formatSynergyRarities(rule.championRarities)}</p>}
    {showNames ? <ul className={styles.synergyRequirementGrid}>{rule.partners.map(partner => <li key={partner.id}><PartnerRequirementRow partner={partner} /></li>)}</ul> : <div className="flex flex-wrap gap-x-3 gap-y-1">{rule.partners.map(partner => <span key={partner.id} aria-label={`${partner.name} available at ${partner.rarities.join(", ")} stars`}>{rule.partners.length > 1 && <span>{partner.name}: </span>}{formatSynergyRarities(partner.rarities)}</span>)}</div>}
  </div>)}</div>
}

function PartnerRequirementRow({ partner, showStars = true }: { partner: SynergyPartner; showStars?: boolean }) {
  const style = partner.class ? { "--synergy-class-color": getChampionClassColors(partner.class).color } as CSSProperties : undefined
  const label = showStars ? partner.rarities.length ? `${partner.name} available at ${partner.rarities.join(", ")} stars` : `${partner.name}, star requirements not recorded` : partner.name
  const content = <>
    <Image src={getChampionImageUrlOrPlaceholder(partner.images as ChampionImages, "64")} alt="" width={28} height={28} className={cn(styles.synergyPartnerPortrait, "h-7 w-7 shrink-0 rounded-md bg-black/15 object-contain")} />
    <span data-partner-name className={cn(styles.synergyRequirementName, styles.synergyChampionName)}>{partner.name}</span>
    {showStars && <span className={styles.synergyRequirementStars}>{formatSynergyRarities(partner.rarities)}</span>}
  </>
  return partner.slug ? <Link href={`/champions/${partner.slug}`} aria-label={label} className={styles.synergyRequirementRow} style={style}>{content}</Link> : <span aria-label={label} className={styles.synergyRequirementRow} style={style}>{content}</span>
}

function SynergyBonuses({ content, champions, glossaryById }: { content: ReturnType<typeof buildSynergyCardContent>; champions?: SynergyChampion[]; glossaryById: Map<string, GlossaryEntry> }) {
  return content.bonuses.length > 0 && (
    <div className={styles.synergyBenefitsBlock}>
    <ul className={styles.synergyBenefits}>
      {content.bonuses.map((bonus, index) => (
        <li key={index} className={styles.synergyBenefit}>
          {bonus.label.length > 0 && <><span className={styles.synergyRecipient}><SynergyText segments={bonus.label} glossaryById={glossaryById} champions={champions} /></span>{" "}</>}
          {bonus.body.length > 0 && <span><SynergyText segments={bonus.body} glossaryById={glossaryById} /></span>}
        </li>
      ))}
    </ul>
    </div>
  )
}

function SynergyUniqueNote({ content, glossaryById }: { content: ReturnType<typeof buildSynergyCardContent>; glossaryById: Map<string, GlossaryEntry> }) {
  return <footer className={styles.synergyUniqueNote}>
    <p>{content.uniqueNote ? <SynergyText segments={content.uniqueNote} glossaryById={glossaryById} muted /> : <><span className="font-medium">Unique synergy.</span> Does not stack with duplicate synergies.</>}</p>
  </footer>
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

function Partner({ partner, showRequirements = true }: { partner: SynergyPartner; showRequirements?: boolean }) {
  const style = partner.class ? { "--synergy-class-color": getChampionClassColors(partner.class).color } as CSSProperties : undefined
  const content = <>
    <Image src={getChampionImageUrlOrPlaceholder(partner.images as ChampionImages, "64")} alt="" width={28} height={28} className={cn(styles.synergyPartnerPortrait, "h-7 w-7 rounded-md bg-black/15 object-contain")} />
    <span className="sr-only">{partner.name}</span>
  </>
  const className = styles.synergyPartner
  const badge = partner.slug ? <Link className={className} style={style} href={`/champions/${partner.slug}`}>{content}</Link> : <span tabIndex={0} className={className} style={style}>{content}</span>
  return (
    <Tooltip delayDuration={250}>
      <TooltipTrigger asChild>
        {badge}
      </TooltipTrigger>
      <TooltipContent className="max-w-xs border-white/15 bg-[#0b0f15] text-white/70">
        <p className="font-medium text-slate-100">{partner.name}</p>
        {showRequirements && partner.rarities.length > 0 && <p>Synergy available at {formatSynergyRarities(partner.rarities)}</p>}
      </TooltipContent>
    </Tooltip>
  )
}
