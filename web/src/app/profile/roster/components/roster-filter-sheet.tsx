"use client";

import { useState, useSyncExternalStore } from "react";
import { ChevronDown, Layers, Shield, Tag, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AbilitySourceFields, ChoiceGroup, ClassChoices, FilterField, ImmunitySourceFields, OwnershipFilter } from "./roster-filter-fields";
import { RosterFilterPicker } from "./roster-filter-picker";
import type { RosterFiltersProps } from "./roster-filters";

const mobileQuery = "(max-width: 639px)";
const mobileSnapshot = () => window.matchMedia(mobileQuery).matches;
const serverSnapshot = () => false;
function subscribeToViewport(onChange: () => void) {
  const query = window.matchMedia(mobileQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function useMobileRosterFilters() {
  return useSyncExternalStore(subscribeToViewport, mobileSnapshot, serverSnapshot);
}

export function RosterFilterSheet({ id, p, open, onOpenChange, onReset, onCloseFocus, hasFilters }: {
  id: string;
  p: RosterFiltersProps;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReset: () => void;
  onCloseFocus: () => void;
  hasFilters: boolean;
}) {
  const [tab, setTab] = useState(p.showRankFilter === false && p.showAscensionFilter === false ? "abilities" : "roster");
  const protectionLabel = p.includeResistances ? "Immunities & resistances" : "Immunities";
  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent id={id} side="bottom" onCloseAutoFocus={event => { event.preventDefault(); onCloseFocus(); }} className="flex h-[min(680px,90dvh)] flex-col gap-0 overflow-hidden rounded-t-2xl border-slate-800 bg-slate-950 p-0 text-slate-200 [&>button]:right-2 [&>button]:top-2 [&>button]:grid [&>button]:h-11 [&>button]:w-11 [&>button]:place-items-center">
      <SheetHeader className="shrink-0 px-4 pb-3 pt-4 text-left">
        <SheetTitle className="pr-10 text-base text-slate-100">Filters</SheetTitle>
        <SheetDescription role="status" aria-live="polite" className="text-xs text-slate-400">{p.countLabel}</SheetDescription>
      </SheetHeader>
      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
        <TabsList aria-label="Filter categories" className="mx-4 mb-4 grid h-[52px] shrink-0 grid-cols-4 gap-0.5 bg-slate-900 p-1">
          {([
            { value: "roster", label: "Roster", icon: Layers },
            { value: "tags", label: "Tags", icon: Tag },
            { value: "abilities", label: "Abilities", icon: Zap },
            { value: "protection", label: "Protection", icon: Shield },
          ]).map(({ value, label, icon: Icon }) => <TabsTrigger key={value} value={value} className="h-11 min-w-0 gap-1 px-1 text-[11px] text-slate-400 data-[state=active]:bg-slate-800 data-[state=active]:text-sky-100"><Icon className="hidden h-3 w-3 shrink-0 min-[375px]:block" />{label}</TabsTrigger>)}
        </TabsList>
        <TabsContent value="roster" className="mt-0 min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-5">
          <FilterField label="Rarity"><ChoiceGroup label="Rarity" options={[7, 6, 5].map(value => ({ value, label: `${value}★` }))} values={p.filterStars} onChange={p.onFilterStarsChange} counts={p.facetCounts?.stars} showCounts compact /></FilterField>
          <ClassChoices values={p.filterClasses} onChange={p.onFilterClassesChange} counts={p.facetCounts?.classes} compact />
          {p.showOwnershipFilter !== false && <OwnershipFilter showUnowned={p.showUnowned} onChange={p.onShowUnownedChange} compact />}
          {p.showRankFilter !== false && <FilterField label="Rank"><ChoiceGroup label="Rank" options={[1, 2, 3, 4, 5, 6].map(value => ({ value, label: `${value}` }))} values={p.filterRanks} onChange={p.onFilterRanksChange} counts={p.facetCounts?.ranks} showCounts compact /></FilterField>}
          {p.showAscensionFilter !== false && <FilterField label="Ascension"><ChoiceGroup label="Ascension" options={[0, 1, 2, 3, 4, 5].map(value => ({ value, label: `${value}` }))} values={p.filterAscensionLevels} onChange={p.onFilterAscensionLevelsChange} counts={p.facetCounts?.ascension} showCounts compact /></FilterField>}
        </TabsContent>
        <TabsContent value="tags" className="mt-0 min-h-0 flex-1 overflow-y-auto px-4 pb-5">
          <RosterFilterPicker label="Tags" icon={Tag} options={p.initialTags} counts={p.facetCounts?.tags} values={p.tagFilter} onChange={p.onTagFilterChange} logic={p.tagLogic} onLogicChange={p.onTagLogicChange} />
        </TabsContent>
        <TabsContent value="abilities" className="mt-0 min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-5">
          <RosterFilterPicker label="Ability categories" icon={Layers} options={p.initialAbilityCategories} counts={p.facetCounts?.categories} values={p.abilityCategoryFilter} onChange={p.onAbilityCategoryFilterChange} logic={p.abilityCategoryLogic} onLogicChange={p.onAbilityCategoryLogicChange} />
          <RosterFilterPicker label="Abilities" icon={Zap} options={p.initialAbilities} counts={p.facetCounts?.abilities} values={p.abilityFilter} onChange={p.onAbilityFilterChange} logic={p.abilityLogic} onLogicChange={p.onAbilityLogicChange} />
          <details className="group border-t border-slate-800">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-xs text-slate-400">Refine ability sources<ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" /></summary>
            <div className="pt-2"><AbilitySourceFields forms={p.effectForms} onFormsChange={p.onEffectFormsChange} directions={p.effectDirections} onDirectionsChange={p.onEffectDirectionsChange} formCounts={p.facetCounts?.forms} directionCounts={p.facetCounts?.directions} /></div>
          </details>
        </TabsContent>
        <TabsContent value="protection" className="mt-0 min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-5">
          <RosterFilterPicker label={protectionLabel} icon={Shield} options={p.initialImmunities} counts={p.facetCounts?.immunities} values={p.immunityFilter} onChange={p.onImmunityFilterChange} logic={p.immunityLogic} onLogicChange={p.onImmunityLogicChange} />
          <details className="group border-t border-slate-800">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-xs text-slate-400">Refine immunity sources<ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" /></summary>
            <div className="pt-2"><ImmunitySourceFields includeResistances={p.includeResistances} onIncludeResistancesChange={p.onIncludeResistancesChange} minimum={p.minResistancePotency} onMinimumChange={p.onMinResistancePotencyChange} /></div>
          </details>
        </TabsContent>
      </Tabs>
      <div className="flex shrink-0 items-center gap-3 border-t border-slate-800 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button type="button" variant="ghost" disabled={!hasFilters} onClick={onReset} className="h-11 px-2 text-xs text-slate-400">Clear all</Button>
        <Button type="button" onClick={() => onOpenChange(false)} className="h-11 min-w-0 flex-1 bg-sky-600 text-sm text-white hover:bg-sky-500">Show {p.visibleChampionCount} champions</Button>
      </div>
    </SheetContent>
  </Sheet>;
}
