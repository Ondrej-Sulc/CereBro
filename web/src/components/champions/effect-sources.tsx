"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { EFFECT_FORM_LABELS, EFFECT_DIRECTION_LABELS } from "@cerebro/core/domain/ability-source"
import type { ChampionKitEffect, ChampionKitAbilityTarget, groupChampionKitSources } from "@/lib/champion-kit"
import { getChampionImageUrlOrPlaceholder } from "@/lib/championHelper"
import type { ChampionImages } from "@/types/champion"

const FORM_STYLES = {
  BUFF: "border-emerald-300/20 bg-emerald-300/[.06] text-emerald-200",
  DEBUFF: "border-rose-300/20 bg-rose-300/[.06] text-rose-200",
  PASSIVE: "border-violet-300/20 bg-violet-300/[.07] text-violet-200",
}

export function EffectSources({ effect, groups, showForms = false, onViewAbility, onViewSynergies, abilityHref, synergiesHref }: {
  effect: ChampionKitEffect
  groups: ReturnType<typeof groupChampionKitSources>
  showForms?: boolean
  onViewAbility?: (recordId: string) => void
  onViewSynergies?: (synergyId?: string) => void
  abilityHref?: (target: ChampionKitAbilityTarget) => string
  synergiesHref?: string
}) {
  if (!groups.length) return null
  const sourceClass = "inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-md border border-white/10 bg-white/[.025] px-2.5 py-1 text-left text-xs font-medium text-slate-400 transition-colors hover:border-white/25 hover:bg-white/[.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
  return <div data-effect-sources className={`divide-y divide-white/[.07] border-t border-white/[.06] px-5`}>
        {groups.map(group => <section key={group.key} aria-label={`${EFFECT_FORM_LABELS[group.effectForm]} ${EFFECT_DIRECTION_LABELS[group.effectDirection]} sources`} className="py-3.5">
          {(showForms || groups.length > 1) && group.effectForm !== "UNKNOWN" && <div className="mb-2"><EffectFormBadge form={group.effectForm} /></div>}
          <div className="space-y-4">
            {group.nativeSources.map(source => <div key={source.key} className="min-w-0 space-y-1.5">
              {source.condition && (!source.target || (!onViewAbility && !abilityHref) || source.condition !== source.label) && <p className="break-words text-sm leading-6 text-slate-300">{source.condition}</p>}
              {source.target && onViewAbility && <button type="button" aria-label={`Read ${effect.name}: ${source.label}`} onClick={() => onViewAbility(source.target!.recordId)} className={sourceClass}><span className="min-w-0 break-words">{source.label}</span><ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-slate-500" /></button>}
              {source.target && abilityHref && !onViewAbility && <Link href={abilityHref(source.target)} aria-label={`Read ${effect.name}: ${source.label}`} className={sourceClass}><span className="min-w-0 break-words">{source.label}</span><ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-slate-500" /></Link>}
            </div>)}
          </div>
          {group.synergies.length > 0 && <div className={`space-y-3 ${group.nativeSources.length ? "mt-3 border-t border-white/[.05] pt-3" : ""}`}>
            {group.synergies.map(row => <div key={row.key} className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
              <span className="rounded border border-indigo-300/20 bg-indigo-300/[.07] px-2 py-0.5 text-[11px] font-semibold leading-4 text-indigo-200">Synergy</span>
              {row.champions.map(champion => {
                const content = <><Image src={getChampionImageUrlOrPlaceholder(champion.images as ChampionImages, "64")} alt="" width={20} height={20} className="h-5 w-5 shrink-0 rounded object-contain" /><span>{champion.name}</span></>
                const className = "inline-flex items-center gap-1.5 rounded-md border border-white/[.08] bg-white/[.03] py-0.5 pl-0.5 pr-2 text-xs text-slate-300 hover:border-white/25 hover:text-white"
                return champion.slug ? <Link key={champion.slug} href={`/champions/${champion.slug}`} className={className}>{content}</Link> : <span key={champion.name} className={className}>{content}</span>
              })}
              </div>
              <div className="space-y-3">{row.links.map(link => <div key={link.key} className="space-y-1.5">
                {link.conditions.map(condition => <p key={condition} className="break-words text-sm leading-6 text-slate-300">{condition}</p>)}
                {onViewSynergies
                  ? <button type="button" aria-label={`View ${effect.name} synergy: ${link.label}`} onClick={() => onViewSynergies(link.synergyId)} className="inline-flex min-h-8 max-w-full items-center gap-1 rounded px-1 text-left text-xs font-medium text-indigo-300/80 hover:text-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"><span className="min-w-0 break-words">{link.label}</span><ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /></button>
                  : synergiesHref ? <Link href={synergiesHref} className="inline-flex min-h-8 items-center gap-1 text-xs text-indigo-300/80 hover:text-indigo-100">{link.label}<ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" /></Link> : <span className="text-xs text-indigo-300/80">{link.label}</span>}
              </div>)}</div>
            </div>)}
          </div>}
        </section>)}
      </div>
}

export function EffectFormBadge({ form }: { form: Exclude<ChampionKitEffect["sources"][number]["effectForm"], "UNKNOWN"> }) {
  return <span className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold leading-4 ${FORM_STYLES[form]}`}>{EFFECT_FORM_LABELS[form]}</span>
}
