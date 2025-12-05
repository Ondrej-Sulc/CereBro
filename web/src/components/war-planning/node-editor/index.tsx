"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { WarFight, WarTactic, War, WarMapType } from "@prisma/client";
import { Champion } from "@/types/champion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ChampionCombobox } from "@/components/ChampionCombobox";
import { PlayerCombobox } from "@/components/PlayerCombobox";
import { PrefightSelector } from "./prefight-selector";
import { HistoricalFightStat } from "@/app/planning/history-actions";
import { X } from "lucide-react";
import Image from "next/image";
import { PlayerWithRoster, FightWithNode, SeasonBanWithChampion, WarBanWithChampion } from "../types";
import { ActiveModifiers } from "./active-modifiers";
import { NodeHistory } from "./node-history";
import { ExtraChampion } from "../hooks/use-war-planning";

interface WarTacticWithTags extends WarTactic {
  defenseTag?: { name: string } | null;
  attackTag?: { name: string } | null;
}

interface ChampionWithTags extends Champion {
  tags?: { name: string }[];
}

interface NodeEditorProps {
  onClose: () => void;
  warId: string;
  battlegroup: number;
  nodeId: number | null;
  currentFight: FightWithNode | null;
  onSave: (updatedFight: Partial<WarFight> & { 
      prefightUpdates?: { championId: number; playerId?: string | null }[] 
  }) => void;
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
  activeTactic?: WarTacticWithTags | null;
  seasonBans: SeasonBanWithChampion[];
  warBans: WarBanWithChampion[];
  currentFights: FightWithNode[];
  extraChampions: ExtraChampion[];
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
  seasonBans,
  warBans,
  currentFights,
  extraChampions,
}: NodeEditorProps) {
  const [defenderId, setDefenderId] = useState<number | undefined>(currentFight?.defenderId || undefined);
  const [attackerId, setAttackerId] = useState<number | undefined>(currentFight?.attackerId || undefined);
  const [prefights, setPrefights] = useState<{ championId: number; playerId: string | null }[]>([]);
  const [playerId, setPlayerId] = useState<string | undefined>(currentFight?.playerId || undefined);
  const [deaths, setDeaths] = useState<number>(currentFight?.death || 0);
  const [notes, setNotes] = useState<string>(currentFight?.notes || "");
  
  const [isDefenderOpen, setIsDefenderOpen] = useState(false);
  const isUserEdit = useRef(false);

  // Check for tactic matches
  const defenderTacticMatch = useMemo(() => {
      const tactic = activeTactic as WarTacticWithTags | null | undefined;
      if (!defenderId || !tactic?.defenseTag?.name) return false;
      const def = champions.find(c => c.id === defenderId) as ChampionWithTags | undefined;
      return def?.tags?.some(t => t.name === tactic.defenseTag!.name) ?? false;
  }, [defenderId, activeTactic, champions]);

  const attackerTacticMatch = useMemo(() => {
      const tactic = activeTactic as WarTacticWithTags | null | undefined;
      if (!attackerId || !tactic?.attackTag?.name) return false;
      const atk = champions.find(c => c.id === attackerId) as ChampionWithTags | undefined;
      return atk?.tags?.some(t => t.name === tactic.attackTag!.name) ?? false;
  }, [attackerId, activeTactic, champions]);

  // Filter active modifiers
  const activeModifiers = useMemo(() => {
    if (!currentFight?.node?.allocations || !currentWar) return [];
    
    return currentFight.node.allocations.filter(alloc => {
        const tierMatch = (!alloc.minTier || alloc.minTier <= currentWar.warTier) && 
                          (!alloc.maxTier || alloc.maxTier >= currentWar.warTier);
        const seasonMatch = !alloc.season || alloc.season === currentWar.season;
        const mapTypeMatch = alloc.mapType === (currentWar.mapType || WarMapType.STANDARD);
        
        return tierMatch && seasonMatch && mapTypeMatch;
    }).map(a => a.nodeModifier);
  }, [currentFight?.node?.allocations, currentWar]);

  // Load initial state when fight changes
  useEffect(() => {
    isUserEdit.current = false;
    const newDefenderId = currentFight?.defenderId || undefined;
    setDefenderId(prev => prev !== newDefenderId ? newDefenderId : prev);

    const newAttackerId = currentFight?.attackerId || undefined;
    setAttackerId(prev => prev !== newAttackerId ? newAttackerId : prev);

    const newPlayerId = currentFight?.playerId || undefined;
    setPlayerId(prev => prev !== newPlayerId ? newPlayerId : prev);

    const newDeaths = currentFight?.death || 0;
    setDeaths(prev => prev !== newDeaths ? newDeaths : prev);

    const newNotes = currentFight?.notes || "";
    setNotes(prev => prev !== newNotes ? newNotes : prev);

    const newPrefights = currentFight?.prefightChampions?.map(c => ({
        championId: c.id,
        playerId: c.player?.id || null
    })) || [];
    
    setPrefights(prev => {
        const prefightsEqual = (a: typeof newPrefights, b: typeof newPrefights) => 
            a.length === b.length && a.every((val, index) => 
                val.championId === b[index].championId && val.playerId === b[index].playerId
            );
        
        if (!prefightsEqual(newPrefights, prev)) {
            return newPrefights;
        }
        return prev;
    });
    
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
        } else if (e.key === 'ArrowUp') {
            onNavigate?.(9);
        } else if (e.key === 'ArrowDown') {
            onNavigate?.(-9);
        }

    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNavigate]);

  // --- DERIVED STATE FOR "SMART INPUTS" ---

  // 1. Available Players (Filtered by BG + Attacker)
  const bgPlayers = useMemo(() => {
      return players.filter(p => p.battlegroup === battlegroup);
  }, [players, battlegroup]);

  const availablePlayers = useMemo(() => {
    // Filter by BG first
    let filtered = [...bgPlayers]; // Clone to avoid mutating memoized array if we push

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
    // ... (rest of availablePlayers logic)

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

  // 2. Display Champions (Filtered by Player + Rank Info + BANS)
  const displayChampions = useMemo(() => {
    // Filter out BANS first
    const allowedChampions = champions.filter(c => 
        !seasonBans.some(b => b.championId === c.id) &&
        !warBans.some(b => b.championId === c.id)
    );

    if (!playerId) return allowedChampions;
    const player = players.find(p => p.id === playerId);
    if (!player) return allowedChampions;

    const rosterMap = new Map(player.roster.map(r => [r.championId, r]));
    
    // Identify War Team (Assigned or Extra for this player in this war)
    const warTeamIds = new Set<number>();
    currentFights.forEach(f => {
        if (f.player?.id === playerId && f.attacker?.id) warTeamIds.add(f.attacker.id);
        // We could include prefights too but usually attacker selection focuses on main attackers
    });
    extraChampions.forEach(ex => {
        if (ex.playerId === playerId && ex.battlegroup === battlegroup) warTeamIds.add(ex.championId);
    });

    const warTeam: any[] = [];
    const roster: any[] = [];
    const others: any[] = [];

    allowedChampions.forEach(c => {
        const r = rosterMap.get(c.id);
        const rankStr = r ? `(${r.stars}* R${r.rank}${r.isAscended ? '+' : ''})` : "";
        const displayName = `${c.name} ${rankStr}`.trim();
        
        const item = { ...c, name: displayName, originalName: c.name, rankData: r };

        if (warTeamIds.has(c.id)) {
            warTeam.push({ ...item, group: "War Team" });
        } else if (r) {
            roster.push({ ...item, group: "Player Roster" });
        } else {
            others.push({ ...item, group: "All Champions" });
        }
    });

    // Sort Roster by Rank Desc
    roster.sort((a, b) => {
        if (a.rankData.stars !== b.rankData.stars) return b.rankData.stars - a.rankData.stars;
        if (a.rankData.rank !== b.rankData.rank) return b.rankData.rank - a.rankData.rank;
        return a.originalName.localeCompare(b.originalName);
    });

    // Sort Others A-Z
    others.sort((a, b) => a.originalName.localeCompare(b.originalName));

    // War Team should ideally be sorted by rank too or just kept at top
    warTeam.sort((a, b) => a.originalName.localeCompare(b.originalName));

    return [...warTeam, ...roster, ...others];
  }, [champions, players, playerId, seasonBans, warBans, currentFights, extraChampions, battlegroup]);

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

  const handlePlayerChange = useCallback((val: string | undefined) => {
    setPlayerId(val);
    triggerSave({ playerId: val === undefined ? null : val });
  }, [triggerSave]);

  const handlePrefightsChange = useCallback((newPrefights: { championId: number; playerId: string | null }[]) => {
    setPrefights(newPrefights);
    triggerSave({ prefightUpdates: newPrefights });
  }, [triggerSave]);

  useEffect(() => {
    if (currentFight && isUserEdit.current && deaths !== currentFight.death) {
        const timer = setTimeout(() => {
            triggerSave({ death: deaths });
            isUserEdit.current = false;
        }, 1000); 
        return () => clearTimeout(timer);
    }
  }, [deaths, currentFight, triggerSave]);

  useEffect(() => {
    const currentNotes = currentFight?.notes || "";
    if (isUserEdit.current && notes !== currentNotes) {
        const timer = setTimeout(() => {
            triggerSave({ notes: notes });
            isUserEdit.current = false;
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
              <PlayerCombobox
                players={availablePlayers}
                value={playerId}
                onSelect={handlePlayerChange}
                attackerId={attackerId}
              />
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
                    placeholder={playerId ? "Select from roster..." : "Select counter..."}
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
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="prefight" className="text-right pt-2">Prefights</Label>
            <div className="col-span-3">
              <PrefightSelector
                prefights={prefights}
                onChange={handlePrefightsChange}
                champions={prefightChampionsList}
                players={bgPlayers} 
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
              onChange={(e) => {
                  isUserEdit.current = true;
                  setDeaths(parseInt(e.target.value, 10) || 0);
              }}
              className="col-span-3 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>

          {/* Notes */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="notes" className="text-right">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => {
                  isUserEdit.current = true;
                  setNotes(e.target.value);
              }}
              className="col-span-3"
            />
          </div>

          {/* Historical Matchups Section */}
          <NodeHistory 
            nodeId={nodeId}
            defenderId={defenderId}
            currentWar={currentWar}
            filters={historyFilters}
            onFiltersChange={onHistoryFiltersChange}
            cache={historyCache}
          />
        </div>
      </div>
    </div>
  );
}
