"use client";

import { useEffect, useState, type ReactNode } from "react";
import { TrendingUp, Info, ChevronRight, Sparkles, Zap, Trophy } from "lucide-react";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClassFilterToggle } from "./class-filter-toggle";
import { getChampionImageUrlOrPlaceholder } from "@/lib/championHelper";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { cn } from "@/lib/utils";
import { Recommendation, SigRecommendation, PotentialRecommendation, PrestigeInsightTab } from "../types";
import { ChampionClass } from "@prisma/client";

interface RosterInsightsProps {
    showInsights: boolean;
    recommendations?: Recommendation[];
    sigRecommendations?: SigRecommendation[];
    potentialRecommendations?: PotentialRecommendation[];
    top30Cutoff: number;
    initialInsightTab: PrestigeInsightTab;
    onInsightTabChange: (tab: PrestigeInsightTab) => void;
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
    sigAwakenedOnly: boolean;
    onSigAwakenedOnlyChange: (val: boolean) => void;
    limit: number;
    onLimitChange: (val: number) => void;
    isPending: boolean;
    pendingSection: "rank" | "sig" | "all" | null;
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
    showInsights, recommendations = [], sigRecommendations = [], potentialRecommendations = [], top30Cutoff,
    initialInsightTab, onInsightTabChange,
    simulationTargetRank, onTargetRankChange, sigBudget, onSigBudgetChange,
    rankUpClassFilter, onRankUpClassFilterChange, sigClassFilter, onSigClassFilterChange,
    rankUpSagaFilter, onRankUpSagaFilterChange, sigSagaFilter, onSigSagaFilterChange,
    sigAwakenedOnly, onSigAwakenedOnlyChange,
    limit, onLimitChange,
    isPending, pendingSection, onRecommendationClick
}: RosterInsightsProps) {
    const [activeTab, setActiveTab] = useState<PrestigeInsightTab>(initialInsightTab);

    useEffect(() => {
        setActiveTab(initialInsightTab);
    }, [initialInsightTab]);

    if (!showInsights) return null;

    const handleTabChange = (value: string) => {
        const nextTab = normalizeInsightTab(value);
        setActiveTab(nextTab);
        onInsightTabChange(nextTab);
    };

    const handlePotentialRecommendationClick = (rec: PotentialRecommendation) => {
        const sigsNeeded = rec.toSig - rec.fromSig;
        onRecommendationClick({
            championId: rec.championId,
            championName: rec.championName,
            championClass: rec.championClass,
            championImage: rec.championImage,
            stars: rec.stars,
            ascensionLevel: rec.ascensionLevel,
            rank: rec.toRank,
            fromSig: rec.fromSig,
            toSig: rec.toSig,
            prestigeGain: rec.prestigeGain,
            accountGain: rec.accountGain,
            prestigePerSig: sigsNeeded > 0 ? parseFloat((rec.accountGain / sigsNeeded).toFixed(2)) : 0,
            reason: rec.reason,
            globalPrestigeRank: rec.globalPrestigeRank,
            globalPrestigeRankTotal: rec.globalPrestigeRankTotal,
        });
    };

    const showLimitControl = (
        <div className="flex items-center gap-2">
            <Label className="text-[10px] text-slate-400 uppercase tracking-wider whitespace-nowrap">Show Limit</Label>
            <Select value={String(limit)} onValueChange={(val) => onLimitChange(parseInt(val))}>
                <SelectTrigger className="h-7 w-[80px] bg-slate-950 border-slate-700 text-slate-300 text-xs">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800">
                    {[5, 10, 20].map((num) => (
                        <SelectItem key={num} value={String(num)} className="text-slate-300 focus:bg-slate-800 focus:text-white">
                            Top {num}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );

    const rankControls = (
        <>
            {showLimitControl}
            <SagaToggle active={rankUpSagaFilter} onClick={() => onRankUpSagaFilterChange(!rankUpSagaFilter)} />
            <ClassFilterSelector selectedClasses={rankUpClassFilter} onChange={onRankUpClassFilterChange} />
            <Label className="text-[10px] text-slate-400 uppercase tracking-wider hidden sm:block whitespace-nowrap">Target Rank</Label>
            <Select value={String(simulationTargetRank)} onValueChange={onTargetRankChange}>
                <SelectTrigger className="h-7 w-[90px] bg-slate-950 border-slate-700 text-slate-300 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800">{[3, 4, 5, 6].map(r => <SelectItem key={r} value={String(r)} className="text-xs text-slate-300 focus:bg-slate-800 focus:text-white">Rank {r}</SelectItem>)}</SelectContent>
            </Select>
        </>
    );

    const sigControls = (
        <>
            {showLimitControl}
            <Button
                variant="ghost"
                size="sm"
                className={cn(
                    "h-7 px-2 gap-1.5 rounded-full border transition-all text-[10px] font-bold uppercase tracking-wider",
                    sigAwakenedOnly
                        ? "bg-purple-500/20 border-purple-500/40 text-purple-400"
                        : "bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300"
                )}
                onClick={() => onSigAwakenedOnlyChange(!sigAwakenedOnly)}
            >
                <Sparkles className={cn("w-3 h-3", sigAwakenedOnly ? "text-purple-400" : "text-slate-500")} />
                Dupped
            </Button>
            <SagaToggle active={sigSagaFilter} onClick={() => onSigSagaFilterChange(!sigSagaFilter)} />
            <ClassFilterSelector selectedClasses={sigClassFilter} onChange={onSigClassFilterChange} />
            <Label className="text-[10px] text-slate-400 uppercase tracking-wider hidden sm:block whitespace-nowrap">Stone Budget</Label>
            <Input
                type="number"
                min={0}
                value={sigBudget || ""}
                placeholder="Max"
                onChange={(e) => onSigBudgetChange(e.target.value ? parseInt(e.target.value) : 0)}
                className="h-7 w-[70px] bg-slate-950 border-slate-700 text-slate-300 text-xs text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
        </>
    );

    return (
        <Card className="overflow-hidden border-slate-800 bg-slate-950/60 animate-in slide-in-from-top-2 fade-in duration-300">
            <Tabs value={activeTab} onValueChange={handleTabChange}>
                <div className="flex flex-col gap-4 border-b border-slate-800 px-4 py-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-1 bg-indigo-500/20 rounded-md"><TrendingUp className="w-4 h-4 text-indigo-400" /></div>
                        <h2 className="font-bold text-lg text-slate-100">Prestige Suggestions</h2>
                        <InsightInfo activeTab={activeTab} sigBudget={sigBudget} />
                        {top30Cutoff > 0 && (
                            <span className="ml-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                                #30 Cutoff {top30Cutoff.toLocaleString("en-US")}
                            </span>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {activeTab === "sig" ? sigControls : rankControls}
                    </div>
                </div>

                <div className="px-4 pt-4">
                    <TabsList className="grid h-auto w-full grid-cols-1 gap-2 rounded-none bg-transparent p-0 text-slate-400 sm:grid-cols-3">
                        <InsightTabTrigger value="potential" label="Upgrade Potential" subtitle="Long-term roster upside" count={potentialRecommendations.length} icon={<Trophy className="h-3.5 w-3.5" />} />
                        <InsightTabTrigger value="rank" label="Rank Up" subtitle="Best next rank move" count={recommendations.length} icon={<TrendingUp className="h-3.5 w-3.5" />} />
                        <InsightTabTrigger value="sig" label="Add Sig Stones" subtitle="Stone value and allocation" count={sigRecommendations.length} icon={<Sparkles className="h-3.5 w-3.5" />} />
                    </TabsList>
                </div>

                <TabsContent value="potential" className="mt-0 p-4 focus-visible:ring-0 focus-visible:ring-offset-0">
                    <InsightTabDescription>
                        Find owned champions that could add the most Top 30 Prestige if upgraded to your target rank and max sig.
                    </InsightTabDescription>
                    <RecommendationGrid
                        isPending={isPending}
                        isBlurred={isPending && potentialRecommendations.length > 0 && (pendingSection === "rank" || pendingSection === "all")}
                        itemCount={potentialRecommendations.length}
                        skeletonHeight="h-[74px]"
                        emptyState={
                            <InsightEmptyState
                                icon={<Trophy className="w-5 h-5 text-slate-500" />}
                                title="No upgrade-potential opportunities found."
                                detail={<>Try selecting a higher <span className="text-emerald-400 font-bold">Target Rank</span> or clearing class/saga filters. Champions must gain enough projected prestige to improve your Top 30.</>}
                            />
                        }
                    >
                        {potentialRecommendations.map((rec, i) => <PotentialRecommendationCard key={`${rec.championId}-${i}`} rec={rec} onClick={() => handlePotentialRecommendationClick(rec)} />)}
                    </RecommendationGrid>
                </TabsContent>

                <TabsContent value="rank" className="mt-0 p-4 focus-visible:ring-0 focus-visible:ring-offset-0">
                    <InsightTabDescription>
                        Find the next rank-ups that give the best immediate Top 30 Prestige gain.
                    </InsightTabDescription>
                    <RecommendationGrid
                        isPending={isPending}
                        isBlurred={isPending && recommendations.length > 0 && (pendingSection === "rank" || pendingSection === "all")}
                        itemCount={recommendations.length}
                        skeletonHeight="h-[66px]"
                        emptyState={
                            <InsightEmptyState
                                icon={<Info className="w-5 h-5 text-slate-500" />}
                                title="No rank-up opportunities found."
                                detail={<>Try selecting a higher <span className="text-indigo-400 font-bold">Target Rank</span> or clearing class/saga filters. Champions at the current target may not be high enough to enter your Top 30.</>}
                            />
                        }
                    >
                        {recommendations.map((rec, i) => <RankRecommendationCard key={`${rec.championName}-${i}`} rec={rec} />)}
                    </RecommendationGrid>
                </TabsContent>

                <TabsContent value="sig" className="mt-0 p-4 focus-visible:ring-0 focus-visible:ring-offset-0">
                    <InsightTabDescription>
                        Find where sig stones create the most Top 30 Prestige value at current ranks.
                    </InsightTabDescription>
                    <RecommendationGrid
                        isPending={isPending}
                        isBlurred={isPending && sigRecommendations.length > 0 && (pendingSection === "sig" || pendingSection === "all")}
                        itemCount={sigRecommendations.length}
                        skeletonHeight="h-[66px]"
                        emptyState={
                            <InsightEmptyState
                                icon={<Sparkles className="w-5 h-5 text-slate-500" />}
                                title="No sig stone opportunities found."
                                detail={sigBudget > 0
                                    ? "Your current sig stone budget may be too low to move any champions into your Top 30. Try increasing the budget or clearing filters."
                                    : "No champions currently gain enough prestige from signature levels to enter your Top 30. Try clearing class or saga filters."}
                            />
                        }
                    >
                        {sigRecommendations.map((rec, i) => <SigRecommendationCard key={`${rec.championId}-${i}`} rec={rec} onClick={() => onRecommendationClick(rec)} />)}
                    </RecommendationGrid>
                </TabsContent>
            </Tabs>
        </Card>
    );
}

function normalizeInsightTab(value: string): PrestigeInsightTab {
    if (value === "rank" || value === "sig") return value;
    return "potential";
}

function InsightTabTrigger({ value, label, subtitle, count, icon }: { value: PrestigeInsightTab; label: string; subtitle: string; count: number; icon: ReactNode }) {
    const tone = {
        potential: {
            active: "data-[state=active]:border-emerald-400/50 data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-100",
            icon: "bg-emerald-500/15 text-emerald-400 group-data-[state=active]:bg-emerald-500/25",
            count: "group-data-[state=active]:border-emerald-400/30 group-data-[state=active]:bg-emerald-500/20 group-data-[state=active]:text-emerald-200",
        },
        rank: {
            active: "data-[state=active]:border-indigo-400/50 data-[state=active]:bg-indigo-500/10 data-[state=active]:text-indigo-100",
            icon: "bg-indigo-500/15 text-indigo-400 group-data-[state=active]:bg-indigo-500/25",
            count: "group-data-[state=active]:border-indigo-400/30 group-data-[state=active]:bg-indigo-500/20 group-data-[state=active]:text-indigo-200",
        },
        sig: {
            active: "data-[state=active]:border-purple-400/50 data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-100",
            icon: "bg-purple-500/15 text-purple-400 group-data-[state=active]:bg-purple-500/25",
            count: "group-data-[state=active]:border-purple-400/30 group-data-[state=active]:bg-purple-500/20 group-data-[state=active]:text-purple-200",
        },
    }[value];

    return (
        <TabsTrigger
            value={value}
            className={cn(
                "group min-w-0 justify-start rounded-lg border border-slate-800 bg-slate-900/35 px-3 py-2 text-left shadow-none transition-all hover:border-slate-700 hover:bg-slate-900/60 data-[state=active]:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:min-h-[70px]",
                tone.active
            )}
        >
            <span className="flex w-full min-w-0 items-center gap-2">
                <span className={cn("hidden h-7 w-7 shrink-0 items-center justify-center rounded-md sm:inline-flex", tone.icon)}>
                    {icon}
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-black leading-tight text-slate-100 sm:text-sm">{label}</span>
                    <span className="mt-0.5 hidden truncate text-[10px] font-medium leading-tight text-slate-500 group-data-[state=active]:text-slate-300 md:block">{subtitle}</span>
                </span>
                <span className={cn("rounded-full border border-white/10 bg-black/25 px-1.5 py-0.5 text-[10px] font-mono font-bold leading-none text-slate-300", tone.count)}>
                    {count}
                </span>
            </span>
        </TabsTrigger>
    );
}

function InsightInfo({ activeTab, sigBudget }: { activeTab: PrestigeInsightTab; sigBudget: number }) {
    const copy = activeTab === "potential"
        ? "Shows champions with the biggest projected Top 30 Prestige increase if built to the selected practical target rank and max sig."
        : activeTab === "rank"
            ? "Shows the next rank-ups that provide the highest immediate increase to your Top 30 Prestige."
            : sigBudget > 0
                ? "Shows an optimized sig stone allocation for the current budget."
                : "Shows champions with the highest Top 30 Prestige increase if taken to max sig at their current rank.";

    return (
        <Popover>
            <PopoverTrigger><Info className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer" /></PopoverTrigger>
            <PopoverContent className="bg-slate-900 border-slate-800 text-slate-300 max-w-[300px]">
                <p>{copy}</p>
            </PopoverContent>
        </Popover>
    );
}

function InsightTabDescription({ children }: { children: ReactNode }) {
    return (
        <p className="mb-3 text-xs font-medium leading-relaxed text-slate-400">
            {children}
        </p>
    );
}

function SagaToggle({ active, onClick }: { active: boolean; onClick: () => void }) {
    return (
        <Button
            variant="ghost"
            size="sm"
            className={cn(
                "h-7 px-2 gap-1.5 rounded-full border transition-all text-[10px] font-bold uppercase tracking-wider",
                active
                    ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                    : "bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300"
            )}
            onClick={onClick}
        >
            <Trophy className={cn("w-3 h-3", active ? "text-amber-400" : "text-slate-500")} />
            Saga
        </Button>
    );
}

function RecommendationGrid({
    isPending,
    isBlurred,
    itemCount,
    skeletonHeight,
    emptyState,
    children,
}: {
    isPending: boolean;
    isBlurred: boolean;
    itemCount: number;
    skeletonHeight: string;
    emptyState: ReactNode;
    children: ReactNode;
}) {
    if (isPending && itemCount === 0) {
        return <InsightSkeletonGrid skeletonHeight={skeletonHeight} />;
    }

    if (itemCount === 0) {
        return <>{emptyState}</>;
    }

    return (
        <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 transition-all duration-500", isBlurred && "blur-[1px] opacity-80 pointer-events-none")}>
            {children}
        </div>
    );
}

function InsightSkeletonGrid({ skeletonHeight }: { skeletonHeight: string }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className={cn("flex items-center gap-3 p-2 pr-3 rounded-xl border border-slate-800 bg-slate-900/20", skeletonHeight)}>
                    <div className="w-12 h-12 rounded-lg bg-slate-800/50 animate-pulse shrink-0" />
                    <div className="flex flex-col flex-1 gap-2 min-w-0">
                        <div className="flex justify-between gap-2">
                            <div className="w-8 h-2.5 rounded bg-slate-800/50 animate-pulse" />
                            <div className="w-10 h-2.5 rounded bg-slate-800/50 animate-pulse" />
                        </div>
                        <div className="w-3/4 h-3 rounded bg-slate-800/50 animate-pulse" />
                        {skeletonHeight === "h-[74px]" && <div className="w-1/2 h-2.5 rounded bg-slate-800/50 animate-pulse" />}
                    </div>
                </div>
            ))}
        </div>
    );
}

function InsightEmptyState({ icon, title, detail }: { icon: ReactNode; title: string; detail: ReactNode }) {
    return (
        <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="p-2 bg-slate-900/50 rounded-full mb-2">
                {icon}
            </div>
            <p className="text-sm font-medium text-slate-400">{title}</p>
            <p className="text-[11px] text-slate-500 max-w-[420px] mt-1">{detail}</p>
        </div>
    );
}

function RankRecommendationCard({ rec }: { rec: Recommendation }) {
    const colors = getChampionClassColors(rec.championClass);
    return (
        <div className={cn("flex items-center gap-3 p-2 pr-3 rounded-xl border transition-all group overflow-hidden relative", colors.bg, "bg-opacity-10 hover:bg-opacity-20", colors.border, "border-opacity-30")}>
            <div className="relative w-12 h-12 shrink-0 rounded-lg overflow-hidden border border-white/10 shadow-sm">
                <Image src={getChampionImageUrlOrPlaceholder(rec.championImage, "full")} alt={rec.championName} fill className="object-cover" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] font-bold leading-none text-white">{rec.stars}<span className="text-yellow-500">&#9733;</span>{rec.ascensionLevel > 0 && <span className="text-amber-400 ml-0.5">A{rec.ascensionLevel}</span>}</span>
                    <div className="flex items-center gap-1 text-[10px] font-bold font-mono text-slate-400">
                        <span>R{rec.fromRank}</span><ChevronRight className="w-2.5 h-2.5" /><span className={cn(colors.text, "brightness-150")}>R{rec.toRank}</span>
                    </div>
                </div>
                <p className="text-xs font-bold text-slate-100 truncate leading-tight mb-1">{rec.championName}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                    <Badge className="w-fit bg-emerald-500/20 text-emerald-400 border-0 text-[10px] px-1.5 py-0 h-4 font-mono font-bold hover:bg-emerald-500/20">+{rec.accountGain}</Badge>
                    <GlobalRankPill rank={rec.globalPrestigeRank} total={rec.globalPrestigeRankTotal} />
                </div>
            </div>
        </div>
    );
}

function SigRecommendationCard({ rec, onClick }: { rec: SigRecommendation; onClick: () => void }) {
    const colors = getChampionClassColors(rec.championClass);
    return (
        <div onClick={onClick} className={cn("flex items-center gap-3 p-2 pr-3 rounded-xl border transition-all group overflow-hidden relative cursor-pointer hover:scale-[1.02] active:scale-[0.98]", colors.bg, "bg-opacity-10 hover:bg-opacity-20", colors.border, "border-opacity-30")}>
            <div className="relative w-12 h-12 shrink-0 rounded-lg overflow-hidden border border-white/10 shadow-sm">
                <Image src={getChampionImageUrlOrPlaceholder(rec.championImage, "full")} alt={rec.championName} fill className="object-cover" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] font-bold leading-none text-white">{rec.stars}<span className="text-yellow-500">&#9733;</span> R{rec.rank}{rec.ascensionLevel > 0 && <span className="text-amber-400 ml-0.5">A{rec.ascensionLevel}</span>}</span>
                    <div className="flex items-center gap-1 text-[10px] font-bold font-mono text-slate-400">
                        <span>S{rec.fromSig}</span><ChevronRight className="w-2.5 h-2.5" /><span className={cn(colors.text, "brightness-150")}>S{rec.toSig}</span>
                    </div>
                </div>
                <p className="text-xs font-bold text-slate-100 truncate leading-tight mb-1">{rec.championName}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                    <Badge className="w-fit bg-purple-500/20 text-purple-400 border-0 text-[10px] px-1.5 py-0 h-4 font-mono font-bold hover:bg-purple-500/20">+{rec.accountGain}</Badge>
                    <GlobalRankPill rank={rec.globalPrestigeRank} total={rec.globalPrestigeRankTotal} />
                    {rec.prestigePerSig > 0 && <div className="flex items-center gap-0.5 text-[9px] font-mono text-purple-300/80"><Zap className="w-2.5 h-2.5" />{rec.prestigePerSig}/sig</div>}
                </div>
            </div>
        </div>
    );
}

function PotentialRecommendationCard({ rec, onClick }: { rec: PotentialRecommendation; onClick: () => void }) {
    const colors = getChampionClassColors(rec.championClass);
    return (
        <div onClick={onClick} className={cn("flex items-center gap-3 p-2 pr-3 rounded-xl border transition-all group overflow-hidden relative cursor-pointer hover:scale-[1.02] active:scale-[0.98]", colors.bg, "bg-opacity-10 hover:bg-opacity-20", colors.border, "border-opacity-30")}>
            <div className="relative w-12 h-12 shrink-0 rounded-lg overflow-hidden border border-white/10 shadow-sm">
                <Image src={getChampionImageUrlOrPlaceholder(rec.championImage, "full")} alt={rec.championName} fill className="object-cover" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center justify-between mb-0.5 gap-2">
                    <span className="text-[10px] font-bold leading-none text-white shrink-0">{rec.stars}<span className="text-yellow-500">&#9733;</span>{rec.ascensionLevel > 0 && <span className="text-amber-400 ml-0.5">A{rec.ascensionLevel}</span>}</span>
                    <div className="flex items-center gap-1 text-[10px] font-bold font-mono text-slate-400 min-w-0">
                        <span>R{rec.fromRank}</span><ChevronRight className="w-2.5 h-2.5 shrink-0" /><span className={cn(colors.text, "brightness-150")}>R{rec.toRank}</span>
                        <span className="text-slate-600">/</span>
                        <span>S{rec.fromSig}</span><ChevronRight className="w-2.5 h-2.5 shrink-0" /><span className={cn(colors.text, "brightness-150")}>S{rec.toSig}</span>
                    </div>
                </div>
                <p className="text-xs font-bold text-slate-100 truncate leading-tight mb-1">{rec.championName}</p>
                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    <Badge className="w-fit bg-emerald-500/20 text-emerald-400 border-0 text-[10px] px-1.5 py-0 h-4 font-mono font-bold hover:bg-emerald-500/20">+{rec.accountGain}</Badge>
                    <GlobalRankPill rank={rec.globalPrestigeRank} total={rec.globalPrestigeRankTotal} />
                    <div className="text-[9px] font-mono text-emerald-300/80 truncate">
                        {rec.currentPrestige.toLocaleString("en-US")} -&gt; {rec.targetPrestige.toLocaleString("en-US")}
                    </div>
                </div>
            </div>
        </div>
    );
}

function GlobalRankPill({ rank, total }: { rank: number | null; total: number | null }) {
    if (!rank) return null;
    const tone = globalRankTone(rank);
    return (
        <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold leading-none ring-1", tone)} title={total ? `Ranked against ${total} champions at this rarity, rank, and sig target.` : undefined}>
            Global #{rank}
        </span>
    );
}

function globalRankTone(rank: number) {
    if (rank === 1) return "bg-amber-400/20 text-amber-200 ring-amber-300/35 shadow-[0_0_12px_rgba(251,191,36,0.18)]";
    if (rank <= 5) return "bg-yellow-500/15 text-yellow-200 ring-yellow-400/30";
    if (rank <= 10) return "bg-emerald-500/15 text-emerald-200 ring-emerald-400/25";
    if (rank <= 25) return "bg-sky-500/12 text-sky-300 ring-sky-400/20";
    return "bg-slate-800/70 text-slate-400 ring-white/10";
}
