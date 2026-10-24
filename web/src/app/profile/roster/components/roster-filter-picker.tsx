"use client";

import { useState } from "react";
import { Check, ChevronDown, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { RosterEffectOption } from "@/lib/roster-kit-options";
import type { FacetCounts } from "@/lib/roster-filtering";

export function RosterFilterPicker({ label, triggerLabel, icon: Icon, options, counts, values, onChange, logic, onLogicChange }: {
  label: string;
  triggerLabel?: string;
  icon: LucideIcon;
  options: RosterEffectOption[];
  counts?: FacetCounts;
  values: string[];
  onChange: (values: string[]) => void;
  logic: "AND" | "OR";
  onLogicChange: (logic: "AND" | "OR") => void;
}) {
  const [open, setOpen] = useState(false);
  const [showUnavailable, setShowUnavailable] = useState(false);
  const hasIcons = options.some(option => option.iconUrl);
  const allOptions = [...options, ...values.filter(value => !options.some(option => option.name === value)).map(name => ({ id: name, name }))]
    .sort((a, b) => a.name.localeCompare(b.name));
  const available = allOptions.filter(option => !counts || (counts[option.name] ?? 0) > 0 || values.includes(option.name));
  const unavailable = allOptions.filter(option => counts && !(counts[option.name] > 0) && !values.includes(option.name));
  const renderOption = (option: RosterEffectOption) => {
    const selected = values.includes(option.name);
    const count = counts ? counts[option.name] ?? 0 : undefined;
    return <CommandItem
      key={option.id} value={option.name}
      disabled={count === 0 && !selected}
      aria-label={`${option.name}${count != null ? `, ${count} matching ${count === 1 ? "champion" : "champions"}` : ""}${selected ? ", selected" : ""}`}
      onSelect={() => onChange(selected ? values.filter(value => value !== option.name) : [...values, option.name])}
      className="min-h-10 gap-2 text-xs sm:min-h-9"
    >
      {hasIcons && <span aria-hidden="true" data-effect-icon={option.iconUrl ? option.name : undefined} className="h-5 w-5 shrink-0" style={option.iconUrl ? {
        backgroundColor: option.color ?? "#b8c5d6",
        mask: `url(${JSON.stringify(option.iconUrl)}) center / contain no-repeat`,
        WebkitMask: `url(${JSON.stringify(option.iconUrl)}) center / contain no-repeat`,
      } : undefined} />}
      <span className="min-w-0 flex-1">{option.name}</span>
      {count != null && <span aria-hidden="true" className="shrink-0 text-[11px] tabular-nums text-slate-500">{count}</span>}
      <span aria-hidden="true" className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded border", selected ? "border-sky-400 bg-sky-400 text-slate-950" : "border-slate-600")}>
        {selected && <Check className="h-3 w-3" />}
      </span>
    </CommandItem>;
  };
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <Button type="button" variant="outline" aria-label={label} aria-expanded={open} className={cn(
        "h-10 w-full justify-between gap-2 px-3 text-xs font-normal",
        values.length ? "border-sky-400/25 bg-sky-400/5 text-sky-100 hover:bg-sky-400/10" : "border-slate-800 bg-slate-950/25 text-slate-400 shadow-none hover:border-slate-700 hover:bg-slate-900 hover:text-slate-200",
      )}>
        <span className="flex min-w-0 items-center gap-2"><Icon className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{triggerLabel ?? label}</span></span>
        <span className="flex items-center gap-2">
          {values.length > 0 && <span className="rounded bg-sky-400/20 px-1.5 py-0.5 text-[10px] text-sky-200">{values.length}</span>}
          <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
        </span>
      </Button>
    </PopoverTrigger>
    <PopoverContent align="start" collisionPadding={16} className="flex max-h-[var(--radix-popover-content-available-height)] w-[min(320px,calc(100vw-32px))] flex-col border-slate-700 bg-slate-950 p-0 shadow-2xl">
      <div className="shrink-0 space-y-2 border-b border-slate-800 p-3">
        <p className="text-xs font-medium text-slate-300">{label}</p>
        <div role="group" aria-label={`Match ${label.toLowerCase()}`} className="flex items-center gap-1 rounded-md bg-slate-900 p-1">
          <span className="px-2 text-[11px] text-slate-500">Match</span>
          {(["AND", "OR"] as const).map(value => <button
            key={value} type="button" aria-pressed={logic === value} onClick={() => onLogicChange(value)}
            className={cn("flex-1 rounded px-2 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400", logic === value ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white")}
          >{value === "AND" ? "All selected" : "Any selected"}</button>)}
        </div>
      </div>
      <Command className="min-h-0 bg-slate-950 text-slate-300">
        <CommandInput placeholder={`Search ${label.toLowerCase()}…`} />
        <CommandList className="max-h-60">
          <CommandEmpty>{unavailable.length && !showUnavailable ? "No available matches. Try showing unavailable options." : "No matches found."}</CommandEmpty>
          <CommandGroup>
            {available.map(renderOption)}
          </CommandGroup>
          {showUnavailable && unavailable.length > 0 && <CommandGroup heading="Unavailable with current filters">{unavailable.map(renderOption)}</CommandGroup>}
        </CommandList>
      </Command>
      {unavailable.length > 0 && <button type="button" aria-expanded={showUnavailable} onClick={() => setShowUnavailable(value => !value)} className="min-h-10 shrink-0 border-t border-slate-800 px-3 text-left text-[11px] text-slate-400 hover:bg-slate-900 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400">
        {showUnavailable ? "Hide" : "Show"} unavailable ({unavailable.length})
      </button>}
      <div className="flex shrink-0 items-center justify-between border-t border-slate-800 px-3 py-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])} className="h-8 px-0 text-xs text-slate-400 hover:bg-transparent hover:text-white">Clear selection</Button>
        <Button type="button" size="sm" className="h-8 bg-sky-600 text-xs text-white hover:bg-sky-500" onClick={() => setOpen(false)}>Done</Button>
      </div>
    </PopoverContent>
  </Popover>;
}
