"use client";

import { useState, useMemo, useCallback } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
    EncounterWithRelations,
    RosterWithChampion,
    QuestTimelineProps,
} from "./types";
import {
    isChampionValidForEncounterOrQuest,
} from "./utils";
import {
    createInitialQuestTimelinePrefightSelections,
    createInitialQuestTimelineSelections,
    isReadOnlyRosterEntry,
    projectQuestTimelineViewModel,
} from "./quest-timeline-view-model";
import type { ChampionClass } from "@prisma/client";
import { createQuestTimelinePickRenderers } from "./quest-pick-renderers";
import { QuestEncounterList } from "./quest-encounter-list";
import { QuestTimelineActionBar } from "./quest-timeline-action-bar";
import { RoutePlannerPanel, TimelineColumnHeader } from "./route-planner-panel";
import { SelectedTeamPanel } from "./selected-team-panel";
import { useQuestClearPlan } from "./use-quest-clear-plan";
import { useQuestEncounterRevives } from "./use-quest-encounter-revives";
import { useQuestPlanSharing } from "./use-quest-plan-sharing";
import { useQuestRouteChoices } from "./use-quest-route-choices";
import { useQuestSelectionMutations } from "./use-quest-selection-mutations";
import { useQuestSynergyMutations } from "./use-quest-synergy-mutations";
import { useQuestTeamMemberRemoval } from "./use-quest-team-member-removal";
import { useQuestTimelineScroll } from "./use-quest-timeline-scroll";
import { useRouteConnectorGeometry } from "./use-route-connector-geometry";

const CLASSES = ["SCIENCE", "SKILL", "MYSTIC", "COSMIC", "TECH", "MUTANT"] as const;
const EMPTY_ROSTER: NonNullable<QuestTimelineProps["roster"]> = [];
const EMPTY_SAVED_ENCOUNTERS: NonNullable<QuestTimelineProps["savedEncounters"]> = [];
const EMPTY_SAVED_ROUTE_CHOICES: NonNullable<QuestTimelineProps["savedRouteChoices"]> = [];
const EMPTY_SAVED_SYNERGIES: NonNullable<QuestTimelineProps["savedSynergies"]> = [];
const EMPTY_POPULAR_COUNTERS: NonNullable<QuestTimelineProps["popularCounters"]> = {};
const EMPTY_FEATURED_PICKS: NonNullable<QuestTimelineProps["featuredPicks"]> = {};
const EMPTY_ALLIANCE_PICKS: NonNullable<QuestTimelineProps["alliancePicks"]> = {};
const EMPTY_FILTER_METADATA: NonNullable<QuestTimelineProps["filterMetadata"]> = {
    tags: [],
    abilityCategories: [],
    abilities: [],
    immunities: []
};
const EMPTY_ROSTER_MAP: NonNullable<QuestTimelineProps["rosterMap"]> = {};

export default function QuestTimelineClient({ quest, roster = EMPTY_ROSTER, savedEncounters = EMPTY_SAVED_ENCOUNTERS, savedRouteChoices = EMPTY_SAVED_ROUTE_CHOICES, savedSynergies = EMPTY_SAVED_SYNERGIES, popularCounters = EMPTY_POPULAR_COUNTERS, featuredPicks = EMPTY_FEATURED_PICKS, alliancePicks = EMPTY_ALLIANCE_PICKS, filterMetadata = EMPTY_FILTER_METADATA, readOnly = false, rosterMap = EMPTY_ROSTER_MAP, initialSelections, initialPrefightSelections }: QuestTimelineProps) {
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedClass, setSelectedClass] = useState<ChampionClass | null>(null);
    const [isTeamExpanded, setIsTeamExpanded] = useState(false);
    const [showVideoId, setShowVideoId] = useState<string | null>(null);
    const { isSharing, shareSuccess, sharePlan } = useQuestPlanSharing({ quest, toast });
    const {
        headerRef,
        expandedId,
        isScrolled,
        toggleExpand,
        scrollToEncounter,
        closeEncounterAfterSelection,
    } = useQuestTimelineScroll({ setShowVideoId, setIsTeamExpanded });
    const [encounterTabs, setEncounterTabs] = useState<Record<string, 'recommended' | 'featured' | 'alliance'>>({});
    const { routeChoices, handleRouteChoice } = useQuestRouteChoices({ quest, savedRouteChoices, readOnly, toast });
    const [isRosterExpanded, setIsRosterExpanded] = useState(false);
    const [isClearPlanOpen, setIsClearPlanOpen] = useState(false);
    const [isNodesCollapsed, setIsNodesCollapsed] = useState(false);
    // Track synergy champions locally
    const [synergyIds, setSynergyIds] = useState<number[]>(() => savedSynergies.map(s => s.championId));

    // Track selections locally for immediate UI updates
    const [selections, setSelections] = useState<Record<string, string | null>>(() =>
        createInitialQuestTimelineSelections({
            quest,
            roster,
            savedEncounters,
            readOnly,
            rosterMap,
            initialSelections,
        })
    );

    const [prefightSelections, setPrefightSelections] = useState<Record<string, string | null>>(() =>
        createInitialQuestTimelinePrefightSelections({
            quest,
            roster,
            savedEncounters,
            readOnly,
            rosterMap,
            initialPrefightSelections,
        })
    );

    const { revivesByEncounterId, handleSetRevives } = useQuestEncounterRevives({
        questId: quest.id,
        savedEncounters,
        readOnly,
        toast,
    });

    const { executeClearPlan } = useQuestClearPlan({
        questId: quest.id,
        setSelections,
        setPrefightSelections,
        toast,
    });

    // Difficulty Filter State
    const [difficultyFilter, setDifficultyFilter] = useState<("EASY" | "NORMAL" | "HARD")[]>([]);

    const toggleDifficultyFilter = (d: "EASY" | "NORMAL" | "HARD") => {
        setDifficultyFilter(prev =>
            prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
        );
    };

    const {
        visibleRouteSections,
        routeFilteredEncounters,
        activeEncounterIds,
        activeSelections,
        activePrefightSelections,
        activeQuestAssignments,
        activeSynergyChampions,
        activeRevivesTotal,
        allRevivesTotal,
        activeQuest,
        encountersByRoutePathId,
        selectedRouteSummary,
        selectedRoutePathIds,
        filteredEncounters,
        selectedTeam,
        selectedTeamMembers,
        activePlayerPicksMap,
    } = useMemo(() => projectQuestTimelineViewModel({
        quest,
        routeChoices,
        selections,
        prefightSelections,
        synergyIds,
        revivesByEncounterId,
        roster,
        savedSynergies,
        difficultyFilter,
        readOnly,
        rosterMap,
        featuredPicks,
        alliancePicks,
    }), [quest, routeChoices, selections, prefightSelections, synergyIds, revivesByEncounterId, roster, savedSynergies, difficultyFilter, readOnly, rosterMap, featuredPicks, alliancePicks]);

    const {
        routeMapRef,
        routeStartRef,
        routeEndRef,
        routeConnectorPaths,
        routeMapSize,
        setRouteCardRef,
    } = useRouteConnectorGeometry(selectedRoutePathIds);

    const {
        championToRemove,
        setChampionToRemove,
        initiateRemoveTeamMember,
        executeRemoveTeamMember,
    } = useQuestTeamMemberRemoval({
        quest,
        selectedTeamMembers,
        synergyIds,
        setSelections,
        setPrefightSelections,
        setSynergyIds,
        toast,
    });

    const resolveRosterItem = useCallback((rosterId: string, encounterId: string) => {
        if (readOnly) {
            const rosterEntry = rosterMap[encounterId];
            return isReadOnlyRosterEntry(rosterEntry) ? rosterEntry : null;
        }

        return roster.find(entry => entry.id === rosterId) ?? null;
    }, [readOnly, rosterMap, roster]);

    // Advanced Filter States
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [tagFilter, setTagFilter] = useState<string[]>([]);
    const [tagLogic, setTagLogic] = useState<'AND' | 'OR'>('AND');
    const [abilityCategoryFilter, setAbilityCategoryFilter] = useState<string[]>([]);
    const [abilityCategoryLogic, setAbilityCategoryLogic] = useState<'AND' | 'OR'>('OR');
    const [abilityFilter, setAbilityFilter] = useState<string[]>([]);
    const [abilityLogic, setAbilityLogic] = useState<'AND' | 'OR'>('AND');
    const [immunityFilter, setImmunityFilter] = useState<string[]>([]);
    const [immunityLogic, setImmunityLogic] = useState<'AND' | 'OR'>('AND');

    const filteredGlobalRoster = useMemo(() => {
        return roster.filter(r => {
            // Search query
            if (searchQuery && !r.champion.name.toLowerCase().includes(searchQuery.toLowerCase()) && !r.champion.shortName?.toLowerCase().includes(searchQuery.toLowerCase())) return false;

            // Class filter
            if (selectedClass && r.champion.class !== selectedClass) return false;

            // Pre-compute sets for performance with existence checks
            const champAbilities = r.champion.abilities || [];
            const abilityEntries = champAbilities.filter(a => a.type === 'ABILITY');
            const immunityEntries = champAbilities.filter(a => a.type === 'IMMUNITY');
            const champTags = (r.champion.tags || []).map(t => t.name);

            // Advanced filters
            if (tagFilter.length > 0) {
                if (tagLogic === 'AND') { if (!tagFilter.every(t => champTags.includes(t))) return false; }
                else { if (!tagFilter.some(t => champTags.includes(t))) return false; }
            }

            if (abilityCategoryFilter.length > 0) {
                const championCategories = new Set(
                    champAbilities.flatMap(a => a.ability?.categories?.map(c => c.name) || [])
                );
                if (abilityCategoryLogic === 'AND') { if (!abilityCategoryFilter.every(c => championCategories.has(c))) return false; }
                else { if (!abilityCategoryFilter.some(c => championCategories.has(c))) return false; }
            }

            if (abilityFilter.length > 0) {
                const champAbilityNames = new Set(abilityEntries.map(a => a.ability?.name).filter(Boolean));
                if (abilityLogic === 'AND') { if (!abilityFilter.every(req => champAbilityNames.has(req))) return false; }
                else { if (!abilityFilter.some(req => champAbilityNames.has(req))) return false; }
            }

            if (immunityFilter.length > 0) {
                const champImmunityNames = new Set(immunityEntries.map(a => a.ability?.name).filter(Boolean));
                if (immunityLogic === 'AND') { if (!immunityFilter.every(req => champImmunityNames.has(req))) return false; }
                else { if (!immunityFilter.some(req => champImmunityNames.has(req))) return false; }
            }

            return true;
        });
    }, [roster, searchQuery, selectedClass, tagFilter, tagLogic, abilityCategoryFilter, abilityCategoryLogic, abilityFilter, abilityLogic, immunityFilter, immunityLogic]);

    const activeFiltersCount = useMemo(() => {
        return tagFilter.length + abilityCategoryFilter.length + abilityFilter.length + immunityFilter.length;
    }, [tagFilter, abilityCategoryFilter, abilityFilter, immunityFilter]);

    const clearAllFilters = () => {
        setSearchQuery("");
        setSelectedClass(null);
        setTagFilter([]);
        setAbilityCategoryFilter([]);
        setAbilityFilter([]);
        setImmunityFilter([]);
    };

    const { handleSelectCounter, handleSelectPrefight } = useQuestSelectionMutations({
        quest,
        roster,
        readOnly,
        selections,
        prefightSelections,
        activeQuestAssignments,
        activeSynergyChampions,
        setSelections,
        setPrefightSelections,
        closeEncounterAfterSelection,
        toast,
    });

    const { handleSelectSynergy } = useQuestSynergyMutations({
        quest,
        synergyIds,
        activeQuestAssignments,
        activeSynergyChampions,
        setSynergyIds,
        toast,
    });

    const { renderChampionItem, renderListPick } = createQuestTimelinePickRenderers({
        quest,
        activeQuest,
        roster,
        readOnly,
        selections,
        activeSelections,
        activeEncounterIds,
        activePlayerPicksMap,
        handleSelectCounter,
        scrollToEncounter,
    });
    return (
        <div className="relative pt-4 pb-20">
            {/* Invisible marker for scroll detection */}
            <div ref={headerRef} className="h-0 w-full" aria-hidden="true" />

            <SelectedTeamPanel
                quest={quest}
                roster={roster}
                selectedTeam={selectedTeam}
                selectedTeamMembers={selectedTeamMembers}
                activeSelections={activeSelections}
                synergyIds={synergyIds}
                readOnly={readOnly}
                isScrolled={isScrolled}
                isTeamExpanded={isTeamExpanded}
                isSharing={isSharing}
                shareSuccess={shareSuccess}
                activeRevivesTotal={activeRevivesTotal}
                allRevivesTotal={allRevivesTotal}
                onToggleExpanded={() => setIsTeamExpanded(prev => !prev)}
                onShare={sharePlan}
                onRemoveTeamMember={initiateRemoveTeamMember}
                onSelectSynergy={handleSelectSynergy}
                scrollToEncounter={scrollToEncounter}
            />
            <div className="relative pl-3 md:pl-10 pb-20">
                {/* Continuous Vertical Timeline Line */}
                <style>{`
                    @keyframes tlFlow1 {
                        0%   { transform: translateY(-100%); opacity: 0; }
                        8%   { opacity: 1; }
                        88%  { opacity: 0.7; }
                        100% { transform: translateY(300%); opacity: 0; }
                    }
                    @keyframes tlFlow2 {
                        0%   { transform: translateY(-100%); opacity: 0; }
                        8%   { opacity: 0.5; }
                        88%  { opacity: 0.3; }
                        100% { transform: translateY(400%); opacity: 0; }
                    }
                    @keyframes tlPulse {
                        0%, 100% { opacity: 0.15; }
                        50%      { opacity: 0.35; }
                    }
                    @keyframes tlRing1 {
                        0%   { transform: translate(-50%, -50%) scale(0.4); opacity: 0.8; }
                        100% { transform: translate(-50%, -50%) scale(2.2); opacity: 0; }
                    }
                    @keyframes tlRing2 {
                        0%   { transform: translate(-50%, -50%) scale(0.4); opacity: 0.5; }
                        100% { transform: translate(-50%, -50%) scale(2.8); opacity: 0; }
                    }
                    @keyframes tlRing3 {
                        0%   { transform: translate(-50%, -50%) scale(0.4); opacity: 0.3; }
                        100% { transform: translate(-50%, -50%) scale(3.4); opacity: 0; }
                    }
                    @keyframes tlCorePulse {
                        0%, 100% { box-shadow: 0 0 4px 1px rgba(56,189,248,0.6), 0 0 10px 2px rgba(56,189,248,0.2); }
                        50%      { box-shadow: 0 0 8px 2px rgba(56,189,248,0.9), 0 0 20px 4px rgba(56,189,248,0.35); }
                    }
                    @keyframes tlTick {
                        0%, 100% { opacity: 0.25; }
                        50%      { opacity: 0.7; }
                    }
                    @keyframes routePulse {
                        0%   { stroke-dashoffset: 92; opacity: 0; }
                        10%  { opacity: 0.75; }
                        70%  { opacity: 0.75; }
                        100% { stroke-dashoffset: 0; opacity: 0; }
                    }
                    @keyframes routeHalo {
                        0%   { stroke-dashoffset: 92; opacity: 0; }
                        12%  { opacity: 0.32; }
                        68%  { opacity: 0.32; }
                        100% { stroke-dashoffset: 0; opacity: 0; }
                    }
                `}</style>

                <div className="absolute top-0 bottom-[120px] left-3 md:left-10 -translate-x-1/2 z-0" style={{ width: '3px' }}>
                    {/* Base track */}
                    <div className="absolute inset-0 rounded-full bg-slate-800/70" />
                    {/* Fade-in mask at the top so the line visually starts at the origin node */}
                    <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-slate-950 to-transparent z-10 pointer-events-none" />
                    {/* Breathing ambient glow */}
                    <div
                        className="absolute -inset-x-1 inset-y-0 rounded-full bg-sky-500/10 blur-[3px]"
                        style={{ animation: 'tlPulse 3s ease-in-out infinite' }}
                    />
                    {/* Primary energy bolt */}
                    <div className="absolute inset-0 overflow-hidden rounded-full">
                        <div
                            className="absolute inset-x-0 top-0 rounded-full bg-gradient-to-b from-transparent via-sky-400 to-transparent"
                            style={{ height: '32%', animation: 'tlFlow1 2.6s ease-in-out infinite' }}
                        />
                        <div
                            className="absolute inset-x-0 top-0 rounded-full bg-gradient-to-b from-transparent via-indigo-400/70 to-transparent"
                            style={{ height: '22%', animation: 'tlFlow2 2.6s ease-in-out infinite 1.3s' }}
                        />
                    </div>
                    {/* Wide soft glow that travels with the primary bolt */}
                    <div className="absolute overflow-hidden rounded-full" style={{ inset: '0 -4px' }}>
                        <div
                            className="absolute inset-x-0 top-0 rounded-full bg-gradient-to-b from-transparent via-sky-500/20 to-transparent blur-[4px]"
                            style={{ height: '32%', animation: 'tlFlow1 2.6s ease-in-out infinite' }}
                        />
                    </div>
                </div>

                {quest.encounters.length === 0 ? (
                    <p className="text-center text-slate-400 italic mt-8">No encounters have been added to this quest yet.</p>
                ) : (
                    <div className="space-y-6">
                        <TimelineColumnHeader />

                        <RoutePlannerPanel
                            visibleRouteSections={visibleRouteSections}
                            routeFilteredEncounterCount={routeFilteredEncounters.length}
                            routeChoices={routeChoices}
                            selectedRouteSummary={selectedRouteSummary}
                            encountersByRoutePathId={encountersByRoutePathId}
                            routeMapRef={routeMapRef}
                            routeStartRef={routeStartRef}
                            routeEndRef={routeEndRef}
                            routeConnectorPaths={routeConnectorPaths}
                            routeMapSize={routeMapSize}
                            readOnly={readOnly}
                            setRouteCardRef={setRouteCardRef}
                            onRouteChoice={handleRouteChoice}
                            scrollToEncounter={scrollToEncounter}
                        />
                        <QuestTimelineActionBar
                            difficultyFilter={difficultyFilter}
                            filteredEncounterCount={filteredEncounters.length}
                            totalEncounterCount={quest.encounters.length}
                            readOnly={readOnly}
                            onToggleDifficulty={toggleDifficultyFilter}
                            onClearDifficultyFilter={() => setDifficultyFilter([])}
                            onOpenClearPlan={() => setIsClearPlanOpen(true)}
                        />
                        <QuestEncounterList
                            encounters={filteredEncounters}
                            allEncounters={quest.encounters}
                            difficultyFilter={difficultyFilter}
                            revivesByEncounterId={revivesByEncounterId}
                            quest={quest}
                            expandedId={expandedId}
                            toggleExpand={toggleExpand}
                            selections={activeSelections}
                            prefightSelections={activePrefightSelections}
                            onSetRevives={handleSetRevives}
                            readOnly={readOnly}
                            showVideoId={showVideoId}
                            setShowVideoId={setShowVideoId}
                            tabState={{
                                encounterTabs,
                                setEncounterTabs,
                                featuredPicks,
                                alliancePicks,
                                popularCounters
                            }}
                            filterState={{
                                searchQuery,
                                setSearchQuery,
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
                                clearAllFilters,
                                CLASSES,
                                selectedClass,
                                setSelectedClass
                            }}
                            rosterState={{
                                roster,
                                filteredGlobalRoster,
                                selectedTeam,
                                synergyIds,
                                isRosterExpanded,
                                setIsRosterExpanded,
                                resolveRosterItem,
                                handleSelectCounter,
                                handleSelectPrefight
                            }}
                            isNodesCollapsed={isNodesCollapsed}
                            setIsNodesCollapsed={setIsNodesCollapsed}
                            renderChampionItem={renderChampionItem}
                            renderListPick={renderListPick}
                        />
                    </div>
                )}
            </div>

            <AlertDialog open={isClearPlanOpen} onOpenChange={setIsClearPlanOpen}>
                <AlertDialogContent className="bg-slate-950 border-slate-800">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-white">Clear entire plan?</AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-400">
                            This will remove all counter and prefight selections for every fight in this quest. Revive counts will be kept.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={executeClearPlan}
                            className="bg-red-600 text-white hover:bg-red-500"
                        >
                            Clear Plan
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!championToRemove} onOpenChange={(open) => !open && setChampionToRemove(null)}>
                <AlertDialogContent className="bg-slate-950 border-slate-800">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-white">Remove {championToRemove?.championName}?</AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-400">
                            This champion is currently assigned to <strong className="text-white">{championToRemove?.assignedEncounters.length}</strong> fights. 
                            Removing them will clear all of these assignments. Are you sure?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white">Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={executeRemoveTeamMember}
                            className="bg-red-600 text-white hover:bg-red-500"
                        >
                            Remove Assignments
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
