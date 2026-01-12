import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MemoizedSelect } from "@/components/MemoizedSelect";
import { CreatablePlayerCombobox } from "./CreatablePlayerCombobox";
import { FlipToggle } from "@/components/ui/flip-toggle";
import { Map, Flag, CalendarDays, Hash, Eye, Users, Globe } from "lucide-react";
import { PreFilledFight } from "../hooks/useWarVideoForm"; // Or define locally/in types file

interface Option {
  value: string;
  label: string;
}

interface WarContextSectionProps {
  mapType: string;
  setMapType: (type: string) => void;
  isOffseason: boolean;
  setIsOffseason: (isOff: boolean) => void;
  playerInVideoId: string;
  customPlayerName: string;
  handlePlayerChange: (value: string, isCustom: boolean) => void;
  playerOptions: Option[];
  preFilledFights: PreFilledFight[] | null;
  battlegroup: string;
  setBattlegroup: (bg: string) => void;
  battlegroupOptions: Option[];
  errors: Record<string, string>;
  season: string;
  setSeason: (s: string) => void;
  warNumber: string;
  setWarNumber: (wn: string) => void;
  warNumberOptions: Option[];
  warTier: string;
  setWarTier: (wt: string) => void;
  warTierOptions: Option[];
  visibility: "public" | "alliance";
  setVisibility: (v: "public" | "alliance") => void;
  description: string;
  setDescription: (d: string) => void;
  // New props
  contextMode: "alliance" | "global";
  setContextMode: (mode: "alliance" | "global") => void;
  hasAlliance: boolean;
}

export function WarContextSection({
  mapType,
  setMapType,
  isOffseason,
  setIsOffseason,
  playerInVideoId,
  customPlayerName,
  handlePlayerChange,
  playerOptions,
  preFilledFights,
  battlegroup,
  setBattlegroup,
  battlegroupOptions,
  errors,
  season,
  setSeason,
  warNumber,
  setWarNumber,
  warNumberOptions,
  warTier,
  setWarTier,
  warTierOptions,
  visibility,
  setVisibility,
  description,
  setDescription,
  contextMode,
  setContextMode,
  hasAlliance,
}: WarContextSectionProps) {
  return (
    <div className="glass rounded-xl border border-slate-800/50 p-4 sm:p-6 space-y-6 bg-slate-900/50 bg-gradient-to-br from-teal-950/50 via-slate-950/50 to-slate-900/50">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
        <Map className="h-5 w-5 text-sky-400" />
        War Context
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Context Mode Toggle (Only if user has alliance) */}
        {hasAlliance && (
          <div className="flex flex-col">
            <Label className="text-sm font-medium text-slate-300 mb-2">Upload Context</Label>
            <FlipToggle
              value={contextMode === "global"}
              onChange={(val) => setContextMode(val ? "global" : "alliance")}
              leftLabel="My Alliance"
              rightLabel="Global / Solo"
              leftIcon={<Users className="h-4 w-4" />}
              rightIcon={<Globe className="h-4 w-4" />}
              className="flex-1"
            />
          </div>
        )}

        {/* Map Type Flip Toggle */}
        <div className="flex flex-col">
          <Label className="text-sm font-medium text-slate-300 mb-2">Map Type</Label>
          <FlipToggle
            value={mapType === "BIG_THING"}
            onChange={(value) => setMapType(value ? "BIG_THING" : "STANDARD")}
            leftLabel="Standard"
            rightLabel="Big Thing"
            leftIcon={<Map className="h-4 w-4" />}
            rightIcon={<Flag className="h-4 w-4" />}
            className="flex-1"
          />
        </div>

        {/* Offseason Toggle - Hide if Global (implied) */}
        {contextMode === "alliance" && (
          <div className="flex flex-col">
            <Label className="text-sm font-medium text-slate-300 mb-2">War Status</Label>
            <FlipToggle
              value={isOffseason}
              onChange={setIsOffseason}
              leftLabel="Active War"
              rightLabel="Offseason"
              leftIcon={<CalendarDays className="h-4 w-4" />}
              rightIcon={<Hash className="h-4 w-4" />}
              className="flex-1"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Player In Video */}
        <div>
          <Label htmlFor="playerInVideo" className="text-sm font-medium text-slate-300 mb-2 block">Player in Video</Label>
          <CreatablePlayerCombobox
            value={playerInVideoId}
            customValue={customPlayerName}
            onChange={handlePlayerChange}
            options={playerOptions}
            disabled={!!preFilledFights}
          />
        </div>

        {/* Battlegroup - Hide if Global */}
        {contextMode === "alliance" && (
          <div>
            <Label htmlFor="battlegroup" className="text-sm font-medium text-slate-300 mb-2 block">Battlegroup</Label>
            <MemoizedSelect
              value={battlegroup}
              onValueChange={setBattlegroup}
              placeholder="Select BG..."
              options={battlegroupOptions}
              required
              disabled={!!preFilledFights}
            />
            {errors.battlegroup && (
              <p className="text-sm text-red-400 mt-2">{errors.battlegroup}</p>
            )}
          </div>
        )}

        {/* Season */}
        <div>
          <Label htmlFor="season" className="text-sm font-medium text-slate-300 mb-2 block">Season</Label>
          <Input
            id="season"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            required
            className="bg-slate-900/50 border-slate-700/50"
            disabled={!!preFilledFights}
          />
          {errors.season && (
            <p className="text-sm text-red-400 mt-2">{errors.season}</p>
          )}
        </div>

        {/* War Number - Hide if Global */}
        {contextMode === "alliance" && (
          <div>
            <Label htmlFor="warNumber" className="text-sm font-medium text-slate-300 mb-2 block">War Number</Label>
            <MemoizedSelect
              value={warNumber}
              onValueChange={setWarNumber}
              placeholder="Select number..."
              options={warNumberOptions}
              required={!isOffseason}
              disabled={isOffseason || !!preFilledFights}
              contentClassName="max-h-60 overflow-y-auto"
            />
            {errors.warNumber && (
              <p className="text-sm text-red-400 mt-2">{errors.warNumber}</p>
            )}
          </div>
        )}

        {/* War Tier */}
        <div>
          <Label htmlFor="warTier" className="text-sm font-medium text-slate-300 mb-2 block">War Tier</Label>
          <MemoizedSelect
            value={warTier}
            onValueChange={setWarTier}
            placeholder="Select tier..."
            options={warTierOptions}
            required
            contentClassName="max-h-60 overflow-y-auto"
            disabled={!!preFilledFights}
          />
          {errors.warTier && (
            <p className="text-sm text-red-400 mt-2">{errors.warTier}</p>
          )}
        </div>

        {/* Visibility - Hide completely if Global */}
        {contextMode === "alliance" && (
          <div>
            <Label className="text-sm font-medium text-slate-300 mb-2 block">Visibility</Label>
            <FlipToggle
              value={visibility === "alliance"}
              onChange={(value) => setVisibility(value ? "alliance" : "public")}
              leftLabel="Public"
              rightLabel="Alliance Only"
              leftIcon={<Eye className="h-4 w-4" />}
              rightIcon={<Users className="h-4 w-4" />}
              className="flex-1"
            />
          </div>
        )}
      </div>

      {/* Video Description */}
      <div>
        <Label htmlFor="description" className="text-sm font-medium text-slate-300 mb-2 block">Video Description (Optional)</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add any relevant details about the fight, prefights used, etc."
          className="bg-slate-900/50 border-slate-700/50 min-h-[80px]"
        />
      </div>
    </div>
  );
}
