import {
  createInitialQuestRouteChoices,
  projectQuestRouteProgress,
  sanitizeQuestRouteChoices,
  type QuestPlanningRouteEncounter,
  type QuestPlanningRouteChoices,
  type QuestPlanningRouteSection,
  type QuestPlanningSavedRouteChoice,
} from "./quest-planning-route-progress";
import {
  questEncounterSelectionConflictReason,
  unlimitedSwapsSelectionConflictReason,
  validateOwnedChampionForQuestSelection,
  wouldExceedQuestTeamLimit,
  type QuestSelectionAssignment,
  type QuestSelectionChampion,
  type QuestSelectionEncounter,
  type QuestSelectionField,
  type QuestSelectionQuest,
  type QuestSelectionSynergy,
} from "./player-quest-selection";
import {
  applyQuestObjectiveToQuest,
  getFirstQuestObjectiveRouteRecommendationChoices,
  getLockedQuestObjectiveRouteChoices,
  mergeQuestObjectiveRouteChoices,
  type QuestObjectiveRestriction,
} from "./quest-objectives";

export type QuestPlanningTransitionKind =
  | "counter"
  | "prefight"
  | "synergy"
  | "routeChoice"
  | "revives";

type QuestPlanningTransitionQuest<
  TEncounter extends QuestPlanningRouteEncounter,
  TSection extends QuestPlanningRouteSection
> = QuestSelectionQuest & {
  encounters: TEncounter[];
  routeSections?: TSection[] | null;
  objective?: QuestObjectiveRestriction | null;
};

export type QuestPlanningTransitionPlanState = {
  encounters: QuestSelectionAssignment[];
  synergyChampions?: QuestSelectionSynergy[];
  routeChoices?: QuestPlanningSavedRouteChoice[];
};

type OwnedRosterEntry = {
  id?: string;
  championId: number;
  stars: number;
  rank?: number | null;
};

type QuestPlanningChampionCandidate = {
  championId: number | null;
  stars?: number | null;
  champion?: QuestSelectionChampion;
  rosterEntries?: OwnedRosterEntry[];
};

export type QuestPlanningSelectionTransitionInput<
  TEncounter extends QuestPlanningRouteEncounter,
  TSection extends QuestPlanningRouteSection
> = {
  kind: Extract<QuestPlanningTransitionKind, "counter" | "prefight" | "synergy">;
  quest: QuestPlanningTransitionQuest<TEncounter, TSection>;
  plan: QuestPlanningTransitionPlanState;
  field: Extract<QuestSelectionField, "selectedChampionId" | "prefightChampionId" | "synergyChampionId">;
  questEncounterId?: string;
  candidate: QuestPlanningChampionCandidate;
  encounter?: QuestSelectionEncounter;
  routeChoicesOverride?: QuestPlanningRouteChoices;
};

export type QuestPlanningRouteChoiceTransitionInput<
  TEncounter extends QuestPlanningRouteEncounter,
  TSection extends QuestPlanningRouteSection
> = {
  kind: "routeChoice";
  quest: QuestPlanningTransitionQuest<TEncounter, TSection>;
  plan: QuestPlanningTransitionPlanState;
  sectionId: string;
  pathId: string;
};

export type QuestPlanningRevivesTransitionInput = {
  kind: "revives";
  questEncounterId: string;
  revivesUsed: number;
};

export type QuestPlanningTransitionInput<
  TEncounter extends QuestPlanningRouteEncounter,
  TSection extends QuestPlanningRouteSection
> =
  | QuestPlanningSelectionTransitionInput<TEncounter, TSection>
  | QuestPlanningRouteChoiceTransitionInput<TEncounter, TSection>
  | QuestPlanningRevivesTransitionInput;

export type QuestPlanningTransitionIntent =
  | {
      kind: "counter" | "prefight";
      field: Extract<QuestSelectionField, "selectedChampionId" | "prefightChampionId">;
      questEncounterId: string;
      championId: number | null;
      championStars?: number | null;
      clearPrefight?: boolean;
    }
  | {
      kind: "synergy";
      field: "synergyChampionId";
      championId: number;
    }
  | {
      kind: "routeChoice";
      sectionId: string;
      pathId: string;
      routeChoices: QuestPlanningRouteChoices;
    }
  | {
      kind: "revives";
      questEncounterId: string;
      revivesUsed: number;
    };

export type QuestPlanningTransitionDecision =
  | {
      valid: true;
      intent: QuestPlanningTransitionIntent;
      activeEncounterIds?: Set<string>;
      activeAssignments?: QuestSelectionAssignment[];
      activeSynergyChampions?: QuestSelectionSynergy[];
    }
  | {
      valid: false;
      reason: string;
    };

export function decideQuestPlanningTransition<
  TEncounter extends QuestPlanningRouteEncounter,
  TSection extends QuestPlanningRouteSection
>(
  input: QuestPlanningTransitionInput<TEncounter, TSection>
): QuestPlanningTransitionDecision {
  if (input.kind === "routeChoice") {
    return decideRouteChoiceTransition(input);
  }

  if (input.kind === "revives") {
    return decideRevivesTransition(input);
  }

  return decideSelectionTransition(input);
}

function decideSelectionTransition<
  TEncounter extends QuestPlanningRouteEncounter,
  TSection extends QuestPlanningRouteSection
>(
  input: QuestPlanningSelectionTransitionInput<TEncounter, TSection>
): QuestPlanningTransitionDecision {
  if ((input.field === "selectedChampionId" || input.field === "prefightChampionId") && !input.questEncounterId) {
    return { valid: false, reason: "Quest encounter is required for this transition." };
  }
  const effectiveQuest = applyQuestObjectiveToQuest(input.quest, input.quest.objective);

  let validRosterEntry: OwnedRosterEntry | undefined;
  if (input.candidate.championId !== null) {
    if (!input.candidate.champion) return { valid: false, reason: "Champion not found." };
    const validation = validateOwnedChampionForQuestSelection({
      rosterEntries: input.candidate.rosterEntries ?? [],
      champion: input.candidate.champion,
      quest: effectiveQuest,
      encounter: input.encounter,
    });
    if (!validation.valid) return validation;
    validRosterEntry = validation.rosterEntry;
  }

  const active = activePlanState(input.quest, input.plan, input.routeChoicesOverride);
  const existingAssignment = input.questEncounterId
    ? input.plan.encounters.find(encounter => encounter.questEncounterId === input.questEncounterId)
    : undefined;
  const candidateStars = validRosterEntry?.stars ?? input.candidate.stars ?? null;

  if (effectiveQuest.teamLimit == null) {
    const conflictReason = unlimitedSwapsSelectionConflictReason({
      encounters: active.activeAssignments,
      replacement: {
        field: input.field,
        questEncounterId: input.questEncounterId,
        championId: input.candidate.championId,
        championStars: candidateStars,
      },
    });
    if (conflictReason) return { valid: false, reason: conflictReason };
  } else if (input.field === "selectedChampionId") {
    const conflictReason = questEncounterSelectionConflictReason({
      field: "selectedChampionId",
      candidateChampionId: input.candidate.championId,
      prefightChampionId: existingAssignment?.prefightChampionId,
    });
    if (conflictReason) return { valid: false, reason: conflictReason };
  }

  if (effectiveQuest.teamLimit != null && input.field === "prefightChampionId") {
    const conflictReason = questEncounterSelectionConflictReason({
      field: "prefightChampionId",
      candidateChampionId: input.candidate.championId,
      selectedChampionId: existingAssignment?.selectedChampionId,
    });
    if (conflictReason) return { valid: false, reason: conflictReason };
  }

  if (
    effectiveQuest.teamLimit !== null &&
    effectiveQuest.teamLimit !== undefined &&
    input.candidate.championId !== null &&
    wouldExceedQuestTeamLimit({
      teamLimit: effectiveQuest.teamLimit,
      encounters: active.activeAssignments,
      synergyChampions: active.activeSynergyChampions,
      replacement: {
        field: input.field,
        questEncounterId: input.questEncounterId,
        championId: input.candidate.championId,
        championStars: candidateStars,
      },
    })
  ) {
    return { valid: false, reason: `Team limit of ${effectiveQuest.teamLimit} reached.` };
  }

  const intent =
    input.field === "synergyChampionId"
      ? {
          kind: "synergy" as const,
          field: input.field,
          championId: input.candidate.championId,
        }
      : {
          kind: input.field === "selectedChampionId" ? "counter" as const : "prefight" as const,
          field: input.field,
          questEncounterId: input.questEncounterId!,
          championId: input.candidate.championId,
          championStars: candidateStars,
          clearPrefight: input.field === "selectedChampionId" &&
            effectiveQuest.teamLimit == null &&
            (existingAssignment?.prefightChampionId != null || existingAssignment?.prefightChampionStars != null) &&
            (
              existingAssignment.prefightChampionId !== input.candidate.championId ||
              existingAssignment.prefightChampionStars !== candidateStars
            ),
        };

  if (intent.kind === "synergy" && intent.championId === null) {
    return { valid: false, reason: "Champion is required for this transition." };
  }

  return {
    valid: true,
    intent: intent as QuestPlanningTransitionIntent,
    activeEncounterIds: active.activeEncounterIds,
    activeAssignments: active.activeAssignments,
    activeSynergyChampions: active.activeSynergyChampions,
  };
}

function decideRouteChoiceTransition<
  TEncounter extends QuestPlanningRouteEncounter,
  TSection extends QuestPlanningRouteSection
>(
  input: QuestPlanningRouteChoiceTransitionInput<TEncounter, TSection>
): QuestPlanningTransitionDecision {
  const routeSections = input.quest.routeSections ?? [];
  const section = routeSections.find(candidate => candidate.id === input.sectionId);
  if (!section || !section.paths.some(path => path.id === input.pathId)) {
    return { valid: false, reason: "Invalid route choice for this quest plan." };
  }
  const lockedChoice = getLockedQuestObjectiveRouteChoices(input.quest.objective).get(input.sectionId);
  if (lockedChoice && lockedChoice !== input.pathId) {
    return { valid: false, reason: "This route choice is locked by the selected objective." };
  }

  const routeChoices = sanitizeQuestRouteChoices(routeSections, {
    ...mergeQuestObjectiveRouteChoices(
      createInitialQuestRouteChoices({
        routeSections,
        savedRouteChoices: input.plan.routeChoices ?? [],
      }),
      input.quest.objective
    ),
    [input.sectionId]: input.pathId,
  });

  return {
    valid: true,
    intent: {
      kind: "routeChoice",
      sectionId: input.sectionId,
      pathId: input.pathId,
      routeChoices,
    },
  };
}

function decideRevivesTransition(input: QuestPlanningRevivesTransitionInput): QuestPlanningTransitionDecision {
  if (!Number.isInteger(input.revivesUsed) || input.revivesUsed < 0 || input.revivesUsed > 99) {
    return { valid: false, reason: "Revives used must be an integer between 0 and 99." };
  }

  return {
    valid: true,
    intent: {
      kind: "revives",
      questEncounterId: input.questEncounterId,
      revivesUsed: input.revivesUsed,
    },
  };
}

function activePlanState<
  TEncounter extends QuestPlanningRouteEncounter,
  TSection extends QuestPlanningRouteSection
>(
  quest: QuestPlanningTransitionQuest<TEncounter, TSection>,
  plan: QuestPlanningTransitionPlanState,
  routeChoicesOverride?: QuestPlanningRouteChoices
) {
  const routeSections = quest.routeSections ?? [];
  const savedRouteChoices = createInitialQuestRouteChoices({
    routeSections,
    savedRouteChoices: plan.routeChoices ?? [],
  });
  const routeRecommendationChoices = (plan.routeChoices ?? []).length === 0
    ? getFirstQuestObjectiveRouteRecommendationChoices(quest.objective)
    : {};
  const routeChoices = routeChoicesOverride
    ? sanitizeQuestRouteChoices(routeSections, mergeQuestObjectiveRouteChoices({
        ...savedRouteChoices,
        ...routeRecommendationChoices,
        ...routeChoicesOverride,
      }, quest.objective))
    : sanitizeQuestRouteChoices(routeSections, mergeQuestObjectiveRouteChoices({
        ...savedRouteChoices,
        ...routeRecommendationChoices,
      }, quest.objective));
  const { activeEncounterIds } = projectQuestRouteProgress({
    encounters: quest.encounters,
    routeSections,
    routeChoices,
  });

  return {
    activeEncounterIds,
    activeAssignments: plan.encounters.filter(encounter => activeEncounterIds.has(encounter.questEncounterId)),
    activeSynergyChampions: plan.synergyChampions ?? [],
  };
}
