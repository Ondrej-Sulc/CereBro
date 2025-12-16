import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { ChampionCombobox } from "@/components/comboboxes/ChampionCombobox";
import { MultiChampionCombobox } from "@/components/comboboxes/MultiChampionCombobox";
import { NodeCombobox } from "@/components/comboboxes/NodeCombobox";
import {
  Swords,
  Shield,
  Skull,
  X,
  UploadCloud,
  Video,
  Trophy,
} from "lucide-react";
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
  errors?: Record<string, string>;
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
        "group relative overflow-hidden rounded-xl border bg-slate-900/40 backdrop-blur-sm transition-all duration-300",
        fight.death > 0
          ? "border-red-500/30 bg-red-950/10 shadow-[0_0_15px_-3px_rgba(239,68,68,0.1)]"
          : "border-white/5 hover:border-white/10 hover:shadow-lg hover:shadow-black/20"
      )}
    >
      {/* Header Row: Node & Actions */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 bg-slate-950/30">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Node
          </span>
          <NodeCombobox
            nodes={initialNodes}
            value={fight.nodeId}
            onSelect={(val) => updateFight({ nodeId: val })}
            placeholder="#"
            className={cn(
              "h-5 w-[50px] bg-transparent border-0 p-0 text-sm font-black text-sky-400 focus:ring-0 placeholder:text-slate-700 text-left",
              errors?.[`nodeId-${fight.id}`] && "text-red-400 placeholder:text-red-900"
            )}
          />
        </div>
        
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-slate-500 hover:bg-red-500/10 hover:text-red-400 rounded-full"
            onClick={() => onRemove(fight.id)}
          >
            <X className="h-3.5 w-3.5" />
            <span className="sr-only">Remove fight</span>
          </Button>
        )}
      </div>

      <div className="p-3 sm:p-4 space-y-4">
        {/* Main Matchup Row */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
          
          {/* Attacker */}
          <div className="flex flex-col gap-1">
            <Label className="uppercase text-[9px] font-bold tracking-widest text-slate-500 flex items-center gap-1.5 pl-1">
              <Swords className="h-3 w-3 text-sky-500" />
              Attacker
            </Label>
            <ChampionCombobox
              champions={initialChampions}
              value={fight.attackerId}
              onSelect={(val) => updateFight({ attackerId: val })}
              placeholder="Select Attacker..."
              className={cn(
                "w-full bg-slate-950/50 border-white/5 hover:border-white/10 transition-colors h-10 sm:h-12 text-sm sm:text-base",
                selectedAttacker && getChampionClassColors(selectedAttacker.class).text,
                errors?.[`attackerId-${fight.id}`] && "border-red-500/50 bg-red-500/5",
                fight.attackerId && "font-bold shadow-inner"
              )}
            />
          </div>

          {/* VS Badge */}
          <div className="flex flex-col items-center justify-center pt-4">
            <div className="h-6 w-6 rounded-full bg-slate-800/50 flex items-center justify-center border border-white/5 shadow-inner">
               <span className="text-[9px] font-black italic text-slate-600">VS</span>
            </div>
          </div>

          {/* Defender */}
          <div className="flex flex-col gap-1">
            <Label className="uppercase text-[9px] font-bold tracking-widest text-slate-500 flex items-center justify-end gap-1.5 pr-1">
              Defender
              <Shield className="h-3 w-3 text-amber-500" />
            </Label>
            <ChampionCombobox
              champions={initialChampions}
              value={fight.defenderId}
              onSelect={(val) => updateFight({ defenderId: val })}
              placeholder="Select Defender..."
              className={cn(
                "w-full bg-slate-950/50 border-white/5 hover:border-white/10 transition-colors h-10 sm:h-12 text-sm sm:text-base text-right",
                selectedDefender && getChampionClassColors(selectedDefender.class).text,
                errors?.[`defenderId-${fight.id}`] && "border-red-500/50 bg-red-500/5",
                fight.defenderId && "font-bold shadow-inner"
              )}
            />
          </div>
        </div>

        {/* Secondary Details Row (Outcome & Prefights) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          
          {/* Outcome / Deaths */}
          <div className="flex items-center">
             <div className={cn(
               "flex items-center gap-1 px-2 py-1.5 rounded-md border transition-all duration-300 w-full h-[38px]",
               fight.death > 0 
                 ? "bg-red-950/20 border-red-500/30 text-red-200" 
                 : "bg-emerald-950/10 border-emerald-500/20 text-emerald-400"
             )}>
                <div className="flex items-center gap-2 flex-1">
                  {fight.death === 0 ? (
                    <Trophy className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Skull className="h-3.5 w-3.5 text-red-400" />
                  )}
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-wider",
                    fight.death === 0 ? "text-emerald-500" : "text-red-400"
                  )}>
                    {fight.death === 0 ? "SOLO" : `${fight.death} Death${fight.death > 1 ? 's' : ''}`}
                  </span>
                </div>
                
                <div className="flex items-center gap-0.5 bg-slate-950/30 rounded p-0.5 border border-white/5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 rounded hover:bg-white/10 text-slate-400 hover:text-white"
                    onClick={() => updateFight({ death: Math.max(0, fight.death - 1) })}
                    disabled={fight.death <= 0}
                  >
                    -
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 rounded hover:bg-white/10 text-slate-400 hover:text-white"
                    onClick={() => updateFight({ death: fight.death + 1 })}
                  >
                    +
                  </Button>
                </div>
             </div>
          </div>

          {/* Prefights */}
          <div>
             <MultiChampionCombobox
              champions={prefightChampions}
              values={fight.prefightChampionIds.map(id => parseInt(id))}
              onSelect={(val) =>
                updateFight({ prefightChampionIds: val.map(id => String(id)) })
              }
              className="bg-slate-950/30 border-white/5 hover:border-white/10 h-[38px] text-xs w-full"
              placeholder="Select Prefights..."
            />
          </div>
        </div>

        {/* Individual Video Input (Multiple Mode Only) */}
        {uploadMode === "multiple" && (
          <div className="pt-1">
            {sourceMode === "upload" ? (
              <div className="relative group/upload shadow-lg shadow-fuchsia-950/50">
                <Label
                  htmlFor={`videoFile-${fight.id}`}
                  className={cn(
                    "flex items-center justify-center gap-2 h-9 w-full rounded-md bg-slate-800/30 hover:bg-slate-800/50 border border-dashed border-slate-700 hover:border-sky-500 transition-all cursor-pointer",
                    errors?.[`videoFile-${fight.id}`] && "border-red-500 bg-red-500/5"
                  )}
                >
                  <UploadCloud className="h-3.5 w-3.5 text-slate-400 group-hover/upload:text-sky-400 transition-colors" />
                  <span className={cn("text-xs font-medium text-slate-400 group-hover/upload:text-sky-400 transition-colors truncate max-w-[200px]", fight.videoFile && "text-sky-400")}>
                    {fight.videoFile ? fight.videoFile.name : "Upload Fight Video"}
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
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Video className="h-3.5 w-3.5 text-sky-500" />
                </div>
                <Input
                  id={`videoUrl-${fight.id}`}
                  type="url"
                  value={fight.videoUrl || ""}
                  onChange={(e) => updateFight({ videoUrl: e.target.value })}
                  placeholder="Paste YouTube URL..."
                  className={cn(
                    "h-9 pl-9 bg-slate-950/30 border-white/5 text-xs focus:border-fuchsia-500/50 placeholder:text-slate-600 rounded-md shadow-lg shadow-fuchsia-950/50",
                    errors?.[`videoUrl-${fight.id}`] && "border-red-500"
                  )}
                />
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
