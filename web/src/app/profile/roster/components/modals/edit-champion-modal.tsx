"use client";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2 } from "lucide-react";
import Image from "next/image";
import { getChampionImageUrl } from "@/lib/championHelper";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { cn } from "@/lib/utils";
import { ProfileRosterEntry } from "../../types";
import { ChampionImages } from "@/types/champion";

interface EditChampionModalProps {
    item: ProfileRosterEntry | null;
    onClose: () => void;
    onUpdate: (data: Partial<ProfileRosterEntry> & { id: string }) => void;
    onDelete: (id: string) => void;
    onItemChange: (item: ProfileRosterEntry) => void;
}

export function EditChampionModal({ item, onClose, onUpdate, onDelete, onItemChange }: EditChampionModalProps) {
    if (!item) return null;

    return (
        <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="bg-slate-900 border-slate-800 text-slate-200">
                <DialogHeader className="flex flex-row items-center gap-4 border-b border-slate-800 pb-4">
                    <div className={cn("relative w-16 h-16 rounded-lg overflow-hidden border-2 shadow-md shrink-0", getChampionClassColors(item.champion.class).border)}>
                        <Image src={getChampionImageUrl(item.champion.images, 'full')} alt={item.champion.name} fill sizes="64px" className="object-cover" />
                    </div>
                    <div className="flex flex-col gap-1 text-left">
                        <DialogTitle className={cn("text-xl flex items-center gap-2", getChampionClassColors(item.champion.class).text)}>
                            {item.champion.name}
                            <Badge variant="secondary" className="text-xs bg-slate-800 text-slate-300 border-slate-700">{item.stars}★ R{item.rank}</Badge>
                        </DialogTitle>
                        <DialogDescription>Update details for this champion in your roster.</DialogDescription>
                    </div>
                </DialogHeader>
                
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="rank" className="text-right">Rank</Label>
                        <Select value={String(item.rank)} onValueChange={(v) => onItemChange({...item, rank: parseInt(v)})}>
                            <SelectTrigger className="w-[180px] bg-slate-950 border-slate-700">
                                <SelectValue placeholder="Rank" />
                            </SelectTrigger>
                            <SelectContent>
                                {Array.from({length: Math.max(item.stars === 7 ? 6 : 5, item.rank)}, (_, i) => i + 1).map(r => (
                                     <SelectItem key={r} value={String(r)}>Rank {r}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="sig" className="text-right">Sig Level</Label>
                        <Input 
                            id="sig" type="number" disabled={!item.isAwakened}
                            className="w-[180px] bg-slate-950 border-slate-700 disabled:opacity-50"
                            min={0} max={item.stars >= 5 ? 200 : 99} value={item.sigLevel || 0}
                            onChange={(e) => {
                                const maxSig = item.stars >= 5 ? 200 : 99;
                                let val = parseInt(e.target.value);
                                if (isNaN(val)) val = 0;
                                if (val > maxSig) val = maxSig;
                                if (val < 0) val = 0;
                                onItemChange({...item, sigLevel: val});
                            }}
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                         <Label className="text-right">Options</Label>
                         <div className="col-span-3 flex gap-4">
                             <div className="flex items-center space-x-2">
                                <Checkbox 
                                    id="awakened" checked={item.isAwakened}
                                    onCheckedChange={(c) => onItemChange({...item, isAwakened: !!c, sigLevel: !!c ? (item.sigLevel || 1) : 0})}
                                    className="border-slate-600 data-[state=checked]:bg-sky-600"
                                />
                                <Label htmlFor="awakened">Awakened</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="ascended" checked={item.isAscended} onCheckedChange={(c) => onItemChange({...item, isAscended: !!c})} className="border-slate-600 data-[state=checked]:bg-sky-600" />
                                <Label htmlFor="ascended">Ascended</Label>
                            </div>
                         </div>
                    </div>
                </div>

                <DialogFooter className="flex justify-between sm:justify-between w-full">
                    <Button variant="destructive" size="icon" onClick={() => onDelete(item.id)}><Trash2 className="w-4 h-4" /></Button>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose}>Cancel</Button>
                        <Button onClick={() => onUpdate({ id: item.id, rank: item.rank, isAwakened: item.isAwakened, isAscended: item.isAscended, sigLevel: item.sigLevel })} className="bg-sky-600 hover:bg-sky-700">Save Changes</Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
