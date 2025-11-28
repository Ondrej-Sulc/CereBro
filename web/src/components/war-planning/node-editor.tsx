"use client";

import { useState, useEffect } from "react";
import { WarFight, Champion, Player, WarNode } from "@prisma/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChampionCombobox } from "@/components/ChampionCombobox";
import { getHistoricalCounters, HistoricalFightStat } from "@/app/planning/history-actions";
import { getChampionImageUrl } from "@/lib/championHelper";
import { PlayCircle } from "lucide-react";
import Image from "next/image";

interface NodeEditorProps {
  isOpen: boolean;
  onClose: () => void;
  warId: string;
  battlegroup: number;
  nodeId: number | null;
  currentFight: FightWithNode | null;
  onSave: (updatedFight: Partial<WarFight>) => void;
  champions: Champion[];
  players: Player[];
}

// Re-defining FightWithNode here for clarity in this component, might be moved to a shared type later
interface FightWithNode extends WarFight {
  node: WarNode;
  attacker: { name: string; images: any } | null;
  defender: { name: string; images: any } | null;
  player: { ingameName: string } | null;
}

export default function NodeEditor({
  isOpen,
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
  const [playerId, setPlayerId] = useState<string | undefined>(currentFight?.playerId || undefined);
  const [deaths, setDeaths] = useState<number>(currentFight?.death || 0);
  const [notes, setNotes] = useState<string>(currentFight?.notes || "");
  
  const [history, setHistory] = useState<HistoricalFightStat[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    setDefenderId(currentFight?.defenderId || undefined);
    setAttackerId(currentFight?.attackerId || undefined);
    setPlayerId(currentFight?.playerId || undefined);
    setDeaths(currentFight?.death || 0);
    setNotes(currentFight?.notes || "");
    setHistory([]); // Reset history when opening new fight
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

  const handleSave = () => {
    if (nodeId === null) return;

    onSave({
      id: currentFight?.id, // Pass existing ID if updating
      warId: warId,
      battlegroup: battlegroup,
      nodeId: nodeId,
      defenderId: defenderId === undefined ? null : defenderId,
      attackerId: attackerId === undefined ? null : attackerId,
      playerId: playerId === undefined ? null : playerId,
      death: deaths,
      notes: notes,
    });
    onClose();
  };

  if (nodeId === null) return null; // Don't render if no node is selected

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Node {nodeId}</DialogTitle>
          <DialogDescription>
            {currentFight?.defender?.name ? 
              `Current Defender: ${currentFight.defender.name}` : 
              "No defender assigned yet."}
            {currentFight?.player?.ingameName && 
              ` | Player: ${currentFight.player.ingameName}`}
            {currentFight?.attacker?.name && 
              ` | Attacker: ${currentFight.attacker.name}`}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="defender" className="text-right">Defender</Label>
            <div className="col-span-3">
              <ChampionCombobox
                champions={champions}
                value={defenderId !== undefined ? String(defenderId) : ""}
                onSelect={(id: string) => setDefenderId(id ? parseInt(id) : undefined)}
              />
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="attacker" className="text-right">Attacker</Label>
            <div className="col-span-3">
              <ChampionCombobox
                champions={champions}
                value={attackerId !== undefined ? String(attackerId) : ""}
                onSelect={(id: string) => setAttackerId(id ? parseInt(id) : undefined)}
              />
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="player" className="text-right">Player</Label>
            <div className="col-span-3">
              <Select value={playerId} onValueChange={setPlayerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select player..." />
                </SelectTrigger>
                <SelectContent>
                  {players.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.ingameName}
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
                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
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
                                    {stat.sampleVideoUrl && (
                                        <a 
                                            href={stat.sampleVideoUrl} 
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
        <DialogFooter>
          <Button type="submit" onClick={handleSave}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
