"use client";

import { ChevronDown, TrendingUp, Info, ChevronRight, Sparkles, Zap, Trophy } from "lucide-react";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClassFilterToggle } from "./class-filter-toggle";
import { getChampionImageUrl } from "@/lib/championHelper";
import { cn } from "@/lib/utils";
import { Recommendation, SigRecommendation } from "../types";
import { ChampionClass } from "@prisma/client";
import { CLASSES } from "../constants";

interface RosterInsightsProps {
    showInsights: boolean;
    recommendations?: Recommendation[];
    sigRecommendations?: SigRecommendation[];
    simulationTargetRank: number;
    onTargetRankChange: (val: string) => void;
    sigBudget: number;
    onSigBudgetChange: (val: number) => void;
    rankUpClassFilter: ChampionClass[];
    onRankUpClassFilterChange: (classes: ChampionClass[]) => void;
    sigClassFilter: ChampionClass[];
    onSigClassFilterChange: (classes: ChampionClass[]) => void;
    rankUpSagaFilter: boolean;
    onRankUpSagaFilterChange: (val: boolean) => void;
    sigSagaFilter: boolean;
    onSigSagaFilterChange: (val: boolean) => void;
    isPending: boolean;
    pendingSection: 'rank' | 'sig' | 'all' | null;
    onRecommendationClick: (rec: SigRecommendation) => void;
}

function ClassFilterSelector({ selectedClasses, onChange }: { selectedClasses: ChampionClass[], onChange: (classes: ChampionClass[]) => void }) {
    return (
        <div className="flex items-center">
            <div className="lg:hidden">
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className={cn("h-7 w-7 rounded-full", selectedClasses.length > 0 ? "bg-sky-600/20 text-sky-400" : "text-slate-400")}>
                            {selectedClasses.length > 0 ? <div className="w-4 h-4 rounded-full bg-sky-500 text-[10px] text-white font-bold flex items-center justify-center ring-2 ring-slate-900">{selectedClasses.length}</div> : <Zap className="w-4 h-4" />}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-2 bg-slate-900 border-slate-800" align="end">
                        <ClassFilterToggle selectedClasses={selectedClasses} onChange={onChange} size="sm" className="bg-transparent border-none p-0" />
                    </PopoverContent>
                </Popover>
            </div>
            <div className="hidden lg:flex items-center">
                <ClassFilterToggle selectedClasses={selectedClasses} onChange={onChange} className="bg-slate-900/50 p-1 rounded-full border border-slate-800" />
            </div>
        </div>
    );
}

export function RosterInsights({
    showInsights, recommendations = [], sigRecommendations = [],
    simulationTargetRank, onTargetRankChange, sigBudget, onSigBudgetChange,
    rankUpClassFilter, onRankUpClassFilterChange, sigClassFilter, onSigClassFilterChange,
    rankUpSagaFilter, onRankUpSagaFilterChange, sigSagaFilter, onSigSagaFilterChange,
    isPending, pendingSection, onRecommendationClick
}: RosterInsightsProps) {
    if (!showInsights) return null;

    return (
        <div className="space-y-4 animate-in slide-in-from-top-2 fade-in duration-300">
            <div className="flex items-center gap-2 mb-2">
                <div className="p-1 bg-indigo-500/20 rounded-md"><TrendingUp className="w-4 h-4 text-indigo-400" /></div>
                <h2 className="font-bold text-lg text-slate-100">Prestige Suggestions</h2>
            </div>
            
            <div className="space-y-6">
                <Card className="bg-gradient-to-br from-indigo-950/40 via-slate-900/50 to-slate-950 border-indigo-500/20 overflow-hidden">
                            <div className="px-4 py-3 border-b border-indigo-500/10 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-indigo-500/20 rounded-lg"><TrendingUp className="w-4 h-4 text-indigo-400" /></div>
                                    <h3 className="font-bold text-slate-100">Rank-up Opportunities</h3>
                                    <Popover>
                                        <PopoverTrigger><Info className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer" /></PopoverTrigger>
                                        <PopoverContent className="bg-slate-900 border-slate-800 text-slate-300 max-w-[300px]">
                                            <p>Rank-ups that provide the highest immediate increase to your Top 30 Prestige.</p>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className={cn(
                                            "h-7 px-2 gap-1.5 rounded-full border transition-all text-[10px] font-bold uppercase tracking-wider",
                                            rankUpSagaFilter 
                                                ? "bg-amber-500/20 border-amber-500/40 text-amber-400" 
                                                : "bg-slate-900/50 border-slate-800 text-slate-500 hover:text-slate-300"
                                        )}
                                        onClick={() => onRankUpSagaFilterChange(!rankUpSagaFilter)}
                                    >
                                        <Trophy className={cn("w-3 h-3", rankUpSagaFilter ? "text-amber-400" : "text-slate-500")} />
                                        Saga
                                    </Button>
                                    <ClassFilterSelector selectedClasses={rankUpClassFilter} onChange={onRankUpClassFilterChange} />
                                    <Label className="text-[10px] text-slate-400 uppercase tracking-wider hidden sm:block">Target Rank</Label>
                                    <Select value={String(simulationTargetRank)} onValueChange={onTargetRankChange}>
                                        <SelectTrigger className="h-7 w-[90px] bg-slate-900 border-slate-700 text-slate-300 text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>{[3, 4, 5, 6].map(r => <SelectItem key={r} value={String(r)} className="text-xs">Rank {r}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className={cn("p-4 transition-all duration-500", isPending && recommendations.length > 0 && (pendingSection === 'rank' || pendingSection === 'all') && "blur-[1px] opacity-80 pointer-events-none")}>
                                {isPending && recommendations.length === 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                                        {[1,2,3,4,5].map(i => (
                                            <div key={i} className="flex items-center gap-3 p-2 pr-3 rounded-xl border border-slate-800 bg-slate-900/20 h-[66px]">
                                                <div className="w-12 h-12 rounded-lg bg-slate-800/50 animate-pulse shrink-0" />
                                                <div className="flex flex-col flex-1 gap-2 min-w-0">
                                                    <div className="flex justify-between gap-2">
                                                         <div className="w-8 h-2.5 rounded bg-slate-800/50 animate-pulse" />
                                                         <div className="w-10 h-2.5 rounded bg-slate-800/50 animate-pulse" />
                                                    </div>
                                                    <div className="w-3/4 h-3 rounded bg-slate-800/50 animate-pulse" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : recommendations.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                                        {recommendations.map((rec, i) => {
                                            const colors = getChampionClassColors(rec.championClass);
                                            return (
                                                <div key={i} className={cn("flex items-center gap-3 p-2 pr-3 rounded-xl border transition-all group overflow-hidden relative", colors.bg, "bg-opacity-10 hover:bg-opacity-20", colors.border, "border-opacity-30")}>
                                                    <div className="relative w-12 h-12 shrink-0 rounded-lg overflow-hidden border border-white/10 shadow-sm">
                                                        <Image src={getChampionImageUrl(rec.championImage, 'full')} alt={rec.championName} fill className="object-cover" />
                                                    </div>
                                                    <div className="flex flex-col min-w-0 flex-1">
                                                        <div className="flex items-center justify-between mb-0.5">
                                                            <span className="text-yellow-500 text-[10px] font-bold leading-none">{rec.stars}★</span>
                                                            <div className="flex items-center gap-1 text-[10px] font-bold font-mono text-slate-400">
                                                                <span>R{rec.fromRank}</span><ChevronRight className="w-2.5 h-2.5" /><span className={cn(colors.text, "brightness-150")}>R{rec.toRank}</span>
                                                            </div>
                                                        </div>
                                                        <p className="text-xs font-bold text-slate-100 truncate leading-tight mb-1">{rec.championName}</p>
                                                        <Badge className="w-fit bg-emerald-500/20 text-emerald-400 border-0 text-[10px] px-1.5 py-0 h-4 font-mono font-bold hover:bg-emerald-500/20">+{rec.accountGain}</Badge>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-6 text-center">
                                        <div className="p-2 bg-slate-900/50 rounded-full mb-2">
                                            <Info className="w-5 h-5 text-slate-500" />
                                        </div>
                                        <p className="text-sm font-medium text-slate-400">No prestige-increasing opportunities found.</p>
                                        <p className="text-[11px] text-slate-500 max-w-[400px] mt-1">
                                            Try selecting a higher <span className="text-indigo-400 font-bold">Target Rank</span> or clearing class/saga filters. 
                                            Champions at the current target rank may not have high enough prestige to enter your Top 30.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </Card>

                        <Card className="bg-gradient-to-br from-purple-950/40 via-slate-900/50 to-slate-950 border-purple-500/20 overflow-hidden">
                            <div className="px-4 py-3 border-b border-purple-500/10 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-purple-500/20 rounded-lg"><Sparkles className="w-4 h-4 text-purple-400" /></div>
                                    <h3 className="font-bold text-slate-100">{sigBudget > 0 ? `Recommended Allocation of ${sigBudget} Sig Stones` : "Max Sig Potential"}</h3>
                                    <Popover>
                                        <PopoverTrigger><Info className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer" /></PopoverTrigger>
                                        <PopoverContent className="bg-slate-900 border-slate-800 text-slate-300 max-w-[300px]">
                                            <p>{sigBudget > 0 ? "Optimal stone distribution to maximize your account average with the given budget." : "Champions with the highest potential average increase if taken to Max Sig."}</p>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className={cn(
                                            "h-7 px-2 gap-1.5 rounded-full border transition-all text-[10px] font-bold uppercase tracking-wider",
                                            sigSagaFilter 
                                                ? "bg-amber-500/20 border-amber-500/40 text-amber-400" 
                                                : "bg-slate-900/50 border-slate-800 text-slate-500 hover:text-slate-300"
                                        )}
                                        onClick={() => onSigSagaFilterChange(!sigSagaFilter)}
                                    >
                                        <Trophy className={cn("w-3 h-3", sigSagaFilter ? "text-amber-400" : "text-slate-500")} />
                                        Saga
                                    </Button>
                                    <ClassFilterSelector selectedClasses={sigClassFilter} onChange={onSigClassFilterChange} />
                                    <Label className="text-[10px] text-slate-400 uppercase tracking-wider hidden sm:block whitespace-nowrap">Stone Budget</Label>
                                    <Input 
                                        type="number" 
                                        min={0} 
                                        value={sigBudget || ""} 
                                        placeholder="Max" 
                                        onChange={(e) => onSigBudgetChange(e.target.value ? parseInt(e.target.value) : 0)} 
                                        className="h-7 w-[70px] bg-slate-900 border-slate-700 text-slate-300 text-xs text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                                    />
                                </div>
                            </div>
                            <div className={cn("p-4 transition-all duration-500", isPending && sigRecommendations.length > 0 && (pendingSection === 'sig' || pendingSection === 'all') && "blur-[1px] opacity-80 pointer-events-none")}>
                                {isPending && sigRecommendations.length === 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                                        {[1,2,3,4,5].map(i => (
                                            <div key={i} className="flex items-center gap-3 p-2 pr-3 rounded-xl border border-slate-800 bg-slate-900/20 h-[66px]">
                                                <div className="w-12 h-12 rounded-lg bg-slate-800/50 animate-pulse shrink-0" />
                                                <div className="flex flex-col flex-1 gap-2 min-w-0">
                                                    <div className="flex justify-between gap-2">
                                                         <div className="w-8 h-2.5 rounded bg-slate-800/50 animate-pulse" />
                                                         <div className="w-10 h-2.5 rounded bg-slate-800/50 animate-pulse" />
                                                    </div>
                                                    <div className="w-3/4 h-3 rounded bg-slate-800/50 animate-pulse" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : sigRecommendations.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                                        {sigRecommendations.map((rec, i) => {
                                            const colors = getChampionClassColors(rec.championClass);
                                            return (
                                                <div key={i} onClick={() => onRecommendationClick(rec)} className={cn("flex items-center gap-3 p-2 pr-3 rounded-xl border transition-all group overflow-hidden relative cursor-pointer hover:scale-[1.02] active:scale-[0.98]", colors.bg, "bg-opacity-10 hover:bg-opacity-20", colors.border, "border-opacity-30")}>
                                                    <div className="relative w-12 h-12 shrink-0 rounded-lg overflow-hidden border border-white/10 shadow-sm">
                                                        <Image src={getChampionImageUrl(rec.championImage, 'full')} alt={rec.championName} fill className="object-cover" />
                                                    </div>
                                                    <div className="flex flex-col min-w-0 flex-1">
                                                        <div className="flex items-center justify-between mb-0.5">
                                                            <span className="text-yellow-500 text-[10px] font-bold leading-none">{rec.stars}★ R{rec.rank}</span>
                                                            <div className="flex items-center gap-1 text-[10px] font-bold font-mono text-slate-400">
                                                                <span>S{rec.fromSig}</span><ChevronRight className="w-2.5 h-2.5" /><span className={cn(colors.text, "brightness-150")}>S{rec.toSig}</span>
                                                            </div>
                                                        </div>
                                                        <p className="text-xs font-bold text-slate-100 truncate leading-tight mb-1">{rec.championName}</p>
                                                        <div className="flex items-center gap-2">
                                                            <Badge className="w-fit bg-purple-500/20 text-purple-400 border-0 text-[10px] px-1.5 py-0 h-4 font-mono font-bold hover:bg-purple-500/20">+{rec.accountGain}</Badge>
                                                            {rec.prestigePerSig > 0 && <div className="flex items-center gap-0.5 text-[9px] font-mono text-purple-300/80"><Zap className="w-2.5 h-2.5" />{rec.prestigePerSig}/sig</div>}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-6 text-center">
                                        <div className="p-2 bg-slate-900/50 rounded-full mb-2">
                                            <Sparkles className="w-5 h-5 text-slate-500" />
                                        </div>
                                        <p className="text-sm font-medium text-slate-400">No prestige-increasing sig opportunities found.</p>
                                        <p className="text-[11px] text-slate-500 max-w-[400px] mt-1">
                                            {sigBudget > 0 
                                                ? "Your current sig stone budget may be too low to move any champions into your Top 30."
                                                : "No champions currently gain enough prestige from signature levels to enter your Top 30."}
                                            {" "}Try clearing class or saga filters.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </Card>
                </div>
        </div>
    );
}
