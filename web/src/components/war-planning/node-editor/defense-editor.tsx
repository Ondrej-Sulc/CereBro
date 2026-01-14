"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { WarDefensePlacement, WarMapType, WarNodeAllocation, NodeModifier } from "@prisma/client";
import { Champion } from "@/types/champion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ChampionCombobox } from "@/components/comboboxes/ChampionCombobox";
import { PlayerCombobox } from "@/components/comboboxes/PlayerCombobox";
import { X, Star } from "lucide-react";
import { PlayerWithRoster, PlacementWithNode } from "@cerebro/core/data/war-planning/types";
import { ActiveModifiers } from "./active-modifiers";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { WarTacticWithTags } from "../hooks/use-war-planning";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

interface ChampionWithTags extends Champion {
  tags?: { name: string }[];
}

export interface WarNodeWithAllocations {
  allocations: (WarNodeAllocation & { nodeModifier: NodeModifier })[];
}

interface DefenseEditorProps {
  onClose: () => void;
  planId: string;
  nodeId: number | null;
  dbNodeId?: number;
  currentPlacement: PlacementWithNode | null;
  onSave: (updatedPlacement: Partial<WarDefensePlacement>) => void;
  champions: Champion[];
  players: PlayerWithRoster[];
  onNavigate?: (direction: number) => void;
  activeTactic?: WarTacticWithTags | null;
  mapType: WarMapType;
  currentBattlegroup: number;
  tier?: number | null;
  nodeData?: WarNodeWithAllocations;
  isReadOnly?: boolean;
  bgPlacements?: PlacementWithNode[];
}

export default function DefenseEditor({
  onClose,
  planId,
  nodeId,
  dbNodeId,
  currentPlacement,
  onSave,
  champions,
  players,
  onNavigate,
  activeTactic,
  mapType,
  currentBattlegroup,
  tier,
  nodeData,
  isReadOnly = false,
  bgPlacements = [],
}: DefenseEditorProps) {
  const [defenderId, setDefenderId] = useState<number | undefined>(currentPlacement?.defenderId || undefined);
  const [playerId, setPlayerId] = useState<string | undefined>(currentPlacement?.playerId || undefined);
  const [starLevel, setStarLevel] = useState<number | undefined>(currentPlacement?.starLevel || undefined);
  
  const [isDefenderOpen, setIsDefenderOpen] = useState(false);

  const isReady = !!(currentPlacement?.id || dbNodeId);

  // Duplicate Check for Current Selection
  const duplicateWarning = useMemo(() => {
      if (!defenderId) return null;
      
      const duplicates = bgPlacements.filter(p => 
          p.defenderId === defenderId && 
          p.nodeId !== (currentPlacement?.nodeId || dbNodeId) // Exclude self
      );

      if (duplicates.length > 0) {
          return duplicates.map(p => p.node.nodeNumber);
      }
      return null;
  }, [defenderId, bgPlacements, currentPlacement, dbNodeId]);


  // Check for tactic matches
  const defenderTacticMatch = useMemo(() => {
      const tactic = activeTactic;
      if (!defenderId || !tactic?.defenseTag?.name) return false;
      const def = champions.find(c => c.id === defenderId) as ChampionWithTags | undefined;
      return def?.tags?.some(t => t.name === tactic.defenseTag!.name) ?? false;
  }, [defenderId, activeTactic, champions]);


  // Filter active modifiers
  const activeModifiers = useMemo(() => {
    if (!nodeData?.allocations) return [];
    
    return nodeData.allocations.filter(alloc => {
        // 1. Map Type Check
        if (alloc.mapType !== mapType) return false;

        // 2. Tier Check (if selected)
        if (tier) {
             const satisfiesMin = alloc.minTier ? tier >= alloc.minTier : true;
             const satisfiesMax = alloc.maxTier ? tier <= alloc.maxTier : true;
             return satisfiesMin && satisfiesMax;
        }

        return true;
    }).map(a => a.nodeModifier);
  }, [nodeData, mapType, tier]);

  // Sync state with props during render
  const [prevPlacement, setPrevPlacement] = useState(currentPlacement);
  if (currentPlacement !== prevPlacement) {
    setPrevPlacement(currentPlacement);
    
    const newDefenderId = currentPlacement?.defenderId || undefined;
    if (newDefenderId !== defenderId) setDefenderId(newDefenderId);

    const newPlayerId = currentPlacement?.playerId || undefined;
    if (newPlayerId !== playerId) setPlayerId(newPlayerId);

    const newStarLevel = currentPlacement?.starLevel || undefined;
    if (newStarLevel !== starLevel) setStarLevel(newStarLevel);
    
    if (currentPlacement && !currentPlacement.defenderId) {
        setIsDefenderOpen(true);
    } else {
        setIsDefenderOpen(false);
    }
  }

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
            return;
        }

        const COLUMNS = mapType === WarMapType.BIG_THING ? 5 : 9;

        if (e.key === 'ArrowRight') {
            onNavigate?.(1);
        } else if (e.key === 'ArrowLeft') {
            onNavigate?.(-1);
        } else if (e.key === 'ArrowUp') {
            onNavigate?.(COLUMNS);
        } else if (e.key === 'ArrowDown') {
            onNavigate?.(-COLUMNS);
        }

    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNavigate, mapType]);

  // Sort Players: Alphabetical, filtered by BG
  const availablePlayers = useMemo(() => {
      const filtered = players.filter(p => p.battlegroup === currentBattlegroup);
      
      // Ensure currently assigned player is in the list
      if (playerId) {
          const assigned = players.find(p => p.id === playerId);
          if (assigned && !filtered.includes(assigned)) {
              filtered.push(assigned);
          }
      }

      return filtered.sort((a, b) => a.ingameName.localeCompare(b.ingameName));
  }, [players, currentBattlegroup, playerId]);

  // Helper to trigger save
  const triggerSave = useCallback((updates: Partial<Pick<WarDefensePlacement, 'defenderId' | 'playerId' | 'starLevel'>>) => {
    if (nodeId === null) return;
    
    // Use the actual DB Node ID from currentPlacement OR the prop dbNodeId
    const targetDbNodeId = currentPlacement?.nodeId || dbNodeId;

    if (!currentPlacement?.id && !targetDbNodeId) {
        console.error("Cannot save: Missing placement context (ID or DB Node ID)");
        return;
    }

    const payload = {
      id: currentPlacement?.id,
      planId,
      nodeId: targetDbNodeId,
      ...updates
    };

    onSave(payload);
  }, [currentPlacement, planId, nodeId, dbNodeId, onSave]);

  const handleDefenderChange = useCallback((idStr: string) => {
    const val = idStr ? parseInt(idStr) : undefined;
    setDefenderId(val);
    
    // Auto-detect star level from player roster if possible
    let newStarLevel = starLevel;
    if (val && playerId) {
        const player = players.find(p => p.id === playerId);
        const rosterEntry = player?.roster.find(r => r.championId === val);
        if (rosterEntry) {
            newStarLevel = rosterEntry.stars;
            setStarLevel(newStarLevel);
        }
    }

    triggerSave({ defenderId: val === undefined ? null : val, starLevel: newStarLevel ?? null });
  }, [triggerSave, playerId, players, starLevel]);

  const handlePlayerChange = useCallback((val: string | undefined) => {
    setPlayerId(val);

    // Auto-detect star level if defender is already selected
    let newStarLevel = starLevel;
    if (val && defenderId) {
        const player = players.find(p => p.id === val);
        const rosterEntry = player?.roster.find(r => r.championId === defenderId);
        if (rosterEntry) {
             newStarLevel = rosterEntry.stars;
             setStarLevel(newStarLevel);
        }
    }

    triggerSave({ playerId: val === undefined ? null : val, starLevel: newStarLevel ?? null });
  }, [triggerSave, defenderId, players, starLevel]);

  const handleStarLevelChange = useCallback((val: string) => {
      const num = parseInt(val);
      setStarLevel(num);
      triggerSave({ starLevel: num });
  }, [triggerSave]);


  // Get relevant roster entries
  const rosterEntries = useMemo(() => {
      if (!playerId || !defenderId) return [];
      const player = players.find(p => p.id === playerId);
      return player?.roster.filter(r => r.championId === defenderId).sort((a, b) => b.stars - a.stars) || [];
  }, [playerId, defenderId, players]);

  if (nodeId === null) return null;

  return (
    <div className="flex flex-col h-full bg-slate-950 border-l border-slate-800">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg">Node {nodeId}</h3>
            <ActiveModifiers modifiers={activeModifiers} />
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid gap-4">
          
          {/* Defender */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="defender" className="text-right">Defender</Label>
            <div className="col-span-3">
              <div className="flex flex-col gap-2">
                  <ChampionCombobox
                    champions={champions}
                    value={defenderId !== undefined ? String(defenderId) : ""}
                    onSelect={handleDefenderChange}
                    open={!isReadOnly && isDefenderOpen}
                    onOpenChange={(val) => !isReadOnly && setIsDefenderOpen(val)}
                    disabled={isReadOnly || !isReady}
                  />
                  
                  {/* Tactic Badge */}
                  {defenderTacticMatch && (
                      <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1">
                          <Badge variant="outline" className="border-indigo-500 text-indigo-400 bg-indigo-500/10 text-[10px] px-1.5 py-0 h-5">
                              Tactic: {activeTactic?.defenseTag?.name}
                          </Badge>
                      </div>
                  )}

                  {/* Duplicate Warning */}
                  {duplicateWarning && (
                      <Alert variant="destructive" className="py-2 px-3">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle className="text-xs font-bold ml-2">Duplicate Defender</AlertTitle>
                          <AlertDescription className="text-xs ml-2">
                              Already placed on Node(s): {duplicateWarning.join(", ")}
                          </AlertDescription>
                      </Alert>
                  )}
              </div>
            </div>
          </div>

          {/* Player */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="player" className="text-right">Player</Label>
            <div className="col-span-3">
              <PlayerCombobox
                players={availablePlayers}
                value={playerId}
                onSelect={handlePlayerChange}
                disabled={isReadOnly || !isReady}
                attackerId={defenderId} 
              />
            </div>
          </div>

          {/* Star Level & Rank Info */}
          <div className="grid grid-cols-4 items-start gap-4">
             <Label htmlFor="starLevel" className="text-right pt-2">Stats</Label>
             <div className="col-span-3 flex flex-col gap-3">
                 {/* Roster-based Options */}
                 {rosterEntries.length > 0 && (
                     <div className="flex flex-wrap gap-2">
                         {rosterEntries.map(entry => (
                             <Button
                                key={entry.stars}
                                variant={starLevel === entry.stars ? "default" : "outline"}
                                size="sm"
                                onClick={() => !isReadOnly && handleStarLevelChange(String(entry.stars))}
                                className={cn(
                                    "h-auto py-2 px-3 flex flex-col items-start gap-0.5",
                                    starLevel === entry.stars ? "border-indigo-500 bg-indigo-500/20 text-white hover:bg-indigo-500/30" : "bg-slate-900 border-slate-700",
                                    isReadOnly && "cursor-default opacity-80"
                                )}
                                disabled={isReadOnly}
                             >
                                 <div className="flex items-center gap-1 text-xs font-bold">
                                    {entry.stars}<Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                                    <span className="text-slate-300 font-normal ml-1">R{entry.rank}</span>
                                 </div>
                                 {(entry.isAscended || entry.isAwakened) && (
                                    <div className="flex gap-1 text-[10px] text-slate-400">
                                        {entry.isAwakened && <span className="text-slate-200">Awakened</span>}
                                        {entry.isAscended && <span className="text-amber-400">Ascended</span>}
                                    </div>
                                 )}
                             </Button>
                         ))}
                     </div>
                 )}

                 {/* Manual Fallback */}
                 {rosterEntries.length === 0 && (
                     <Select 
                        value={starLevel ? String(starLevel) : undefined} 
                        onValueChange={handleStarLevelChange} 
                        disabled={isReadOnly || !isReady || !defenderId}
                     >
                        <SelectTrigger className="w-full h-8 text-xs bg-slate-900 border-slate-800">
                            <SelectValue placeholder="Manual Star Level..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7">7-Star</SelectItem>
                            <SelectItem value="6">6-Star</SelectItem>
                            <SelectItem value="5">5-Star</SelectItem>
                        </SelectContent>
                     </Select>
                 )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}