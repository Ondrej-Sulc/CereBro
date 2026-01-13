"use client";

import { Filter, ChevronDown, ChevronUp, Video, X } from "lucide-react";
import { ChampionCombobox } from "@/components/comboboxes/ChampionCombobox";
import { Champion } from "@/types/champion";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Player, Alliance } from "@prisma/client";
import { useSearchFilters } from "@/hooks/use-search-filters";
import { ActiveFilterChips } from "@/components/search-filters/ActiveFilterChips";
import { AdvancedFilters } from "@/components/search-filters/AdvancedFilters";

interface SearchFiltersProps {
  champions: Champion[];
  availableSeasons: number[];
  currentUser?: (Player & { alliance: Alliance | null }) | null;
}

export function SearchFilters({
  champions,
  availableSeasons,
  currentUser,
}: SearchFiltersProps) {
  const { state, setters, computed } = useSearchFilters({
    champions,
  });

  const {
    mapType,
    attackerId,
    defenderId,
    node,
    hasVideo,
    showAdvanced,
    selectedSeasons,
    war,
    tier,
    player,
    alliance,
    battlegroup,
  } = state;

  const {
    setMapType,
    setAttackerId,
    setDefenderId,
    setNode,
    setHasVideo,
    setShowAdvanced,
    clearAll,
    setSelectedSeasons,
    setWar,
    setTier,
    setPlayer,
    setAlliance,
    setBattlegroup,
  } = setters;

  const {
    isPending,
    activeAdvancedCount,
    activeFilters,
    warOptions,
    tierOptions,
  } = computed;

  const hasAnyMainFilter = attackerId || defenderId || node || hasVideo || activeAdvancedCount > 0;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 w-full max-w-[1600px] mx-auto transition-opacity duration-200",
        isPending && "opacity-70 pointer-events-none"
      )}
    >
      {/* Main Active Toolbar */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center gap-2 p-2 bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-xl shadow-sm">
        {/* Top Row / Left Side: Map & Node */}
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 w-full lg:flex lg:w-auto lg:gap-1">
          <div className="flex bg-slate-950/50 p-1 rounded-lg border border-slate-800 h-10 w-full lg:w-36 shrink-0 relative">
            <button
              onClick={() => setMapType("STANDARD")}
              aria-pressed={mapType !== "BIG_THING"}
              className={cn(
                "flex-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all duration-200 z-10",
                mapType !== "BIG_THING"
                  ? "bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400/50"
                  : "text-slate-500 hover:text-slate-300"
              )}
            >
              Standard
            </button>
            <button
              onClick={() => setMapType("BIG_THING")}
              aria-pressed={mapType === "BIG_THING"}
              className={cn(
                "flex-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all duration-200 z-10",
                mapType === "BIG_THING"
                  ? "bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400/50"
                  : "text-slate-500 hover:text-slate-300"
              )}
            >
              Big Thing
            </button>
          </div>

          <div className="relative w-20 lg:w-24 shrink-0">
            <Input
              placeholder="#"
              value={node}
              onChange={(e) => setNode(e.target.value)}
              className="h-10 bg-slate-950/50 border-slate-800 text-center font-mono placeholder:text-slate-600 pl-8"
            />
            <span className="absolute top-1/2 left-2 -translate-y-1/2 text-[9px] font-bold text-slate-500 pointer-events-none uppercase tracking-wider">
              NODE
            </span>
          </div>

          <Button
            variant={hasVideo ? "default" : "outline"}
            size="icon"
            onClick={() => setHasVideo(!hasVideo)}
            className={cn(
              "h-10 w-10 shrink-0 lg:order-last transition-all duration-200",
              hasVideo
                ? "bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400/50 border-transparent"
                : "bg-slate-950/50 border-slate-800 text-slate-400 hover:text-white"
            )}
            title="Toggle Video Only"
          >
            <Video className={cn("h-4 w-4", hasVideo && "fill-current")} />
          </Button>
        </div>

        {/* Middle: Champions */}
        <div className="flex flex-1 items-center gap-2 w-full">
          <div className="flex-1 min-w-[140px]">
            <ChampionCombobox
              champions={champions}
              value={attackerId}
              onSelect={setAttackerId}
              placeholder="Attacker..."
              className="h-10 bg-slate-950/50 border-slate-800 w-full rounded-full"
            />
          </div>

          <span className="text-slate-600 font-bold text-xs">VS</span>

          <div className="flex-1 min-w-[140px]">
            <ChampionCombobox
              champions={champions}
              value={defenderId}
              onSelect={setDefenderId}
              placeholder="Defender..."
              className="h-10 bg-slate-950/50 border-slate-800 w-full rounded-full"
            />
          </div>
        </div>

        {/* Right: Expand & Clear */}
        <div
          className={cn(
            "grid gap-2 w-full lg:flex lg:w-auto lg:justify-end",
            hasAnyMainFilter ? "grid-cols-2" : "grid-cols-1"
          )}
        >
          {/* Clear Filters (Only show if any filter is active) */}
          {hasAnyMainFilter && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="h-10 px-2 text-slate-400 hover:text-red-400 w-full lg:w-auto"
            >
              <X className="h-4 w-4 mr-1" />
              <span className="inline">Clear</span>
            </Button>
          )}

          <Button
            variant={
              showAdvanced || activeAdvancedCount > 0 ? "secondary" : "ghost"
            }
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={cn(
              "h-10 gap-2 min-w-[100px] transition-all w-full lg:w-auto",
              showAdvanced || activeAdvancedCount > 0
                ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 hover:text-cyan-300"
                : "text-slate-400 hover:text-white"
            )}
          >
            <Filter className="h-4 w-4" />
            <span>Filters</span>
            {activeAdvancedCount > 0 && (
              <Badge
                variant="secondary"
                className="h-5 px-1.5 min-w-[1.25rem] bg-cyan-500/20 text-cyan-300 border-0 pointer-events-none"
              >
                {activeAdvancedCount}
              </Badge>
            )}
            {showAdvanced ? (
              <ChevronUp className="h-3 w-3 ml-auto" />
            ) : (
              <ChevronDown className="h-3 w-3 ml-auto" />
            )}
          </Button>
        </div>
      </div>

      {/* Active Filters List */}
      <ActiveFilterChips activeFilters={activeFilters} />

      {/* Secondary / Advanced Filters */}
      {showAdvanced && (
        <AdvancedFilters
          selectedSeasons={selectedSeasons}
          war={war}
          tier={tier}
          player={player}
          alliance={alliance}
          battlegroup={battlegroup}
          setSelectedSeasons={setSelectedSeasons}
          setWar={setWar}
          setTier={setTier}
          setPlayer={setPlayer}
          setAlliance={setAlliance}
          setBattlegroup={setBattlegroup}
          availableSeasons={availableSeasons}
          warOptions={warOptions}
          tierOptions={tierOptions}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}