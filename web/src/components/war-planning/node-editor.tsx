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
  const [notes, setNotes] = useState<string>(currentFight?.notes || ""); // Assuming notes field will be added to WarFight

  useEffect(() => {
    setDefenderId(currentFight?.defenderId || undefined);
    setAttackerId(currentFight?.attackerId || undefined);
    setPlayerId(currentFight?.playerId || undefined);
    setDeaths(currentFight?.death || 0);
    setNotes(currentFight?.notes || "");
  }, [currentFight]);

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
      <DialogContent className="sm:max-w-[425px]">
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
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSave}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
