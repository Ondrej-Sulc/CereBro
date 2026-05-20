"use client";

import type React from "react";
import { Badge } from "@/components/ui/badge";
import { InfoPopover } from "@/components/ui/info-popover";
import { cn } from "@/lib/utils";
import type { ChampionImages, Champion } from "@/types/champion";
import type { EnhancedCountersMap, PickCounterWithChampion, PopularCountersMap } from "@/app/actions/quest-catalog";
import type { EncounterWithRelations, QuestWithRelations } from "../types";
import { toChampionImages } from "../types";

type EncounterTab = "recommended" | "featured" | "alliance";

export function SuggestedCounters({
    encounter,
    quest,
    encounterTabs,
    setEncounterTabs,
    featuredPicks,
    alliancePicks,
    popularCounters,
    renderChampionItem,
    renderListPick,
}: {
    encounter: EncounterWithRelations;
    quest: QuestWithRelations;
    encounterTabs: Record<string, EncounterTab>;
    setEncounterTabs: React.Dispatch<React.SetStateAction<Record<string, EncounterTab>>>;
    featuredPicks: EnhancedCountersMap;
    alliancePicks: EnhancedCountersMap;
    popularCounters: PopularCountersMap;
    renderChampionItem: (champion: Champion, encounter: EncounterWithRelations, popularityLabel?: string, isRecommended?: boolean) => React.ReactNode;
    renderListPick: (pick: PickCounterWithChampion, encounter: EncounterWithRelations) => React.ReactNode;
}) {
    const hasFeatured = featuredPicks[encounter.id] && featuredPicks[encounter.id].length > 0;
    const hasAlliance = alliancePicks[encounter.id] && alliancePicks[encounter.id].length > 0;

    return (
        <div className="space-y-2.5">
            <div className="flex flex-col justify-between gap-2 px-1 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2">
                    <div className="h-6 w-1 shrink-0 rounded-full bg-amber-500" />
                    <h4 className="whitespace-nowrap text-xs font-bold uppercase tracking-[0.2em] text-amber-500">Suggested Counters</h4>
                    <InfoPopover
                        content={
                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500">Recommended</p>
                                    <p className="text-xs text-slate-300">Highly relevant counters based on current meta and community data.</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-purple-400">Featured</p>
                                    <p className="text-xs text-slate-300">Specialized plans suggested by notable community members and creators.</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Alliance</p>
                                    <p className="text-xs text-slate-300">Counters successfully used by your alliance mates.</p>
                                </div>
                            </div>
                        }
                        side="top"
                        align="center"
                        iconClassName="h-3.5 w-3.5"
                    />
                </div>
                {(hasFeatured || hasAlliance) && (
                    <div className="mt-2 flex w-full flex-wrap rounded-lg border border-slate-800 bg-slate-900 p-0.5 shadow-sm sm:mt-0 sm:w-auto sm:self-start">
                        <button onClick={() => setEncounterTabs(prev => ({ ...prev, [encounter.id]: "recommended" }))} className={cn("flex-1 rounded-md px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors sm:px-3 sm:py-1", (!encounterTabs[encounter.id] || encounterTabs[encounter.id] === "recommended") ? "bg-slate-800 text-amber-500 shadow-sm" : "text-slate-500 hover:text-slate-300")}>Recommended</button>
                        {hasFeatured && (
                            <button onClick={() => setEncounterTabs(prev => ({ ...prev, [encounter.id]: "featured" }))} className={cn("flex-1 rounded-md px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors sm:px-3 sm:py-1", encounterTabs[encounter.id] === "featured" ? "bg-slate-800 text-purple-400 shadow-sm" : "text-slate-500 hover:text-slate-300")}>Featured</button>
                        )}
                        {hasAlliance && (
                            <button onClick={() => setEncounterTabs(prev => ({ ...prev, [encounter.id]: "alliance" }))} className={cn("flex-1 rounded-md px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors sm:px-3 sm:py-1", encounterTabs[encounter.id] === "alliance" ? "bg-slate-800 text-emerald-400 shadow-sm" : "text-slate-500 hover:text-slate-300")}>Alliance</button>
                        )}
                    </div>
                )}
            </div>

            <div className="space-y-2.5 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                {encounter.recommendedTags.length > 0 && (!encounterTabs[encounter.id] || encounterTabs[encounter.id] === "recommended") && (
                    <div className="flex flex-wrap gap-2">
                        {encounter.recommendedTags.map((tag: string) => (
                            <Badge key={tag} variant="outline" className="flex items-center gap-2 rounded-full border-amber-800/50 bg-amber-950/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-400 shadow-sm">
                                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" /> {tag}
                            </Badge>
                        ))}
                    </div>
                )}

                <CounterPickGrid
                    encounter={encounter}
                    quest={quest}
                    activeTab={encounterTabs[encounter.id] || "recommended"}
                    featuredPicks={featuredPicks}
                    alliancePicks={alliancePicks}
                    popularCounters={popularCounters}
                    renderChampionItem={renderChampionItem}
                    renderListPick={renderListPick}
                />
            </div>
        </div>
    );
}

function CounterPickGrid({
    encounter,
    quest,
    activeTab,
    featuredPicks,
    alliancePicks,
    popularCounters,
    renderChampionItem,
    renderListPick,
}: {
    encounter: EncounterWithRelations;
    quest: QuestWithRelations;
    activeTab: EncounterTab;
    featuredPicks: EnhancedCountersMap;
    alliancePicks: EnhancedCountersMap;
    popularCounters: PopularCountersMap;
    renderChampionItem: (champion: Champion, encounter: EncounterWithRelations, popularityLabel?: string, isRecommended?: boolean) => React.ReactNode;
    renderListPick: (pick: PickCounterWithChampion, encounter: EncounterWithRelations) => React.ReactNode;
}) {
    if (activeTab === "recommended") {
        const encounterPicks = popularCounters[encounter.id] || [];
        const pickCountMap = new Map(encounterPicks.map(pick => [pick.championId, pick.count]));
        const recommendedIds = new Set(encounter.recommendedChampions.map(champion => champion.id));
        const totalPlayers = quest._count?.playerPlans || 0;

        const officialChampions = encounter.recommendedChampions
            .map(champion => ({ ...champion, images: toChampionImages(champion.images) }))
            .sort((a, b) => (pickCountMap.get(b.id) || 0) - (pickCountMap.get(a.id) || 0));

        const communityChampions = encounterPicks
            .filter(pick => !recommendedIds.has(pick.championId))
            .sort((a, b) => b.count - a.count)
            .map(pick => ({ ...pick.champion, images: toChampionImages(pick.champion.images) }));

        const hasOfficial = officialChampions.length > 0;
        const hasCommunity = communityChampions.length > 0;

        if (!hasOfficial && !hasCommunity) {
            return (
                <p className="rounded-lg border border-dashed border-slate-800 py-4 text-center text-xs italic text-slate-500">No specific champions recommended for this encounter.</p>
            );
        }

        const renderGrid = (champions: { id: number; images: ChampionImages }[]) => (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(60px,1fr))] gap-2 sm:grid-cols-[repeat(auto-fill,minmax(80px,1fr))] sm:gap-3">
                {champions.map((champion) => {
                    const pickCount = pickCountMap.get(champion.id) || 0;
                    const popularityLabel = totalPlayers > 0 && pickCount > 0 ? `${Math.round((pickCount / totalPlayers) * 100)}%` : undefined;
                    return <div key={champion.id}>{renderChampionItem(champion as Champion, encounter, popularityLabel, true)}</div>;
                })}
            </div>
        );

        return (
            <div className="flex flex-col gap-4">
                {hasOfficial && (
                    <CounterGroup title="Recommended by creator" color="amber">
                        {renderGrid(officialChampions)}
                    </CounterGroup>
                )}
                {hasCommunity && (
                    <CounterGroup title="Popular picks" color="sky">
                        {renderGrid(communityChampions)}
                    </CounterGroup>
                )}
            </div>
        );
    }

    if (activeTab === "featured" && featuredPicks[encounter.id]?.length > 0) {
        return (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300 sm:grid-cols-[repeat(auto-fill,minmax(120px,1fr))] sm:gap-3">
                {featuredPicks[encounter.id].map((pick) => renderListPick(pick, encounter))}
            </div>
        );
    }

    if (activeTab === "alliance" && alliancePicks[encounter.id]?.length > 0) {
        return (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300 sm:grid-cols-[repeat(auto-fill,minmax(120px,1fr))] sm:gap-3">
                {alliancePicks[encounter.id].map((pick) => renderListPick(pick, encounter))}
            </div>
        );
    }

    return null;
}

function CounterGroup({
    title,
    color,
    children,
}: {
    title: string;
    color: "amber" | "sky";
    children: React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
                {color === "amber" ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-amber-400">
                        <path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z" clipRule="evenodd" />
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-sky-400">
                        <path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM1.49 15.326a.78.78 0 0 1-.358-.442 3 3 0 0 1 4.308-3.516 6.484 6.484 0 0 0-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 0 1-2.07-.655zM16.44 15.98a4.97 4.97 0 0 0 2.07-.654.78.78 0 0 0 .357-.442 3 3 0 0 0-4.308-3.517 6.484 6.484 0 0 1 1.907 3.96 2.32 2.32 0 0 1-.026.654zM18 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM5.304 16.19a.844.844 0 0 1-.277-.71 5 5 0 0 1 9.947 0 .843.843 0 0 1-.277.71A6.975 6.975 0 0 1 10 18a6.974 6.974 0 0 1-4.696-1.81z" />
                    </svg>
                )}
                <span className={cn(
                    "text-[11px] font-semibold uppercase tracking-wider",
                    color === "amber" ? "text-amber-400" : "text-sky-400"
                )}>{title}</span>
            </div>
            {children}
        </div>
    );
}
