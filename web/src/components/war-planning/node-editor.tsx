"use client";

import { useState, useEffect, useCallback, useMemo, useRef, memo } from "react";
import { WarFight, Player, WarNode } from "@prisma/client";
import { Champion } from "@/types/champion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ChampionCombobox } from "@/components/ChampionCombobox";
import { MultiChampionCombobox } from "@/components/MultiChampionCombobox";
import { getHistoricalCounters, HistoricalFightStat } from "@/app/planning/history-actions";
import { getChampionImageUrl } from "@/lib/championHelper";
import { PlayCircle, Users, X, ChevronDown, Settings2, ChevronRight, Swords, Skull, Info } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { WarNodeAllocation, NodeModifier, War, WarTactic, ChampionClass } from "@prisma/client";

// Extended Player type to include roster info
export type PlayerWithRoster = Player & {
  roster: {
    championId: number;
    stars: number;
    rank: number;
    isAscended: boolean;
    isAwakened: boolean;
  }[];
};

// ... existing imports

interface NodeEditorProps {
  onClose: () => void;
  warId: string;
  battlegroup: number;
  nodeId: number | null;
  currentFight: FightWithNode | null;
  onSave: (updatedFight: Partial<WarFight> & { prefightChampionIds?: number[] }) => void;
  champions: Champion[];
  players: PlayerWithRoster[];
  onNavigate?: (direction: number) => void;
  currentWar?: War;
  historyFilters: {
      onlyCurrentTier: boolean;
      onlyAlliance: boolean;
      minSeason: number | undefined;
  };
  onHistoryFiltersChange: React.Dispatch<React.SetStateAction<{
      onlyCurrentTier: boolean;
      onlyAlliance: boolean;
      minSeason: number | undefined;
  }>>;
  historyCache: React.MutableRefObject<Map<string, HistoricalFightStat[]>>;
  activeTactic?: WarTactic | null;
}

interface FightWithNode extends WarFight {
  node: WarNode & {
      allocations: (WarNodeAllocation & { nodeModifier: NodeModifier })[];
  };
  attacker: { name: string; images: any; class: ChampionClass; tags: { name: string }[] } | null;
  defender: { name: string; images: any; class: ChampionClass; tags: { name: string }[] } | null;
  player: { ingameName: string } | null;
  prefightChampions?: { id: number; name: string; images: any }[];
}

export default function NodeEditor({
  onClose,
  warId,
  battlegroup,
  nodeId,
  currentFight,
  onSave,
  champions,
  players,
  onNavigate,
  currentWar,
  historyFilters,
  onHistoryFiltersChange,
  historyCache,
  activeTactic,
}: NodeEditorProps) {
  const [defenderId, setDefenderId] = useState<number | undefined>(currentFight?.defenderId || undefined);
  const [attackerId, setAttackerId] = useState<number | undefined>(currentFight?.attackerId || undefined);
  const [prefightChampionIds, setPrefightChampionIds] = useState<number[]>([]);
  const [playerId, setPlayerId] = useState<string | undefined>(currentFight?.playerId || undefined);
  const [deaths, setDeaths] = useState<number>(currentFight?.death || 0);
  const [notes, setNotes] = useState<string>(currentFight?.notes || "");
  
  const [history, setHistory] = useState<HistoricalFightStat[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isDefenderOpen, setIsDefenderOpen] = useState(false);

  // Check for tactic matches
  const defenderTacticMatch = useMemo(() => {
      const tactic = activeTactic as any;
      if (!defenderId || !tactic?.defenseTag?.name) return false;
      const def = champions.find(c => c.id === defenderId);
      // Need to cast or check tags existence
      const tags = (def as any).tags as { name: string }[] | undefined;
      return tags?.some(t => t.name === tactic.defenseTag.name);
  }, [defenderId, activeTactic, champions]);

  const attackerTacticMatch = useMemo(() => {
      const tactic = activeTactic as any;
      if (!attackerId || !tactic?.attackTag?.name) return false;
      const atk = champions.find(c => c.id === attackerId);
      const tags = (atk as any).tags as { name: string }[] | undefined;
      return tags?.some(t => t.name === tactic.attackTag.name);
  }, [attackerId, activeTactic, champions]);

  // Filter active modifiers
  const activeModifiers = useMemo(() => {
    if (!currentFight?.node?.allocations || !currentWar) return [];
    
    return currentFight.node.allocations.filter(alloc => {
        const tierMatch = (!alloc.minTier || alloc.minTier <= currentWar.warTier) && 
                          (!alloc.maxTier || alloc.maxTier >= currentWar.warTier);
        const seasonMatch = !alloc.season || alloc.season === currentWar.season;
        return tierMatch && seasonMatch;
    }).map(a => a.nodeModifier);
  }, [currentFight?.node?.allocations, currentWar]);

  // Load initial state when fight changes
  useEffect(() => {
    setDefenderId(currentFight?.defenderId || undefined);
    setAttackerId(currentFight?.attackerId || undefined);
    setPlayerId(currentFight?.playerId || undefined);
    setDeaths(currentFight?.death || 0);
    setNotes(currentFight?.notes || "");
    setPrefightChampionIds(currentFight?.prefightChampions?.map(c => c.id) || []);
    setHistory([]); 
    
    if (currentFight && !currentFight.defenderId) {
        setIsDefenderOpen(true);
    } else {
        setIsDefenderOpen(false);
    }
  }, [currentFight]);

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
            return;
        }

        if (e.key === 'ArrowRight') {
            onNavigate?.(1);
        } else if (e.key === 'ArrowLeft') {
            onNavigate?.(-1);
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNavigate]);


  // Fetch history when defender changes (with debounce and cache)
  useEffect(() => {
    if (!nodeId || !defenderId) {
      setHistory([]);
      return;
    }

    const filtersKey = JSON.stringify(historyFilters);
    const cacheKey = `${nodeId}-${defenderId}-${filtersKey}`;
    
    if (historyCache.current.has(cacheKey)) {
        setHistory(historyCache.current.get(cacheKey)!);
        return;
    }

    setIsLoadingHistory(true);
    const timer = setTimeout(async () => {
      try {
        const stats = await getHistoricalCounters(nodeId, defenderId, {
            minTier: historyFilters.onlyCurrentTier && currentWar?.warTier ? currentWar.warTier : undefined,
            maxTier: historyFilters.onlyCurrentTier && currentWar?.warTier ? currentWar.warTier : undefined,
            allianceId: historyFilters.onlyAlliance && currentWar?.allianceId ? currentWar.allianceId : undefined,
            minSeason: historyFilters.minSeason,
        });
        historyCache.current.set(cacheKey, stats);
        setHistory(stats);
      } catch (error) {
        console.error("Failed to fetch history:", error);
      } finally {
        setIsLoadingHistory(false);
      }
    }, 300);

    return () => {
        clearTimeout(timer);
    };
  }, [nodeId, defenderId, historyFilters, currentWar]);

  // --- DERIVED STATE FOR "SMART INPUTS" ---

  // 1. Available Players (Filtered by BG + Attacker)
  const availablePlayers = useMemo(() => {
    // Filter by BG first
    let filtered = players.filter(p => p.battlegroup === battlegroup);

    // Ensure currently assigned player is in the list (if any), even if moved BG
    if (currentFight?.playerId) {
        const assigned = players.find(p => p.id === currentFight.playerId);
        if (assigned && !filtered.includes(assigned)) {
            filtered.push(assigned);
        }
    }

    if (!attackerId) {
         return filtered.sort((a, b) => a.ingameName.localeCompare(b.ingameName));
    }

    // Filter players who have this champion
    const owners = filtered.filter(p => p.roster.some(r => r.championId === attackerId));
    
    // Sort owners by rank/ascension/stars of that champion
    return owners.sort((a, b) => {
        const rosterA = a.roster.find(r => r.championId === attackerId)!;
        const rosterB = b.roster.find(r => r.championId === attackerId)!;
        
        // Priority: Stars > Rank > Ascended
        if (rosterA.stars !== rosterB.stars) return rosterB.stars - rosterA.stars;
        if (rosterA.rank !== rosterB.rank) return rosterB.rank - rosterA.rank;
        if (rosterA.isAscended !== rosterB.isAscended) return (rosterA.isAscended ? 1 : 0) - (rosterB.isAscended ? 1 : 0);
        return a.ingameName.localeCompare(b.ingameName);
    });
  }, [players, attackerId, battlegroup, currentFight?.playerId]);

  // 2. Display Champions (Filtered by Player + Rank Info)
  const displayChampions = useMemo(() => {
    if (!playerId) return champions;
    const player = players.find(p => p.id === playerId);
    if (!player) return champions;

    const rosterMap = new Map(player.roster.map(r => [r.championId, r]));
    
    return champions
        .filter(c => rosterMap.has(c.id))
        .map(c => {
            const r = rosterMap.get(c.id)!;
            const rankStr = `${r.stars}* R${r.rank}${r.isAscended ? '+' : ''}`;
            // Create a new object with modified name for display
            return { ...c, name: `${c.name} (${rankStr})` };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
  }, [champions, players, playerId]);

  // 3. Optimized Prefight List
  const prefightChampionsList = useMemo(() => {
    const champs = champions.filter((champ) =>
      champ.abilities?.some((link: any) => link.ability.name === "Pre-Fight Ability")
    );
    return champs.sort((a, b) => {
      const priorityNames = ["Magneto (House Of X)", "Odin"];
      const aPriority = priorityNames.indexOf(a.name);
      const bPriority = priorityNames.indexOf(b.name);

      if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority;
      if (aPriority !== -1) return -1;
      if (bPriority !== -1) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [champions]);


  // Helper to trigger save
  const triggerSave = useCallback((updates: Partial<any>) => {
    if (nodeId === null) return;
    
    const payload = {
      id: currentFight?.id,
      warId,
      battlegroup,
      nodeId,
      ...updates
    };

    onSave(payload);
  }, [currentFight?.id, warId, battlegroup, nodeId, onSave]);

  const handleDefenderChange = useCallback((idStr: string) => {
    const val = idStr ? parseInt(idStr) : undefined;
    setDefenderId(val);
    triggerSave({ defenderId: val === undefined ? null : val });
  }, [triggerSave]);

  const handleAttackerChange = useCallback((idStr: string) => {
    const val = idStr ? parseInt(idStr) : undefined;
    setAttackerId(val);
    triggerSave({ attackerId: val === undefined ? null : val });
  }, [triggerSave]);

  const handlePlayerChange = useCallback((val: string) => {
    const newVal = val === "CLEAR" ? undefined : val;
    setPlayerId(newVal);
    triggerSave({ playerId: newVal === undefined ? null : newVal });
  }, [triggerSave]);

  const handleClearPlayer = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    handlePlayerChange("CLEAR");
  }, [handlePlayerChange]);

  const handlePrefightsChange = useCallback((ids: number[]) => {
    setPrefightChampionIds(ids);
    triggerSave({ prefightChampionIds: ids });
  }, [triggerSave]);

  useEffect(() => {
    if (currentFight && deaths !== currentFight.death) {
        const timer = setTimeout(() => {
            triggerSave({ death: deaths });
        }, 1000); 
        return () => clearTimeout(timer);
    }
  }, [deaths, currentFight, triggerSave]);

  useEffect(() => {
    const currentNotes = currentFight?.notes || "";
    if (notes !== currentNotes) {
        const timer = setTimeout(() => {
            triggerSave({ notes: notes });
        }, 1000); 
        return () => clearTimeout(timer);
    }
  }, [notes, currentFight, triggerSave]);


  if (nodeId === null) return null;

  return (
    <div className="flex flex-col h-full bg-slate-950 border-l border-slate-800">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg">Edit Node {nodeId}</h3>
            {activeModifiers.length > 0 && (
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-5 w-5 text-sky-400 hover:text-sky-300 hover:bg-sky-400/10 -ml-1">
                            <Info className="h-4 w-4" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 bg-slate-950 border-slate-800 p-4 shadow-xl shadow-black/50" align="start" side="bottom">
                        <h4 className="font-semibold mb-3 text-sm text-sky-400 flex items-center gap-2">
                            <Info className="h-4 w-4" />
                            Active Nodes
                        </h4>
                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                            {activeModifiers.map((mod) => (
                                <div key={mod.id} className="text-sm border-b border-slate-800/50 last:border-0 pb-3 last:pb-0">
                                    <div className="font-bold text-slate-200 mb-1">{mod.name}</div>
                                    <div className="text-slate-400 text-xs leading-relaxed">{mod.description}</div>
                                </div>
                            ))}
                        </div>
                    </PopoverContent>
                </Popover>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
             {currentFight?.defender?.name ? 
              `Current: ${currentFight.defender.name}` : 
              "No defender assigned"}
          </p>
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
                  />
                  {defenderTacticMatch && (
                      <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1">
                          <Badge variant="outline" className="border-indigo-500 text-indigo-400 bg-indigo-500/10 text-[10px] px-1.5 py-0 h-5">
                              Tactic: {(activeTactic as any)?.defenseTag?.name}
                          </Badge>
                      </div>
                  )}
              </div>
            </div>
          </div>

          {/* Player (Reordered) */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="player" className="text-right">Player</Label>
            <div className="col-span-3">
              <Select value={playerId || ""} onValueChange={handlePlayerChange}>
                <SelectTrigger className="w-full relative pr-8 [&>svg:last-child]:hidden">
                  <SelectValue placeholder="Select player..." />
                  {playerId ? (
                    <div 
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-800 cursor-pointer text-slate-400 hover:text-white z-10"
                        onClick={handleClearPlayer}
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        <X className="h-3 w-3" />
                    </div>
                  ) : (
                    <ChevronDown className="h-4 w-4 opacity-50 absolute right-2 top-1/2 -translate-y-1/2" />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {availablePlayers.length === 0 && (
                      <div className="p-2 text-sm text-muted-foreground text-center">No players found</div>
                  )}
                  {availablePlayers.map((p) => {
                    // Logic to show rank if attacker selected
                    let rosterInfo = "";
                    if (attackerId) {
                        const r = p.roster.find(r => r.championId === attackerId);
                        if (r) {
                            rosterInfo = `(${r.stars}* R${r.rank}${r.isAscended ? '+' : ''})`;
                        }
                    }

                    return (
                        <SelectItem key={p.id} value={p.id} className="pl-2 [&>span:first-child]:hidden">
                        <div className="flex items-center gap-2">
                            {p.avatar ? (
                            <div className="relative w-5 h-5 rounded-full overflow-hidden bg-slate-800 shrink-0">
                                <Image 
                                src={p.avatar} 
                                alt={p.ingameName} 
                                fill 
                                sizes="20px"
                                unoptimized
                                className="object-cover" 
                                />
                            </div>
                            ) : (
                            <Users className="w-5 h-5 text-slate-400 p-0.5 shrink-0" />
                            )}
                            <span className="truncate">
                                {p.ingameName} <span className="text-xs text-muted-foreground ml-1">{rosterInfo}</span>
                            </span>
                        </div>
                        </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Attacker (Reordered & Smart) */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="attacker" className="text-right">Attacker</Label>
            <div className="col-span-3">
              <div className="flex flex-col gap-1">
                  <ChampionCombobox
                    champions={displayChampions}
                    value={attackerId !== undefined ? String(attackerId) : ""}
                    onSelect={handleAttackerChange}
                    placeholder={playerId ? "Select from roster..." : "Select generic counter..."}
                  />
                  {attackerTacticMatch && (
                      <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1">
                          <Badge variant="outline" className="border-orange-500 text-orange-400 bg-orange-500/10 text-[10px] px-1.5 py-0 h-5">
                              Tactic: {(activeTactic as any)?.attackTag?.name}
                          </Badge>
                      </div>
                  )}
              </div>
            </div>
          </div>

          {/* Prefights */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="prefight" className="text-right">Prefights</Label>
            <div className="col-span-3">
              <MultiChampionCombobox
                champions={prefightChampionsList}
                values={prefightChampionIds}
                onSelect={handlePrefightsChange}
              />
            </div>
          </div>
          
          {/* Deaths */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="deaths" className="text-right">Deaths</Label>
            <Input
              id="deaths"
              type="number"
              value={deaths}
              onChange={(e) => setDeaths(parseInt(e.target.value) || 0)}
              className="col-span-3 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>

          {/* Notes */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="notes" className="text-right">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="col-span-3"
            />
          </div>

          {/* Historical Matchups Section */}
          {defenderId && (
            <div className="mt-4 border-t border-slate-800 pt-4">
                <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold">Historical Matchups</h4>
                    <div className="flex items-center gap-2">
                        {isLoadingHistory && <span className="text-xs text-muted-foreground font-normal">Loading...</span>}
                        
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                    <Settings2 className="h-4 w-4 text-slate-400" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 bg-slate-950 border-slate-800 p-4" align="end">
                                <h5 className="font-semibold mb-3 text-sm">History Filters</h5>
                                <div className="space-y-3">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox 
                                            id="tier-filter" 
                                            checked={historyFilters.onlyCurrentTier}
                                            onCheckedChange={(c) => onHistoryFiltersChange(prev => ({ ...prev, onlyCurrentTier: !!c }))}
                                        />
                                        <Label htmlFor="tier-filter" className="text-sm font-normal cursor-pointer">
                                            Current Tier Only {currentWar?.warTier ? `(T${currentWar.warTier})` : ''}
                                        </Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox 
                                            id="alliance-filter" 
                                            checked={historyFilters.onlyAlliance}
                                            onCheckedChange={(c) => onHistoryFiltersChange(prev => ({ ...prev, onlyAlliance: !!c }))}
                                        />
                                        <Label htmlFor="alliance-filter" className="text-sm font-normal cursor-pointer">
                                            My Alliance Only
                                        </Label>
                                    </div>
                                    <div className="space-y-1">
                                         <Label htmlFor="min-season" className="text-xs text-muted-foreground">Min Season</Label>
                                         <Input 
                                            id="min-season"
                                            type="number" 
                                            placeholder="All time"
                                            className="h-8 bg-slate-900 border-slate-800 text-xs no-spin-buttons"
                                            value={historyFilters.minSeason || ''}
                                            onChange={(e) => {
                                                const val = e.target.value ? parseInt(e.target.value) : undefined;
                                                onHistoryFiltersChange(prev => ({ ...prev, minSeason: val }));
                                            }}
                                         />
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
                
                {history.length === 0 && !isLoadingHistory ? (
                    <p className="text-xs text-muted-foreground">No history found for this defender on this node.</p>
                ) : (
                    <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                        {history.map((stat) => (
                            <HistoricalRow key={stat.attackerId} stat={stat} />
                        ))}
                    </div>
                )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const HistoricalRow = memo(function HistoricalRow({ stat }: { stat: HistoricalFightStat }) {
    const [expanded, setExpanded] = useState(false);
    
    return (
        <div className="bg-slate-900/50 border border-slate-800 rounded-md overflow-hidden">
            <div 
                className="flex items-center justify-between p-2 cursor-pointer hover:bg-slate-800/50 transition-colors"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <ChevronRight className={cn("h-3 w-3 text-slate-500 transition-transform", expanded && "rotate-90")} />
                    <div className="relative h-8 w-8 rounded-full overflow-hidden bg-slate-800 flex-shrink-0">
                        <Image
                            src={getChampionImageUrl(stat.attackerImages, '64')}
                            alt={stat.attackerName}
                            fill
                            unoptimized
                            className="object-cover"
                        />
                    </div>
                    <div className="truncate">
                        <div className="font-bold truncate text-xs">{stat.attackerName}</div>
                        <div className="text-[10px] text-muted-foreground">{stat.totalFights} Fights</div>
                        {/* Display Prefights */}
                        {stat.prefightChampions && stat.prefightChampions.length > 0 && (
                            <div className="flex -space-x-1 mt-1">
                                {stat.prefightChampions.map((pf, idx) => (
                                    <div key={idx} className="relative h-3 w-3 rounded-full ring-1 ring-slate-900 overflow-hidden bg-slate-800" title={pf.name}>
                                        <Image
                                            src={getChampionImageUrl(pf.images, '64')}
                                            alt={pf.name}
                                            fill
                                            unoptimized
                                            className="object-cover"
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <div className="flex flex-col items-center w-8">
                        <span className="font-bold text-emerald-400 text-xs">{stat.solos}</span>
                        <span className="text-[8px] text-muted-foreground uppercase">Solos</span>
                    </div>
                    <div className="flex flex-col items-center w-8">
                        <span className="font-bold text-red-400 text-xs">{stat.deaths}</span>
                        <span className="text-[8px] text-muted-foreground uppercase">Deaths</span>
                    </div>
                    {(stat.sampleVideoInternalId || stat.sampleVideoUrl) && (
                        <div 
                            onClick={(e) => {
                                e.stopPropagation();
                                if (stat.sampleVideoInternalId) {
                                    window.open(`/war-videos/${stat.sampleVideoInternalId}`, '_blank');
                                } else if (stat.sampleVideoUrl) {
                                    window.open(stat.sampleVideoUrl, '_blank');
                                }
                            }}
                            className="ml-1 p-1 hover:bg-slate-700 rounded-full transition-colors text-amber-400 cursor-pointer"
                            title="Watch Sample Video"
                        >
                            <PlayCircle className="h-4 w-4" />
                        </div>
                    )}
                </div>
            </div>
            
            {expanded && stat.players && stat.players.length > 0 && (
                <div className="border-t border-slate-800/50 bg-slate-950/30">
                    {stat.players.map((player, idx) => (
                        <div key={idx} className="flex items-center justify-between px-8 py-1.5 text-xs hover:bg-slate-800/30">
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="relative w-4 h-4 rounded-full overflow-hidden bg-slate-800 shrink-0">
                                    {player.avatar ? (
                                        <Image 
                                            src={player.avatar} 
                                            alt={player.name} 
                                            fill 
                                            unoptimized
                                            className="object-cover" 
                                        />
                                    ) : (
                                        <Users className="w-2.5 h-2.5 text-slate-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                                    )}
                                </div>
                                <span className="text-slate-300 truncate">{player.name}</span>
                                {player.battlegroup && (
                                    <span className={cn(
                                        "px-1 py-0.5 rounded text-[9px] font-mono leading-none",
                                        player.battlegroup === 1 ? "bg-red-900/30 text-red-400 border border-red-900/50" :
                                        player.battlegroup === 2 ? "bg-green-900/30 text-blue-400 border border-blue-900/50" :
                                        "bg-blue-900/30 text-green-400 border border-green-900/50"
                                    )}>
                                        BG{player.battlegroup}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                                {player.prefightChampions && player.prefightChampions.length > 0 && (
                                    <div className="flex -space-x-1">
                                        {player.prefightChampions.map((pf, i) => (
                                            <div key={i} className="relative h-4 w-4 rounded-full ring-1 ring-slate-900 overflow-hidden bg-slate-800" title={pf.name}>
                                                <Image
                                                    src={getChampionImageUrl(pf.images, '64')}
                                                    alt={pf.name}
                                                    fill
                                                    unoptimized
                                                    className="object-cover"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="flex items-center gap-1 w-12 justify-end">
                                    <span className={cn("font-medium", player.death === 0 ? "text-emerald-500" : "text-red-500")}>
                                        {player.death === 0 ? "Solo" : `${player.death} Deaths`}
                                    </span>
                                </div>
                                {player.videoId && (
                                    <a 
                                        href={`/war-videos/${player.videoId}`} 
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-amber-500/70 hover:text-amber-400"
                                    >
                                        <PlayCircle className="h-3 w-3" />
                                    </a>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});
