import { prisma } from "./prisma";
import { questObjectiveScopeKey } from "./quest-objectives";
import { decideQuestPlanningTransition } from "./quest-planning-transition";

type QuestPlanningMutationDb = typeof prisma;

export type QuestPlanningMutationInput =
  | {
      kind: "routeChoice";
      questPlanId: string;
      sectionId: string;
      pathId: string;
      objectiveSlug?: string | null;
    }
  | {
      kind: "counter";
      questPlanId: string;
      questEncounterId: string;
      championId: number | null;
      championStars?: number | null;
      objectiveSlug?: string | null;
    }
  | {
      kind: "prefight";
      questPlanId: string;
      questEncounterId: string;
      championId: number | null;
      championStars?: number | null;
      objectiveSlug?: string | null;
    }
  | {
      kind: "revives";
      questPlanId: string;
      questEncounterId: string;
      revivesUsed: number;
      objectiveSlug?: string | null;
    }
  | {
      kind: "synergy";
      questPlanId: string;
      championId: number;
      isRemoving?: boolean;
      objectiveSlug?: string | null;
    }
  | {
      kind: "clearCounters";
      questPlanId: string;
      objectiveSlug?: string | null;
    };

export type QuestPlanningMutationResult = {
  success: true;
  questPlanId: string;
  invalidateCounterStats?: boolean;
};

export async function applyPlayerQuestPlanningMutation({
  db = prisma,
  playerId,
  mutation,
}: {
  db?: QuestPlanningMutationDb;
  playerId: string;
  mutation: QuestPlanningMutationInput;
}): Promise<QuestPlanningMutationResult> {
  if (mutation.kind === "clearCounters") {
    return clearQuestCounters({ db, playerId, questPlanId: mutation.questPlanId, objectiveSlug: mutation.objectiveSlug });
  }

  if (mutation.kind === "routeChoice") {
    return applyRouteChoiceMutation({ db, playerId, mutation });
  }

  if (mutation.kind === "revives") {
    return applyRevivesMutation({ db, playerId, mutation });
  }

  if (mutation.kind === "synergy") {
    return applySynergyMutation({ db, playerId, mutation });
  }

  return applyEncounterSelectionMutation({ db, playerId, mutation });
}

async function applyRouteChoiceMutation({
  db,
  playerId,
  mutation,
}: {
  db: QuestPlanningMutationDb;
  playerId: string;
  mutation: Extract<QuestPlanningMutationInput, { kind: "routeChoice" }>;
}): Promise<QuestPlanningMutationResult> {
  const quest = await loadQuestForPlanning(db, mutation.questPlanId, mutation.objectiveSlug);
  if (!quest) throw new Error("Quest plan not found.");

  const decision = decideQuestPlanningTransition({
    kind: "routeChoice",
    quest,
    plan: { encounters: [] },
    sectionId: mutation.sectionId,
    pathId: mutation.pathId,
  });
  if (!decision.valid) throw new Error(decision.reason);
  if (decision.intent.kind !== "routeChoice") throw new Error("Invalid route transition.");

  const playerPlan = await upsertPlayerQuestPlan(db, playerId, mutation.questPlanId, quest.objective?.id ?? null);

  await db.playerQuestRouteChoice.upsert({
    where: {
      playerQuestPlanId_questRouteSectionId: {
        playerQuestPlanId: playerPlan.id,
        questRouteSectionId: decision.intent.sectionId,
      },
    },
    create: {
      playerQuestPlanId: playerPlan.id,
      questRouteSectionId: decision.intent.sectionId,
      questRoutePathId: decision.intent.pathId,
    },
    update: {
      questRoutePathId: decision.intent.pathId,
    },
  });

  return { success: true, questPlanId: mutation.questPlanId };
}

async function applyEncounterSelectionMutation({
  db,
  playerId,
  mutation,
}: {
  db: QuestPlanningMutationDb;
  playerId: string;
  mutation: Extract<QuestPlanningMutationInput, { kind: "counter" | "prefight" }>;
}): Promise<QuestPlanningMutationResult> {
  const quest = await loadQuestForPlanning(db, mutation.questPlanId, mutation.objectiveSlug);
  if (!quest) throw new Error("Quest plan not found.");
  const playerPlan = await upsertPlayerQuestPlan(db, playerId, mutation.questPlanId, quest.objective?.id ?? null);
  const intent = await decideSelectionIntent({
    db,
    playerId,
    playerQuestPlanId: playerPlan.id,
    questPlanId: mutation.questPlanId,
    objectiveSlug: mutation.objectiveSlug,
    questEncounterId: mutation.questEncounterId,
    championId: mutation.championId,
    championStars: mutation.championStars ?? null,
    field: mutation.kind === "counter" ? "selectedChampionId" : "prefightChampionId",
    kind: mutation.kind,
  });

  if (intent.kind !== mutation.kind) {
    throw new Error(`Invalid ${mutation.kind} transition.`);
  }

  await db.playerQuestEncounter.upsert({
    where: {
      playerQuestPlanId_questEncounterId: {
        playerQuestPlanId: playerPlan.id,
        questEncounterId: intent.questEncounterId,
      },
    },
    create: {
      playerQuestPlanId: playerPlan.id,
      questEncounterId: intent.questEncounterId,
      questPlanId: mutation.questPlanId,
      [mutation.kind === "counter" ? "selectedChampionId" : "prefightChampionId"]: intent.championId,
      [mutation.kind === "counter" ? "selectedChampionStars" : "prefightChampionStars"]: intent.championStars,
      ...(intent.clearPrefight ? {
        prefightChampionId: null,
        prefightChampionStars: null,
      } : {}),
    },
    update: {
      [mutation.kind === "counter" ? "selectedChampionId" : "prefightChampionId"]: intent.championId,
      [mutation.kind === "counter" ? "selectedChampionStars" : "prefightChampionStars"]: intent.championStars,
      ...(intent.clearPrefight ? {
        prefightChampionId: null,
        prefightChampionStars: null,
      } : {}),
    },
  });

  if (intent.championId === null) {
    await deleteEmptyQuestEncounterSelections(db, playerPlan.id, intent.questEncounterId);
  }

  return {
    success: true,
    questPlanId: mutation.questPlanId,
    invalidateCounterStats: mutation.kind === "counter",
  };
}

async function applyRevivesMutation({
  db,
  playerId,
  mutation,
}: {
  db: QuestPlanningMutationDb;
  playerId: string;
  mutation: Extract<QuestPlanningMutationInput, { kind: "revives" }>;
}): Promise<QuestPlanningMutationResult> {
  const transition = decideQuestPlanningTransition({
    kind: "revives",
    questEncounterId: mutation.questEncounterId,
    revivesUsed: mutation.revivesUsed,
  });
  if (!transition.valid) throw new Error(transition.reason);
  if (transition.intent.kind !== "revives") throw new Error("Invalid revives transition.");

  const quest = await loadQuestForPlanning(db, mutation.questPlanId, mutation.objectiveSlug);
  if (!quest) throw new Error("Quest plan not found.");
  await assertEncounterBelongsToQuest(db, transition.intent.questEncounterId, mutation.questPlanId);
  const playerPlan = await upsertPlayerQuestPlan(db, playerId, mutation.questPlanId, quest.objective?.id ?? null);

  await db.playerQuestEncounter.upsert({
    where: {
      playerQuestPlanId_questEncounterId: {
        playerQuestPlanId: playerPlan.id,
        questEncounterId: transition.intent.questEncounterId,
      },
    },
    create: {
      playerQuestPlanId: playerPlan.id,
      questEncounterId: transition.intent.questEncounterId,
      questPlanId: mutation.questPlanId,
      revivesUsed: transition.intent.revivesUsed,
    },
    update: {
      revivesUsed: transition.intent.revivesUsed,
    },
  });

  if (transition.intent.revivesUsed === 0) {
    await deleteEmptyQuestEncounterSelections(db, playerPlan.id, transition.intent.questEncounterId);
  }

  return { success: true, questPlanId: mutation.questPlanId };
}

async function applySynergyMutation({
  db,
  playerId,
  mutation,
}: {
  db: QuestPlanningMutationDb;
  playerId: string;
  mutation: Extract<QuestPlanningMutationInput, { kind: "synergy" }>;
}): Promise<QuestPlanningMutationResult> {
  if (mutation.isRemoving) {
    const objectiveId = mutation.objectiveSlug
      ? (await loadQuestForPlanning(db, mutation.questPlanId, mutation.objectiveSlug))?.objective?.id ?? null
      : null;
    const playerPlan = await upsertPlayerQuestPlan(db, playerId, mutation.questPlanId, objectiveId);
    await db.playerQuestSynergyChampion.deleteMany({
      where: {
        playerQuestPlanId: playerPlan.id,
        championId: mutation.championId,
      },
    });
    return { success: true, questPlanId: mutation.questPlanId };
  }

  const quest = await loadQuestForPlanning(db, mutation.questPlanId, mutation.objectiveSlug);
  if (!quest) throw new Error("Quest plan not found.");
  const playerPlan = await upsertPlayerQuestPlan(db, playerId, mutation.questPlanId, quest.objective?.id ?? null);

  const intent = await decideSelectionIntent({
    db,
    playerId,
    playerQuestPlanId: playerPlan.id,
    questPlanId: mutation.questPlanId,
    objectiveSlug: mutation.objectiveSlug,
    championId: mutation.championId,
    championStars: null,
    field: "synergyChampionId",
    kind: "synergy",
  });
  if (intent.kind !== "synergy") throw new Error("Invalid synergy transition.");

  await db.playerQuestSynergyChampion.upsert({
    where: {
      playerQuestPlanId_championId: {
        playerQuestPlanId: playerPlan.id,
        championId: intent.championId,
      },
    },
    create: {
      playerQuestPlanId: playerPlan.id,
      championId: intent.championId,
    },
    update: {},
  });

  return { success: true, questPlanId: mutation.questPlanId };
}

async function clearQuestCounters({
  db,
  playerId,
  questPlanId,
  objectiveSlug,
}: {
  db: QuestPlanningMutationDb;
  playerId: string;
  questPlanId: string;
  objectiveSlug?: string | null;
}): Promise<QuestPlanningMutationResult> {
  const quest = await loadQuestForPlanning(db, questPlanId, objectiveSlug);
  if (!quest) throw new Error("Quest plan not found.");
  const playerPlan = await db.playerQuestPlan.findUnique({
    where: { playerId_questPlanId_scopeKey: { playerId, questPlanId, scopeKey: questObjectiveScopeKey(quest?.objective?.id) } },
  });

  if (playerPlan) {
    await db.playerQuestEncounter.updateMany({
      where: { playerQuestPlanId: playerPlan.id },
      data: {
        selectedChampionId: null,
        selectedChampionStars: null,
        prefightChampionId: null,
        prefightChampionStars: null,
      },
    });
    await db.playerQuestEncounter.deleteMany({
      where: {
        playerQuestPlanId: playerPlan.id,
        selectedChampionId: null,
        prefightChampionId: null,
        revivesUsed: 0,
      },
    });
  }

  return { success: true, questPlanId, invalidateCounterStats: true };
}

async function decideSelectionIntent({
  db,
  playerId,
  playerQuestPlanId,
  questPlanId,
  objectiveSlug,
  questEncounterId,
  championId,
  championStars,
  field,
  kind,
}: {
  db: QuestPlanningMutationDb;
  playerId: string;
  playerQuestPlanId: string;
  questPlanId: string;
  objectiveSlug?: string | null;
  questEncounterId?: string;
  championId: number | null;
  championStars: number | null;
  field: "selectedChampionId" | "prefightChampionId" | "synergyChampionId";
  kind: "counter" | "prefight" | "synergy";
}) {
  const [quest, encounter, planDetails, rosterEntries, champion] = await Promise.all([
    loadQuestForPlanning(db, questPlanId, objectiveSlug),
    questEncounterId
      ? db.questEncounter.findUnique({
          where: { id: questEncounterId },
          include: { requiredTags: true },
        })
      : Promise.resolve(null),
    db.playerQuestPlan.findUnique({
      where: { id: playerQuestPlanId },
      include: {
        encounters: {
          select: {
            questEncounterId: true,
            selectedChampionId: true,
            selectedChampionStars: true,
            prefightChampionId: true,
            prefightChampionStars: true,
          },
        },
        synergyChampions: {
          select: { championId: true },
        },
        routeChoices: {
          select: {
            questRouteSectionId: true,
            questRoutePathId: true,
          },
        },
      },
    }),
    championId !== null
      ? db.roster.findMany({
          where: {
            playerId,
            championId,
            ...(championStars !== null ? { stars: championStars } : {}),
          },
          orderBy: [{ stars: "desc" }, { rank: "desc" }],
        })
      : Promise.resolve([]),
    championId !== null
      ? db.champion.findUnique({
          where: { id: championId },
          include: { tags: true },
        })
      : Promise.resolve(null),
  ]);

  if (!quest) throw new Error("Quest plan not found.");
  if (questEncounterId && (!encounter || encounter.questPlanId !== questPlanId)) {
    throw new Error("Invalid quest encounter or plan mismatch.");
  }
  if (!planDetails) throw new Error("Player quest plan not found.");

  const decision = decideQuestPlanningTransition({
    kind,
    quest,
    plan: {
      encounters: planDetails.encounters,
      synergyChampions: planDetails.synergyChampions,
      routeChoices: planDetails.routeChoices,
    },
    field,
    questEncounterId,
    candidate: {
      championId,
      stars: championStars,
      champion: champion ?? undefined,
      rosterEntries,
    },
    encounter: encounter ?? undefined,
  });
  if (!decision.valid) throw new Error(decision.reason);
  if (
    (decision.intent.kind === "counter" || decision.intent.kind === "prefight") &&
    decision.intent.championId !== null
  ) {
    return {
      ...decision.intent,
      championStars: rosterEntries[0]?.stars ?? championStars,
    };
  }
  return {
    ...decision.intent,
    championStars: null,
  };
}

async function loadQuestForPlanning(db: QuestPlanningMutationDb, questPlanId: string, objectiveSlug?: string | null) {
  const quest = await db.questPlan.findUnique({
    where: { id: questPlanId },
    include: {
      requiredTags: true,
      objectives: {
        where: objectiveSlug ? { slug: objectiveSlug } : undefined,
        include: {
          requiredTags: true,
          routeChoices: true,
        },
      },
      encounters: {
        select: { id: true, routePathId: true, sequence: true },
      },
      routeSections: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          title: true,
          parentPathId: true,
          paths: {
            orderBy: { order: "asc" },
            select: { id: true, title: true },
          },
        },
      },
    },
  });
  if (!quest) return null;
  const objective = objectiveSlug ? quest.objectives[0] : null;
  if (objectiveSlug && (!objective || !objective.isVisible)) {
    throw new Error("Quest objective not found.");
  }
  return {
    ...quest,
    objective,
  };
}

async function assertEncounterBelongsToQuest(
  db: QuestPlanningMutationDb,
  questEncounterId: string,
  questPlanId: string
) {
  const encounter = await db.questEncounter.findUnique({
    where: { id: questEncounterId },
    select: { questPlanId: true },
  });

  if (!encounter || encounter.questPlanId !== questPlanId) {
    throw new Error("Invalid quest encounter or plan mismatch.");
  }
}

function upsertPlayerQuestPlan(
  db: QuestPlanningMutationDb,
  playerId: string,
  questPlanId: string,
  questObjectiveId: string | null
) {
  const scopeKey = questObjectiveScopeKey(questObjectiveId);
  return db.playerQuestPlan.upsert({
    where: {
      playerId_questPlanId_scopeKey: {
        playerId,
        questPlanId,
        scopeKey,
      },
    },
    create: {
      playerId,
      questPlanId,
      scopeKey,
      questObjectiveId,
    },
    update: {},
  });
}

function deleteEmptyQuestEncounterSelections(
  db: QuestPlanningMutationDb,
  playerQuestPlanId: string,
  questEncounterId: string
) {
  return db.playerQuestEncounter.deleteMany({
    where: {
      playerQuestPlanId,
      questEncounterId,
      selectedChampionId: null,
      selectedChampionStars: null,
      prefightChampionId: null,
      prefightChampionStars: null,
      revivesUsed: 0,
    },
  });
}
