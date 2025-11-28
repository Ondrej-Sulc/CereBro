"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { WarFight, Champion, Player, WarNode } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChampionCombobox } from "@/components/ChampionCombobox";
import { MultiChampionCombobox } from "@/components/MultiChampionCombobox";
import { getHistoricalCounters, HistoricalFightStat } from "@/app/planning/history-actions";
import { getChampionImageUrl } from "@/lib/championHelper";
import { PlayCircle, Users, X } from "lucide-react";
import Image from "next/image";
import { useDebounce } from "@/hooks/use-debounce"; // We might need this, or just manual timeout

interface NodeEditorProps {
  onClose: () => void;
  warId: string;
  battlegroup: number;
  nodeId: number | null;
  currentFight: FightWithNode | null;
  onSave: (updatedFight: Partial<WarFight> & { prefightChampionIds?: number[] }) => void;
  champions: Champion[];
  players: Player[];
}

interface FightWithNode extends WarFight {
  node: WarNode;
  attacker: { name: string; images: any } | null;
  defender: { name: string; images: any } | null;
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
}: NodeEditorProps) {
  const [defenderId, setDefenderId] = useState<number | undefined>(currentFight?.defenderId || undefined);
  const [attackerId, setAttackerId] = useState<number | undefined>(currentFight?.attackerId || undefined);
  const [prefightChampionIds, setPrefightChampionIds] = useState<number[]>([]);
  const [playerId, setPlayerId] = useState<string | undefined>(currentFight?.playerId || undefined);
  const [deaths, setDeaths] = useState<number>(currentFight?.death || 0);
  const [notes, setNotes] = useState<string>(currentFight?.notes || "");
  
  const [history, setHistory] = useState<HistoricalFightStat[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Load initial state when fight changes
  useEffect(() => {
    setDefenderId(currentFight?.defenderId || undefined);
    setAttackerId(currentFight?.attackerId || undefined);
    setPlayerId(currentFight?.playerId || undefined);
    setDeaths(currentFight?.death || 0);
    setNotes(currentFight?.notes || "");
    setPrefightChampionIds(currentFight?.prefightChampions?.map(c => c.id) || []);
    setHistory([]); 
  }, [currentFight]);

  // Fetch history when defender changes
  useEffect(() => {
    async function fetchHistory() {
      if (!nodeId || !defenderId) {
        setHistory([]);
        return;
      }
      setIsLoadingHistory(true);
      try {
        const stats = await getHistoricalCounters(nodeId, defenderId);
        setHistory(stats);
      } catch (error) {
        console.error("Failed to fetch history:", error);
      } finally {
        setIsLoadingHistory(false);
      }
    }
    fetchHistory();
  }, [nodeId, defenderId]);

  // Helper to trigger save with current state + updates
  const triggerSave = useCallback((updates: Partial<any>) => {
    if (nodeId === null) return;
    
    // We construct the full object to ensure we don't lose context, 
    // but typically the API only needs ID + changed fields.
    // However, since we rely on closures for some state variables in a pure function,
    // passing 'updates' explicitly is safer.
    
    // Actually, we can just pass the specific update to the parent handler
    // providing the parent handler merges it correctly. 
    // The parent 'handleSaveFight' calls 'updateWarFight' which likely expects just the diffs + ID.
    
    const payload = {
      id: currentFight?.id,
      warId,
      battlegroup,
      nodeId,
      ...updates
    };

    onSave(payload);
  }, [currentFight?.id, warId, battlegroup, nodeId, onSave]);

  // -- Instant Saves for Selectors --

  const handleDefenderChange = (idStr: string) => {
    const val = idStr ? parseInt(idStr) : undefined;
    setDefenderId(val);
    triggerSave({ defenderId: val === undefined ? null : val });
  };

  const handleAttackerChange = (idStr: string) => {
    const val = idStr ? parseInt(idStr) : undefined;
    setAttackerId(val);
    triggerSave({ attackerId: val === undefined ? null : val });
  };

  const handlePlayerChange = (val: string) => {
    setPlayerId(val);
    triggerSave({ playerId: val });
  };

  const handlePrefightsChange = (ids: number[]) => {
    setPrefightChampionIds(ids);
    triggerSave({ prefightChampionIds: ids });
  };

  // -- Debounced Saves for Inputs --
  
  // We use a ref to track if the initial load has happened, to avoid saving on mount
  // But strictly, useEffect dependencies handle this if we compare values.
  
  useEffect(() => {
    if (currentFight && deaths !== currentFight.death) {
        const timer = setTimeout(() => {
            triggerSave({ death: deaths });
        }, 1000); // 1s debounce for typing numbers
        return () => clearTimeout(timer);
    }
  }, [deaths, currentFight, triggerSave]);

  useEffect(() => {
    // Treat null notes as empty string for comparison
    const currentNotes = currentFight?.notes || "";
    if (notes !== currentNotes) {
        const timer = setTimeout(() => {
            triggerSave({ notes: notes });
        }, 1000); // 1s debounce for typing notes
        return () => clearTimeout(timer);
    }
  }, [notes, currentFight, triggerSave]);


  if (nodeId === null) return null;

  return (
    <div className="flex flex-col h-full bg-slate-950 border-l border-slate-800">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Edit Node {nodeId}</h3>
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
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="defender" className="text-right">Defender</Label>
            <div className="col-span-3">
              <ChampionCombobox
                champions={champions}
                value={defenderId !== undefined ? String(defenderId) : ""}
                onSelect={handleDefenderChange}
              />
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="attacker" className="text-right">Attacker</Label>
            <div className="col-span-3">
              <ChampionCombobox
                champions={champions}
                value={attackerId !== undefined ? String(attackerId) : ""}
                onSelect={handleAttackerChange}
              />
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="prefight" className="text-right">Prefights</Label>
            <div className="col-span-3">
              <MultiChampionCombobox
                champions={champions}
                values={prefightChampionIds}
                onSelect={handlePrefightsChange}
              />
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="player" className="text-right">Player</Label>
            <div className="col-span-3">
              <Select value={playerId} onValueChange={handlePlayerChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select player..." />
                </SelectTrigger>
                <SelectContent>
                  {players.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        {p.avatar ? (
                          <div className="relative w-5 h-5 rounded-full overflow-hidden bg-slate-800">
                            <Image 
                              src={p.avatar} 
                              alt={p.ingameName} 
                              fill 
                              sizes="20px"
                              className="object-cover" 
                            />
                          </div>
                        ) : (
                           <Users className="w-5 h-5 text-slate-400 p-0.5" />
                        )}
                        <span className="truncate">{p.ingameName}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="deaths" className="text-right">Deaths</Label>
            <Input
              id="deaths"
              type="number"
              defaultValue={deaths}
              onChange={(e) => setDeaths(parseInt(e.target.value) || 0)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="notes" className="text-right">Notes</Label>
            <Textarea
              id="notes"
              defaultValue={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="col-span-3"
            />
          </div>

          {/* Historical Matchups Section */}
          {defenderId && (
            <div className="mt-4 border-t border-slate-800 pt-4">
                <h4 className="text-sm font-semibold mb-3 flex items-center justify-between">
                    <span>Historical Matchups</span>
                    {isLoadingHistory && <span className="text-xs text-muted-foreground font-normal">Loading...</span>}
                </h4>
                
                {history.length === 0 && !isLoadingHistory ? (
                    <p className="text-xs text-muted-foreground">No history found for this defender on this node.</p>
                ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                        {history.map((stat) => (
                            <div key={stat.attackerId} className="flex items-center justify-between p-2 rounded-md bg-slate-900/50 border border-slate-800 text-xs">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <div className="relative h-8 w-8 rounded-full overflow-hidden bg-slate-800 flex-shrink-0">
                                        <Image
                                            src={getChampionImageUrl(stat.attackerImages, '64')}
                                            alt={stat.attackerName}
                                            fill
                                            className="object-cover"
                                        />
                                    </div>
                                    <div className="truncate">
                                        <div className="font-bold truncate">{stat.attackerName}</div>
                                        <div className="text-muted-foreground">{stat.totalFights} Fights</div>
                                        {/* Display Prefights */}
                                        {stat.prefightChampions && stat.prefightChampions.length > 0 && (
                                            <div className="flex -space-x-1 mt-1">
                                                {stat.prefightChampions.map((pf, idx) => (
                                                    <div key={idx} className="relative h-4 w-4 rounded-full ring-1 ring-slate-900 overflow-hidden bg-slate-800" title={pf.name}>
                                                        <Image
                                                            src={getChampionImageUrl(pf.images, '64')}
                                                            alt={pf.name}
                                                            fill
                                                            className="object-cover"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    <div className="flex flex-col items-center">
                                        <span className="font-bold text-emerald-400">{stat.solos}</span>
                                        <span className="text-[10px] text-muted-foreground uppercase">Solos</span>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <span className="font-bold text-red-400">{stat.deaths}</span>
                                        <span className="text-[10px] text-muted-foreground uppercase">Deaths</span>
                                    </div>
                                    {(stat.sampleVideoInternalId || stat.sampleVideoUrl) && (
                                        <a 
                                            href={stat.sampleVideoInternalId ? `/war-videos/${stat.sampleVideoInternalId}` : stat.sampleVideoUrl} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="ml-1 p-1 hover:bg-slate-800 rounded-full transition-colors text-amber-400"
                                            title="Watch Video"
                                        >
                                            <PlayCircle className="h-5 w-5" />
                                        </a>
                                    )}
                                </div>
                            </div>
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
