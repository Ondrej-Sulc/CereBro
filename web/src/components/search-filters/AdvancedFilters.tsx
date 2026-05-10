import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Check, ListFilter, Shield, Skull, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { SeasonMultiSelect } from "@/components/SeasonMultiSelect";
import { MemoizedSelect } from "@/components/MemoizedSelect";
import { AsyncPlayerCombobox } from "@/components/comboboxes/AsyncPlayerCombobox";
import { AsyncAllianceCombobox } from "@/components/comboboxes/AsyncAllianceCombobox";
import { Player, Alliance } from "@prisma/client";

type FightOutcomeFilter = "" | "solo" | "deaths";

interface AdvancedFiltersProps {
  // State
  selectedSeasons: number[];
  war: string;
  tier: string;
  player: string;
  alliance: string;
  battlegroup: string;
  outcome: FightOutcomeFilter;

  // Setters
  setSelectedSeasons: (val: number[]) => void;
  setWar: (val: string) => void;
  setTier: (val: string) => void;
  setPlayer: (val: string) => void;
  setAlliance: (val: string) => void;
  setBattlegroup: (val: string) => void;
  setOutcome: (val: FightOutcomeFilter) => void;

  // Data/Options
  availableSeasons: number[];
  warOptions: { value: string; label: string }[];
  tierOptions: { value: string; label: string }[];
  currentUser?: (Player & { alliance: Alliance | null }) | null;
}

export function AdvancedFilters({
  selectedSeasons,
  war,
  tier,
  player,
  alliance,
  battlegroup,
  outcome,
  setSelectedSeasons,
  setWar,
  setTier,
  setPlayer,
  setAlliance,
  setBattlegroup,
  setOutcome,
  availableSeasons,
  warOptions,
  tierOptions,
  currentUser,
}: AdvancedFiltersProps) {
  const allyName = currentUser?.alliance?.name; // Hoisted from IIFE

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(260px,0.75fr)_minmax(500px,1.35fr)_minmax(360px,1fr)] gap-4 p-4 bg-slate-900/90 border border-slate-800 rounded-xl shadow-lg animate-in slide-in-from-top-2 fade-in duration-200">
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Fight Result
        </h3>
        <div className="grid grid-cols-3 gap-1 bg-slate-950/60 border border-slate-800 rounded-md p-1 min-h-11">
          <button
            type="button"
            onClick={() => setOutcome("")}
            aria-pressed={!outcome}
            title="Show solos and death fights"
            className={cn(
              "flex items-center justify-center gap-1.5 rounded px-2 py-2 text-xs font-semibold transition-colors hover:bg-slate-800",
              !outcome
                ? "bg-cyan-600 text-white shadow-sm"
                : "text-slate-400"
            )}
          >
            <ListFilter className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">All</span>
          </button>
          <button
            type="button"
            onClick={() => setOutcome(outcome === "solo" ? "" : "solo")}
            aria-pressed={outcome === "solo"}
            title="Only fights with zero recorded deaths"
            className={cn(
              "flex items-center justify-center gap-1.5 rounded px-2 py-2 text-xs font-semibold transition-colors hover:bg-slate-800",
              outcome === "solo"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-400"
            )}
          >
            <Check className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Solo</span>
          </button>
          <button
            type="button"
            onClick={() => setOutcome(outcome === "deaths" ? "" : "deaths")}
            aria-pressed={outcome === "deaths"}
            title="Only fights with one or more recorded deaths"
            className={cn(
              "flex items-center justify-center gap-1.5 rounded px-2 py-2 text-xs font-semibold transition-colors hover:bg-slate-800",
              outcome === "deaths"
                ? "bg-red-600 text-white shadow-sm"
                : "text-slate-400"
            )}
          >
            <Skull className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Deaths</span>
          </button>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          War Context
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-[minmax(120px,1.35fr)_minmax(92px,0.8fr)_minmax(92px,0.8fr)_minmax(116px,1fr)] gap-3">
          <div className="space-y-1.5 col-span-2 md:col-span-1">
            <div className="h-5 flex items-center">
              <Label
                className={cn(
                  "text-[10px] font-medium uppercase tracking-wider transition-colors",
                  selectedSeasons.length > 0 ? "text-cyan-400" : "text-slate-500"
                )}
              >
                Seasons
              </Label>
            </div>
            <SeasonMultiSelect
              seasons={availableSeasons}
              selected={selectedSeasons}
              onChange={setSelectedSeasons}
              className="h-9 bg-slate-950/60 border-slate-800"
            />
          </div>
          <div className="space-y-1.5">
            <div className="h-5 flex items-center">
              <Label
                className={cn(
                  "text-[10px] font-medium uppercase tracking-wider transition-colors",
                  war ? "text-cyan-400" : "text-slate-500"
                )}
              >
                War #
              </Label>
            </div>
            <MemoizedSelect
              value={war}
              onValueChange={setWar}
              options={warOptions}
              placeholder="Any"
              className="h-9 bg-slate-950/60 border-slate-800"
              contentClassName="max-h-60"
            />
          </div>
          <div className="space-y-1.5">
            <div className="h-5 flex items-center">
              <Label
                className={cn(
                  "text-[10px] font-medium uppercase tracking-wider transition-colors",
                  tier ? "text-cyan-400" : "text-slate-500"
                )}
              >
                Tier
              </Label>
            </div>
            <MemoizedSelect
              value={tier}
              onValueChange={setTier}
              options={tierOptions}
              placeholder="Any"
              className="h-9 bg-slate-950/60 border-slate-800"
              contentClassName="max-h-60"
            />
          </div>
          <div className="space-y-1.5 col-span-2 md:col-span-1">
            <div className="h-5 flex items-center">
              <Label
                className={cn(
                  "text-[10px] font-medium uppercase tracking-wider transition-colors",
                  battlegroup ? "text-cyan-400" : "text-slate-500"
                )}
              >
                Battlegroup
              </Label>
            </div>
            <div className="flex items-center gap-1 bg-slate-950/60 border border-slate-800 rounded-md p-1 h-9">
              {[0, 1, 2, 3].map((bg) => (
                <button
                  key={bg}
                  onClick={() =>
                    setBattlegroup(
                      battlegroup === bg.toString() ? "" : bg.toString()
                    )
                  }
                  aria-pressed={battlegroup === bg.toString()}
                  className={cn(
                    "flex-1 h-full rounded text-[10px] font-medium transition-colors hover:bg-slate-800",
                    battlegroup === bg.toString()
                      ? "bg-cyan-600 text-white shadow-sm"
                      : "text-slate-400"
                  )}
                >
                  {bg === 0 ? "None" : bg}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-2 min-w-0">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          People & Alliance
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <div className="flex justify-between items-center h-5">
              <Label
                className={cn(
                  "text-[10px] font-medium uppercase tracking-wider transition-colors",
                  player ? "text-cyan-400" : "text-slate-500"
                )}
              >
                Player
              </Label>
              {currentUser?.ingameName && (
                <Button
                  variant={
                    player === currentUser.ingameName ? "secondary" : "ghost"
                  }
                  size="sm"
                  className="h-4 px-1.5 text-[9px]"
                  onClick={() =>
                    setPlayer(
                      player === currentUser.ingameName
                        ? ""
                        : currentUser.ingameName
                    )
                  }
                >
                  <User className="h-2.5 w-2.5 mr-1" /> Me
                </Button>
              )}
            </div>
            <AsyncPlayerCombobox
              value={player}
              onSelect={setPlayer}
              className="h-9 bg-slate-950/60 border-slate-800"
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between items-center h-5">
              <Label
                className={cn(
                  "text-[10px] font-medium uppercase tracking-wider transition-colors",
                  alliance ? "text-cyan-400" : "text-slate-500"
                )}
              >
                Alliance
              </Label>
              {allyName && (
                <Button
                  variant={alliance === allyName ? "secondary" : "ghost"}
                  size="sm"
                  className="h-4 px-1.5 text-[9px]"
                  onClick={() =>
                    setAlliance(alliance === allyName ? "" : allyName)
                  }
                >
                  <Shield className="h-2.5 w-2.5 mr-1" /> My Ally
                </Button>
              )}
            </div>
            <AsyncAllianceCombobox
              value={alliance}
              onSelect={setAlliance}
              className="h-9 bg-slate-950/60 border-slate-800"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
