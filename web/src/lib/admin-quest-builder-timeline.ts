import {
  createInitialQuestRouteChoices,
  getRouteFilteredQuestEncounters,
  getVisibleQuestRouteSections,
  type QuestPlanningRouteChoices,
  type QuestPlanningRouteEncounter,
  type QuestPlanningRouteSection,
  type QuestPlanningSavedRouteChoice,
} from "./quest-planning-route-progress";
import {
  filterQuestEncountersToObjectiveEndpoint,
  getQuestObjectiveRouteChoices,
  getLockedQuestObjectiveRouteChoices,
  mergeQuestObjectiveRouteChoices,
  type QuestObjectiveRestriction,
} from "./quest-objectives";

export function projectAdminQuestBuilderTimeline<
  TEncounter extends QuestPlanningRouteEncounter,
  TSection extends QuestPlanningRouteSection
>({
  encounters,
  routeSections,
  routeChoices,
  activeObjective,
  showObjectiveContinuation,
  showAllFights,
}: {
  encounters: TEncounter[];
  routeSections?: TSection[] | null;
  routeChoices?: QuestPlanningRouteChoices;
  activeObjective?: QuestObjectiveRestriction | null;
  showObjectiveContinuation?: boolean;
  showAllFights?: boolean;
}) {
  const sections = routeSections ?? [];
  const objectiveDefaults = mergeQuestObjectiveRouteChoices(
    {
      ...createInitialQuestRouteChoices({
        routeSections: sections,
        savedRouteChoices: [],
      }),
      ...getQuestObjectiveRouteChoices(activeObjective),
    },
    activeObjective
  );
  const effectiveRouteChoices = showAllFights
    ? {}
    : mergeQuestObjectiveRouteChoices(routeChoices ?? objectiveDefaults, activeObjective);

  const visibleRouteSections = showAllFights
    ? sections
    : getVisibleQuestRouteSections({
        routeSections: sections,
        routeChoices: effectiveRouteChoices,
      });

  const routeFilteredEncounters = showAllFights
    ? encounters
    : getRouteFilteredQuestEncounters({
        encounters,
        routeSections: sections,
        visibleRouteSections,
        routeChoices: effectiveRouteChoices,
      });

  const filteredEncounters = showAllFights
    ? routeFilteredEncounters
    : filterQuestEncountersToObjectiveEndpoint({
        encounters: routeFilteredEncounters,
        endpointEncounterId: activeObjective?.endpointEncounterId,
        showContinuation: showObjectiveContinuation,
      });

  return {
    routeChoices: effectiveRouteChoices,
    visibleRouteSections,
    filteredEncounters,
    lockedRouteChoices: getLockedQuestObjectiveRouteChoices(activeObjective),
    isFiltered: !showAllFights && (sections.length > 0 || Boolean(activeObjective?.endpointEncounterId)),
  };
}

export function createAdminQuestRouteChoices<TSection extends QuestPlanningRouteSection>({
  routeSections,
  savedRouteChoices = [],
  activeObjective,
}: {
  routeSections?: TSection[] | null;
  savedRouteChoices?: QuestPlanningSavedRouteChoice[];
  activeObjective?: QuestObjectiveRestriction | null;
}) {
  return mergeQuestObjectiveRouteChoices(
    {
      ...createInitialQuestRouteChoices({ routeSections, savedRouteChoices }),
      ...getQuestObjectiveRouteChoices(activeObjective),
    },
    activeObjective
  );
}
