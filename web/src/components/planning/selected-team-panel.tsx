"use client";

import Image from "next/image";
import { AlertCircle, Check, CheckCircle2, ChevronDown, Share2, ShieldAlert, Target, Users, X, Zap } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChampionAvatar } from "@/components/champion-avatar";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { getChampionImageUrlOrPlaceholder } from "@/lib/championHelper";
import { cn } from "@/lib/utils";
import type { QuestPlanningSelectionMap, QuestPlanningTeamMember } from "@/lib/quest-planning-projection";
import { ReviveOrbIcon } from "./encounter-card/EncounterCard";
import type { EncounterWithRelations, QuestTimelineProps, RosterWithChampion } from "./types";
import { isChampionValidForEncounterOrQuest } from "./utils";

type SelectedTeamPanelProps = {
    quest: QuestTimelineProps["quest"];
    roster: RosterWithChampion[];
    selectedTeam: RosterWithChampion[];
    selectedTeamMembers: QuestPlanningTeamMember<RosterWithChampion, EncounterWithRelations>[];
    activeSelections: QuestPlanningSelectionMap;
    synergyIds: number[];
    readOnly: boolean;
    isScrolled: boolean;
    isTeamExpanded: boolean;
    isSharing: boolean;
    shareSuccess: boolean;
    activeRevivesTotal: number;
    allRevivesTotal: number;
    onToggleExpanded: () => void;
    onShare: () => void;
    onRemoveTeamMember: (rosterId: string, championId: number, championName: string) => void;
    onSelectSynergy: (championId: number) => void;
    scrollToEncounter: (encounterId: string) => void;
};

function EncounterTargetButton({
    encounter,
    scrollToEncounter,
}: {
    encounter: EncounterWithRelations;
    scrollToEncounter: (encounterId: string) => void;
}) {
    const diffBorder = encounter.difficulty === "HARD"
        ? "border-red-700/60"
        : encounter.difficulty === "EASY"
            ? "border-emerald-700/50"
            : encounter.difficulty === "NORMAL"
                ? "border-amber-700/50"
                : "border-slate-700";
    const diffBg = encounter.difficulty === "HARD"
        ? "bg-red-950/60"
        : encounter.difficulty === "EASY"
            ? "bg-emerald-950/60"
            : encounter.difficulty === "NORMAL"
                ? "bg-amber-950/60"
                : "bg-slate-800";

    return (
        <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            role="button"
            tabIndex={0}
            aria-label={`Fight ${encounter.sequence}: ${encounter.defender?.name || "Unknown"}`}
            title={`Fight ${encounter.sequence}: ${encounter.defender?.name || "Unknown"}`}
            className={cn(
                "relative h-8 w-8 cursor-pointer overflow-hidden rounded-lg border shadow-sm transition-colors hover:border-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 group/tgt",
                diffBorder,
                diffBg
            )}
            onClick={(event) => {
                event.stopPropagation();
                scrollToEncounter(encounter.id);
            }}
        >
            {encounter.defender ? (
                <Image
                    src={getChampionImageUrlOrPlaceholder(encounter.defender.images, "64")}
                    alt={encounter.defender.name}
                    fill
                    className="object-cover transition-transform group-hover/tgt:scale-110"
                />
            ) : (
                <div className="flex h-full w-full items-center justify-center bg-slate-800">
                    <ShieldAlert className="h-3 w-3 text-slate-500" />
                </div>
            )}
            <div className="absolute inset-0 bg-sky-500/10 opacity-0 transition-opacity group-hover/tgt:opacity-100" />
        </motion.div>
    );
}

function PrefightTargetButton({
    encounter,
    scrollToEncounter,
}: {
    encounter: EncounterWithRelations;
    scrollToEncounter: (encounterId: string) => void;
}) {
    return (
        <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            role="button"
            tabIndex={0}
            aria-label={`Prefight for fight ${encounter.sequence}: ${encounter.defender?.name || "Unknown"}`}
            title={`Prefight for fight ${encounter.sequence}: ${encounter.defender?.name || "Unknown"}`}
            className="relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-700/70 bg-slate-950/70 text-slate-400 shadow-sm transition-colors hover:border-slate-500 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
            onClick={(event) => {
                event.stopPropagation();
                scrollToEncounter(encounter.id);
            }}
        >
            <Zap className="h-3 w-3" />
        </motion.div>
    );
}

function SelectedTeamMemberCard({
    teamMember,
    readOnly,
    onRemoveTeamMember,
    scrollToEncounter,
}: {
    teamMember: QuestPlanningTeamMember<RosterWithChampion, EncounterWithRelations>;
    readOnly: boolean;
    onRemoveTeamMember: (rosterId: string, championId: number, championName: string) => void;
    scrollToEncounter: (encounterId: string) => void;
}) {
    const { rosterEntry, assignedEncounters, prefightEncounters } = teamMember;
    const classColors = getChampionClassColors(rosterEntry.champion.class);
    const assignmentCount = assignedEncounters.length + prefightEncounters.length;

    return (
        <motion.div
            layout
            className={cn(
                "relative flex flex-col overflow-hidden rounded-2xl border bg-slate-950/40 transition-all duration-300 hover:bg-slate-900/60 group/team-member",
                classColors.hoverBorder.replace("hover:", "group-hover/team-member:"),
                "border-slate-800/60"
            )}
        >
            {!readOnly && (
                <button
                    onClick={(event) => {
                        event.stopPropagation();
                        onRemoveTeamMember(rosterEntry.id, rosterEntry.championId, rosterEntry.champion.name);
                    }}
                    className="absolute right-2 top-2 z-20 rounded-full border border-transparent bg-slate-950/50 p-1.5 text-slate-400 opacity-0 transition-all hover:border-red-500/50 hover:bg-red-500/20 hover:text-red-400 group-hover/team-member:opacity-100"
                    title="Remove from team"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            )}

            <div className={cn("absolute right-0 top-0 -mr-16 -mt-16 h-32 w-32 rounded-full opacity-5 blur-3xl transition-opacity group-hover/team-member:opacity-10", classColors.bg)} />

            <div className="relative z-10 flex items-start gap-3 p-3">
                <div className="shrink-0">
                    <ChampionAvatar
                        images={rosterEntry.champion.images}
                        name={rosterEntry.champion.name}
                        stars={rosterEntry.stars}
                        rank={rosterEntry.rank}
                        isAwakened={rosterEntry.isAwakened}
                        sigLevel={rosterEntry.sigLevel}
                        isAscended={rosterEntry.isAscended}
                        ascensionLevel={rosterEntry.ascensionLevel}
                        championClass={rosterEntry.champion.class}
                        size="lg"
                        showRank={true}
                        showStars={true}
                    />
                </div>
                <div className="min-w-0 flex-1 py-1 pr-6">
                    <h4 className={cn("mb-0.5 truncate text-xs font-black uppercase tracking-wider", classColors.text)}>
                        {rosterEntry.champion.name}
                    </h4>
                    <div className="flex items-center gap-2">
                        {assignmentCount > 0 ? (
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                {assignedEncounters.length} Fight{assignedEncounters.length === 1 ? "" : "s"} · {prefightEncounters.length} Prefight{prefightEncounters.length === 1 ? "" : "s"}
                            </span>
                        ) : (
                            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-sky-500/80">
                                <div className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                                Synergy
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="relative z-10 mt-auto px-3 pb-3">
                {assignmentCount > 0 ? (
                    <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-800/50 bg-slate-950/60 p-2 shadow-inner transition-colors group-hover/team-member:border-slate-700/50">
                        {assignedEncounters.map((encounter) => (
                            <EncounterTargetButton
                                key={`tgt-${encounter.id}`}
                                encounter={encounter}
                                scrollToEncounter={scrollToEncounter}
                            />
                        ))}
                        {prefightEncounters.map((encounter) => (
                            <PrefightTargetButton
                                key={`prefight-tgt-${encounter.id}`}
                                encounter={encounter}
                                scrollToEncounter={scrollToEncounter}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="rounded-xl border border-dashed border-slate-800/30 bg-slate-950/40 px-3 py-2 text-center">
                        <span className="text-[10px] font-bold uppercase italic tracking-widest text-slate-600">Unassigned</span>
                    </div>
                )}
            </div>
        </motion.div>
    );
}

function AddSynergyPopover({
    quest,
    roster,
    activeSelections,
    synergyIds,
    onSelectSynergy,
}: {
    quest: QuestTimelineProps["quest"];
    roster: RosterWithChampion[];
    activeSelections: QuestPlanningSelectionMap;
    synergyIds: number[];
    onSelectSynergy: (championId: number) => void;
}) {
    const synergyOptions = roster
        .filter((rosterEntry, index, self) => self.findIndex(item => item.championId === rosterEntry.championId) === index)
        .filter(rosterEntry => isChampionValidForEncounterOrQuest(rosterEntry, quest, undefined));

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button className="flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-800 bg-slate-900/30 p-6 transition-all hover:border-sky-500/50 hover:bg-slate-900/50 group/add-synergy">
                    <div className="rounded-full bg-slate-800/50 p-3 text-slate-400 shadow-inner transition-colors group-hover/add-synergy:bg-sky-500/20 group-hover/add-synergy:text-sky-400">
                        <Users className="h-6 w-6" />
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-300 transition-colors group-hover/add-synergy:text-sky-400">Add Synergy</span>
                        <span className="text-[10px] font-medium text-slate-500">Search roster...</span>
                    </div>
                </button>
            </PopoverTrigger>
            <PopoverContent
                className="z-[100] w-[calc(100vw-32px)] overflow-hidden rounded-xl border border-slate-700/80 bg-slate-950/95 p-0 shadow-[0_10px_40px_rgba(0,0,0,0.8),0_0_20px_rgba(14,165,233,0.15)] backdrop-blur-xl sm:w-[320px]"
                align="start"
                sideOffset={8}
            >
                <Command
                    className="bg-transparent"
                    filter={(value, search) => value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0}
                >
                    <CommandInput placeholder="Search champions..." className="h-11" />
                    <CommandEmpty className="py-4 text-center text-sm text-slate-500">No champions found.</CommandEmpty>
                    <CommandList className="max-h-[300px] custom-scrollbar">
                        <CommandGroup>
                            {synergyOptions.map((rosterEntry) => {
                                const isAssigned = Object.values(activeSelections).some(rosterId => {
                                    if (!rosterId) return false;
                                    return roster.find(entry => entry.id === rosterId)?.championId === rosterEntry.championId;
                                });
                                const isSynergy = synergyIds.includes(rosterEntry.championId);
                                const isSelected = isAssigned || isSynergy;

                                return (
                                    <CommandItem
                                        key={rosterEntry.championId}
                                        value={`${rosterEntry.champion.name} ${rosterEntry.champion.shortName || ""}`}
                                        className="flex cursor-pointer items-center gap-3 px-3 py-2 aria-selected:bg-slate-800/60"
                                        onSelect={() => {
                                            if (!isAssigned) onSelectSynergy(rosterEntry.championId);
                                        }}
                                        disabled={isAssigned}
                                    >
                                        <div className={cn(
                                            "relative h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-slate-700",
                                            isAssigned && "opacity-40 grayscale"
                                        )}>
                                            <Image
                                                src={getChampionImageUrlOrPlaceholder(rosterEntry.champion.images, "64")}
                                                alt={rosterEntry.champion.name}
                                                fill
                                                className="object-cover"
                                            />
                                        </div>
                                        <span className={cn(
                                            "min-w-0 flex-1 truncate text-sm font-bold",
                                            isAssigned ? "text-slate-600" : "text-slate-200"
                                        )}>
                                            {rosterEntry.champion.name}
                                        </span>
                                        {isSelected && !isAssigned && (
                                            <CheckCircle2 className="h-4 w-4 shrink-0 text-sky-500" />
                                        )}
                                        {isAssigned && (
                                            <Target className="h-4 w-4 shrink-0 text-slate-600" />
                                        )}
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

export function SelectedTeamPanel({
    quest,
    roster,
    selectedTeam,
    selectedTeamMembers,
    activeSelections,
    synergyIds,
    readOnly,
    isScrolled,
    isTeamExpanded,
    isSharing,
    shareSuccess,
    activeRevivesTotal,
    allRevivesTotal,
    onToggleExpanded,
    onShare,
    onRemoveTeamMember,
    onSelectSynergy,
    scrollToEncounter,
}: SelectedTeamPanelProps) {
    return (
        <div data-sticky-team className="pointer-events-none sticky top-0 z-40 mb-8 -mx-4 flex justify-center px-4 md:top-[68px] md:mx-0 md:px-0">
            <motion.div
                layout
                initial={false}
                className={cn("pointer-events-auto", isScrolled ? "py-2" : "py-0")}
                animate={{ scale: isScrolled ? 0.98 : 1 }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
            >
                <Card
                    className={cn(
                        "flex cursor-pointer flex-col overflow-hidden border bg-slate-950/90 shadow-2xl shadow-black/60 backdrop-blur-xl transition-[background-color,border-color,opacity,box-shadow,border-radius] duration-500 ease-in-out group/team-card",
                        isScrolled ? "rounded-3xl border-sky-500/40" : "rounded-2xl border-sky-900/30",
                        isTeamExpanded
                            ? "w-[95vw] bg-slate-900/90 sm:w-[90vw] md:max-w-5xl"
                            : "w-fit max-w-[calc(100vw-2rem)] hover:border-sky-500/50 hover:bg-slate-900/60"
                    )}
                    onClick={onToggleExpanded}
                >
                    <motion.div layout className="flex flex-col">
                        <div className={cn(
                            "flex items-center justify-between px-4 py-2 transition-all",
                            isScrolled && !isTeamExpanded ? "justify-center gap-4" : ""
                        )}>
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "rounded-md bg-sky-500/10 p-1 text-sky-400 transition-colors group-hover/team-card:bg-sky-500/20",
                                    isScrolled && !isTeamExpanded ? "hidden sm:block" : ""
                                )}>
                                    <Users className="h-3.5 w-3.5" />
                                </div>
                                <span className={cn(
                                    "text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 transition-colors group-hover/team-card:text-sky-400",
                                    isScrolled && !isTeamExpanded ? "hidden sm:block" : ""
                                )}>
                                    {readOnly ? "Team" : "Your Team"}
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                {!readOnly && quest.status === "VISIBLE" && (
                                    <button
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onShare();
                                        }}
                                        disabled={isSharing}
                                        className={cn(
                                            "rounded-lg border p-1.5 transition-all",
                                            shareSuccess
                                                ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400"
                                                : "border-slate-800 bg-slate-900/50 text-slate-400 hover:border-sky-800 hover:bg-sky-950/30 hover:text-sky-400"
                                        )}
                                        title="Share your plan"
                                    >
                                        {shareSuccess ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
                                    </button>
                                )}
                                <div className="flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-950/80 px-2 py-0.5 shadow-inner">
                                    <span className={cn(
                                        "text-[10px] font-black",
                                        (quest.teamLimit && selectedTeam.length > quest.teamLimit) ? "text-red-400" : "text-sky-400"
                                    )}>
                                        {selectedTeam.length}
                                    </span>
                                    {quest.teamLimit ? (
                                        <>
                                            <span className="text-[10px] font-bold text-slate-600">/</span>
                                            <span className="text-[10px] font-bold text-slate-400">{quest.teamLimit}</span>
                                        </>
                                    ) : (
                                        <span className="ml-0.5 text-[10px] font-bold text-slate-600">Champions</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5 rounded-full border border-emerald-800/60 bg-emerald-950/35 px-2 py-0.5 shadow-inner">
                                    <ReviveOrbIcon className="h-4 w-4" />
                                    <span className="text-[10px] font-black text-emerald-100">{activeRevivesTotal}</span>
                                    <span className="text-[10px] font-bold text-emerald-200/70">Revives</span>
                                    {allRevivesTotal !== activeRevivesTotal && (
                                        <span className="ml-1 text-[10px] font-bold text-slate-500">All {allRevivesTotal}</span>
                                    )}
                                </div>
                                <motion.div animate={{ rotate: isTeamExpanded ? 180 : 0 }} transition={{ duration: 0.3 }}>
                                    <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                                </motion.div>
                            </div>
                        </div>

                        <AnimatePresence initial={false}>
                            {isTeamExpanded && (
                                <motion.div
                                    key="team-expanded-content"
                                    layout
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.4, ease: "easeInOut" }}
                                    className="cursor-auto overflow-hidden"
                                    onClick={(event) => event.stopPropagation()}
                                >
                                    <div
                                        className="max-h-[calc(100svh-60px)] overflow-y-auto px-4 pb-4 pt-1 custom-scrollbar md:max-h-none"
                                        style={{ WebkitOverflowScrolling: "touch" }}
                                    >
                                        {selectedTeam.length === 0 && readOnly ? (
                                            <div className="flex flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-slate-800 bg-slate-900/20 py-8">
                                                <div className="rounded-full bg-slate-800/50 p-3 text-slate-500">
                                                    <Users className="h-6 w-6" />
                                                </div>
                                                <p className="text-sm font-medium text-slate-400">No champions selected yet</p>
                                                <p className="text-xs text-slate-600">Assign counters to build your team</p>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-6">
                                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                                    {selectedTeamMembers.map((teamMember) => (
                                                        <SelectedTeamMemberCard
                                                            key={teamMember.rosterEntry.id}
                                                            teamMember={teamMember}
                                                            readOnly={readOnly}
                                                            onRemoveTeamMember={onRemoveTeamMember}
                                                            scrollToEncounter={scrollToEncounter}
                                                        />
                                                    ))}

                                                    {!readOnly && (
                                                        <AddSynergyPopover
                                                            quest={quest}
                                                            roster={roster}
                                                            activeSelections={activeSelections}
                                                            synergyIds={synergyIds}
                                                            onSelectSynergy={onSelectSynergy}
                                                        />
                                                    )}
                                                </div>

                                                {quest.teamLimit !== null && selectedTeam.length > quest.teamLimit && (
                                                    <motion.div
                                                        initial={{ opacity: 0, scale: 0.9 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        className="flex w-full items-center gap-3 rounded-xl border border-red-900/40 bg-red-950/20 px-4 py-2.5 text-red-400 shadow-lg shadow-red-900/10"
                                                    >
                                                        <AlertCircle className="h-4 w-4 shrink-0" />
                                                        <p className="text-xs font-bold uppercase tracking-wider">Team limit exceeded by {selectedTeam.length - quest.teamLimit} champions</p>
                                                    </motion.div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <AnimatePresence>
                            {!isTeamExpanded && selectedTeam.length > 0 && (
                                <motion.div
                                    key="team-collapsed-content"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="flex flex-row items-center justify-center gap-3 px-4 pb-3"
                                >
                                    <div className="flex -space-x-3 transition-all duration-300 hover:space-x-1">
                                        {selectedTeam.map(rosterEntry => (
                                            <div key={`collapsed-${rosterEntry.id}`} className="relative group/mini-avatar">
                                                <div className="relative h-8 w-8 overflow-hidden rounded-full border-2 border-slate-950 shadow-lg transition-transform group-hover/mini-avatar:-translate-y-1">
                                                    <Image
                                                        src={getChampionImageUrlOrPlaceholder(rosterEntry.champion.images, "64")}
                                                        alt={rosterEntry.champion.name}
                                                        fill
                                                        className="object-cover"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <span className="ml-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                        Active Team
                                    </span>
                                </motion.div>
                            )}
                            {!isTeamExpanded && selectedTeam.length === 0 && (
                                <motion.div
                                    key="team-empty-collapsed"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="px-4 pb-2 text-center"
                                >
                                    <p className="text-[9px] font-bold uppercase tracking-tighter text-slate-600">Click to expand</p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                </Card>
            </motion.div>
        </div>
    );
}
