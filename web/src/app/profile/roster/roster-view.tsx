"use client";

import { useState, useMemo } from "react";
import { RosterWithChampion } from "@cerebro/core/services/rosterService";
import { ChampionClass } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Sparkles, Trash2, Edit2, ShieldAlert, CircleOff } from "lucide-react";
import Image from "next/image";
import { getChampionImageUrl } from "@/lib/championHelper";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ChampionImages } from "@/types/champion";
import { useRouter } from "next/navigation";

interface RosterViewProps {
  initialRoster: RosterWithChampion[];
}

const CLASS_ICONS: Record<ChampionClass, string> = {
    SCIENCE: "/icons/Science.png",
    SKILL: "/icons/Skill.png",
    MYSTIC: "/icons/Mystic.png",
    COSMIC: "/icons/Cosmic.png",
    TECH: "/icons/Tech.png",
    MUTANT: "/icons/Mutant.png",
    SUPERIOR: "/icons/Superior.png"
};

const CLASSES: ChampionClass[] = ["SCIENCE", "SKILL", "MYSTIC", "COSMIC", "TECH", "MUTANT", "SUPERIOR"];

export function RosterView({ initialRoster }: RosterViewProps) {
  const [roster, setRoster] = useState<RosterWithChampion[]>(initialRoster);
  const [search, setSearch] = useState("");
  const [filterClass, setFilterClass] = useState<ChampionClass | null>(null);
  const [filterStars, setFilterStars] = useState<string>("ALL");
  const [filterRank, setFilterRank] = useState<string>("ALL");
  const [editingItem, setEditingItem] = useState<RosterWithChampion | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const filteredRoster = useMemo(() => {
    return roster.filter((item) => {
      const matchesSearch = item.champion.name.toLowerCase().includes(search.toLowerCase());
      const matchesClass = !filterClass || item.champion.class === filterClass;
      const matchesStars = filterStars === "ALL" || item.stars.toString() === filterStars;
      const matchesRank = filterRank === "ALL" || item.rank.toString() === filterRank;
      return matchesSearch && matchesClass && matchesStars && matchesRank;
    });
  }, [roster, search, filterClass, filterStars, filterRank]);

  const handleUpdate = async (updatedData: Partial<RosterWithChampion> & { id: string }) => {
    try {
        const response = await fetch("/api/profile/roster/manage", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedData),
        });

        if (!response.ok) throw new Error("Failed to update");

        const updatedItem = await response.json();
        
        setRoster(prev => prev.map(item => item.id === updatedData.id ? { ...item, ...updatedItem } : item));
        toast({ title: "Success", description: "Champion updated" });
        setEditingItem(null);
        router.refresh();
    } catch (error) {
        toast({ title: "Error", description: "Failed to update champion", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
      if (!confirm("Are you sure you want to remove this champion from your roster?")) return;

      try {
        const response = await fetch("/api/profile/roster/manage", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
        });

        if (!response.ok) throw new Error("Failed to delete");

        setRoster(prev => prev.filter(item => item.id !== id));
        toast({ title: "Success", description: "Champion removed" });
        setEditingItem(null);
        router.refresh();
      } catch (error) {
          toast({ title: "Error", description: "Failed to remove champion", variant: "destructive" });
      }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="bg-slate-900/50 border-slate-800 p-4">
        <div className="flex flex-col xl:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input 
                    placeholder="Search champions..." 
                    value={search} 
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 bg-slate-950/50 border-slate-700"
                />
            </div>
            
            <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                <div className="flex gap-2 shrink-0">
                    <Select value={filterStars} onValueChange={setFilterStars}>
                        <SelectTrigger className="w-[110px] bg-slate-950/50 border-slate-700">
                            <SelectValue placeholder="Stars" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Stars</SelectItem>
                            <SelectItem value="7">7-Star</SelectItem>
                            <SelectItem value="6">6-Star</SelectItem>
                            <SelectItem value="5">5-Star</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={filterRank} onValueChange={setFilterRank}>
                        <SelectTrigger className="w-[110px] bg-slate-950/50 border-slate-700">
                            <SelectValue placeholder="Rank" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Ranks</SelectItem>
                            {[1,2,3,4,5,6].map(r => (
                                <SelectItem key={r} value={String(r)}>Rank {r}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="h-8 w-px bg-slate-800 hidden md:block" />

                <div className="flex items-center gap-1 bg-slate-950/40 p-1 rounded-full border border-slate-800/50 overflow-x-auto no-scrollbar">
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                            "h-8 w-8 rounded-full transition-all shrink-0",
                            !filterClass ? "bg-slate-700 text-white shadow-inner" : "text-slate-500 hover:text-slate-300"
                        )}
                        onClick={() => setFilterClass(null)}
                        title="All Classes"
                    >
                        <CircleOff className="h-4 w-4" />
                    </Button>
                    <div className="h-4 w-px bg-slate-800 mx-0.5" />
                    {CLASSES.map(c => {
                        const colors = getChampionClassColors(c);
                        const isSelected = filterClass === c;
                        
                        return (
                            <Button
                                key={c}
                                variant="ghost"
                                size="sm"
                                className={cn(
                                    "h-8 w-8 p-1.5 rounded-full transition-all border shrink-0",
                                    isSelected 
                                        ? cn(colors.bg, colors.border, "shadow-sm") 
                                        : "bg-transparent border-transparent hover:bg-slate-800"
                                )}
                                onClick={() => setFilterClass(isSelected ? null : c)}
                                title={c}
                            >
                                <div className="relative w-full h-full">
                                    <Image 
                                        src={CLASS_ICONS[c]} 
                                        alt={c} 
                                        fill 
                                        sizes="24px"
                                        className="object-contain"
                                    />
                                </div>
                            </Button>
                        );
                    })}
                </div>
            </div>
        </div>
      </Card>

      {/* Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
        {filteredRoster.map((item) => {
            const classColors = getChampionClassColors(item.champion.class);
            return (
                <div 
                    key={item.id} 
                    className={cn(
                        "group relative aspect-[3/4] rounded-lg overflow-hidden border transition-all cursor-pointer shadow-lg",
                        classColors.bg,
                        "border-slate-800 hover:border-slate-500"
                    )}
                    onClick={() => setEditingItem(item)}
                >
                    {/* Image */}
                    <Image 
                        src={getChampionImageUrl(item.champion.images as unknown as ChampionImages, 'full')} 
                        alt={item.champion.name}
                        fill
                        className="object-cover transition-transform group-hover:scale-110 p-1"
                    />
                    
                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-80" />

                    {/* Top Info (Stars/Rank Indicator) */}
                    <div className="absolute top-1.5 right-1.5 flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1 bg-black/70 px-2 py-0.5 rounded-md backdrop-blur-md border border-white/20 shadow-md">
                             <span className="text-yellow-500 text-[10px]">★</span>
                             <span className="text-white text-xs font-black leading-none">{item.stars}</span>
                        </div>
                         {item.isAscended && (
                            <div className="bg-sky-500/20 p-1 rounded-md backdrop-blur-md border border-sky-400/40 shadow-md" title="Ascended">
                                <ShieldAlert className="w-4 h-4 text-sky-400 fill-sky-400/20" />
                            </div>
                        )}
                    </div>

                     <div className="absolute top-1.5 left-1.5">
                         <div className={cn("p-1.5 rounded-full bg-black/70 border border-white/20 backdrop-blur-md shadow-md", classColors.text)}>
                            <div className="relative w-5 h-5">
                                <Image src={CLASS_ICONS[item.champion.class]} alt={item.champion.class} fill className="object-contain" />
                            </div>
                         </div>
                     </div>


                    {/* Bottom Info */}
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
                        <div className="flex items-center justify-between mb-1">
                             <Badge variant="outline" className="bg-slate-900/90 border-slate-700 text-[11px] px-2 py-0.5 h-5 font-bold text-slate-100">
                                R{item.rank}
                            </Badge>
                             {item.isAwakened && (
                                <Sparkles className="w-4 h-4 text-white fill-white/10 drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
                            )}
                        </div>
                        <p className="text-[11px] sm:text-xs font-bold text-white leading-tight truncate drop-shadow-md">{item.champion.name}</p>
                    </div>

                    {/* Hover Overlay Action */}
                    <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                         <div className="bg-sky-500/80 p-2 rounded-full shadow-2xl scale-75 group-hover:scale-100 transition-transform">
                             <Edit2 className="w-4 h-4 text-white" />
                         </div>
                    </div>
                </div>
            );
        })}
      </div>

      {filteredRoster.length === 0 && (
          <div className="text-center py-12 text-slate-500 bg-slate-900/20 rounded-lg border border-slate-800 border-dashed">
              <p>No champions found matching your criteria.</p>
          </div>
      )}

      {/* Edit Modal */}
      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-200">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    Edit {editingItem?.champion.name}
                    {editingItem && (
                         <Badge variant="secondary" className="ml-2 text-xs bg-slate-800">
                            {editingItem.stars}★ R{editingItem.rank}
                        </Badge>
                    )}
                </DialogTitle>
                <DialogDescription>
                    Update details for this champion in your roster.
                </DialogDescription>
            </DialogHeader>
            
            {editingItem && (
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="rank" className="text-right">Rank</Label>
                        <Select 
                            key={editingItem.id}
                            value={String(editingItem.rank)} 
                            onValueChange={(v) => setEditingItem({...editingItem, rank: parseInt(v)})}
                        >
                            <SelectTrigger className="w-[180px] bg-slate-950 border-slate-700">
                                <SelectValue placeholder="Rank" />
                            </SelectTrigger>
                            <SelectContent>
                                {Array.from({length: Math.max(6, editingItem.rank)}, (_, i) => i + 1).map(r => (
                                     <SelectItem key={r} value={String(r)}>Rank {r}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="pr" className="text-right">Power Rating</Label>
                        <Input 
                            id="pr" 
                            type="number" 
                            className="col-span-3 bg-slate-950 border-slate-700"
                            value={editingItem.powerRating || ""}
                            onChange={(e) => setEditingItem({...editingItem, powerRating: parseInt(e.target.value) || null})}
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                         <Label className="text-right">Options</Label>
                         <div className="col-span-3 flex gap-4">
                             <div className="flex items-center space-x-2">
                                <Checkbox 
                                    id="awakened" 
                                    checked={editingItem.isAwakened}
                                    onCheckedChange={(c) => setEditingItem({...editingItem, isAwakened: !!c})}
                                    className="border-slate-600 data-[state=checked]:bg-sky-600"
                                />
                                <Label htmlFor="awakened">Awakened</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox 
                                    id="ascended" 
                                    checked={editingItem.isAscended}
                                    onCheckedChange={(c) => setEditingItem({...editingItem, isAscended: !!c})}
                                    className="border-slate-600 data-[state=checked]:bg-sky-600"
                                />
                                <Label htmlFor="ascended">Ascended</Label>
                            </div>
                         </div>
                    </div>
                </div>
            )}

            <DialogFooter className="flex justify-between sm:justify-between w-full">
                <Button variant="destructive" size="icon" onClick={() => editingItem && handleDelete(editingItem.id)}>
                    <Trash2 className="w-4 h-4" />
                </Button>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setEditingItem(null)}>Cancel</Button>
                    <Button 
                        onClick={() => editingItem && handleUpdate({
                            id: editingItem.id,
                            rank: editingItem.rank,
                            isAwakened: editingItem.isAwakened,
                            isAscended: editingItem.isAscended,
                            powerRating: editingItem.powerRating
                        })}
                        className="bg-sky-600 hover:bg-sky-700"
                    >
                        Save Changes
                    </Button>
                </div>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
