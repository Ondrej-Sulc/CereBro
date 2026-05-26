'use server'

import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import {
    applyPlayerQuestPlanningMutation,
    type QuestPlanningMutationResult,
} from "@/lib/quest-planning-mutation";
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

async function applyCurrentPlayerQuestMutation(
    resultPromise: Promise<QuestPlanningMutationResult>,
    allianceId?: string | null
) {
    const result = await resultPromise;
    revalidateQuestProgress(result.questPlanId);
    if (result.invalidateCounterStats) {
        revalidateQuestCounterStats(result.questPlanId, allianceId);
    }
    return { success: true };
}

export const savePlayerQuestRouteChoice = withActionContext('savePlayerQuestRouteChoice', async (
    questPlanId: string,
    sectionId: string,
    pathId: string,
    objectiveSlug?: string | null
) => {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser) throw new Error("Unauthorized");

    return applyCurrentPlayerQuestMutation(
        applyPlayerQuestPlanningMutation({
            playerId: actingUser.id,
            mutation: { kind: "routeChoice", questPlanId, sectionId, pathId, objectiveSlug },
        }),
        actingUser.allianceId
    );
});

export const savePlayerQuestCounter = withActionContext('savePlayerQuestCounter', async (
    questPlanId: string,
    questEncounterId: string,
    selectedChampionId: number | null,
    selectedChampionStars: number | null = null,
    objectiveSlug?: string | null
) => {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser) throw new Error("Unauthorized");

    return applyCurrentPlayerQuestMutation(
        applyPlayerQuestPlanningMutation({
            playerId: actingUser.id,
            mutation: {
                kind: "counter",
                questPlanId,
                questEncounterId,
                championId: selectedChampionId,
                championStars: selectedChampionStars,
                objectiveSlug,
            },
        }),
        actingUser.allianceId
    );
});

export const savePlayerQuestPrefightChampion = withActionContext('savePlayerQuestPrefightChampion', async (
    questPlanId: string,
    questEncounterId: string,
    prefightChampionId: number | null,
    prefightChampionStars: number | null = null,
    objectiveSlug?: string | null
) => {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser) throw new Error("Unauthorized");

    return applyCurrentPlayerQuestMutation(
        applyPlayerQuestPlanningMutation({
            playerId: actingUser.id,
            mutation: {
                kind: "prefight",
                questPlanId,
                questEncounterId,
                championId: prefightChampionId,
                championStars: prefightChampionStars,
                objectiveSlug,
            },
        }),
        actingUser.allianceId
    );
});

export const savePlayerQuestEncounterRevives = withActionContext('savePlayerQuestEncounterRevives', async (
    questPlanId: string,
    questEncounterId: string,
    revivesUsed: number,
    objectiveSlug?: string | null
) => {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser) throw new Error("Unauthorized");

    return applyCurrentPlayerQuestMutation(
        applyPlayerQuestPlanningMutation({
            playerId: actingUser.id,
            mutation: { kind: "revives", questPlanId, questEncounterId, revivesUsed, objectiveSlug },
        }),
        actingUser.allianceId
    );
});

export const clearAllQuestCounters = withActionContext('clearAllQuestCounters', async (questPlanId: string, objectiveSlug?: string | null) => {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser) throw new Error("Unauthorized");

    return applyCurrentPlayerQuestMutation(
        applyPlayerQuestPlanningMutation({
            playerId: actingUser.id,
            mutation: { kind: "clearCounters", questPlanId, objectiveSlug },
        }),
        actingUser.allianceId
    );
});

export const savePlayerQuestSynergy = withActionContext('savePlayerQuestSynergy', async (
    questPlanId: string,
    championId: number,
    isRemoving: boolean = false,
    objectiveSlug?: string | null
) => {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser) throw new Error("Unauthorized");

    return applyCurrentPlayerQuestMutation(
        applyPlayerQuestPlanningMutation({
            playerId: actingUser.id,
            mutation: {
                kind: "synergy",
                questPlanId,
                championId,
                isRemoving,
                objectiveSlug,
            },
        }),
        actingUser.allianceId
    );
});
