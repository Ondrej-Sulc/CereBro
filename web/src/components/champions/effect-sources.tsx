"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowUpRight, ChevronDown } from "lucide-react"
import { Fragment, type ReactNode } from "react"
import { EFFECT_FORM_LABELS, EFFECT_DIRECTION_LABELS } from "@cerebro/core/domain/ability-source"
import type { ChampionKitEffect, ChampionKitAbilityTarget, ChampionKitSourceGroup } from "@/lib/champion-kit"
import { findInlineSourceReference, groupSynergySourceDisplay } from "@/lib/champion-kit-source-display"
import { getChampionImageUrlOrPlaceholder } from "@/lib/championHelper"
import type { ChampionImages } from "@/types/champion"
import { resistanceLabel, type ResistanceDetail } from "@cerebro/core/domain/champion-resistance"
import type { RecordedResistanceValue } from "@/lib/champion-resistance-values"

const FORM_STYLES = {
  BUFF: "border-emerald-300/20 bg-emerald-300/[.06] text-emerald-200",
  DEBUFF: "border-rose-300/20 bg-rose-300/[.06] text-rose-200",
  PASSIVE: "border-violet-300/20 bg-violet-300/[.07] text-violet-200",
}

export function EffectSources({ effect, groups, onViewAbility, onViewSynergies, abilityHref, synergiesHref }: {
  effect: ChampionKitEffect
  groups: ChampionKitSourceGroup[]
  onViewAbility?: (recordId: string) => void
  onViewSynergies?: (synergyId?: string) => void
  abilityHref?: (target: ChampionKitAbilityTarget) => string
  synergiesHref?: string
}) {
  if (!groups.length) return null
  return <div data-effect-sources className="divide-y divide-white/[.07] border-t border-white/[.06] px-5">
    {groups.map(group => <section key={group.key} aria-label={`${EFFECT_FORM_LABELS[group.effectForm]} ${EFFECT_DIRECTION_LABELS[group.effectDirection]} sources`} className="py-3.5">
      <div className="space-y-3">
        {group.nativeSources.map(source => {
          const reference = abilityReference(effect.name, source.label, source.target, onViewAbility, abilityHref)
          return <div key={source.key} className="min-w-0 space-y-1.5">
            {source.resistance && <ResistanceBadge detail={source.resistance} />}
            <SourceCondition condition={source.condition} form={group.effectForm} reference={reference} />
            <RecordedValues values={source.values} />
          </div>
        })}
      </div>
      {group.synergies.length > 0 && <div className={`space-y-4 ${group.nativeSources.length ? "mt-3 border-t border-white/[.05] pt-3" : ""}`}>
        {groupSynergySourceDisplay(group.synergies).map(source => {
          const variants = source.references.length > 1
          const bonus = source.bonus
          const references = source.references.map(reference => ({
            label: variants ? reference.variantLabel ?? reference.label : reference.label,
            ariaLabel: `View ${effect.name} synergy: ${reference.label}${variants && reference.variantLabel !== `Lv. ${reference.level}` ? ` — ${reference.variantLabel}` : ""}`,
            onSelect: onViewSynergies ? () => onViewSynergies(reference.synergyId) : undefined,
            href: !onViewSynergies && synergiesHref ? reference.synergyId ? `${synergiesHref.split("#")[0]}#champion-synergy-${encodeURIComponent(reference.synergyId)}` : synergiesHref : undefined,
            suffix: <>{variants && reference.details?.map(detail => <span key={detail.ariaLabel} aria-label={detail.ariaLabel} className="ml-1 text-[11px] tabular-nums text-slate-500">({detail.text})</span>)}{!reference.synergyId && !!reference.rarities?.length && <span aria-label={`Champion rarity: ${reference.rarities.join(", ")} stars`} className="ml-1 text-[11px] tabular-nums text-slate-500">{reference.rarities.map(rarity => `${rarity}★`).join("/")}</span>}</>,
          }))
          const prefix = variants ? <><span className="font-medium text-indigo-200">{source.family}</span>{": "}{references.map((reference, index) => <Fragment key={source.references[index].key}>{index > 0 && " · "}<SourceReference {...reference} /></Fragment>)}</> : undefined
          return <div key={source.key} className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded border border-indigo-300/20 bg-indigo-300/[.07] px-2 py-0.5 text-[11px] font-semibold leading-4 text-indigo-200">Synergy</span>
              {bonus && source.champions.length > 1 && <span className="text-xs text-slate-400">Any one of</span>}
              {source.champions.map(champion => {
                const content = <><Image src={getChampionImageUrlOrPlaceholder(champion.images as ChampionImages, "64")} alt="" width={20} height={20} className="h-5 w-5 shrink-0 rounded object-contain" /><span>{champion.name}</span>{!!source.partnerRarities?.length && <span aria-label={`${champion.name} rarity: ${source.partnerRarities.join(", ")} stars`} className="text-[11px] tabular-nums text-slate-500">{source.partnerRarities.map(rarity => `${rarity}★`).join("/")}</span>}</>
                const className = "inline-flex items-center gap-1.5 rounded-md border border-white/[.08] bg-white/[.03] py-0.5 pl-0.5 pr-2 text-xs text-slate-300 hover:border-white/25 hover:text-white"
                return champion.slug ? <Link key={champion.slug} href={`/champions/${champion.slug}`} className={className}>{content}</Link> : <span key={champion.name} className={className}>{content}</span>
              })}
            </div>
            {source.resistance && <ResistanceBadge detail={source.resistance} />}
            {bonus ? <>
              <SourceCondition condition={`${bonus.text}${bonus.nonStacking ? " Does not stack." : ""}`} form={group.effectForm} reference={!variants ? references[0] : undefined} prefix={prefix} />
              <p className="text-xs leading-5 text-slate-400">Applies to {bonus.sources.map((application, index) => {
                const reference = abilityReference(effect.name, application.label, application.target, onViewAbility, abilityHref)
                return <Fragment key={application.target.recordId}>{index > 0 && (index === bonus.sources.length - 1 ? " and " : ", ")}{reference ? <SourceReference {...reference} /> : application.label}</Fragment>
              })}.</p>
              <details className="group/source-details">
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded text-xs text-slate-400 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 sm:min-h-8"><ChevronDown aria-hidden="true" className="h-3 w-3 transition-transform group-open/source-details:rotate-180" />Source details <span className="text-slate-500">({source.conditions.length})</span></summary>
                <div className="space-y-3 pb-1 pt-1">{source.conditions.map(condition => <SourceCondition key={condition} condition={condition} form={group.effectForm} />)}</div>
              </details>
            </> : (source.conditions.length ? source.conditions : [""]).map((condition, index) => <SourceCondition key={condition} condition={condition} form={group.effectForm} reference={!index && !variants ? references[0] : undefined} prefix={!index ? prefix : undefined} />)}
            <RecordedValues values={source.values} />
          </div>
        })}
      </div>}
    </section>)}
  </div>
}

type SourceReferenceProps = { label: string; ariaLabel: string; onSelect?: () => void; href?: string; suffix?: ReactNode }

function abilityReference(effect: string, label: string, target: ChampionKitAbilityTarget | null, onViewAbility?: (recordId: string) => void,
  abilityHref?: (target: ChampionKitAbilityTarget) => string): SourceReferenceProps | undefined {
  if (!target || (!onViewAbility && !abilityHref)) return undefined
  return { label: label || target.title, ariaLabel: `Read ${effect}: ${label || target.title}`,
    onSelect: onViewAbility ? () => onViewAbility(target.recordId) : undefined, href: !onViewAbility ? abilityHref?.(target) : undefined }
}

function SourceReference({ label, ariaLabel, onSelect, href, suffix }: SourceReferenceProps) {
  const className = "inline rounded-sm text-left font-medium text-sky-200 underline decoration-sky-300/35 underline-offset-[3px] transition-colors hover:text-white hover:decoration-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
  const content = <><span>{label}</span><ArrowUpRight aria-hidden="true" className="ml-0.5 inline h-3 w-3 align-baseline text-sky-300/70" /></>
  return <>{onSelect ? <button type="button" aria-label={ariaLabel} onClick={onSelect} className={className}>{content}</button>
    : href ? <Link href={href} aria-label={ariaLabel} className={className}>{content}</Link>
      : <span className="font-medium text-slate-300">{label}</span>}{suffix}</>
}

function SourceCondition({ condition, form, reference, prefix }: { condition: string; form: ChampionKitSourceGroup["effectForm"]; reference?: SourceReferenceProps; prefix?: ReactNode }) {
  const match = reference ? findInlineSourceReference(condition, reference.label) : null
  return <p className="break-words text-sm leading-6 text-slate-300">
    {form !== "UNKNOWN" && <><span className="mr-1.5 inline-flex align-middle"><EffectFormBadge form={form} /></span>{" "}</>}
    {prefix ? <>{prefix}{condition && " — "}{condition}</>
      : match && reference ? <>{match.before}<SourceReference {...reference} label={match.text} />{match.after}</>
        : <>{reference && <><SourceReference {...reference} />{condition && " — "}</>}{condition}</>}
  </p>
}

function ResistanceBadge({ detail }: { detail: ResistanceDetail }) {
  return <p className="text-xs font-semibold text-cyan-200">{resistanceLabel(detail)}<span className="ml-1.5 font-normal text-slate-500">· See source conditions</span></p>
}

function RecordedValues({ values }: { values?: RecordedResistanceValue[] }) {
  if (!values?.length) return null
  return <div data-resistance-values className="space-y-2 border-l-2 border-cyan-300/20 pl-3">{values.map(value => <div key={`${value.label}:${value.text}`}>
    <p className="text-[11px] font-semibold text-cyan-200/80">{value.label}</p>
    <p className="break-words text-sm leading-6 text-slate-300">{value.text}</p>
  </div>)}</div>
}

export function EffectFormBadge({ form }: { form: Exclude<ChampionKitEffect["sources"][number]["effectForm"], "UNKNOWN"> }) {
  return <span className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold leading-4 ${FORM_STYLES[form]}`}>{EFFECT_FORM_LABELS[form]}</span>
}
