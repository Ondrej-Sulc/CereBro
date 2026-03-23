"use client";

import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { 
    AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Crosshair, 
    Filter, Info, PlayCircle, Search, Shield, ShieldAlert, TagIcon, Trash2, 
    X, Youtube, Zap, BookOpen, Users
} from "lucide-react";
import { 
    EncounterWithRelations, 
    QuestWithRelations, 
    EncounterNodeWithRelations, 
    RosterWithChampion,
    toChampionImages
} from "../types";
import type { ChampionClass, Tag } from "@prisma/client";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { getChampionImageUrlOrPlaceholder, getStarBorderClass } from "@/lib/championHelper";
import { SimpleMarkdown } from "@/components/ui/simple-markdown";
import { getYoutubeEmbedUrl } from "@/lib/youtube";
import { MultiSelectFilter } from "@/components/ui/filters";
import { InfoPopover } from "@/components/ui/info-popover";
import { UpdatedChampionItem } from "@/components/UpdatedChampionItem";
import { EnhancedCountersMap, PickCounterWithChampion, PopularCountersMap } from "@/app/actions/quests";
import { Champion } from "@/types/champion";
import { FilterMetadata } from "../types";

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
    isRosterExpanded: boolean;
    setIsRosterExpanded: (expanded: boolean) => void;
    resolveRosterItem: (id: string, encId: string) => RosterWithChampion | null | undefined;
    handleSelectCounter: (encounterId: string, rosterId: string) => void;
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
    suggestedTeamChamps: RosterWithChampion[];
    readOnly: boolean;
    toggleExpand: (id: string) => void;
    handleSelectCounter: (encounterId: string, rosterId: string) => void;
}

interface EncounterDetailsProps {
    children: React.ReactNode;
}

interface RosterSelectorProps {
    encounter: EncounterWithRelations;
    quest: QuestWithRelations;
    selections: Record<string, string | null>;
    rosterState: EncounterRosterState;
    filterState: EncounterFilterState;
}

interface EncounterExpandedContentProps {
    encounter: EncounterWithRelations;
    quest: QuestWithRelations;
    selections: Record<string, string | null>;
    readOnly: boolean;
    showVideoId: string | null;
    setShowVideoId: (id: string | null) => void;
    tabState: EncounterTabState;
    filterState: EncounterFilterState;
    rosterState: EncounterRosterState;
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
    readOnly: boolean;
    showVideoId: string | null;
    setShowVideoId: (id: string | null) => void;
    tabState: EncounterTabState;
    filterState: EncounterFilterState;
    rosterState: EncounterRosterState;
    renderChampionItem: (c: Champion, encounter: EncounterWithRelations, popularityLabel?: string, isRecommended?: boolean) => React.ReactNode;
    renderListPick: (p: PickCounterWithChampion, encounter: EncounterWithRelations) => React.ReactNode;
}

function formatClassForIcon(cls: string): string {
    return cls.charAt(0).toUpperCase() + cls.slice(1).toLowerCase();
}

function EncounterHeader({
    encounter,
    isExpanded,
    hasSelection,
    colors,
    selectedRosterId,
    selectedRosterItem,
    suggestedTeamChamps,
    readOnly,
    toggleExpand,
    handleSelectCounter
}: EncounterHeaderProps) {
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
            {/* Left Side: Defender (Red/Orange Theme) */}
            <div className="relative flex-1 flex items-center p-4 md:p-5 md:pr-14 lg:pr-16 gap-4 z-10 before:absolute before:inset-0 before:bg-gradient-to-r before:from-red-950/20 before:to-transparent before:-z-10 min-w-0">
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
                        {encounter.videoUrl && (
                            <Youtube className="w-5 h-5 text-red-600 shrink-0" />
                        )}
                    </div>
                    {encounter.nodes.length > 0 && !isExpanded && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                            {encounter.nodes.slice(0, 3).map((n: EncounterNodeWithRelations) => (
                                <Badge key={n.id} variant="secondary" className="text-[10px] py-0 h-4 bg-slate-950/80 border-slate-800 text-slate-400 font-medium">
                                    {n.nodeModifier.name}
                                </Badge>
                            ))}
                            {encounter.nodes.length > 3 && (
                                <Badge variant="secondary" className="text-[10px] py-0 h-4 bg-slate-950/80 border-slate-800 text-slate-500 font-medium">
                                    +{encounter.nodes.length - 3}
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
                                                {selectedRosterItem.stars}★ R{selectedRosterItem.rank}
                                            </Badge>
                                            {selectedRosterItem.isAwakened && (
                                                <Badge variant="outline" className="text-[9px] font-black text-sky-400 bg-sky-950/50 border-sky-800 px-1.5 py-0 h-4 shrink-0">
                                                    S{selectedRosterItem.sigLevel}
                                                </Badge>
                                            )}
                                        </div>
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
                                    {suggestedTeamChamps.map((r) => (
                                        <div key={`sugg-${r.id}`} className="relative w-6 h-6 rounded-full border border-slate-900 overflow-hidden shadow-md group/sugg" title={`${r.champion.name} (In your team & recommended)`}>
                                            <Image src={getChampionImageUrlOrPlaceholder(r.champion.images, "64")} alt={r.champion.name} fill className="object-cover group-hover/sugg:scale-110 transition-transform" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="text-xs font-bold uppercase tracking-widest text-slate-500 bg-slate-900/50 px-4 py-2 rounded-lg border border-slate-800 border-dashed group-hover:border-slate-600 transition-colors flex items-center gap-2">
                            <Crosshair className="w-4 h-4" /> {readOnly ? "No Counter Selected" : "Pick Counter"}
                        </div>
                    </div>
                )}
                <div className="flex items-center flex-col md:flex-row gap-1 md:gap-2 ml-2 self-center md:self-auto">
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

function EncounterDetails({
    children
}: EncounterDetailsProps) {
    return (
        <div className="border-t border-slate-800 bg-slate-900/20 p-4 space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
            {children}
        </div>
    );
}

function RosterSelector({
    encounter,
    quest,
    selections,
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

    return (
        <div className="pt-6 mt-4 border-t border-slate-800/50">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <button
                        onClick={() => setIsRosterExpanded(!isRosterExpanded)}
                        className="flex items-center justify-between w-full md:w-auto px-4 py-2.5 bg-slate-900/50 hover:bg-slate-800/50 border border-slate-800 hover:border-sky-800/50 rounded-xl transition-all group/roster-toggle"
                    >
                        <div className="flex items-center gap-3">
                            <div className={cn("h-4 w-1 rounded-full transition-colors", isRosterExpanded ? "bg-sky-500" : "bg-slate-700 group-hover/roster-toggle:bg-sky-500/50")} />
                            <h4 className={cn("text-xs font-bold uppercase tracking-[0.2em] transition-colors", isRosterExpanded ? "text-sky-400" : "text-slate-400 group-hover/roster-toggle:text-slate-200")}>
                                Select from Your Roster
                            </h4>
                        </div>
                        <div className={cn("p-1 rounded-md transition-colors ml-4", isRosterExpanded ? "bg-sky-500/10 text-sky-400" : "bg-slate-800 text-slate-500 group-hover/roster-toggle:text-slate-300 group-hover/roster-toggle:bg-slate-700")}>
                            {isRosterExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                    </button>

                    {isRosterExpanded && (
                        <div className="flex flex-col sm:flex-row gap-3 flex-1 max-w-2xl animate-in fade-in zoom-in-95 duration-200">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                                <Input
                                    placeholder="Search your roster..."
                                    className="pl-9 h-10 bg-slate-900/50 border-slate-800 text-sm focus-visible:ring-sky-500"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                {searchQuery && (
                                    <button className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-800 rounded" onClick={() => setSearchQuery("")}>
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
                                >
                                    <Filter className="w-4 h-4" />
                                    {activeFiltersCount > 0 && <span className="bg-white text-indigo-700 text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center">{activeFiltersCount}</span>}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {isRosterExpanded && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                        {showAdvancedFilters && (
                            <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-xl flex flex-wrap gap-4 items-center animate-in slide-in-from-top-2 duration-200">
                                <MultiSelectFilter title="Tags" icon={TagIcon} options={filterMetadata.tags} selectedValues={tagFilter} onSelect={setTagFilter} logic={tagLogic} onLogicChange={setTagLogic} />
                                <MultiSelectFilter title="Categories" icon={BookOpen} options={filterMetadata.abilityCategories} selectedValues={abilityCategoryFilter} onSelect={setAbilityCategoryFilter} logic={abilityCategoryLogic} onLogicChange={setAbilityCategoryLogic} />
                                <MultiSelectFilter title="Abilities" icon={Zap} options={filterMetadata.abilities} selectedValues={abilityFilter} onSelect={setAbilityFilter} logic={abilityLogic} onLogicChange={setAbilityLogic} />
                                <MultiSelectFilter title="Immunities" icon={Shield} options={filterMetadata.immunities} selectedValues={immunityFilter} onSelect={setImmunityFilter} logic={immunityLogic} onLogicChange={setImmunityLogic} />
                            </div>
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
                                    <button onClick={() => setTagFilter(tagFilter.filter(t => t !== tag))} className="p-0.5 hover:bg-indigo-900/40 rounded ml-1"><X className="w-3 h-3" /></button>
                                </Badge>
                            ))}
                            {abilityCategoryFilter.map(cat => (
                                <Badge key={`f-cat-${cat}`} variant="outline" className="bg-indigo-950/20 border-indigo-800/40 text-indigo-300 h-7 text-[10px] uppercase font-bold px-2 flex items-center gap-1">
                                    Cat: {cat}
                                    <button onClick={() => setAbilityCategoryFilter(abilityCategoryFilter.filter(c => c !== cat))} className="p-0.5 hover:bg-indigo-900/40 rounded ml-1"><X className="w-3 h-3" /></button>
                                </Badge>
                            ))}
                            {abilityFilter.map(ab => (
                                <Badge key={`f-ab-${ab}`} variant="outline" className="bg-indigo-950/20 border-indigo-800/40 text-indigo-300 h-7 text-[10px] uppercase font-bold px-2 flex items-center gap-1">
                                    Ability: {ab}
                                    <button onClick={() => setAbilityFilter(abilityFilter.filter(a => a !== ab))} className="p-0.5 hover:bg-indigo-900/40 rounded ml-1"><X className="w-3 h-3" /></button>
                                </Badge>
                            ))}
                            {immunityFilter.map(imm => (
                                <Badge key={`f-imm-${imm}`} variant="outline" className="bg-indigo-950/20 border-indigo-800/40 text-indigo-300 h-7 text-[10px] uppercase font-bold px-2 flex items-center gap-1">
                                    Immunity: {imm}
                                    <button onClick={() => setImmunityFilter(immunityFilter.filter(i => i !== imm))} className="p-0.5 hover:bg-indigo-900/40 rounded ml-1"><X className="w-3 h-3" /></button>
                                </Badge>
                            ))}
                            {activeFiltersCount > 0 && (
                                <Button variant="ghost" size="sm" className="h-7 text-[10px] text-red-400 hover:text-red-300 uppercase font-black tracking-widest px-2" onClick={clearAllFilters}>
                                    <Trash2 className="w-3 h-3 mr-1" /> Clear All
                                </Button>
                            )}
                        </div>
                        {(() => {
                            let encounterRoster = filteredGlobalRoster.filter(r => {
                                if (quest.minStarLevel && r.stars < quest.minStarLevel) return false;
                                if (quest.maxStarLevel && r.stars > quest.maxStarLevel) return false;
                                if (quest.requiredClasses && quest.requiredClasses.length > 0 && !quest.requiredClasses.includes(r.champion.class)) return false;
                                if (quest.requiredTags && quest.requiredTags.length > 0) {
                                    const hasTag = quest.requiredTags.some((tag: Tag) => r.champion.tags?.some(ct => ct.id === tag.id));
                                    if (!hasTag) return false;
                                }
                                if (encounter.minStarLevel && r.stars < encounter.minStarLevel) return false;
                                if (encounter.maxStarLevel && r.stars > encounter.maxStarLevel) return false;
                                if (encounter.requiredClasses && encounter.requiredClasses.length > 0 && !encounter.requiredClasses.includes(r.champion.class)) return false;
                                if (encounter.requiredTags && encounter.requiredTags.length > 0) {
                                    const hasTag = encounter.requiredTags.some(tag => r.champion.tags?.some(ct => ct.id === tag.id));
                                    if (!hasTag) return false;
                                }
                                return true;
                            });
                            if (quest.teamLimit === null) {
                                const otherSelectionsCount = Object.entries(selections).reduce((acc, [encId, rid]) => {
                                    if (encId !== encounter.id && rid !== null) {
                                        const rosterEntry = roster.find(re => re.id === rid);
                                        if (rosterEntry) acc[rosterEntry.championId] = (acc[rosterEntry.championId] || 0) + 1;
                                    }
                                    return acc;
                                }, {} as Record<number, number>);
                                const availableCount = encounterRoster.reduce((acc, r) => {
                                    acc[r.championId] = (acc[r.championId] || 0) + 1;
                                    return acc;
                                }, {} as Record<number, number>);
                                encounterRoster = encounterRoster.filter(r => {
                                    if (selections[encounter.id] === r.id) return true;
                                    return (otherSelectionsCount[r.championId] || 0) < (availableCount[r.championId] || 0);
                                });
                            }
                            encounterRoster = encounterRoster.sort((a, b) => {
                                if (selections[encounter.id] === a.id && selections[encounter.id] !== b.id) return -1;
                                if (selections[encounter.id] !== a.id && selections[encounter.id] === b.id) return 1;
                                const nameCompare = a.champion.name.localeCompare(b.champion.name);
                                if (nameCompare !== 0) return nameCompare;
                                return a.id.localeCompare(b.id);
                            });
                            if (roster.length === 0) return <div className="p-8 text-center border border-dashed border-slate-700 bg-slate-900/30 rounded-xl"><p className="text-slate-400 text-lg">Your roster is empty.</p><p className="text-slate-500 text-sm mt-2">Go to the Roster section to add some champions before planning!</p></div>;
                            if (encounterRoster.length === 0) return <div className="p-6 text-center border border-dashed border-slate-800 bg-slate-900/20 rounded-xl"><p className="text-slate-400">No champions in your roster match the current filters or quest restrictions.</p></div>;
                            return (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 2xl:grid-cols-14 gap-y-4 gap-x-2 max-h-[450px] overflow-y-auto p-2 pt-4 border border-slate-800/50 bg-slate-950/30 rounded-xl custom-scrollbar">
                                        {encounterRoster.slice(0, 30).map((r: RosterWithChampion) => {
                                            const isSelected = selections[encounter.id] === r.id;
                                            const isRecommended = encounter.recommendedChampions.some(rc => rc.id === r.championId);
                                            const isInTeam = Object.values(selections).includes(r.id);
                                            return (
                                                <div key={r.id} onClick={() => handleSelectCounter(encounter.id, r.id)} title={`${r.champion.name} - ${r.stars}★ Rank ${r.rank} Sig ${r.sigLevel || 0}`} className="cursor-pointer">
                                                    <UpdatedChampionItem item={{ stars: r.stars, rank: r.rank, isAwakened: r.isAwakened, sigLevel: r.sigLevel, powerRating: r.powerRating, champion: { id: r.champion.id, name: r.champion.shortName || r.champion.name, championClass: r.champion.class, images: r.champion.images }, isAscended: r.isAscended }} isSelected={isSelected} isRecommended={isRecommended} isInTeam={isInTeam} />
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {encounterRoster.length > 30 && <div className="text-center p-3 bg-slate-900/30 border border-slate-800 border-dashed rounded-lg"><p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Showing first 30 of {encounterRoster.length} matches. Use search or filters to narrow down.</p></div>}
                                </div>
                            );
                        })()}
                    </div>
                )}
            </div>
        </div>
    );
}

function EncounterExpandedContent({
    encounter,
    quest,
    selections,
    readOnly,
    showVideoId,
    setShowVideoId,
    tabState,
    filterState,
    rosterState,
    renderChampionItem,
    renderListPick
}: EncounterExpandedContentProps) {
    const { encounterTabs, setEncounterTabs, featuredPicks, alliancePicks, popularCounters } = tabState;

    return (
        <>
            {encounter.videoUrl && (
                <div className="mb-4">
                    {showVideoId === encounter.id ? (
                        <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-slate-800 shadow-2xl bg-black">
                            {(() => {
                                const embedUrl = getYoutubeEmbedUrl(encounter.videoUrl);
                                if (embedUrl) {
                                    return (
                                        <iframe
                                            src={embedUrl}
                                            title="YouTube video player"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                            allowFullScreen
                                            className="absolute inset-0 w-full h-full border-0"
                                        ></iframe>
                                    );
                                }
                                return <div className="p-8 text-center text-slate-500">Invalid video URL</div>;
                            })()}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full h-8 w-8 z-50"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowVideoId(null);
                                }}
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    ) : (
                        <div
                            className="group/video relative overflow-hidden rounded-xl border border-red-900/30 bg-gradient-to-r from-red-950/20 to-slate-900/40 p-4 cursor-pointer hover:border-red-600/50 transition-all active:scale-[0.99]"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowVideoId(encounter.id);
                            }}
                        >
                            <div className="flex items-center gap-4">
                                <div className="relative h-12 w-20 rounded bg-slate-950 flex items-center justify-center border border-slate-800 overflow-hidden shrink-0">
                                    <Youtube className="w-6 h-6 text-red-600 group-hover/video:scale-110 transition-transform" />
                                    <div className="absolute inset-0 bg-red-600/5 opacity-0 group-hover/video:opacity-100 transition-opacity" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-slate-200">Video Guide Available</h4>
                                    <p className="text-xs text-slate-500">Click to watch the strategy for this encounter</p>
                                </div>
                                <div className="ml-auto">
                                    <PlayCircle className="w-8 h-8 text-red-600/40 group-hover/video:text-red-600 transition-colors" />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {(quest.minStarLevel || quest.maxStarLevel || quest.requiredClasses?.length || encounter.minStarLevel || encounter.maxStarLevel || encounter.requiredClasses?.length) ? (
                <div className="flex flex-col gap-2 mb-4 bg-red-950/10 p-4 rounded-lg border border-red-900/30">
                    <div className="flex items-center gap-2 text-sm text-red-400 uppercase tracking-wide font-bold"><AlertCircle className="w-4 h-4" /> Quest & Encounter Restrictions Apply</div>
                    <div className="flex flex-wrap gap-2 mt-1">
                        {[
                            quest.minStarLevel ? `Min ${quest.minStarLevel}★ (Quest)` : null,
                            quest.maxStarLevel ? `Max ${quest.maxStarLevel}★ (Quest)` : null,
                            quest.requiredClasses?.length ? `Class: ${quest.requiredClasses.join(", ")} (Quest)` : null,
                            encounter.minStarLevel ? `Min ${encounter.minStarLevel}★ (Encounter)` : null,
                            encounter.maxStarLevel ? `Max ${encounter.maxStarLevel}★ (Encounter)` : null,
                            encounter.requiredClasses?.length ? `Class: ${encounter.requiredClasses.join(", ")} (Encounter)` : null,
                            quest.requiredTags?.length ? `Quest Tags: ${quest.requiredTags.map((t) => t.name).join(", ")}` : null,
                            encounter.requiredTags?.length ? `Fight Tags: ${encounter.requiredTags.map((t) => t.name).join(", ")}` : null
                        ].filter(Boolean).map((req, i) => (
                            <Badge key={i} variant="outline" className="border-red-800/60 text-red-200 bg-red-950/40">{req}</Badge>
                        ))}
                    </div>
                </div>
            ) : null}

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 pt-2">
                <div className="xl:col-span-7 space-y-4">
                    {encounter.nodes.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="h-6 w-1 bg-sky-500 rounded-full" />
                                <h4 className="text-xs font-bold text-sky-400 uppercase tracking-[0.2em]">Encounter Nodes</h4>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {encounter.nodes.map((n: EncounterNodeWithRelations) => (
                                    <div key={n.id} className="bg-slate-950/80 p-3 rounded-lg border border-slate-800/80 group/node transition-all hover:border-sky-800/50 hover:bg-slate-900/50">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="p-1 rounded bg-sky-500/10 text-sky-500 shrink-0">
                                                <Info className="w-3.5 h-3.5" />
                                            </div>
                                            <span className="font-bold text-sm text-slate-100">{n.nodeModifier.name}</span>
                                        </div>
                                        <span className="text-xs text-slate-400 leading-normal block pl-8 pr-2">{n.nodeModifier.description}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {encounter.tips && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="h-6 w-1 bg-indigo-500 rounded-full" />
                                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-[0.2em]">Strategy & Tips</h4>
                            </div>
                            <div className="bg-indigo-950/20 p-5 rounded-xl border border-indigo-900/40 text-indigo-100 text-sm leading-relaxed shadow-inner">
                                <SimpleMarkdown content={encounter.tips} />
                            </div>
                        </div>
                    )}
                </div>

                <div className="xl:col-span-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <div className="h-6 w-1 bg-amber-500 rounded-full" />
                            <h4 className="text-xs font-bold text-amber-500 uppercase tracking-[0.2em]">Suggested Counters</h4>
                            <InfoPopover 
                                content={
                                    <div className="space-y-3">
                                        <div className="space-y-1">
                                            <p className="font-bold text-amber-500 uppercase text-[10px] tracking-wider">Recommended</p>
                                            <p className="text-slate-300 text-xs">Highly relevant counters based on current meta and community data.</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-bold text-purple-400 uppercase text-[10px] tracking-wider">Featured</p>
                                            <p className="text-slate-300 text-xs">Specialized plans suggested by notable community members and creators.</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-bold text-emerald-400 uppercase text-[10px] tracking-wider">Alliance</p>
                                            <p className="text-slate-300 text-xs">Counters successfully used by your alliance mates.</p>
                                        </div>
                                    </div>
                                }
                                side="top"
                                align="center"
                                iconClassName="h-3.5 w-3.5"
                            />
                        </div>
                        {((featuredPicks[encounter.id] && featuredPicks[encounter.id].length > 0) || (alliancePicks[encounter.id] && alliancePicks[encounter.id].length > 0)) && (
                            <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5 self-start shadow-sm">
                                <button onClick={() => setEncounterTabs(prev => ({ ...prev, [encounter.id]: "recommended" }))} className={cn("px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-colors", (!encounterTabs[encounter.id] || encounterTabs[encounter.id] === "recommended") ? "bg-slate-800 text-amber-500 shadow-sm" : "text-slate-500 hover:text-slate-300")}>Recommended</button>
                                {featuredPicks[encounter.id] && featuredPicks[encounter.id].length > 0 && (
                                    <button onClick={() => setEncounterTabs(prev => ({ ...prev, [encounter.id]: "featured" }))} className={cn("px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-colors", encounterTabs[encounter.id] === "featured" ? "bg-slate-800 text-purple-400 shadow-sm" : "text-slate-500 hover:text-slate-300")}>Featured</button>
                                )}
                                {alliancePicks[encounter.id] && alliancePicks[encounter.id].length > 0 && (
                                    <button onClick={() => setEncounterTabs(prev => ({ ...prev, [encounter.id]: "alliance" }))} className={cn("px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-colors", encounterTabs[encounter.id] === "alliance" ? "bg-slate-800 text-emerald-400 shadow-sm" : "text-slate-500 hover:text-slate-300")}>Alliance</button>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 space-y-4">
                        {encounter.recommendedTags.length > 0 && (!encounterTabs[encounter.id] || encounterTabs[encounter.id] === "recommended") && (
                            <div className="flex flex-wrap gap-2">
                                {encounter.recommendedTags.map((tag: string) => (
                                    <Badge key={tag} variant="outline" className="text-[10px] uppercase font-bold bg-amber-950/20 border-amber-800/50 text-amber-400 py-1 px-2.5 rounded-full flex gap-2 items-center tracking-wider shadow-sm">
                                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span> {tag}
                                    </Badge>
                                ))}
                            </div>
                        )}
                        <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-5 2xl:grid-cols-6 gap-2 sm:gap-3">
                            {(() => {
                                const activeTab = encounterTabs[encounter.id] || "recommended";
                                if (activeTab === "recommended") {
                                    const encounterPicks = popularCounters[encounter.id] || [];
                                    const pickCountMap = new Map(encounterPicks.map(p => [p.championId, p.count]));
                                    const recommendedIds = new Set(encounter.recommendedChampions.map(c => c.id));
                                    const communityPicks = encounterPicks.filter(p => !recommendedIds.has(p.championId)).map(p => ({ ...p.champion, images: toChampionImages(p.champion.images), isCommunity: true }));
                                    const allCandidates = [...encounter.recommendedChampions.map(c => ({ ...c, images: toChampionImages(c.images), isOfficial: true })), ...communityPicks];
                                    const sortedChampions = allCandidates.sort((a, b) => (pickCountMap.get(b.id) || 0) - (pickCountMap.get(a.id) || 0));
                                    if (sortedChampions.length === 0) return <p className="text-xs text-slate-500 italic py-4 text-center border border-dashed border-slate-800 rounded-lg col-span-full">No specific champions recommended for this encounter.</p>;
                                    return sortedChampions.map((c) => {
                                        const pickCount = pickCountMap.get(c.id) || 0;
                                        const totalPlayers = quest._count?.playerPlans || 0;
                                        const popularityLabel = totalPlayers > 0 && pickCount > 0 ? `${Math.round((pickCount / totalPlayers) * 100)}%` : undefined;
                                        return <div key={c.id}>{renderChampionItem(c as Champion, encounter, popularityLabel, true)}</div>;
                                    });
                                }
                                return null;
                            })()}
                        </div>
                        {(encounterTabs[encounter.id] === "featured" && featuredPicks[encounter.id]?.length > 0) && <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300"><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{featuredPicks[encounter.id].map((p) => renderListPick(p, encounter))}</div></div>}
                        {(encounterTabs[encounter.id] === "alliance" && alliancePicks[encounter.id]?.length > 0) && <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300"><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{alliancePicks[encounter.id].map((p) => renderListPick(p, encounter))}</div></div>}
                    </div>
                </div>
            </div>

            {!readOnly && (
                <RosterSelector
                    encounter={encounter}
                    quest={quest}
                    selections={selections}
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
    readOnly,
    showVideoId,
    setShowVideoId,
    tabState,
    filterState,
    rosterState,
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
    const hasSelection = !!selectedRosterId;
    const colors = encounter.defender ? getChampionClassColors(encounter.defender.class as ChampionClass) : null;
    const isLast = index === quest.encounters.length - 1;

    // Find which champions in the currently selected team are recommended for this fight.
    // Skip the work entirely in read-only mode since the suggestion UI is not shown.
    const suggestedTeamChamps = !readOnly
        ? selectedTeam.filter((teamMember) =>
            encounter.recommendedChampions.some((rc) => rc.id === teamMember.championId)
        )
        : [];

    return (
        <div key={encounter.id} className="relative flex items-stretch group/encounter is-active pl-8 md:pl-10">
                                    {/* Timeline Node (Circle on the line) */}
                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 flex items-center justify-center">
                                        <div className={cn(
                                            "flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full border-2 transition-all duration-300 font-black",
                                            hasSelection
                                                ? "bg-slate-950 border-sky-500/60 text-sky-500 shadow-[0_0_12px_rgba(14,165,233,0.15)]"
                                                : isLast
                                                    ? "bg-slate-950 border-red-500/50 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.15)]"
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
                                        "absolute left-0 top-1/2 -translate-y-1/2 h-0.5 w-8 md:w-10 z-10 transition-colors duration-300",
                                        hasSelection ? "bg-sky-500/50" : (isLast ? "bg-red-800/50" : "bg-slate-800 group-hover/encounter:bg-slate-700")
                                    )} />

                                    {/* Card Content */}
                                    <Card
                                        id={`encounter-${encounter.id}`}
                                        className={cn(
                                            "flex-1 bg-slate-950/90 backdrop-blur-md border transition-all cursor-pointer overflow-hidden z-10 relative",
                                            hasSelection ? "border-sky-800/80 shadow-[0_0_20px_rgba(2,132,199,0.15)]" : (isLast ? "border-red-900/40 shadow-[0_0_20px_rgba(220,38,38,0.1)]" : "border-slate-800 hover:border-slate-700 hover:bg-slate-900/90"),
                                            isExpanded && "ring-1 ring-slate-700 shadow-xl"
                                        )}
                                    >
                                        <EncounterHeader
                                            encounter={encounter}
                                            isExpanded={isExpanded}
                                            hasSelection={hasSelection}
                                            colors={colors}
                                            selectedRosterId={selectedRosterId}
                                            selectedRosterItem={selectedRosterItem}
                                            suggestedTeamChamps={suggestedTeamChamps}
                                            readOnly={readOnly}
                                            toggleExpand={toggleExpand}
                                            handleSelectCounter={handleSelectCounter}
                                        />

                                        {/* Expanded Content */}
                                        {isExpanded && (
                                            <EncounterDetails>
                                                <EncounterExpandedContent
                                                    encounter={encounter}
                                                    quest={quest}
                                                    selections={selections}
                                                    readOnly={readOnly}
                                                    showVideoId={showVideoId}
                                                    setShowVideoId={setShowVideoId}
                                                    tabState={tabState}
                                                    filterState={filterState}
                                                    rosterState={rosterState}
                                                    renderChampionItem={renderChampionItem}
                                                    renderListPick={renderListPick}
                                                />
                                            </EncounterDetails>
                                        )}
                                    </Card>
                                </div>
                            );
}
