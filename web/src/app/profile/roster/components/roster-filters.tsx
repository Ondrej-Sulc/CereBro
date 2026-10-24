"use client";

import { useId, useRef, useState, type Ref, type ReactNode } from "react";
import { Search, PenLine, Plus, Zap, Shield, Tag, X, Swords, ArrowUp, ArrowDown, ChevronDown, SlidersHorizontal, Layers, EllipsisVertical } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ChampionClass } from "@prisma/client";
import type { RosterSortField, SortDirection } from "../types";
import type { EffectForm, EffectDirection } from "@cerebro/core/domain/ability-source";
import { ChoiceGroup, ClassChoices, MobileClassFilter, OwnershipFilter, ProgressionFilter, SourceRefinement, ImmunityRefinement } from "./roster-filter-fields";
import { RosterFilterPicker } from "./roster-filter-picker";
import { RosterFilterSheet, useMobileRosterFilters } from "./roster-filter-sheet";
import { buildActiveFilterRules, type RosterFilterRule } from "./roster-filter-rules";
import type { RosterEffectOption, ProtectionOption } from "@/lib/roster-kit-options";
import type { RosterFacetCounts } from "@/lib/roster-filtering";

export interface RosterFiltersProps {
    facetCounts?: RosterFacetCounts;
    search: string;
    onSearchChange: (val: string) => void;
    viewMode: 'view' | 'edit';
    onViewModeChange: (mode: 'view' | 'edit') => void;
    showUnowned: boolean;
    onShowUnownedChange: (val: boolean) => void;
    onAddClick: () => void;
    sortBy: RosterSortField;
    onSortByChange: (val: RosterSortField) => void;
    sortDirection: SortDirection;
    onSortDirectionChange: (val: SortDirection) => void;
    visibleChampionCount: number;
    totalChampionCount?: number;
    countLabel: string;
    filterStars: number[];
    onFilterStarsChange: (val: number[]) => void;
    filterRanks: number[];
    onFilterRanksChange: (val: number[]) => void;
    filterAscensionLevels: number[];
    onFilterAscensionLevelsChange: (val: number[]) => void;
    filterClasses: ChampionClass[];
    onFilterClassesChange: (classes: ChampionClass[]) => void;
    tagFilter: string[];
    onTagFilterChange: (tags: string[]) => void;
    tagLogic: 'AND' | 'OR';
    onTagLogicChange: (logic: 'AND' | 'OR') => void;
    abilityCategoryFilter: string[];
    onAbilityCategoryFilterChange: (cats: string[]) => void;
    abilityCategoryLogic: 'AND' | 'OR';
    onAbilityCategoryLogicChange: (logic: 'AND' | 'OR') => void;
    abilityFilter: string[];
    onAbilityFilterChange: (abs: string[]) => void;
    abilityLogic: 'AND' | 'OR';
    onAbilityLogicChange: (logic: 'AND' | 'OR') => void;
    effectForms: EffectForm[];
    onEffectFormsChange: (forms: EffectForm[]) => void;
    effectDirections: EffectDirection[];
    onEffectDirectionsChange: (directions: EffectDirection[]) => void;
    immunityFilter: string[];
    onImmunityFilterChange: (imms: string[]) => void;
    immunityLogic: 'AND' | 'OR';
    onImmunityLogicChange: (logic: 'AND' | 'OR') => void;
    includeResistances: boolean;
    onIncludeResistancesChange: (value: boolean) => void;
    minResistancePotency: number | null;
    onMinResistancePotencyChange: (value: number | null) => void;
    initialTags: { id: string | number, name: string }[];
    initialAbilityCategories: { id: string | number, name: string }[];
    initialAbilities: RosterEffectOption[];
    initialImmunities: ProtectionOption[];
    canEdit?: boolean;
    canManageAttackReservations?: boolean;
    showAttackReservationControls?: boolean;
    onShowAttackReservationControlsChange?: (value: boolean) => void;
    showOwnershipFilter?: boolean;
    showRankFilter?: boolean;
    showAscensionFilter?: boolean;
    showPrestigeSort?: boolean;
    showSort?: boolean;
    contextControls?: ReactNode;
    additionalRules?: RosterFilterRule[];
    onClearAdditionalFilters?: () => void;
}

type RosterManagementProps = Pick<RosterFiltersProps, "viewMode" | "onViewModeChange" | "showUnowned" | "onShowUnownedChange" | "onAddClick" | "sortBy" | "onSortByChange" | "sortDirection" | "onSortDirectionChange">;
type SharedRosterFiltersProps = Omit<RosterFiltersProps, keyof RosterManagementProps> & Partial<RosterManagementProps>;
const ignoreChange = () => {};
const managementDefaults: RosterManagementProps = {
  viewMode: "view", onViewModeChange: ignoreChange, showUnowned: true, onShowUnownedChange: ignoreChange,
  onAddClick: ignoreChange, sortBy: "NAME", onSortByChange: ignoreChange, sortDirection: "ASC", onSortDirectionChange: ignoreChange,
};

function clearSelections(p: RosterFiltersProps) {
  p.onSearchChange("");
  p.onFilterStarsChange([]);
  p.onFilterClassesChange([]);
  if (p.showRankFilter !== false) p.onFilterRanksChange([]);
  if (p.showAscensionFilter !== false) p.onFilterAscensionLevelsChange([]);
  p.onTagFilterChange([]);
  p.onAbilityCategoryFilterChange([]);
  p.onAbilityFilterChange([]);
  p.onImmunityFilterChange([]);
  p.onEffectFormsChange([]);
  p.onEffectDirectionsChange([]);
  p.onMinResistancePotencyChange(null);
  p.onIncludeResistancesChange(true);
  p.onTagLogicChange("AND");
  p.onAbilityCategoryLogicChange("OR");
  p.onAbilityLogicChange("AND");
  p.onImmunityLogicChange("AND");
  if (p.showOwnershipFilter !== false) p.onShowUnownedChange(true);
  p.onClearAdditionalFilters?.();
}

export function RosterFilters(props: SharedRosterFiltersProps) {
  const p: RosterFiltersProps = { ...managementDefaults, ...props, canEdit: props.canEdit ?? Boolean(props.onViewModeChange) };
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const mobileFilterButton = useRef<HTMLButtonElement>(null);
  const desktopFilterButton = useRef<HTMLButtonElement>(null);
  const isMobile = useMobileRosterFilters();
  const rules = [...buildActiveFilterRules(p), ...(p.additionalRules ?? [])];
  const editing = p.canEdit !== false && p.viewMode === "edit";
  const reserving = p.canManageAttackReservations && p.onShowAttackReservationControlsChange && p.showAttackReservationControls;
  const hasRosterActions = p.canEdit !== false || Boolean(p.canManageAttackReservations && p.onShowAttackReservationControlsChange);
  const advancedCount = p.tagFilter.length + p.abilityCategoryFilter.length + p.abilityFilter.length + p.immunityFilter.length
    + p.effectForms.length + p.effectDirections.length
    + Number(!p.includeResistances) + Number(p.includeResistances && p.minResistancePotency != null)
    + (p.showRankFilter !== false ? p.filterRanks.length : 0)
    + (p.showAscensionFilter !== false ? p.filterAscensionLevels.length : 0);

  return <div className="space-y-3">
    <section aria-label="Champion filters" className="space-y-2 rounded-xl bg-slate-900/40 p-3 sm:space-y-4 sm:p-4">
      <div className="flex items-center gap-2 sm:flex-wrap sm:gap-3">
        <div className="relative min-w-0 flex-1 sm:min-w-[220px] lg:max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input aria-label="Search champions" placeholder="Search champions…" value={p.search} onChange={event => p.onSearchChange(event.target.value)} className="h-11 border-slate-800/80 bg-slate-950/40 pl-10 pr-9 text-base shadow-none placeholder:text-slate-500 focus-visible:ring-sky-500 sm:text-sm" />
          {p.search && <Button type="button" variant="ghost" size="icon" onClick={() => p.onSearchChange("")} aria-label="Clear champion search" className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-slate-400 hover:text-white"><X className="h-3.5 w-3.5" /></Button>}
        </div>
        {hasRosterActions && <div className="sm:hidden"><RosterActions p={p} compact /></div>}
        <div className="ml-auto hidden items-center gap-2 sm:flex">
          {p.contextControls && <div className="flex items-center gap-2 [&>div>p]:sr-only">{p.contextControls}</div>}
          {p.showSort !== false && <RosterSort p={p} />}
          <MoreFiltersButton expanded={expanded} panelId={panelId} count={advancedCount} onToggle={() => setExpanded(!expanded)} buttonRef={desktopFilterButton} />
          <RosterActions p={p} />
        </div>
      </div>

      <div className="flex items-center gap-2 sm:hidden">
        <ChoiceGroup label="Rarity" options={[7, 6, 5].map(value => ({ value, label: `${value}★` }))} values={p.filterStars} onChange={p.onFilterStarsChange} counts={p.facetCounts?.stars} compact />
        <MobileClassFilter values={p.filterClasses} onChange={p.onFilterClassesChange} counts={p.facetCounts?.classes} />
        <MoreFiltersButton expanded={expanded} panelId={`${panelId}-mobile`} count={advancedCount} onToggle={() => setExpanded(!expanded)} compact buttonRef={mobileFilterButton} />
      </div>
      {(p.showOwnershipFilter !== false || p.showSort !== false) && <div className={cn("grid items-center gap-1 border-t border-slate-800/60 pt-1 sm:hidden", p.showOwnershipFilter !== false && p.showSort !== false ? "grid-cols-2" : "grid-cols-[minmax(0,180px)]", p.showOwnershipFilter === false && "justify-end")}>
        {p.showOwnershipFilter !== false && <OwnershipFilter showUnowned={p.showUnowned} onChange={p.onShowUnownedChange} compact />}
        {p.showSort !== false && <RosterSort p={p} compact />}
      </div>}
      {p.contextControls && <div className="grid grid-cols-2 items-end gap-3 border-t border-slate-800/60 pt-3 sm:hidden">{p.contextControls}</div>}
      {(editing || reserving) && <div aria-label="Active roster modes" className="flex flex-wrap gap-1 border-t border-slate-800/60 pt-2">
        {editing && <Button type="button" variant="ghost" onClick={() => p.onViewModeChange("view")} className="h-10 gap-2 bg-amber-500/10 px-3 text-xs text-amber-200"><PenLine className="h-3.5 w-3.5" />Done editing<X className="h-3 w-3" /></Button>}
        {reserving && <Button type="button" variant="ghost" onClick={() => p.onShowAttackReservationControlsChange?.(false)} className="h-10 gap-2 bg-amber-500/10 px-3 text-xs text-amber-200"><Swords className="h-3.5 w-3.5" />Attack reservations on<X className="h-3 w-3" /></Button>}
      </div>}

      <div className="hidden flex-wrap items-center gap-x-4 gap-y-2 sm:flex">
        <div className="flex items-center gap-2"><span className="hidden text-[11px] text-slate-500 xl:inline">Rarity</span><ChoiceGroup label="Rarity" options={[7, 6, 5].map(value => ({ value, label: `${value}★` }))} values={p.filterStars} onChange={p.onFilterStarsChange} counts={p.facetCounts?.stars} dense /></div>
        <ClassChoices values={p.filterClasses} onChange={p.onFilterClassesChange} counts={p.facetCounts?.classes} inline />
        {p.showOwnershipFilter !== false && <div className="ml-auto"><OwnershipFilter showUnowned={p.showUnowned} onChange={p.onShowUnownedChange} inline /></div>}
      </div>

      {rules.length > 0 && <div className="pt-1">
        <div aria-label="Active filters" className="flex flex-wrap items-center gap-2">
          {rules.map(rule => <button key={rule.id} type="button" aria-label={`Remove ${rule.label} filter`} onClick={rule.remove} className={cn(
            "flex min-h-10 max-w-full items-center gap-3 rounded-lg border px-3 py-1.5 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 sm:min-h-9",
            rule.accent ? "border-sky-400/20 bg-sky-400/5 text-sky-100 hover:bg-sky-400/10" : "border-slate-800/80 bg-slate-950/35 text-slate-300 hover:bg-slate-800/60",
          )}><span className="min-w-0 break-words">{rule.label}</span><X className="h-3 w-3 shrink-0 opacity-50" /></button>)}
          <Button type="button" variant="ghost" onClick={() => clearSelections(p)} className="h-10 px-2 text-[11px] text-slate-500 hover:text-slate-200 sm:ml-auto sm:h-9">Clear all</Button>
        </div>
      </div>}

      <div id={panelId} hidden={!expanded || isMobile} className="space-y-3 border-t border-slate-800 pt-4">
        {(p.showRankFilter !== false || p.showAscensionFilter !== false) && <div className="flex flex-wrap gap-x-5 gap-y-2">
          {p.showRankFilter !== false && <ProgressionFilter label="Rank" options={[1, 2, 3, 4, 5, 6]} values={p.filterRanks} onChange={p.onFilterRanksChange} counts={p.facetCounts?.ranks} />}
          {p.showAscensionFilter !== false && <ProgressionFilter label="Ascension" options={[0, 1, 2, 3, 4, 5]} values={p.filterAscensionLevels} onChange={p.onFilterAscensionLevelsChange} counts={p.facetCounts?.ascension} />}
        </div>}
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <RosterFilterPicker label="Tags" icon={Tag} options={p.initialTags} counts={p.facetCounts?.tags} values={p.tagFilter} onChange={p.onTagFilterChange} logic={p.tagLogic} onLogicChange={p.onTagLogicChange} />
          <RosterFilterPicker label="Ability categories" icon={Layers} options={p.initialAbilityCategories} counts={p.facetCounts?.categories} values={p.abilityCategoryFilter} onChange={p.onAbilityCategoryFilterChange} logic={p.abilityCategoryLogic} onLogicChange={p.onAbilityCategoryLogicChange} />
          <RosterFilterPicker label="Abilities" icon={Zap} options={p.initialAbilities} counts={p.facetCounts?.abilities} values={p.abilityFilter} onChange={p.onAbilityFilterChange} logic={p.abilityLogic} onLogicChange={p.onAbilityLogicChange} />
          <RosterFilterPicker label={p.includeResistances ? "Immunities & resistances" : "Immunities"} triggerLabel="Protection" icon={Shield} options={p.initialImmunities} counts={p.facetCounts?.immunities} values={p.immunityFilter} onChange={p.onImmunityFilterChange} logic={p.immunityLogic} onLogicChange={p.onImmunityLogicChange} />
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          <SourceRefinement forms={p.effectForms} onFormsChange={p.onEffectFormsChange} directions={p.effectDirections} onDirectionsChange={p.onEffectDirectionsChange} formCounts={p.facetCounts?.forms} directionCounts={p.facetCounts?.directions} />
          <ImmunityRefinement includeResistances={p.includeResistances} onIncludeResistancesChange={p.onIncludeResistancesChange} minimum={p.minResistancePotency} onMinimumChange={p.onMinResistancePotencyChange} />
        </div>
      </div>
    </section>
    <RosterFilterSheet id={`${panelId}-mobile`} p={p} open={expanded && isMobile} onOpenChange={setExpanded} onReset={() => clearSelections(p)} hasFilters={rules.length > 0} onCloseFocus={() => (window.matchMedia("(max-width: 639px)").matches ? mobileFilterButton : desktopFilterButton).current?.focus()} />
    <p role="status" aria-live="polite" className="text-xs text-slate-400">{p.countLabel}</p>
  </div>;
}

function MoreFiltersButton({ expanded, panelId, count, onToggle, compact = false, buttonRef }: {
  expanded: boolean; panelId: string; count: number; onToggle: () => void; compact?: boolean; buttonRef?: Ref<HTMLButtonElement>;
}) {
  return <Button ref={buttonRef} type="button" variant="ghost" aria-label={count ? `More filters, ${count} active` : "More filters"} aria-haspopup={compact ? "dialog" : undefined} aria-expanded={expanded} aria-controls={panelId} onClick={onToggle} className={cn(
    "gap-2 bg-slate-800/50 text-xs text-slate-300 hover:bg-slate-800 hover:text-slate-100",
    compact ? "relative h-11 min-w-11 shrink-0 px-3" : "h-10 px-3",
    expanded && "bg-slate-800 text-slate-100",
  )}>
    <SlidersHorizontal className="h-4 w-4" />
    <span className={compact ? "hidden min-[375px]:inline" : undefined}>Filters</span>
    {count > 0 && <span className={cn("rounded bg-sky-400/15 px-1.5 text-[11px] text-sky-200", compact && "absolute -right-1 -top-1 min-w-4 bg-sky-900 px-1")}>{count}</span>}
    {!compact && (expanded ? <X className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
  </Button>;
}

function RosterSort({ p, compact = false }: { p: RosterFiltersProps; compact?: boolean }) {
  return <div className={cn("flex items-center gap-1", compact && "min-w-0 gap-0")}>
    <Select value={p.sortBy} onValueChange={value => p.onSortByChange(value as RosterSortField)}>
      <SelectTrigger aria-label="Sort champions by" className={cn("h-10 w-[112px] border-0 bg-transparent text-xs text-slate-400 shadow-none hover:bg-slate-800/40", compact && "h-11 min-w-0 flex-1 gap-1 px-2 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:shrink-0")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="NAME" className="min-h-11 sm:min-h-8">Name</SelectItem>
        <SelectItem value="RELEASE_DATE" className="min-h-11 sm:min-h-8">Release date</SelectItem>
        {p.showPrestigeSort !== false && <SelectItem value="PRESTIGE" className="min-h-11 sm:min-h-8">Prestige</SelectItem>}
      </SelectContent>
    </Select>
    <Button type="button" variant="ghost" size="icon" className={cn("h-10 w-8 text-slate-400", compact && "h-11 shrink-0")} aria-label={p.sortDirection === "ASC" ? "Sort descending" : "Sort ascending"} onClick={() => p.onSortDirectionChange(p.sortDirection === "ASC" ? "DESC" : "ASC")}>
      {p.sortDirection === "ASC" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
    </Button>
  </div>;
}

function RosterActions({ p, compact = false }: { p: RosterFiltersProps; compact?: boolean }) {
  const showAttackToggle = p.canManageAttackReservations && p.onShowAttackReservationControlsChange;
  if (p.canEdit === false && !showAttackToggle) return null;
  return <div className="flex shrink-0 items-center gap-2"><DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button type="button" variant="ghost" size="icon" aria-label="Roster actions" className={cn("h-10 w-10 shrink-0 text-slate-400", compact && "h-11 w-11", (p.viewMode === "edit" && p.canEdit !== false || showAttackToggle && p.showAttackReservationControls) && "bg-amber-500/10 text-amber-200")}><EllipsisVertical className="h-5 w-5" /></Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" collisionPadding={16} className="w-60 border-slate-800 bg-slate-950 text-slate-200">
      <DropdownMenuLabel className="text-[11px] font-medium text-slate-500">Roster actions</DropdownMenuLabel>
      {p.canEdit !== false && <>
        {compact && <DropdownMenuItem onSelect={p.onAddClick} className="min-h-11 gap-3 text-sky-300"><Plus className="h-4 w-4" />Add champion</DropdownMenuItem>}
        <DropdownMenuCheckboxItem checked={p.viewMode === "edit"} onCheckedChange={checked => p.onViewModeChange(checked ? "edit" : "view")} className="min-h-11 gap-3 pl-8"><PenLine className="h-4 w-4" />Edit roster</DropdownMenuCheckboxItem>
      </>}
      {showAttackToggle && <>
        {p.canEdit !== false && <DropdownMenuSeparator className="bg-slate-800" />}
        <DropdownMenuCheckboxItem checked={p.showAttackReservationControls ?? false} onCheckedChange={checked => p.onShowAttackReservationControlsChange?.(checked)} className="min-h-11 gap-3 pl-8"><Swords className="h-4 w-4" />Attack reservations</DropdownMenuCheckboxItem>
      </>}
    </DropdownMenuContent>
  </DropdownMenu>
    {!compact && p.canEdit !== false && <Button type="button" size="sm" aria-label="Add champion" onClick={p.onAddClick} className="h-10 gap-1.5 bg-sky-600 px-3 text-xs text-white hover:bg-sky-500"><Plus className="h-3.5 w-3.5" />Add</Button>}
  </div>;
}
