export type QuestPlanningRouteChoices = Record<string, string>;

export type QuestPlanningRoutePath = {
  id: string;
  title?: string;
};

export type QuestPlanningRouteSection<TPath extends QuestPlanningRoutePath = QuestPlanningRoutePath> = {
  id: string;
  title?: string;
  parentPathId?: string | null;
  paths: TPath[];
};

export type QuestPlanningRouteEncounter = {
  id: string;
  routePathId?: string | null;
  sequence: number;
};

export type QuestPlanningSavedRouteChoice = {
  questRouteSectionId: string;
  questRoutePathId: string;
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

export function sanitizeQuestRouteChoices(
  routeSections: Array<{ id: string; paths: Array<{ id: string }> }>,
  choices: QuestPlanningRouteChoices
) {
  const sanitized: QuestPlanningRouteChoices = {};
  for (const section of routeSections) {
    const choice = choices[section.id];
    if (choice && section.paths.some(path => path.id === choice)) {
      sanitized[section.id] = choice;
    }
  }
  return sanitized;
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
  TEncounter extends QuestPlanningRouteEncounter,
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

export function getActiveQuestEncounterIds<TEncounter extends QuestPlanningRouteEncounter>(encounters: TEncounter[]) {
  return new Set(encounters.map(encounter => encounter.id));
}

export function projectQuestRouteProgress<
  TEncounter extends QuestPlanningRouteEncounter,
  TSection extends QuestPlanningRouteSection
>({
  encounters,
  routeSections,
  routeChoices,
}: {
  encounters: TEncounter[];
  routeSections: TSection[];
  routeChoices: QuestPlanningRouteChoices;
}) {
  const visibleRouteSections = getVisibleQuestRouteSections({ routeSections, routeChoices });
  const selectedRoutePathIds = getSelectedQuestRoutePathIds({ visibleRouteSections, routeChoices });
  const routeFilteredEncounters = getRouteFilteredQuestEncounters({
    encounters,
    routeSections,
    visibleRouteSections,
    routeChoices,
  });

  return {
    visibleRouteSections,
    selectedRoutePathIds,
    routeFilteredEncounters,
    activeEncounterIds: getActiveQuestEncounterIds(routeFilteredEncounters),
  };
}

export type QuestPlanningRouteOrderEncounter = {
  id: string;
  sequence: number;
};

export type QuestPlanningRouteOrderPath<TEncounter extends QuestPlanningRouteOrderEncounter = QuestPlanningRouteOrderEncounter> = {
  id: string;
  encounters: TEncounter[];
};

export type QuestPlanningRouteOrderSection<
  TPath extends QuestPlanningRouteOrderPath = QuestPlanningRouteOrderPath
> = {
  id: string;
  parentPathId?: string | null;
  paths: TPath[];
};

export function orderQuestEncounterIdsByRoute<
  TSection extends QuestPlanningRouteOrderSection,
  TEncounter extends QuestPlanningRouteOrderEncounter
>({
  routeSections,
  unassignedEncounters = [],
}: {
  routeSections: TSection[];
  unassignedEncounters?: TEncounter[];
}) {
  const childSectionsByParentPathId = new Map<string, TSection[]>();
  const rootSections: TSection[] = [];
  for (const section of routeSections) {
    if (section.parentPathId) {
      const current = childSectionsByParentPathId.get(section.parentPathId) || [];
      current.push(section);
      childSectionsByParentPathId.set(section.parentPathId, current);
    } else {
      rootSections.push(section);
    }
  }

  const orderedEncounterIds: string[] = [];
  const seenEncounterIds = new Set<string>();
  const seenSectionIds = new Set<string>();

  const appendEncounter = (id: string) => {
    if (seenEncounterIds.has(id)) return;
    seenEncounterIds.add(id);
    orderedEncounterIds.push(id);
  };

  const visitSection = (section: TSection) => {
    if (seenSectionIds.has(section.id)) return;
    seenSectionIds.add(section.id);

    for (const path of section.paths) {
      for (const encounter of path.encounters) {
        appendEncounter(encounter.id);
      }
      for (const childSection of childSectionsByParentPathId.get(path.id) || []) {
        visitSection(childSection);
      }
    }
  };

  for (const section of rootSections) {
    visitSection(section);
  }
  for (const section of routeSections) {
    visitSection(section);
  }
  for (const encounter of unassignedEncounters) {
    appendEncounter(encounter.id);
  }

  return orderedEncounterIds;
}
