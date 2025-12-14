"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { WarDefensePlacement, WarTactic, WarMapType } from "@prisma/client";
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

interface ChampionWithTags extends Champion {
  tags?: { name: string }[];
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
}: DefenseEditorProps) {
  const [defenderId, setDefenderId] = useState<number | undefined>(currentPlacement?.defenderId || undefined);
  const [playerId, setPlayerId] = useState<string | undefined>(currentPlacement?.playerId || undefined);
  const [starLevel, setStarLevel] = useState<number | undefined>(currentPlacement?.starLevel || undefined);
  
  const [isDefenderOpen, setIsDefenderOpen] = useState(false);

  const isReady = !!(currentPlacement?.id || dbNodeId);

  // Check for tactic matches
  const defenderTacticMatch = useMemo(() => {
      const tactic = activeTactic;
      if (!defenderId || !tactic?.defenseTag?.name) return false;
      const def = champions.find(c => c.id === defenderId) as ChampionWithTags | undefined;
      return def?.tags?.some(t => t.name === tactic.defenseTag!.name) ?? false;
  }, [defenderId, activeTactic, champions]);

  // Filter active modifiers
  const activeModifiers = useMemo(() => {
    if (!currentPlacement?.node?.allocations) return [];
    
    // For defense plans, we show ALL possible modifiers for this map type or filter loosely?
    // Since plans are not tied to a season/tier, we probably should show everything valid for the map.
    // Or maybe just show nothing for now as that logic is tied to Season/Tier.
    // Actually, allocations store minTier/maxTier. 
    // Maybe we just show all modifiers that match the MapType?
    
    return currentPlacement.node.allocations.filter(alloc => {
        // Only filter by MapType as Plan doesn't enforce Tier/Season yet
        return alloc.mapType === mapType;
    }).map(a => a.nodeModifier);
  }, [currentPlacement?.node?.allocations, mapType]);

  // Load initial state when placement changes
  useEffect(() => {
    const newDefenderId = currentPlacement?.defenderId || undefined;
    setDefenderId(prev => prev !== newDefenderId ? newDefenderId : prev);

    const newPlayerId = currentPlacement?.playerId || undefined;
    setPlayerId(prev => prev !== newPlayerId ? newPlayerId : prev);

    const newStarLevel = currentPlacement?.starLevel || undefined;
    setStarLevel(prev => prev !== newStarLevel ? newStarLevel : prev);
    
    if (currentPlacement && !currentPlacement.defenderId) {
        setIsDefenderOpen(true);
    } else {
        setIsDefenderOpen(false);
    }
  }, [currentPlacement]);

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
      let filtered = players.filter(p => p.battlegroup === currentBattlegroup);
      
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
              <div className="flex flex-col gap-1">
                  <ChampionCombobox
                    champions={champions}
                    value={defenderId !== undefined ? String(defenderId) : ""}
                    onSelect={handleDefenderChange}
                    open={isDefenderOpen}
                    onOpenChange={setIsDefenderOpen}
                    disabled={!isReady}
                  />
                  {defenderTacticMatch && (
                      <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1">
                          <Badge variant="outline" className="border-indigo-500 text-indigo-400 bg-indigo-500/10 text-[10px] px-1.5 py-0 h-5">
                              Tactic: {activeTactic?.defenseTag?.name}
                          </Badge>
                      </div>
                  )}
              </div>
            </div>
          </div>

          {/* Star Level */}
          <div className="grid grid-cols-4 items-center gap-4">
             <Label htmlFor="starLevel" className="text-right">Stars</Label>
             <div className="col-span-3">
                 <Select 
                    value={starLevel ? String(starLevel) : undefined} 
                    onValueChange={handleStarLevelChange} 
                    disabled={!isReady || !defenderId}
                 >
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select stars..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="7">7 <Star className="h-3 w-3 inline text-yellow-500" /></SelectItem>
                        <SelectItem value="6">6 <Star className="h-3 w-3 inline text-yellow-500" /></SelectItem>
                        <SelectItem value="5">5 <Star className="h-3 w-3 inline text-yellow-500" /></SelectItem>
                    </SelectContent>
                 </Select>
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
                disabled={!isReady}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}