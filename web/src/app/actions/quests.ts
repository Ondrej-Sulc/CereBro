'use server'

import {
    clearAllQuestCounters as clearAllQuestCountersAction,
    savePlayerQuestCounter as savePlayerQuestCounterAction,
    savePlayerQuestEncounterRevives as savePlayerQuestEncounterRevivesAction,
    savePlayerQuestPrefightChampion as savePlayerQuestPrefightChampionAction,
    savePlayerQuestRouteChoice as savePlayerQuestRouteChoiceAction,
    savePlayerQuestSynergy as savePlayerQuestSynergyAction,
} from "./player-quest-progress";

export async function savePlayerQuestRouteChoice(questPlanId: string, sectionId: string, pathId: string) {
    return savePlayerQuestRouteChoiceAction(questPlanId, sectionId, pathId);
}

export async function savePlayerQuestCounter(questPlanId: string, questEncounterId: string, selectedChampionId: number | null, selectedChampionStars: number | null = null) {
    return savePlayerQuestCounterAction(questPlanId, questEncounterId, selectedChampionId, selectedChampionStars);
}

export async function savePlayerQuestPrefightChampion(questPlanId: string, questEncounterId: string, prefightChampionId: number | null, prefightChampionStars: number | null = null) {
    return savePlayerQuestPrefightChampionAction(questPlanId, questEncounterId, prefightChampionId, prefightChampionStars);
}

export async function savePlayerQuestEncounterRevives(questPlanId: string, questEncounterId: string, revivesUsed: number) {
    return savePlayerQuestEncounterRevivesAction(questPlanId, questEncounterId, revivesUsed);
}

export async function clearAllQuestCounters(questPlanId: string) {
    return clearAllQuestCountersAction(questPlanId);
}

export async function savePlayerQuestSynergy(questPlanId: string, championId: number, isRemoving: boolean = false) {
    return savePlayerQuestSynergyAction(questPlanId, championId, isRemoving);
}

export {
    createQuestCategory,
    getQuestCategories,
    updateQuestCategory,
    uploadQuestCategoryThumbnail,
} from "./quest-categories";

export {
    getEncounterAlliancePicks,
    getEncounterFeaturedPicks,
    getEncounterPopularCounters,
    getQuestPlanById,
    getQuestPlans,
} from "./quest-catalog";
export type {
    ChampionCounterData,
    EnhancedCountersMap,
    PickCounterWithChampion,
    PopularCounter,
    PopularCountersMap,
} from "./quest-catalog";

export {
    clearRecommendedChampionsInQuest,
    createQuestPlan,
    deleteQuestPlan,
    duplicateQuestPlan,
    updateFeaturedPlayers,
    updateQuestPlan,
    uploadQuestBanner,
} from "./quest-plan-admin";
export type {
    QuestPlanCreateInput,
    QuestPlanUpdateInput,
} from "./quest-plan-admin";

export {
    exportQuestPlan,
    importQuestPlan,
} from "./quest-plan-transfer";

export {
    createQuestRoutePath,
    createQuestRouteSection,
    deleteQuestRoutePath,
    deleteQuestRouteSection,
    duplicateQuestRoutePathFights,
    reorderQuestRoutePaths,
    reorderQuestRouteSections,
    updateQuestRoutePath,
    updateQuestRouteSection,
} from "./quest-routes";

export {
    bulkAddEncounterVideos,
    bulkCreateQuestEncounters,
    bulkImportNodeModifiersFromJson,
    createQuestEncounter,
    deleteQuestEncounter,
    reorderQuestEncounters,
    reorderQuestEncountersByRoute,
    updateQuestEncounter,
} from "./quest-encounters";
export type {
    BulkEncounterVideoInput,
    BulkNodeImportResult,
    QuestEncounterCreateInput,
    QuestEncounterUpdateInput,
} from "./quest-encounters";

export {
    getPlayerQuestPlanForViewing,
    getPlayerQuestPlansForProfile,
    getShareablePlanId,
} from "./quest-plan-sharing";
