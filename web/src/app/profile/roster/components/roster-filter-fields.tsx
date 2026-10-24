"use client";

import { useId, useState, type ReactNode } from "react";
import Image from "next/image";
import { Check, ChevronDown, Shield, SlidersHorizontal, type LucideIcon } from "lucide-react";
import type { ChampionClass } from "@prisma/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { EFFECT_FORMS, EFFECT_DIRECTIONS, EFFECT_FORM_LABELS, EFFECT_DIRECTION_LABELS, type EffectForm, type EffectDirection } from "@cerebro/core/domain/ability-source";
import { CLASSES, CLASS_ICONS } from "../constants";
import type { FacetCounts } from "@/lib/roster-filtering";

export const filterControlClass = "border-transparent bg-transparent text-slate-400 shadow-none hover:bg-slate-800/60 hover:text-slate-100";

export function FilterField({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return <div className={cn("min-w-0 space-y-2", className)}>
    <p className="text-[11px] font-medium text-slate-400">{label}</p>
    {children}
  </div>;
}

export function ChoiceGroup<T extends string | number>({ label, options, values, onChange, counts, showCounts = false, compact = false, dense = false }: {
  label: string;
  options: { value: T; label: string }[];
  values: T[];
  onChange: (values: T[]) => void;
  counts?: FacetCounts;
  showCounts?: boolean;
  compact?: boolean;
  dense?: boolean;
}) {
  return <div role="group" aria-label={label} className={cn("flex", compact || dense ? "shrink-0" : "flex-wrap gap-1")}>
    {options.map(option => <button
      key={option.value}
      type="button"
      aria-pressed={values.includes(option.value)}
      disabled={!!counts && !(counts[String(option.value)] > 0) && !values.includes(option.value)}
      title={counts ? `${counts[String(option.value)] ?? 0} matching champions` : undefined}
      onClick={() => onChange(values.includes(option.value) ? values.filter(value => value !== option.value) : [...values, option.value])}
      className={cn(
        "min-h-11 min-w-9 rounded-md border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:pointer-events-none disabled:opacity-35 sm:min-h-9",
        compact && "h-11 w-10 shrink-0 px-0",
        dense && "h-9 w-9 min-h-9 px-0",
        values.includes(option.value) ? "border-sky-400/35 bg-sky-400/10 text-sky-100" : filterControlClass,
      )}
    >{option.label}{showCounts && counts && <span aria-hidden="true" className={cn("text-[10px] font-normal tabular-nums text-slate-500", compact ? "block leading-3" : "ml-1.5")}>{counts[String(option.value)] ?? 0}</span>}</button>)}
  </div>;
}

export function ClassChoices({ values, onChange, counts, inline = false, compact = false }: { values: ChampionClass[]; onChange: (values: ChampionClass[]) => void; counts?: FacetCounts; inline?: boolean; compact?: boolean }) {
  const choices = <ClassOptions values={values} onChange={onChange} counts={counts} compact={compact} inline={inline} />;
  return inline ? choices : <FilterField label="Class">{choices}</FilterField>;
}

function ClassOptions({ values, onChange, counts, compact = false, inline = false }: { values: ChampionClass[]; onChange: (values: ChampionClass[]) => void; counts?: FacetCounts; compact?: boolean; inline?: boolean }) {
  return <div role="group" aria-label="Champion class" className={cn("gap-1", compact ? "grid grid-cols-2" : "flex flex-wrap")}>
      {CLASSES.map(value => <button
        key={value}
        type="button"
        aria-pressed={values.includes(value)}
        disabled={!!counts && !(counts[value] > 0) && !values.includes(value)}
        title={counts ? `${counts[value] ?? 0} matching champions` : undefined}
        onClick={() => onChange(values.includes(value) ? values.filter(item => item !== value) : [...values, value])}
        className={cn(
          "flex min-h-9 items-center gap-2 rounded-md border px-2.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:pointer-events-none disabled:opacity-35",
          compact && "min-h-11",
          inline && "gap-1 px-1.5 text-[11px]",
          values.includes(value) ? "border-sky-400/35 bg-sky-400/10 text-sky-100" : filterControlClass,
        )}
      >
        <Image src={CLASS_ICONS[value]} width={16} height={16} alt="" className={cn("shrink-0 object-contain", inline && "h-3.5 w-3.5")} />
        {value.charAt(0) + value.slice(1).toLowerCase()}
        {compact && counts && <span aria-hidden="true" className="ml-auto text-[10px] tabular-nums text-slate-500">{counts[value] ?? 0}</span>}
        {compact && values.includes(value) && <Check className={cn("h-3.5 w-3.5", !counts && "ml-auto")} />}
      </button>)}
  </div>;
}

export function MobileClassFilter({ values, onChange, counts }: { values: ChampionClass[]; onChange: (values: ChampionClass[]) => void; counts?: FacetCounts }) {
  const [open, setOpen] = useState(false);
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <Button type="button" variant="ghost" aria-label={`Champion class${values.length ? `, ${values.length} selected` : ""}`} className={cn(
        "h-11 min-w-0 flex-1 justify-between gap-1 bg-slate-800/50 px-2 text-xs text-slate-300",
        values.length > 0 && "bg-sky-400/10 text-sky-100",
      )}>
        <span>Class</span>
        <span className="flex items-center gap-1">{values.length > 0 && <span className="text-[11px] text-sky-200">{values.length}</span>}<ChevronDown className="h-3 w-3 opacity-60" /></span>
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" collisionPadding={16} aria-label="Select champion classes" className="w-[min(288px,calc(100vw-32px))] space-y-3 border-slate-800 bg-slate-950 p-3 text-slate-200">
      <p className="px-1 text-xs font-medium">Champion class</p>
      <ClassOptions values={values} onChange={onChange} counts={counts} compact />
      <div className="flex items-center justify-between border-t border-slate-800 pt-2">
        <Button type="button" variant="ghost" disabled={!values.length} onClick={() => onChange([])} className="h-11 px-2 text-xs text-slate-400">Clear classes</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="h-11 px-4 text-xs text-sky-300">Done</Button>
      </div>
    </PopoverContent>
  </Popover>;
}

export function OwnershipFilter({ showUnowned, onChange, compact = false, inline = false }: { showUnowned: boolean; onChange: (value: boolean) => void; compact?: boolean; inline?: boolean }) {
  const select = <Select value={showUnowned ? "all" : "owned"} onValueChange={value => onChange(value === "all")}>
      <SelectTrigger aria-label="Ownership" className={cn("h-9 w-[150px] gap-3 whitespace-nowrap px-2 text-xs", filterControlClass, inline && "w-[132px] gap-1 text-[11px]", compact && "h-11 w-full min-w-0 gap-1")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all" className="min-h-11 sm:min-h-8">All champions</SelectItem>
        <SelectItem value="owned" className="min-h-11 sm:min-h-8">Owned only</SelectItem>
      </SelectContent>
    </Select>;
  return compact || inline ? select : <FilterField label="Ownership">{select}</FilterField>;
}

export function ProgressionFilter({ label, options, values, onChange, counts }: { label: string; options: number[]; values: number[]; onChange: (values: number[]) => void; counts?: FacetCounts }) {
  const [open, setOpen] = useState(false);
  const summary = !values.length ? "Any" : values.length > 2 ? `${values.length} selected` : [...values].sort((a, b) => a - b).join(", ");
  return <div className="flex items-center gap-2">
    <span className="text-[11px] text-slate-400">{label}</span>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild><Button type="button" variant="outline" aria-label={`${label}: ${summary}`} className={cn("h-9 min-w-24 justify-between gap-3 border-slate-800 bg-slate-950/40 px-3 text-xs text-slate-300", values.length > 0 && "border-sky-400/25 bg-sky-400/5 text-sky-100")}>{summary}<ChevronDown className="h-3 w-3 text-slate-500" /></Button></PopoverTrigger>
      <PopoverContent align="start" collisionPadding={16} aria-label={`Select ${label.toLowerCase()}`} className="w-[min(304px,calc(100vw-32px))] space-y-3 border-slate-800 bg-slate-950 p-3 text-slate-200">
        <p className="text-xs font-medium">{label}</p>
        <ChoiceGroup label={label} options={options.map(value => ({ value, label: String(value) }))} values={values} onChange={onChange} counts={counts} showCounts />
        <p className="text-[11px] text-slate-500">Matches any selected {label.toLowerCase()}.</p>
        <div className="flex items-center justify-between border-t border-slate-800 pt-2">
          <Button type="button" variant="ghost" disabled={!values.length} onClick={() => onChange([])} className="h-9 px-1 text-xs text-slate-400">Clear {label.toLowerCase()}</Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="h-9 text-xs text-sky-300">Done</Button>
        </div>
      </PopoverContent>
    </Popover>
  </div>;
}

type AbilitySourceProps = {
  forms: EffectForm[];
  onFormsChange: (forms: EffectForm[]) => void;
  directions: EffectDirection[];
  onDirectionsChange: (directions: EffectDirection[]) => void;
  formCounts?: FacetCounts;
  directionCounts?: FacetCounts;
};

export function SourceRefinement(props: AbilitySourceProps) {
  return <RefinementPopover label="Refine ability sources" icon={SlidersHorizontal} count={props.forms.length + props.directions.length}><AbilitySourceFields {...props} /></RefinementPopover>;
}

export function AbilitySourceFields({ forms, onFormsChange, directions, onDirectionsChange, formCounts, directionCounts }: AbilitySourceProps) {
  return <div className="space-y-4">
      <FilterField label="Effect form">
        <ChoiceGroup label="ability effect form" options={EFFECT_FORMS.map(value => ({ value, label: EFFECT_FORM_LABELS[value] }))} values={forms} onChange={onFormsChange} counts={formCounts} showCounts />
      </FilterField>
      <FilterField label="Direction">
        <ChoiceGroup label="ability effect direction" options={EFFECT_DIRECTIONS.map(value => ({ value, label: EFFECT_DIRECTION_LABELS[value] }))} values={directions} onChange={onDirectionsChange} counts={directionCounts} showCounts />
      </FilterField>
      <p className="text-[11px] leading-relaxed text-slate-500">
        Matches any selected form and direction on the same ability source.
      </p>
  </div>;
}

type ImmunitySourceProps = {
  includeResistances: boolean;
  onIncludeResistancesChange: (value: boolean) => void;
  minimum: number | null;
  onMinimumChange: (value: number | null) => void;
};

export function ImmunityRefinement(props: ImmunitySourceProps) {
  const count = Number(!props.includeResistances) + Number(props.includeResistances && props.minimum != null);
  const summary = !props.includeResistances ? "Immunities only" : props.minimum != null ? `≥${props.minimum}%` : undefined;
  return <RefinementPopover label="Refine immunity sources" icon={Shield} count={count} summary={summary}><ImmunitySourceFields {...props} /></RefinementPopover>;
}

function RefinementPopover({ label, icon: Icon, count, summary, children }: { label: string; icon: LucideIcon; count: number; summary?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button type="button" variant="ghost" aria-label={label} className="h-8 gap-2 px-0 text-[11px] font-normal text-slate-400 hover:bg-transparent hover:text-slate-100"><Icon className="h-3 w-3" />{label}{summary ? <span className="text-sky-200">· {summary}</span> : count > 0 && <span className="rounded bg-sky-400/15 px-1.5 text-[10px] text-sky-200">{count}</span>}<ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} /></Button></PopoverTrigger>
    <PopoverContent align="start" collisionPadding={16} className="max-h-[var(--radix-popover-content-available-height)] w-[min(360px,calc(100vw-32px))] space-y-4 overflow-y-auto border-slate-800 bg-slate-950 p-4 text-slate-200">
      <p className="text-xs font-medium">{label}</p>
      {children}
      <div className="flex justify-end border-t border-slate-800 pt-2"><Button type="button" variant="ghost" onClick={() => setOpen(false)} className="h-9 text-xs text-sky-300">Done</Button></div>
    </PopoverContent>
  </Popover>;
}

export function ImmunitySourceFields({ includeResistances, onIncludeResistancesChange, minimum, onMinimumChange }: ImmunitySourceProps) {
  const inputId = useId();
  return <div className="space-y-4">
      <label className="flex min-h-10 cursor-pointer items-center justify-between gap-4 border-b border-slate-800/70 pb-4 text-xs text-slate-200">
        <span className="space-y-1"><span className="block">Include resistances</span><span className="block text-[11px] text-slate-500">Full immunities are always included</span></span>
        <span className="relative flex h-9 w-9 shrink-0 items-center">
          <input type="checkbox" role="switch" aria-label="Include resistances" className="peer sr-only" checked={includeResistances} onChange={event => onIncludeResistancesChange(event.target.checked)} />
          <span aria-hidden="true" className="h-5 w-9 rounded-full bg-slate-700 transition-colors after:relative after:left-0.5 after:top-0.5 after:block after:h-4 after:w-4 after:rounded-full after:bg-slate-200 after:transition-transform after:content-[''] peer-checked:bg-sky-500 peer-checked:after:translate-x-4 peer-checked:after:bg-slate-950 peer-focus-visible:ring-2 peer-focus-visible:ring-sky-400 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-slate-950" />
        </span>
      </label>
      <div className="space-y-2">
        <label htmlFor={inputId} className="text-[11px] font-medium text-slate-400">Minimum potency reduction</label>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">At least</span>
          <div className="relative w-24">
            <Input id={inputId} type="number" min="0" step="any" placeholder="Any" disabled={!includeResistances} value={minimum ?? ""}
              aria-describedby={`${inputId}-help`}
              onChange={event => onMinimumChange(Number.isFinite(event.target.valueAsNumber) ? Math.max(0, event.target.valueAsNumber) : null)}
              className="h-10 border-slate-700/60 bg-slate-950/40 pr-8 text-base text-slate-100 placeholder:text-slate-500 focus-visible:ring-sky-500 md:text-base" />
            <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">%</span>
          </div>
        </div>
        <div role="group" aria-label="Potency presets" className="flex flex-wrap gap-1.5 pt-1">
          {[null, 50, 80, 100].map(value => <button key={value ?? "any"} type="button" aria-pressed={minimum === value} disabled={!includeResistances} onClick={() => onMinimumChange(value)} className={cn(
            "min-h-10 rounded-md border px-2.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-8",
            minimum === value ? "border-sky-400/35 bg-sky-400/10 text-sky-100" : "border-transparent bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-100",
          )}>{value == null ? "Any" : `${value}%`}</button>)}
        </div>
        <p id={`${inputId}-help`} className="pt-1 text-[11px] leading-relaxed text-slate-500">Only recorded potency values meet a minimum. Full immunities also qualify.</p>
      </div>
  </div>;
}
