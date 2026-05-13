'use server'

import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { decideQuestPlanningTransition } from "@/lib/quest-planning-transition";
import type { QuestPlanningRouteChoices } from "@/lib/quest-planning-projection";
import { withActionContext } from "@/lib/with-request-context";
import { revalidatePath, revalidateTag } from "next/cache";

function revalidateQuestProgress(questPlanId: string) {
    revalidatePath(`/planning/quests/${questPlanId}`);
    revalidateTag('quest-plans', 'default');
    revalidateTag('quest-plan-detail', 'default');
}

function revalidateQuestCounterStats(questPlanId: string, allianceId?: string | null) {
    revalidateTag(`quest-popular-counters-${questPlanId}`, 'default');
    revalidateTag('quest-popular-counters', 'default');

    if (allianceId) {
        revalidateTag(`quest-alliance-picks-${questPlanId}-${allianceId}`, 'default');
        revalidateTag('quest-alliance-picks', 'default');
    }
}

export const savePlayerQuestRouteChoice = withActionContext('savePlayerQuestRouteChoice', async (
    questPlanId: string,
    sectionId: string,
    pathId: string
) => {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser) throw new Error("Unauthorized");

    const quest = await prisma.questPlan.findUnique({
        where: { id: questPlanId },
        select: {
            teamLimit: true,
            minStarLevel: true,
            maxStarLevel: true,
            requiredClasses: true,
            requiredTags: true,
            encounters: {
                select: { id: true, routePathId: true, sequence: true }
            },
            routeSections: {
                orderBy: { order: "asc" },
                select: {
                    id: true,
                    title: true,
                    parentPathId: true,
                    paths: {
                        orderBy: { order: "asc" },
                        select: { id: true, title: true }
                    }
                }
            }
        }
    });
    if (!quest) throw new Error("Quest plan not found.");

    const decision = decideQuestPlanningTransition({
        kind: "routeChoice",
        quest,
        plan: { encounters: [] },
        sectionId,
        pathId,
    });
    if (!decision.valid) throw new Error(decision.reason);
    if (decision.intent.kind !== "routeChoice") throw new Error("Invalid route transition.");

    const playerPlan = await prisma.playerQuestPlan.upsert({
        where: {
            playerId_questPlanId: {
                playerId: actingUser.id,
                questPlanId
            }
        },
        create: {
            playerId: actingUser.id,
            questPlanId
        },
        update: {}
    });

    await prisma.playerQuestRouteChoice.upsert({
        where: {
            playerQuestPlanId_questRouteSectionId: {
                playerQuestPlanId: playerPlan.id,
                questRouteSectionId: decision.intent.sectionId
            }
        },
        create: {
            playerQuestPlanId: playerPlan.id,
            questRouteSectionId: decision.intent.sectionId,
            questRoutePathId: decision.intent.pathId
        },
        update: {
            questRoutePathId: decision.intent.pathId
        }
    });

    revalidateQuestProgress(questPlanId);
    return { success: true };
});

async function assertPlayerQuestSelectionTransition({
    playerId,
    playerQuestPlanId,
    questPlanId,
    questEncounterId,
    championId,
    field,
    kind,
    routeChoices,
}: {
    playerId: string;
    playerQuestPlanId: string;
    questPlanId: string;
    questEncounterId?: string;
    championId: number | null;
    field: "selectedChampionId" | "prefightChampionId" | "synergyChampionId";
    kind: "counter" | "prefight" | "synergy";
    routeChoices?: QuestPlanningRouteChoices;
}) {
    const [quest, encounter, planDetails, rosterEntries, champion] = await Promise.all([
        prisma.questPlan.findUnique({
            where: { id: questPlanId },
            include: {
                requiredTags: true,
                encounters: {
                    select: { id: true, routePathId: true, sequence: true }
                },
                routeSections: {
                    orderBy: { order: "asc" },
                    select: {
                        id: true,
                        title: true,
                        parentPathId: true,
                        paths: {
                            orderBy: { order: "asc" },
                            select: { id: true, title: true }
                        }
                    }
                }
            }
        }),
        questEncounterId
            ? prisma.questEncounter.findUnique({
                where: { id: questEncounterId },
                include: { requiredTags: true }
            })
            : Promise.resolve(null),
        prisma.playerQuestPlan.findUnique({
            where: { id: playerQuestPlanId },
            include: {
                encounters: {
                    select: {
                        questEncounterId: true,
                        selectedChampionId: true,
                        prefightChampionId: true,
                    }
                },
                synergyChampions: {
                    select: { championId: true }
                },
                routeChoices: {
                    select: {
                        questRouteSectionId: true,
                        questRoutePathId: true,
                    }
                }
            }
        }),
        championId !== null
            ? prisma.roster.findMany({
                where: { playerId, championId },
                orderBy: [{ stars: 'desc' }, { rank: 'desc' }]
            })
            : Promise.resolve([]),
        championId !== null
            ? prisma.champion.findUnique({
                where: { id: championId },
                include: { tags: true }
            })
            : Promise.resolve(null)
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
            champion: champion ?? undefined,
            rosterEntries,
        },
        encounter: encounter ?? undefined,
        routeChoicesOverride: routeChoices,
    });
    if (!decision.valid) throw new Error(decision.reason);
    return decision.intent;
}

export const savePlayerQuestCounter = withActionContext('savePlayerQuestCounter', async (questPlanId: string, questEncounterId: string, selectedChampionId: number | null, routeChoices?: QuestPlanningRouteChoices) => {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser) throw new Error("Unauthorized");

    const playerPlan = await prisma.playerQuestPlan.upsert({
        where: {
            playerId_questPlanId: {
                playerId: actingUser.id,
                questPlanId: questPlanId
            }
        },
        create: {
            playerId: actingUser.id,
            questPlanId: questPlanId
        },
        update: {}
    });

    const intent = await assertPlayerQuestSelectionTransition({
        playerId: actingUser.id,
        playerQuestPlanId: playerPlan.id,
        questPlanId,
        questEncounterId,
        championId: selectedChampionId,
        field: "selectedChampionId",
        kind: "counter",
        routeChoices,
    });
    if (intent.kind !== "counter") throw new Error("Invalid counter transition.");

    await prisma.playerQuestEncounter.upsert({
        where: {
            playerQuestPlanId_questEncounterId: {
                playerQuestPlanId: playerPlan.id,
                questEncounterId: intent.questEncounterId
            }
        },
        create: {
            playerQuestPlanId: playerPlan.id,
            questEncounterId: intent.questEncounterId,
            questPlanId: questPlanId,
            selectedChampionId: intent.championId
        },
        update: {
            selectedChampionId: intent.championId
        }
    });

    if (intent.championId === null) {
        await prisma.playerQuestEncounter.deleteMany({
            where: {
                playerQuestPlanId: playerPlan.id,
                questEncounterId: intent.questEncounterId,
                selectedChampionId: null,
                prefightChampionId: null,
                revivesUsed: 0
            }
        });
    }

    revalidateQuestProgress(questPlanId);
    revalidateQuestCounterStats(questPlanId, actingUser.allianceId);
    return { success: true };
});

export const savePlayerQuestPrefightChampion = withActionContext('savePlayerQuestPrefightChampion', async (questPlanId: string, questEncounterId: string, prefightChampionId: number | null, routeChoices?: QuestPlanningRouteChoices) => {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser) throw new Error("Unauthorized");

    const playerPlan = await prisma.playerQuestPlan.upsert({
        where: {
            playerId_questPlanId: {
                playerId: actingUser.id,
                questPlanId
            }
        },
        create: {
            playerId: actingUser.id,
            questPlanId
        },
        update: {}
    });

    const intent = await assertPlayerQuestSelectionTransition({
        playerId: actingUser.id,
        playerQuestPlanId: playerPlan.id,
        questPlanId,
        questEncounterId,
        championId: prefightChampionId,
        field: "prefightChampionId",
        kind: "prefight",
        routeChoices,
    });
    if (intent.kind !== "prefight") throw new Error("Invalid prefight transition.");

    await prisma.playerQuestEncounter.upsert({
        where: {
            playerQuestPlanId_questEncounterId: {
                playerQuestPlanId: playerPlan.id,
                questEncounterId: intent.questEncounterId
            }
        },
        create: {
            playerQuestPlanId: playerPlan.id,
            questEncounterId: intent.questEncounterId,
            questPlanId,
            prefightChampionId: intent.championId
        },
        update: {
            prefightChampionId: intent.championId
        }
    });

    if (intent.championId === null) {
        await prisma.playerQuestEncounter.deleteMany({
            where: {
                playerQuestPlanId: playerPlan.id,
                questEncounterId: intent.questEncounterId,
                selectedChampionId: null,
                prefightChampionId: null,
                revivesUsed: 0
            }
        });
    }

    revalidateQuestProgress(questPlanId);
    return { success: true };
});

export const savePlayerQuestEncounterRevives = withActionContext('savePlayerQuestEncounterRevives', async (questPlanId: string, questEncounterId: string, revivesUsed: number) => {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser) throw new Error("Unauthorized");

    const transition = decideQuestPlanningTransition({
        kind: "revives",
        questEncounterId,
        revivesUsed,
    });
    if (!transition.valid) throw new Error(transition.reason);
    if (transition.intent.kind !== "revives") throw new Error("Invalid revives transition.");

    const encounter = await prisma.questEncounter.findUnique({
        where: { id: transition.intent.questEncounterId },
        select: { questPlanId: true }
    });

    if (!encounter || encounter.questPlanId !== questPlanId) {
        throw new Error("Invalid quest encounter or plan mismatch.");
    }

    const playerPlan = await prisma.playerQuestPlan.upsert({
        where: {
            playerId_questPlanId: {
                playerId: actingUser.id,
                questPlanId
            }
        },
        create: {
            playerId: actingUser.id,
            questPlanId
        },
        update: {}
    });

    await prisma.playerQuestEncounter.upsert({
        where: {
            playerQuestPlanId_questEncounterId: {
                playerQuestPlanId: playerPlan.id,
                questEncounterId: transition.intent.questEncounterId
            }
        },
        create: {
            playerQuestPlanId: playerPlan.id,
            questEncounterId: transition.intent.questEncounterId,
            questPlanId,
            revivesUsed: transition.intent.revivesUsed
        },
        update: {
            revivesUsed: transition.intent.revivesUsed
        }
    });

    if (transition.intent.revivesUsed === 0) {
        await prisma.playerQuestEncounter.deleteMany({
            where: {
                playerQuestPlanId: playerPlan.id,
                questEncounterId: transition.intent.questEncounterId,
                selectedChampionId: null,
                prefightChampionId: null,
                revivesUsed: 0
            }
        });
    }

    revalidateQuestProgress(questPlanId);
    return { success: true };
});

export const clearAllQuestCounters = withActionContext('clearAllQuestCounters', async (questPlanId: string) => {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser) throw new Error("Unauthorized");

    const playerPlan = await prisma.playerQuestPlan.findUnique({
        where: { playerId_questPlanId: { playerId: actingUser.id, questPlanId } }
    });

    if (playerPlan) {
        await prisma.playerQuestEncounter.updateMany({
            where: { playerQuestPlanId: playerPlan.id },
            data: { selectedChampionId: null, prefightChampionId: null }
        });
        await prisma.playerQuestEncounter.deleteMany({
            where: {
                playerQuestPlanId: playerPlan.id,
                selectedChampionId: null,
                prefightChampionId: null,
                revivesUsed: 0
            }
        });
    }

    revalidateQuestProgress(questPlanId);
    revalidateQuestCounterStats(questPlanId, actingUser.allianceId);
    return { success: true };
});

export const savePlayerQuestSynergy = withActionContext('savePlayerQuestSynergy', async (questPlanId: string, championId: number, isRemoving: boolean = false, routeChoices?: QuestPlanningRouteChoices) => {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser) throw new Error("Unauthorized");

    const playerPlan = await prisma.playerQuestPlan.upsert({
        where: {
            playerId_questPlanId: {
                playerId: actingUser.id,
                questPlanId: questPlanId
            }
        },
        create: {
            playerId: actingUser.id,
            questPlanId: questPlanId
        },
        update: {}
    });

    if (isRemoving) {
        await prisma.playerQuestSynergyChampion.deleteMany({
            where: {
                playerQuestPlanId: playerPlan.id,
                championId: championId,
            }
        });
    } else {
        const intent = await assertPlayerQuestSelectionTransition({
            playerId: actingUser.id,
            playerQuestPlanId: playerPlan.id,
            questPlanId,
            championId,
            field: "synergyChampionId",
            kind: "synergy",
            routeChoices,
        });
        if (intent.kind !== "synergy") throw new Error("Invalid synergy transition.");

        await prisma.playerQuestSynergyChampion.upsert({
            where: {
                playerQuestPlanId_championId: {
                    playerQuestPlanId: playerPlan.id,
                    championId: intent.championId
                }
            },
            create: {
                playerQuestPlanId: playerPlan.id,
                championId: intent.championId
            },
            update: {}
        });
    }

    revalidateQuestProgress(questPlanId);
    return { success: true };
});
