'use server'

import { prisma } from "@/lib/prisma";
import { requireBotAdmin } from "@/lib/auth-helpers";
import { revalidatePath, revalidateTag } from "next/cache";
import logger from "@/lib/logger";
import { ChampionClass, QuestPlanStatus } from "@prisma/client";
import { uploadToGcs, deleteFromGcs } from "@/lib/gcs";
import { withActionContext } from "@/lib/with-request-context";
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

// --- Quest Categories ---

export { getQuestCategories } from "./quest-catalog";

export const createQuestCategory = withActionContext('createQuestCategory', async (name: string, order: number = 0, parentId?: string) => {
    await requireBotAdmin("MANAGE_QUESTS");

    await prisma.questCategory.create({
        data: {
            name,
            order,
            parentId
        }
    });

    revalidateTag('quest-categories', 'default');
    revalidatePath('/admin/quests');
    revalidatePath('/planning/quests');
    return { success: true };
});

export const updateQuestCategory = withActionContext('updateQuestCategory', async (
    id: string,
    data: { name?: string; order?: number; thumbnailUrl?: string | null; parentId?: string | null }
) => {
    await requireBotAdmin("MANAGE_QUESTS");

    if (data.parentId != null) {
        if (data.parentId === id) {
            throw new Error("A category cannot be its own parent.");
        }
        let currentParentId: string | null = data.parentId;
        while (currentParentId !== null) {
            const ancestor: { parentId: string | null } | null = await prisma.questCategory.findUnique({
                where: { id: currentParentId },
                select: { parentId: true }
            });
            if (!ancestor) break;
            if (ancestor.parentId === id) {
                throw new Error("Setting this parent would create a circular reference.");
            }
            currentParentId = ancestor.parentId;
        }
    }

    await prisma.questCategory.update({
        where: { id },
        data: {
            name: data.name,
            order: data.order,
            thumbnailUrl: data.thumbnailUrl,
            parentId: data.parentId,
        }
    });

    revalidateTag('quest-categories', 'default');
    revalidatePath('/admin/quests');
    revalidatePath('/planning/quests');
    return { success: true };
});

export const uploadQuestCategoryThumbnail = withActionContext('uploadQuestCategoryThumbnail', async (categoryId: string, formData: FormData) => {
    await requireBotAdmin("MANAGE_QUESTS");

    const category = await prisma.questCategory.findUnique({ where: { id: categoryId } });
    if (!category) {
        throw new Error("Category not found.");
    }

    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
        throw new Error("Invalid or missing file upload");
    }

    const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
    if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error("Invalid file type. Only PNG, JPEG, and WebP are allowed.");
    }

    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
        throw new Error("File is too large. Maximum size is 5MB.");
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const sanitizedName = file.name
        .normalize('NFC')
        .replace(/[^\w\-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 80) || 'thumbnail';
    const fileName = `quest-category-thumbnails/${categoryId}-${Date.now()}-${sanitizedName}`;
    const publicUrl = await uploadToGcs(buffer, fileName, file.type);

    try {
        await prisma.questCategory.update({
            where: { id: categoryId },
            data: { thumbnailUrl: publicUrl }
        });
    } catch (error) {
        logger.error({ err: error, categoryId, fileName }, "Failed to update quest category thumbnail URL, deleting GCS object");
        try {
            await deleteFromGcs(fileName);
        } catch (delErr) {
            logger.error({ err: delErr, fileName }, "Failed to delete GCS object during quest category thumbnail cleanup");
        }
        throw error;
    }

    // Delete the old thumbnail from GCS now that the DB is updated
    if (category.thumbnailUrl && category.thumbnailUrl !== publicUrl) {
        try {
            const gcsBase = 'https://storage.googleapis.com/';
            const withoutBase = category.thumbnailUrl.slice(gcsBase.length);
            const slashIdx = withoutBase.indexOf('/');
            if (slashIdx !== -1) {
                const oldPath = withoutBase.slice(slashIdx + 1).split('/').map(decodeURIComponent).join('/');
                await deleteFromGcs(oldPath);
            }
        } catch (delErr) {
            logger.error({ err: delErr, categoryId, thumbnailUrl: category.thumbnailUrl }, "Failed to delete old quest category thumbnail from GCS");
        }
    }

    revalidateTag('quest-categories', 'default');
    revalidatePath('/admin/quests');
    revalidatePath('/planning/quests');

    return { success: true, url: publicUrl };
});

// --- Quest Plans ---

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
export const updateFeaturedPlayers = withActionContext('updateFeaturedPlayers', async (
    questPlanId: string,
    playerIds: string[]
): Promise<{ success: boolean; error?: string }> => {
    try {
        await requireBotAdmin("MANAGE_QUESTS");
        const uniquePlayerIds = [...new Set(playerIds)];

        await prisma.$transaction([
            prisma.playerQuestPlan.updateMany({
                where: { questPlanId },
                data: { isFeatured: false }
            }),
            ...uniquePlayerIds.map(playerId => 
                prisma.playerQuestPlan.upsert({
                    where: {
                        playerId_questPlanId: {
                            playerId,
                            questPlanId
                        }
                    },
                    update: {
                        isFeatured: true
                    },
                    create: {
                        playerId,
                        questPlanId,
                        isFeatured: true
                    }
                })
            )
        ]);

        revalidatePath(`/admin/quests/${questPlanId}`);
        revalidatePath(`/planning/quests/${questPlanId}`);
        revalidateTag('quest-plan-detail', 'default');
        revalidateTag(`quest-featured-picks-${questPlanId}`, 'default');
        
        return { success: true };
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Failed to update featured players";
        logger.error({ err: e, questPlanId }, "Failed to update featured quest players");
        return { success: false, error: message };
    }
});

export type QuestPlanCreateInput = {
    title: string;
    status?: QuestPlanStatus;
    videoUrl?: string | null;
    bannerUrl?: string | null;
    bannerFit?: string | null;
    bannerPosition?: string | null;
    categoryId?: string;
    minStarLevel?: number;
    maxStarLevel?: number;
    teamLimit?: number | null;
    requiredClasses?: ChampionClass[];
    requiredTagIds?: number[]; // Note: Tag.id is actually Int in the schema
    creatorIds?: string[];
};

export const createQuestPlan = withActionContext('createQuestPlan', async (data: QuestPlanCreateInput) => {
    const actingUser = await requireBotAdmin("MANAGE_QUESTS");

    const plan = await prisma.questPlan.create({
        data: {
            title: data.title,
            status: data.status,
            videoUrl: data.videoUrl,
            bannerUrl: data.bannerUrl,
            bannerFit: data.bannerFit || "cover",
            bannerPosition: data.bannerPosition || "center",
            categoryId: data.categoryId,
            creatorId: actingUser.id,
            minStarLevel: data.minStarLevel,
            maxStarLevel: data.maxStarLevel,
            teamLimit: data.teamLimit,
            requiredClasses: data.requiredClasses || [],
            requiredTags: data.requiredTagIds ? {
                connect: data.requiredTagIds.map(id => ({ id }))
            } : undefined,
            creators: data.creatorIds ? {
                connect: data.creatorIds.map(id => ({ id }))
            } : undefined
        }
    });

    revalidatePath('/admin/quests');
    revalidatePath('/planning/quests');
    return { success: true, planId: plan.id };
});

export type QuestPlanUpdateInput = {
    id: string;
    title?: string;
    status?: QuestPlanStatus;
    videoUrl?: string | null;
    bannerUrl?: string | null;
    bannerFit?: string | null;
    bannerPosition?: string | null;
    categoryId?: string | null;
    minStarLevel?: number | null;
    maxStarLevel?: number | null;
    teamLimit?: number | null;
    requiredClasses?: ChampionClass[];
    requiredTagIds?: number[];
    creatorIds?: string[];
};

export const updateQuestPlan = withActionContext('updateQuestPlan', async (data: QuestPlanUpdateInput) => {
    await requireBotAdmin("MANAGE_QUESTS");

    await prisma.questPlan.update({
        where: { id: data.id },
        data: {
            title: data.title,
            status: data.status,
            videoUrl: data.videoUrl,
            bannerUrl: data.bannerUrl,
            bannerFit: data.bannerFit,
            bannerPosition: data.bannerPosition,
            categoryId: data.categoryId,
            minStarLevel: data.minStarLevel,
            maxStarLevel: data.maxStarLevel,
            teamLimit: data.teamLimit,
            requiredClasses: data.requiredClasses,
            requiredTags: data.requiredTagIds !== undefined ? {
                set: data.requiredTagIds.map(id => ({ id }))
            } : undefined,
            creators: data.creatorIds !== undefined ? {
                set: data.creatorIds.map(id => ({ id }))
            } : undefined
        }
    });

    revalidatePath('/admin/quests');
    revalidatePath(`/admin/quests/${data.id}`);
    revalidatePath('/planning/quests');
    revalidatePath(`/planning/quests/${data.id}`);
    return { success: true };
});

export const deleteQuestPlan = withActionContext('deleteQuestPlan', async (id: string) => {
    await requireBotAdmin("MANAGE_QUESTS");

    await prisma.questPlan.delete({
        where: { id }
    });

    revalidatePath('/admin/quests');
    revalidatePath('/planning/quests');
    return { success: true };
});

export const uploadQuestBanner = withActionContext('uploadQuestBanner', async (questPlanId: string, formData: FormData) => {
    await requireBotAdmin("MANAGE_QUESTS");

    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
        throw new Error("Invalid or missing file upload");
    }

    // Validate file type
    const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
    if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error("Invalid file type. Only PNG, JPEG, and WebP are allowed.");
    }

    // Validate file size (e.g., 5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
        throw new Error("File is too large. Maximum size is 5MB.");
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const fileName = `quest-banners/${questPlanId}-${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
    const publicUrl = await uploadToGcs(buffer, fileName, file.type);

    // Update the quest plan with the new banner URL
    try {
        await prisma.questPlan.update({
            where: { id: questPlanId },
            data: { bannerUrl: publicUrl }
        });
    } catch (error) {
        // If the DB update fails, the uploaded GCS object should not be orphaned
        await deleteFromGcs(fileName);
        logger.error({ err: error, questPlanId, fileName }, "Failed to update quest plan banner URL, deleted GCS object");
        throw error;
    }

    revalidatePath(`/admin/quests/${questPlanId}`);
    revalidatePath(`/planning/quests/${questPlanId}`);

    return { success: true, url: publicUrl };
});

export const duplicateQuestPlan = withActionContext('duplicateQuestPlan', async (id: string) => {
    const actingUser = await requireBotAdmin("MANAGE_QUESTS");

    const sourcePlan = await prisma.questPlan.findUnique({
        where: { id },
        include: {
            requiredTags: true,
            encounters: {
                include: {
                    requiredTags: true,
                    recommendedChampions: true,
                    nodes: true
                }
            }
        }
    });

    if (!sourcePlan) throw new Error("Source plan not found");

    const newPlan = await prisma.questPlan.create({
        data: {
            title: `${sourcePlan.title} (Copy)`,
            status: QuestPlanStatus.DRAFT,
            videoUrl: sourcePlan.videoUrl,
            bannerUrl: sourcePlan.bannerUrl,
            bannerFit: sourcePlan.bannerFit,
            bannerPosition: sourcePlan.bannerPosition,
            categoryId: sourcePlan.categoryId,
            creatorId: actingUser.id,
            minStarLevel: sourcePlan.minStarLevel,
            maxStarLevel: sourcePlan.maxStarLevel,
            teamLimit: sourcePlan.teamLimit,
            requiredClasses: sourcePlan.requiredClasses,
            requiredTags: {
                connect: sourcePlan.requiredTags.map(t => ({ id: t.id }))
            },
            encounters: {
                create: sourcePlan.encounters.map(e => ({
                    sequence: e.sequence,
                    videoUrl: e.videoUrl,
                    tips: e.tips,
                    defenderId: e.defenderId,
                    recommendedTags: e.recommendedTags,
                    requiredClasses: e.requiredClasses,
                    minStarLevel: e.minStarLevel,
                    maxStarLevel: e.maxStarLevel,
                    recommendedChampions: {
                        connect: e.recommendedChampions.map(c => ({ id: c.id }))
                    },
                    requiredTags: {
                        connect: e.requiredTags.map(t => ({ id: t.id }))
                    },
                    nodes: {
                        create: e.nodes.map(n => ({
                            nodeModifierId: n.nodeModifierId,
                            isHighlighted: n.isHighlighted
                        }))
                    }
                }))
            }
        }
    });

    revalidatePath('/admin/quests');
    return { success: true, planId: newPlan.id };
});

export {
    exportQuestPlan,
    importQuestPlan,
} from "./quest-plan-transfer";
export const clearRecommendedChampionsInQuest = withActionContext('clearRecommendedChampionsInQuest', async (id: string) => {
    await requireBotAdmin("MANAGE_QUESTS");

    const encounters = await prisma.questEncounter.findMany({
        where: { questPlanId: id },
        select: { id: true }
    });

    if (encounters.length > 0) {
        await prisma.$transaction(
            encounters.map(encounter =>
                prisma.questEncounter.update({
                    where: { id: encounter.id },
                    data: {
                        recommendedChampions: {
                            set: []
                        }
                    }
                })
            )
        );
    }

    revalidatePath(`/admin/quests/${id}`);
    revalidatePath(`/planning/quests/${id}`);
    return { success: true };
});

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
export {
    getPlayerQuestPlanForViewing,
    getPlayerQuestPlansForProfile,
    getShareablePlanId,
} from "./quest-plan-sharing";
