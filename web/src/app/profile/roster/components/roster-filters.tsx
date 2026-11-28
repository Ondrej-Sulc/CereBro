"use client";

import { useId, useRef, useState, type Ref, type ReactNode } from "react";
import { Search, PenLine, Plus, Zap, Shield, Tag, X, Swords, ArrowUp, ArrowDown, ArrowUpNarrowWide, ArrowDownWideNarrow, ChevronDown, SlidersHorizontal, Layers } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ChampionClass } from "@prisma/client";
import type { RosterSortField, SortDirection } from "../types";
import type { EffectForm, EffectDirection } from "@cerebro/core/domain/ability-source";
import { AscensionEligibilityFilter, ChampionScopeFilter, ChoiceGroup, ClassChoices, MobileClassFilter, OwnedOnlyFilter, OwnershipFilter, ProgressionFilter, SourceRefinement, ImmunityRefinement } from "./roster-filter-fields";
import { RosterFilterPicker } from "./roster-filter-picker";
import { RosterFilterSheet, useMobileRosterFilters } from "./roster-filter-sheet";
import { buildActiveFilterRules, type RosterFilterRule } from "./roster-filter-rules";
import type { RosterEffectOption, ProtectionOption } from "@/lib/roster-kit-options";
import type { RosterFacetCounts } from "@/lib/roster-filtering";
import type { ChampionScope } from "@/lib/champion-catalog-scope";

export interface RosterFiltersProps {
    flat?: boolean;
    facetCounts?: RosterFacetCounts;
    championScope?: ChampionScope;
    onChampionScopeChange?: (value: ChampionScope) => void;
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
    ascensionEligible: boolean;
    onAscensionEligibleChange: (value: boolean) => void;
    catalogEligibility?: boolean;
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
  p.onChampionScopeChange?.("playable");
  p.onSearchChange("");
  p.onFilterStarsChange([]);
  p.onFilterClassesChange([]);
  p.onAscensionEligibleChange(false);
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
    + p.effectForms.length + p.effectDirections.length + Number(p.ascensionEligible && !p.catalogEligibility)
    + Number(!p.includeResistances) + Number(p.includeResistances && p.minResistancePotency != null)
    + (p.showRankFilter !== false ? p.filterRanks.length : 0)
    + (p.showAscensionFilter !== false ? p.filterAscensionLevels.length : 0)
    + Number(p.championScope !== undefined && p.championScope !== "playable");
  const showOwnership = p.showOwnershipFilter !== false;
  const showSort = p.showSort !== false;
  const showScope = Boolean(p.onChampionScopeChange);
  const scopeFilter = p.onChampionScopeChange && <ChampionScopeFilter value={p.championScope ?? "playable"} onChange={p.onChampionScopeChange} quick={p.flat} />;
  const ownedToggle = showOwnership && <OwnedOnlyFilter showUnowned={p.showUnowned} onChange={p.onShowUnownedChange} />;

  return <div className="space-y-3">
    <section aria-label="Champion filters" className={p.flat ? "space-y-2" : "space-y-2 rounded-xl bg-slate-900/40 p-3 sm:space-y-4 sm:p-4"}>
      <div className="flex items-center gap-2 sm:flex-wrap sm:gap-3">
        <div className={cn("relative min-w-0 flex-1 sm:min-w-[220px]", p.flat && "sm:max-w-[320px]")}>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input aria-label="Search champions" placeholder="Search champions…" value={p.search} onChange={event => p.onSearchChange(event.target.value)} className="h-11 border-slate-800/80 bg-slate-950/40 pl-10 pr-9 text-base shadow-none placeholder:text-slate-500 focus-visible:ring-sky-500 sm:text-sm" />
          {p.search && <Button type="button" variant="ghost" size="icon" onClick={() => p.onSearchChange("")} aria-label="Clear champion search" className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-slate-400 hover:text-white"><X className="h-3.5 w-3.5" /></Button>}
        </div>
        {p.flat && (showScope || showOwnership) && <div className="hidden flex-wrap items-center gap-2 sm:flex">
          {scopeFilter}
          {ownedToggle}
        </div>}
        {hasRosterActions && <div className="sm:hidden"><RosterActions p={p} compact /></div>}
        <div className="ml-auto hidden items-center gap-2 sm:flex">
          {p.contextControls && <div className="flex items-center gap-2 [&>div>p]:sr-only">{p.contextControls}</div>}
          {showSort && <RosterSort p={p} />}
          <MoreFiltersButton expanded={expanded} panelId={panelId} count={advancedCount} onToggle={() => setExpanded(!expanded)} buttonRef={desktopFilterButton} />
          <RosterActions p={p} />
        </div>
      </div>

      <div className="flex items-center gap-2 sm:hidden">
        <ChoiceGroup label="Rarity" options={[7, 6, 5].map(value => ({ value, label: `${value}★` }))} values={p.filterStars} onChange={p.onFilterStarsChange} counts={p.facetCounts?.stars} compact />
        <MobileClassFilter values={p.filterClasses} onChange={p.onFilterClassesChange} counts={p.facetCounts?.classes} />
        <MoreFiltersButton expanded={expanded} panelId={`${panelId}-mobile`} count={advancedCount} onToggle={() => setExpanded(!expanded)} compact buttonRef={mobileFilterButton} />
      </div>
      {(showScope || p.catalogEligibility || showOwnership || showSort) && <div className={cn(
        "items-center sm:hidden",
        p.flat ? "flex flex-wrap gap-x-1.5 gap-y-2" : cn(
          "grid gap-1 border-t border-slate-800/60 pt-1",
          (showScope || p.catalogEligibility || showOwnership) && showSort ? "grid-cols-2" : "grid-cols-[minmax(0,180px)]",
          !showScope && !p.catalogEligibility && !showOwnership && "justify-end",
        ),
      )}>
        {scopeFilter}
        {p.catalogEligibility && <div><AscensionEligibilityFilter value={p.ascensionEligible} onChange={p.onAscensionEligibleChange} /></div>}
        {showOwnership && (p.flat ? ownedToggle : <OwnershipFilter showUnowned={p.showUnowned} onChange={p.onShowUnownedChange} compact />)}
        {showSort && <RosterSort p={p} compact />}
      </div>}
      {p.contextControls && <div className="grid grid-cols-2 items-end gap-3 border-t border-slate-800/60 pt-3 sm:hidden">{p.contextControls}</div>}
      {(editing || reserving) && <div aria-label="Active roster modes" className="flex flex-wrap gap-1 border-t border-slate-800/60 pt-2">
        {editing && <Button type="button" variant="ghost" onClick={() => p.onViewModeChange("view")} className="h-10 gap-2 bg-amber-500/10 px-3 text-xs text-amber-200"><PenLine className="h-3.5 w-3.5" />Done editing<X className="h-3 w-3" /></Button>}
        {reserving && <Button type="button" variant="ghost" onClick={() => p.onShowAttackReservationControlsChange?.(false)} className="h-10 gap-2 bg-amber-500/10 px-3 text-xs text-amber-200"><Swords className="h-3.5 w-3.5" />Attack reservations on<X className="h-3 w-3" /></Button>}
      </div>}

      <div className="hidden flex-wrap items-center gap-x-4 gap-y-2 sm:flex">
        <div className="flex items-center gap-2"><span className="hidden text-[11px] text-slate-500 xl:inline">Rarity</span><ChoiceGroup label="Rarity" options={[7, 6, 5].map(value => ({ value, label: `${value}★` }))} values={p.filterStars} onChange={p.onFilterStarsChange} counts={p.facetCounts?.stars} dense />
          {p.catalogEligibility && <AscensionEligibilityFilter value={p.ascensionEligible} onChange={p.onAscensionEligibleChange} />}
        </div>
        <ClassChoices values={p.filterClasses} onChange={p.onFilterClassesChange} counts={p.facetCounts?.classes} inline />
        {!p.flat && scopeFilter}
        {!p.flat && showOwnership && <div className="ml-auto"><OwnershipFilter showUnowned={p.showUnowned} onChange={p.onShowUnownedChange} inline /></div>}
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
        {!p.catalogEligibility && <div className="flex flex-wrap items-center gap-x-5 gap-y-2">

          {p.showRankFilter !== false && <ProgressionFilter label="Rank" options={[1, 2, 3, 4, 5, 6]} values={p.filterRanks} onChange={p.onFilterRanksChange} counts={p.facetCounts?.ranks} />}
          {p.showAscensionFilter !== false && <ProgressionFilter label="Ascension level" options={[0, 1, 2, 3, 4, 5]} values={p.filterAscensionLevels} onChange={p.onFilterAscensionLevelsChange} counts={p.facetCounts?.ascension} />}
          <AscensionEligibilityFilter value={p.ascensionEligible} onChange={p.onAscensionEligibleChange} />
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

const sortFields = {
  NAME: { label: "Name", ASC: "A to Z", DESC: "Z to A" },
  RELEASE_DATE: { label: "Release date", ASC: "Oldest first", DESC: "Newest first" },
  PRESTIGE: { label: "Prestige", ASC: "Lowest first", DESC: "Highest first" },
} satisfies Record<RosterSortField, Record<"label" | SortDirection, string>>;

function RosterSort({ p, compact = false }: { p: RosterFiltersProps; compact?: boolean }) {
  const ascending = p.sortDirection === "ASC";
  const nextDirection = ascending ? "DESC" : "ASC";
  const field = sortFields[p.sortBy];
  const reverseLabel = p.flat ? `Reverse sort to ${field[nextDirection]}` : ascending ? "Sort descending" : "Sort ascending";
  const DirectionIcon = p.flat
    ? (ascending ? ArrowUpNarrowWide : ArrowDownWideNarrow)
    : (ascending ? ArrowUp : ArrowDown);

  return <div
    role={p.flat ? "group" : undefined}
    aria-label={p.flat ? "Champion sorting" : undefined}
    className={cn("flex items-center", (p.flat || compact) ? "gap-0" : "gap-1", compact && "min-w-0", compact && p.flat && "ml-auto")}
  >
    <Select value={p.sortBy} onValueChange={value => p.onSortByChange(value as RosterSortField)}>
      <SelectTrigger
        aria-label={p.flat ? `Sort by ${field.label}, ${field[p.sortDirection]}` : "Sort champions by"}
        className={cn(
          "h-10 w-[112px] text-xs shadow-none",
          p.flat
            ? "rounded-l-lg rounded-r-none border-r-0 border-slate-700 bg-slate-900 font-semibold text-slate-200 hover:bg-slate-800 focus:z-10 focus:ring-indigo-300/60 focus:ring-offset-0"
            : "border-0 bg-transparent text-slate-400 hover:bg-slate-800/40",
          compact && "h-11 min-w-0 flex-1 gap-1 px-2 [&>svg]:size-3 [&>svg]:shrink-0",
          compact && p.flat && "w-auto",
        )}
      >
        <SelectValue>{p.flat ? field.label : undefined}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="NAME" className="min-h-11 sm:min-h-8">{sortFields.NAME.label}</SelectItem>
        <SelectItem value="RELEASE_DATE" className="min-h-11 sm:min-h-8">{sortFields.RELEASE_DATE.label}</SelectItem>
        {p.showPrestigeSort !== false && <SelectItem value="PRESTIGE" className="min-h-11 sm:min-h-8">{sortFields.PRESTIGE.label}</SelectItem>}
      </SelectContent>
    </Select>
    <Button
      type="button"
      variant={p.flat ? "outline" : "ghost"}
      size="icon"
      className={cn(
        "h-10",
        p.flat ? "w-9 rounded-l-none rounded-r-lg border-slate-700 bg-slate-900 text-indigo-200 shadow-none hover:bg-slate-800 hover:text-indigo-100 focus-visible:z-10 focus-visible:ring-indigo-300" : "w-8 text-slate-400",
        compact && "h-11 shrink-0",
      )}
      aria-label={reverseLabel}
      title={p.flat ? reverseLabel : undefined}
      onClick={() => p.onSortDirectionChange(nextDirection)}
    >
      <DirectionIcon className="size-4" aria-hidden="true" />
    </Button>
  </div>;
}

function RosterActions({ p, compact = false }: { p: RosterFiltersProps; compact?: boolean }) {
  const showAttackToggle = p.canManageAttackReservations && p.onShowAttackReservationControlsChange;
  if (p.canEdit === false && !showAttackToggle) return null;
  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button type="button" size="sm" aria-label="Edit roster" className={cn("h-10 shrink-0 gap-1.5 bg-sky-600 px-3 text-xs text-white hover:bg-sky-500", compact && "h-11", (p.viewMode === "edit" && p.canEdit !== false || showAttackToggle && p.showAttackReservationControls) && "bg-amber-500/10 text-amber-200 hover:bg-amber-500/20")}><PenLine aria-hidden="true" className="h-3.5 w-3.5" />Edit<ChevronDown aria-hidden="true" className="h-3.5 w-3.5" /></Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" collisionPadding={16} className="w-60 border-slate-800 bg-slate-950 text-slate-200">
      <DropdownMenuLabel className="text-[11px] font-medium text-slate-500">Roster actions</DropdownMenuLabel>
      {p.canEdit !== false && <>
        <DropdownMenuItem inset onSelect={p.onAddClick} className="min-h-11 gap-3"><Plus className="h-4 w-4" />Add champion</DropdownMenuItem>
        <DropdownMenuCheckboxItem checked={p.viewMode === "edit"} onCheckedChange={checked => p.onViewModeChange(checked ? "edit" : "view")} className="min-h-11 gap-3 pl-8"><PenLine className="h-4 w-4" />Edit roster</DropdownMenuCheckboxItem>
      </>}
      {showAttackToggle && <>
        {p.canEdit !== false && <DropdownMenuSeparator className="bg-slate-800" />}
        <DropdownMenuCheckboxItem checked={p.showAttackReservationControls ?? false} onCheckedChange={checked => p.onShowAttackReservationControlsChange?.(checked)} className="min-h-11 gap-3 pl-8"><Swords className="h-4 w-4" />Attack reservations</DropdownMenuCheckboxItem>
      </>}
    </DropdownMenuContent>
  </DropdownMenu>;
}
