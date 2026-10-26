"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Trophy } from "lucide-react";
import type { AllianceRosterEntry } from "@/app/actions/alliance-roster";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RosterFilters } from "@/app/profile/roster/components/roster-filters";
import { QuickChampionDialog } from "@/app/profile/roster/components/quick-champion-dialog";
import { allianceRosterOptions, createAllianceRosterFilterIndex, createAllianceRosterFilters, filterAllianceRosterWithFacets, type AllianceBattlegroupFilter } from "@/lib/alliance-roster-filter";
import type { RosterFiltersState } from "@/lib/roster-filtering";
import { getRosterAscensionLevel } from "@/lib/roster-ascension-filter";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { getChampionImageUrlOrPlaceholder } from "@/lib/championHelper";
import { cn } from "@/lib/utils";

type ClientPageProps = { data: AllianceRosterEntry[]; bgColors: Record<number, string> };

export function AllianceRosterMatrix({ data, bgColors }: ClientPageProps) {
  const [filters, setFilters] = useState(createAllianceRosterFilters);
  const [battlegroup, setBattlegroup] = useState<AllianceBattlegroupFilter>("ALL");
  const [limit, setLimit] = useState<number | null>(10);
  const [preview, setPreview] = useState<AllianceRosterEntry | null>(null);
  const index = useMemo(() => createAllianceRosterFilterIndex(data), [data]);
  const options = useMemo(() => allianceRosterOptions(data), [data]);
  const result = useMemo(() => filterAllianceRosterWithFacets(index, filters, battlegroup, limit), [index, filters, battlegroup, limit]);
  const updateFilter = <K extends keyof RosterFiltersState>(key: K, value: RosterFiltersState[K]) => setFilters(current => ({ ...current, [key]: value }));
  const players = useMemo(() => [...new Map(data.map(entry => [entry.playerId, {
    id: entry.playerId, name: entry.ingameName, bg: entry.battlegroup, avatar: entry.avatar,
  }])).values()].sort((a, b) => (a.bg ?? 9) - (b.bg ?? 9) || a.name.localeCompare(b.name)), [data]);
  const groupedByBg = new Map<string, typeof players>([["1", []], ["2", []], ["3", []], ["unassigned", []]]);
  for (const player of players) {
    if (result.championsByPlayer.get(player.id)?.length) groupedByBg.get(player.bg?.toString() ?? "unassigned")?.push(player);
  }
  const visibleCount = [...result.championsByPlayer.values()].reduce((total, champions) => total + champions.length, 0);
  const playerCount = result.championsByPlayer.size;
  const countLabel = `${visibleCount < result.entries.length ? `Showing ${visibleCount} of ${result.entries.length} matching` : visibleCount} champions across ${playerCount} ${playerCount === 1 ? "player" : "players"}`;

  return <div className="w-full space-y-6 px-4 py-6">
    <div className="space-y-2">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Alliance Roster Overview</h1>
      <p className="text-sm text-slate-400">Browse and filter rosters across the alliance.</p>
    </div>

    <RosterFilters
      search={filters.search} onSearchChange={value => updateFilter("search", value)}
      canEdit={false} showOwnershipFilter={false} showSort={false}
      visibleChampionCount={visibleCount} countLabel={countLabel} facetCounts={result.counts}
      contextControls={<AllianceScopeControls battlegroup={battlegroup} onBattlegroupChange={setBattlegroup} limit={limit} onLimitChange={setLimit} />}
      additionalRules={battlegroup === "ALL" ? [] : [{ id: "battlegroup", label: battlegroup === "UNASSIGNED" ? "Unassigned players" : `Battlegroup ${battlegroup}`, remove: () => setBattlegroup("ALL") }]}
      onClearAdditionalFilters={() => setBattlegroup("ALL")}
      filterStars={filters.stars} onFilterStarsChange={value => updateFilter("stars", value)}
      filterRanks={filters.ranks} onFilterRanksChange={value => updateFilter("ranks", value)}
      filterAscensionLevels={filters.ascension} onFilterAscensionLevelsChange={value => updateFilter("ascension", value)}
      filterClasses={filters.classes} onFilterClassesChange={value => updateFilter("classes", value)}
      tagFilter={filters.tags} onTagFilterChange={value => updateFilter("tags", value)}
      tagLogic={filters.tagLogic} onTagLogicChange={value => updateFilter("tagLogic", value)}
      abilityCategoryFilter={filters.categories} onAbilityCategoryFilterChange={value => updateFilter("categories", value)}
      abilityCategoryLogic={filters.categoryLogic ?? "OR"} onAbilityCategoryLogicChange={value => updateFilter("categoryLogic", value)}
      abilityFilter={filters.abilities} onAbilityFilterChange={value => updateFilter("abilities", value)}
      abilityLogic={filters.abilityLogic ?? "AND"} onAbilityLogicChange={value => updateFilter("abilityLogic", value)}
      effectForms={[...(filters.effectForms ?? [])]} onEffectFormsChange={value => updateFilter("effectForms", value)}
      effectDirections={[...(filters.effectDirections ?? [])]} onEffectDirectionsChange={value => updateFilter("effectDirections", value)}
      immunityFilter={filters.immunities} onImmunityFilterChange={value => updateFilter("immunities", value)}
      immunityLogic={filters.immunityLogic ?? "AND"} onImmunityLogicChange={value => updateFilter("immunityLogic", value)}
      includeResistances={filters.includeResistances !== false} onIncludeResistancesChange={value => updateFilter("includeResistances", value)}
      minResistancePotency={filters.minResistancePotency ?? null} onMinResistancePotencyChange={value => updateFilter("minResistancePotency", value)}
      initialTags={options.tags} initialAbilityCategories={options.categories} initialAbilities={options.abilities} initialImmunities={options.immunities}
    />

    <div aria-label="Alliance roster results" className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/20">
      {playerCount === 0 && <p className="p-8 text-center text-sm text-slate-400" role="status">No champions match the current filters.</p>}
      {[...groupedByBg].map(([bg, members]) => {
        if (!members.length) return null;
        const accent = bg === "unassigned" ? undefined : bgColors[Number(bg)];
        return <section key={bg} aria-label={bg === "unassigned" ? "Unassigned players" : `Battlegroup ${bg}`}>
          <div className="flex items-center justify-between border-y border-slate-800 bg-slate-900/80 px-4 py-2" style={accent ? { borderLeft: `3px solid ${accent}` } : undefined}>
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-400" style={{ color: accent }}>{bg === "unassigned" ? "Unassigned" : `Battlegroup ${bg}`}</h2>
            <span className="text-[10px] text-slate-500">{members.length} {members.length === 1 ? "player" : "players"}</span>
          </div>
          {members.map(player => <div key={player.id} className="flex flex-col border-b border-slate-800/50 transition-colors hover:bg-slate-900/40 sm:flex-row">
            <div className="flex shrink-0 items-center gap-2 border-b border-slate-800/50 bg-slate-900/30 p-2 sm:w-[140px] sm:border-b-0 sm:border-r">
              <Avatar className="h-7 w-7 shrink-0 border border-slate-700"><AvatarImage src={player.avatar ?? undefined} /><AvatarFallback className="text-[10px]">{player.name.substring(0, 2).toUpperCase()}</AvatarFallback></Avatar>
              <div className="min-w-0">
                <Link href={`/player/${player.id}`} className="block truncate text-[11px] font-bold text-slate-200 transition-colors hover:text-sky-400">{player.name}</Link>
                <p className="text-[10px] text-slate-500">{result.championsByPlayer.get(player.id)!.length < result.matchingByPlayer.get(player.id)! ? `${result.championsByPlayer.get(player.id)!.length} of ` : ""}{result.matchingByPlayer.get(player.id)} matches</p>
              </div>
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap content-start items-start gap-2 p-2">
              {result.championsByPlayer.get(player.id)!.map(champion => <AllianceChampion key={champion.id} entry={champion} playerName={player.name} onOpen={() => setPreview(champion)} />)}
            </div>
          </div>)}
        </section>;
      })}
    </div>
    {preview && <QuickChampionDialog key={preview.id} item={preview} open onOpenChange={open => { if (!open) setPreview(null); }} filters={filters} showUnownedState={false} />}
  </div>;
}

function AllianceScopeControls({ battlegroup, onBattlegroupChange, limit, onLimitChange }: {
  battlegroup: AllianceBattlegroupFilter; onBattlegroupChange: (value: AllianceBattlegroupFilter) => void;
  limit: number | null; onLimitChange: (value: number | null) => void;
}) {
  return <>
    <div className="min-w-0 space-y-1 sm:w-40">
      <p className="text-[11px] text-slate-500">Battlegroup</p>
      <Select value={battlegroup} onValueChange={value => onBattlegroupChange(value as AllianceBattlegroupFilter)}>
        <SelectTrigger aria-label="Battlegroup" className="h-11 w-full border-slate-800 bg-slate-950/40 text-xs text-slate-300"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="ALL">All battlegroups</SelectItem>{[1, 2, 3].map(bg => <SelectItem key={bg} value={String(bg)}>Battlegroup {bg}</SelectItem>)}<SelectItem value="UNASSIGNED">Unassigned</SelectItem></SelectContent>
      </Select>
    </div>
    <div className="min-w-0 space-y-1 sm:w-40">
      <p className="text-[11px] text-slate-500">Champions per player</p>
      <Select value={limit === null ? "ALL" : String(limit)} onValueChange={value => onLimitChange(value === "ALL" ? null : Number(value))}>
        <SelectTrigger aria-label="Champions per player" className="h-11 w-full border-slate-800 bg-slate-950/40 text-xs text-slate-300"><SelectValue /></SelectTrigger>
        <SelectContent>{[5, 10, 20].map(count => <SelectItem key={count} value={String(count)}>Top {count}</SelectItem>)}<SelectItem value="ALL">All matches</SelectItem></SelectContent>
      </Select>
    </div>
  </>;
}

function AllianceChampion({ entry, playerName, onOpen }: { entry: AllianceRosterEntry; playerName: string; onOpen: () => void }) {
  const colors = getChampionClassColors(entry.champion.class);
  const ascension = getRosterAscensionLevel(entry);
  return <button type="button" data-roster-entry-id={entry.id} aria-label={`View ${entry.champion.name} for ${playerName}`} title={entry.champion.name} onClick={onOpen}
    className="group flex shrink-0 flex-col items-center gap-1 rounded transition-transform hover:z-10 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400">
    <span className={cn("relative block h-12 w-12 overflow-hidden rounded border bg-slate-900", colors.border)}>
      <Image src={getChampionImageUrlOrPlaceholder(entry.champion.images, "64")} alt="" fill sizes="48px" className="object-cover" />
      <span className="absolute left-0 top-0 flex flex-col gap-0.5 p-0.5">{entry.tactics.attack && <span className="h-1.5 w-1.5 rounded-full bg-red-500 ring-1 ring-black/50" title="Attack Tactic" />}{entry.tactics.defense && <span className="h-1.5 w-1.5 rounded-full bg-sky-500 ring-1 ring-black/50" title="Defense Tactic" />}</span>
      {ascension > 0 && <Trophy aria-label="Ascended" className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 text-yellow-400" />}
    </span>
    <span className="whitespace-nowrap text-[9px] font-bold leading-none text-slate-300"><span className="text-yellow-500">{entry.stars}★</span> R{entry.rank}{entry.stars === 7 && ascension > 0 && <span className="text-amber-400"> A{ascension}</span>}{entry.isAwakened && entry.sigLevel > 0 ? ` S${entry.sigLevel}` : ""}</span>
  </button>;
}
