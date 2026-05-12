import type { QuestSelectionAssignment, QuestSelectionSynergy } from "./player-quest-selection";

export type QuestPlanningRouteChoices = Record<string, string>;
export type QuestPlanningSelectionMap = Record<string, string | null>;
export type QuestPlanningReviveMap = Record<string, number>;

export type QuestPlanningRoutePath = {
  id: string;
  title: string;
};

export type QuestPlanningRouteSection<TPath extends QuestPlanningRoutePath = QuestPlanningRoutePath> = {
  id: string;
  title: string;
  parentPathId?: string | null;
  paths: TPath[];
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

export type QuestPlanningSavedRouteChoice = {
  questRouteSectionId: string;
  questRoutePathId: string;
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
};

export function createInitialQuestRouteChoices<TSection extends QuestPlanningRouteSection>({
  routeSections = [],
  savedRouteChoices = [],
}: {
  routeSections?: TSection[] | null;
  savedRouteChoices?: QuestPlanningSavedRouteChoice[];
}): QuestPlanningRouteChoices {
  const initial: QuestPlanningRouteChoices = {};

  savedRouteChoices.forEach(choice => {
    initial[choice.questRouteSectionId] = choice.questRoutePathId;
  });

  routeSections?.forEach(section => {
    if (!initial[section.id] && section.paths[0]) {
      initial[section.id] = section.paths[0].id;
    }
  });

  return initial;
}

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
}): QuestPlanningProjection<TQuest, TEncounter, TSection, TRoster> {
  const routeSections = quest.routeSections ?? [];
  const visibleRouteSections = getVisibleQuestRouteSections({
    routeSections,
    routeChoices,
  });
  const selectedRoutePathIds = getSelectedQuestRoutePathIds({
    visibleRouteSections,
    routeChoices,
  });
  const routeFilteredEncounters = getRouteFilteredQuestEncounters({
    encounters: quest.encounters,
    routeSections,
    visibleRouteSections,
    routeChoices,
  });
  const activeEncounterIds = getActiveQuestEncounterIds(routeFilteredEncounters);
  const activeSelections = filterQuestSelectionMapByActiveEncounters(selections, activeEncounterIds);
  const activePrefightSelections = filterQuestSelectionMapByActiveEncounters(prefightSelections, activeEncounterIds);

  return {
    visibleRouteSections,
    routeFilteredEncounters,
    activeEncounterIds,
    activeSelections,
    activePrefightSelections,
    activeQuestAssignments: projectQuestAssignments({
      selections: activeSelections,
      prefightSelections: activePrefightSelections,
      roster,
    }),
    activeSynergyChampions: synergyIds.map(championId => ({ championId })),
    activeRevivesTotal: sumQuestRevives(revivesByEncounterId, activeEncounterIds),
    allRevivesTotal: sumQuestRevives(revivesByEncounterId),
    activeQuest: { ...quest, encounters: routeFilteredEncounters },
    encountersByRoutePathId: getQuestEncountersByRoutePathId(quest.encounters),
    selectedRouteSummary: getSelectedQuestRouteSummary({
      visibleRouteSections,
      routeChoices,
    }),
    selectedRoutePathIds,
    filteredEncounters: filterQuestEncountersByDifficulty(routeFilteredEncounters, difficultyFilter),
    selectedTeam: projectSelectedQuestTeam({
      activeSelections,
      activePrefightSelections,
      synergyIds,
      roster,
      savedSynergies,
      teamLimit: quest.teamLimit ?? null,
      resolveRosterEntry,
      createSynergyRosterEntry,
    }),
  };
}

export function getVisibleQuestRouteSections<TSection extends QuestPlanningRouteSection>({
  routeSections,
  routeChoices,
}: {
  routeSections: TSection[];
  routeChoices: QuestPlanningRouteChoices;
}) {
  if (routeSections.length === 0) return [];

  const visible = new Set<string>();
  let changed = true;

  while (changed) {
    changed = false;
    for (const section of routeSections) {
      if (visible.has(section.id)) continue;
      if (!section.parentPathId) {
        visible.add(section.id);
        changed = true;
        continue;
      }

      const parentSection = routeSections.find(candidate =>
        candidate.paths.some(path => path.id === section.parentPathId)
      );
      if (!parentSection || !visible.has(parentSection.id)) continue;

      const selectedParentPathId = routeChoices[parentSection.id] || parentSection.paths[0]?.id;
      if (selectedParentPathId === section.parentPathId) {
        visible.add(section.id);
        changed = true;
      }
    }
  }

  return routeSections.filter(section => visible.has(section.id));
}

export function getSelectedQuestRoutePathIds<TSection extends QuestPlanningRouteSection>({
  visibleRouteSections,
  routeChoices,
}: {
  visibleRouteSections: TSection[];
  routeChoices: QuestPlanningRouteChoices;
}) {
  return visibleRouteSections
    .map(section => routeChoices[section.id] || section.paths[0]?.id)
    .filter((id): id is string => Boolean(id));
}

export function getRouteFilteredQuestEncounters<
  TEncounter extends QuestPlanningEncounter,
  TSection extends QuestPlanningRouteSection
>({
  encounters,
  routeSections,
  visibleRouteSections,
  routeChoices,
}: {
  encounters: TEncounter[];
  routeSections: TSection[];
  visibleRouteSections: TSection[];
  routeChoices: QuestPlanningRouteChoices;
}) {
  if (routeSections.length === 0) return encounters;

  const selectedPathIds = new Set(getSelectedQuestRoutePathIds({
    visibleRouteSections,
    routeChoices,
  }));

  return encounters.filter(encounter => !encounter.routePathId || selectedPathIds.has(encounter.routePathId));
}

export function getActiveQuestEncounterIds<TEncounter extends QuestPlanningEncounter>(encounters: TEncounter[]) {
  return new Set(encounters.map(encounter => encounter.id));
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
      prefightChampionId: prefightRosterId
        ? rosterById.get(prefightRosterId)?.championId ?? null
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
