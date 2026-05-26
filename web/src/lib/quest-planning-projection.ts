import type { QuestSelectionAssignment, QuestSelectionSynergy } from "./player-quest-selection";
import {
  applyQuestObjectiveToQuest,
  filterQuestEncountersToObjectiveEndpoint,
  type QuestObjectiveRestriction,
} from "./quest-objectives";
import {
  createInitialQuestRouteChoices,
  getActiveQuestEncounterIds,
  getRouteFilteredQuestEncounters,
  getSelectedQuestRoutePathIds,
  getVisibleQuestRouteSections,
  projectQuestRouteProgress,
  type QuestPlanningRouteChoices,
  type QuestPlanningRoutePath,
  type QuestPlanningRouteSection,
  type QuestPlanningSavedRouteChoice,
} from "./quest-planning-route-progress";

export type QuestPlanningSelectionMap = Record<string, string | null>;
export type QuestPlanningReviveMap = Record<string, number>;

export {
  createInitialQuestRouteChoices,
  getActiveQuestEncounterIds,
  getRouteFilteredQuestEncounters,
  getSelectedQuestRoutePathIds,
  getVisibleQuestRouteSections,
  projectQuestRouteProgress,
};

export type {
  QuestPlanningRouteChoices,
  QuestPlanningRoutePath,
  QuestPlanningRouteSection,
  QuestPlanningSavedRouteChoice,
};

export type QuestPlanningEncounter = {
  id: string;
  routePathId?: string | null;
  sequence: number;
  difficulty?: string | null;
};

export type QuestPlanningQuest<
  TEncounter extends QuestPlanningEncounter,
  TSection extends QuestPlanningRouteSection
> = {
  encounters: TEncounter[];
  routeSections?: TSection[] | null;
  teamLimit?: number | null;
  objective?: QuestObjectiveRestriction | null;
};

export type QuestPlanningRosterEntry = {
  id: string;
  championId: number;
  stars: number;
  rank?: number | null;
  champion: {
    id: number;
  };
};

export type QuestPlanningSavedSynergy = {
  championId: number;
};

export type QuestPlanningRosterResolver<TRoster extends QuestPlanningRosterEntry> = (input: {
  rosterId: string;
  encounterId: string;
  field: "selectedChampionId" | "prefightChampionId";
}) => TRoster | undefined;

export type QuestPlanningProjection<
  TQuest extends QuestPlanningQuest<TEncounter, TSection>,
  TEncounter extends QuestPlanningEncounter,
  TSection extends QuestPlanningRouteSection,
  TRoster extends QuestPlanningRosterEntry
> = {
  visibleRouteSections: TSection[];
  routeFilteredEncounters: TEncounter[];
  activeEncounterIds: Set<string>;
  activeSelections: QuestPlanningSelectionMap;
  activePrefightSelections: QuestPlanningSelectionMap;
  activeQuestAssignments: QuestSelectionAssignment[];
  activeSynergyChampions: QuestSelectionSynergy[];
  activeRevivesTotal: number;
  allRevivesTotal: number;
  activeQuest: TQuest & { encounters: TEncounter[] };
  encountersByRoutePathId: Map<string, TEncounter[]>;
  selectedRouteSummary: { sectionTitle: string; pathTitle: string }[];
  selectedRoutePathIds: string[];
  filteredEncounters: TEncounter[];
  selectedTeam: TRoster[];
  selectedTeamMembers: QuestPlanningTeamMember<TRoster, TEncounter>[];
  objectiveEndpointEncounterId?: string | null;
};

export type QuestPlanningTeamMember<
  TRoster extends QuestPlanningRosterEntry,
  TEncounter extends QuestPlanningEncounter
> = {
  rosterEntry: TRoster;
  assignedEncounters: TEncounter[];
  prefightEncounters: TEncounter[];
  isSynergyOnly: boolean;
};

export function projectQuestPlanningState<
  TQuest extends QuestPlanningQuest<TEncounter, TSection>,
  TEncounter extends QuestPlanningEncounter,
  TSection extends QuestPlanningRouteSection,
  TRoster extends QuestPlanningRosterEntry,
  TSynergy extends QuestPlanningSavedSynergy
>({
  quest,
  routeChoices,
  selections,
  prefightSelections,
  synergyIds,
  revivesByEncounterId,
  roster,
  savedSynergies = [],
  difficultyFilter = [],
  resolveRosterEntry,
  createSynergyRosterEntry,
  showObjectiveContinuation = false,
}: {
  quest: TQuest;
  routeChoices: QuestPlanningRouteChoices;
  selections: QuestPlanningSelectionMap;
  prefightSelections: QuestPlanningSelectionMap;
  synergyIds: number[];
  revivesByEncounterId: QuestPlanningReviveMap;
  roster: TRoster[];
  savedSynergies?: TSynergy[];
  difficultyFilter?: string[];
  resolveRosterEntry?: QuestPlanningRosterResolver<TRoster>;
  createSynergyRosterEntry?: (synergy: TSynergy) => TRoster;
  showObjectiveContinuation?: boolean;
}): QuestPlanningProjection<TQuest, TEncounter, TSection, TRoster> {
  const routeSections = quest.routeSections ?? [];
  const effectiveQuest = applyQuestObjectiveToQuest(quest, quest.objective);
  const {
    visibleRouteSections,
    selectedRoutePathIds,
    routeFilteredEncounters,
    activeEncounterIds,
  } = projectQuestRouteProgress({
    encounters: quest.encounters,
    routeSections,
    routeChoices,
  });
  const objectiveRouteFilteredEncounters = filterQuestEncountersToObjectiveEndpoint({
    encounters: routeFilteredEncounters,
    endpointEncounterId: quest.objective?.endpointEncounterId,
    showContinuation: showObjectiveContinuation,
  });
  const objectiveActiveEncounterIds = getActiveQuestEncounterIds(objectiveRouteFilteredEncounters);
  const activeSelections = filterQuestSelectionMapByActiveEncounters(selections, activeEncounterIds);
  const objectiveActiveSelections = filterQuestSelectionMapByActiveEncounters(activeSelections, objectiveActiveEncounterIds);
  const activePrefightSelections = filterQuestSelectionMapByActiveEncounters(prefightSelections, activeEncounterIds);
  const objectiveActivePrefightSelections = filterQuestSelectionMapByActiveEncounters(activePrefightSelections, objectiveActiveEncounterIds);
  const selectedTeam = projectSelectedQuestTeam({
    activeSelections: objectiveActiveSelections,
    activePrefightSelections: objectiveActivePrefightSelections,
    synergyIds,
    roster,
    savedSynergies,
    teamLimit: effectiveQuest.teamLimit ?? null,
    resolveRosterEntry,
    createSynergyRosterEntry,
  });

  return {
    visibleRouteSections,
    routeFilteredEncounters: objectiveRouteFilteredEncounters,
    activeEncounterIds: objectiveActiveEncounterIds,
    activeSelections: objectiveActiveSelections,
    activePrefightSelections: objectiveActivePrefightSelections,
    activeQuestAssignments: projectQuestAssignments({
      selections: objectiveActiveSelections,
      prefightSelections: objectiveActivePrefightSelections,
      roster,
    }),
    activeSynergyChampions: synergyIds.map(championId => ({ championId })),
    activeRevivesTotal: sumQuestRevives(revivesByEncounterId, objectiveActiveEncounterIds),
    allRevivesTotal: sumQuestRevives(revivesByEncounterId),
    activeQuest: { ...effectiveQuest, encounters: objectiveRouteFilteredEncounters },
    encountersByRoutePathId: getQuestEncountersByRoutePathId(quest.encounters),
    selectedRouteSummary: getSelectedQuestRouteSummary({
      visibleRouteSections,
      routeChoices,
    }),
    selectedRoutePathIds,
    filteredEncounters: filterQuestEncountersByDifficulty(objectiveRouteFilteredEncounters, difficultyFilter),
    selectedTeam,
    selectedTeamMembers: projectSelectedQuestTeamMembers({
      activeSelections: objectiveActiveSelections,
      activePrefightSelections: objectiveActivePrefightSelections,
      roster,
      routeFilteredEncounters: objectiveRouteFilteredEncounters,
      selectedTeam,
      teamLimit: effectiveQuest.teamLimit ?? null,
      resolveRosterEntry,
    }),
    objectiveEndpointEncounterId: quest.objective?.endpointEncounterId,
  };
}

export function filterQuestSelectionMapByActiveEncounters(
  selections: QuestPlanningSelectionMap,
  activeEncounterIds: Set<string>
) {
  const active: QuestPlanningSelectionMap = {};

  Object.entries(selections).forEach(([encounterId, rosterId]) => {
    if (activeEncounterIds.has(encounterId)) {
      active[encounterId] = rosterId;
    }
  });

  return active;
}

export function projectQuestAssignments<TRoster extends QuestPlanningRosterEntry>({
  selections,
  prefightSelections,
  roster,
}: {
  selections: QuestPlanningSelectionMap;
  prefightSelections: QuestPlanningSelectionMap;
  roster: TRoster[];
}): QuestSelectionAssignment[] {
  const rosterById = indexQuestRosterById(roster);
  const encounterIds = new Set([
    ...Object.keys(selections),
    ...Object.keys(prefightSelections),
  ]);

  return Array.from(encounterIds).map(questEncounterId => {
    const selectedRosterId = selections[questEncounterId];
    const prefightRosterId = prefightSelections[questEncounterId];
    return {
      questEncounterId,
      selectedChampionId: selectedRosterId
        ? rosterById.get(selectedRosterId)?.championId ?? null
        : null,
      selectedChampionStars: selectedRosterId
        ? rosterById.get(selectedRosterId)?.stars ?? null
        : null,
      prefightChampionId: prefightRosterId
        ? rosterById.get(prefightRosterId)?.championId ?? null
        : null,
      prefightChampionStars: prefightRosterId
        ? rosterById.get(prefightRosterId)?.stars ?? null
        : null,
    };
  });
}

export function sumQuestRevives(
  revivesByEncounterId: QuestPlanningReviveMap,
  activeEncounterIds?: Set<string>
) {
  return Object.entries(revivesByEncounterId).reduce((total, [encounterId, revivesUsed]) => {
    if (activeEncounterIds && !activeEncounterIds.has(encounterId)) {
      return total;
    }
    return total + revivesUsed;
  }, 0);
}

export function getQuestEncountersByRoutePathId<TEncounter extends QuestPlanningEncounter>(
  encounters: TEncounter[]
) {
  const map = new Map<string, TEncounter[]>();

  for (const encounter of encounters) {
    if (!encounter.routePathId) continue;
    const pathEncounters = map.get(encounter.routePathId) || [];
    pathEncounters.push(encounter);
    map.set(encounter.routePathId, pathEncounters);
  }

  for (const pathEncounters of map.values()) {
    pathEncounters.sort((a, b) => a.sequence - b.sequence);
  }

  return map;
}

export function getSelectedQuestRouteSummary<TSection extends QuestPlanningRouteSection>({
  visibleRouteSections,
  routeChoices,
}: {
  visibleRouteSections: TSection[];
  routeChoices: QuestPlanningRouteChoices;
}) {
  return visibleRouteSections
    .map(section => {
      const selectedPathId = routeChoices[section.id] || section.paths[0]?.id;
      const selectedPath = section.paths.find(path => path.id === selectedPathId);
      return selectedPath ? { sectionTitle: section.title, pathTitle: selectedPath.title } : null;
    })
    .filter((item): item is { sectionTitle: string; pathTitle: string } => Boolean(item));
}

export function filterQuestEncountersByDifficulty<TEncounter extends QuestPlanningEncounter>(
  encounters: TEncounter[],
  difficultyFilter: string[]
) {
  if (difficultyFilter.length === 0) return encounters;
  return encounters.filter(encounter => difficultyFilter.includes(String(encounter.difficulty)));
}

export function projectSelectedQuestTeam<
  TRoster extends QuestPlanningRosterEntry,
  TSynergy extends QuestPlanningSavedSynergy
>({
  activeSelections,
  activePrefightSelections,
  synergyIds,
  roster,
  savedSynergies = [],
  teamLimit,
  resolveRosterEntry,
  createSynergyRosterEntry,
}: {
  activeSelections: QuestPlanningSelectionMap;
  activePrefightSelections: QuestPlanningSelectionMap;
  synergyIds: number[];
  roster: TRoster[];
  savedSynergies?: TSynergy[];
  teamLimit: number | null;
  resolveRosterEntry?: QuestPlanningRosterResolver<TRoster>;
  createSynergyRosterEntry?: (synergy: TSynergy) => TRoster;
}) {
  const teamMap = new Map<string, TRoster>();
  const rosterById = indexQuestRosterById(roster);
  const addRosterEntry = (entry: TRoster) => {
    teamMap.set(teamLimit !== null ? `champion-${entry.championId}` : entry.id, entry);
  };

  Object.entries(activeSelections).forEach(([encounterId, rosterId]) => {
    if (!rosterId) return;
    const entry = resolveRosterEntry?.({
      rosterId,
      encounterId,
      field: "selectedChampionId",
    }) ?? rosterById.get(rosterId);
    if (entry) addRosterEntry(entry);
  });

  Object.entries(activePrefightSelections).forEach(([encounterId, rosterId]) => {
    if (!rosterId) return;
    const entry = resolveRosterEntry?.({
      rosterId,
      encounterId,
      field: "prefightChampionId",
    }) ?? rosterById.get(rosterId);
    if (entry) addRosterEntry(entry);
  });

  synergyIds.forEach(championId => {
    const isAlreadyInTeam = Array.from(teamMap.values()).some(entry => entry.championId === championId);
    if (isAlreadyInTeam) return;

    const rosterEntry = findBestQuestRosterEntryForChampion(roster, championId);
    if (rosterEntry) {
      addRosterEntry(rosterEntry);
      return;
    }

    const savedSynergy = savedSynergies.find(synergy => synergy.championId === championId);
    if (savedSynergy && createSynergyRosterEntry) {
      addRosterEntry(createSynergyRosterEntry(savedSynergy));
    }
  });

  return Array.from(teamMap.values());
}

export function projectSelectedQuestTeamMembers<
  TRoster extends QuestPlanningRosterEntry,
  TEncounter extends QuestPlanningEncounter
>({
  activeSelections,
  activePrefightSelections,
  roster,
  routeFilteredEncounters,
  selectedTeam,
  teamLimit,
  resolveRosterEntry,
}: {
  activeSelections: QuestPlanningSelectionMap;
  activePrefightSelections: QuestPlanningSelectionMap;
  roster: TRoster[];
  routeFilteredEncounters: TEncounter[];
  selectedTeam: TRoster[];
  teamLimit: number | null;
  resolveRosterEntry?: QuestPlanningRosterResolver<TRoster>;
}): Array<QuestPlanningTeamMember<TRoster, TEncounter>> {
  const rosterById = indexQuestRosterById(roster);
  const matchesRosterSelection = (
    teamEntry: TRoster,
    rosterId: string | null | undefined,
    encounterId: string,
    field: "selectedChampionId" | "prefightChampionId"
  ) => {
    if (!rosterId) return false;
    if (teamEntry.id === rosterId) return true;
    if (teamLimit === null) return false;

    const selectedEntry = resolveRosterEntry?.({ rosterId, encounterId, field }) ?? rosterById.get(rosterId);
    return selectedEntry?.championId === teamEntry.championId;
  };

  return selectedTeam.map(rosterEntry => {
    const assignedEncounters = routeFilteredEncounters
      .filter(encounter => matchesRosterSelection(
        rosterEntry,
        activeSelections[encounter.id],
        encounter.id,
        "selectedChampionId"
      ))
      .sort((a, b) => a.sequence - b.sequence);
    const prefightEncounters = routeFilteredEncounters
      .filter(encounter => matchesRosterSelection(
        rosterEntry,
        activePrefightSelections[encounter.id],
        encounter.id,
        "prefightChampionId"
      ))
      .sort((a, b) => a.sequence - b.sequence);

    return {
      rosterEntry,
      assignedEncounters,
      prefightEncounters,
      isSynergyOnly: assignedEncounters.length === 0 && prefightEncounters.length === 0,
    };
  });
}

function indexQuestRosterById<TRoster extends QuestPlanningRosterEntry>(roster: TRoster[]) {
  return new Map(roster.map(entry => [entry.id, entry]));
}

function findBestQuestRosterEntryForChampion<TRoster extends QuestPlanningRosterEntry>(
  roster: TRoster[],
  championId: number
) {
  return roster
    .filter(entry => entry.championId === championId)
    .sort((a, b) => b.stars - a.stars || Number(b.rank ?? 0) - Number(a.rank ?? 0))[0];
}
