"use client";

import { useEffect, useState, type ReactNode } from "react";
import { TrendingUp, Info, ChevronRight, Sparkles, Trophy, Search, Globe2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClassFilterToggle } from "./class-filter-toggle";
import { PrestigeImpactModal } from "./modals/prestige-impact-modal";
import { getChampionImageUrlOrPlaceholder } from "@/lib/championHelper";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { cn } from "@/lib/utils";
import { Recommendation, SigRecommendation, PotentialRecommendation, PrestigeInsightTab } from "../types";
import { ChampionClass } from "@prisma/client";
import {
    normalizeGlobalPrestigeListOptionValues,
    type GlobalPrestigeListEntry,
    type GlobalPrestigeListOptions,
} from "@/lib/global-prestige-list";
import { reportClientError } from "@/lib/observability/client";

interface RosterInsightsProps {
    showInsights: boolean;
    recommendations?: Recommendation[];
    sigRecommendations?: SigRecommendation[];
    potentialRecommendations?: PotentialRecommendation[];
    initialInsightTab: PrestigeInsightTab;
    onInsightTabChange: (tab: PrestigeInsightTab) => void;
    targetPlayerId?: string;
    initialGlobalPrestigeOptions: GlobalPrestigeListOptions;
    onGlobalPrestigeOptionsChange: (options: GlobalPrestigeListOptions) => void;
    globalDefaultTargetRank: number;
    globalMaxRankForRarity: (rarity: number) => number;
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
        <div className="flex min-w-0 items-center overflow-x-auto">
            <ClassFilterToggle selectedClasses={selectedClasses} onChange={onChange} size="sm" className="bg-slate-900/50 p-1 rounded-full border border-slate-800" />
        </div>
    );
}

function buildGlobalPrestigeApiQuery(options: GlobalPrestigeListOptions, targetPlayerId?: string) {
    const params = new URLSearchParams({
        rarity: String(options.rarity),
        rank: String(options.rank),
        sig: String(options.sig),
        ascensionLevel: String(options.ascensionLevel),
        ownership: options.ownership,
        saga: String(options.sagaOnly),
        search: options.search,
        limit: String(options.limit),
    });
    if (options.classFilter.length > 0) params.set("classFilter", options.classFilter.join(","));
    if (targetPlayerId) params.set("playerId", targetPlayerId);
    return params.toString();
}

export function RosterInsights({
    showInsights, recommendations = [], sigRecommendations = [], potentialRecommendations = [],
    initialInsightTab, onInsightTabChange,
    targetPlayerId, initialGlobalPrestigeOptions, onGlobalPrestigeOptionsChange, globalDefaultTargetRank, globalMaxRankForRarity,
    simulationTargetRank, onTargetRankChange, sigBudget, onSigBudgetChange,
    rankUpClassFilter, onRankUpClassFilterChange, sigClassFilter, onSigClassFilterChange,
    rankUpSagaFilter, onRankUpSagaFilterChange, sigSagaFilter, onSigSagaFilterChange,
    sigAwakenedOnly, onSigAwakenedOnlyChange,
    limit, onLimitChange,
    isPending, pendingSection, onRecommendationClick
}: RosterInsightsProps) {
    const [activeTab, setActiveTab] = useState<PrestigeInsightTab>(initialInsightTab);
    const [globalOptions, setGlobalOptions] = useState<GlobalPrestigeListOptions>(initialGlobalPrestigeOptions);
    const [globalEntries, setGlobalEntries] = useState<GlobalPrestigeListEntry[]>([]);
    const [globalTotalMatching, setGlobalTotalMatching] = useState(0);
    const [isLoadingGlobalPrestige, setIsLoadingGlobalPrestige] = useState(false);
    const [globalPrestigeError, setGlobalPrestigeError] = useState<string | null>(null);
    const [impactModal, setImpactModal] = useState<{ type: "potential"; rec: PotentialRecommendation } | { type: "rank"; rec: Recommendation } | null>(null);

    useEffect(() => {
        setActiveTab(initialInsightTab);
    }, [initialInsightTab]);

    useEffect(() => {
        setGlobalOptions(initialGlobalPrestigeOptions);
    }, [initialGlobalPrestigeOptions]);

    useEffect(() => {
        if (!showInsights || activeTab !== "global") return;

        const controller = new AbortController();
        const fetchGlobalPrestige = async () => {
            setIsLoadingGlobalPrestige(true);
            setGlobalPrestigeError(null);
            try {
                const query = buildGlobalPrestigeApiQuery(globalOptions, targetPlayerId);
                const res = await fetch(`/api/profile/roster/global-prestige?${query}`, { signal: controller.signal });
                if (!res.ok) throw new Error("Failed to load global prestige list");
                const data = await res.json() as {
                    options: GlobalPrestigeListOptions;
                    entries: GlobalPrestigeListEntry[];
                    totalMatching: number;
                };
                setGlobalOptions(current => JSON.stringify(current) === JSON.stringify(data.options) ? current : data.options);
                setGlobalEntries(data.entries);
                setGlobalTotalMatching(data.totalMatching);
            } catch (error) {
                if (error instanceof Error && error.name === "AbortError") return;
                reportClientError("profile_roster_fetch_global_prestige", error, { player_id: targetPlayerId });
                setGlobalPrestigeError("Could not load global prestige champions.");
            } finally {
                if (!controller.signal.aborted) setIsLoadingGlobalPrestige(false);
            }
        };

        fetchGlobalPrestige();
        return () => controller.abort();
    }, [activeTab, globalOptions, showInsights, targetPlayerId]);

    if (!showInsights) return null;

    const handleTabChange = (value: string) => {
        const nextTab = normalizeInsightTab(value);
        setActiveTab(nextTab);
        onInsightTabChange(nextTab);
    };

    const updateGlobalOptions = (updates: Partial<GlobalPrestigeListOptions>) => {
        const next = normalizeGlobalPrestigeListOptionValues({ ...globalOptions, ...updates }, globalDefaultTargetRank);
        setGlobalOptions(next);
        onGlobalPrestigeOptionsChange(next);
    };

    const showLimitControl = (
        <div className="flex items-center gap-2">
            <Label className="text-[10px] text-slate-400 uppercase tracking-wider whitespace-nowrap">Show Limit</Label>
            <Select value={String(limit)} onValueChange={(val) => onLimitChange(parseInt(val))}>
                <SelectTrigger className="h-7 w-[92px] bg-slate-950 border-slate-700 text-slate-300 text-xs">
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

    const globalControls = (
        <GlobalPrestigeControls
            options={globalOptions}
            onChange={updateGlobalOptions}
            defaultTargetRank={globalDefaultTargetRank}
            maxRankForRarity={globalMaxRankForRarity}
        />
    );

    return (
        <Card className="overflow-hidden border-slate-800 bg-slate-950/60 animate-in slide-in-from-top-2 fade-in duration-300">
            <Tabs value={activeTab} onValueChange={handleTabChange}>
                <div className="flex flex-col gap-4 border-b border-slate-800 px-4 py-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-1 bg-indigo-500/20 rounded-md"><TrendingUp className="w-4 h-4 text-indigo-400" /></div>
                        <h2 className="font-bold text-lg text-slate-100">Prestige Suggestions</h2>
                        <InsightInfo activeTab={activeTab} sigBudget={sigBudget} />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {activeTab === "global" ? globalControls : activeTab === "sig" ? sigControls : rankControls}
                    </div>
                </div>

                <div className="px-4 pt-4">
                    <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-none bg-transparent p-0 text-slate-400 xl:grid-cols-4">
                        <InsightTabTrigger value="potential" label="Upgrade Potential" subtitle="Long-term roster upside" icon={<Trophy className="h-3.5 w-3.5" />} />
                        <InsightTabTrigger value="rank" label="Rank Up" subtitle="Best next rank move" icon={<TrendingUp className="h-3.5 w-3.5" />} />
                        <InsightTabTrigger value="sig" label="Add Sig Stones" subtitle="Stone value and allocation" icon={<Sparkles className="h-3.5 w-3.5" />} />
                        <InsightTabTrigger value="global" label="Global Prestige" subtitle="Top prestige champions" icon={<Globe2 className="h-3.5 w-3.5" />} />
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
                        emptyState={
                            <InsightEmptyState
                                icon={<Trophy className="w-5 h-5 text-slate-500" />}
                                title="No upgrade-potential opportunities found."
                                detail={<>Try selecting a higher <span className="text-emerald-400 font-bold">Target Rank</span> or clearing class/saga filters. Champions must gain enough projected prestige to improve your Top 30.</>}
                            />
                        }
                    >
                        {potentialRecommendations.map((rec, i) => <PotentialRecommendationCard key={`${rec.championId}-${i}`} rec={rec} onClick={() => setImpactModal({ type: "potential", rec })} />)}
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
                        emptyState={
                            <InsightEmptyState
                                icon={<Info className="w-5 h-5 text-slate-500" />}
                                title="No rank-up opportunities found."
                                detail={<>Try selecting a higher <span className="text-indigo-400 font-bold">Target Rank</span> or clearing class/saga filters. Champions at the current target may not be high enough to enter your Top 30.</>}
                            />
                        }
                    >
                        {recommendations.map((rec, i) => <RankRecommendationCard key={`${rec.championName}-${i}`} rec={rec} onClick={() => setImpactModal({ type: "rank", rec })} />)}
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

                <TabsContent value="global" className="mt-0 p-4 focus-visible:ring-0 focus-visible:ring-offset-0">
                    <InsightTabDescription>
                        Browse the highest-prestige champions at a selected rarity, rank, sig, and ascension target.
                    </InsightTabDescription>
                    <GlobalPrestigeList
                        entries={globalEntries}
                        totalMatching={globalTotalMatching}
                        isLoading={isLoadingGlobalPrestige}
                        error={globalPrestigeError}
                    />
                </TabsContent>
            </Tabs>
            <PrestigeImpactModal impact={impactModal} onClose={() => setImpactModal(null)} />
        </Card>
    );
}

function normalizeInsightTab(value: string): PrestigeInsightTab {
    if (value === "rank" || value === "sig" || value === "global") return value;
    return "potential";
}

function InsightTabTrigger({ value, label, subtitle, icon }: { value: PrestigeInsightTab; label: string; subtitle: string; icon: ReactNode }) {
    const tone = {
        potential: {
            active: "data-[state=active]:border-emerald-400/50 data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-100",
            icon: "bg-emerald-500/15 text-emerald-400 group-data-[state=active]:bg-emerald-500/25",
        },
        rank: {
            active: "data-[state=active]:border-indigo-400/50 data-[state=active]:bg-indigo-500/10 data-[state=active]:text-indigo-100",
            icon: "bg-indigo-500/15 text-indigo-400 group-data-[state=active]:bg-indigo-500/25",
        },
        sig: {
            active: "data-[state=active]:border-purple-400/50 data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-100",
            icon: "bg-purple-500/15 text-purple-400 group-data-[state=active]:bg-purple-500/25",
        },
        global: {
            active: "data-[state=active]:border-sky-400/50 data-[state=active]:bg-sky-500/10 data-[state=active]:text-sky-100",
            icon: "bg-sky-500/15 text-sky-400 group-data-[state=active]:bg-sky-500/25",
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
                <span className={cn("inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md", tone.icon)}>
                    {icon}
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-black leading-tight text-slate-100 sm:text-sm">{label}</span>
                    <span className="mt-0.5 hidden truncate text-[10px] font-medium leading-tight text-slate-500 group-data-[state=active]:text-slate-300 md:block">{subtitle}</span>
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
            : activeTab === "global"
                ? "Shows the highest-prestige obtainable champions at the selected target state, with owned and missing roster context."
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

function GlobalPrestigeControls({
    options,
    onChange,
    defaultTargetRank,
    maxRankForRarity,
}: {
    options: GlobalPrestigeListOptions;
    onChange: (updates: Partial<GlobalPrestigeListOptions>) => void;
    defaultTargetRank: number;
    maxRankForRarity: (rarity: number) => number;
}) {
    const rankOptions = Array.from({ length: maxRankForRarity(options.rarity) }, (_, index) => index + 1);
    const sigOptions = [0, 1, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200];
    const selectedSig = sigOptions.includes(options.sig) ? String(options.sig) : String(Math.min(options.sig, 200));

    return (
        <>
            <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                <Input
                    value={options.search}
                    placeholder="Search champions"
                    onChange={(event) => onChange({ search: event.target.value })}
                    className="h-7 w-[170px] bg-slate-950 border-slate-700 pl-7 text-xs text-slate-300 placeholder:text-slate-600"
                />
            </div>
            <Select
                value={String(options.rarity)}
                onValueChange={(value) => {
                    const rarity = parseInt(value, 10);
                    onChange({
                        rarity,
                        rank: rarity === 7 ? defaultTargetRank : maxRankForRarity(rarity),
                        ascensionLevel: rarity === 7 ? options.ascensionLevel : 0,
                    });
                }}
            >
                <SelectTrigger className="h-7 w-[64px] bg-slate-950 border-slate-700 text-slate-300 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800">
                    {[7, 6, 5].map(rarity => <SelectItem key={rarity} value={String(rarity)} className="text-xs text-slate-300 focus:bg-slate-800 focus:text-white">{rarity}&#9733;</SelectItem>)}
                </SelectContent>
            </Select>
            <Select value={String(options.rank)} onValueChange={(value) => onChange({ rank: parseInt(value, 10) })}>
                <SelectTrigger className="h-7 w-[88px] bg-slate-950 border-slate-700 text-slate-300 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800">
                    {rankOptions.map(rank => <SelectItem key={rank} value={String(rank)} className="text-xs text-slate-300 focus:bg-slate-800 focus:text-white">Rank {rank}</SelectItem>)}
                </SelectContent>
            </Select>
            <Select value={selectedSig} onValueChange={(value) => onChange({ sig: parseInt(value, 10) })}>
                <SelectTrigger className="h-7 w-[72px] bg-slate-950 border-slate-700 text-slate-300 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800">
                    {sigOptions.map(sig => <SelectItem key={sig} value={String(sig)} className="text-xs text-slate-300 focus:bg-slate-800 focus:text-white">S{sig}</SelectItem>)}
                </SelectContent>
            </Select>
            {options.rarity === 7 && (
                <Select value={String(options.ascensionLevel)} onValueChange={(value) => onChange({ ascensionLevel: parseInt(value, 10) })}>
                    <SelectTrigger className="h-7 w-[64px] bg-slate-950 border-slate-700 text-slate-300 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800">
                        {[0, 1, 2, 3, 4, 5].map(level => <SelectItem key={level} value={String(level)} className="text-xs text-slate-300 focus:bg-slate-800 focus:text-white">A{level}</SelectItem>)}
                    </SelectContent>
                </Select>
            )}
            <ClassFilterSelector selectedClasses={options.classFilter} onChange={(classFilter) => onChange({ classFilter })} />
            <Select value={options.ownership} onValueChange={(value) => onChange({ ownership: value as GlobalPrestigeListOptions["ownership"] })}>
                <SelectTrigger className="h-7 w-[92px] bg-slate-950 border-slate-700 text-slate-300 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800">
                    <SelectItem value="all" className="text-xs text-slate-300 focus:bg-slate-800 focus:text-white">All</SelectItem>
                    <SelectItem value="owned" className="text-xs text-slate-300 focus:bg-slate-800 focus:text-white">Owned</SelectItem>
                    <SelectItem value="missing" className="text-xs text-slate-300 focus:bg-slate-800 focus:text-white">Missing</SelectItem>
                </SelectContent>
            </Select>
            <SagaToggle active={options.sagaOnly} onClick={() => onChange({ sagaOnly: !options.sagaOnly })} />
            <Select value={String(options.limit)} onValueChange={(value) => onChange({ limit: parseInt(value, 10) })}>
                <SelectTrigger className="h-7 w-[88px] bg-slate-950 border-slate-700 text-slate-300 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800">
                    {[30, 50, 100].map(limit => <SelectItem key={limit} value={String(limit)} className="text-xs text-slate-300 focus:bg-slate-800 focus:text-white">Top {limit}</SelectItem>)}
                </SelectContent>
            </Select>
        </>
    );
}

function GlobalPrestigeList({
    entries,
    totalMatching,
    isLoading,
    error,
}: {
    entries: GlobalPrestigeListEntry[];
    totalMatching: number;
    isLoading: boolean;
    error: string | null;
}) {
    if (isLoading && entries.length === 0) {
        return <GlobalPrestigeSkeletonRows />;
    }

    if (error) {
        return (
            <InsightEmptyState
                icon={<Info className="w-5 h-5 text-slate-500" />}
                title={error}
                detail="Try changing a filter or reloading the page."
            />
        );
    }

    if (entries.length === 0) {
        return (
            <InsightEmptyState
                icon={<Globe2 className="w-5 h-5 text-slate-500" />}
                title="No global prestige champions found."
                detail="Try clearing search, class, Saga, or ownership filters."
            />
        );
    }

    return (
        <div className={cn("space-y-2 transition-opacity", isLoading && "opacity-70")}>
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <span>Showing {entries.length.toLocaleString("en-US")} of {totalMatching.toLocaleString("en-US")}</span>
                <span>Target Prestige</span>
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-800">
                {entries.map(entry => <GlobalPrestigeRow key={`${entry.championId}-${entry.targetRarity}`} entry={entry} />)}
            </div>
        </div>
    );
}

function GlobalPrestigeSkeletonRows() {
    return (
        <div className="overflow-hidden rounded-lg border border-slate-800">
            {Array.from({ length: 8 }, (_, index) => (
                <div key={index} className="grid min-w-0 grid-cols-[72px_minmax(0,1fr)_110px] items-center gap-3 border-b border-slate-900/80 bg-slate-900/20 p-2 last:border-b-0 md:grid-cols-[90px_minmax(0,1.5fr)_150px_140px_130px]">
                    <div className="h-5 w-14 animate-pulse rounded bg-slate-800/60" />
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 animate-pulse rounded bg-slate-800/60" />
                        <div className="space-y-2">
                            <div className="h-3 w-32 animate-pulse rounded bg-slate-800/60" />
                            <div className="h-2.5 w-20 animate-pulse rounded bg-slate-800/60" />
                        </div>
                    </div>
                    <div className="h-5 w-20 animate-pulse rounded bg-slate-800/60" />
                    <div className="hidden h-5 w-24 animate-pulse rounded bg-slate-800/60 md:block" />
                    <div className="hidden h-5 w-24 animate-pulse rounded bg-slate-800/60 md:block" />
                </div>
            ))}
        </div>
    );
}

function GlobalPrestigeRow({ entry }: { entry: GlobalPrestigeListEntry }) {
    const colors = getChampionClassColors(entry.championClass);
    const name = entry.championSlug ? (
        <Link href={`/champions/${entry.championSlug}`} className="block truncate text-sm font-bold text-slate-100 hover:text-sky-300" title={entry.championName}>
            {entry.championName}
        </Link>
    ) : (
        <span className="block truncate text-sm font-bold text-slate-100" title={entry.championName}>{entry.championName}</span>
    );

    return (
        <div className="grid min-w-0 grid-cols-[42px_minmax(0,1fr)_auto] gap-x-2 gap-y-1 border-b border-slate-900/80 bg-slate-950/30 p-2 last:border-b-0 sm:grid-cols-[70px_minmax(0,1fr)_auto] md:grid-cols-[90px_minmax(0,1.5fr)_150px_140px_130px] md:items-center md:gap-3">
            <div className="row-span-2 flex items-center md:row-span-1">
                <span className={cn("rounded px-2 py-1 text-[10px] font-bold leading-none ring-1", globalRankTone(entry.globalRank))}>
                    <span className="sm:hidden">#{entry.globalRank}</span>
                    <span className="hidden sm:inline">Global #{entry.globalRank}</span>
                </span>
            </div>
            <div className="flex min-w-0 items-center gap-3">
                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md border border-white/10 bg-slate-900">
                    <Image src={getChampionImageUrlOrPlaceholder(entry.championImage, "full")} alt={entry.championName} fill className="object-cover" />
                </div>
                <div className="min-w-0">
                    {name}
                    <div className={cn("mt-0.5 text-[10px] font-bold uppercase tracking-wider", colors.text)}>{entry.championClass}</div>
                </div>
            </div>
            <div className="col-start-2 min-w-0 whitespace-nowrap pl-[56px] text-[10px] font-mono text-slate-300 md:col-start-auto md:pl-0 md:text-[11px]">
                <span>{entry.targetRarity}<span className="text-yellow-500">&#9733;</span> R{entry.targetRank} S{entry.targetSig}</span>
                {entry.targetRarity === 7 && <span className="text-amber-300">A{entry.targetAscensionLevel}</span>}
            </div>
            <div className="col-start-3 row-start-1 text-right text-base font-black font-mono text-slate-100 md:col-start-auto md:row-start-auto md:text-left md:text-lg">
                {entry.targetPrestige.toLocaleString("en-US")}
            </div>
            <div className="col-start-3 row-start-2 min-w-0 text-right md:col-start-auto md:row-start-auto md:text-left">
                <Badge className={cn("border-0 px-2 py-0.5 text-[10px] font-bold", entry.isOwned ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-800 text-slate-300")}>
                    {entry.ownedGapLabel}
                </Badge>
            </div>
        </div>
    );
}

function RecommendationGrid({
    isPending,
    isBlurred,
    itemCount,
    emptyState,
    children,
}: {
    isPending: boolean;
    isBlurred: boolean;
    itemCount: number;
    emptyState: ReactNode;
    children: ReactNode;
}) {
    if (isPending && itemCount === 0) {
        return <InsightSkeletonGrid />;
    }

    if (itemCount === 0) {
        return <>{emptyState}</>;
    }

    return (
        <div className={cn("grid grid-cols-1 gap-3 transition-all duration-500", isBlurred && "blur-[1px] opacity-80 pointer-events-none")}>
            {children}
        </div>
    );
}

function InsightSkeletonGrid() {
    return (
        <div className="grid grid-cols-1 gap-3">
            {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="grid min-h-[86px] grid-cols-[56px_minmax(0,1fr)] gap-3 rounded-xl border border-slate-800 bg-slate-900/20 p-3 md:grid-cols-[64px_minmax(0,1fr)_180px_150px_150px] md:items-center">
                    <div className="h-14 w-14 rounded-lg bg-slate-800/50 animate-pulse shrink-0 md:h-16 md:w-16" />
                    <div className="flex flex-col gap-2 min-w-0">
                        <div className="w-28 h-3 rounded bg-slate-800/50 animate-pulse" />
                        <div className="w-44 h-4 rounded bg-slate-800/50 animate-pulse" />
                        <div className="w-24 h-2.5 rounded bg-slate-800/50 animate-pulse" />
                    </div>
                    <div className="hidden h-8 rounded bg-slate-800/50 animate-pulse md:block" />
                    <div className="hidden h-8 rounded bg-slate-800/50 animate-pulse md:block" />
                    <div className="hidden h-8 rounded bg-slate-800/50 animate-pulse md:block" />
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

function RankRecommendationCard({ rec, onClick }: { rec: Recommendation; onClick: () => void }) {
    return (
        <PrestigeRecommendationRow
            championName={rec.championName}
            championClass={rec.championClass}
            championImage={rec.championImage}
            rarity={rec.stars}
            ascensionLevel={rec.ascensionLevel}
            moveLabel={<><span>R{rec.fromRank}</span><ChevronRight className="h-3 w-3" /><span>R{rec.toRank}</span></>}
            primaryMetric={{ label: "Account Gain", value: `+${rec.accountGain.toLocaleString("en-US")}` }}
            secondaryMetric={{ label: "Prestige Gain", value: `+${rec.prestigeGain.toLocaleString("en-US")}` }}
            globalRank={rec.globalPrestigeRank}
            globalRankTotal={rec.globalPrestigeRankTotal}
            tone="rank"
            onClick={onClick}
        />
    );
}

function SigRecommendationCard({ rec, onClick }: { rec: SigRecommendation; onClick: () => void }) {
    return (
        <PrestigeRecommendationRow
            championName={rec.championName}
            championClass={rec.championClass}
            championImage={rec.championImage}
            rarity={rec.stars}
            rank={rec.rank}
            ascensionLevel={rec.ascensionLevel}
            moveLabel={<><span>S{rec.fromSig}</span><ChevronRight className="h-3 w-3" /><span>S{rec.toSig}</span></>}
            primaryMetric={{ label: "Account Gain", value: `+${rec.accountGain.toLocaleString("en-US")}` }}
            secondaryMetric={{ label: "Prestige Gain", value: `+${rec.prestigeGain.toLocaleString("en-US")}` }}
            detailMetric={rec.prestigePerSig > 0 ? { label: "Per Sig", value: rec.prestigePerSig.toLocaleString("en-US") } : undefined}
            globalRank={rec.globalPrestigeRank}
            globalRankTotal={rec.globalPrestigeRankTotal}
            tone="sig"
            onClick={onClick}
        />
    );
}

function PotentialRecommendationCard({ rec, onClick }: { rec: PotentialRecommendation; onClick: () => void }) {
    return (
        <PrestigeRecommendationRow
            championName={rec.championName}
            championClass={rec.championClass}
            championImage={rec.championImage}
            rarity={rec.stars}
            ascensionLevel={rec.ascensionLevel}
            moveLabel={<><span>R{rec.fromRank} S{rec.fromSig}</span><ChevronRight className="h-3 w-3" /><span>R{rec.toRank} S{rec.toSig}</span></>}
            primaryMetric={{ label: "Account Gain", value: `+${rec.accountGain.toLocaleString("en-US")}` }}
            detailMetric={{ label: "Target Prestige", value: rec.targetPrestige.toLocaleString("en-US") }}
            globalRank={rec.globalPrestigeRank}
            globalRankTotal={rec.globalPrestigeRankTotal}
            tone="potential"
            onClick={onClick}
        />
    );
}

function PrestigeRecommendationRow({
    championName,
    championClass,
    championImage,
    rarity,
    rank,
    ascensionLevel,
    moveLabel,
    primaryMetric,
    secondaryMetric,
    detailMetric,
    globalRank,
    globalRankTotal,
    tone,
    onClick,
}: {
    championName: string;
    championClass: ChampionClass;
    championImage: Recommendation["championImage"];
    rarity: number;
    rank?: number;
    ascensionLevel: number;
    moveLabel: ReactNode;
    primaryMetric: { label: string; value: string };
    secondaryMetric?: { label: string; value: string };
    detailMetric?: { label: string; value: string };
    globalRank: number | null;
    globalRankTotal: number | null;
    tone: "potential" | "rank" | "sig";
    onClick?: () => void;
}) {
    const colors = getChampionClassColors(championClass);
    const toneStyles = {
        potential: {
            border: "border-emerald-500/20 hover:border-emerald-400/45",
            glow: "hover:shadow-[0_14px_44px_rgba(16,185,129,0.10)]",
            icon: "bg-emerald-500/15 text-emerald-300",
            metric: "text-emerald-300",
            badge: "bg-emerald-500/15 text-emerald-300",
        },
        rank: {
            border: "border-indigo-500/20 hover:border-indigo-400/45",
            glow: "hover:shadow-[0_14px_44px_rgba(99,102,241,0.12)]",
            icon: "bg-indigo-500/15 text-indigo-300",
            metric: "text-indigo-300",
            badge: "bg-indigo-500/15 text-indigo-300",
        },
        sig: {
            border: "border-purple-500/20 hover:border-purple-400/45",
            glow: "hover:shadow-[0_14px_44px_rgba(168,85,247,0.12)]",
            icon: "bg-purple-500/15 text-purple-300",
            metric: "text-purple-300",
            badge: "bg-purple-500/15 text-purple-300",
        },
    }[tone];
    const Component = onClick ? "button" : "div";

    return (
        <Component
            type={onClick ? "button" : undefined}
            onClick={onClick}
            className={cn(
                "group grid min-w-0 grid-cols-[48px_minmax(0,1fr)] gap-3 border-b border-slate-900/80 bg-slate-950/45 p-2.5 text-left transition-all last:border-b-0 sm:grid-cols-[52px_minmax(140px,1fr)_140px_110px_120px] sm:items-center sm:gap-3 md:grid-cols-[52px_minmax(0,1.4fr)_180px_132px_132px] md:px-3",
                toneStyles.border,
                toneStyles.glow,
                onClick && "cursor-pointer active:scale-[0.995]"
            )}
        >
            <div className={cn("relative h-12 w-12 overflow-hidden rounded-md border shadow-sm", colors.border, "border-opacity-70")}>
                <Image src={getChampionImageUrlOrPlaceholder(championImage, "full")} alt={championName} fill className="object-cover transition-transform duration-300 group-hover:scale-105" />
            </div>

            <div className="min-w-0">
                <div className="mb-1 flex min-w-0 flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-black leading-none text-white">
                        {rarity}<span className="text-yellow-500">&#9733;</span>{rank ? ` R${rank}` : ""}{ascensionLevel > 0 && <span className="text-amber-400 ml-0.5">A{ascensionLevel}</span>}
                    </span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider", toneStyles.badge)}>
                        {tone === "potential" ? "Upgrade" : tone === "rank" ? "Rank Up" : "Sig Stones"}
                    </span>
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p className="min-w-0 truncate text-sm font-black leading-tight text-slate-100 md:text-[15px]" title={championName}>{championName}</p>
                    <GlobalRankPill rank={globalRank} total={globalRankTotal} />
                </div>
            </div>

            <div className="col-start-2 flex min-w-0 flex-wrap items-center gap-2 text-xs font-black text-slate-300 sm:col-start-auto sm:row-start-auto sm:justify-start">
                <span className={cn("inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-mono ring-1 ring-white/10", toneStyles.icon)}>
                    {moveLabel}
                </span>
            </div>

            <MetricBlock label={primaryMetric.label} value={primaryMetric.value} className={toneStyles.metric} />

            <div className="col-start-2 grid min-w-0 grid-cols-2 gap-2 sm:col-start-auto sm:row-start-auto sm:block">
                {secondaryMetric && <MetricBlock label={secondaryMetric.label} value={secondaryMetric.value} />}
                {detailMetric && <MetricBlock label={detailMetric.label} value={detailMetric.value} compact />}
            </div>
        </Component>
    );
}

function MetricBlock({ label, value, className, compact = false }: { label: string; value: string; className?: string; compact?: boolean }) {
    return (
        <div className="min-w-0">
            <div className="text-[9px] font-black uppercase tracking-wider text-slate-500">{label}</div>
            <div className={cn(compact ? "text-xs" : "text-lg", "mt-0.5 truncate font-black font-mono text-slate-100", className)}>{value}</div>
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
