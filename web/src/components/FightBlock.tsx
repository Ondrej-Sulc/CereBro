import { useMemo } from "react";
import Image from "next/image";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ChampionCombobox } from "@/components/ChampionCombobox";
import { MultiChampionCombobox } from "@/components/MultiChampionCombobox";
import { NodeCombobox } from "@/components/NodeCombobox";
import {
  Swords,
  Shield,
  Skull,
  Diamond,
  X,
  UploadCloud,
  Video,
} from "lucide-react";
import { getChampionImageUrl } from "@/lib/championHelper";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { WarNode } from "@prisma/client";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { Champion } from "@/types/champion";
import { Input } from "./ui/input";

export interface FightData {
  id: string;
  nodeId: string;
  attackerId: string;
  defenderId: string;
  prefightChampionIds: string[];
  death: number;
  videoFile?: File | null;
  videoUrl?: string;
  battlegroup?: number;
}

interface FightBlockProps {
  fight: FightData;
  onFightChange: (fight: FightData) => void;
  onRemove: (fightId: string) => void;
  canRemove: boolean;
  initialChampions: Champion[];
  initialNodes: WarNode[];
  prefightChampions: Champion[];
  uploadMode: "single" | "multiple";
  sourceMode: "upload" | "link";
  errors?: Record<string, string>; // Add this line
}

export function FightBlock({
  fight,
  onFightChange,
  onRemove,
  canRemove,
  initialChampions,
  initialNodes,
  prefightChampions,
  uploadMode,
  sourceMode,
  errors,
}: FightBlockProps) {
  const selectedAttacker = useMemo(
    () => initialChampions.find((c) => String(c.id) === fight.attackerId),
    [initialChampions, fight.attackerId]
  );
  const selectedDefender = useMemo(
    () => initialChampions.find((c) => String(c.id) === fight.defenderId),
    [initialChampions, fight.defenderId]
  );

  const updateFight = (updates: Partial<FightData>) => {
    onFightChange({ ...fight, ...updates });
  };

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-slate-900/40 transition-all duration-300",
        fight.death
          ? "border-red-500/30 bg-red-950/10 shadow-[0_0_15px_-3px_rgba(239,68,68,0.1)]"
          : "border-slate-800/50 hover:border-slate-700/50 hover:shadow-lg hover:shadow-black/20"
      )}
    >
      {/* --- Header: Node & Actions --- */}
      <div className="flex items-center justify-between border-b border-slate-800/50 bg-slate-950/30 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Node
            </span>
            <div>
              <NodeCombobox
                nodes={initialNodes}
                value={fight.nodeId}
                onSelect={(val) => updateFight({ nodeId: val })}
                placeholder="#"
                className={cn(
                  "h-7 w-[80px] bg-slate-900 border-slate-700 text-sm font-bold",
                  errors?.[`nodeId-${fight.id}`] && "border-red-500"
                )}
              />
              {errors?.[`nodeId-${fight.id}`] && (
                <p className="text-xs text-red-400 mt-1">
                  {errors[`nodeId-${fight.id}`]}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Individual Video Input (Multiple Mode) - Moved to Header */}
          {uploadMode === "multiple" && (
            <div className="flex items-center gap-2 mr-2">
              {sourceMode === "upload" ? (
                <div className="flex items-center">
                  <Label
                    htmlFor={`videoFile-${fight.id}`}
                    className={cn(
                      "cursor-pointer flex items-center justify-center gap-2 h-7 px-3 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 transition-all text-xs text-slate-300",
                      errors?.[`videoFile-${fight.id}`] && "border-red-500"
                    )}
                  >
                    <UploadCloud className="h-3 w-3" />
                    <span className="truncate max-w-[100px]">
                      {fight.videoFile ? fight.videoFile.name : "Video"}
                    </span>
                  </Label>
                  <Input
                    id={`videoFile-${fight.id}`}
                    type="file"
                    accept="video/*"
                    onChange={(e) =>
                      updateFight({
                        videoFile: e.target.files ? e.target.files[0] : null,
                      })
                    }
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="relative">
                  <Video className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-sky-400 pointer-events-none" />
                  <Input
                    id={`videoUrl-${fight.id}`}
                    type="url"
                    value={fight.videoUrl || ""}
                    onChange={(e) => updateFight({ videoUrl: e.target.value })}
                    placeholder="Video URL..."
                    className={cn(
                      "h-7 w-[150px] pl-7 bg-slate-900 border-slate-700 text-xs",
                      errors?.[`videoUrl-${fight.id}`] && "border-red-500"
                    )}
                  />
                </div>
              )}
            </div>
          )}

          {canRemove && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-500 hover:bg-red-500/10 hover:text-red-400 -mr-2"
              onClick={() => onRemove(fight.id)}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Remove fight</span>
            </Button>
          )}
        </div>
      </div>
      <div className="p-4 space-y-4">
        {/* --- Matchup Section --- */}
        <div className="flex flex-col sm:flex-row items-center gap-2">
          {/* Attacker Card */}
          <div className="flex-1 flex items-center gap-2 w-full">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
              <Swords className="h-6 w-6 text-sky-400" />
            </div>
            <ChampionCombobox
              champions={initialChampions}
              value={fight.attackerId}
              onSelect={(val) => updateFight({ attackerId: val })}
              placeholder="Select attacker..."
              className={cn(
                "w-full bg-slate-950/50 border-slate-700/50",
                selectedAttacker &&
                  getChampionClassColors(selectedAttacker.class).text,
                errors?.[`attackerId-${fight.id}`] && "border-red-500",
                fight.attackerId && "font-bold text-base"
              )}
            />
            {errors?.[`attackerId-${fight.id}`] && (
              <p className="text-xs text-red-400 mt-1">
                {errors[`attackerId-${fight.id}`]}
              </p>
            )}
          </div>

          {/* VS Divider (Desktop) */}
          <div className="hidden sm:flex items-center justify-center px-1 text-slate-700 font-black text-xs italic opacity-50">
            VS
          </div>
          <hr className="w-full sm:hidden border-slate-700/50" />

          {/* Defender Card */}
          <div className="flex-1 flex items-center gap-2 w-full justify-end font-bold">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
              <Shield className="h-6 w-6 text-amber-500" />
            </div>
            <ChampionCombobox
              champions={initialChampions}
              value={fight.defenderId}
              onSelect={(val) => updateFight({ defenderId: val })}
              placeholder="Select defender..."
              className={cn(
                "w-full bg-slate-950/50 border-slate-700/50 text-right",
                selectedDefender &&
                  getChampionClassColors(selectedDefender.class).text,
                errors?.[`defenderId-${fight.id}`] && "border-red-500",
                fight.defenderId && "font-bold text-base"
              )}
            />
            {errors?.[`defenderId-${fight.id}`] && (
              <p className="text-xs text-red-400 mt-1">
                {errors[`defenderId-${fight.id}`]}
              </p>
            )}
          </div>
        </div>

        {/* --- Footer: Meta & Options --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 pt-2 border-t border-slate-800/50">
          {/* Left Column: Death Toggle */}
          <div className="flex flex-col gap-4 justify-start">
            <label
              className={cn(
                "flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-all h-full",
                fight.death > 0
                  ? "bg-red-500/10 border-red-500/30"
                  : "bg-slate-950/30 border-slate-800 hover:border-slate-700"
              )}
            >
              <div className="flex items-center gap-2">
                <Skull
                  className={cn(
                    "h-4 w-4",
                    fight.death > 0 ? "text-red-400" : "text-slate-500"
                  )}
                />
                <span
                  className={cn(
                    "text-sm font-medium",
                    fight.death > 0 ? "text-red-200" : "text-slate-400"
                  )}
                >
                  Deaths
                </span>
              </div>
              <Input
                type="number"
                min={0}
                value={fight.death}
                onChange={(e) => updateFight({ death: parseInt(e.target.value) || 0 })}
                className="w-16 h-8 text-sm bg-slate-900 border-slate-700"
              />
            </label>
          </div>

          {/* Right Column: Prefights */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-slate-400 flex items-center gap-1.5 shrink-0">
                <Diamond className="h-3 w-3 text-purple-400" />
                Prefights
              </Label>
              <MultiChampionCombobox
                champions={prefightChampions}
                values={fight.prefightChampionIds.map(id => parseInt(id))}
                onSelect={(val) =>
                  updateFight({ prefightChampionIds: val.map(id => String(id)) })
                }
                className="bg-slate-950/30 border-slate-800 rounded-md"
              />
            </div>
          </div>
        </div>
      </div>{" "}
    </div>
  );
}
