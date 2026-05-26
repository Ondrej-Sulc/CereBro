import type { ChampionClass } from "@prisma/client";
import type { QuestSelectionRestrictions } from "./player-quest-selection";
import type { QuestPlanningRouteChoices } from "./quest-planning-route-progress";

export const BASE_QUEST_SCOPE_KEY = "base";

export type QuestObjectiveRestriction = QuestSelectionRestrictions & {
  id: string;
  slug: string;
  title: string;
  shortTitle?: string | null;
  description?: string | null;
  order: number;
  isVisible?: boolean;
  teamLimitOverride?: number | null;
  endpointEncounterId?: string | null;
  defaultShowContinuation?: boolean;
  routeChoices?: Array<{
    questRouteSectionId: string;
    questRoutePathId: string;
    isLocked?: boolean;
  }>;
};

export type ObjectiveScopedQuest<TQuest extends { teamLimit?: number | null }> = TQuest & {
  teamLimit?: number | null;
  objective?: QuestSelectionRestrictions | null;
};

export function questObjectiveScopeKey(objectiveId?: string | null) {
  return objectiveId ? `objective:${objectiveId}` : BASE_QUEST_SCOPE_KEY;
}

export function getQuestObjectiveRouteChoices(objective?: QuestObjectiveRestriction | null): QuestPlanningRouteChoices {
  const choices: QuestPlanningRouteChoices = {};
  for (const choice of objective?.routeChoices ?? []) {
    choices[choice.questRouteSectionId] = choice.questRoutePathId;
  }
  return choices;
}

export function getLockedQuestObjectiveRouteChoices(objective?: QuestObjectiveRestriction | null) {
  const locked = new Map<string, string>();
  for (const choice of objective?.routeChoices ?? []) {
    if (choice.isLocked) {
      locked.set(choice.questRouteSectionId, choice.questRoutePathId);
    }
  }
  return locked;
}

export function mergeQuestObjectiveRouteChoices(
  choices: QuestPlanningRouteChoices,
  objective?: QuestObjectiveRestriction | null
) {
  const objectiveChoices = getQuestObjectiveRouteChoices(objective);
  const merged = {
    ...objectiveChoices,
    ...choices,
  };

  for (const [sectionId, pathId] of getLockedQuestObjectiveRouteChoices(objective)) {
    merged[sectionId] = pathId;
  }

  return merged;
}

export function applyQuestObjectiveToQuest<TQuest extends { teamLimit?: number | null }>(
  quest: TQuest,
  objective?: QuestObjectiveRestriction | null
): ObjectiveScopedQuest<TQuest> {
  if (!objective) {
    return { ...quest, objective: null };
  }

  return {
    ...quest,
    teamLimit: objective.teamLimitOverride ?? quest.teamLimit,
    objective: {
      minStarLevel: objective.minStarLevel,
      maxStarLevel: objective.maxStarLevel,
      requiredClasses: objective.requiredClasses as ChampionClass[],
      requiredTags: objective.requiredTags,
      requiredTagMode: objective.requiredTagMode,
    },
  };
}

export function filterQuestEncountersToObjectiveEndpoint<
  TEncounter extends { id: string; sequence: number }
>({
  encounters,
  endpointEncounterId,
  showContinuation,
}: {
  encounters: TEncounter[];
  endpointEncounterId?: string | null;
  showContinuation?: boolean;
}) {
  if (!endpointEncounterId || showContinuation) return encounters;

  const endpoint = encounters.find(encounter => encounter.id === endpointEncounterId);
  if (!endpoint) return encounters;
  return encounters.filter(encounter => encounter.sequence <= endpoint.sequence);
}
