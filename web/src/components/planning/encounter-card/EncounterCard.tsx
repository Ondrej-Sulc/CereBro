"use client";

import Image from "next/image";
import type React from "react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { 
    CheckCircle2, ChevronDown, ChevronUp, Crosshair, 
    Filter, Info, Search, Shield, ShieldAlert, TagIcon, Trash2, 
    X, Youtube, Zap, BookOpen, Users, Star
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    EncounterWithRelations,
    QuestWithRelations,
    EncounterNodeWithRelations,
    RosterWithChampion,
} from "../types";
import type { ChampionClass, Tag } from "@prisma/client";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { getChampionImageUrlOrPlaceholder, getStarBorderClass } from "@/lib/championHelper";
import { MultiSelectFilter } from "@/components/ui/filters";
import { UpdatedChampionItem } from "@/components/UpdatedChampionItem";
import type { EnhancedCountersMap, PickCounterWithChampion, PopularCountersMap } from "@/app/actions/quest-catalog";
import { Champion } from "@/types/champion";
import { FilterMetadata } from "../types";
import { isChampionValidForEncounterOrQuest } from "../utils";
import { EncounterDetails } from "./encounter-details";
import { EncounterVideoGuides, getEncounterVideos } from "./encounter-video-guides";
import { ReviveControl, ReviveOrbIcon } from "./revive-control";
import { EncounterNodeList } from "./encounter-node-list";
import { EncounterRestrictions } from "./encounter-restrictions";
import { StrategyTips } from "./strategy-tips";
import { SuggestedCounters } from "./suggested-counters";
import { PrefightSelector } from "./prefight-selector";

export { ReviveOrbIcon };

type EncounterTab = "recommended" | "featured" | "alliance";
interface EncounterFilterState {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    showAdvancedFilters: boolean;
    setShowAdvancedFilters: (show: boolean) => void;
    activeFiltersCount: number;
    filterMetadata: FilterMetadata;
    tagFilter: string[];
    setTagFilter: (tags: string[]) => void;
    tagLogic: "AND" | "OR";
    setTagLogic: (logic: "AND" | "OR") => void;
    abilityCategoryFilter: string[];
    setAbilityCategoryFilter: (cats: string[]) => void;
    abilityCategoryLogic: "AND" | "OR";
    setAbilityCategoryLogic: (logic: "AND" | "OR") => void;
    abilityFilter: string[];
    setAbilityFilter: (abs: string[]) => void;
    abilityLogic: "AND" | "OR";
    setAbilityLogic: (logic: "AND" | "OR") => void;
    immunityFilter: string[];
    setImmunityFilter: (imms: string[]) => void;
    immunityLogic: "AND" | "OR";
    setImmunityLogic: (logic: "AND" | "OR") => void;
    clearAllFilters: () => void;
    CLASSES: readonly ChampionClass[];
    selectedClass: ChampionClass | null;
    setSelectedClass: (cls: ChampionClass | null) => void;
}

interface EncounterRosterState {
    roster: RosterWithChampion[];
    filteredGlobalRoster: RosterWithChampion[];
    selectedTeam: RosterWithChampion[];
    synergyIds?: number[];
    isRosterExpanded: boolean;
    setIsRosterExpanded: (expanded: boolean) => void;
    resolveRosterItem: (id: string, encId: string) => RosterWithChampion | null | undefined;
    handleSelectCounter: (encounterId: string, rosterId: string) => void;
    handleSelectPrefight: (encounterId: string, rosterId: string) => void;
}

interface EncounterTabState {
    encounterTabs: Record<string, EncounterTab>;
    setEncounterTabs: React.Dispatch<React.SetStateAction<Record<string, EncounterTab>>>;
    featuredPicks: EnhancedCountersMap;
    alliancePicks: EnhancedCountersMap;
    popularCounters: PopularCountersMap;
}

interface EncounterHeaderProps {
    encounter: EncounterWithRelations;
    isExpanded: boolean;
    hasSelection: boolean;
    colors: ReturnType<typeof getChampionClassColors> | null;
    selectedRosterId: string | null | undefined;
    selectedRosterItem: RosterWithChampion | null;
    prefightRosterItem: RosterWithChampion | null;
    suggestedTeamChamps: RosterWithChampion[];
    synergyChamps: RosterWithChampion[];
    revivesUsed: number;
    onSetRevives: (encounterId: string, revivesUsed: number) => void;
    readOnly: boolean;
    toggleExpand: (id: string) => void;
    handleSelectCounter: (encounterId: string, rosterId: string) => void;
}

interface RosterSelectorProps {
    encounter: EncounterWithRelations;
    quest: QuestWithRelations;
    selections: Record<string, string | null>;
    prefightSelections: Record<string, string | null>;
    rosterState: EncounterRosterState;
    filterState: EncounterFilterState;
}

interface EncounterExpandedContentProps {
    encounter: EncounterWithRelations;
    quest: QuestWithRelations;
    selections: Record<string, string | null>;
    prefightSelections: Record<string, string | null>;
    readOnly: boolean;
    showVideoId: string | null;
    setShowVideoId: (id: string | null) => void;
    tabState: EncounterTabState;
    filterState: EncounterFilterState;
    rosterState: EncounterRosterState;
    isNodesCollapsed: boolean;
    setIsNodesCollapsed: (collapsed: boolean) => void;
    renderChampionItem: (c: Champion, encounter: EncounterWithRelations, popularityLabel?: string, isRecommended?: boolean) => React.ReactNode;
    renderListPick: (p: PickCounterWithChampion, encounter: EncounterWithRelations) => React.ReactNode;
}

export interface EncounterCardProps {
    encounter: EncounterWithRelations;
    index: number;
    quest: QuestWithRelations;
    expandedId: string | null;
    toggleExpand: (id: string) => void;
    selections: Record<string, string | null>;
    prefightSelections: Record<string, string | null>;
    revivesUsed: number;
    onSetRevives: (encounterId: string, revivesUsed: number) => void;
    readOnly: boolean;
    showVideoId: string | null;
    setShowVideoId: (id: string | null) => void;
    tabState: EncounterTabState;
    filterState: EncounterFilterState;
    rosterState: EncounterRosterState;
    isNodesCollapsed: boolean;
    setIsNodesCollapsed: (collapsed: boolean) => void;
    renderChampionItem: (c: Champion, encounter: EncounterWithRelations, popularityLabel?: string, isRecommended?: boolean) => React.ReactNode;
    renderListPick: (p: PickCounterWithChampion, encounter: EncounterWithRelations) => React.ReactNode;
}

function formatClassForIcon(cls: string): string {
    return cls.charAt(0).toUpperCase() + cls.slice(1).toLowerCase();
}

function sortEncounterNodes(nodes: EncounterNodeWithRelations[]): EncounterNodeWithRelations[] {
    return [...nodes].sort((a, b) => {
        const highlightedCompare = Number(b.isHighlighted) - Number(a.isHighlighted);
        if (highlightedCompare !== 0) return highlightedCompare;

        const nameCompare = compareStableText(a.nodeModifier.name, b.nodeModifier.name);
        if (nameCompare !== 0) return nameCompare;

        const modifierCompare = compareStableText(a.nodeModifierId, b.nodeModifierId);
        if (modifierCompare !== 0) return modifierCompare;

        return compareStableText(a.id, b.id);
    });
}

function compareStableText(a: string, b: string): number {
    const left = a.toLowerCase();
    const right = b.toLowerCase();
    if (left < right) return -1;
    if (left > right) return 1;
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
}

function EncounterHeader({
    encounter,
    isExpanded,
    hasSelection,
    colors,
    selectedRosterId,
    selectedRosterItem,
    prefightRosterItem,
    suggestedTeamChamps,
    synergyChamps,
    revivesUsed,
    onSetRevives,
    readOnly,
    toggleExpand,
    handleSelectCounter
}: EncounterHeaderProps) {
    const sortedNodes = sortEncounterNodes(encounter.nodes);

    return (
        <div
            role="button"
            tabIndex={0}
            className="relative p-0 flex flex-col md:flex-row items-stretch min-h-[100px] cursor-pointer text-left w-full"
            onClick={() => toggleExpand(encounter.id)}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleExpand(encounter.id);
                }
            }}
            aria-expanded={isExpanded}
        >
            {/* Left Side: Defender */}
            <div className={cn(
                "relative flex-1 flex items-center p-4 md:p-5 md:pr-14 lg:pr-16 gap-4 z-10 before:absolute before:inset-0 before:bg-gradient-to-r before:to-transparent before:-z-10 min-w-0",
                encounter.difficulty === "HARD"
                    ? "before:from-red-950/30"
                    : encounter.difficulty === "EASY"
                        ? "before:from-emerald-950/30"
                        : "before:from-amber-950/30"
            )}>
                {/* Defender Avatar */}
                <div className="relative shrink-0 group-hover/encounter:scale-105 transition-transform duration-300">
                    <div className={`h-16 w-16 md:h-20 md:w-20 rounded-lg bg-slate-900 border-2 overflow-hidden relative z-10 ${colors ? colors.border : "border-slate-800 shadow-[0_0_15px_rgba(30,41,59,0.5)]"}`}>
                        {encounter.defender ? (
                            <Image
                                src={getChampionImageUrlOrPlaceholder(encounter.defender.images, "128")}
                                alt={encounter.defender.name}
                                fill
                                sizes="80px"
                                className="object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-600 bg-slate-950">
                                <ShieldAlert className="h-8 w-8 md:h-10 md:w-10 opacity-50" />
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                    </div>
                    {encounter.defender && (
                        <div className="absolute -bottom-2.5 -right-2.5 z-20 h-7 w-7 md:h-8 md:w-8 bg-slate-950 rounded-full border border-slate-700 flex items-center justify-center overflow-hidden p-1 shadow-lg">
                            <Image
                                src={`/assets/icons/${formatClassForIcon(encounter.defender.class)}.png`}
                                alt={encounter.defender.class}
                                fill
                                className="object-contain p-1"
                            />
                        </div>
                    )}
                </div>

                <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <CardTitle className={`text-lg md:text-2xl font-black truncate leading-none ${colors ? colors.text : "text-slate-300"}`}>
                            {encounter.defender?.name || "Unknown Defender"}
                        </CardTitle>
                        {(encounter.videoUrl || getEncounterVideos(encounter).length > 0) && (
                            <Youtube className="w-5 h-5 text-red-600 shrink-0" />
                        )}
                    </div>
                    {sortedNodes.length > 0 && !isExpanded && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                            {sortedNodes.slice(0, 3).map((n: EncounterNodeWithRelations) => (
                                <Badge
                                    key={n.id}
                                    variant="secondary"
                                    className={cn(
                                        "gap-1 text-[10px] py-0 min-h-[16px] h-auto font-medium truncate max-w-[140px] sm:max-w-[200px]",
                                        n.isHighlighted
                                            ? "bg-amber-950/60 border-amber-600/60 text-amber-200"
                                            : "bg-slate-950/80 border-slate-800 text-slate-400"
                                    )}
                                >
                                    {n.isHighlighted && <Star className="h-2.5 w-2.5 shrink-0 fill-current" />}
                                    {n.nodeModifier.name}
                                </Badge>
                            ))}
                            {sortedNodes.length > 3 && (
                                <Badge variant="secondary" className="text-[10px] py-0 min-h-[16px] h-auto bg-slate-950/80 border-slate-800 text-slate-500 font-medium shrink-0">
                                    +{sortedNodes.length - 3}
                                </Badge>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="hidden md:flex absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-24 items-center justify-center z-20 pointer-events-none">
                <div className="relative flex items-center justify-center w-12 h-12">
                    <svg width="100%" height="100%" viewBox="0 0 100 100" className="absolute inset-0 text-slate-800 fill-slate-950 drop-shadow-xl">
                        <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" stroke="currentColor" strokeWidth="2" />
                    </svg>
                    <span className="relative z-10 text-sm font-black text-slate-500 italic uppercase tracking-tighter mix-blend-screen">VS</span>
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-slate-700/20 to-transparent opacity-50 transform rotate-12" />
                </div>
            </div>

            <div className={cn(
                "relative flex-1 flex items-center p-4 md:p-5 md:pl-14 lg:pl-16 gap-4 border-t md:border-t-0 md:border-l border-slate-800/50 justify-between md:justify-end transition-colors z-10 min-w-0",
                hasSelection ? "before:absolute before:inset-0 before:bg-gradient-to-l before:from-sky-950/20 before:to-transparent before:-z-10" : ""
            )}>
                {hasSelection && selectedRosterItem ? (
                    <div className="flex items-center gap-4 w-full md:w-auto md:flex-row-reverse min-w-0 flex-1 md:flex-initial">
                        {(() => {
                            const champColors = getChampionClassColors(selectedRosterItem.champion.class as ChampionClass);
                            return (
                                <>
                                    <div className="relative shrink-0 group-hover:scale-105 transition-transform duration-300">
                                        <div className={cn(
                                            "h-16 w-16 md:h-20 md:w-20 rounded-lg bg-slate-900 border-2 overflow-hidden relative z-10 shadow-[0_0_15px_rgba(2,132,199,0.3)]",
                                            getStarBorderClass(selectedRosterItem.stars)
                                        )}>
                                            <Image
                                                src={getChampionImageUrlOrPlaceholder(selectedRosterItem.champion.images, "128")}
                                                alt={selectedRosterItem.champion.name}
                                                fill
                                                sizes="80px"
                                                className="object-cover"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                                        </div>
                                        <div className="absolute -bottom-2.5 -left-2.5 md:-left-auto md:-right-2.5 z-20 h-7 w-7 md:h-8 md:w-8 bg-slate-950 rounded-full border border-slate-700 flex items-center justify-center overflow-hidden p-1 shadow-lg">
                                            <Image
                                                src={`/assets/icons/${formatClassForIcon(selectedRosterItem.champion.class)}.png`}
                                                alt={selectedRosterItem.champion.class}
                                                fill
                                                className="object-contain p-1"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex flex-col flex-1 min-w-0 text-left md:text-right">
                                        <div className={cn("text-lg md:text-2xl font-black leading-none truncate w-full", champColors.text)}>
                                            {selectedRosterItem.champion.name}
                                        </div>
                                        <div className="flex items-center md:justify-end gap-1.5 mt-1.5 flex-wrap">
                                            <Badge variant="outline" className="text-[9px] font-black text-slate-300 bg-slate-900 border-slate-700 px-1.5 py-0 h-4 shrink-0">
                                                {selectedRosterItem.stars}★ R{selectedRosterItem.rank}{selectedRosterItem.ascensionLevel && selectedRosterItem.ascensionLevel > 0 ? <span className="text-amber-400 ml-0.5">A{selectedRosterItem.ascensionLevel}</span> : null}
                                            </Badge>
                                            {selectedRosterItem.isAwakened && (
                                                <Badge variant="outline" className="text-[9px] font-black text-sky-400 bg-sky-950/50 border-sky-800 px-1.5 py-0 h-4 shrink-0">
                                                    S{selectedRosterItem.sigLevel}
                                                </Badge>
                                            )}
                                        </div>
                                        {prefightRosterItem && (
                                            <div
                                                className="mt-2 flex items-center gap-2 md:justify-end"
                                                title={`Prefight: ${prefightRosterItem.champion.name}`}
                                                onClick={(event) => event.stopPropagation()}
                                            >
                                                <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
                                                    Prefight:
                                                </span>
                                                <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-md border border-slate-700 bg-slate-900">
                                                    <Image
                                                        src={getChampionImageUrlOrPlaceholder(prefightRosterItem.champion.images, "64")}
                                                        alt={prefightRosterItem.champion.name}
                                                        fill
                                                        sizes="24px"
                                                        className="object-cover"
                                                    />
                                                </div>
                                                <span className="max-w-28 truncate text-[10px] font-bold uppercase tracking-[0.08em] text-slate-300">
                                                    {prefightRosterItem.champion.shortName || prefightRosterItem.champion.name}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col md:flex-row justify-center md:justify-end items-center gap-3">
                        {suggestedTeamChamps.length > 0 && !readOnly && (
                            <div className="flex items-center gap-2 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-xl animate-in fade-in zoom-in duration-300 shadow-[0_0_15px_rgba(16,185,129,0.05)]">
                                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                    <Users className="w-3 h-3 text-amber-500" />
                                    <span className="text-[9px] font-black text-amber-500 uppercase tracking-tighter">YOUR TEAM</span>
                                </div>
                                <div className="flex -space-x-2">
                                    {suggestedTeamChamps.map((r) => {
                                        const isSynergy = synergyChamps.some(sc => sc.id === r.id);
                                        return (
                                            <div key={`sugg-${r.id}`} className="relative w-6 h-6 rounded-full border border-slate-900 overflow-hidden shadow-md group/sugg" title={`${r.champion.name} (In your team${isSynergy ? ' as synergy' : ''} & recommended)`}>
                                                <Image src={getChampionImageUrlOrPlaceholder(r.champion.images, "64")} alt={r.champion.name} fill className="object-cover group-hover/sugg:scale-110 transition-transform" />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        <div className="text-xs font-bold uppercase tracking-widest text-slate-500 bg-slate-900/50 px-4 py-2 rounded-lg border border-slate-800 border-dashed group-hover:border-slate-600 transition-colors flex items-center gap-2">
                            <Crosshair className="w-4 h-4" /> {readOnly ? "No Counter Selected" : "Pick Counter"}
                        </div>
                        {prefightRosterItem && (
                            <div
                                className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1"
                                title={`Prefight: ${prefightRosterItem.champion.name}`}
                                onClick={(event) => event.stopPropagation()}
                            >
                                <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Prefight:</span>
                                <div className="relative h-5 w-5 shrink-0 overflow-hidden rounded border border-slate-700 bg-slate-900">
                                    <Image
                                        src={getChampionImageUrlOrPlaceholder(prefightRosterItem.champion.images, "64")}
                                        alt={prefightRosterItem.champion.name}
                                        fill
                                        sizes="20px"
                                        className="object-cover"
                                    />
                                </div>
                                <span className="max-w-24 truncate text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
                                    {prefightRosterItem.champion.shortName || prefightRosterItem.champion.name}
                                </span>
                            </div>
                        )}
                    </div>
                )}
                <div className="flex items-center flex-col md:flex-row gap-1 md:gap-2 ml-2 self-center md:self-auto">
                    <ReviveControl
                        encounterId={encounter.id}
                        revivesUsed={revivesUsed}
                        readOnly={readOnly}
                        onSetRevives={onSetRevives}
                    />
                    {!readOnly && hasSelection && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0 rounded-full hover:bg-red-950/80 hover:text-red-400 text-slate-500 h-8 w-8 transition-colors"
                            title="Remove selected counter"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (selectedRosterId) handleSelectCounter(encounter.id, selectedRosterId);
                            }}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                    <Button variant="ghost" size="icon" className="shrink-0 rounded-full hover:bg-slate-800 h-8 w-8">
                        {isExpanded ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
                    </Button>
                </div>
            </div>
        </div>
    );
}

function RosterSelector({
    encounter,
    quest,
    selections,
    prefightSelections,
    rosterState,
    filterState
}: RosterSelectorProps) {
    const {
        roster,
        filteredGlobalRoster,
        isRosterExpanded,
        setIsRosterExpanded,
        handleSelectCounter
    } = rosterState;
    const {
        searchQuery,
        setSearchQuery,
        CLASSES,
        selectedClass,
        setSelectedClass,
        showAdvancedFilters,
        setShowAdvancedFilters,
        activeFiltersCount,
        filterMetadata,
        tagFilter,
        setTagFilter,
        tagLogic,
        setTagLogic,
        abilityCategoryFilter,
        setAbilityCategoryFilter,
        abilityCategoryLogic,
        setAbilityCategoryLogic,
        abilityFilter,
        setAbilityFilter,
        abilityLogic,
        setAbilityLogic,
        immunityFilter,
        setImmunityFilter,
        immunityLogic,
        setImmunityLogic,
        clearAllFilters
    } = filterState;
    const activeAssignmentIds = new Set([
        ...Object.values(selections).filter((id): id is string => Boolean(id)),
        ...Object.values(prefightSelections).filter((id): id is string => Boolean(id)),
    ]);

    return (
        <div className="pt-6 mt-4 border-t border-slate-800/50">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <button
                        onClick={() => setIsRosterExpanded(!isRosterExpanded)}
                        className={cn(
                            "flex items-center justify-between w-full md:w-auto px-5 py-3 rounded-xl transition-all group/roster-toggle relative overflow-hidden",
                            isRosterExpanded 
                                ? "bg-slate-900/80 border border-slate-700 shadow-inner" 
                                : "bg-gradient-to-r from-sky-950/40 to-slate-900/60 border border-sky-500/30 hover:border-sky-400 shadow-[0_0_20px_rgba(14,165,233,0.05)] hover:shadow-[0_0_25px_rgba(14,165,233,0.1)]"
                        )}
                    >
                        {/* Subtle animated background for call-to-action */}
                        {!isRosterExpanded && (
                            <div className="absolute inset-0 bg-gradient-to-r from-sky-500/5 to-transparent animate-pulse" />
                        )}

                        <div className="flex items-center gap-4 relative z-10">
                            <div className="relative">
                                <div className={cn(
                                    "h-6 w-1 rounded-full transition-all duration-300", 
                                    isRosterExpanded ? "bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.5)]" : "bg-sky-400 group-hover/roster-toggle:scale-y-110 shadow-[0_0_8px_rgba(14,165,233,0.3)]"
                                )} />
                                {!isRosterExpanded && (
                                    <div className="absolute inset-0 bg-sky-400 rounded-full blur-[4px] animate-ping opacity-20" />
                                )}
                            </div>
                            <div className="flex flex-col items-start">
                                <h4 className={cn(
                                    "text-[11px] font-black uppercase tracking-[0.25em] transition-colors leading-none mb-1", 
                                    isRosterExpanded ? "text-sky-400" : "text-sky-300 group-hover/roster-toggle:text-white"
                                )}>
                                    Select from Your Roster
                                </h4>
                                <p className="text-[10px] text-slate-500 font-medium group-hover/roster-toggle:text-slate-400 transition-colors">
                                    {isRosterExpanded ? "Close roster selection" : "Open your champions list"}
                                </p>
                            </div>
                        </div>
                        <div className={cn(
                            "p-1.5 rounded-lg transition-all ml-4 relative z-10", 
                            isRosterExpanded 
                                ? "bg-sky-500/10 text-sky-400 border border-sky-500/20" 
                                : "bg-sky-500/20 text-sky-300 group-hover/roster-toggle:text-white group-hover/roster-toggle:bg-sky-500 border border-sky-500/30"
                        )}>
                            {isRosterExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                    </button>

                    {isRosterExpanded && (
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="flex flex-col sm:flex-row gap-3 flex-1 max-w-2xl"
                        >
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                                <Input
                                    placeholder="Search your roster..."
                                    className="pl-9 h-10 bg-slate-900/50 border-slate-800 text-sm focus-visible:ring-sky-500"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                {searchQuery && (
                                    <button 
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-800 rounded" 
                                        onClick={() => setSearchQuery("")}
                                        aria-label="Clear search"
                                    >
                                        <X className="h-3 w-3 text-slate-500" />
                                    </button>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <div className="flex gap-1.5 p-1 bg-slate-950/50 border border-slate-800 rounded-lg overflow-x-auto custom-scrollbar">
                                    {CLASSES.filter(cls => cls !== "SUPERIOR").map((cls) => (
                                        <button
                                            key={cls}
                                            onClick={() => setSelectedClass(selectedClass === cls ? null : cls)}
                                            className={cn("p-1.5 rounded-md border transition-all shrink-0", selectedClass === cls ? "bg-sky-600 border-sky-400 shadow-[0_0_10px_rgba(2,132,199,0.3)]" : "bg-transparent border-transparent hover:bg-slate-800/50 hover:border-slate-700")}
                                            title={cls}
                                            aria-label={`Filter by ${cls} class`}
                                        >
                                            <div className="relative w-5 h-5">
                                                <Image src={`/assets/icons/${formatClassForIcon(cls)}.png`} alt={cls} fill className="object-contain" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                                <Button
                                    variant="outline"
                                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                                    className={cn("h-10 px-3 border-slate-800 gap-2 shrink-0", showAdvancedFilters || activeFiltersCount > 0 ? "bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-700" : "bg-slate-900/50 text-slate-400")}
                                    aria-label={showAdvancedFilters ? "Hide advanced filters" : "Show advanced filters"}
                                >
                                    <Filter className="w-4 h-4" />
                                    {activeFiltersCount > 0 && <span className="bg-white text-indigo-700 text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center">{activeFiltersCount}</span>}
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </div>

                <AnimatePresence>
                    {isRosterExpanded && (
                        <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                            className="space-y-4 overflow-hidden"
                        >
                            <div className="pt-2 pb-4 space-y-4">
                                {showAdvancedFilters && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="bg-slate-950/50 border border-slate-800 p-4 rounded-xl flex flex-wrap gap-4 items-center"
                                    >
                                        <MultiSelectFilter title="Tags" icon={TagIcon} options={filterMetadata.tags} selectedValues={tagFilter} onSelect={setTagFilter} logic={tagLogic} onLogicChange={setTagLogic} />
                                        <MultiSelectFilter title="Categories" icon={BookOpen} options={filterMetadata.abilityCategories} selectedValues={abilityCategoryFilter} onSelect={setAbilityCategoryFilter} logic={abilityCategoryLogic} onLogicChange={setAbilityCategoryLogic} />
                                        <MultiSelectFilter title="Abilities" icon={Zap} options={filterMetadata.abilities} selectedValues={abilityFilter} onSelect={setAbilityFilter} logic={abilityLogic} onLogicChange={setAbilityLogic} />
                                        <MultiSelectFilter title="Immunities" icon={Shield} options={filterMetadata.immunities} selectedValues={immunityFilter} onSelect={setImmunityFilter} logic={immunityLogic} onLogicChange={setImmunityLogic} />
                                    </motion.div>
                                )}
                                <div className="flex flex-wrap gap-2 items-center">
                                    {quest.requiredTags?.map((t: Tag) => (
                                        <Badge key={`req-q-${t.id}`} variant="outline" className="bg-red-950/20 border-red-800/40 text-red-400 h-7 text-[10px] uppercase font-bold px-2.5 flex items-center gap-1.5">
                                            <ShieldAlert className="w-3 h-3" /> Quest Req: {t.name}
                                        </Badge>
                                    ))}
                                    {encounter.requiredTags?.map((t: Tag) => (
                                        <Badge key={`req-e-${t.id}`} variant="outline" className="bg-red-950/20 border-red-800/40 text-red-400 h-7 text-[10px] uppercase font-bold px-2.5 flex items-center gap-1.5">
                                            <ShieldAlert className="w-3 h-3" /> Fight Req: {t.name}
                                        </Badge>
                                    ))}
                                    {tagFilter.map(tag => (
                                        <Badge key={`f-tag-${tag}`} variant="outline" className="bg-indigo-950/20 border-indigo-800/40 text-indigo-300 h-7 text-[10px] uppercase font-bold px-2 flex items-center gap-1">
                                            Tag: {tag}
                                            <button onClick={() => setTagFilter(tagFilter.filter(t => t !== tag))} className="p-0.5 hover:bg-indigo-900/40 rounded ml-1" aria-label={`Remove ${tag} filter`}><X className="w-3 h-3" /></button>
                                        </Badge>
                                    ))}
                                    {abilityCategoryFilter.map(cat => (
                                        <Badge key={`f-cat-${cat}`} variant="outline" className="bg-indigo-950/20 border-indigo-800/40 text-indigo-300 h-7 text-[10px] uppercase font-bold px-2 flex items-center gap-1">
                                            Cat: {cat}
                                            <button onClick={() => setAbilityCategoryFilter(abilityCategoryFilter.filter(c => c !== cat))} className="p-0.5 hover:bg-indigo-900/40 rounded ml-1" aria-label={`Remove ${cat} category filter`}><X className="w-3 h-3" /></button>
                                        </Badge>
                                    ))}
                                    {abilityFilter.map(ab => (
                                        <Badge key={`f-ab-${ab}`} variant="outline" className="bg-indigo-950/20 border-indigo-800/40 text-indigo-300 h-7 text-[10px] uppercase font-bold px-2 flex items-center gap-1">
                                            Ability: {ab}
                                            <button onClick={() => setAbilityFilter(abilityFilter.filter(a => a !== ab))} className="p-0.5 hover:bg-indigo-900/40 rounded ml-1" aria-label={`Remove ${ab} ability filter`}><X className="w-3 h-3" /></button>
                                        </Badge>
                                    ))}
                                    {immunityFilter.map(imm => (
                                        <Badge key={`f-imm-${imm}`} variant="outline" className="bg-indigo-950/20 border-indigo-800/40 text-indigo-300 h-7 text-[10px] uppercase font-bold px-2 flex items-center gap-1">
                                            Immunity: {imm}
                                            <button onClick={() => setImmunityFilter(immunityFilter.filter(i => i !== imm))} className="p-0.5 hover:bg-indigo-900/40 rounded ml-1" aria-label={`Remove ${imm} immunity filter`}><X className="w-3 h-3" /></button>
                                        </Badge>
                                    ))}
                                    {activeFiltersCount > 0 && (
                                        <Button variant="ghost" size="sm" className="h-7 text-[10px] text-red-400 hover:text-red-300 uppercase font-black tracking-widest px-2" onClick={clearAllFilters}>
                                            <Trash2 className="w-3 h-3 mr-1" /> Clear All
                                        </Button>
                                    )}
                                </div>
                                {(() => {
                                    let encounterRoster = filteredGlobalRoster.filter(r =>
                                        isChampionValidForEncounterOrQuest(r, quest, encounter)
                                    );
                                    const validOwnedChampionIds = new Set(
                                        encounterRoster.filter(r => !r.isUnowned).map(r => r.championId)
                                    );
                                    const seenUnownedChampionIds = new Set<number>();
                                    encounterRoster = encounterRoster.filter(r => {
                                        if (!r.isUnowned) return true;
                                        if (validOwnedChampionIds.has(r.championId)) return false;
                                        if (seenUnownedChampionIds.has(r.championId)) return false;
                                        seenUnownedChampionIds.add(r.championId);
                                        return true;
                                    });
                                    if (quest.teamLimit === null) {
                                        const otherSelectionsCount = [
                                            ...Object.entries(selections),
                                            ...Object.entries(prefightSelections),
                                        ].reduce((acc, [encId, rid]) => {
                                            if (encId === encounter.id || rid === null) return acc;
                                            const rosterEntry = roster.find(re => re.id === rid);
                                            if (rosterEntry) acc[rosterEntry.championId] = (acc[rosterEntry.championId] || 0) + 1;
                                            return acc;
                                        }, {} as Record<number, number>);
                                        const availableCount = encounterRoster.reduce((acc, r) => {
                                            if (r.isUnowned) return acc;
                                            acc[r.championId] = (acc[r.championId] || 0) + 1;
                                            return acc;
                                        }, {} as Record<number, number>);
                                        encounterRoster = encounterRoster.filter(r => {
                                            if (r.isUnowned) return true;
                                            if (selections[encounter.id] === r.id) return true;
                                            return (otherSelectionsCount[r.championId] || 0) < (availableCount[r.championId] || 0);
                                        });
                                    }
                                    encounterRoster = encounterRoster.sort((a, b) => {
                                        if (selections[encounter.id] === a.id && selections[encounter.id] !== b.id) return -1;
                                        if (selections[encounter.id] !== a.id && selections[encounter.id] === b.id) return 1;
                                        // Push unowned to bottom
                                        if (a.isUnowned !== b.isUnowned) return a.isUnowned ? 1 : -1;
                                        if (b.stars !== a.stars) return b.stars - a.stars;
                                        if (b.rank !== a.rank) return b.rank - a.rank;
                                        if (b.isAscended !== a.isAscended) return b.isAscended ? 1 : -1;
                                        const nameCompare = a.champion.name.localeCompare(b.champion.name);
                                        if (nameCompare !== 0) return nameCompare;
                                        return a.id.localeCompare(b.id);
                                    });
                                    if (!roster.some(r => !r.isUnowned)) return (
                                        <div className="p-8 text-center border border-dashed border-slate-700 bg-slate-900/30 rounded-xl">
                                            <p className="text-slate-400 text-lg">Your roster has not been added yet.</p>
                                            <p className="text-slate-500 text-sm mt-2">Go to your profile roster and update your champions before planning.</p>
                                        </div>
                                    );
                                    if (encounterRoster.length === 0) return <div className="p-6 text-center border border-dashed border-slate-800 bg-slate-900/20 rounded-xl"><p className="text-slate-400">No champions in your roster match the current filters or quest restrictions.</p></div>;
                                    return (
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-[repeat(auto-fill,minmax(60px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-y-4 gap-x-2 max-h-[450px] overflow-y-auto p-2 pt-4 border border-slate-800/50 bg-slate-950/30 rounded-xl custom-scrollbar">
                                                {encounterRoster.slice(0, 30).map((r: RosterWithChampion) => {
                                                    const isSelected = selections[encounter.id] === r.id;
                                                    const isRecommended = encounter.recommendedChampions.some(rc => rc.id === r.championId);
                                                    const isInTeam = quest.teamLimit !== null && activeAssignmentIds.has(r.id);
                                                    return (
                                                        <div
                                                            key={r.id}
                                                            onClick={() => {
                                                                if (!r.isUnowned) handleSelectCounter(encounter.id, r.id);
                                                            }}
                                                            title={`${r.champion.name}${r.isUnowned ? ' (Unowned)' : ` - ${r.stars}★ Rank ${r.rank} Sig ${r.sigLevel || 0}`}`}
                                                            className={r.isUnowned ? "cursor-not-allowed" : "cursor-pointer"}
                                                        >
                                                            <UpdatedChampionItem item={{ stars: r.stars, rank: r.rank, isAwakened: r.isAwakened, sigLevel: r.sigLevel, powerRating: r.powerRating, champion: { id: r.champion.id, name: r.champion.shortName || r.champion.name, championClass: r.champion.class, images: r.champion.images }, isAscended: r.isAscended, ascensionLevel: r.ascensionLevel }} isSelected={isSelected} isRecommended={isRecommended} isInTeam={isInTeam} isMissing={r.isUnowned} />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            {encounterRoster.length > 30 && <div className="text-center p-3 bg-slate-900/30 border border-slate-800 border-dashed rounded-lg"><p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Showing first 30 of {encounterRoster.length} matches. Use search or filters to narrow down.</p></div>}
                                        </div>
                                    );
                                })()}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

function EncounterExpandedContent({
    encounter,
    quest,
    selections,
    prefightSelections,
    readOnly,
    showVideoId,
    setShowVideoId,
    tabState,
    filterState,
    rosterState,
    isNodesCollapsed,
    setIsNodesCollapsed,
    renderChampionItem,
    renderListPick
}: EncounterExpandedContentProps) {
    const { encounterTabs, setEncounterTabs, featuredPicks, alliancePicks, popularCounters } = tabState;
    const sortedNodes = sortEncounterNodes(encounter.nodes);

    return (
        <>
            <div className="flex flex-col gap-3 mb-5">
                <EncounterRestrictions quest={quest} encounter={encounter} />

                <EncounterVideoGuides
                    encounter={encounter}
                    showVideoId={showVideoId}
                    setShowVideoId={setShowVideoId}
                />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 pt-2">
                <div className="xl:col-span-7 space-y-4">
                    <EncounterNodeList
                        nodes={sortedNodes}
                        isCollapsed={isNodesCollapsed}
                        setIsCollapsed={setIsNodesCollapsed}
                    />
                    <StrategyTips tips={encounter.tips} />
                </div>

                <div className="xl:col-span-5 space-y-2.5">
                    <SuggestedCounters
                        encounter={encounter}
                        quest={quest}
                        encounterTabs={encounterTabs}
                        setEncounterTabs={setEncounterTabs}
                        featuredPicks={featuredPicks}
                        alliancePicks={alliancePicks}
                        popularCounters={popularCounters}
                        renderChampionItem={renderChampionItem}
                        renderListPick={renderListPick}
                    />                    {!readOnly && (
                        <PrefightSelector
                            encounter={encounter}
                            quest={quest}
                            selections={selections}
                            prefightSelections={prefightSelections}
                            rosterState={rosterState}
                        />
                    )}
                </div>
            </div>

            {!readOnly && (
                <RosterSelector
                    encounter={encounter}
                    quest={quest}
                    selections={selections}
                    prefightSelections={prefightSelections}
                    rosterState={rosterState}
                    filterState={filterState}
                />
            )}
        </>
    );
}

export function EncounterCard({
    encounter,
    index,
    quest,
    expandedId,
    toggleExpand,
    selections,
    prefightSelections,
    revivesUsed,
    onSetRevives,
    readOnly,
    showVideoId,
    setShowVideoId,
    tabState,
    filterState,
    rosterState,
    isNodesCollapsed,
    setIsNodesCollapsed,
    renderChampionItem,
    renderListPick,
}: EncounterCardProps) {
    const {
        resolveRosterItem,
        selectedTeam,
        handleSelectCounter
    } = rosterState;
    const isExpanded = expandedId === encounter.id;
    const selectedRosterId = selections[encounter.id];
    const selectedRosterItem = selectedRosterId ? resolveRosterItem(selectedRosterId, encounter.id) ?? null : null;
    const prefightRosterId = prefightSelections[encounter.id];
    const prefightRosterItem = prefightRosterId ? resolveRosterItem(prefightRosterId, `prefight:${encounter.id}`) ?? rosterState.roster.find(r => r.id === prefightRosterId) ?? null : null;
    const hasSelection = !!selectedRosterId;
    const colors = encounter.defender ? getChampionClassColors(encounter.defender.class as ChampionClass) : null;
    const isLast = index === quest.encounters.length - 1;

    // Find which champions in the currently selected team are recommended for this fight.
    // This includes both official recommendations and consensus (popular) picks.
    // Skip the work entirely in read-only mode since the suggestion UI is not shown.
    const encounterPicks = tabState.popularCounters[encounter.id] || [];
    const popularChampionIds = new Set(encounterPicks.map(p => p.championId));

    const allSuggestedChamps = !readOnly && quest.teamLimit !== null
        ? selectedTeam.filter((teamMember) =>
            encounter.recommendedChampions.some((rc) => rc.id === teamMember.championId) ||
            popularChampionIds.has(teamMember.championId)
        )
        : [];

    const suggestedTeamChamps = allSuggestedChamps.filter(r => {
        // Only show if NOT already selected as counter for this specific fight
        return !selectedRosterId || r.id !== selectedRosterId;
    });

    const synergyChamps = suggestedTeamChamps.filter(r => {
        const isCounter = Object.values(selections).includes(r.id);
        return !isCounter && rosterState.synergyIds?.includes(r.championId);
    });

    return (
        <div key={encounter.id} className="relative flex items-stretch group/encounter is-active pl-5 md:pl-10">
                                    {/* Timeline Node (Circle on the line) */}
                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 flex items-center justify-center">
                                        <div className={cn(
                                            "flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full border-2 transition-all duration-300 font-black",
                                            isLast
                                                ? "bg-slate-950 border-red-500/50 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.15)]"
                                                : encounter.difficulty === "HARD"
                                                    ? "bg-slate-950 border-red-500/60 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.15)]"
                                                    : encounter.difficulty === "EASY"
                                                        ? "bg-slate-950 border-emerald-500/60 text-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.1)]"
                                                        : encounter.difficulty === "NORMAL"
                                                            ? "bg-slate-950 border-orange-500/60 text-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.15)]"
                                                            : hasSelection
                                                                ? "bg-slate-950 border-sky-500/60 text-sky-500 shadow-[0_0_12px_rgba(14,165,233,0.15)]"
                                                                : "bg-slate-900 border-slate-800 text-slate-500 group-hover/encounter:border-slate-600"
                                        )}>
                                            {hasSelection ? (
                                                <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5 animate-in zoom-in duration-300" />
                                            ) : (
                                                <span className="text-[10px] md:text-xs">
                                                    {isLast ? <Crosshair className="h-4 w-4 md:h-5 md:w-5" /> : encounter.sequence}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Horizontal Connector Line (from circle to card) */}
                                    <div className={cn(
                                        "absolute left-0 top-1/2 -translate-y-1/2 h-0.5 w-5 md:w-10 z-10 transition-colors duration-300",
                                        hasSelection ? "bg-sky-500/50" : isLast ? "bg-red-800/50" : encounter.difficulty === "HARD" ? "bg-red-500/30" : encounter.difficulty === "EASY" ? "bg-emerald-500/30" : encounter.difficulty === "NORMAL" ? "bg-orange-500/30" : "bg-slate-800 group-hover/encounter:bg-slate-700"
                                    )} />

                                    {/* Card Content */}
                                    <Card
                                        id={`encounter-${encounter.id}`}
                                        className={cn(
                                            "flex-1 bg-slate-950/90 backdrop-blur-md border transition-all cursor-pointer overflow-hidden z-10 relative",
                                            isLast
                                                ? "border-red-900/40 shadow-[0_0_20px_rgba(220,38,38,0.1)]"
                                                : encounter.difficulty === "HARD"
                                                    ? "border-red-900/50 shadow-[0_0_20px_rgba(239,68,68,0.08)] hover:border-red-800/60"
                                                    : encounter.difficulty === "EASY"
                                                        ? "border-emerald-900/50 shadow-[0_0_20px_rgba(52,211,153,0.06)] hover:border-emerald-800/60"
                                                        : encounter.difficulty === "NORMAL"
                                                            ? "border-amber-900/40 shadow-[0_0_20px_rgba(245,158,11,0.06)] hover:border-amber-800/50"
                                                            : "border-slate-800 hover:border-slate-700 hover:bg-slate-900/90",
                                            isExpanded && "shadow-xl"
                                        )}
                                    >
                                        <EncounterHeader
                                            encounter={encounter}
                                            isExpanded={isExpanded}
                                            hasSelection={hasSelection}
                                            colors={colors}
                                            selectedRosterId={selectedRosterId}
                                            selectedRosterItem={selectedRosterItem}
                                            prefightRosterItem={prefightRosterItem}
                                            suggestedTeamChamps={suggestedTeamChamps}
                                            synergyChamps={synergyChamps}
                                            revivesUsed={revivesUsed}
                                            onSetRevives={onSetRevives}
                                            readOnly={readOnly}
                                            toggleExpand={toggleExpand}
                                            handleSelectCounter={handleSelectCounter}
                                        />

                                        {/* Expanded Content */}
                                        <AnimatePresence initial={false}>
                                            {isExpanded && (
                                                <EncounterDetails>
                                                    <EncounterExpandedContent
                                                        encounter={encounter}
                                                        quest={quest}
                                                        selections={selections}
                                                        prefightSelections={prefightSelections}
                                                        readOnly={readOnly}
                                                        showVideoId={showVideoId}
                                                        setShowVideoId={setShowVideoId}
                                                        tabState={tabState}
                                                        filterState={filterState}
                                                        rosterState={rosterState}
                                                        isNodesCollapsed={isNodesCollapsed}
                                                        setIsNodesCollapsed={setIsNodesCollapsed}
                                                        renderChampionItem={renderChampionItem}
                                                        renderListPick={renderListPick}
                                                    />
                                                </EncounterDetails>
                                            )}
                                        </AnimatePresence>
                                    </Card>
                                </div>
                            );
}
