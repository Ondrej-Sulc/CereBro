"use client"

import Image from "next/image"
import Link from "next/link"
import { Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { getChampionImageUrlOrPlaceholder } from "@/lib/championHelper"
import { parseSynergyDescription, type ChampionSynergyCard, type SynergyPartner } from "@/lib/champion-synergies"
import type { ChampionImages } from "@/types/champion"

type GlossaryEntry = { name: string; description: string | null }

export function ChampionSynergiesPanel({ owned, incoming, rarity, glossaryById }: {
  owned: ChampionSynergyCard[]
  incoming: ChampionSynergyCard[]
  rarity: number | null
  glossaryById: Map<string, GlossaryEntry>
}) {
  return (
    <div className="space-y-6">
      <p className="text-sm leading-6 text-slate-400">
        {rarity ? `Synergies for this ${rarity}-star champion.` : "Available synergies."} Add the listed partners to your team. Each description explains who receives the effects.
      </p>
      {owned.length === 0 && incoming.length === 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-6 text-sm text-slate-400">
          No synergies are available for this star level.
        </div>
      ) : (
        <>
          {owned.length > 0 && (
            <section aria-label="Synergies from this champion" className="space-y-3">
              <h2 className="flex items-center gap-2 font-semibold text-slate-100"><Users className="h-4 w-4 text-sky-300" /> From this champion <span className="text-sm font-normal text-slate-500">{owned.length}</span></h2>
              {owned.map(card => <SynergyCard key={card.id} card={card} incoming={false} glossaryById={glossaryById} />)}
            </section>
          )}
          {incoming.length > 0 && (
            <details className="group space-y-3" open={owned.length === 0 ? true : undefined}>
              <summary className="cursor-pointer rounded-lg border border-slate-800 bg-slate-950/70 px-4 py-3 font-semibold text-slate-100 marker:text-sky-300">
                From teammates <span className="ml-2 text-sm font-normal text-slate-400">{incoming.length}</span>
              </summary>
              <p className="px-1 text-sm text-slate-400">These champions bring a synergy that this champion can help activate.</p>
              {incoming.map(card => <SynergyCard key={card.id} card={card} incoming glossaryById={glossaryById} />)}
            </details>
          )}
        </>
      )}
    </div>
  )
}

function SynergyCard({ card, incoming, glossaryById }: { card: ChampionSynergyCard; incoming: boolean; glossaryById: Map<string, GlossaryEntry> }) {
  return (
    <article className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/70 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/70 px-4 py-3">
        <h3 className="text-sm font-bold text-slate-100">{card.name}</h3>
        {card.unique && <Badge variant="outline" className="border-amber-500/30 text-amber-200" title="Does not stack with duplicate synergies">Unique</Badge>}
      </div>
      <div className="space-y-4 p-4">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{incoming ? "Brought by" : card.partners.length > 1 ? "Requires one of" : "Requires"}</p>
          <div className="flex flex-wrap gap-2">
            {card.partners.map(partner => <Partner key={partner.id} partner={partner} />)}
          </div>
        </div>
        <div className="whitespace-pre-line text-sm leading-6 text-slate-300">
          {parseSynergyDescription(card.description).map((segment, index) => {
            const content = <span style={{ color: segment.color, fontWeight: segment.bold ? 700 : undefined, fontStyle: segment.italic ? "italic" : undefined }}>{segment.text}</span>
            const term = segment.glossaryId ? glossaryById.get(segment.glossaryId) : undefined
            return term ? (
              <Tooltip key={index}>
                <TooltipTrigger asChild><button type="button" className="cursor-help underline decoration-sky-300/40 underline-offset-2">{content}</button></TooltipTrigger>
                <TooltipContent className="max-w-sm border-slate-700 bg-slate-950 p-3 text-slate-300">
                  <p className="font-semibold text-white">{term.name}</p>
                  <p className="mt-1 text-sm">{term.description ? parseSynergyDescription(term.description).map(s => s.text).join("") : ""}</p>
                </TooltipContent>
              </Tooltip>
            ) : <span key={index}>{content}</span>
          })}
        </div>
      </div>
    </article>
  )
}

function Partner({ partner }: { partner: SynergyPartner }) {
  const content = <>
    <Image src={getChampionImageUrlOrPlaceholder(partner.images as ChampionImages, "64")} alt="" width={40} height={40} className="h-10 w-10 rounded object-contain" />
    <span className="min-w-0"><span className="block text-xs font-semibold text-slate-200">{partner.name}</span><span className="block text-xs text-slate-500">{partner.rarities.join(", ")} ★</span></span>
  </>
  const className = "inline-flex max-w-full items-center gap-2 rounded-md border border-slate-800 bg-slate-900/70 py-1 pl-1 pr-3 transition-colors hover:border-sky-500/40 hover:bg-slate-800"
  return partner.slug ? <Link className={className} href={`/champions/${partner.slug}`}>{content}</Link> : <span className={className}>{content}</span>
}
