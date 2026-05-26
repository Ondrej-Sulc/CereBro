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

export function isNecropolisQuestTitle(title: string): boolean {
  const normalized = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

  return normalized === "necropolis" || normalized === "the necropolis";
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

export type ObjectiveRecommendationSet<TChampion> = {
  questObjectiveId: string;
  champions: Array<{
    champion: TChampion;
    order?: number | null;
  }>;
};

export type EncounterWithObjectiveRecommendations<TChampion> = {
  recommendedChampions: TChampion[];
  objectiveRecommendationSets?: ObjectiveRecommendationSet<TChampion>[];
};

export function getObjectiveRecommendationSet<TChampion>(
  encounter: EncounterWithObjectiveRecommendations<TChampion>,
  questObjectiveId?: string | null
) {
  if (!questObjectiveId) return null;
  return encounter.objectiveRecommendationSets?.find(set => set.questObjectiveId === questObjectiveId) ?? null;
}

export function getEffectiveEncounterRecommendedChampions<TChampion>(
  encounter: EncounterWithObjectiveRecommendations<TChampion>,
  questObjectiveId?: string | null
) {
  const objectiveSet = getObjectiveRecommendationSet(encounter, questObjectiveId);
  if (!objectiveSet) return encounter.recommendedChampions;

  return [...objectiveSet.champions]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(item => item.champion);
}

export function applyObjectiveRecommendedChampions<
  TEncounter extends EncounterWithObjectiveRecommendations<TChampion>,
  TChampion
>(encounter: TEncounter, questObjectiveId?: string | null): TEncounter {
  if (!questObjectiveId) return encounter;
  return {
    ...encounter,
    recommendedChampions: getEffectiveEncounterRecommendedChampions(encounter, questObjectiveId),
  };
}
