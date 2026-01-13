"use client";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ChampionCombobox } from "@/components/comboboxes/ChampionCombobox";
import { Champion } from "@prisma/client";

interface NewChampionFormData {
    championId: number | null;
    stars: number;
    rank: number;
    sigLevel: number;
    isAwakened: boolean;
    isAscended: boolean;
}

interface AddChampionModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    allChampions: Champion[];
    onAdd: () => void;
    newChampion: NewChampionFormData;
    onNewChampionChange: (data: NewChampionFormData) => void;
}

export function AddChampionModal({ open, onOpenChange, allChampions, onAdd, newChampion, onNewChampionChange }: AddChampionModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-slate-900 border-slate-800 text-slate-200">
                <DialogHeader>
                    <DialogTitle>Add Champion</DialogTitle>
                    <DialogDescription>Manually add a champion to your roster.</DialogDescription>
                </DialogHeader>
                
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label>Champion</Label>
                        <ChampionCombobox champions={allChampions} value={newChampion.championId ? String(newChampion.championId) : ""} onSelect={(val) => onNewChampionChange({...newChampion, championId: val ? parseInt(val) : null})} className="bg-slate-950 border-slate-700 text-slate-200 w-full" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Star Level</Label>
                            <Select value={String(newChampion.stars)} onValueChange={(v) => onNewChampionChange({...newChampion, stars: parseInt(v)})}>
                                <SelectTrigger className="bg-slate-950 border-slate-700"><SelectValue /></SelectTrigger>
                                <SelectContent>{[4, 5, 6, 7].map(s => <SelectItem key={s} value={String(s)}>{s}-Star</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Rank</Label>
                            <Select value={String(newChampion.rank)} onValueChange={(v) => onNewChampionChange({...newChampion, rank: parseInt(v)})}>
                                <SelectTrigger className="bg-slate-950 border-slate-700"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {Array.from({length: newChampion.stars === 7 ? 3 : (newChampion.stars === 6 ? 6 : 5)}, (_, i) => i + 1).map(r => (
                                         <SelectItem key={r} value={String(r)}>Rank {r}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Signature Level</Label>
                        <Input 
                            type="number" 
                            disabled={!newChampion.isAwakened} 
                            className="bg-slate-950 border-slate-700 disabled:opacity-50" 
                            min={0} 
                            max={newChampion.stars >= 5 ? 200 : 99} 
                            value={newChampion.sigLevel} 
                            onChange={(e) => {
                                const maxSig = newChampion.stars >= 5 ? 200 : 99;
                                let val = parseInt(e.target.value);
                                if (isNaN(val)) val = 0;
                                if (val > maxSig) val = maxSig;
                                if (val < 0) val = 0;
                                onNewChampionChange({...newChampion, sigLevel: val});
                            }} 
                        />
                    </div>

                    <div className="flex gap-6 mt-2">
                         <div className="flex items-center space-x-2">
                            <Checkbox id="new-awakened" checked={newChampion.isAwakened} onCheckedChange={(c) => onNewChampionChange({...newChampion, isAwakened: !!c, sigLevel: !!c ? (newChampion.sigLevel || 1) : 0})} className="border-slate-600 data-[state=checked]:bg-sky-600" />
                            <Label htmlFor="new-awakened">Awakened</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox id="new-ascended" checked={newChampion.isAscended} onCheckedChange={(c) => onNewChampionChange({...newChampion, isAscended: !!c})} className="border-slate-600 data-[state=checked]:bg-sky-600" />
                            <Label htmlFor="new-ascended">Ascended</Label>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={onAdd} className="bg-sky-600 hover:bg-sky-700">Add to Roster</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
