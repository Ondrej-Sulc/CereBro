import {
  createInitialQuestRouteChoices,
  getRouteFilteredQuestEncounters,
  getVisibleQuestRouteSections,
  type QuestPlanningEncounter,
  type QuestPlanningRouteChoices,
  type QuestPlanningRouteSection,
  type QuestPlanningSavedRouteChoice,
} from "./quest-planning-projection";
import {
  questEncounterSelectionConflictReason,
  validateOwnedChampionForQuestSelection,
  wouldExceedQuestTeamLimit,
  type QuestSelectionAssignment,
  type QuestSelectionChampion,
  type QuestSelectionEncounter,
  type QuestSelectionField,
  type QuestSelectionQuest,
  type QuestSelectionSynergy,
} from "./player-quest-selection";

export type QuestPlanningTransitionKind =
  | "counter"
  | "prefight"
  | "synergy"
  | "routeChoice"
  | "revives";

type QuestPlanningTransitionQuest<
  TEncounter extends QuestPlanningEncounter,
  TSection extends QuestPlanningRouteSection
> = QuestSelectionQuest & {
  encounters: TEncounter[];
  routeSections?: TSection[] | null;
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
  champion?: QuestSelectionChampion;
  rosterEntries?: OwnedRosterEntry[];
};

export type QuestPlanningSelectionTransitionInput<
  TEncounter extends QuestPlanningEncounter,
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
  TEncounter extends QuestPlanningEncounter,
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
  TEncounter extends QuestPlanningEncounter,
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
  TEncounter extends QuestPlanningEncounter,
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
  TEncounter extends QuestPlanningEncounter,
  TSection extends QuestPlanningRouteSection
>(
  input: QuestPlanningSelectionTransitionInput<TEncounter, TSection>
): QuestPlanningTransitionDecision {
  if ((input.field === "selectedChampionId" || input.field === "prefightChampionId") && !input.questEncounterId) {
    return { valid: false, reason: "Quest encounter is required for this transition." };
  }

  if (input.candidate.championId !== null) {
    if (!input.candidate.champion) return { valid: false, reason: "Champion not found." };
    const validation = validateOwnedChampionForQuestSelection({
      rosterEntries: input.candidate.rosterEntries ?? [],
      champion: input.candidate.champion,
      quest: input.quest,
      encounter: input.encounter,
    });
    if (!validation.valid) return validation;
  }

  const active = activePlanState(input.quest, input.plan, input.routeChoicesOverride);
  const existingAssignment = input.questEncounterId
    ? input.plan.encounters.find(encounter => encounter.questEncounterId === input.questEncounterId)
    : undefined;

  if (input.field === "selectedChampionId") {
    const conflictReason = questEncounterSelectionConflictReason({
      field: "selectedChampionId",
      candidateChampionId: input.candidate.championId,
      prefightChampionId: existingAssignment?.prefightChampionId,
    });
    if (conflictReason) return { valid: false, reason: conflictReason };
  }

  if (input.field === "prefightChampionId") {
    const conflictReason = questEncounterSelectionConflictReason({
      field: "prefightChampionId",
      candidateChampionId: input.candidate.championId,
      selectedChampionId: existingAssignment?.selectedChampionId,
    });
    if (conflictReason) return { valid: false, reason: conflictReason };
  }

  if (
    input.quest.teamLimit !== null &&
    input.quest.teamLimit !== undefined &&
    input.candidate.championId !== null &&
    wouldExceedQuestTeamLimit({
      teamLimit: input.quest.teamLimit,
      encounters: active.activeAssignments,
      synergyChampions: active.activeSynergyChampions,
      replacement: {
        field: input.field,
        questEncounterId: input.questEncounterId,
        championId: input.candidate.championId,
      },
    })
  ) {
    return { valid: false, reason: `Team limit of ${input.quest.teamLimit} reached.` };
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
  TEncounter extends QuestPlanningEncounter,
  TSection extends QuestPlanningRouteSection
>(
  input: QuestPlanningRouteChoiceTransitionInput<TEncounter, TSection>
): QuestPlanningTransitionDecision {
  const routeSections = input.quest.routeSections ?? [];
  const section = routeSections.find(candidate => candidate.id === input.sectionId);
  if (!section || !section.paths.some(path => path.id === input.pathId)) {
    return { valid: false, reason: "Invalid route choice for this quest plan." };
  }

  const routeChoices = sanitizeQuestRouteChoices(routeSections, {
    ...createInitialQuestRouteChoices({
      routeSections,
      savedRouteChoices: input.plan.routeChoices ?? [],
    }),
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
  TEncounter extends QuestPlanningEncounter,
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
  const routeChoices = routeChoicesOverride
    ? sanitizeQuestRouteChoices(routeSections, {
        ...savedRouteChoices,
        ...routeChoicesOverride,
      })
    : savedRouteChoices;
  const visibleRouteSections = getVisibleQuestRouteSections({
    routeSections,
    routeChoices,
  });
  const activeEncounterIds = new Set(getRouteFilteredQuestEncounters({
    encounters: quest.encounters,
    routeSections,
    visibleRouteSections,
    routeChoices,
  }).map(encounter => encounter.id));

  return {
    activeEncounterIds,
    activeAssignments: plan.encounters.filter(encounter => activeEncounterIds.has(encounter.questEncounterId)),
    activeSynergyChampions: plan.synergyChampions ?? [],
  };
}

function sanitizeQuestRouteChoices(
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
