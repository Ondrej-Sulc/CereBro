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
    pathId: string
) => {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser) throw new Error("Unauthorized");

    return applyCurrentPlayerQuestMutation(
        applyPlayerQuestPlanningMutation({
            playerId: actingUser.id,
            mutation: { kind: "routeChoice", questPlanId, sectionId, pathId },
        }),
        actingUser.allianceId
    );
});

export const savePlayerQuestCounter = withActionContext('savePlayerQuestCounter', async (
    questPlanId: string,
    questEncounterId: string,
    selectedChampionId: number | null,
    selectedChampionStars: number | null = null
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
            },
        }),
        actingUser.allianceId
    );
});

export const savePlayerQuestPrefightChampion = withActionContext('savePlayerQuestPrefightChampion', async (
    questPlanId: string,
    questEncounterId: string,
    prefightChampionId: number | null,
    prefightChampionStars: number | null = null
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
            },
        }),
        actingUser.allianceId
    );
});

export const savePlayerQuestEncounterRevives = withActionContext('savePlayerQuestEncounterRevives', async (
    questPlanId: string,
    questEncounterId: string,
    revivesUsed: number
) => {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser) throw new Error("Unauthorized");

    return applyCurrentPlayerQuestMutation(
        applyPlayerQuestPlanningMutation({
            playerId: actingUser.id,
            mutation: { kind: "revives", questPlanId, questEncounterId, revivesUsed },
        }),
        actingUser.allianceId
    );
});

export const clearAllQuestCounters = withActionContext('clearAllQuestCounters', async (questPlanId: string) => {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser) throw new Error("Unauthorized");

    return applyCurrentPlayerQuestMutation(
        applyPlayerQuestPlanningMutation({
            playerId: actingUser.id,
            mutation: { kind: "clearCounters", questPlanId },
        }),
        actingUser.allianceId
    );
});

export const savePlayerQuestSynergy = withActionContext('savePlayerQuestSynergy', async (
    questPlanId: string,
    championId: number,
    isRemoving: boolean = false
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
            },
        }),
        actingUser.allianceId
    );
});
