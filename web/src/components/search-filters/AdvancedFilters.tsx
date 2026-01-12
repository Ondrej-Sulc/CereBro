import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { User, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { SeasonMultiSelect } from "@/components/SeasonMultiSelect";
import { MemoizedSelect } from "@/components/MemoizedSelect";
import { AsyncPlayerCombobox } from "@/components/comboboxes/AsyncPlayerCombobox";
import { AsyncAllianceCombobox } from "@/components/comboboxes/AsyncAllianceCombobox";
import { Player, Alliance } from "@prisma/client";

interface AdvancedFiltersProps {
  // State
  selectedSeasons: number[];
  war: string;
  tier: string;
  player: string;
  alliance: string;
  battlegroup: string;

  // Setters
  setSelectedSeasons: (val: number[]) => void;
  setWar: (val: string) => void;
  setTier: (val: string) => void;
  setPlayer: (val: string) => void;
  setAlliance: (val: string) => void;
  setBattlegroup: (val: string) => void;

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
  setSelectedSeasons,
  setWar,
  setTier,
  setPlayer,
  setAlliance,
  setBattlegroup,
  availableSeasons,
  warOptions,
  tierOptions,
  currentUser,
}: AdvancedFiltersProps) {
  const allyName = currentUser?.alliance?.name; // Hoisted from IIFE

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 p-4 bg-slate-900/90 border border-slate-800 rounded-xl shadow-lg animate-in slide-in-from-top-2 fade-in duration-200">
      <div className="space-y-1.5 col-span-2 sm:col-span-1">
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
          )}{" "}
        </div>{" "}
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
        </div>{" "}
        <AsyncAllianceCombobox
          value={alliance}
          onSelect={setAlliance}
          className="h-9 bg-slate-950/60 border-slate-800"
        />
      </div>
      <div className="space-y-1.5">
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
              {bg === 0 ? "Solo" : bg}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
