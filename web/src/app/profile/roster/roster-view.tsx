"use client";

import { useState, useMemo, forwardRef, HTMLAttributes, memo, useCallback, useEffect } from "react";
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
import { Search, Sparkles, Trash2, Edit2, ShieldAlert, CircleOff, TrendingUp, ChevronRight, Trophy, ChevronDown, Zap } from "lucide-react";
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
import { VirtuosoGrid } from "react-virtuoso";

export interface Recommendation {
    championName: string;
    championClass: ChampionClass;
    championImage: any;
    stars: number;
    fromRank: number;
    toRank: number;
    prestigeGain: number;
    accountGain: number;
}

export interface SigRecommendation {
    championName: string;
    championClass: ChampionClass;
    championImage: any;
    stars: number;
    rank: number;
    fromSig: number;
    toSig: number;
    prestigeGain: number;
    accountGain: number;
    prestigePerSig: number;
}

interface RosterViewProps {
  initialRoster: RosterWithChampion[];
  top30Average: number;
  prestigeMap: Record<string, number>;
  recommendations?: Recommendation[];
  sigRecommendations?: SigRecommendation[];
  simulationTargetRank: number;
  initialSigBudget?: number;
}

const CLASS_ICONS: Record<ChampionClass, string> = {
    SCIENCE: "/icons/Science.png",
    SKILL: "/icons/Skill.png",
    MYSTIC: "/icons/Mystic.png",
    COSMIC: "/icons/Cosmic.png",
    TECH: "/icons/Tech.png",
    MUTANT: "/icons/Mutant.png",
    SUPERIOR: "/icons/Superior.png",
};

const CLASSES: ChampionClass[] = ["SCIENCE", "SKILL", "MYSTIC", "COSMIC", "TECH", "MUTANT"];

// Extracted Card Component for Virtuoso

const ChampionCard = memo(({ item, prestige, onEdit }: { item: RosterWithChampion; prestige?: number; onEdit: (item: RosterWithChampion) => void }) => {
    const classColors = getChampionClassColors(item.champion.class);
    
    return (
        <div 
            className={cn(
                "group relative aspect-[3/4] rounded-lg overflow-hidden border transition-colors cursor-pointer bg-slate-900",
                classColors.bg,
                "border-slate-800 hover:border-slate-500"
            )}
            onClick={() => onEdit(item)}
        >
            {/* Image */}
            <Image 
                src={getChampionImageUrl(item.champion.images as unknown as ChampionImages, 'full')} 
                alt={item.champion.name}
                fill
                sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, (max-width: 1024px) 16vw, 10vw"
                className="object-cover transition-transform group-hover:scale-105 p-1"
            />
            
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-80" />

            {/* Top Info (Stars/Rank Indicator) */}
            <div className="absolute top-1.5 right-1.5 flex flex-col items-end gap-1">
                <div className="flex items-center gap-1 bg-black/80 px-2 py-0.5 rounded border border-white/10">
                        <span className="text-white text-xs font-black leading-none">{item.stars}</span>
                        <span className="text-yellow-500 text-[10px]">★</span>
                </div>
                    {item.isAscended && (
                    <div className="bg-yellow-900/80 p-1 rounded border border-yellow-500/30" title="Ascended">
                        <Trophy className="w-4 h-4 text-yellow-400" />
                    </div>
                )}
            </div>

                <div className="absolute top-1.5 left-1.5">
                    <div className={cn("p-1.5 rounded-full bg-black/80 border border-white/10", classColors.text)}>
                    <div className="relative w-5 h-5">
                        <img 
                            src={CLASS_ICONS[item.champion.class]} 
                            alt={item.champion.class} 
                            className="w-full h-full object-contain"
                            loading="lazy" 
                        />
                    </div>
                    </div>
                </div>


            {/* Bottom Info */}
            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
                <div className="flex items-center justify-between mb-1">
                    <div className="flex gap-1 items-center">
                        <Badge variant="outline" className="bg-slate-900/90 border-slate-700 text-[10px] px-1.5 py-0 h-4 font-bold text-slate-100">
                            R{item.rank}
                        </Badge>
                        {item.isAwakened && (
                             <Badge variant="outline" className="bg-sky-950/40 border-sky-500/30 text-[10px] px-1.5 py-0 h-4 font-bold text-sky-400">
                                S{item.sigLevel}
                            </Badge>
                        )}
                    </div>
                    {/* Prestige Display */}
                    {prestige ? (
                         <span className="text-[10px] font-mono font-medium text-slate-300 bg-black/40 px-1 rounded">
                            {prestige.toLocaleString()}
                        </span>
                    ) : (
                        item.isAwakened && <Sparkles className="w-3.5 h-3.5 text-white fill-white/20" />
                    )}
                </div>
                <p className="text-[11px] sm:text-xs font-bold text-white leading-tight truncate">{item.champion.name}</p>
            </div>

            {/* Hover Overlay Action */}
            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="bg-sky-600 p-2 rounded-full scale-75 group-hover:scale-100 transition-transform">
                        <Edit2 className="w-4 h-4 text-white" />
                    </div>
            </div>
        </div>
    );
});
ChampionCard.displayName = 'ChampionCard';

const GridList = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ style, children, ...props }, ref) => (
    <div
        ref={ref}
        {...props}
        style={style}
        className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2"
    >
        {children}
    </div>
));
GridList.displayName = "GridList";

export function RosterView({ initialRoster, top30Average, prestigeMap, recommendations, sigRecommendations, simulationTargetRank, initialSigBudget = 0 }: RosterViewProps) {
  const [roster, setRoster] = useState<RosterWithChampion[]>(initialRoster);
  const [search, setSearch] = useState("");
  const [filterClass, setFilterClass] = useState<ChampionClass | null>(null);
  const [filterStars, setFilterStars] = useState<string>("ALL");
  const [filterRank, setFilterRank] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"PRESTIGE" | "NAME">("PRESTIGE");
  const [editingItem, setEditingItem] = useState<RosterWithChampion | null>(null);
  const [showInsights, setShowInsights] = useState(true);
  const [sigBudget, setSigBudget] = useState(initialSigBudget);
  const router = useRouter();
  const { toast } = useToast();

  const handleTargetChange = (val: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set('targetRank', val);
    router.push(`?${params.toString()}`);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
        const params = new URLSearchParams(window.location.search);
        if (sigBudget > 0) {
            params.set('sigBudget', sigBudget.toString());
        } else {
            params.delete('sigBudget');
        }
        router.push(`?${params.toString()}`);
    }, 500);

    return () => clearTimeout(timer);
  }, [sigBudget, router]);

  const filteredRoster = useMemo(() => {
    const filtered = roster.filter((item) => {
      const matchesSearch = item.champion.name.toLowerCase().includes(search.toLowerCase());
      const matchesClass = !filterClass || item.champion.class === filterClass;
      const matchesStars = filterStars === "ALL" || item.stars.toString() === filterStars;
      const matchesRank = filterRank === "ALL" || item.rank.toString() === filterRank;
      return matchesSearch && matchesClass && matchesStars && matchesRank;
    });

    return filtered.sort((a, b) => {
        if (sortBy === "NAME") {
            return a.champion.name.localeCompare(b.champion.name);
        } else {
            const prestigeA = prestigeMap[a.id] || 0;
            const prestigeB = prestigeMap[b.id] || 0;
            // Primary: Prestige Descending
            if (prestigeA !== prestigeB) return prestigeB - prestigeA;
            // Secondary: Name Ascending (for equal prestige)
            return a.champion.name.localeCompare(b.champion.name);
        }
    });
  }, [roster, search, filterClass, filterStars, filterRank, sortBy, prestigeMap]);

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

  const handleEdit = useCallback((item: RosterWithChampion) => {
    setEditingItem(item);
  }, []);

  const itemContent = useCallback((index: number) => {
      const item = filteredRoster[index];
      return (
        <ChampionCard 
            item={item} 
            prestige={prestigeMap[item.id]}
            onEdit={handleEdit} 
        />
      );
  }, [filteredRoster, handleEdit, prestigeMap]);

  return (
    <div className="space-y-6">
      {/* Insights Toggle & Header */}
      {(recommendations?.length || sigRecommendations?.length) ? (
          <div className="space-y-4">
              <div className="flex items-center justify-between">
                   <Button 
                        variant="ghost" 
                        onClick={() => setShowInsights(!showInsights)}
                        className="flex items-center gap-2 px-0 hover:bg-transparent text-slate-300 hover:text-white"
                   >
                       <div className={cn("p-1 bg-slate-800 rounded transition-transform duration-200", showInsights && "rotate-180")}>
                           <ChevronDown className="w-4 h-4" />
                       </div>
                       <h2 className="font-bold text-lg">Prestige Suggestions</h2>
                   </Button>
                   {showInsights && (
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2 mr-2">
                                <Label className="text-[10px] text-slate-400 uppercase tracking-wider hidden sm:block whitespace-nowrap">Stone Budget</Label>
                                <Input 
                                    type="number"
                                    min={0}
                                    value={sigBudget || ""}
                                    placeholder="Max"
                                    onChange={(e) => setSigBudget(e.target.value ? parseInt(e.target.value) : 0)}
                                    className="h-7 w-[70px] bg-slate-900 border-slate-700 text-slate-300 text-xs text-center"
                                />
                            </div>
                            <Label className="text-[10px] text-slate-400 uppercase tracking-wider hidden sm:block">Target Rank</Label>
                            <Select value={String(simulationTargetRank)} onValueChange={handleTargetChange}>
                                <SelectTrigger className="h-7 w-[90px] bg-slate-900 border-slate-700 text-slate-300 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {[3, 4, 5, 6].map(r => (
                                        <SelectItem key={r} value={String(r)} className="text-xs">Rank {r}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                   )}
              </div>

            {showInsights && (
                <div className="space-y-6 animate-in slide-in-from-top-2 fade-in duration-300">
                    {/* Rank-up Recommendations Card */}
                    {recommendations && (
                        <Card className="bg-gradient-to-br from-indigo-950/40 via-slate-900/50 to-slate-950 border-indigo-500/20 overflow-hidden">
                            <div className="px-4 py-3 border-b border-indigo-500/10 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-indigo-500/20 rounded-lg">
                                        <TrendingUp className="w-4 h-4 text-indigo-400" />
                                    </div>
                                    <h3 className="font-bold text-slate-100">Rank-up Opportunities</h3>
                                </div>
                            </div>

                            {recommendations.length > 0 ? (
                                <>
                                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                                        {recommendations.map((rec, i) => {
                                            const classColors = getChampionClassColors(rec.championClass);
                                            return (
                                                <div key={i} className={cn(
                                                    "flex items-center gap-3 p-2 pr-3 rounded-xl border transition-all group overflow-hidden relative",
                                                    classColors.bg,
                                                    "bg-opacity-10 hover:bg-opacity-20",
                                                    classColors.border,
                                                    "border-opacity-30"
                                                )}>
                                                    {/* Avatar */}
                                                    <div className="relative w-12 h-12 shrink-0 rounded-lg overflow-hidden border border-white/10 shadow-sm">
                                                        <Image 
                                                            src={getChampionImageUrl(rec.championImage, 'full')} 
                                                            alt={rec.championName}
                                                            fill
                                                            className="object-cover"
                                                        />
                                                    </div>
                                                    
                                                    {/* Info */}
                                                    <div className="flex flex-col min-w-0 flex-1">
                                                        <div className="flex items-center justify-between mb-0.5">
                                                            <span className="text-yellow-500 text-[10px] font-bold leading-none">{rec.stars}★</span>
                                                            <div className="flex items-center gap-1 text-[10px] font-bold font-mono text-slate-400">
                                                                <span>R{rec.fromRank}</span>
                                                                <ChevronRight className="w-2.5 h-2.5" />
                                                                <span className={cn(classColors.text, "brightness-150")}>R{rec.toRank}</span>
                                                            </div>
                                                        </div>
                                                        
                                                        <p className="text-xs font-bold text-slate-100 truncate leading-tight mb-1">{rec.championName}</p>
                                                        
                                                        <Badge className="w-fit bg-emerald-500/20 text-emerald-400 border-0 text-[10px] px-1.5 py-0 h-4 font-mono font-bold">
                                                            +{rec.accountGain}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="px-4 py-2 bg-indigo-500/5 border-t border-indigo-500/10 text-[10px] text-slate-500 italic">
                                        These rank-ups would provide the largest net increase to your Top 30 account average.
                                    </div>
                                </>
                            ) : (
                                <div className="p-8 flex flex-col items-center justify-center text-center space-y-2">
                                    <div className="p-3 bg-slate-900/50 rounded-full mb-2">
                                        <TrendingUp className="w-6 h-6 text-slate-600" />
                                    </div>
                                    <p className="text-slate-400 font-medium text-sm">No impactful rank-ups found for Target Rank {simulationTargetRank}.</p>
                                    <p className="text-slate-500 text-xs max-w-md">
                                        Rank-ups to this level won't increase your Top 30 Average enough to matter. Try increasing the Target Rank to see future opportunities.
                                    </p>
                                </div>
                            )}
                        </Card>
                    )}

                    {/* Sig Recommendations Card */}
                    {sigRecommendations && sigRecommendations.length > 0 && (
                        <Card className="bg-gradient-to-br from-purple-950/40 via-slate-900/50 to-slate-950 border-purple-500/20 overflow-hidden">
                            <div className="px-4 py-3 border-b border-purple-500/10 flex items-center gap-2">
                                <div className="p-1.5 bg-purple-500/20 rounded-lg">
                                    <Sparkles className="w-4 h-4 text-purple-400" />
                                </div>
                                <h3 className="font-bold text-slate-100">
                                    {sigBudget > 0 ? "Recommended Allocation" : "Max Sig Potential"}
                                </h3>
                            </div>

                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                                {sigRecommendations.map((rec, i) => {
                                    const classColors = getChampionClassColors(rec.championClass);
                                    return (
                                        <div key={i} className={cn(
                                            "flex items-center gap-3 p-2 pr-3 rounded-xl border transition-all group overflow-hidden relative",
                                            classColors.bg,
                                            "bg-opacity-10 hover:bg-opacity-20",
                                            classColors.border,
                                            "border-opacity-30"
                                        )}>
                                            {/* Avatar */}
                                            <div className="relative w-12 h-12 shrink-0 rounded-lg overflow-hidden border border-white/10 shadow-sm">
                                                <Image 
                                                    src={getChampionImageUrl(rec.championImage, 'full')} 
                                                    alt={rec.championName}
                                                    fill
                                                    className="object-cover"
                                                />
                                            </div>
                                            
                                            {/* Info */}
                                            <div className="flex flex-col min-w-0 flex-1">
                                                <div className="flex items-center justify-between mb-0.5">
                                                    <span className="text-yellow-500 text-[10px] font-bold leading-none">{rec.stars}★ R{rec.rank}</span>
                                                    <div className="flex items-center gap-1 text-[10px] font-bold font-mono text-slate-400">
                                                        <span>S{rec.fromSig}</span>
                                                        <ChevronRight className="w-2.5 h-2.5" />
                                                        <span className={cn(classColors.text, "brightness-150")}>S{rec.toSig}</span>
                                                    </div>
                                                </div>
                                                
                                                <p className="text-xs font-bold text-slate-100 truncate leading-tight mb-1">{rec.championName}</p>
                                                
                                                <div className="flex items-center gap-2">
                                                    <Badge className="w-fit bg-purple-500/20 text-purple-400 border-0 text-[10px] px-1.5 py-0 h-4 font-mono font-bold">
                                                        +{rec.accountGain}
                                                    </Badge>
                                                    {rec.prestigePerSig > 0 && (
                                                        <div className="flex items-center gap-0.5 text-[9px] font-mono text-purple-300/80" title="Prestige Gain per Sig Stone">
                                                            <Zap className="w-2.5 h-2.5" />
                                                            {rec.prestigePerSig}/sig
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="px-4 py-2 bg-purple-500/5 border-t border-purple-500/10 text-[10px] text-slate-500 italic">
                                {sigBudget > 0 
                                    ? "Optimal distribution of your budget to maximize Top 30 Average." 
                                    : "Potential average increase if you take these champions to Max Sig."
                                }
                            </div>
                        </Card>
                    )}
                </div>
            )}
          </div>
      ) : null}

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
                {top30Average > 0 && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-amber-950/20 border border-amber-900/40 rounded-md shrink-0">
                        <span className="text-amber-500/80 text-xs font-bold uppercase tracking-wide">Top 30 Prestige</span>
                        <span className="text-amber-100 font-mono font-bold text-sm">{top30Average.toLocaleString()}</span>
                    </div>
                )}
                
                <div className="h-8 w-px bg-slate-800 hidden xl:block" />

                <div className="flex gap-2 shrink-0">
                    <Select value={sortBy} onValueChange={(v) => setSortBy(v as "PRESTIGE" | "NAME")}>
                        <SelectTrigger className="w-[110px] bg-slate-950/50 border-slate-700">
                            <SelectValue placeholder="Sort" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="PRESTIGE">Prestige</SelectItem>
                            <SelectItem value="NAME">Name</SelectItem>
                        </SelectContent>
                    </Select>
                    
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
        {filteredRoster.length === 0 ? (
          <div className="text-center py-12 text-slate-500 bg-slate-900/20 rounded-lg border border-slate-800 border-dashed">
              <p>No champions found matching your criteria.</p>
          </div>
        ) : (
            <VirtuosoGrid
                useWindowScroll
                totalCount={filteredRoster.length}
                overscan={2000}
                computeItemKey={(index) => filteredRoster[index]?.id}
                components={{
                    List: GridList
                }}
                itemContent={itemContent}
            />
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
                        <Label htmlFor="sig" className="text-right">Sig Level</Label>
                        <Input 
                            id="sig" 
                            type="number" 
                            disabled={!editingItem.isAwakened}
                            className="w-[180px] bg-slate-950 border-slate-700 disabled:opacity-50"
                            min={0}
                            max={editingItem.stars >= 5 ? 200 : 99}
                            value={editingItem.sigLevel || 0}
                            onChange={(e) => {
                                const maxSig = editingItem.stars >= 5 ? 200 : 99;
                                let val = parseInt(e.target.value);
                                if (isNaN(val)) val = 0;
                                if (val > maxSig) val = maxSig;
                                if (val < 0) val = 0;
                                setEditingItem({...editingItem, sigLevel: val});
                            }}
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                         <Label className="text-right">Options</Label>
                         <div className="col-span-3 flex gap-4">
                             <div className="flex items-center space-x-2">
                                <Checkbox 
                                    id="awakened" 
                                    checked={editingItem.isAwakened}
                                    onCheckedChange={(c) => {
                                        const isAwakened = !!c;
                                        setEditingItem({
                                            ...editingItem, 
                                            isAwakened,
                                            // If unawakening, set sig to 0. If awakening and sig is 0, default to 1? Or keep 0? 
                                            // Game logic: Awakening usually implies sig 1 unless using a gem that specifically says otherwise, 
                                            // but generally simplest is: if on -> keep current (or 1 if 0), if off -> 0.
                                            // Let's just reset to 0 if turning off. If turning on, let user type.
                                            sigLevel: isAwakened ? (editingItem.sigLevel || 1) : 0
                                        });
                                    }}
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
                            sigLevel: editingItem.sigLevel
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